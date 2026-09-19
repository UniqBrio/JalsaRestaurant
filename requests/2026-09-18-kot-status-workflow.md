# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: `Every KOT round carries a status the captain moves with three taps, and the guest's phone shows where their food has got to without anyone being asked.`
- MUST-HAVE:
  - `Captain/waiter can move a round Placed → Preparing → Ready → Served, contextually, from where they already manage KOTs.`
  - `Impossible transitions are not offered AND are refused by the server.`
  - `The guest sees each round's status as the reference design's timeline/stepper, updating through the existing polling idiom with no manual refresh.`
  - `Status belongs to the individual round. Updating KOT-102 never touches KOT-101 or KOT-103.`
  - `The guest can never mutate status; ordering another round and requesting payment stay available.`
  - `Status is persisted server-side, never only in React state. History is kept, never deleted.`
- EXPLICITLY OUT:
  - `Any kitchen-management system, kitchen display, or new operational workflow.`
  - `Browser, push or WhatsApp notifications.`
  - `Extra statuses — Accepted, Confirmed, Cooking started, Packed, Dispatched.`
  - `Redesigning the Staff page or the guest surface; changing the design system.`
  - `Broadening unrelated staff permissions. Framework-sync and root framework files.`
- WHY: `To cut "Where is my order?" interruptions and give the guest a reason to keep the app open.`
- CORRECTION ROUND: `1`

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `Guest → order status (per round). Staff → table detail (the contextual control). States: the four status steps; the empty "nothing ordered yet" state already exists and is untouched.`
- STRINGS ADDED OR ALTERED: `Captain: "Start preparing", "Mark ready". ("Mark served" already ships.) Guest step labels come from the reference image — see the DECISIONS block.`
- PERMISSIONS: `no new permission. 'orders.status' already exists, is already in the Captain, Waiter and Chef presets, and already gates advanceKot.`
- USAGE: `Every round of every meal. The captain taps three times per round; the guest reads it repeatedly while waiting.`
- RUN MODE: `auto`
- SCALE: `scoped` — the investigation below reduced this from full-scale: no migration, no new API, no new permission.

## A1 — WHAT ALREADY EXISTS (traced before any change, as §8 and §16 required)

**Almost all of it.** The honest finding is that this feature is three quarters built and has one
missing link.

| §8 asked for | What is already there |
|---|---|
| KOT/order-round table | `public.kot` — `status public.kot_status not null default 'new'` |
| Existing status field | **yes**, and the enum already holds every state: `('new','preparing','ready','picked_up','served','cancelled')` |
| Audit/history fields | **yes** — `started_at`, `ready_at`, `picked_up_at`, `served_at`, `cancelled_at` on the row |
| Bill / table relationship | `kot.bill_id`, `kot.table_id` — status is already per-round, never per-table or per-bill |
| Captain permission | `orders.status` — already defined, already in the Captain / Waiter / Chef presets |
| The write path | `advanceKot()` in `mutations.ts` — already calls `demand(actor,'orders.status')`, already stamps the timestamp, already writes an `audit({ action: 'Status', … })` row with actor, bill and table |
| Guest state API | `buildGuestPayload` already ships `rounds[].status`, `.statusWord` (guest wording) and `.tone` |
| Polling/realtime | `useLiveData` — the one blessed idiom, already driving the guest screen |

**So §9 (permissions), §10 (audit) and §8 (server-side persistence) are already satisfied, and
no migration is required.**

### The actual limitation — one missing link, and two defects behind it

1. **Nothing can move a round out of `new`.** `advance-kot` has exactly two call sites, and both
   act only on rounds that are *already* `ready` or `picked_up`
   (`StaffLists.tsx:83`, `StaffTables.tsx:346`). A guest-placed round therefore sits at `new` for
   the whole meal and the guest's pill reads its `new` wording until the plates are cleared.
   The states exist; the *operation* does not.
2. **`advanceKot` validates no transition.** It writes whatever `to` it is handed, so a served
   round can be sent back to preparing, and two captains racing can land any final state
   (§14.6 and §14.8 are both unmet).
3. **A comment that is not true.** `mutations.ts:485` says *"Stamped only on the FIRST transition
   into a state. A re-tap must not rewrite the minute the kitchen actually finished, because that
   minute is what the timings report reads."* The code stamps unconditionally. The timings report
   is reading a minute that a second tap can overwrite.

### The guest side

`GuestProgress.tsx` already lists every round with its code, time, items and a status `Pill`.
What the reference image adds is the **stepper/timeline** in place of the bare pill. The data it
needs is already on the payload.

## DECISIONS TAKEN AT INTAKE (the requester was asked; these are their answers, and binding)

1. **Wording follows the reference image**, not §1's prose, because CLAUDE.md makes the design set
   the specification: **"Order received" · "In the kitchen" · "Ready" · "Served"**. This changes
   exactly one shipped string — `KOT_STATUS.new.guest`, from "Sent to the kitchen" to "Order
   received" — in the single vocabulary module, so every guest surface follows. §1's "Being
   prepared" and "Order ready" are deliberately NOT used; they would contradict both the image
   and the shipped words.
2. **`picked_up` stays in the enum and out of the new flow.** The three captain actions are Start
   preparing / Mark ready / Mark served. The counter-pickup button that ships today in
   `StaffLists` keeps working untouched, and the guest stepper renders `picked_up` as still
   within the **Ready** step. No destructive migration, no shipped behaviour removed.

## STANDING INSTRUCTIONS (do not edit)
- Track A runs its four gates. Auto mode logs each checkpoint rather than waiting.
- Stated fields are binding. EXPLICITLY OUT seeds the "deliberately not building" list.
- If VISUAL?=yes, the design pass covers states, both themes in semantic tokens, the string
  table and the permission answer.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.
