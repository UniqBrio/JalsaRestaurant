# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Guest phone — the menu screen's bottom bar ("Review order · 7 items · ₹1,351 before tax") and the order-review screen; owner console → Settings → "What the customer sees".
- CURRENT BEHAVIOUR: The guest's order total is always on screen. The menu bottom bar carries `N items · ₹1,351 before tax`; the review screen carries a "This round / Already ordered" card and a `Send to the kitchen · ₹1,351` button. The owner has no switch for any of it.
- DESIRED BEHAVIOUR: "Enable a checkbox at the bottom left to show price(Total only). By default, disable it, let the customer click on it to see it. The default setting can be done in Settings screen by the owner to show/hide total order value(without GST)."
- WHY: unknown
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Named explicitly by the requester as still in scope of "total only": the per-item prices (`₹190 each`, the line amounts) are a different thing from the total and were not asked to be hidden.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest menu screen (cart-populated state — the bottom bar only appears with items in the cart); guest order-review screen (populated state; the empty state has no total); owner Settings → features panel. Loading / error / offline / permission-denied unaffected.
- STRINGS ADDED OR ALTERED: one new guest-facing checkbox label and one new owner Settings toggle label — the requester gave no wording, so both are `unknown` and drafted in the design's own idiom. Every other string on these screens is frozen.
- PERMISSIONS: no — the owner toggle sits inside the existing `set.features` panel, which already gates who may change it.
- USAGE: unknown
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
- Which screens the checkbox governs. The requester's screenshot is the MENU bottom bar; the
  ask says "total order value". Whether the payment screens (where the guest is asked to pay a
  number) are included is `unknown`.
- Whether the guest's choice survives a reload, and whether it is per-phone or per-bill: `unknown`.
- Whether the owner's setting is a DEFAULT the guest may override, or a hard hide: the words
  "The default setting can be done in Settings screen" read as a default, but this is the one
  field where a wrong reading changes what ships, so it is recorded here as stated, not resolved.
