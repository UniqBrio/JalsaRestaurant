-- =============================================================================
-- Jalsa — "How did you hear about us?" answers that are never lost (02-Oct-2026).
--
-- WHY
--   The answer lived only on `guest_session.heard_about`, and a session is legitimately deleted:
--   Mark free deletes every session on the table (`freeTable`), and a phone that scans another
--   table has its old session replaced. Each took the guest's answer with it, and a later visit
--   by the same phone at the same table overwrote the earlier visit's answer. The owner's report
--   counted what was left.
--
-- WHAT
--   `guest_attribution` - one row per answer per visit. It REFERENCES the session, table and
--   bill but does not belong to them: every one of those foreign keys is ON DELETE SET NULL, so
--   releasing a table, moving a phone or deleting a session leaves the answer where it is.
--   `session_token` (the phone's cookie token, unchanged when it moves tables) is how a guest who
--   re-picks within the same sitting corrects their answer instead of adding a second one.
--
--   `guest_session.heard_dismissed_at` - a guest who said "Not now" is not asked again.
--
--   `guest_session.heard_about` stays, written as before, for the welcome screen's own box and for
--   any code from before this change; the report reads `guest_attribution`.
--
-- BACKFILL: every answer still on a session today becomes an attribution row, dated by the
-- session's start (the date the report has always used). Nothing is deleted.
--
-- RLS: enabled with no permissive policy, like every table here (rule 3). A guest writes only
-- through `/api/guest/heard`, on their own session, found by their own cookie.
-- =============================================================================

begin;

create table if not exists public.guest_attribution (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurant(id) on delete cascade,
  guest_session_id uuid references public.guest_session(id) on delete set null,
  session_token    text not null default '',
  table_id         uuid references public.dining_table(id) on delete set null,
  bill_id          uuid references public.bill(id) on delete set null,
  -- As the guest typed or picked it. Grouping (case, spacing, punctuation, the standard
  -- choices) happens when it is counted, so a better rule never needs a migration.
  source           text not null check (length(btrim(source)) between 1 and 60),
  answered_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.guest_attribution enable row level security;

-- The report reads a date range; the correction lookup reads a phone's latest answer.
create index if not exists guest_attribution_answered_idx
  on public.guest_attribution (restaurant_id, answered_at desc);
create index if not exists guest_attribution_token_idx
  on public.guest_attribution (restaurant_id, session_token, answered_at desc);

alter table public.guest_session
  add column if not exists heard_dismissed_at timestamptz;

-- The welcome screen's source list reads this table and is polled: an answer moves the floor
-- counter, as a change to `guest_session.heard_about` always has (20260924130000).
drop trigger if exists guest_attribution_bump_floor on public.guest_attribution;
create trigger guest_attribution_bump_floor
  after insert or update or delete on public.guest_attribution
  for each statement execute function public.bump_change_version('floor');

-- Every answer that still exists today. Idempotent: a session already copied is not copied again.
insert into public.guest_attribution
  (restaurant_id, guest_session_id, session_token, table_id, bill_id, source, answered_at, updated_at)
select s.restaurant_id, s.id, s.token, s.table_id, s.bill_id, left(btrim(s.heard_about), 60), s.created_at, s.created_at
  from public.guest_session s
 where btrim(s.heard_about) <> ''
   and not exists (select 1 from public.guest_attribution a where a.guest_session_id = s.id);

commit;
