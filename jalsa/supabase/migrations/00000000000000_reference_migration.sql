-- =============================================================================
-- REFERENCE MIGRATION - the shape every schema change takes.
--
-- FILENAME  <UTC timestamp: YYYYMMDDHHMMSS>_<snake_case_description>.sql
--           Timestamps order deterministically across branches; sequence numbers collide.
--
-- THE SINGLE MIGRATION PIPE (binding)
--   EVERY backend change - table, column, index, constraint, trigger, function, policy,
--   even a "one-line" one - exists as a file in this folder. It is applied to the
--   non-production environment first, confirmed, then the IDENTICAL file is applied to
--   production. Direct edits to either environment are drift by definition.
--
--   "Minor" is not an exemption. In practice the most minor-looking edits cause the worst
--   drift, precisely because nobody writes them down.
--
-- THE MIGRATION LEDGER IS THE SYSTEM OF RECORD
--   An object that exists in BOTH databases but in NO migration file is a blocking finding,
--   not a curiosity: it cannot be recreated, reviewed, or rolled back. Backfill an idempotent
--   migration (CREATE ... IF NOT EXISTS) for it before building anything on top of it.
--
-- IDEMPOTENT BY DEFAULT
--   Every statement below is safe to run twice. A migration that fails on re-run turns a
--   partial deploy into a manual recovery at exactly the worst moment.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. TABLE
--    tenant_id is not optional and is not "added later". It is the isolation boundary, and
--    a table created without it will be joined, cached and indexed without it too.
-- ---------------------------------------------------------------------------
create table if not exists public.reference_item (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,

  name         text not null check (length(btrim(name)) between 1 and 200),
  status       text not null default 'active'
                 check (status in ('active', 'archived')),

  -- Timestamps are timestamptz. A naive timestamp silently means "whatever the server's
  -- timezone happened to be", which is a different value on a different host.
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 2. CONSTRAINTS THAT MAKE WRITES IDEMPOTENT
--    Name every business uniqueness rule here, then design each write against it with an
--    upsert or ON CONFLICT. A double-tap, a retry and a duplicated webhook are the SAME
--    event to your API - the database is the only place that can tell them apart reliably.
-- ---------------------------------------------------------------------------
create unique index if not exists reference_item_unique_name_per_tenant
  on public.reference_item (tenant_id, lower(btrim(name)))
  where status = 'active';

-- Every foreign key gets an index. Postgres does not create one, and its absence turns a
-- cascade delete and every join into a sequential scan.
create index if not exists reference_item_tenant_idx on public.reference_item (tenant_id);
create index if not exists reference_item_status_idx on public.reference_item (tenant_id, status);

-- ---------------------------------------------------------------------------
-- 3. updated_at MAINTAINED BY THE DATABASE
--    Application code forgets. A trigger does not, and it also covers writes that arrive
--    from a migration, an admin tool, or a second service.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists reference_item_touch on public.reference_item;
create trigger reference_item_touch
  before update on public.reference_item
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Enabled in the SAME migration that creates the table. A table that ships without RLS
--    and gains it "next sprint" is readable by every authenticated user in between.
--
--    Note the separate policies: a single FOR ALL policy makes it impossible to grant read
--    without also granting write, which is the permission you actually wanted to split.
-- ---------------------------------------------------------------------------
alter table public.reference_item enable row level security;

drop policy if exists reference_item_select on public.reference_item;
create policy reference_item_select on public.reference_item
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists reference_item_insert on public.reference_item;
create policy reference_item_insert on public.reference_item
  for insert with check (tenant_id = public.current_tenant_id());

drop policy if exists reference_item_update on public.reference_item;
create policy reference_item_update on public.reference_item
  for update using (tenant_id = public.current_tenant_id())
         with check (tenant_id = public.current_tenant_id());

-- Deletion is deliberately NOT granted here. Most applications want archival, and a delete
-- policy added by reflex is how the audit trail disappears.

commit;

-- =============================================================================
-- ROLLBACK (kept in the file, not a separate one that drifts out of sync)
--
--   begin;
--     drop policy if exists reference_item_select on public.reference_item;
--     drop policy if exists reference_item_insert on public.reference_item;
--     drop policy if exists reference_item_update on public.reference_item;
--     drop trigger if exists reference_item_touch on public.reference_item;
--     drop table if exists public.reference_item;
--   commit;
--
-- A migration whose rollback was never written is a migration that will be rolled back by
-- improvisation, under time pressure, by whoever is on call.
-- =============================================================================
