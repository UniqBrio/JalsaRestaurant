# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: both closure screens — the owner's "Record payment · B-1042" dialog and the captain's "Close B-1042" sheet.
- CURRENT BEHAVIOUR (from the requester's two screenshots, both live):
  - **Owner:** totals block → `Discount %` (full width) → `Discount in ₹` (full width, stacked under it) → helper line → `PAID BY` → Reference. The only sign of what the discount comes to is the sentence "Taken once: ₹100 off ₹1,300".
  - **Captain:** totals block → `PAID BY` → `Discount %` → `Discount in ₹` → Reference. The discount sits *below* the payment method, the reverse of the owner's order.
  - Neither screen shows the amount actually payable after the discount. The "To pay ₹1,365" above the fields is the figure *before* it, and it does not move.
- DESIRED BEHAVIOUR: "Show 'Discount % and Discount in ₹' in one row as two fields. Show after discount amount in the same screen before 'Paid by' options. Make similar corrections in captain's payment closure screen too."
- WHY: `unknown` — not stated. (The screenshots show what it costs: a cashier types 7.69% and has to do the GST arithmetic in their head to know what to take from the guest.)
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. The mirroring itself works and is not in scope — the requester's own screenshot proves it (7.69% ↔ ₹100 on a ₹1,300 base is arithmetically exact). The payment methods, Reference, the audit note and the Record button all stay.
- CORRECTION ROUND: **3** on this pair of screens. Round 1: `2026-09-12-discount-fields-mirror.md` (owner only, mirrored the boxes). Round 2: `2026-09-12-discount-both-fields-both-screens.md` (brought the captain's screen in, one discount taken once). This round is layout and a missing figure.
- RUN MODE: auto
- SCALE: scoped

## ROUND 3 — WHAT ROUNDS 1 AND 2 MISSED
Both earlier rounds were about the *arithmetic* — is it mirrored, is it stored unambiguously, is it
taken once. Both got that right and neither looked at the screen as a cashier stands at it. What
they left:

1. **Two full-width boxes stacked** where one row of two would do. Round 2 built a shared component
   and reused the existing `Field` stacking without asking whether the pair reads as a pair.
2. **No after-discount figure anywhere.** The helper sentence says "₹100 off ₹1,300" — the discount
   and the base, but never the answer. And the answer is not `1300 − 100`: GST is recharged on the
   reduced amount, so it is ₹1,260, not ₹1,265. The one number the cashier actually needs was the
   one number no screen showed.
3. **The captain's screen kept a different field ORDER** — discount below Paid by, where the owner's
   is above. Round 2 unified the control and left the layout forked.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: both closure dialogs — no discount, a discount entered, an invalid entry, and a discount of 100%. Both themes. Narrow widths matter: two fields in a row must fall back to stacked rather than squeeze.
- STRINGS ADDED OR ALTERED: one new row label for the after-discount figure; wording `unknown` and drafted in the design's own voice. Every existing string is frozen.
- PERMISSIONS: no.
- USAGE: once per discounted bill, at the till, with a guest waiting.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), impact analysis before proposing
  (B2), plan with regression risks (B4). Every changed line traces to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it, never
  subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- CORRECTION ROUND ≥ 2: read the previous attempts and state what they missed BEFORE proposing.
  Done above.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## THE ARITHMETIC DECISION THIS FORCES, recorded rather than made quietly
"After discount" is not the subtotal minus the discount. Taking ₹100 off ₹1,300 leaves ₹1,200 of
food, and GST is then charged on ₹1,200 rather than ₹1,300 — so the payable falls from ₹1,365 to
**₹1,260**, not ₹1,265. Tips are added after tax and are unaffected.

Rather than write that arithmetic a second time on the client, the screen calls **`totalBill`** —
the same pure function the server closes the bill with — passing the subtotal as a single line. It
cannot drift from what is actually charged, because it *is* what is actually charged. A separate
"preview" formula that agreed today and diverged after the next tax change is the failure this
avoids; the two figures must be the same number or the screen is lying at a till.

This needs `taxRate` and `tip` on both bill views, which they do not currently expose.

## NOT STATED BY THE REQUESTER
- Whether the after-discount figure shows when there is NO discount: read as no. A row reading
  "After discount ₹1,365" beside "To pay ₹1,365" is two labels for one number.
- Whether the totals block at the top should itself update instead: not asked, and not done — it is
  the bill as it stands, and a closure screen that silently rewrites the bill above the control
  that changed it makes the discount hard to see.
- Behaviour below roughly 420px, where two fields in a row stop being readable: `unknown`. They
  stack, because a squeezed pair of number boxes at a till is worse than two rows.
