-- =============================================================================
-- Jalsa — takeaway orders, which have no table, and their packaging charge (02-Oct-2026).
--
-- WHY
--   Every order needed a `dining_table`: `ensureOpenBill(tableId)` always made a `bill_table`
--   row, and `kot.table_id` was NOT NULL. A parcel at the counter had nowhere to live except a
--   table it never sat at. A dummy table would put a fake table on the floor, on the KOT and in
--   every report, so this is an explicit ORDER TYPE instead.
--
-- WHAT
--   bill.order_type          'dine_in' (every existing bill, by default) or 'takeaway'.
--   bill.packaging_charge    rupees, typed by a person for THIS order, >= 0. No default rate, no
--                            global amount: every takeaway carries its own. Stored, never
--                            re-derived, like every other money component on the bill (Standard
--                            7.2). Zero on every existing bill, so no total changes.
--                            NOT TAXABLE, by the owner's decision of 02-Oct-2026: GST is charged
--                            on the food only, so there is no column for a packaging tax
--                            treatment - there is nothing to decide per bill.
--   kot.table_id             nullable - but ONLY for a round on a takeaway bill (trigger).
--
-- RULES, ENFORCED HERE RATHER THAN TRUSTED
--   - A takeaway bill has no host table and never joins `bill_table` (no fake table, ever).
--   - A dine-in round still names its table: only a takeaway round may leave it empty.
--   - The order type never changes once set: a bill does not turn into a parcel half-way.
--
-- Existing data: every existing bill becomes 'dine_in' with a zero packaging charge; every
-- existing KOT keeps its table. Nothing is deleted. RLS unchanged (no permissive policy).
-- =============================================================================

begin;

alter table public.bill
  add column if not exists order_type        text          not null default 'dine_in',
  add column if not exists packaging_charge  numeric(12, 2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bill_order_type_known') then
    alter table public.bill
      add constraint bill_order_type_known check (order_type in ('dine_in', 'takeaway'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_packaging_non_negative') then
    alter table public.bill
      add constraint bill_packaging_non_negative check (packaging_charge >= 0);
  end if;
  -- No fake table: a takeaway bill is hosted by nothing.
  if not exists (select 1 from pg_constraint where conname = 'bill_takeaway_has_no_table') then
    alter table public.bill
      add constraint bill_takeaway_has_no_table check (order_type <> 'takeaway' or host_table_id is null);
  end if;
end $$;

-- Live Orders and the Dashboard read the open takeaways on every poll.
create index if not exists bill_open_takeaway_idx
  on public.bill (restaurant_id, opened_at)
  where order_type = 'takeaway' and status in ('open', 'payment_requested');

-- Reports group by order type over a date range of closed bills.
create index if not exists bill_closed_order_type_idx
  on public.bill (restaurant_id, order_type, closed_at)
  where status = 'closed';

-- ── The order type is fixed once the bill exists ────────────────────────────
create or replace function public.bill_order_type_fixed()
returns trigger
language plpgsql
as $$
begin
  if new.order_type is distinct from old.order_type then
    raise exception 'A bill''s order type cannot change (% to %)', old.order_type, new.order_type
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists bill_order_type_fixed on public.bill;
create trigger bill_order_type_fixed
  before update of order_type on public.bill
  for each row execute function public.bill_order_type_fixed();

-- ── A takeaway bill never sits at a table ───────────────────────────────────
create or replace function public.bill_table_not_takeaway()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.bill where id = new.bill_id and order_type = 'takeaway') then
    raise exception 'A takeaway order is not at a table'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists bill_table_not_takeaway on public.bill_table;
create trigger bill_table_not_takeaway
  before insert or update of bill_id on public.bill_table
  for each row execute function public.bill_table_not_takeaway();

-- ── Only a takeaway round may have no table ─────────────────────────────────
alter table public.kot alter column table_id drop not null;

create or replace function public.kot_table_matches_order_type()
returns trigger
language plpgsql
as $$
declare
  kind text;
begin
  select order_type into kind from public.bill where id = new.bill_id;
  if new.table_id is null and coalesce(kind, 'dine_in') <> 'takeaway' then
    raise exception 'A dine-in round must name its table'
      using errcode = 'not_null_violation';
  end if;
  if new.table_id is not null and kind = 'takeaway' then
    raise exception 'A takeaway round is not at a table'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists kot_table_matches_order_type on public.kot;
create trigger kot_table_matches_order_type
  before insert or update of table_id, bill_id on public.kot
  for each row execute function public.kot_table_matches_order_type();

commit;
