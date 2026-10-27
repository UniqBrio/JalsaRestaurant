-- ============================================================================================
-- Every table names who may reach it through the Data API, explicitly (27-Oct-2026,
-- requests/2026-10-27-supabase-data-api-grants.md).
--
-- WHAT CHANGES ON 30-OCT-2026, AND WHY IT BREAKS JALSA
--   Until now Supabase's default privileges granted SELECT/INSERT/UPDATE/DELETE on every new
--   `public` table (and USAGE on every sequence, EXECUTE on every function) to `anon`,
--   `authenticated` AND `service_role`. On 30-Oct-2026 that default is revoked on every project
--   (github.com/orgs/supabase/discussions/45329). Tables that already exist keep their grants.
--
--   No Jalsa migration ever granted a table to anybody. The server's role - `service_role`, the
--   secret key every route handler uses (rule 3) - reached all 31 tables purely through that
--   default. So the live development project keeps working, but ANY database built from these
--   migrations after 30-Oct - production (not yet provisioned), staging, a preview branch, a
--   rebuilt test project, `supabase db reset` - would answer the server's first request with
--   `42501 permission denied for table restaurant`, and every surface would show its outage
--   screen. Measured on PGlite with no default privileges: tests/unit/data-api-grants.db.unit.spec.ts.
--   The migration not yet applied to development (20261027100000, sign_in_attempt) would land
--   the same way if applied after 30-Oct.
--
-- THE MODEL (rule 3: the browser never speaks to Supabase)
--   service_role   SELECT, INSERT, UPDATE, DELETE on the 30 tables the server reaches through
--                  PostgREST (`db().from(...)`, src/lib/db/**) or writes as service_role from a
--                  SECURITY INVOKER trigger or RPC (change_version, via the bump triggers).
--                  Not TRUNCATE, REFERENCES, TRIGGER or MAINTAIN: PostgREST cannot use them and
--                  the server never asks.
--                  number_series: SELECT, UPDATE only. The application draws numbers through
--                  SECURITY DEFINER next_number(); scripts/reset-test-db.mjs rewinds them.
--                  sign_in_attempt: nothing. Only SECURITY DEFINER sign_in_with_pin() touches it.
--                  USAGE on audit_entry_id_seq - the one `bigserial` the server inserts through.
--                  Identity columns (kot_item.line_seq, sign_in_attempt.id) need no grant.
--   anon,          NOTHING, on any table or sequence. Nothing in this application speaks with
--   authenticated  either role: the publishable key is configured but never used to query. RLS
--                  with no policy already returns them zero rows; revoking the grants as well means
--                  "permission denied" instead of an empty answer, keeps the schema out of the
--                  publishable key's OpenAPI/GraphQL view, and leaves no grant for a future
--                  permissive policy to combine with. guest_favourite (20261004090000) and
--                  sign_in_attempt (20261027100000) already did exactly this; it is now uniform.
--   RLS            Unchanged: enabled, no policy, on every table. A grant is not a policy.
--   Functions      Unchanged. Every RPC already grants EXECUTE to service_role explicitly and
--                  revokes it from PUBLIC, anon and authenticated (20261003090000 and successors);
--                  the spec above re-asserts that on both kinds of database.
--
-- CONVERGENT: revoke-then-grant, so an existing project (which holds the old defaults, including
-- TRUNCATE etc. for every role) and a fresh one end with IDENTICAL privileges - asserted by the
-- spec. Inside one transaction, so no request ever sees the moment between the two.
--
-- DEFAULT PRIVILEGES: the old platform defaults that `postgres` holds in `public` are revoked here
-- too - the statements Supabase publishes for opting in early, for the three API roles, widened
-- from the four DML verbs to ALL because the old default granted ALL (TRUNCATE, REFERENCES,
-- TRIGGER and MAINTAIN included; `pg_default_acl` on development, 27-Oct-2026). Verified
-- first on development: every public table is owned by `postgres`, and the `public` defaults
-- that grant to the API roles are held by `postgres` (and by `supabase_admin`, which this role
-- cannot alter and which applies only to objects supabase_admin creates). Effect: from this
-- migration on, development and test behave exactly as every project will after 30-Oct, so a
-- future table that forgets its grant fails in CI and on development, not on production night.
-- PostgreSQL's own PUBLIC EXECUTE on new functions is deliberately left alone: privileged
-- functions revoke it explicitly, and trigger functions need no EXECUTE to fire.
--
-- THE RULE FOR THE NEXT TABLE: grant it, in the migration that creates it, to service_role, with
-- the verbs the server uses - and classify it in tests/unit/data-api-grants.db.unit.spec.ts,
-- which fails until you do.
--
-- ROLLBACK (restores the pre-30-Oct state exactly; never needed for the server to work):
--   alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated, service_role;
--   alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
--   alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
--   grant all on all tables    in schema public to anon, authenticated, service_role;
--   grant all on all sequences in schema public to anon, authenticated, service_role;
--   revoke all on public.guest_favourite, public.sign_in_attempt from anon, authenticated;
-- ============================================================================================

begin;

-- ---- 1. Start from nothing: every API role, every table and sequence that exists now --------
revoke all on all tables    in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;

-- ---- 2. The server: the four verbs PostgREST uses, on the tables it reaches -----------------
grant select, insert, update, delete on table
  public.audit_entry,
  public.bill,
  public.bill_table,
  public.bridge_discovered_printer,
  public.bridge_pairing_code,
  public.bridge_printer,
  public.bridge_token,
  public.change_version,            -- written as service_role by the INVOKER bump triggers
  public.dining_table,
  public.expense,
  public.guest_attribution,
  public.guest_cart_line,
  public.guest_favourite,
  public.guest_session,
  public.kot,
  public.kot_item,
  public.menu_category,
  public.menu_food_type,
  public.menu_item,
  public.print_job,
  public.printer,
  public.restaurant,
  public.setting,
  public.staff,
  public.staff_permission,
  public.staff_table,
  public.suggestion,
  public.table_request,
  public.tip,
  public.waitlist_entry
to service_role;

-- Drawn through SECURITY DEFINER next_number(); rewound by scripts/reset-test-db.mjs.
grant select, update on table public.number_series to service_role;

-- audit_entry.id is bigserial: an insert calls nextval() as the inserting role.
grant usage on sequence public.audit_entry_id_seq to service_role;

-- public.sign_in_attempt: deliberately absent. Reached only inside sign_in_with_pin().

-- ---- 3. The next table is exposed to nobody until its migration says so ---------------------
alter default privileges for role postgres in schema public
  revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

commit;
