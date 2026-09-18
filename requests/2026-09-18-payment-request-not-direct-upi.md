# CHANGE REQUEST — modify something that ships
Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: the guest's closure journey — `TipScreen` → `PayingScreen` → `PaidScreen` /
  `FailedScreen` in `src/features/guest/GuestClosure.tsx`, and `POST /api/guest/bill` action `pay`.
- CURRENT BEHAVIOUR: the tip step's primary button (`guest-pay`, "Pay ₹x") goes to `PayingScreen`,
  which shows **"Waiting for your bank / Approve the request in your UPI app"** above a dashed
  panel headed **"Payment provider not yet chosen"** holding two stand-in buttons, "The bank
  approved it" and "The payment failed".
- DESIRED BEHAVIOUR: as stated — the customer-facing direct UPI journey goes; the primary action
  is **`Request payment`**; the request reaches the assigned Captain/Waiter **and** the
  Owner/Admin; staff take payment at the table and record it through the existing closure flow;
  the guest sees `Payment request sent`, not a bank waiting screen. Repeat taps must not create
  uncontrolled duplicates. Staff-side payment recording, confirmation, closure, history and
  reporting all stay.
- WHY: as stated — the customer does not pay directly from the Jalsa screen.
- MUST NOT CHANGE: everything not named. Named because they are adjacent: `closeBill` and the
  Record payment dialog, the tip step itself, `requestPayment`/`withdrawPaymentRequest`, the
  invoice and receipt screens, and guardrail 2 (a guest never marks a bill paid).
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes · SCREENS: tip step, the removed paying/failed screens, the status screen's
  request state, and the guest's confirmation. PERMISSIONS: no. RUN MODE: auto. SCALE: scoped.
- STRINGS: `Request payment` and `Payment request sent` as stated. Retired: "Waiting for your
  bank", "Approve the request in your UPI app", "Payment provider not yet chosen", "The bank
  approved it", "The payment failed", "That payment did not go through".

## WHAT INTAKE FOUND — THIS IS A SIMPLIFICATION, NOT A BUG FIX
- **There is no payment gateway and the code says so in three places.** `PayingScreen` renders a
  dashed panel literally headed *"Payment provider not yet chosen"* with the note *"These two
  buttons stand in for the gateway's answer."* `api/guest/bill/route.ts:22` says *"No payment
  provider is chosen yet (Product Plan §8)."* Nothing ever contacted a bank.
- **The `pay` action already refuses to close the bill.** It writes one audit entry and returns
  `{ outcome: 'reported' }`, with the comment *"The guest's phone saying 'paid' is evidence, not
  a closure."* Guardrail 2 is already honoured; no fake payment success exists to remove.
- **"Request payment" is already built and already reaches staff.** `GuestProgress.tsx:245`
  (`guest-request-payment`) posts `action: 'request-payment'` → `requestPayment()` → the bill
  moves to `payment_requested`, which is what the owner's **Awaiting closure** list and the
  Payments section read. There is **no second system to build** and no migration.
- So the work is: retire the stand-in screens from the journey, point the tip step's primary
  action at the existing request, and make the guest's confirmation state say so.

## OPEN QUESTIONS CARRIED TO THE GATE
1. **Does the request reach the WAITER too?** The brief names captain **and** waiter. Today
   `payment_requested` is a bill status read by the owner console; the staff surface's Requests
   tab reads `table_request`, a different table. Whether the captain/waiter's own screen must
   show it as a *request row* — and therefore whether `requestPayment` should also raise a
   `table_request` — is a real decision, not a detail. (The brief also says "do not create a
   duplicate payment-request system", and `table_request` is the generic one.)
2. **Idempotency.** `payment_requested` is a bill STATUS, so a second tap is already a no-op by
   construction. If item 1 adds a `table_request` row, that is where duplicates become possible.
3. **`FailedScreen` and `PaidScreen`.** `PaidScreen` is the receipt the guest still needs after
   staff close the bill. `FailedScreen` only exists to answer a gateway. Delete, or keep behind
   the future provider?
