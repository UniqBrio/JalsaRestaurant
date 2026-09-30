# Request — four screenshots: "Fix all issues reported under images" (30-Sep-2026)

**TYPE** triage → one enhancement, three already-closed defects · **RUN MODE** auto · **SCALE** scoped

## THE FOUR ITEMS (verbatim captions)
1. "Coming due to my favorite menu – Add + icon to type and add new" — guest `/t/A5`, the
   *How did you hear about us?* picker open on its four answers.
2. "Reissue pin is failing" — owner Staff, toast *Something on our side failed. Nothing you did was
   lost — try again.*
3. "After the queue guest is called, once the table is assigned, it is not assigning a table." —
   owner Waitlist, *Seat W-2* sheet; the floor shows every other table Free.
4. "When someone scanned when the queue is closed, let the message be shown".

## WHEN THE SCREENSHOTS WERE TAKEN — established from the data, not assumed
Read-only queries against `yxgxmbyilpivbmeemqkp` (the project the deployment writes to; nothing
was written):
- Item 3 shows B-1044 open on N4 (Ramesh) and B-1047 open on N3 (Shabbir). B-1044 was open
  17-Sep 11:47 → 23-Sep 08:00 UTC; B-1047 opened 19-Sep 08:23 UTC. Shabbir was removed
  19-Sep 12:14 UTC and Ramesh 26-Sep.
- The *Seat W-2* sheet: W-2 joined 19-Sep 12:28 UTC and was never seated; W-1 was "seated" at
  12:29:50 UTC with `seated_table_id` stamped and **no bill** — the exact F2 defect.
- The times on screen (11:47 am, 8:23 am, 12:28 pm) are those UTC times, so the screenshots were
  taken on **19-Sep-2026, ≈12:28–12:30 UTC**, before the 24-Sep fixes below.

## DISPOSITION
| # | Status on `main` | Evidence |
|---|---|---|
| 1 | **Open — fixed in this change.** The picker could always take a new answer, but only after typing; nothing said so. | `tests/unit/combobox-add-plus.unit.spec.ts` (fail-first: 11 of 11 failed pre-fix) and a browser check, both themes |
| 2 | Closed 24-Sep (list F1, commit da8d447): `issuePin` names `p_provisional`, and the narrow `set_staff_pin(uuid,text)` is dropped by 20260917120000, **applied on the live project 25-Sep**. | Live schema has exactly `set_staff_pin(uuid,text,boolean)`. Live audit: *A new sign-in PIN was issued to Javeed Ahmed* at 26-Sep 03:44 and 03:49 UTC — Reissue PIN succeeding in production. `tests/unit/pin-and-attribution.unit.spec.ts`, `function-overloads.unit.spec.ts` pass. |
| 3 | Closed 24-Sep (list F2, commit 77b8140): seating opens the table's bill through `ensureOpenBill(…, { mustBeNew: true })`, after the table checks and the queue-row claim. | `tests/unit/queue-seat-and-closed.unit.spec.ts` passes. No party has been seated live since 19-Sep, so there is no live record of the fixed path yet. |
| 4 | Closed 24-Sep (list F3): `/q` renders *We have stopped taking the queue* on the scan itself; a table code with no bill renders the `NEW_TABLES_CLOSED` screen; a Join tapped after closing swaps to the closed screen. | `queue-seat-and-closed.unit.spec.ts`, `indoor-queue.unit.spec.ts` pass. |

## ITEM 1 — WHAT CHANGED
The shared `Combobox` (every data-entry picker: guest heard-about, menu category, food type,
expense category, printer station, default station) now shows, **only where it can create**:
- a **+** button in the box, beside the chevron, while the box is empty or the list is open —
  with nothing typed it opens the list with the cursor in the box; with something new typed it
  adds it. A closed box holding a choice has no **+**, so a narrow box keeps its width for the choice;
- a hint under the list before anything is typed: **⊕ Not listed? Type the name to add it.**
  (guest: **⊕ Not listed? Type your own answer.**), which the input is described by;
- the existing **⊕ Add "…"** row, unchanged.

Search-only pickers (printer route, staff reassign) are unchanged — no **+**, no hint.

Found in review and fixed in the same change: pressing the box, the **+** or the chevron while the
list was open dismissed it and threw away what had been typed (Radix counts the Anchor as
outside). Tapping the box mid-typing no longer empties it, and the chevron now closes the list.

## VISIBLE STRINGS (new)
`Add a new one` (the + button's accessible name) · `Not listed? Type the name to add it.` ·
`Not listed? Type your own answer.` (guest).

## THE FIVE PERMISSION QUESTIONS
No permission changes. The component offers creation exactly where it already did
(`allowCreate && onCreate`); every create still goes through the caller's own server route.
