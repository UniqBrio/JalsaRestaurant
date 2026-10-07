-- =============================================================================
-- Jalsa — an order already with the kitchen can be cancelled and its table freed, in one step,
-- and a takeaway order can carry a photo (07-Oct-2026).
--
-- WHY (cancel)
--   "Mark free" (`freeTable`) refuses the moment a round exists: a tile on a floor grid must not
--   write off a bill. That left a table whose party had to leave after ordering - an emergency, a
--   duplicate order, a kitchen that cannot make it - with no honest way out: it could not be
--   freed, and closing it would record a payment that never happened (rule 2).
--
--   The fix keeps the order. The bill becomes 'void' (the status every screen already reads as
--   "Cancelled" for guests and "Void" for staff), with who, when, why, from what and for how much
--   stamped on the row itself. Nothing is deleted: rounds, lines, prices, discount, tax rate,
--   packaging, KOT codes and print history all stay exactly as they were.
--
-- WHAT
--   bill.cancelled_at / cancelled_by_staff_id / cancelled_by_label / cancel_reason / cancel_note /
--   cancelled_total / cancelled_from_status - the cancellation, on the bill it cancels.
--   `bill_cancel_is_attributed` makes a cancellation without a void status or a named person
--   impossible, the way `bill_closure_is_attributed` does for a closure.
--
--   cancel_bill_and_free(...) does the whole thing as ONE transaction, holding the bill's row lock:
--     - the bill must still be open or payment requested, at the version the screen read, and
--       still sit on the table that was tapped - otherwise nothing changes and the caller is told
--       which ('gone': completed or already cancelled; 'changed': something moved since it was
--       read; 'not_here': that table now holds a different order). Two people pressing at once:
--       the second waits on the lock, then sees 'void' and gets 'gone'. A new party's order on
--       the same table is a different bill id, so it can never be the one released.
--     - the bill is voided with the cancellation stamped; closed_at stays empty (it was not paid);
--     - rounds still in the kitchen (new / preparing / ready) are marked cancelled, so no
--       kitchen or runner screen treats them as work; served and picked-up rounds stay history;
--     - KOT tickets still WAITING to print are cancelled (the bridge lists only 'queued'), so a
--       cancelled order's ticket cannot come out of the kitchen printer later;
--     - every table of the bill is released and marked cleared by this person (free at once);
--     - the phones at those tables are let go (as Mark free does), so the next scan is a fresh
--       welcome; their attribution and hearts are kept (SET NULL / the bill's own FK);
--     - open "Bill requested" / "Clear the table" notices for the bill are marked done;
--     - one audit row records it, in the same transaction, so a cancellation without its record
--       cannot exist.
--
-- WHY (photo)
--   bill.photo_url - a takeaway order's photo (a parcel, a handwritten slip). Takeaway only, by
--   constraint. The file lives in the existing private `media` bucket under takeaway/<bill>/;
--   no new bucket.
--
-- ACCESS: called only by this application's server with the secret key (rule 3); EXECUTE is
-- revoked from everyone else, like `redirect_print_job` (20261002120000).
-- SAFE ON A LIVE DATABASE: new nullable / defaulted columns, two checks every existing row
-- satisfies (no row has a cancellation or a photo yet), and a new function. No row is changed.
-- =============================================================================

begin;

alter table public.bill
  add column if not exists cancelled_at          timestamptz,
  add column if not exists cancelled_by_staff_id uuid references public.staff(id) on delete set null,
  add column if not exists cancelled_by_label    text not null default '',
  add column if not exists cancel_reason         text not null default '',
  add column if not exists cancel_note           text not null default '',
  add column if not exists cancelled_total       numeric(12, 2),
  add column if not exists cancelled_from_status text not null default '',
  add column if not exists photo_url             text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bill_cancel_is_attributed') then
    alter table public.bill
      add constraint bill_cancel_is_attributed check (
        cancelled_at is null
        or (status = 'void' and length(btrim(cancelled_by_label)) > 0 and length(btrim(cancel_reason)) > 0)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_cancel_text_len') then
    alter table public.bill
      add constraint bill_cancel_text_len check (length(cancel_reason) <= 80 and length(cancel_note) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_photo_is_takeaway') then
    alter table public.bill
      add constraint bill_photo_is_takeaway check (photo_url = '' or order_type = 'takeaway');
  end if;
end;
$$;

-- The operational report reads cancellations by date.
create index if not exists bill_cancelled_idx on public.bill (restaurant_id, cancelled_at desc)
  where cancelled_at is not null;

create or replace function public.cancel_bill_and_free(
  p_restaurant_id    uuid,
  p_bill_id          uuid,
  p_table_id         uuid,
  p_expected_version bigint,
  p_actor_staff_id   uuid,
  p_actor_label      text,
  p_reason           text,
  p_note             text,
  p_total            numeric
)
returns text
language plpgsql
set search_path = public
as $$
declare
  b         public.bill%rowtype;
  tables    text;
  tids      uuid[];
  kots      int;
  stopped   int;
  now_      timestamptz := now();
begin
  select * into b
    from public.bill
   where id = p_bill_id and restaurant_id = p_restaurant_id
     for update;
  if not found then
    return 'gone';
  end if;
  -- Completed, or already cancelled by someone else: nothing to do, and nothing done.
  if b.status::text not in ('open', 'payment_requested') then
    return 'gone';
  end if;
  -- The order the screen read is the order being cancelled - not one a round later.
  if b.version <> p_expected_version then
    return 'changed';
  end if;
  -- The tapped table still holds THIS order. A new party's order is another bill id.
  if not exists (
    select 1 from public.bill_table bt
     where bt.bill_id = p_bill_id and bt.table_id = p_table_id and bt.released_at is null
  ) then
    return 'not_here';
  end if;

  select string_agg(t.name, ', ' order by t.name), array_agg(t.id) into tables, tids
    from public.bill_table bt join public.dining_table t on t.id = bt.table_id
   where bt.bill_id = p_bill_id and bt.released_at is null;
  select count(*)::int into kots from public.kot where bill_id = p_bill_id;

  update public.bill
     set status = 'void',
         cancelled_at = now_,
         cancelled_by_staff_id = p_actor_staff_id,
         cancelled_by_label = p_actor_label,
         cancel_reason = p_reason,
         cancel_note = coalesce(p_note, ''),
         cancelled_total = p_total,
         cancelled_from_status = b.status::text,
         updated_at = now_
   where id = p_bill_id;

  update public.kot
     set status = 'cancelled',
         cancelled_at = now_,
         cancel_reason = 'Order cancelled: ' || p_reason
   where bill_id = p_bill_id and status in ('new', 'preparing', 'ready');
  get diagnostics stopped = row_count;

  update public.print_job
     set status = 'cancelled',
         completed_at = now_,
         last_error = 'Order cancelled before this ticket printed - not printed.'
   where bill_id = p_bill_id and status = 'queued';

  update public.bill_table
     set released_at = now_, cleared_at = now_, cleared_by = p_actor_label
   where bill_id = p_bill_id and released_at is null;

  delete from public.guest_session
   where table_id = any (tids);

  update public.table_request
     set done_at = now_
   where bill_id = p_bill_id and done_at is null and kind in ('Clear the table', 'Bill requested');

  insert into public.audit_entry (restaurant_id, action, detail, bill_id, table_id, actor_staff_id, actor_label)
  values (
    p_restaurant_id,
    'Order cancelled',
    b.code || ' cancelled while ' || replace(b.status::text, '_', ' ')
      || ' (' || kots || case when kots = 1 then ' round' else ' rounds' end
      || ', ' || stopped || ' still in the kitchen stopped). Bill ' || b.status::text || ' -> void; table '
      || coalesce(tables, '') || ' occupied -> free. Reason: ' || p_reason
      || case when coalesce(p_note, '') <> '' then ' - ' || p_note else '' end
      || '. Nothing was charged; the order is kept.',
    p_bill_id,
    p_table_id,
    p_actor_staff_id,
    p_actor_label
  );

  return 'cancelled';
end;
$$;

revoke execute on function public.cancel_bill_and_free(uuid, uuid, uuid, bigint, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.cancel_bill_and_free(uuid, uuid, uuid, bigint, uuid, text, text, text, numeric)
  to service_role;

commit;
