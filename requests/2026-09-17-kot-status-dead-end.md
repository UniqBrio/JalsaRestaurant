# BUG REQUEST — something is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->
<!-- Root cause comes before any fix - always. Stated fields are BINDING; "unknown" is honest. -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHERE: the KOT status lifecycle, seen on the guest's "Your order" screen (`/t/A5`) and on the
  captain's Tables / Ready screens. Rounds placed from the guest's phone AND from the captain's
  screen are both affected, as stated.
- WHAT HAPPENS: `"Once order is made from customer screen or from the captain's screen, it will never change the status of the same."` Every round sits at **"Sent to the kitchen"** permanently. Screenshot: KOT-118 and KOT-119, both 3:54 pm, both "Sent to the kitchen".
- WHAT SHOULD HAPPEN: as stated — `"Enable a button to mark it as 'Order ready/received'. So that it is either already served or order is on the way. so that, it is clear that the order is served."` And: `"When 'Request payment' button is clicked, mark all items as served."`
- WHEN IT STARTED: unknown — no start date given. The dead end is structural rather than a regression (see below), so it is likely to have been true since the status vocabulary shipped.
- WHO IS AFFECTED: both order sources, stated verbatim: "from customer screen or from the captain's screen". Every round, not a subset. Guest-facing and staff-facing.
- REPRO STEPS: 1) Place a round from `/t/A5` or from the captain's screen 2) Look at the round on either surface 3) It reads "Sent to the kitchen" and no control anywhere changes it
- WAS WORKING BEFORE?: unknown
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
Recorded because it changes the classification from CHANGE to BUG — the application promises a
lifecycle it cannot perform.

- `KOT_STATUS` declares six states: `new` → `preparing` → `ready` → `picked_up` → `served`
  (+ `cancelled`), each with a separate guest word and staff word.
- Every UI path that advances a round requires it to ALREADY be `ready` or `picked_up`:
  - `StaffLists.tsx:83` — the "Ready to run / collect" list, fed by
    `staff-view.ts:194` → `filter(k => k.status === 'ready' || k.status === 'picked_up')`
  - `StaffTables.tsx:346` — "Mark served", gated on the same two states
- **Nothing anywhere moves a round off `new`.** `new → preparing → ready` has no control on any
  surface. The design set puts the kitchen on paper ("Kitchen — No screen. Paper tickets from
  three printers"), so the intended advancer was a kitchen display that was deliberately not
  built, and no replacement was added.
- Consequence: a round never reaches `ready`, so it never enters the "Ready" list, so it can
  never be served either. The dead end is at step one and closes every step after it.
- Downstream features that depend on `served` are therefore unreachable: the heart/favourite
  ("the heart unlocks on SERVED and nothing earlier"), the parcel offer that follows it, and
  `served_at`, which the timings report reads.

## OPEN QUESTION CARRIED TO THE GATE (not decided at intake)
"Mark all items as served when the guest taps Request payment" makes a GUEST write a service
record. `served_at` is what the timings report reads, and the heart unlocks on it — the design
calls that moment "the one moment somebody confirmed the food is on the table". Guardrail 2's
principle is adjacent: a guest raises a request; a named member of staff records the fact.
The requester's intent is clear and reasonable; how the record is attributed is the open
question. See the gate.

## STANDING INSTRUCTIONS (do not edit)
- Track C order is binding: search `docs/registers/ROOT_CAUSE_REGISTER.md` for the same class;
  state the ROOT CAUSE, distinct from the symptom, BEFORE any fix; reproduce with a failing
  test, fix at the root, make it pass; if the cause is a pattern, sweep EVERY sibling site;
  append the root-cause entry; then the test gate.
- WHO IS AFFECTED is evidence — a fix whose mechanism does not explain the stated selectivity
  has not found the root cause.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why. A recurring "fixed" bug is a process finding — flag `/framework-update`.
- Data-store-level cause → STOP, propose the change, wait for approval. Production is never
  touched automatically.
