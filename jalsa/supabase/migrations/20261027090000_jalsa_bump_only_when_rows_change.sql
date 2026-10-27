-- ============================================================================================
-- Change counters move only when a statement actually changed a row (27-Oct-2026, P-4).
--
-- WHY (requests/2026-10-27-performance-security-delivery.md; docs/audit/NAVIGATION_PERFORMANCE_AUDIT.md N-03)
--   The 26 statement-level triggers that move 'floor' and 'catalog' fired for EVERY statement on
--   their table — including an UPDATE or DELETE that matched nothing. Postgres runs a FOR EACH
--   STATEMENT trigger once per statement whether it touched zero rows or a thousand. Production,
--   24-Oct: 52 empty `PATCH print_job` sweeps, each moving the floor, each making every open
--   captain's phone and the owner's console rebuild in full for a change that did not exist.
--   The app-side sweep fix (navigation round 2) removed that one writer; this removes the class.
--
-- WHAT CHANGES
--   Each of those triggers becomes one trigger PER EVENT — `<name>_ins`, `<name>_upd`, `<name>_del`
--   — because Postgres (16 and 17 alike) refuses transition tables on a trigger with more than one
--   event; found on the rig, which is why the rig is run first. Each declares the transition table
--   its event fills and calls `bump_change_version_if_rows`, which moves the same scopes, in the
--   same order, in the same transaction — only when that table holds a row. One statement is one
--   event, so exactly one of the three runs, as exactly one trigger ran before.
--   Row-level triggers (they already fire only for real rows, behind WHEN clauses) and
--   `bump_change_version` itself are untouched.
--
-- WHAT IS DELIBERATELY NOT CHANGED
--   An UPDATE that rewrites a row to identical values still counts: comparing whole rows would
--   need equality on every column type (json has none), and a counter that fails to move is a
--   screen that silently stops updating — the one failure the design must never have. Zero rows is
--   unambiguous; "same values" is not.
--
-- LOCKS AND COST
--   DROP/CREATE TRIGGER takes SHARE ROW EXCLUSIVE on each of the 26 tables until COMMIT: writes to
--   them wait for the migration (milliseconds; no table rewrite, no data touched). Apply outside
--   service. Transition tables hold the statement's affected rows; this app writes a handful of
--   rows per statement.
--
-- PROVEN (before any non-local apply)
--   tests/unit/change-counters-zero-rows.db.unit.spec.ts (PGlite, every migration in order) and the
--   performance rig's Postgres 16 (forward, rollback, forward). Production runs Postgres 17.6.
--
-- ROLLBACK (restores the previous triggers exactly; data is untouched either way)
--   do $$ declare t text; e text; begin
--     foreach t in array array['audit_entry','bill','bill_table','bridge_pairing_code','bridge_printer',
--       'expense','guest_attribution','kot','kot_item','print_job','printer','staff','staff_permission',
--       'staff_table','suggestion','table_request','tip','waitlist_entry'] loop
--       foreach e in array array['ins','upd','del'] loop
--         execute format('drop trigger if exists %I on public.%I', t || '_bump_floor_' || e, t); end loop;
--       execute format('create trigger %I after insert or update or delete on public.%I for each statement
--         execute function public.bump_change_version(%L)', t || '_bump_floor', t, 'floor'); end loop;
--     foreach t in array array['dining_table','menu_category','menu_food_type','menu_item','restaurant','setting'] loop
--       foreach e in array array['ins','upd','del'] loop
--         execute format('drop trigger if exists %I on public.%I', t || '_bump_catalog_' || e, t); end loop;
--       execute format('create trigger %I after insert or update or delete on public.%I for each statement
--         execute function public.bump_change_version(%L, %L)', t || '_bump_catalog', t, 'floor', 'catalog'); end loop;
--     foreach t in array array['bridge_token','guest_session'] loop
--       foreach e in array array['ins','del'] loop
--         execute format('drop trigger if exists %I on public.%I', t || '_bump_floor_ins_del_' || e, t); end loop;
--       execute format('create trigger %I after insert or delete on public.%I for each statement
--         execute function public.bump_change_version(%L)', t || '_bump_floor_ins_del', t, 'floor'); end loop;
--   end $$;
--   drop function if exists public.bump_change_version_if_rows();
--
-- RLS / privileges: the function is a trigger function — not callable through PostgREST — with a
-- fixed search_path. Nothing is granted; EXECUTE is revoked from the API roles for good measure.
-- ============================================================================================

create or replace function public.bump_change_version_if_rows()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  touched boolean;
  s text;
begin
  -- The transition table this trigger's event fills: OLD for a delete, NEW for an insert or update.
  if tg_op = 'DELETE' then
    select exists (select 1 from old_rows) into touched;
  else
    select exists (select 1 from new_rows) into touched;
  end if;
  if not touched then
    return null;
  end if;
  -- As bump_change_version: one scope at a time, in a fixed order, so two writers never hold
  -- them crosswise (20260925130000, item 7).
  foreach s in array (select array_agg(x order by x) from unnest(tg_argv) as x) loop
    update public.change_version set version = version + 1 where scope = s;
  end loop;
  return null;
end;
$$;

revoke all on function public.bump_change_version_if_rows() from public, anon, authenticated;

do $$
declare
  t text;
  -- One trigger per event: `suffix`, the event, and the transition table that event fills.
  ev constant text[][] := array[
    ['ins', 'insert', 'new table as new_rows'],
    ['upd', 'update', 'new table as new_rows'],
    ['del', 'delete', 'old table as old_rows']
  ];
  i int;
  procedure_args text;
  base text;
  events int[];
begin
  -- name stem, events to cover, scopes - for every statement-level counter trigger that exists.
  for t, base, procedure_args, events in
    select x.tbl, x.tbl || x.stem, x.args, x.evs
      from (
        select unnest(array[
          'audit_entry', 'bill', 'bill_table', 'bridge_pairing_code', 'bridge_printer', 'expense',
          'guest_attribution', 'kot', 'kot_item', 'print_job', 'printer', 'staff', 'staff_permission',
          'staff_table', 'suggestion', 'table_request', 'tip', 'waitlist_entry'
        ]) as tbl, '_bump_floor' as stem, quote_literal('floor') as args, array[1, 2, 3] as evs
        union all
        select unnest(array['dining_table', 'menu_category', 'menu_food_type', 'menu_item', 'restaurant', 'setting']),
               '_bump_catalog', quote_literal('floor') || ', ' || quote_literal('catalog'), array[1, 2, 3]
        union all
        -- Insert and delete only: their updates are row triggers behind WHEN clauses (20260924130000).
        select unnest(array['bridge_token', 'guest_session']), '_bump_floor_ins_del', quote_literal('floor'), array[1, 3]
      ) x
  loop
    execute format('drop trigger if exists %I on public.%I', base, t);
    foreach i in array events loop
      -- Re-runnable, like every migration here: a second apply replaces rather than fails.
      execute format('drop trigger if exists %I on public.%I', base || '_' || ev[i][1], t);
      execute format(
        'create trigger %I after %s on public.%I referencing %s
           for each statement execute function public.bump_change_version_if_rows(%s)',
        base || '_' || ev[i][1], ev[i][2], t, ev[i][3], procedure_args);
    end loop;
  end loop;
end;
$$;
