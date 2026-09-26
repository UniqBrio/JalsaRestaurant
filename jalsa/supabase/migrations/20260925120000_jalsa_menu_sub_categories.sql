-- =============================================================================
-- 20260925120000_jalsa_menu_sub_categories
--
-- (Written as 20260925090000; renumbered on merge, 26-Sep-2026, because `jalsa_kot_item_line_order`
-- took that version on main. Already applied to both projects as `jalsa_menu_sub_categories`;
-- every statement is idempotent, so a replay in either order converges.)
--
-- Sub-menus (24-Sep correction list, I3): "sales breakdown by category, including sub-menu".
--
-- WHAT THIS ADDS
--   1. `menu_category.parent_id` - a category may sit under ONE top-level category. Nullable:
--      every existing category stays top-level, and nothing about an existing menu changes until
--      the owner puts one category under another.
--   2. `kot_item.menu_parent_category_name` - the parent's name, snapshotted on the order line
--      beside `menu_category_name` (20260919090000). A report reads what the dish sold UNDER, so a
--      menu reorganised next month does not rewrite last month's breakdown.
--
-- ONE LEVEL, ENFORCED HERE
--   A menu with sub-sub-menus is not something a waiter can read off a phone, and a report that
--   rolls up an unbounded tree is a recursive query on every Reports load. So: a parent must be
--   top-level, in the same restaurant, and not the category itself; and a category that already
--   has sub-categories cannot itself be put under another. A trigger, because a CHECK cannot read
--   another row.
--
-- `on delete restrict`: a parent with sub-categories cannot be deleted out from under them.
--
-- SAFE FOR EXISTING DATA
--   Both columns are additive with defaults; no row is rewritten except the backfill of the
--   snapshot, which is a no-op today (no category has a parent yet) and exists so a replay onto a
--   database that already has parents reads the same way for old lines as new.
-- =============================================================================

begin;

alter table public.menu_category
  add column if not exists parent_id uuid references public.menu_category(id) on delete restrict;

create index if not exists menu_category_parent_idx on public.menu_category (parent_id) where parent_id is not null;

create or replace function public.menu_category_one_level()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A category cannot sit under itself.' using errcode = 'check_violation';
  end if;
  select id, restaurant_id, parent_id into parent from public.menu_category where id = new.parent_id;
  if not found or parent.restaurant_id <> new.restaurant_id then
    raise exception 'That category is not on this menu.' using errcode = 'check_violation';
  end if;
  if parent.parent_id is not null then
    raise exception 'A sub-menu cannot have its own sub-menus. Choose a top-level category.'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.menu_category c where c.parent_id = new.id) then
    raise exception 'This category has sub-menus of its own, so it cannot go under another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists menu_category_one_level on public.menu_category;
create trigger menu_category_one_level
  before insert or update of parent_id on public.menu_category
  for each row execute function public.menu_category_one_level();

alter table public.kot_item
  add column if not exists menu_parent_category_name text not null default '';

update public.kot_item ki
   set menu_parent_category_name = p.name
  from public.menu_item mi
  join public.menu_category c on c.id = mi.category_id
  join public.menu_category p on p.id = c.parent_id
 where mi.id = ki.menu_item_id
   and ki.menu_parent_category_name = '';

commit;
