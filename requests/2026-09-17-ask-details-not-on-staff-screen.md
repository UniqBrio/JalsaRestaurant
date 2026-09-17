# BUG REQUEST — something is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->
<!-- Root cause comes before any fix - always. Stated fields are BINDING; "unknown" is honest. -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHERE: guest "Ask for something" sheet (`/t/A5` → ⋯) → **Staff → Requests**. Stated verbatim:
  `"For all requests from 'Ask for something' screen, the information is not passed to staff screen."`
- WHAT HAPPENS: `"I clicked on 'Need water' from customer screen and the same is not showing up
  correct in 'Staff' screen(Table A5 No note · waiting)."` The row reads exactly
  **`Table A5` / `No note · waiting`**.
- WHAT SHOULD HAPPEN: the information the guest sent reaches the staff screen. The requester did
  not enumerate which fields — see the root-cause section for what is provably being dropped.
- WHEN IT STARTED: unknown.
- WHO IS AFFECTED: stated with its selectivity — **all** requests from the "Ask for something"
  screen, not a subset. Staff on the Requests tab. The screenshots show Need water; the same
  sheet raises Water bottle, Call captain, Extra plates / cutlery, Parcel what is left and
  Ask for the bill.
- REPRO STEPS: 1) `/t/A5` → ⋯ → Ask for something 2) tap **Need water** 3) Staff → Requests
- WAS WORKING BEFORE?: unknown
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
Three separate drops, all downstream of a guest tap that worked:

1. **The note is never sent.** `GuestSheets.tsx:108` calls `ask(a.label)` — label only. Every
   action in that list has a `note` ("Someone fills your jug", "A sealed bottle, added to the
   bill", "Plates, spoons or a serving spoon"), and none of them is passed. `ask` accepts one
   (`GuestSheets.tsx:64`) and `/api/guest/ask` stores one, so the sole call site that passes a
   note is "Call captain" from the crew sheet at line 420. That is why the row says **No note** —
   for every action on the sheet, every time.
2. **The staff payload drops two fields the query already fetched.** `listOpenRequests`
   (`queries.ts:492`) selects the bill code and the captain's name. `staff-view.ts:220-227`
   builds the staff `requests` array out of id, kind, note, tableName, ageMinutes and urgent —
   `billCode` and `captain` are read from the database and then thrown away before they reach a
   screen.
3. **The staff row shows less than the owner's row of the same record.** The owner's dashboard
   (`Dashboard.tsx:132-138`) renders `Table A5 · Need water — <note> · <captain> · 0 min`. The
   staff row (`StaffLists.tsx:233-237`) renders `Table A5` / `No note · waiting`, with the kind
   only as a group heading above it. The floor — the surface the sheet promises, "the floor sees
   these the moment you tap" — sees strictly less than the console.

The same staff tab shows KOT cards as `Table A5 · B-1046 · Imran · guest phone`. A request for
the same table, at the same moment, shows `Table A5` and nothing else.

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
