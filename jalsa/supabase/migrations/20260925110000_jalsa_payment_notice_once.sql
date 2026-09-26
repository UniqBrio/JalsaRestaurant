-- =============================================================================
-- 20260925110000_jalsa_payment_notice_once
--
-- 25-Sep correction list, item 37 (review fix): a guest's payment request raises ONE "Clear the
-- table" and ONE "Bill requested" per bill. The app reads before it writes, but two taps can race
-- past the read; this index is what makes the second insert fail (23505), which the app ignores.
-- Partial: only while the notice is open, so a request withdrawn and asked again raises a new pair.
-- =============================================================================

create unique index if not exists table_request_payment_notice_once
  on public.table_request (bill_id, kind)
  where done_at is null and kind in ('Clear the table', 'Bill requested');
