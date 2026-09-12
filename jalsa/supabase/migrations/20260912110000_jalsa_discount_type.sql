-- =============================================================================
-- 20260912110000_jalsa_discount_type
--
-- WHICH of the two discount boxes the cashier actually typed in.
--
-- WHY THE ROW HAS TO SAY IT
--   The closure screens show a discount two ways — a percentage and an amount — and they are one
--   discount, not two. The application already sends only the box that was typed in, so the row
--   is unambiguous in PRACTICE. But the rule that makes it so lives in a React component, and a
--   row whose meaning depends on a rule held somewhere else is a row that will eventually be
--   read wrong: by a report, by an export, by whoever writes the next screen.
--
--   `discount_type` puts it in the row. `discount_pct` and `discount_amount` both continue to
--   hold the calculated figures, so any reader gets both representations without recomputing
--   either; `discount_type` says which one a person chose.
--
-- WHY THERE IS NO `discount_value` COLUMN
--   It would be, by definition, whichever of the two columns above matches `discount_type` — a
--   third copy of a number already stored twice, and the copy that eventually disagrees.
--   Requested; not built; recorded in requests/2026-09-12-discount-both-fields-both-screens.md.
--
-- Existing rows keep a null type, which reads as "before this was recorded" rather than a
-- guessed answer. Nothing backfills: a guess written into history is indistinguishable from a
-- fact, and these are real closed bills.
-- =============================================================================

begin;

alter table public.bill
  add column if not exists discount_type text
    check (discount_type is null or discount_type in ('percentage', 'amount'));

comment on column public.bill.discount_type is
  'Which box the person typed in. The other of discount_pct / discount_amount is the calculated one. Null on bills closed before 12-Sep-2026.';

commit;
