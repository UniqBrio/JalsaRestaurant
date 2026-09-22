-- =============================================================================
-- 20260922090000_jalsa_print_job_food_side
--
-- GATE 4 REMEDIATION R4-1: a print job must know WHICH HALF of a round it is.
--
-- WHAT WAS WRONG
--   `splitRound` buckets a round on three values — printer, station, and which side of the
--   veg/non-veg split the items fall on. `queuePrint` persisted the first two and discarded the
--   third, because the third existed only as a local variable and never left the function.
--
--   With the food-type split switched on, one round therefore produced two `print_job` rows that
--   were IDENTICAL IN EVERY STORED FIELD: same machine, same station, one veg half and one
--   non-veg half, and nothing in the database to say which was which. Three consequences, all of
--   them observed:
--
--   1. Composition could not tell the two apart, so neither could be rendered and neither
--      printed. A restaurant with the split on could not print a kitchen ticket at all.
--   2. Worse, a "print elsewhere" redirect to a machine the round ALSO touches matched the wrong
--      bucket by machine-and-station alone and composed the other half — a silently wrong ticket,
--      for dishes that had already printed somewhere else, while the intended round was never
--      delivered.
--   3. Any renderer that guessed between the two would print the whole round twice at one
--      machine, which is the one printing mistake that costs real food.
--
-- WHY A COLUMN AND NOT A DERIVATION
--   The side could in principle be inferred — from insertion order, from `created_at`, from which
--   food types happen to be present. Every one of those is wrong. Row order out of PostgREST is
--   unspecified, a batch insert ties on the timestamp, and the food types are a CONSEQUENCE of
--   the split rather than the key it was split on: a veg-side bucket may hold veg and egg, and
--   the two sides are interchangeable in that aggregate. This repository's answer to "a decision
--   taken at a moment" is already established by `printer_name` and `station` — snapshot it.
--
-- WHY THE DEFAULT IS 'all', AND WHY THAT IS THE WHOLE BACKFILL
--   'all' is the value `splitRound` produces when the split is OFF: one side, carrying
--   everything. Every row that exists today was written under that reading or is ambiguous, so
--   the default makes "the split-off path behaves exactly as it did" true BY CONSTRUCTION rather
--   than by testing for it.
--
--   It deliberately does NOT rescue pre-migration rows written while the split was on. Those
--   still collide, and composition still refuses them. A backfill that guessed their sides would
--   be the duplicate-printing defect, arriving as a migration.
--
-- WHY IT IS IMMUTABLE
--   Same argument as `printer_id`, one migration earlier: this is the job's identity, not its
--   state. A retry re-sends the SAME half to the SAME machine. The immutability lives in the
--   database rather than only in TypeScript because the rule `printer_id` learnt the hard way is
--   that a rule enforced only in the layer that already broke it is a comment.
--
--   It is a SEPARATE trigger from `print_job_printer_immutable` on purpose. That function is
--   named for what it protects; widening it silently would leave a name that lies.
-- =============================================================================

begin;

alter table public.print_job
  add column if not exists food_side text not null default 'all';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'print_job_food_side_check') then
    alter table public.print_job
      add constraint print_job_food_side_check
      check (food_side in ('all', 'veg_side', 'non_veg'));
  end if;
end $$;

-- ── The half is permanent ─────────────────────────────────────────────────────────────────
create or replace function public.print_job_food_side_is_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.food_side <> old.food_side then
    raise exception
      'print_job.food_side is immutable (job %, %). A retry re-sends the SAME half of the round to the same machine; a different half is a different ticket.',
      old.id, old.food_side
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists print_job_food_side_immutable on public.print_job;
create trigger print_job_food_side_immutable
  before update on public.print_job
  for each row
  execute function public.print_job_food_side_is_immutable();

commit;
