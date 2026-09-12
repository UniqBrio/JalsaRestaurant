# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Guest phone → menu screen → the category chip row under "PREFERRED MENU TYPE" (All 57 · Biryani 4 · Rice 2 · … · Combo 4 · Salads 1 · Desserts 3 · Drinks 3).
- CURRENT BEHAVIOUR: The categories are a single row of chips that scrolls sideways. Only three or four are on screen at once and the rest are found by swiping the row — which the requester's own screenshot shows mid-scroll, with "Combo / Salads / Desserts / Drinks" visible and everything before them off the left edge.
- DESIRED BEHAVIOUR: "Replace the horizontally scrolling menu-category chips with a more discoverable mobile-first category navigation. Keep Veg, Non-Veg and Egg as the primary food-type filters. Add a visible 'Categories' button that opens a compact bottom sheet/grid containing all menu categories at once: Biryani, Starters, Rice, Breads, Curries, Chinese, Combos, Salads, Desserts and Beverages. Selecting a category should immediately filter the menu and allow the customer to reopen Categories and switch categories without horizontal scrolling. Prioritize one-hand usability, fast discovery and minimal interaction. Keep the sticky Review Order bar at the bottom."
- WHY: Discovery. A category a guest cannot see is a category they do not order from (stated as "more discoverable", "fast discovery").
- MUST NOT CHANGE: stated by the requester — Veg / Non-Veg / Egg stay as the primary food-type filters, and the sticky Review Order bar stays at the bottom. Everything else not named in DESIRED BEHAVIOUR also stays: the search field, the dish rows, the counts, and what the filters actually select.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest menu screen — populated, "no matches", and the new sheet's own open state. The sheet inherits the existing sheet component's states. Loading / error / offline / permission-denied unaffected.
- STRINGS ADDED OR ALTERED: "Categories" (the requester's word, used as the button and the sheet title). The category names themselves are DATA, not strings this change writes. Everything else frozen.
- PERMISSIONS: no
- USAGE: the menu is the screen every guest spends longest on, with 57 dishes across 10 categories; one-hand use is stated.
- RUN MODE: auto
- SCALE: scoped

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
- The ten categories are LISTED in the request, and two of those names are not the ones this
  restaurant's menu data actually uses ("Combos" for the seeded `Combo`, "Beverages" for the
  seeded `Drinks`). The list is read as naming the CONTENT of the sheet — every category, all at
  once — not as an instruction to rename menu data. Recorded as stated; the sheet is built from
  the live category list so it cannot go stale when the owner adds one.
- Whether "All" remains an option in the sheet: not named. Kept, because removing it would leave
  a guest who has picked Biryani with no way back to the whole menu.
- Whether the sheet should also carry the Veg/Non-Veg/Egg filters: `unknown`. Read as no — the
  requester says those stay as the PRIMARY filters, which reads as staying where they are.
- This request supersedes the category-row half of `2026-09-12-guest-menu-sticky-filters.md`,
  written earlier in the same run: that one froze the scrolling row under the header, this one
  removes the scrolling row. The freeze stays and now holds a button instead, which costs less
  height — the concern that file recorded as `unknown`.
