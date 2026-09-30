# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: `While a round is being prepared, Jalsa offers the guest a small optional food-catching moment, themed by what they actually ordered, and ends it with one honest suggestion.`
- MUST-HAVE:
  - `Offered only after a round is placed and only while it is waiting. Gone the moment it is Ready or Served.`
  - `ONE engine, one food-theme configuration — veg / non-veg / egg / mixed — routed from the order's own food types. Never four implementations.`
  - `20–30 seconds, then stop. No auto-restart. Capped replay.`
  - `Touch, mouse and pointer. Never keyboard-only. Never hover-dependent.`
  - `Always skippable, never blocking status, ordering, the bill or payment.`
  - `Entirely client-side after the data the phone already holds: no dependency, no network during play, no server persistence, no analytics.`
  - `Ends with at most 1–2 suggestions drawn from real, available menu items.`
  - `prefers-reduced-motion gets a genuinely usable tap-based version, not a broken falling one.`
  - `No horizontal overflow at 320px; comfortable at 360 / 375 / 390 / 430 / 768 / 1024+.`
- EXPLICITLY OUT:
  - `Any game engine, animation framework, WebGL, 3D, canvas-heavy rendering, video, GIFs, sprite sheets, external assets or fonts.`
  - `Leaderboards, achievements, lives, login, multiplayer, gameplay analytics, server-side scores.`
  - `Auto-playing audio. Tracking infrastructure. Third-party anything.`
  - `Bill calculation, GST, discounts, payment, KOT creation, table or staff assignment, menu availability, order-status rules, table lifecycle, session identity.`
  - `E2E infrastructure. Framework-sync and root framework files.`
- WHY: `The waiting period is dead time that currently produces "where is my order?". A small food-themed moment fills it, builds a little craving, and earns one tasteful suggestion.`
- CORRECTION ROUND: `1`

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `Guest → order status only. New states: offer, playing, finished, skipped, and the reduced-motion variant. Existing loading, error, offline and empty states are untouched.`
- STRINGS ADDED OR ALTERED: `"Hungry while you wait?", "Catch Your Craving", "Maybe later", "Nice catch! 🍽️", "Complete your meal?", "Play again". Everything already on the screen is frozen.`
- PERMISSIONS: `no. Guest-side only, and it reads nothing the phone does not already hold.`
- USAGE: `Once per waiting round, for the guest who wants it. Most will ignore it, which is why it must cost nothing to ignore.`
- RUN MODE: `auto`
- SCALE: `scoped`

## A1 — WHAT ALREADY EXISTS (traced before any code, as the request required)

| The request asked me to find | What is there |
|---|---|
| The post-order status component | `GuestProgress.tsx` — `StatusScreen`, and `PlacedScreen` for the moment just after sending |
| Menu data already on the client | `GuestPayload.menu: GuestMenuItem[]` — **the whole menu is already in the browser**, each item carrying `id, name, price, priceLabel, foodType, category, available, inCart` |
| Food-type classification | `FoodType = 'veg' \| 'non_veg' \| 'egg'`, on every menu item AND every round item. No new classifier needed |
| Guest session / order state | `GuestApp` holds every cross-screen value and passes it through `shared: GuestScreenProps` — exactly where `showTotal` lives |
| Order status | `rounds[].status` plus `guestSteps()`, built earlier today |
| Design-system components to reuse | `Card`, `Button`, `Chip`, `Pill`, `SectionLabel`, `FoodMark` |
| An existing optional-feature mechanism | **`src/lib/guest-features.ts`** — 23 owner-controlled switches with defaults, rendered from the data-driven `FEATURE_GROUPS` list in the owner's "What the customer sees" panel |

**Consequences that shape the build, and they are large:**

1. **No new assets and no new network.** The falling food can be the restaurant's OWN menu items,
   by name, filtered by `foodType` — and so can the closing suggestion. The request's "use
   existing loaded menu/product information where possible" is not a compromise here; it is
   strictly better, because the guest sees food Jalsa actually serves at the price it charges.
2. **The feature flag has a home.** An optional guest feature that was NOT in `guest-features.ts`
   would be a second mechanism for the same concern, which this repository calls a defect. One
   row in `FEATURE_GROUPS` gives the owner a switch, and costs no migration — `customerFeatures`
   is a keyed settings document.
3. **Reduced motion is not a nicety, it is load-bearing.** `tokens.generated.css` already forces
   `animation-duration: 1ms !important` under `prefers-reduced-motion`. A CSS-falling game would
   not merely be less animated there — every item would hit the plate instantly and the thing
   would be unplayable. The tap-based variant has to be a real branch, chosen in JavaScript from
   `matchMedia`, not a CSS fallback.

## THE ANIMATION APPROACH, DECIDED BEFORE BUILDING

CSS keyframes move each item; `animationend` is the hit test. No `requestAnimationFrame` loop, no
per-frame JavaScript, no canvas — the compositor does the motion and the only JavaScript that runs
per item is one comparison when it lands. One spawn interval and one end timeout, both cleaned up
on unmount and on finish. One pointer listener on the play area, none on `document`.

## STANDING INSTRUCTIONS (do not edit)
- Track A runs its four gates. Auto mode logs each checkpoint rather than waiting.
- Stated fields are binding. EXPLICITLY OUT seeds the "deliberately not building" list.
- If VISUAL?=yes, the design pass covers states, both themes in semantic tokens, the string
  table and the permission answer.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.
