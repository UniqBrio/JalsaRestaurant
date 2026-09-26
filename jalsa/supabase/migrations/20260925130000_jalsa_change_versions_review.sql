-- ============================================================================================
-- Change versions, after review — every change a screen shows moves a counter, and nothing else.
--
-- A fresh-context review of latency fix 4 (25-Sep-2026) found counters that failed to move — a
-- screen told "unchanged" while it showed something stale — and one that moved for nothing. Each
-- was reproduced against a real Postgres before this file existed
-- (tests/unit/change-versions.db.unit.spec.ts):
--
--   1. A round MOVED between bills (detaching a table) moved only the bill it joined. The guest
--      at the table left behind kept seeing the moved round and the old total.
--   2. An item moved between rounds of different bills: the same, one level down.
--   3. A staff member renamed: guest bills show the captain and waiter by name, but only the
--      staff counter moved.
--   4. A guest's cart moved the staff/owner counter — no staff screen shows carts, so every cart
--      tap in the restaurant made every captain's phone re-read in full.
--   5. A print computer's FIRST contact ("Waiting" → "Connected" on the owner's Printers screen)
--      moved nothing: last_seen_at was excluded as a heartbeat, which it is only after the first.
--   6. The printers a PC reports were excluded outright, so a new printer took up to a minute to
--      appear in the mapping flow the owner is actively watching.
--   7. Two counters bumped by one statement were locked in no particular order — a deadlock
--      waiting for a busy moment.
-- ============================================================================================

-- 7. Scopes are bumped one at a time, in a fixed order, so two writers can never hold them crosswise.
create or replace function public.bump_change_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s text;
begin
  foreach s in array (select array_agg(x order by x) from unnest(tg_argv) as x) loop
    update public.change_version set version = version + 1 where scope = s;
  end loop;
  return null;
end;
$$;

-- 1 & 2. A child row moves the bill it belongs to NOW and the bill it belonged to BEFORE, locked
-- in id order for the same reason as above.
create or replace function public.bill_version_from_child()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  targets uuid[];
  target uuid;
begin
  if tg_table_name = 'kot_item' then
    select array_agg(k.bill_id) into targets
      from public.kot k
     where k.id = new.kot_id or k.id = old.kot_id;
  else
    targets := array[new.bill_id, old.bill_id];
  end if;
  for target in select distinct x from unnest(targets) as x where x is not null order by x loop
    update public.bill set version = version where id = target;
  end loop;
  return null;
end;
$$;

-- 3. A new name reaches guest screens. Only a real name change: staff rows change for other
--    reasons (a PIN, an employment detail) that no guest sees.
drop trigger if exists staff_bump_catalog on public.staff;
create trigger staff_bump_catalog
  after update on public.staff
  for each row
  when (old.name is distinct from new.name)
  execute function public.bump_change_version('catalog');

-- 4. Carts are the guest's own business; their screens watch them through the session stamp.
drop trigger if exists guest_cart_line_bump_floor on public.guest_cart_line;

-- 5. A print computer's first contact is news; every heartbeat after it is not.
drop trigger if exists bridge_token_bump_floor_upd on public.bridge_token;
create trigger bridge_token_bump_floor_upd
  after update on public.bridge_token
  for each row
  when (
    old.label is distinct from new.label
    or old.revoked_at is distinct from new.revoked_at
    or old.source is distinct from new.source
    or old.hostname is distinct from new.hostname
    or old.bridge_version is distinct from new.bridge_version
    or (old.last_seen_at is null) <> (new.last_seen_at is null)
  )
  execute function public.bump_change_version('floor');

-- 6. The printers a PC reports: a printer appearing, leaving or changing moves the counter; the
--    same list re-reported on every sync (only reported_at changes) does not.
drop trigger if exists bridge_discovered_printer_bump_floor_ins_del on public.bridge_discovered_printer;
drop trigger if exists bridge_discovered_printer_bump_floor_upd on public.bridge_discovered_printer;
create trigger bridge_discovered_printer_bump_floor_ins_del
  after insert or delete on public.bridge_discovered_printer
  for each row execute function public.bump_change_version('floor');
create trigger bridge_discovered_printer_bump_floor_upd
  after update on public.bridge_discovered_printer
  for each row
  when (
    old.driver_name is distinct from new.driver_name
    or old.port_name is distinct from new.port_name
    or old.status is distinct from new.status
    or old.is_virtual is distinct from new.is_virtual
  )
  execute function public.bump_change_version('floor');
