# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Guest phone → the screen after "Request payment" — the green notice "Imran is bringing your bill. It comes to ₹1,659 including GST." and the actions under it.
- CURRENT BEHAVIOUR: Once payment is requested there is no way back to the menu. The screen offers what to add from a short list and then a way onward to paying; ordering another full round means the guest asking a captain, or the bill being reopened by staff. Nothing on the phone says the request can be paused.
- DESIRED BEHAVIOUR: the requester's own recommended flow:
  - Primary button: **"＋ Continue Ordering"**, as "the large Jalsa-branded CTA".
  - On tapping it: "1. The payment request is automatically paused/withdrawn. 2. The customer returns to the normal menu. 3. They can add multiple items and multiple rounds. 4. All new items remain under the same table/bill. 5. They can again tap Request Payment when completely finished."
  - The green message changes from "Imran is bringing your bill. It comes to ₹1,659 including GST." to **"Payment request paused. You can continue ordering."**
  - A secondary **"Cancel Payment Request"**.
  - Recommended screen, as drawn: the notice, then "Want to add something?", then ＋ Continue Ordering, then Cancel Payment Request.
- WHY: "This supports unlimited additional ordering rounds without making the customer restart the session or create a new bill." And the mental model it is buying, in the requester's words: **not** "I need to cancel payment → then order again", but "I want to add something → Continue Ordering. The system handles the payment-request state in the background."
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Stated explicitly: the same table, the same bill and the same session throughout — no restart, no new bill.
- CORRECTION ROUND: 1
- RUN MODE: auto
- SCALE: scoped

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the post-request screen in both its states — payment requested, and payment request paused — and the route back into the menu. The status screen shares the same notice and the same pair of actions.
- STRINGS ADDED OR ALTERED: "＋ Continue Ordering", "Cancel Payment Request", "Payment request paused. You can continue ordering.", "Want to add something?". All the requester's words.
- PERMISSIONS: no — a guest withdrawing their OWN request. The architecture rule is untouched: the guest still never marks a bill paid, and only a named member of staff records a closure.
- USAGE: any table that decides on one more round after asking for the bill — a common enough moment that its absence is what prompted this request.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks (B4),
  touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## HOW THIS SITS WITH THE UPSELL BRIEF EARLIER TODAY
`2026-09-12-guest-upsell-three-tabs.md` made this same screen a three-tab curated upsell whose
primary action is "Pay ₹X". This request adds a THIRD thing a guest may want there: not a
dessert and not the payment step, but the whole menu again. They are not in conflict — the tabs
are for "one more sweet", Continue Ordering is for "actually, dinner is not finished" — but they
compete for the same screen, and a screen with three primary actions has none.

Resolved as: **Continue Ordering is the primary action on this screen**, as the requester asks
for in terms ("the large Jalsa-branded CTA"), the upsell tabs stay above it as the curated
shortcut, and "Pay ₹X" becomes the quieter continuation next to it. Recorded here rather than
decided silently, because it downgrades a button the previous request named.

## NOT STATED BY THE REQUESTER
- The difference between "Continue Ordering" and "Cancel Payment Request" once both are on the
  screen: both withdraw the request. Read as — Continue Ordering withdraws it **and takes the
  guest to the menu**; Cancel Payment Request withdraws it and leaves them where they are,
  watching their order. The requester's own mental-model paragraph is what decides this: the
  first is the one people want, so it is the one that does the whole job in one tap.
- What the captain sees when a request is withdrawn: `unknown`. The bill returns to `open`, which
  is the state it was in before the request, so the closure queue simply no longer holds it. An
  audit line is written, because a request that appeared and vanished from a captain's screen
  with no record is the kind of thing that gets blamed on the software.
- Whether a paused request can be resumed with one tap rather than re-requested: not asked for.
  "They can again tap Request Payment when completely finished" is the stated route, and that
  button already exists on the status screen.
