-- =============================================================================
-- Jalsa — a printer can print kitchen tickets, bills, or both (02-Oct-2026).
--
-- WHY
--   `printer.purpose` held ONE value, 'KOT' or 'Invoice'. A restaurant with a single physical
--   printer could therefore print either its kitchen tickets or its bills, never both: routing
--   filtered on the exact purpose, so the other kind of job was written as "failed, no machine".
--
-- WHAT
--   `roles`          the kinds of ticket this machine prints. {KOT}, {Invoice} or {KOT,Invoice}.
--                    An array rather than a third enum value, so a future kind of ticket is a
--                    new allowed element, not another redesign.
--   `default_roles`  the kinds this machine is the owner's CHOSEN default for. At most one
--                    machine per restaurant per kind (the two partial unique indexes). Empty for
--                    every existing machine, which keeps today's automatic choice exactly as it
--                    was until the owner picks one.
--
-- BACKWARD COMPATIBILITY
--   `purpose` stays, and a trigger keeps the two in step in both directions, so code deployed
--   before this migration and code deployed after it can share the table during a release:
--     - a writer that sets only `purpose` (older code) gets `roles = {purpose}`;
--     - a writer that sets `roles` gets `purpose` derived from them ('KOT' when it prints
--       kitchen tickets, otherwise 'Invoice'), so every older reader still sees a sane value.
--   Existing rows are backfilled from `purpose`; nothing is deleted.
--
-- RLS: unchanged. `printer` has row-level security on and no permissive policy (rule 3); only
-- this application's server, holding the secret key, reads or writes it.
-- =============================================================================

begin;

alter table public.printer
  add column if not exists roles         text[],
  add column if not exists default_roles text[] not null default '{}';

-- Backfill: every existing machine keeps exactly the one kind it printed before.
update public.printer
   set roles = array[case when purpose = 'Invoice' then 'Invoice' else 'KOT' end]
 where roles is null or cardinality(roles) = 0;

alter table public.printer alter column roles set default '{KOT}';
alter table public.printer alter column roles set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'printer_roles_known') then
    alter table public.printer
      add constraint printer_roles_known
      check (cardinality(roles) >= 1 and roles <@ array['KOT', 'Invoice']::text[]);
  end if;
  -- A machine can only be the default for something it actually prints.
  if not exists (select 1 from pg_constraint where conname = 'printer_default_roles_held') then
    alter table public.printer
      add constraint printer_default_roles_held check (default_roles <@ roles);
  end if;
end $$;

-- One default kitchen printer and one default bill printer per restaurant. The SAME machine may
-- be both - these are two indexes, not one.
create unique index if not exists printer_one_default_kot
  on public.printer (restaurant_id) where 'KOT' = any (default_roles);
create unique index if not exists printer_one_default_invoice
  on public.printer (restaurant_id) where 'Invoice' = any (default_roles);

-- Routing reads "every machine that prints X" on every round placed.
create index if not exists printer_roles_idx on public.printer using gin (roles);

create or replace function public.printer_sync_roles()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- An insert that named a purpose but no roles is older code: honour the purpose.
    if new.roles is null or cardinality(new.roles) = 0
       or (new.roles = array['KOT']::text[] and new.purpose = 'Invoice') then
      new.roles := array[case when new.purpose = 'Invoice' then 'Invoice' else 'KOT' end];
    end if;
  elsif new.purpose is distinct from old.purpose and new.roles is not distinct from old.roles then
    -- An update that changed only the purpose is older code switching the machine's kind.
    new.roles := array[case when new.purpose = 'Invoice' then 'Invoice' else 'KOT' end];
    new.default_roles := array(select r from unnest(new.default_roles) r where r = any (new.roles));
  end if;
  new.purpose := case when 'KOT' = any (new.roles) then 'KOT' else 'Invoice' end;
  return new;
end;
$$;

drop trigger if exists printer_sync_roles on public.printer;
create trigger printer_sync_roles
  before insert or update on public.printer
  for each row execute function public.printer_sync_roles();

commit;
