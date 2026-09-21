-- =============================================================================
-- 20260921090000_jalsa_print_bridge
--
-- PHASE 2, GATE 1: the server half of the local print bridge.
--
-- WHAT PHASE 1 LEFT
--   A print job knows its exact machine and cannot be re-pointed. What it had no way to say is
--   "somebody is carrying this to the printer right now", and nothing could ever say "paper came
--   out", because `printed` was deliberately made unwritable — a status the application had no
--   evidence for. This migration adds the two facts a delivery agent needs and nothing else.
--
-- WHY `processing` IS A STATUS AND NOT A BOOLEAN
--   A job in flight is not queued and not finished, and the difference matters to a person
--   looking at a screen: `queued` means nobody has picked it up, `processing` means somebody has
--   and the paper is imminent. Collapsing them would make a bridge that died mid-send
--   indistinguishable from one that never started, which is exactly the case the sweeper exists
--   to resolve.
--
-- WHY THE CLAIM IS A COLUMN PAIR AND NOT A LOCK
--   The claim is `update ... where id = $1 and status = 'queued'`. Postgres makes that atomic on
--   its own: two bridges issue the same statement, one updates a row and one updates none, and
--   the loser learns it lost from the row count. An advisory lock would add a second mechanism
--   for a guarantee the first already gives, and a lock held by a crashed process is a worse
--   failure than a stale timestamp anybody can read.
--
-- WHY A STALE CLAIM IS NEVER AUTOMATICALLY RE-QUEUED
--   A bridge that vanished mid-send may or may not have put paper in the kitchen. Re-queueing
--   guesses that it did not, and a wrong guess prints the round twice — the one printing mistake
--   that costs real food. So a stale claim expires to `failed`, where Jalsa's existing retry and
--   redirect semantics apply and a PERSON decides. `sweepStaleClaims` is server-side for the same
--   reason: a bridge must never adjudicate its own death.
--
-- WHY BRIDGE TOKENS ARE A TABLE AND THE TOKEN ITSELF IS NOT IN IT
--   A bridge runs on a PC in a restaurant, unattended. It cannot hold `SUPABASE_SECRET_KEY` —
--   that key bypasses RLS entirely and would put the whole database on the kitchen counter. It
--   holds one bearer token instead, scoped to one restaurant, which buys exactly three verbs:
--   list, claim, report. Only the SHA-256 of the token is stored, so a leak of this table does
--   not yield a working credential, and revoking is a timestamp rather than a redeploy.
--
-- NOTHING HERE ROUTES ANYTHING. `printer_id` remains immutable by the Phase 1 trigger, and the
-- report path below is written so it cannot name a printer at all.
-- =============================================================================

begin;

-- ── The in-flight status ──────────────────────────────────────────────────────────────────
-- `add value` is committed here and deliberately NOT used anywhere in this file: Postgres
-- refuses to use a new enum label in the transaction that introduced it, and a migration that
-- half-applies is worse than one that does one thing.
alter type public.print_status add value if not exists 'processing';

-- ── Who is carrying the job, and since when ───────────────────────────────────────────────
alter table public.print_job
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz;

-- The sweeper reads exactly this: claims older than its threshold. Partial, because a queued or
-- finished job is never a candidate and has no business in the index.
create index if not exists print_job_claimed_idx
  on public.print_job (claimed_at)
  where claimed_at is not null;

-- ── The bridge's credential ───────────────────────────────────────────────────────────────
create table if not exists public.bridge_token (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  -- What a person calls the machine it lives on: "Kitchen PC". Printed in `claimed_by`, so the
  -- history reads as a place rather than a uuid.
  label          text not null check (length(btrim(label)) between 1 and 60),
  -- SHA-256 hex of the token. The token itself is shown once, at issue, and never stored.
  token_hash     text not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz,
  revoked_at     timestamptz
);

create unique index if not exists bridge_token_hash_unique on public.bridge_token (token_hash);
create index if not exists bridge_token_restaurant_idx on public.bridge_token (restaurant_id);

-- Same posture as every other table: RLS on, no permissive policy. The browser never reads this,
-- and the bridge never reads it either — only the server, through its own secret key.
alter table public.bridge_token enable row level security;

commit;
