-- =============================================================================
-- 20260928090000_jalsa_food_type_master
--
-- Food Type becomes a restaurant-defined list; KOT Classification stays what routes the ticket.
--
-- WHAT THE OWNER ASKED FOR (28-Sep-2026)
--   "Fish", "Dessert", "Juice", "Seafood" as Food Types of their own, each with a separate KOT
--   classification: Veg, Non-Veg, Egg, or Other (no KOT classification). Dessert and Juice are
--   Other; Fish and Seafood are Non-Veg. The name and the classification are separate fields,
--   and no future type is hard-coded in the application.
--
-- WHY THE EXISTING ENUM BECOMES THE CLASSIFICATION, NOT A SECOND MODEL
--   `menu_item.food_type` (enum veg/non_veg/egg) already decides everything the kitchen cares
--   about: which side of the veg/non-veg split a line prints on, the band it sits under on the
--   KOT, the diet filter on the guest's phone, and the snapshot on `kot_item`. Every one of those
--   readers keeps reading it. It gains a fourth value, 'other', and is from now on DERIVED from
--   the dish's Food Type by the trigger below, so it can never disagree with the list.
--
--   The list itself - the NAME a person picks and sees - is the new table `menu_food_type`.
--   (Not `food_type`: a table's row type would collide with the enum of that name.)
--
-- PRESERVING WHAT EXISTS
--   Every restaurant gets Veg, Non-veg and Egg rows carrying their own classification, and every
--   existing dish is pointed at the row matching its current enum value. Nothing about an
--   existing dish, ticket, filter or report changes. `kot_item` gains a snapshot of the type's
--   NAME, back-filled from the classification for rounds already placed.
--
-- A WRITER THAT DOES NOT KNOW ABOUT THE LIST STILL WORKS
--   The trigger fills `food_type_id` from `food_type` when a writer gives only the enum (the old
--   application during a deploy, the seed), so this migration can land before the code does.
-- =============================================================================

-- 1. The classification gains "Other / no KOT classification". Added outside the transaction
--    below: a new enum value may not be used in the transaction that adds it.
alter type public.food_type add value if not exists 'other';

begin;

-- 2. The restaurant's Food Type list.
create table if not exists public.menu_food_type (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 40),
  kot_class      public.food_type not null,
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);
create unique index if not exists menu_food_type_name_unique
  on public.menu_food_type (restaurant_id, lower(btrim(name)));
alter table public.menu_food_type enable row level security;   -- guardrail 3: no policy

comment on table public.menu_food_type is
  'Restaurant-defined Food Types (Veg, Fish, Dessert...). kot_class is the KOT Classification that routes the ticket.';

-- 3. The three every restaurant already uses, with the classification they always had.
insert into public.menu_food_type (restaurant_id, name, kot_class, sort)
select r.id, t.name, t.kot_class::public.food_type, t.sort
  from public.restaurant r
  cross join (values ('Veg', 'veg', 1), ('Non-veg', 'non_veg', 2), ('Egg', 'egg', 3)) as t(name, kot_class, sort)
on conflict do nothing;

-- 4. A dish points at its Food Type.
alter table public.menu_item
  add column if not exists food_type_id uuid references public.menu_food_type(id) on delete restrict;

update public.menu_item m
   set food_type_id = f.id
  from public.menu_food_type f
 where m.food_type_id is null
   and f.restaurant_id = m.restaurant_id
   and f.kot_class = m.food_type
   and f.sort between 1 and 3;

create index if not exists menu_item_food_type_idx on public.menu_item (food_type_id);

-- 5. The dish's classification is the Food Type's, always. Given only the enum (an older writer),
--    the dish is placed on the restaurant's first type of that classification.
create or replace function public.menu_item_food_type_sync()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cls public.food_type;
begin
  if new.food_type_id is not null then
    select f.kot_class into cls
      from public.menu_food_type f
     where f.id = new.food_type_id and f.restaurant_id = new.restaurant_id;
    if cls is null then
      raise exception 'That food type belongs to another restaurant or no longer exists.';
    end if;
    new.food_type := cls;
  else
    select f.id into new.food_type_id
      from public.menu_food_type f
     where f.restaurant_id = new.restaurant_id and f.kot_class = new.food_type
     order by f.sort, f.created_at
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_item_food_type_sync on public.menu_item;
create trigger menu_item_food_type_sync
  before insert or update of food_type, food_type_id on public.menu_item
  for each row execute function public.menu_item_food_type_sync();

-- 6. Re-classifying a Food Type re-classifies its dishes. Tickets already placed keep their
--    snapshot: a change tonight must not rewrite what the kitchen was told yesterday.
create or replace function public.menu_food_type_reclassify()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kot_class is distinct from old.kot_class then
    update public.menu_item set food_type = new.kot_class where food_type_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_food_type_reclassify on public.menu_food_type;
create trigger menu_food_type_reclassify
  after update of kot_class on public.menu_food_type
  for each row execute function public.menu_food_type_reclassify();

-- 7. What a round sold, by Food Type NAME, for reports - snapshotted like the category name.
alter table public.kot_item
  add column if not exists food_type_name text not null default '';

update public.kot_item
   set food_type_name = case food_type::text when 'veg' then 'Veg' when 'non_veg' then 'Non-veg' when 'egg' then 'Egg' else 'Other' end
 where food_type_name = '';

-- 8. A new or renamed type reaches every guest and staff screen, like a category does.
drop trigger if exists menu_food_type_bump_catalog on public.menu_food_type;
create trigger menu_food_type_bump_catalog
  after insert or update or delete on public.menu_food_type
  for each statement execute function public.bump_change_version('floor', 'catalog');

commit;
