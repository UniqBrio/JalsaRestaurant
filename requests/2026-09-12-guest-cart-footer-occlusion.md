# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Guest phone → order-review screen ("Your order · Table A5" / "Check your order"), the bottom action bar and the totals card directly above it.
- CURRENT BEHAVIOUR: A "This round ₹1,351 / Already ordered ₹0" card sits directly above a FIXED bottom action bar, and the bar covers it. Requester's words: `Responsiveness issue "This round ₹1,351 Already ordered ₹0" — These details are hidden behind "send to kitchen" button.` The bar holds `Send to the kitchen · ₹1,351` and, under it, a full-width `Add something else` button.
- DESIRED BEHAVIOUR: "Remove price on top of the button 'Send to kitchen'. Add something else can be denoted with + icon next to 'Send to kitchen'."
- WHY: The totals are unreadable — the fixed bar sits on top of them (stated as a responsiveness issue).
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. In particular the ability to get back to the menu and add more items must survive the change of that button into an icon, and sending the round must keep working exactly as it does.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest order-review screen, populated state and its busy/disabled state. The empty state ("Nothing here yet") has neither the card nor the bar and is untouched.
- STRINGS ADDED OR ALTERED: `Send to the kitchen · ₹1,351` loses its amount; `Add something else` stops being visible text and becomes a `+` icon (the wording is retained as the icon's accessible name — the freeze rule is about what a string SAYS, and nothing else on the screen changes).
- PERMISSIONS: no
- USAGE: every guest who orders passes through this screen at least once per round — stated by the flow, not by the requester.
- RUN MODE: auto
- SCALE: micro

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks
  (B4) — confirm mode waits for approval; auto mode (default) logs it and applies — touching
  only what DESIRED BEHAVIOUR requires. Every changed line must trace to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4), scoped to the touched
  area: states, both themes in semantic tokens, the string table, the permission answer.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why (B1). If the miss was the process's fault, flag `/framework-update` too.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.

## NOT STATED BY THE REQUESTER — Track B must ask or assume in the open
- "Remove price on top of the button" is the one ambiguous phrase in this request. It can mean
  the TOTALS CARD that sits on top of (above) the button, or the amount printed IN the button's
  label. The sentence before it names the totals card as the thing that is hidden, and the
  amount in the label is the same number — so both readings point at removing the total from
  this screen's footer area. Recorded as stated; resolved in the open at B4.
- This request and `2026-09-12-guest-total-visibility.md` touch the same footer in the same
  run. They are not independent: that request puts the total behind a checkbox, this one takes
  it out of the footer. They must be planned together or the second will undo the first.
