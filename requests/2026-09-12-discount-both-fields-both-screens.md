# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: **Two** closure screens — the owner's "Record payment · B-1042" dialog, and the captain's "Close B-1042" sheet on the staff surface. Both are named explicitly: "Update the Owner → Payment Closure screen, plus captain close bill screen 'Close B-1042'."
- CURRENT BEHAVIOUR (as stated by the requester): "Payment method: Cash / Digital-UPI / Card · Discount % · Reference · Final payment action."
- DESIRED BEHAVIOUR: 'Add a second discount field immediately below "Discount %": 1. Discount % 2. Discount in ₹. Both fields must always remain synchronized.'
  - Base: "Use the bill amount before discount as the calculation base."
  - `discountAmount = billAmount × discountPercentage / 100` · `discountPercentage = (discountAmount / billAmount) × 100`
  - "Both fields must update immediately when either value changes. Do NOT create a circular update loop. Track which field the user is currently editing and calculate the other field from it."
  - Validation, verbatim: % not negative, % not over 100, ₹ not negative, ₹ not over the eligible bill amount, empty treated as zero, non-numeric prevented, "handle decimal values correctly where applicable".
  - Helper text: "Enter either percentage or amount. The other value updates automatically."
  - **"Do NOT subtract both Discount % and Discount in ₹. They are two representations of the SAME discount. The system must apply the discount only once."**
  - Backend: "Store the final discount consistently so there is no ambiguity in the database. Prefer storing: discount_type: 'percentage' | 'amount' · discount_value · calculated_discount_amount · calculated_discount_percentage. When recording/closing the payment, preserve the actual discount applied and the user who applied it."
- WHY: `unknown` — not stated beyond the mechanics.
- MUST NOT CHANGE: stated verbatim — "Do not break the existing payment, tip, GST, reference, audit-log, or bill-closing functionality." Plus everything not named in DESIRED BEHAVIOUR.
- CORRECTION ROUND: **2.** The owner's half of this shipped this morning as `2026-09-12-discount-fields-mirror.md` (commit 6614eb5).
- RUN MODE: auto
- SCALE: scoped

## ROUND 2 — WHAT THE PREVIOUS ATTEMPT MISSED, before anything is proposed
Round 1 renamed "or flat ₹" to "Discount in ₹", mirrored the two boxes, and made only the typed
one bind — the "apply it once" requirement, which it reached independently and for the same
reason. What it did **not** do:

1. **It only touched the owner's dialog.** `CloseBillSheet.tsx`. The captain closes bills from a
   different component (`StaffTables.tsx`) with its own single "Discount %" field, and that screen
   was never opened. This request names it explicitly, and that is the real gap.
2. **No helper text.** The requester supplies the sentence; round 1 wrote a different one.
3. **Nothing was stored to say WHICH field was typed.** Round 1 sends only one of the two, so the
   database is unambiguous in practice — but only because of a rule that lives in the client. A
   `discount_type` column states it in the row, which is what was asked for.
4. **Decimals.** See below; round 1 rounded to whole rupees without saying so.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: both closure dialogs — empty, percentage-entered, amount-entered, over-limit, non-numeric, and the permission-denied case (a cashier holds `bill.disc_pct` but not `bill.disc_flat`). The totals block above each must move with the discount.
- STRINGS ADDED OR ALTERED: "Discount in ₹" (already shipped on the owner's dialog), and the requester's helper sentence, verbatim. Everything else frozen.
- PERMISSIONS: **worth a decision, and it is not stated.** `bill.disc_pct` and `bill.disc_flat` are separate grants today, and `closeBill` demands one or the other depending on which arrived. If the two boxes are one discount, a person with only `bill.disc_pct` could type in the ₹ box and have a percentage sent — which is either a sensible convenience or a permission routed around, depending on who you ask. Recorded, not decided silently.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with the
  sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks (B4),
  touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it, never
  subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- CORRECTION ROUND ≥ 2: read the previous attempt and state what it missed BEFORE proposing
  anything. Done above.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## THE ONE REQUIREMENT THIS APPLICATION CANNOT MEET AS WRITTEN
Test case 3: "Bill ₹1,030 → enter 5% → ₹51.50".

**This application holds money in integer rupees, everywhere.** It is canonical pattern JP-5, it
is stated in CLAUDE.md, and `tests/unit/money.unit.spec.ts` enforces it. 5% of ₹1,030 is ₹51.50,
and what this bill will actually be discounted by is **₹52** — because that is what `totalBill`
computes, what the GST is then charged on, and what the ledger records. Showing ₹51.50 in a box
next to a bill discounted by ₹52 would be the worst of both.

So the ₹ box shows whole rupees and test case 3 reads **₹52, not ₹51.50**. The percentage box
keeps decimals (the column is `numeric(5,2)`), so a cashier typing 7.5% gets 7.5% — the decimal
requirement is met where it costs nothing.

Moving the whole application to paise is a real option and a separate piece of work: it touches
totals, GST, tips, every display and every money spec. It is not something to slip inside a
discount change. **Flagged for the requester rather than decided here.**

## NOT STATED BY THE REQUESTER
- "the eligible bill amount" — read as the subtotal BEFORE discount and before GST, which is what
  "use the bill amount before discount as the calculation base" says, and what `totalBill` already
  discounts against.
- `discount_value` as a fourth stored column: it is by definition whichever of the percentage and
  the amount matches `discount_type`, both of which are already stored. A fourth column holding a
  third copy of the same number is a place for them to disagree. Recorded rather than built; say
  the word and it goes in.
