# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: the guest's **"Share the Love"** tab on the "One last thing?" upsell
  (`UpsellScreen`, guest screen 9) → the **Staff** screen that receives the round.
- CURRENT BEHAVIOUR: a Share-the-Love item is added through the ordinary path —
  `/api/guest/cart` then `/api/guest/round` (`GuestClosure.tsx`, `add`) — exactly as a dish
  ordered from the menu. The "Packed for home" pill the guest sees comes from `packed: true` on
  the tab spec, which is **presentational only and is never written down**. The KOT that reaches
  staff reads `Chicken Biryani ×1`, indistinguishable from a dine-in round.
- DESIRED BEHAVIOUR: as stated — `Anything added from this screen(share the love), mark it as
  "Take away" in Staff screen.`
- WHY: unknown as stated, but the consequence is visible: the kitchen and the floor cannot tell
  food that must be packed from food that goes to the table.
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Named explicitly because they are
  adjacent and easy to disturb: the Desserts and Beverages tabs (same `add`, not takeaway), the
  separate parcel offer on the Paid screen ("billed separately as a takeaway"), the `takeaway`
  owner switch that gates the tab, and the bill arithmetic — this marks a round, it does not
  re-price it.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the staff KOT card, and any staff surface that lists round items.
  Loaded state only; a marker on a round changes no empty, error or offline state.
- STRINGS ADDED OR ALTERED: `Take away` — the requester's exact words. **Where it sits (a Pill on
  the KOT card, a per-item suffix, or both) is `unknown`.** Note for the track: the shipped
  vocabulary for this is already split three ways — the guest reads **"Packed for home"**, the
  Paid screen reads **"billed separately as a takeaway"**, and the owner's report column is
  **"Parcels"**. The freeze rule makes choosing between them a decision, not a detail.
- PERMISSIONS: no.
- USAGE: unknown — the tab only appears where the owner's `takeaway` switch is on.
- RUN MODE: auto
- SCALE: unknown — **not micro.** Nothing in the database records that a round item is a
  takeaway, so this needs a migration, and a migration disqualifies micro by itself.

## OPEN QUESTION CARRIED TO THE GATE (not decided at intake)
**What is marked — the round, or the item?** A guest can add a dessert and a Share-the-Love
parcel to the same bill, and the upsell's `add` places each addition as its own round, so a
round-level flag happens to work today. It would stop working the moment two additions were ever
batched. An item-level flag is the one that stays true. Intake will not choose a schema.

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
