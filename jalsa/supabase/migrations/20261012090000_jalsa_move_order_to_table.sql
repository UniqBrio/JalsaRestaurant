-- =============================================================================
-- Jalsa — move a running order to another table (12-Oct-2026).
--
-- WHY
--   "From table A1, the customer wants to sit at A2 - move all their orders to A2." Until now the
--   only ways off a table were to pay, to cancel, or to join a second table to the bill; a party
--   that simply changed tables left their order behind on the table they had left.
--
-- WHAT
--   move_bill_to_table(...) does the whole move as ONE transaction, holding the bill's row lock and
--   the destination table's row lock:
--     - the bill must still be open or payment requested, and still live on the table that was
--       tapped ('gone' / 'not_here' otherwise - nothing changes);
--     - the destination must be this restaurant's, on the floor, not the same table, and FREE: no
--       live bill ('taken'), not waiting to be cleared ('needs_clearing'), and no phone there with
--       an unsent order ('taken') - a stranger's cart there would otherwise be looking at this bill.
--       Free tables only, as the owner chose; merging two live bills is not this action;
--     - the bill's membership moves: its row for the old table is released (left NOT cleared, so the
--       old table shows "Needs clearing" for the plates left on it), and the new table joins - a row
--       the bill once had there (moved back) is reused, never duplicated;
--     - rounds not yet at the table (new / preparing / ready / picked up) now belong to the new
--       table, so every kitchen and runner screen - and any ticket still waiting to print, which is
--       composed from the round when a printer claims it - says the new table. Served and cancelled
--       rounds stay where they happened: history;
--     - the party's phones (sessions on this bill at the old table) move with it and remember where
--       they came from, so a phone still showing the old table's page is sent to the new one;
--     - open requests from the old table for this bill ("Bill requested", "Water" ...) follow it;
--     - the bill's host table becomes the new table when it was the old one;
--     - one audit row records it, in the same transaction.
--   Nothing is deleted. The bill keeps its code, rounds, lines, discount, tip and captain.
--
--   Captains may do it by default (owner's choice): `tables.transfer`, which every owner already
--   holds, is granted to every existing Captain here and added to the Captain preset in code.
--
-- ACCESS: called only by this application's server with the secret key (rule 3); EXECUTE is
-- revoked from everyone else, like cancel_bill_and_free (20261007090000).
-- SAFE ON A LIVE DATABASE: one new nullable column, a new function, and permission rows added
-- (never replaced) for captains. No existing row changes.
-- =============================================================================

begin;

alter table public.guest_session
  add column if not exists moved_from_table_id uuid references public.dining_table(id) on delete set null;

create or replace function public.move_bill_to_table(
  p_restaurant_id  uuid,
  p_bill_id        uuid,
  p_from_table_id  uuid,
  p_to_table_id    uuid,
  p_actor_staff_id uuid,
  p_actor_label    text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  b         public.bill%rowtype;
  dest      public.dining_table%rowtype;
  from_name text;
  moved     int;
  now_      timestamptz := now();
begin
  select * into b
    from public.bill
   where id = p_bill_id and restaurant_id = p_restaurant_id
     for update;
  if not found or b.status::text not in ('open', 'payment_requested') then
    return 'gone';
  end if;
  -- The tapped table still holds THIS order.
  if not exists (
    select 1 from public.bill_table
     where bill_id = p_bill_id and table_id = p_from_table_id and released_at is null
  ) then
    return 'not_here';
  end if;
  if p_to_table_id = p_from_table_id then
    return 'same';
  end if;

  -- The destination's row lock: two moves into one table queue here, and the second sees 'taken'.
  select * into dest
    from public.dining_table
   where id = p_to_table_id and restaurant_id = p_restaurant_id
     for update;
  if not found or not dest.active then
    return 'unavailable';
  end if;
  if exists (select 1 from public.bill_table where table_id = p_to_table_id and released_at is null) then
    return 'taken';
  end if;
  if exists (
    select 1 from public.bill_table
     where table_id = p_to_table_id and released_at is not null and cleared_at is null
  ) then
    return 'needs_clearing';
  end if;
  if exists (
    select 1 from public.guest_session s join public.guest_cart_line c on c.session_id = s.id
     where s.table_id = p_to_table_id
  ) then
    return 'taken';
  end if;

  select name into from_name from public.dining_table where id = p_from_table_id;

  update public.bill_table
     set released_at = now_
   where bill_id = p_bill_id and table_id = p_from_table_id and released_at is null;

  insert into public.bill_table (bill_id, table_id)
  values (p_bill_id, p_to_table_id)
  on conflict (bill_id, table_id) do update
    set released_at = null, cleared_at = null, cleared_by = '', joined_at = now_;

  update public.kot
     set table_id = p_to_table_id
   where bill_id = p_bill_id and table_id = p_from_table_id
     and status in ('new', 'preparing', 'ready', 'picked_up');
  get diagnostics moved = row_count;

  update public.guest_session
     set table_id = p_to_table_id, moved_from_table_id = p_from_table_id
   where table_id = p_from_table_id and bill_id = p_bill_id;

  update public.table_request
     set table_id = p_to_table_id
   where table_id = p_from_table_id and bill_id = p_bill_id and done_at is null;

  update public.bill
     set host_table_id = case when host_table_id = p_from_table_id then p_to_table_id else host_table_id end,
         updated_at = now_
   where id = p_bill_id;

  insert into public.audit_entry (restaurant_id, action, detail, bill_id, table_id, actor_staff_id, actor_label)
  values (
    p_restaurant_id,
    'Table moved',
    b.code || ' moved from ' || coalesce(from_name, 'its table') || ' to ' || dest.name
      || case when moved > 0 then ' - ' || moved || case when moved = 1 then ' round' else ' rounds' end
           || ' still to come now go to ' || dest.name
         else '' end,
    p_bill_id,
    p_to_table_id,
    p_actor_staff_id,
    p_actor_label
  );

  return 'moved';
end;
$$;

revoke execute on function public.move_bill_to_table(uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.move_bill_to_table(uuid, uuid, uuid, uuid, uuid, text) to service_role;

-- Captains move a party by default (owner's choice, 12-Oct-2026). Added, never replaced: a person
-- whose grant was set by hand keeps what the owner set.
insert into public.staff_permission (staff_id, perm_key, granted, granted_by)
select st.id, 'tables.transfer', true, 'setup'
  from public.staff st
 where st.role = 'Captain'
on conflict (staff_id, perm_key) do nothing;

commit;
