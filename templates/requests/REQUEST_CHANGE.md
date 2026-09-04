# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: `<the exact surface, named as it appears in the app>`
- CURRENT BEHAVIOUR: `<what it does today — one or two lines>`
- DESIRED BEHAVIOUR: `<what it should do instead>`
- WHY: `<the problem this solves — or unknown>`
- MUST NOT CHANGE: `<adjacent behaviour to preserve; if the requester named nothing: "everything not named in DESIRED BEHAVIOUR">`
- CORRECTION ROUND: `<1, or N with a pointer to the previous attempt (request file / commit / "unknown")>`

## DESIGN SURFACE
<!-- Filled whenever anything the user sees changes. "not visual" is a claim the diff will be checked against. -->
- VISUAL?: `<yes / not visual>`
- SCREENS & STATES TOUCHED: `<which screens, and which of empty · loading · error · offline · permission-denied the change affects>`
- STRINGS ADDED OR ALTERED: `<the requester's exact words where given — everything else on the screen is frozen (the freeze rule)>`
- PERMISSIONS: `<does who-can-see-or-do change? yes / no / unknown>`

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, present the plan with regression risks
  (B4), wait for approval, then apply — touching only what DESIRED BEHAVIOUR requires. Every
  changed line must trace to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4), scoped to the touched
  area: states, both themes in semantic tokens, the string table, the permission answer.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why (B1). If the miss was the process's fault, flag `/framework-update` too.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.

## EXAMPLE (filled)
- FEATURE / SCREEN: Records list → export menu
- CURRENT BEHAVIOUR: Export offers PDF and XLSX of the visible columns.
- DESIRED BEHAVIOUR: Add a third option "CSV" — raw rows, same column and filter state as the list.
- WHY: Two teams re-import the figures into their own sheets; PDF/XLSX need manual cleanup first.
- MUST NOT CHANGE: existing PDF/XLSX outputs, the column chooser, current filter behaviour.
- CORRECTION ROUND: 1
- VISUAL?: yes
- SCREENS & STATES TOUCHED: export menu only; error state if generation fails (others unaffected)
- STRINGS ADDED OR ALTERED: "CSV" menu item (new); everything else frozen
- PERMISSIONS: no — same roles as existing exports
