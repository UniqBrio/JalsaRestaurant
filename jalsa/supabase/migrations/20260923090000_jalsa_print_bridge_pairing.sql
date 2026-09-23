-- =============================================================================
-- 20260923090000_jalsa_print_bridge_pairing
--
-- THE CUSTOMER-FACING HALF OF THE PRINT BRIDGE: pair a computer, see its printers, choose one.
--
-- WHAT GATES 1-6 LEFT
--   A working bridge that a restaurant owner could only set up by copying a 69-character token
--   into an environment variable, typing `machine_id=queue` pairs by hand, and knowing the exact
--   name Windows gave the printer during its driver install. Every one of those is a support call.
--
-- WHAT THIS MIGRATION ADDS, AND WHAT IT DELIBERATELY DOES NOT
--   1. `bridge_pairing_code` — a short-lived, single-use code the owner reads off Jalsa and types
--      into the installer ONCE. Only its SHA-256 is stored, the same posture as `bridge_token`.
--      Redeeming it creates an ordinary `bridge_token` row: pairing sits ON TOP of the hashed,
--      revocable token model and replaces none of it.
--   2. `bridge_discovered_printer` — what the bridge found in Windows (`Get-Printer`). A snapshot
--      the bridge rewrites on every sync, which is why rows are replaced rather than kept: it is
--      the answer to "what can this PC see right now", not a history.
--   3. `bridge_printer` — the per-computer mapping: Jalsa printer → the Windows queue on THIS PC.
--      Keyed by (bridge_token_id, printer_id). The queue name is a property of one computer and
--      lives here, next to the token of that computer — never on `printer`, which stays the
--      restaurant's own description of its machines and the only thing routing reads.
--
-- WHY ONE PRINTER MAPS TO ONE COMPUTER
--   `bridge_printer_one_computer` makes a Jalsa printer reachable through exactly one PC. Two PCs
--   both claiming the tandoor printer is two bridges racing for one queue that only one of them
--   can physically reach — the loser would fail every ticket it won. Moving a printer to another
--   computer REPLACES the mapping; it does not add a second one.
--
-- NOTHING HERE ROUTES ANYTHING. `print_job.printer_id` stays immutable (Phase 1 trigger); the
-- mapping only tells one PC how to reach a machine Jalsa already chose.
-- =============================================================================

begin;

-- ── How a token came to exist ─────────────────────────────────────────────────────────────
-- 'manual' is every token issued before this migration (Print setup → Bridges, pasted into an
-- environment variable). 'paired' came from a pairing code. A paired token's jobs are limited
-- server-side to the printers mapped to it; a manual token keeps the Gate 4 behaviour exactly.
alter table public.bridge_token
  add column if not exists source         text not null default 'manual',
  add column if not exists hostname       text not null default '',
  add column if not exists bridge_version text not null default '',
  add column if not exists last_sync_at   timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bridge_token_source_check') then
    alter table public.bridge_token
      add constraint bridge_token_source_check check (source in ('manual', 'paired'));
  end if;
end $$;

-- ── The pairing code ──────────────────────────────────────────────────────────────────────
create table if not exists public.bridge_pairing_code (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  -- SHA-256 hex of the normalised code. The code itself is shown once, on the owner's screen.
  code_hash      text not null,
  -- What the owner called the computer. Becomes `bridge_token.label` on redemption.
  label          text not null check (length(btrim(label)) between 1 and 60),
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  -- Set exactly once, by the conditional update that redeems it. Also set when a newer code
  -- supersedes it, with `used_by_token_id` left null — a superseded code is spent, not redeemed.
  used_at        timestamptz,
  used_by_token_id uuid references public.bridge_token(id) on delete set null
);

create unique index if not exists bridge_pairing_code_hash_unique on public.bridge_pairing_code (code_hash);
create index if not exists bridge_pairing_code_restaurant_idx on public.bridge_pairing_code (restaurant_id, created_at desc);
alter table public.bridge_pairing_code enable row level security;

-- ── What the computer can see ─────────────────────────────────────────────────────────────
create table if not exists public.bridge_discovered_printer (
  bridge_token_id uuid not null references public.bridge_token(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurant(id) on delete cascade,
  -- The Windows queue name, exactly as `Get-Printer` reported it. Never typed by a person.
  queue_name      text not null check (length(queue_name) between 1 and 200),
  driver_name     text not null default '',
  port_name       text not null default '',
  -- 'ready' | 'offline' | 'error' | 'unknown' — already interpreted by the bridge's parser.
  status          text not null default 'unknown',
  -- Print to PDF, XPS, OneNote, fax: listed last, never offered first.
  is_virtual      boolean not null default false,
  reported_at     timestamptz not null default now(),
  primary key (bridge_token_id, queue_name)
);
create index if not exists bridge_discovered_printer_restaurant_idx on public.bridge_discovered_printer (restaurant_id);
alter table public.bridge_discovered_printer enable row level security;

-- ── The mapping ───────────────────────────────────────────────────────────────────────────
-- RECONCILIATION (23-Sep-2026). The TEST project carried an earlier, unrecorded draft of this
-- table (`bridge_printer` with an `id` primary key and a `windows_queue` column, from migration
-- `20260923075759 jalsa_bridge_pairing`, which exists in no repository file). Applied in filename
-- order over that draft, `create table if not exists` would have left the wrong shape in place and
-- every write below it would have failed on a missing column. So the draft is converged rather than
-- assumed away: its queue column takes this file's name, the missing index is added, and its `id`
-- column is left alone (it is harmless, and every write here lets it default). The draft's
-- `bridge_pairing` table is not this file's and is left untouched; nothing reads it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bridge_printer' and column_name = 'windows_queue'
  ) then
    alter table public.bridge_printer rename column windows_queue to queue_name;
  end if;
end $$;

create table if not exists public.bridge_printer (
  bridge_token_id uuid not null references public.bridge_token(id) on delete cascade,
  printer_id      uuid not null references public.printer(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurant(id) on delete cascade,
  queue_name      text not null check (length(queue_name) between 1 and 200),
  created_by      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (bridge_token_id, printer_id)
);
-- Present whether the table was created above or converged from the draft.
alter table public.bridge_printer
  add column if not exists queue_name text not null default '',
  add column if not exists created_by text not null default '';
create unique index if not exists bridge_printer_one_computer on public.bridge_printer (printer_id);
create unique index if not exists bridge_printer_unique on public.bridge_printer (bridge_token_id, printer_id);
create index if not exists bridge_printer_restaurant_idx on public.bridge_printer (restaurant_id);
alter table public.bridge_printer enable row level security;

commit;
