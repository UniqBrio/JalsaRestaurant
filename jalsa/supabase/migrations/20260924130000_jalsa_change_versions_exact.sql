-- ============================================================================================
-- Change versions, corrected: a heartbeat that REWRITES an unchanged value must move nothing.
--
-- WHY (found applying 20260924120000 to development, 24-Sep-2026)
--   `after update of hostname, bridge_version … on bridge_token` fires whenever those columns are
--   in the SET list — and the print bridge's sync rewrites both on every call, unchanged. Within
--   minutes of the first migration the 'floor' counter had moved ten times with nothing on the
--   floor changed, which would have made every captain's phone and the owner's console re-read in
--   full every few seconds: the polling cost fix 4 exists to remove.
--
--   Both column-list triggers become ROW triggers that fire only when a watched value really
--   differs. The function is the same; only WHEN it runs changes.
-- ============================================================================================

drop trigger if exists bridge_token_bump_floor on public.bridge_token;
drop trigger if exists bridge_token_bump_floor_ins_del on public.bridge_token;
drop trigger if exists bridge_token_bump_floor_upd on public.bridge_token;
create trigger bridge_token_bump_floor_ins_del
  after insert or delete on public.bridge_token
  for each statement execute function public.bump_change_version('floor');
create trigger bridge_token_bump_floor_upd
  after update on public.bridge_token
  for each row
  when (
    old.label is distinct from new.label
    or old.revoked_at is distinct from new.revoked_at
    or old.source is distinct from new.source
    or old.hostname is distinct from new.hostname
    or old.bridge_version is distinct from new.bridge_version
  )
  execute function public.bump_change_version('floor');

drop trigger if exists guest_session_bump_floor on public.guest_session;
drop trigger if exists guest_session_bump_floor_ins_del on public.guest_session;
drop trigger if exists guest_session_bump_floor_upd on public.guest_session;
create trigger guest_session_bump_floor_ins_del
  after insert or delete on public.guest_session
  for each statement execute function public.bump_change_version('floor');
create trigger guest_session_bump_floor_upd
  after update on public.guest_session
  for each row
  when (
    old.table_id is distinct from new.table_id
    or old.bill_id is distinct from new.bill_id
    or old.heard_about is distinct from new.heard_about
  )
  execute function public.bump_change_version('floor');
