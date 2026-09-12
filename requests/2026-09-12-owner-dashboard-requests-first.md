# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

> ROUTING NOTE. Arrived with `workflows/framework-update.md` attached. Route C of that runbook:
> a feature request, not a process failure, and nothing process-level is revealed. No framework
> change, no VERSION bump.

## FIELDS
- FEATURE / SCREEN: Owner console → Dashboard tab. Today it reads, top to bottom: the floor grid (22 table cards), then "TABLE REQUESTS", then "SUGGESTIONS FROM GUESTS".
- CURRENT BEHAVIOUR: Table requests sit BELOW the whole floor grid — in the requester's screenshot, a live "Call captain, 16 min" on table A5 is off the bottom of the first screen and reached only by scrolling past 22 table cards. Every request is listed, however many there are.
- DESIRED BEHAVIOUR: "Move 'Table Requests' to the top of the Dashboard. Show a maximum of 3 requests initially, with the remaining requests accessible through vertical scrolling."
- WHY: `unknown` as stated — though the screenshot shows the thing it fixes: the one item on the screen with a clock running on it was the one furthest down the page.
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Specifically: the floor grid, the suggestions section, what a request row shows, the Done action and the line "Captains see the same list — either of you can clear it, and it clears for both."
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: owner Dashboard — the ordinary state, the no-requests state (which must not become an empty scroll box at the top of the screen), and the many-requests state. Loading / error / offline / permission-denied unaffected.
- STRINGS ADDED OR ALTERED: none required by the move itself. A count of what is below the fold may be needed; wording `unknown` and drafted in the design's own voice.
- PERMISSIONS: no — the same section, in a different place.
- USAGE: the Dashboard is the owner's default landing tab; a table request is time-critical and already carries an age in minutes.
- RUN MODE: auto
- SCALE: micro

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks
  (B4), touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## NOT STATED BY THE REQUESTER
- "Maximum of 3 initially, the rest through vertical scrolling" is read as: the section's own box
  is tall enough for three rows and scrolls inside itself — NOT a "show more" button, which is a
  tap, and not the page growing, which is what the ask is moving away from.
- What happens with no requests at all: `unknown`. Read as: the section keeps the empty state it
  has today rather than a scroll box holding nothing.
