# Request — move a running order to another table (12-Oct-2026)

**TYPE** feature · **RUN MODE** auto · **SCALE** scoped · **PRODUCTION** not touched, not deployed ·
**MIGRATION** `20261012090000_jalsa_move_order_to_table` — applied nowhere yet

## THE ASK (the owner's words)
"Add customer table changed as another option — give table migration option. From A1 table, customer
wants to sit in A2 — migrate all orders to A2."

## DECISIONS (the owner's, 12-Oct-2026)
- **Free tables only.** The destination must have no order, nothing waiting to be cleared, and no phone
  holding an unsent order. Combining two live bills is not this action (joining tables already refuses it).
- **Owner and captains.** The existing grant `tables.transfer` ("Move a bill to another table", defined
  since the first permission set and never used until now). Added to the Captain preset; the migration
  grants it to every existing Captain (added, never replacing a grant the owner set by hand).
- **The kitchen is told by its screens** ("you decide" — senior call): rounds still to come say the new
  table on every kitchen and runner screen, and a ticket still waiting to print comes out with the new
  table (tickets are composed from the round when a printer claims them). No extra slip is printed —
  there is no ticket template for one, the same call as cancelling an order.

## WHAT A MOVE DOES (`move_bill_to_table`, one transaction)
- The bill's live table becomes the new one; the old table is released and shows **Needs clearing**
  (plates are usually left behind). A row the bill once had on the destination is reused.
- Rounds new / preparing / ready / picked up go to the new table; served and cancelled rounds stay
  where they happened.
- The party's phones move with it and remember where they came from: a phone still showing the old
  table's page is sent to the new table's page (server redirect on load, client redirect on the next
  poll). A phone a guest carries to another table themselves still starts fresh, as before.
- Open requests from the old table for this bill follow it; the bill's host table becomes the new one.
- One audit row: "B-0412 moved from A1 to A2 - 1 round still to come now go to A2".
- Refused in words, changing nothing: already paid or cancelled; the tapped table no longer holds it;
  same table; destination off the floor, taken, needing clearing, or with a phone's unsent order.

## FOUND ON THE WAY (fixed)
- `lastClosedOnTable` returned the latest released row for a table. After a move, once the moved party
  paid at A2, the next guest scanning A1 within the rescan window would have been shown that party's
  receipt. It now counts only a bill closed while on that table.
- The guest page reads the new column with a fallback: merging deploys the code before the migration is
  applied by hand, and without it every guest page would fail in that gap.

## THE FIVE PERMISSION QUESTIONS
1. **Who can do it?** Holders of `tables.transfer`: every owner (since setup) and every captain (preset +
   this migration). Waiters, chefs and cashiers only if the owner grants it by name.
2. **What changes when the grant is off?** No Move button; the server refuses (403) before any read.
3. **Can it reach another party's data?** No: the bill and both tables are read and locked scoped to the
   restaurant; the destination must be free, so no other party's phone is on it (an unsent cart there
   refuses the move); a moved phone is redirected only while its own order is running.
4. **What does the database enforce?** The one-open-bill-per-table index, the row locks, the dead-bill
   triggers (20261007090000), EXECUTE for service_role only; RLS unchanged.
5. **Where is it recorded?** `docs/registers/RBAC_MATRIX.md` (12-Oct-2026 rows); the audit log ("Table moved").

## EVIDENCE
`tests/unit/table-move.db.unit.spec.ts` (8, PGlite), `tests/unit/table-move.unit.spec.ts` (14, real
mutation, both routes, guest context), `tests/render/table-move.render.spec.ts` (5, real captain floor).
Results in `TEST_SUMMARY.md`.
