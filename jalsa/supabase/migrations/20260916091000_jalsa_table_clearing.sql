-- =============================================================================
-- 20260916091000_jalsa_table_clearing
--
-- The gap between "the party paid" and "the next party can sit down".
--
-- THE STATE EXISTED AND WAS UNREACHABLE
--   `lib/status.ts` has had a `clearing` table state and a `TABLE_STATE.clearing` label —
--   "Needs clearing" — since the floor was built, and `tableStateFrom` takes an
--   `awaitingClearing` flag. NOTHING HAS EVER PASSED IT. `queries.ts` calls the function with
--   three arguments and never the fourth, so the state is dead by construction: no table has
--   ever been in it, and the waiter's Clear queue in the design set had nothing to read.
--
-- WHY A COLUMN AND NOT A TABLE
--   The moment a table needs clearing is already recorded. `release_tables_on_close()` stamps
--   `bill_table.released_at` on every table of a bill the instant it closes — that stamp IS
--   "the guests have gone". What was missing is the other end: whether anybody has since reset
--   it. One nullable column beside the one that already exists answers it, and a separate table
--   would have been a second record of an event the first one already holds, with the usual
--   consequence that the two disagree about a table somebody joined mid-service.
--
--   So: a table needs clearing while released_at IS NOT NULL and cleared_at IS NULL.
--
-- REOPENING A BILL UNDOES THE CLEARING TOO
--   The trigger already nulls `released_at` when a closed bill goes back to open — a closure
--   recorded in error. `cleared_at` has to go with it: a table that was wiped down for a party
--   that turns out not to have left is not a clean, free table, and leaving the stamp would
--   hide it from the queue forever. One branch, both columns, so the pair can never disagree.
-- =============================================================================

begin;

alter table public.bill_table
  add column if not exists cleared_at timestamptz;

-- Who reset it. Named for the same reason a closure is named: it is the difference between a
-- record and a claim, and "this table was cleared" is a claim somebody makes about a room they
-- were standing in.
alter table public.bill_table
  add column if not exists cleared_by text not null default '';

-- The waiter's queue is read as "everything released and not yet cleared, oldest first". A
-- partial index over exactly that predicate keeps it cheap as the evening's cleared rows pile
-- up behind it.
create index if not exists bill_table_awaiting_clearing_idx
  on public.bill_table (released_at)
  where released_at is not null and cleared_at is null;

-- Same trigger, now maintaining both ends of the pair. The closing branch is unchanged; the
-- reopening branch gains cleared_at so a reversed closure puts the table back in the queue
-- rather than leaving it silently marked done.
create or replace function public.release_tables_on_close()
returns trigger language plpgsql as $$
begin
  if new.status = 'closed' and coalesce(old.status, 'open') <> 'closed' then
    update public.bill_table
       set released_at = coalesce(new.closed_at, now())
     where bill_id = new.id and released_at is null;
  elsif new.status <> 'closed' and old.status = 'closed' then
    update public.bill_table
       set released_at = null,
           cleared_at = null,
           cleared_by = ''
     where bill_id = new.id;
  end if;
  return new;
end;
$$;

do $$
declare
  r uuid;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';

  -- `tables.clear` is new; it is the waiter's verb, so waiters get it by role here as well as
  -- the owner. Clearing a table takes nothing away that cannot be put back — it neither closes
  -- a bill nor releases a table that is still held — so it does not need the per-person grant
  -- that `tables.free` does.
  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select st.id, 'tables.clear', true, 'setup'
  from public.staff st
  where st.restaurant_id = r
    and st.role in ('Owner / Admin', 'Waiter', 'Captain')
  on conflict (staff_id, perm_key) do nothing;
end $$;

commit;
