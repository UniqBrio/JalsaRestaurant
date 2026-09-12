-- =============================================================================
-- 20260912100000_jalsa_free_a_table
--
-- A table that nobody is sitting at, that the floor still believes is taken.
--
-- WHAT HOLDS A TABLE TODAY, AND WHY NOBODY CAN LET GO OF IT
--   Occupancy is derived, not stored: a table is taken while an OPEN BILL has an unreleased
--   `bill_table` row on it. There is a partial unique index enforcing one open bill per table,
--   which is the right rule and the reason this problem has no workaround — a party that left
--   with a bill open and nothing sent to the kitchen leaves a table the next party's first
--   round cannot be created on, and there is no screen anywhere that can release it.
--
--   Closing the bill is not the answer: a closure names a member of staff, a payment mode and
--   an amount, and there was no payment. Recording one would be a lie in the ledger.
--
-- WHAT THIS PERMISSION BUYS, AND ITS EXACT LIMIT
--   `tables.free` releases a table whose bill has NO ROUNDS on it. The moment food has gone to
--   the kitchen the answer is a payment or a void, not a floor operation — a tile on a grid
--   should never be able to write off a bill, and this one cannot.
--
--   Granted to the owner here. Everyone else gets it the way the design intends: the owner
--   grants it per person on the Staff screen. Captains do NOT receive it by role — "owner can
--   mark this feature to someone else" is a grant, not a preset.
-- =============================================================================

begin;

do $$
declare
  r uuid;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';

  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select st.id, 'tables.free', true, 'setup'
  from public.staff st
  where st.restaurant_id = r
    and st.role = 'Owner / Admin'
  on conflict (staff_id, perm_key) do nothing;
end $$;

commit;
