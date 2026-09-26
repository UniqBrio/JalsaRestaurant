-- ============================================================================================
-- Change versions — what a polling screen asks instead of re-reading everything.
--
-- WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 4)
--   Every open screen re-read its whole world on a timer: a guest phone 10–12 database calls
--   every 6 s, a captain's phone 12, the owner's console 29 every 8 s — whether or not anything
--   had changed. At 40 open tables that is ~80 calls a second spent confirming nothing happened.
--   A screen now asks one cheap question — "has my version moved?" — and re-reads only when it has.
--
-- THREE COUNTERS, CHOSEN BY WHO LOOKS
--   change_version 'floor'   — anything a captain or the owner sees. Their screens show the whole
--                              restaurant, so any change anywhere is theirs to see.
--   change_version 'catalog' — the menu, the settings, the tables, the restaurant: what EVERY guest
--                              screen shows regardless of table.
--   bill.version             — one bill's own story: its rounds, items, tip, tables, print state.
--                              A guest phone watches only its table's bill, so a round placed at
--                              A7 does not make the phone at A5 re-read anything.
--
-- WHAT DELIBERATELY BUMPS NOTHING
--   bridge_token heartbeats (last_seen_at / last_sync_at) and bridge_discovered_printer (rewritten
--   on every bridge sync) change every few seconds on their own; counting them would make "has
--   anything changed?" answer yes forever. guest_session.last_seen_at is a liveness stamp nobody
--   reads. The screens that show printer health catch up on their periodic full read.
--
-- ONE RESTAURANT
--   The counters are global, not per restaurant: this deployment serves one (CLAUDE.md). When a
--   second outlet arrives, key change_version by restaurant_id — the triggers already run once per
--   statement, so the change is to the function, not to its twenty call sites.
--
-- RLS: enabled with no policy, like every table here (guardrail 3). Only the server reads it.
-- ============================================================================================

create table if not exists public.change_version (
  scope text primary key check (scope in ('floor', 'catalog')),
  version bigint not null default 0
);
alter table public.change_version enable row level security;
insert into public.change_version (scope) values ('floor'), ('catalog') on conflict (scope) do nothing;

alter table public.bill add column if not exists version bigint not null default 0;

-- ── the scope counters ────────────────────────────────────────────────────────────────────────

create or replace function public.bump_change_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.change_version set version = version + 1 where scope = any (tg_argv);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  -- Everything a captain or the owner sees.
  foreach t in array array[
    'bill', 'bill_table', 'kot', 'kot_item', 'tip', 'print_job', 'table_request', 'staff',
    'staff_permission', 'staff_table', 'suggestion', 'expense', 'printer', 'bridge_printer',
    'bridge_pairing_code', 'waitlist_entry', 'guest_cart_line', 'audit_entry'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bump_floor', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each statement execute function public.bump_change_version(%L)',
      t || '_bump_floor', t, 'floor');
  end loop;

  -- What every guest screen shows, and the staff screens too.
  foreach t in array array['menu_item', 'menu_category', 'setting', 'dining_table', 'restaurant'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bump_catalog', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each statement execute function public.bump_change_version(%L, %L)',
      t || '_bump_catalog', t, 'floor', 'catalog');
  end loop;
end;
$$;

-- A session appearing, leaving, moving or joining a bill is floor news; its liveness stamp is not.
drop trigger if exists guest_session_bump_floor on public.guest_session;
create trigger guest_session_bump_floor
  after insert or delete or update of table_id, bill_id, heard_about on public.guest_session
  for each statement execute function public.bump_change_version('floor');

-- A print computer being named, revoked or re-paired is floor news; its heartbeat is not.
drop trigger if exists bridge_token_bump_floor on public.bridge_token;
create trigger bridge_token_bump_floor
  after insert or delete or update of label, revoked_at, source, hostname, bridge_version on public.bridge_token
  for each statement execute function public.bump_change_version('floor');

-- ── the bill's own version ───────────────────────────────────────────────────────────────────

-- Any change to the bill row itself moves it.
create or replace function public.bill_version_self()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists bill_version_self on public.bill;
create trigger bill_version_self before update on public.bill
  for each row execute function public.bill_version_self();

-- A change to anything that belongs to a bill moves that bill (the self trigger does the + 1).
create or replace function public.bill_version_from_child()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target uuid;
begin
  if tg_table_name = 'kot_item' then
    select k.bill_id into target from public.kot k where k.id = coalesce(new.kot_id, old.kot_id);
  else
    target := coalesce(new.bill_id, old.bill_id);
  end if;
  if target is not null then
    update public.bill set version = version where id = target;
  end if;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['bill_table', 'kot', 'kot_item', 'tip', 'print_job', 'suggestion'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bill_version', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.bill_version_from_child()',
      t || '_bill_version', t);
  end loop;
end;
$$;
