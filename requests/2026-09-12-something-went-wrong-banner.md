# BUG REQUEST — something that ships is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C -->

Run **Track C** ([workflows/bug.md](../workflows/bug.md)) with this request.

## FIELDS
- WHAT HAPPENS: 'Sometimes, "something went wrong" error appears, fix it permanently.'
- ERROR WORDING, verbatim from the screenshot: **"Something went wrong. Please try again. What you can see below is the last thing we heard — your order is safe on our side."**
- WHO IS AFFECTED: a guest, on the menu screen. Selectivity beyond that: `unknown`.
- WHERE: guest phone → menu screen, a yellow banner between the header and the search field. The screen underneath is intact and correct — the same menu, the same three items in the cart, the same ₹460.
- WAS IT WORKING BEFORE?: `unknown`.
- REPRO STEPS: `unknown` — "sometimes" is the whole of what was stated, and it is the most important word in the report.
- CORRECTION ROUND: 1
- RUN MODE: auto
- SCALE: micro

## STANDING INSTRUCTIONS (do not edit)
- Track C finds the ROOT CAUSE before proposing a fix, and states it in one sentence.
- The fix is the minimum change that removes the cause, not the symptom.
- A regression rung is added for the cause, not for the report.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## ROOT CAUSE (Track C's first stop, stated from reading the code)
**One failed poll paints an alarm on a screen that is entirely correct.**

`useLiveData` re-reads every six seconds. Any single failure — a cold serverless function, a lift,
a tunnel, a dropped packet — sets `staleReason`, and `staleReason` renders the banner. There is no
threshold: the first failure is the one the guest sees, and the next successful tick six seconds
later clears it. That is exactly the "sometimes" in the report: nothing is wrong, and the
application says something is.

The wording compounds it. "Something went wrong. Please try again." is `userMessageFor`'s generic
fallback, reached when the failure cannot be classified — which a network blip cannot be. It asks
the guest to retry something they did not do, about a problem they cannot fix, on a screen that
needs nothing from them.

## THE FIX, AND WHY IT IS NOT "HIDE THE BANNER"
The banner earns its place when the screen really has stopped tracking the kitchen — a guest
watching a stale "Preparing" while their food sits ready is worse than the banner ever is. So the
rule changes, not the feature:

1. **Two consecutive failures before anything is said.** One blip is not an outage; the next tick
   is six seconds away. Any success resets the count immediately.
2. **The sentence becomes the restaurant's, not the runtime's.** A guest is told this screen is
   having trouble keeping up — which is what is true — rather than "something went wrong", which
   names nothing and asks them to fix it.

"Permanently" is the requester's word, and the honest reading is: it stops appearing when nothing
is wrong. It will still appear when something is, and that is the point of it.

## NOT STATED BY THE REQUESTER
- Whether they saw it once or repeatedly: `unknown`. "Sometimes" reads as intermittent, which is
  consistent with the single-failure threshold above; a persistent one would mean a real outage
  and a different investigation.
- Whether the same banner on the captain's and owner's screens should change too: not stated. It
  is the same hook and the same rule, so it does — those screens poll on the same loop.
