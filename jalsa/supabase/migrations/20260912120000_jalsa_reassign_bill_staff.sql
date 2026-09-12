-- =============================================================================
-- 20260912120000_jalsa_reassign_bill_staff
--
-- Correcting the captain or waiter named on a bill — including one already closed.
--
-- WHY THIS IS A PERMISSION AND NOT SIMPLY AN EDIT
--   The captain on a bill is not a label. `addTip` attributes the tip to `bill.captain_id`, and
--   the tips ledger and the settle-up screen both read from that attribution. Changing the
--   captain on a CLOSED bill therefore moves money that has already been counted, and possibly
--   already handed over. That is not a typo correction; it is a transfer, and it belongs behind
--   a grant the owner hands out deliberately.
--
--   Granted here to the owner only. Anyone else gets it the way the design intends — per person,
--   on the Staff screen — because a preset would give it to every captain the restaurant ever
--   hires, and a captain who can reassign a bill to themselves can reassign a tip to themselves.
--
-- WHAT MAKES IT SAFE IS THE AUDIT LINE, NOT A TIME LIMIT
--   `reassignBillStaff` writes the old name, the new name, the tip amount that moved with it and
--   who moved it. A cut-off ("only until end of shift") would be a rule nobody remembers at the
--   moment it bites; a traceable correction stays safe at any hour.
-- =============================================================================

begin;

do $$
declare
  r uuid;
begin
  select id into r from public.restaurant where slug = 'jalsa-hosur';

  insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
  select st.id, 'bill.reassign_staff', true, 'setup'
  from public.staff st
  where st.restaurant_id = r
    and st.role = 'Owner / Admin'
  on conflict (staff_id, perm_key) do nothing;
end $$;

commit;
