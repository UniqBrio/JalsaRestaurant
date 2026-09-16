-- =============================================================================
-- 20260916100000_jalsa_guest_queue
--
-- The guest's half of the entrance queue: "one QR at the door puts you in the queue".
--
-- WHAT THE DESIGN ASKS FOR THAT THE OWNER-SIDE TABLE COULD NOT ANSWER
--   Jalsa Customer Patterns.dc.html, pattern 6c, is the alert a waiting party gets:
--
--       🎉  Your table is ready
--           W-18 · 4 guests · Table A4
--
--   The table name is in it. `seatWaitlist` deliberately stamped `seated_at` and nothing else,
--   on the argument that seating and opening a bill are two different acts — that argument still
--   holds and is unchanged. But "which table did you seat them at" is not the same question as
--   "which bill did you open", and the guest's phone has to answer the first one. Without it the
--   alert can only say "your table is ready" and leave a party of four scanning a dining room.
--
-- WHY IT IS NULLABLE AND HAS NO FOREIGN-KEY CASCADE TO BILL
--   A party can be seated at a table that never opens a bill — they leave, they change their
--   minds, the captain merges them into a group on a different table. The column records where
--   the host SENT them, which is a fact about the seating, not a claim about the service that
--   followed. `on delete set null` so retiring a table from the floor plan does not delete the
--   history of parties who once sat at it.
--
-- WHY THE GUEST IS NOT GIVEN A PERMISSION
--   Everything else in this application is written by a named member of staff holding a grant.
--   A party standing at the door has no PIN and never will. The guest's write is therefore
--   deliberately narrow: it may create a row with a party size and `source = 'scanned'`, and it
--   may mark its OWN row removed. It cannot notify, cannot seat, cannot read anyone else's row,
--   and cannot set a token or a code — those come from the server. The identifier the phone
--   holds is the row's own uuid in a cookie, which is unguessable and grants nothing beyond
--   that one row. For a scanned join the row holds no name and no number, exactly as the
--   design's copy promises: "No name or number needed."
-- =============================================================================

begin;

alter table public.waitlist_entry
  add column if not exists seated_table_id uuid references public.dining_table(id) on delete set null;

-- Only a seated party can have a table. A row carrying a table with no seating stamp is a
-- contradiction the database should refuse rather than a screen should explain away.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'waitlist_entry_table_needs_seating'
  ) then
    alter table public.waitlist_entry
      add constraint waitlist_entry_table_needs_seating
      check (seated_table_id is null or seated_at is not null);
  end if;
end $$;

commit;
