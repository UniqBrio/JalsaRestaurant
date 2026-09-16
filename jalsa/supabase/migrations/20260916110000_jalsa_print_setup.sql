-- =============================================================================
-- 20260916110000_jalsa_print_setup
--
-- The columns the five-section Print Setup surface needs, and the routing it edits.
--
-- WHAT THE PRINTER TABLE COULD NOT ANSWER
--   `Jalsa Navigation Flowchart.dc.html`, section six: *"Routing runs category → station →
--   printer"*, and the Print-failed handoff row: *"station tickets fall back to the main kitchen
--   printer rather than vanishing."* Both sentences turn on a fact the table did not hold —
--   WHICH STATION a machine is. `printer` knew its name, its paper width and a list of route
--   labels, so a fallback ticket could be printed but could not be stamped, and a ticket meant
--   for the tandoor came out of the main kitchen machine looking like every other ticket.
--
--   `Jalsa Print Setup.dc.html` also configures a machine's connection — Ethernet, Wi-Fi or USB,
--   with an address and a port — and its enabled state. None of those were columns either, so
--   the "Check connection" the design draws had nothing to check.
--
-- WHY `enabled` IS SEPARATE FROM `online`
--   They are different facts and the screen says different words for them. `online` is whether
--   the machine answered: a fault, and the fallback exists for it. `enabled` is whether the owner
--   wants it used at all: a decision, made when a machine is taken away for repair. Collapsing
--   them into one boolean would make "switched off" and "not answering" the same alert, and one
--   of those needs somebody to walk into the kitchen.
--
-- WHY THE ROUTE LIST IS RE-SEEDED FROM THE MENU'S OWN CATEGORIES
--   `routes` was seeded with food-type labels — 'Veg', 'Non-veg', 'Invoice' — which is a
--   different axis from the one the design routes on. The flowchart is explicit that the
--   food-type split is A SEPARATE DECISION from routing, so leaving food types in the routing
--   column would have made the two controls edit the same array and disagree. The rows below
--   move each machine onto real menu category names, and the food-type split becomes a switch in
--   the `print` setting where the design puts it.
--
--   Categories are matched by name, not by id, and `resolvePrinter` compares them case- and
--   space-insensitively. A uuid would be tighter, but the routing screen is a list of category
--   NAMES the owner reads, and a renamed category that silently stops reaching the tandoor is a
--   worse failure than a re-pointed one.
--
-- NOTHING HERE TOUCHES A BILL, A KOT OR A PRINT JOB'S HISTORY. Print jobs are already written
-- and already carry their failures; this migration only describes the machines.
-- =============================================================================

begin;

alter table public.printer
  add column if not exists station     text    not null default 'Main Kitchen',
  add column if not exists connection  text    not null default 'Ethernet',
  add column if not exists address     text    not null default '',
  add column if not exists port        integer not null default 9100,
  add column if not exists enabled     boolean not null default true,
  add column if not exists last_seen_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'printer_connection_check') then
    alter table public.printer
      add constraint printer_connection_check check (connection in ('Ethernet', 'Wi-Fi', 'USB'));
  end if;
  -- A network machine without an address is a machine nobody can reach, and the screen's
  -- "Check connection" would have nothing to check. USB has no address by definition.
  if not exists (select 1 from pg_constraint where conname = 'printer_address_when_networked') then
    alter table public.printer
      add constraint printer_address_when_networked
      check (connection = 'USB' or btrim(address) <> '' or online = false);
  end if;
end $$;

-- The print-history screen reads tonight's jobs newest first. Without this it is a sequential
-- scan of every job the restaurant has ever printed, on a screen somebody opens mid-service.
create index if not exists print_job_recent_idx
  on public.print_job (restaurant_id, created_at desc);

do $$
declare
  r uuid;
begin
  select id into r from public.restaurant order by created_at limit 1;
  if r is null then return; end if;

  -- The stations, from the design's own three machines: main kitchen and counter at 80 mm,
  -- tandoor across the kitchen at 58 mm.
  update public.printer set station = 'Main Kitchen' where restaurant_id = r and machine_id in ('KOT-VEG-01', 'KOT-NV-01');
  update public.printer set station = 'Tandoor'      where restaurant_id = r and machine_id = 'KOT-TAN-01';
  update public.printer set station = 'Billing'      where restaurant_id = r and machine_id = 'BILL-01';

  update public.printer set connection = 'USB', address = '', port = 0
    where restaurant_id = r and machine_id = 'BILL-01';
  update public.printer set connection = 'Wi-Fi'
    where restaurant_id = r and machine_id = 'KOT-TAN-01';

  -- Routing, on menu categories. The tandoor claims the two starter categories that are cooked
  -- at it; the second kitchen machine claims biryani. Everything else is unclaimed and therefore
  -- falls to the machine claiming nothing — which is what makes it the main kitchen machine.
  update public.printer set routes = array[]::text[]
    where restaurant_id = r and machine_id = 'KOT-VEG-01';
  update public.printer set routes = array['Biryani']
    where restaurant_id = r and machine_id = 'KOT-NV-01';
  update public.printer set routes = array['Non-Veg Starters', 'Veg Starters']
    where restaurant_id = r and machine_id = 'KOT-TAN-01';
  update public.printer set routes = array[]::text[]
    where restaurant_id = r and machine_id = 'BILL-01';
end $$;

commit;
