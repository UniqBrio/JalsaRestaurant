# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Guest phone → menu screen, the search-and-filter block above the dish list: the "Search the menu" field, the "PREFERRED MENU TYPE" chips (Veg 26 / Non-veg 28 / Egg 3) and the category chip row under them ("All 57, Biryani 4, Rice 2, Non-Veg Starters…").
- CURRENT BEHAVIOUR: The whole block scrolls away with the list. Once a guest is a screen or two into 57 dishes, searching or changing the filter means scrolling all the way back up.
- DESIRED BEHAVIOUR: "Even while scrolling down, the user should see this - Freeze this section so that they can search or filter quickly (on scroll down, you don't show next sub filters row 'All 57 Biryani 4 Rice 2 Non-Veg Starters')."
- WHY: So a guest can search or filter quickly from anywhere in the list (stated).
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. The dish list itself, the filter and search behaviour, the counts on the chips, and the bottom action bar all stay exactly as they are — this is about where the block SITS while scrolling, not what it does.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest menu screen only — populated state and the "no matches" state (the block must stay reachable there too, since clearing the filter is the way out of it). Loading / error / offline / permission-denied unaffected.
- STRINGS ADDED OR ALTERED: none — this is placement only.
- PERMISSIONS: no
- USAGE: the menu is the screen every guest spends the longest on; the requester's own words tie the ask to a 57-item list.
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
- Exactly how much of the block is frozen. The parenthesis names the CATEGORY row as the part
  that disappears, and the screenshot frames search + diet chips. Read as: the whole block
  freezes, category row included. Recorded as stated, resolved in the open at B4.
- A phone screen is short. Freezing search + two chip rows costs roughly a third of it, so
  whether the block should COMPACT once it is stuck (rather than freeze at full height) is
  `unknown` — the requester asked for reachability, not for height.
