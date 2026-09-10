-- =============================================================================
-- 20260910070000_jalsa_core_schema
--
-- The operational spine of the Jalsa QR-first dine-in platform, as the approved design set
-- describes it. Two model rules from the design shape everything below, and neither is
-- negotiable in code:
--
--   1. A BILL BELONGS TO ONE OR MORE TABLES. An ordinary table is a group of one. There is
--      therefore no bill.table_id column anywhere - membership lives in bill_table, and the
--      single-table case is a bill_table with one row. Special-casing the single table is
--      exactly the retrofit the design set warned about (Reusable Design Standard 8.1).
--
--   2. THE GUEST NEVER MARKS A BILL PAID. They raise a payment_request; a named member of
--      staff records the closure. bill.closed_by_staff_id is NOT NULL for every closed bill,
--      enforced by a check constraint rather than by convention.
--
-- Multi-outlet is a roadmap item, not this slice - but restaurant_id is present from the
-- first migration for the same reason bill_table is: adding an isolation column later means
-- touching every query, every index and every policy.
--
-- ROW-LEVEL SECURITY POSTURE (binding, and stated once here)
--   Every table below is RLS-enabled with NO permissive policy for anon or authenticated.
--   The browser never talks to PostgREST directly. All reads and writes go through Next.js
--   route handlers that hold the secret key and enforce the permission matrix in one place.
--   Deny-by-default plus a single trusted caller is the posture; a table that later needs
--   direct browser access gets an explicit, reviewed policy in its own migration.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations. These are the PLAIN-LANGUAGE status vocabulary from the design set, stored
-- as the words staff actually read (Reusable Design Standard 7.1) - not internal codes that
-- every surface then has to translate.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.food_type as enum ('veg', 'non_veg', 'egg');
exception when duplicate_object then null; end $$;

do $$ begin
  -- The five words a round moves through, in order. 'new' is a ticket that exists but has
  -- not reached a printer yet - it is a real state precisely because the printer is an
  -- unvalidated dependency.
  create type public.kot_status as enum ('new', 'preparing', 'ready', 'picked_up', 'served', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kot_source as enum ('guest', 'captain', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bill_status as enum ('open', 'payment_requested', 'closed', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.print_status as enum ('queued', 'printed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Identity and configuration. Standard 2.2: logo, legal name, address, contact and
-- signatory live in ONE block and every screen and document reads from it.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  legal_name        text not null,
  display_name      text not null,
  address           text not null default '',
  email             text not null default '',
  phone             text not null default '',
  location_line     text not null default '',
  hr_email          text not null default '',
  signatory_name    text not null default '',
  signatory_role    text not null default '',
  fssai             text not null default '',
  pan               text not null default '',
  cin               text not null default '',
  logo_url          text not null default '/brand/jalsa-badge.png',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Settings are a keyed document rather than 40 columns: the design's Settings tab has ten
-- sub-sections that grow, and every one of them is "a value an administrator edits", never
-- a schema change. Standard 2.3.
create table if not exists public.setting (
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  key            text not null check (length(btrim(key)) between 1 and 80),
  value          jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  updated_by     text not null default 'system',
  primary key (restaurant_id, key)
);

-- ---------------------------------------------------------------------------
-- Floor
-- ---------------------------------------------------------------------------
create table if not exists public.dining_table (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  name           text not null check (length(btrim(name)) between 1 and 16),
  zone           text not null default 'AC',
  seats          smallint not null default 4 check (seats between 1 and 40),
  active         boolean not null default true,
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);

-- Renaming a table must keep its QR working, so the QR resolves on this unique key and the
-- key is the id, never the name. The name is still unique so two tables cannot be called A5.
create unique index if not exists dining_table_name_unique
  on public.dining_table (restaurant_id, upper(btrim(name)));
create index if not exists dining_table_restaurant_idx on public.dining_table (restaurant_id);

-- ---------------------------------------------------------------------------
-- People, roles and the permission matrix. Standard 9.1: a role is a PRESET, and every
-- individual permission is overridable per person.
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurant(id) on delete cascade,
  name              text not null check (length(btrim(name)) between 1 and 120),
  role              text not null default 'Waiter',
  initials          text not null default '',
  mobile            text not null default '',
  email             text not null default '',
  active            boolean not null default true,
  on_duty           boolean not null default true,

  -- Employment record - the source the HR documents merge from (design: Jalsa HR Documents).
  designation       text not null default '',
  department        text not null default '',
  employee_code     text not null default '',
  joined_on         date,
  last_working_day  date,
  monthly_salary    numeric(12, 2),
  gender            text not null default '',
  employment_type   text not null default '',
  home_address      text not null default '',

  -- A PIN is a credential, so only its hash is stored. Standard 9.2 puts issuance inside the
  -- create flow; pin_set_at is what lets the UI say "never signed in" honestly.
  pin_hash          text,
  pin_set_at        timestamptz,
  removed_at        timestamptz,
  removed_reason    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists staff_restaurant_idx on public.staff (restaurant_id) where removed_at is null;

-- Standing table assignment. The live assignment is DERIVED from open bills (the design says
-- so explicitly); this is the fallback shown when a person has no open bill.
create table if not exists public.staff_table (
  staff_id  uuid not null references public.staff(id) on delete cascade,
  table_id  uuid not null references public.dining_table(id) on delete cascade,
  primary key (staff_id, table_id)
);

create table if not exists public.staff_permission (
  staff_id    uuid not null references public.staff(id) on delete cascade,
  perm_key    text not null check (length(btrim(perm_key)) between 1 and 60),
  granted     boolean not null default true,
  granted_at  timestamptz not null default now(),
  granted_by  text not null default 'system',
  primary key (staff_id, perm_key)
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table if not exists public.menu_category (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  name           text not null check (length(btrim(name)) between 1 and 60),
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);
create unique index if not exists menu_category_name_unique
  on public.menu_category (restaurant_id, lower(btrim(name)));

create table if not exists public.menu_item (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurant(id) on delete cascade,
  category_id     uuid not null references public.menu_category(id) on delete restrict,
  name            text not null check (length(btrim(name)) between 1 and 120),
  description     text not null default '',
  price           numeric(10, 2) not null check (price >= 0),
  food_type       public.food_type not null default 'veg',
  image_url       text not null default '',
  sort            integer not null default 0,

  -- Availability is two separate ideas and the design treats them separately: `available` is
  -- the switch a captain flips mid-service and it is instant; closed_until is the dated stop
  -- ("raw material off for three days") that expires by itself.
  available       boolean not null default true,
  closed_reason   text not null default '',
  closed_until    timestamptz,

  -- Serving windows. Empty means all day; the design's item editor writes into this.
  serves_from     time,
  serves_to       time,
  serves_days     smallint[] not null default '{0,1,2,3,4,5,6}'::smallint[],

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists menu_item_name_unique
  on public.menu_item (restaurant_id, lower(btrim(name)));
create index if not exists menu_item_category_idx on public.menu_item (category_id);

-- ---------------------------------------------------------------------------
-- Bills, groups and rounds
-- ---------------------------------------------------------------------------
create table if not exists public.bill (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references public.restaurant(id) on delete cascade,
  code                 text not null,
  group_code           text,                   -- 'G-07' once a bill spans more than one table
  host_table_id        uuid references public.dining_table(id) on delete set null,
  status               public.bill_status not null default 'open',
  guests               smallint not null default 2 check (guests between 1 and 200),

  captain_staff_id     uuid references public.staff(id) on delete set null,
  waiter_staff_id      uuid references public.staff(id) on delete set null,

  occasion_type        text not null default '',
  occasion_name        text not null default '',
  occasion_source      text not null default '',

  -- Money. Every component is stored, never re-derived from a total, because the totals block
  -- has to itemise identically on screen, on the printed bill and in the report (Standard 7.2).
  discount_pct         numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  discount_amount      numeric(12, 2) not null default 0 check (discount_amount >= 0),
  discount_by_staff_id uuid references public.staff(id) on delete set null,
  discount_at          timestamptz,
  tax_rate             numeric(5, 2) not null default 5 check (tax_rate between 0 and 100),

  payment_requested_at timestamptz,
  payment_mode         text,
  payment_reference    text not null default '',
  closed_at            timestamptz,
  closed_by_staff_id   uuid references public.staff(id) on delete set null,

  opened_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Rule 2, enforced rather than trusted: a closed bill names the person who closed it and
  -- the mode it was paid by. There is no code path that can produce a closure without them.
  constraint bill_closure_is_attributed check (
    status <> 'closed'
    or (closed_at is not null and closed_by_staff_id is not null and payment_mode is not null)
  )
);
create unique index if not exists bill_code_unique on public.bill (restaurant_id, code);
create index if not exists bill_open_idx on public.bill (restaurant_id, status) where status <> 'closed';

-- Rule 1. Membership, not a column on bill.
create table if not exists public.bill_table (
  bill_id   uuid not null references public.bill(id) on delete cascade,
  table_id  uuid not null references public.dining_table(id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- Denormalised from bill.status by the trigger below, and it exists for exactly one
  -- reason: an index predicate cannot contain a subquery, so the "one open bill per table"
  -- rule could not otherwise be a database constraint at all. Maintaining it in application
  -- code instead would move the rule to the one place two concurrent requests can both pass.
  released_at timestamptz,
  primary key (bill_id, table_id)
);
create index if not exists bill_table_table_idx on public.bill_table (table_id);

-- One table can carry at most one bill that is not closed. This is what makes "scan a table
-- that already has an open bill" resolvable instead of ambiguous, and it is a database rule
-- because two phones can scan in the same millisecond (Standard 8.3).
create unique index if not exists bill_table_one_open_per_table
  on public.bill_table (table_id)
  where released_at is null;

-- Closing a bill frees every one of its tables at once - all four of a group of four - and
-- it happens in the same transaction as the closure, so there is no window in which a table
-- is both closed and still occupied.
create or replace function public.release_tables_on_close()
returns trigger language plpgsql as $$
begin
  if new.status = 'closed' and coalesce(old.status, 'open') <> 'closed' then
    update public.bill_table
       set released_at = coalesce(new.closed_at, now())
     where bill_id = new.id and released_at is null;
  elsif new.status <> 'closed' and old.status = 'closed' then
    update public.bill_table set released_at = null where bill_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists bill_release_tables on public.bill;
create trigger bill_release_tables
  after update of status on public.bill
  for each row execute function public.release_tables_on_close();

create table if not exists public.kot (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurant(id) on delete cascade,
  bill_id          uuid not null references public.bill(id) on delete cascade,
  -- Which table the round came from. On a group bill the kitchen and the runner need this to
  -- know where the food goes; on a single-table bill it equals the bill's only table.
  table_id         uuid not null references public.dining_table(id) on delete restrict,
  code             text not null,
  status           public.kot_status not null default 'new',

  -- Standard 6.4: origin is recorded because it cannot be reconstructed later, and it is what
  -- makes "how much did the QR actually get used" answerable at all.
  source           public.kot_source not null,
  placed_by_staff_id uuid references public.staff(id) on delete set null,
  placed_by_label  text not null default 'Guest phone',

  note             text not null default '',

  print_status     public.print_status not null default 'queued',
  print_attempts   smallint not null default 0,
  printed_at       timestamptz,
  reprint_count    smallint not null default 0,

  started_at       timestamptz,
  ready_at         timestamptz,
  picked_up_at     timestamptz,
  served_at        timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text not null default '',

  created_at       timestamptz not null default now()
);
create unique index if not exists kot_code_unique on public.kot (restaurant_id, code);
create index if not exists kot_bill_idx on public.kot (bill_id);
create index if not exists kot_live_idx on public.kot (restaurant_id, status)
  where status in ('new', 'preparing', 'ready', 'picked_up');

create table if not exists public.kot_item (
  id              uuid primary key default gen_random_uuid(),
  kot_id          uuid not null references public.kot(id) on delete cascade,
  menu_item_id    uuid references public.menu_item(id) on delete set null,

  -- Snapshots, not joins. A bill printed last Tuesday must still say what it said, at the
  -- price it charged, even after the item is renamed, repriced or deleted.
  name            text not null,
  unit_price      numeric(10, 2) not null check (unit_price >= 0),
  food_type       public.food_type not null,

  qty             smallint not null check (qty > 0),
  qty_before      smallint,
  changed_at      timestamptz,
  changed_by_staff_id uuid references public.staff(id) on delete set null,

  cancelled_at    timestamptz,
  cancel_reason   text not null default '',
  cancelled_by_staff_id uuid references public.staff(id) on delete set null,

  created_at      timestamptz not null default now()
);
create index if not exists kot_item_kot_idx on public.kot_item (kot_id);

-- ---------------------------------------------------------------------------
-- Tips. Standard 7.3: money collected on someone else's behalf sits in its own ledger and
-- stays out of revenue, while still appearing in what the payer owes. A tip is therefore a
-- ROW HERE, never a column on bill.
-- ---------------------------------------------------------------------------
create table if not exists public.tip (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurant(id) on delete cascade,
  bill_id         uuid not null references public.bill(id) on delete cascade,
  amount          numeric(10, 2) not null check (amount > 0),
  staff_id        uuid references public.staff(id) on delete set null,
  settled_at      timestamptz,
  settled_by      text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists tip_bill_idx on public.tip (bill_id);
create index if not exists tip_staff_idx on public.tip (staff_id) where settled_at is null;

-- ---------------------------------------------------------------------------
-- Table requests - water, plates, call the captain. Standard 8.2: they arrive ten at once,
-- so they are grouped by type with a count, and marking one done clears it everywhere.
-- ---------------------------------------------------------------------------
create table if not exists public.table_request (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurant(id) on delete cascade,
  table_id        uuid not null references public.dining_table(id) on delete cascade,
  bill_id         uuid references public.bill(id) on delete set null,
  kind            text not null,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  done_at         timestamptz,
  done_by_staff_id uuid references public.staff(id) on delete set null
);
create index if not exists table_request_open_idx on public.table_request (restaurant_id) where done_at is null;

create table if not exists public.suggestion (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurant(id) on delete cascade,
  table_id        uuid references public.dining_table(id) on delete set null,
  bill_id         uuid references public.bill(id) on delete set null,
  body            text not null check (length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now(),
  reply           text not null default '',
  replied_at      timestamptz,
  replied_by      text not null default ''
);

-- ---------------------------------------------------------------------------
-- Guest sessions. Standard 6.5: the session is anchored to the TABLE, and its state is
-- resolved server-side from that durable key - never from what the phone happened to keep.
-- Closing the browser therefore loses nothing, and a second phone at the same table joins
-- the same bill rather than starting a rival one.
-- ---------------------------------------------------------------------------
create table if not exists public.guest_session (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurant(id) on delete cascade,
  token         text not null unique,
  table_id      uuid not null references public.dining_table(id) on delete cascade,
  bill_id       uuid references public.bill(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists guest_session_table_idx on public.guest_session (table_id);

-- Cart drafts persist server-side for the same reason: a guest who loses signal mid-order
-- must not lose the order they were building.
create table if not exists public.guest_cart_line (
  session_id   uuid not null references public.guest_session(id) on delete cascade,
  menu_item_id uuid not null references public.menu_item(id) on delete cascade,
  qty          smallint not null check (qty > 0),
  updated_at   timestamptz not null default now(),
  primary key (session_id, menu_item_id)
);

-- ---------------------------------------------------------------------------
-- Expenses. Manual entry only - the design says nothing here is inferred, and the report is
-- only as complete as the day's entries.
-- ---------------------------------------------------------------------------
create table if not exists public.expense (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  spent_on       date not null default current_date,
  category       text not null,
  note           text not null default '',
  amount         numeric(12, 2) not null check (amount > 0),
  entered_by     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  change_reason  text not null default ''
);
create index if not exists expense_date_idx on public.expense (restaurant_id, spent_on) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Printing. Standard 5.7: persist first, then attempt. The order exists whether or not the
-- printer answered, and the failure is a row someone can see and retry - not a lost log line.
-- ---------------------------------------------------------------------------
create table if not exists public.printer (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  machine_id     text not null,
  name           text not null,
  purpose        text not null default 'KOT',
  paper_mm       smallint not null default 80 check (paper_mm in (58, 80)),
  routes         text[] not null default '{}',
  chefs          text[] not null default '{}',
  online         boolean not null default false,
  created_at     timestamptz not null default now()
);
create unique index if not exists printer_machine_unique on public.printer (restaurant_id, machine_id);

create table if not exists public.print_job (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  printer_id     uuid references public.printer(id) on delete set null,
  kind           text not null default 'KOT',
  kot_id         uuid references public.kot(id) on delete cascade,
  bill_id        uuid references public.bill(id) on delete cascade,
  status         public.print_status not null default 'queued',
  attempts       smallint not null default 0,
  is_reprint     boolean not null default false,
  requested_by   text not null default 'system',
  last_error     text not null default '',
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists print_job_open_idx on public.print_job (restaurant_id, status);

-- ---------------------------------------------------------------------------
-- Audit. Standard 6.1: what changed, when - date AND time - who did it, and which record.
-- Append-only by design: there is no update or delete path in the application for this table.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_entry (
  id             bigserial primary key,
  restaurant_id  uuid not null references public.restaurant(id) on delete cascade,
  at             timestamptz not null default now(),
  action         text not null,
  detail         text not null default '',
  bill_id        uuid references public.bill(id) on delete set null,
  table_id       uuid references public.dining_table(id) on delete set null,
  actor_staff_id uuid references public.staff(id) on delete set null,
  actor_label    text not null,
  confidential   boolean not null default false
);
create index if not exists audit_entry_at_idx on public.audit_entry (restaurant_id, at desc);
create index if not exists audit_entry_action_idx on public.audit_entry (restaurant_id, action);

-- ---------------------------------------------------------------------------
-- Sequence helpers. Bill and KOT numbers are allocated in the database, not in the
-- application, because two captains pressing Send in the same second must not be able to
-- produce one KOT number twice.
-- ---------------------------------------------------------------------------
create table if not exists public.number_series (
  restaurant_id uuid not null references public.restaurant(id) on delete cascade,
  kind          text not null check (kind in ('bill', 'kot', 'group')),
  prefix        text not null,
  next_value    integer not null default 1 check (next_value > 0),
  primary key (restaurant_id, kind)
);

create or replace function public.next_number(p_restaurant uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_value  integer;
begin
  -- The UPDATE ... RETURNING takes a row lock, so concurrent callers serialise here rather
  -- than both reading the same next_value.
  update public.number_series
     set next_value = next_value + 1
   where restaurant_id = p_restaurant and kind = p_kind
  returning prefix, next_value - 1 into v_prefix, v_value;

  if v_prefix is null then
    raise exception 'No number series for kind %', p_kind;
  end if;

  return v_prefix || v_value::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at, applied uniformly. A hand-maintained updated_at is a column that is right
-- until the one write path that forgot it.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['restaurant', 'staff', 'menu_item', 'bill', 'expense'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: on everywhere, permissive nowhere. See the posture note at the top of this file.
-- Enabling RLS without adding a policy is what makes the deny explicit: PostgREST returns
-- empty for anon, and the secret-key server connection bypasses it by design.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'restaurant', 'setting', 'dining_table', 'staff', 'staff_table', 'staff_permission',
    'menu_category', 'menu_item', 'bill', 'bill_table', 'kot', 'kot_item', 'tip',
    'table_request', 'suggestion', 'guest_session', 'guest_cart_line', 'expense',
    'printer', 'print_job', 'audit_entry', 'number_series'
  ] loop
    -- ENABLE, deliberately not FORCE. Force would also subject the table owner to RLS, and
    -- the owner is what runs a migration - a seed insert would then fail against a table with
    -- no policies. The posture we want is: anon and authenticated get nothing at all; the
    -- server's secret-key connection (service_role, which carries BYPASSRLS) is the only
    -- caller. Enable achieves exactly that.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

commit;
