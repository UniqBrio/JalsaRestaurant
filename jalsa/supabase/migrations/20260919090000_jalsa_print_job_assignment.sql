-- =============================================================================
-- 20260919090000_jalsa_print_job_assignment
--
-- PHASE 1 OF THE PRINTING WORK: a print job must know the exact physical printer it was
-- assigned to, and that assignment must survive every later action taken on the job.
--
-- WHAT WAS WRONG
--   `print_job` carried `printer_id` and nothing else about the destination. Three consequences,
--   all of them observed in this tree:
--
--   1. `retryPrintJob` re-selected a printer on every attempt and OVERWROTE `printer_id` with
--      whichever machine of the right purpose the unordered query returned first. A tandoor
--      ticket that failed came back assigned to the main kitchen, and `last_error` — the only
--      place the intended station was ever written down — was cleared on the way past. After one
--      retry the row no longer described the decision it was created from.
--   2. A round spanning two stations was collapsed into ONE job against `decisions[0]`, with the
--      other stations named only in a free-text reason nothing parses.
--   3. `reprintKot` called `queuePrint` without categories, so a reprint resolved through the
--      "nobody claims this" branch and went to the fallback machine — the tandoor's ticket
--      reprinted in the main kitchen, by construction, every time.
--
-- WHAT THIS MIGRATION ADDS, AND WHY EACH COLUMN IS NOT A JOIN
--   `station` and `printer_name` are SNAPSHOTS, in the idiom `kot_item` already uses for names
--   and prices: *"A bill printed last Tuesday must still say what it said."* A print job is a
--   record of a decision taken at a moment. Renaming a machine, re-stationing it, or (one day)
--   deleting it must not silently rewrite where last night's ticket was sent — that is the
--   audit trail a kitchen argues over when a station insists it never got the round.
--
--   `routing_rule` is the DECISION, as a value rather than a sentence. `last_error` held it as
--   prose, which meant the one fact worth filtering on — did this ticket reach the machine it was
--   meant for, or a fallback? — could only be recovered by reading English.
--
--   `last_attempt_at` separates "when the job was created" from "when it was last tried".
--   `created_at` could not answer the second, so a job retried four hours later looked untouched.
--
--   `redirected_from_job_id` is how "Print elsewhere" is recorded. Sending a ticket to a
--   different machine deliberately is a NEW job with its own assignment, pointing back at the one
--   it replaces — never an edit of the original, because the original is the evidence.
--
-- WHY `printer_id` IS MADE IMMUTABLE IN THE DATABASE AND NOT ONLY IN TYPESCRIPT
--   It is the rule the whole phase rests on, and it was broken by application code that read
--   perfectly reasonably. A rule enforced only in the layer that already broke it is a comment.
--   The trigger below permits exactly one transition — non-null to null, which is the FK's own
--   `on delete set null` and nothing else — and rejects every reassignment.
--
-- WHY `kot_item` GAINS A CATEGORY SNAPSHOT
--   Routing runs on the menu category, and `kot_item` snapshotted the name, the price and the
--   food type but not the category. So a reprint had nothing to route ON and fell back by
--   construction (consequence 3 above). Snapshotting it here puts the routing input in the same
--   place as the other facts the ticket is built from, and means a category renamed between the
--   order and the reprint still sends the reprint where the original went.
--
-- NOTHING HERE OPENS A SOCKET. Physical transport is Phase 2. This migration only makes the
-- application's own decision explicit, complete and permanent.
-- =============================================================================

begin;

-- ── The routing input, snapshotted where the other ticket facts already live ──────────────
alter table public.kot_item
  add column if not exists menu_category_name text not null default '';

-- ── The destination, snapshotted on the job ───────────────────────────────────────────────
alter table public.print_job
  add column if not exists station          text not null default '',
  add column if not exists printer_name     text not null default '',
  add column if not exists routing_rule     text not null default '',
  add column if not exists last_attempt_at  timestamptz,
  add column if not exists redirected_from_job_id uuid references public.print_job(id) on delete set null;

-- Backfill, best effort, BEFORE the immutability trigger exists. Existing rows keep whatever
-- printer they were last assigned; all this does is write down its name and station so the
-- history reads the same way for old rows as for new ones.
update public.print_job j
   set printer_name = p.name,
       station      = p.station
  from public.printer p
 where p.id = j.printer_id
   and j.printer_name = '';

update public.kot_item ki
   set menu_category_name = c.name
  from public.menu_item mi
  join public.menu_category c on c.id = mi.category_id
 where mi.id = ki.menu_item_id
   and ki.menu_category_name = '';

do $$
begin
  -- The four routing rules, plus 'chosen' for a job an operator directed by hand (Print
  -- elsewhere), which is not a routing outcome and must not be mistakable for one. 'none' is
  -- the only value that leaves printer_id null, and the only case in which a job is created
  -- already failed: there was no machine to assign it to.
  if not exists (select 1 from pg_constraint where conname = 'print_job_routing_rule_check') then
    alter table public.print_job
      add constraint print_job_routing_rule_check
      check (routing_rule in ('', 'routed', 'fallback', 'unrouted', 'none', 'chosen'));
  end if;
end $$;

-- ── The assignment is permanent ───────────────────────────────────────────────────────────
create or replace function public.print_job_printer_is_immutable()
returns trigger
language plpgsql
as $$
begin
  -- Null to a real printer is not a reassignment: it is a job that never had one being given
  -- one, which "Print elsewhere" does not do (it inserts) but a future repair might.
  if old.printer_id is null then
    return new;
  end if;

  -- The FK's own `on delete set null`. Permitted, because refusing it would make a printer row
  -- undeletable forever; the snapshot columns keep the record of where the ticket was sent.
  if new.printer_id is null then
    return new;
  end if;

  if new.printer_id <> old.printer_id then
    raise exception
      'print_job.printer_id is immutable (job %, assigned to %). A retry re-sends to the SAME machine; sending a ticket to a different one is a new job — see printElsewhere().',
      old.id, old.printer_id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists print_job_printer_immutable on public.print_job;
create trigger print_job_printer_immutable
  before update on public.print_job
  for each row
  execute function public.print_job_printer_is_immutable();

-- The history screen groups a redirect with the job it replaced.
create index if not exists print_job_redirected_from_idx
  on public.print_job (redirected_from_job_id)
  where redirected_from_job_id is not null;

commit;
