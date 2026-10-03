-- =============================================================================
-- Jalsa — the four privileged functions answer this application's server, and nobody else
-- (03-Oct-2026).
--
-- WHY
--   `set_staff_pin`, `set_own_pin`, `verify_staff_pin` and `next_number` are SECURITY DEFINER:
--   they run as their owner and so pass row-level security. Postgres grants EXECUTE on every new
--   function to PUBLIC, and Supabase's default privileges grant it to `anon` and `authenticated`
--   as well; none of these functions ever revoked it. Every one was therefore callable at
--   `/rest/v1/rpc/<name>` with the PUBLISHABLE key - the key that ships in the browser bundle -
--   skipping every check the application makes before it calls them:
--     set_staff_pin     anyone holding a staff id could set that person's PIN (the owner's too)
--                       without the `staff.pin` grant: an account takeover. Staff ids are on the
--                       screen of anyone signed in to the console.
--     set_own_pin       an unthrottled oracle for a person's current PIN (10,000 guesses), and
--                       then a change of it.
--     verify_staff_pin  an unthrottled sweep of all 10,000 PINs for a restaurant, answering
--                       with each holder's id, name and role.
--     next_number       anyone could advance the bill / KOT / group / waitlist series, leaving
--                       gaps in invoice numbering that is meant to run without them.
--   Verified on the TEST database before this file was written (`has_function_privilege`: anon
--   and authenticated true on all four), and named by the Supabase security advisor.
--
--   The application never calls them from a browser: every call is in server code through the
--   client built with SUPABASE_SECRET_KEY (`src/lib/supabase/server.ts`), i.e. as `service_role`.
--
-- WHAT
--   EXECUTE is revoked from PUBLIC, anon and authenticated, and granted to `service_role` only -
--   the same boundary `redirect_print_job` was created with (20261002120000).
--   They STAY security definer: that is how they have always worked and nothing here needs it
--   to change. Their search_path is already fixed and explicit (`public, extensions` /
--   `public`), and every table and pgcrypto call in their bodies is schema-qualified, so a
--   caller's search_path cannot redirect them. No function body is changed.
--
--   The four trigger functions added on 02-Oct get the fixed search_path they were created
--   without (`function_search_path_mutable`). Their bodies already qualify every table.
--   Older trigger functions with the same advisory are NOT touched here: they predate this work.
--
-- SAFE ON A LIVE DATABASE: privileges and function settings only. No row is read or written.
-- The server keeps working throughout - `service_role` holds EXECUTE before and after.
-- =============================================================================

begin;

revoke execute on function public.set_staff_pin(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.set_own_pin(uuid, text, text)      from public, anon, authenticated;
revoke execute on function public.verify_staff_pin(uuid, text)       from public, anon, authenticated;
revoke execute on function public.next_number(uuid, text)            from public, anon, authenticated;

grant execute on function public.set_staff_pin(uuid, text, boolean) to service_role;
grant execute on function public.set_own_pin(uuid, text, text)      to service_role;
grant execute on function public.verify_staff_pin(uuid, text)       to service_role;
grant execute on function public.next_number(uuid, text)            to service_role;

alter function public.printer_sync_roles()            set search_path = public;
alter function public.bill_order_type_fixed()         set search_path = public;
alter function public.bill_table_not_takeaway()       set search_path = public;
alter function public.kot_table_matches_order_type()  set search_path = public;

commit;
