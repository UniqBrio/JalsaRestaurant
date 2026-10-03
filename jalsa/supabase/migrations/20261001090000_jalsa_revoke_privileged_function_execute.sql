-- =============================================================================
-- Jalsa — close the browser-key path to the four privileged functions, on a database that does
-- not yet have the 02-Oct feature migrations (written 03-Oct-2026).
--
-- WHY THIS FILE EXISTS BESIDE 20261003090000_jalsa_lock_privileged_functions
--   That migration revokes the same grants AND fixes the search_path of four trigger functions
--   that the 02-Oct feature migrations create. On PRODUCTION those functions do not exist yet, so
--   it fails there as a whole ("function public.printer_sync_roles() does not exist" - shown on a
--   production-shaped database) and the exposure stays open. It is already applied to TEST and
--   is never edited.
--
--   This file is the revoke/grant half only, so production can be closed NOW, without the
--   feature migrations. It is numbered BEFORE 20261002* on purpose: production then applies, in
--   filename order, this file -> the four feature migrations -> 20261003090000 (whose revokes
--   are by then no-ops and whose trigger-function settings then have functions to apply to).
--   On TEST, where the later files already ran, this file is a no-op: revoking what is not
--   granted and granting what is held change nothing.
--
-- WHAT (identical to the first half of 20261003090000; see its header for the exploit detail)
--   set_staff_pin, set_own_pin, verify_staff_pin, next_number: EXECUTE revoked from PUBLIC,
--   anon and authenticated; granted to service_role, the server's only caller. They stay
--   SECURITY DEFINER with their existing fixed search_path; no function body is changed.
--
-- SAFE ON A LIVE DATABASE: privileges only. No row is read or written. The server keeps working
-- throughout - service_role holds EXECUTE before and after.
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

commit;
