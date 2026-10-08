# Request — takeaway photo, and cancelling an order the kitchen already has (07-Oct-2026)

**TYPE** feature ×2 + defect ×2 (found on the way) · **RUN MODE** auto · **SCALE** scoped · **PRODUCTION** not touched, not deployed

## THE ASK (the owner's words, condensed)
1. **Upload Image** on a takeaway order: gallery or camera, preview, replace, remove; loading, failure and
   success feedback; the existing storage; never public; validated on the phone and the server; never
   trust an order id or a path from the screen; audited if that fits.
2. **Cancel an order that is already being processed and free its table** — never by deleting it.
   Only where it makes sense; the existing permission model, enforced on the server; the requested
   confirmation wording and reasons; order and table change together; everything about the order kept;
   cancelled orders visible in reports and never in revenue or GST; audited; safe when two people act
   at once or the table has a new party; the kitchen stops treating it as live; the floor updates.

## HOW JALSA REPRESENTS IT (established before code)
| | |
|---|---|
| Order | `bill` (`open` → `payment_requested` → `closed`, or `void`). Rounds are `kot`, lines `kot_item` (price, name, food type snapshotted). |
| Table | Not stored: derived from `bill_table` (`released_at`, `cleared_at`); a partial unique index allows one live bill per table. `release_tables_on_close()` fires only on `closed`. |
| KOT / kitchen | `kot.status` already has `cancelled` (+ `cancelled_at`, `cancel_reason`) — never set by any code until now. Kitchen and floor screens show `new/preparing/ready`. Printing: `print_job` (`queued` → the bridge claims it). |
| Payment | `closeBill` (named person, mode, amount — `bill_closure_is_attributed`). |
| Reports | Built from `listClosedBillsBetween` — `status = 'closed'` only, so a void bill was already outside revenue, GST, payment mix and dishes. |
| Audit | `audit_entry` (action, detail text, bill, table, actor id and label). No structured metadata column: the detail carries before → after. |
| Sync | Change-version polling; every bill change moves the bill's version and the `floor` counter, and a write answers with the new screen. |
| Media | Private `media` bucket (PNG/JPEG, 1 MB), served by `/api/media/...` — public by design for dish photos and the logo. |
| "Mark free" | `freeTable` — `tables.free`, refuses once a round exists, voids an empty bill. Not transactional. Left unchanged. |

## DECISIONS
- **One transaction in the database** (`cancel_bill_and_free`, migration `20261007090000`): voids the bill
  with who/when/why/from-what/for-how-much on the row, cancels rounds still in the kitchen, cancels tickets
  still waiting to print, releases **and clears** the tables (free at once), lets the phones go, closes the
  payment notices, writes the audit row. Under the bill's row lock, it refuses (and changes nothing) when
  the bill is no longer open/asked-to-pay (`gone`), moved since read (`changed`, via `bill.version`), or not
  on the tapped table (`not_here`). Concurrency A/B/C and the double tap all land on one of these.
- **Grants:** `tables.free` **and** `orders.cancel_after` (the order is already being processed). No new
  permission. Owner holds both; anyone else only if the owner grants both.
- **Separate from Mark free:** offered exactly where Mark free is not (a table with rounds); Mark free is
  unchanged.
- **Amount recorded:** what the order came to (food after discount, GST, packaging), never the tip.
  Shown in a "Cancelled orders" table under Reports → All orders; never summed anywhere.
- **Reason:** optional (recorded as "No reason given"); "Other" needs a few words (≤200 chars).
- **KOT printing:** no cancellation slip is printed — there is no cancel-ticket template in the ESC/POS
  path, and building one is a new printer workflow. A ticket not yet printed is cancelled so it never
  comes out; the kitchen's screens drop the cancelled rounds on the next poll. Recommended follow-up:
  a "CANCELLED" KOT slip through `queuePrint`, once its template is designed.
- **Photo:** same bucket under `takeaway/<bill>/<uuid>`; `bill.photo_url` (takeaway only, by constraint);
  `orders.create` to change it while running; `orders.view` to see it; the media route answers takeaway
  keys only to a signed-in staff/owner session and only for the bill's *current* photo, `private, no-store`.
  The phone redraws a large photo as a JPEG ≤ 1 MB; the server still checks the bytes.
- **Found and fixed on the way:** `closeBill` would have closed a void bill (`.neq('status','closed')`) and
  `requestPayment` would have put one back in the payment queue; both now refuse it. The owner console
  labelled a void bill "Open".

## THE FIVE PERMISSION QUESTIONS
1. **Who can do it?** Cancel & free: holders of `tables.free` + `orders.cancel_after` (Owner by default).
   Photo: `orders.create` to change, `orders.view` to see. No guest path to either.
2. **What changes when a grant is off?** The button is not offered and the server refuses (403) before
   any read.
3. **Can it reach another party's data?** No: the bill is read scoped to the restaurant, the function
   checks the bill is on the tapped table, the photo key is made by the server, and the media route checks
   the bill's current photo for this restaurant.
4. **What does the database enforce?** `bill_cancel_is_attributed` (a cancellation is void and names a
   person and a reason), `bill_photo_is_takeaway`, the function's EXECUTE granted to `service_role` only,
   RLS unchanged.
5. **Where is it recorded?** `docs/registers/RBAC_MATRIX.md` (three rows, 07-Oct-2026); the audit log
   ("Order cancelled"; "Bill … takeaway photo added/replaced/removed").

## REVIEW (07-Oct-2026: code, permission and copy reviewers) - what changed
- **Tip:** an uncollected tip on a cancelled order left in the tips ledger could be settled out of the
  drawer. The function now removes unsettled tips for the bill and records the amount in the audit line.
- **Races:** a round, a joined table or a ticket written after its route read the bill could land on a
  cancelled one (a ticket printing for food nobody wants; a table held by a void bill nothing can
  release). Three BEFORE triggers now refuse a `kot` or `bill_table` insert unless the bill is live
  (taking a share lock, so they wait for a cancellation in progress), and refuse queuing any ticket
  for a void bill (retry, reprint, print elsewhere). Failed tickets are cancelled with the waiting ones.
- **What the person saw:** the version check only covered the server's own read. The dialog now sends
  the round count the tile showed; a round sent since is 'changed'. Rounds, not the version, because a
  ticket printing moves the version every few seconds.
- **Payment request race:** `requestPayment` now checks its conditional write matched a row before
  raising notices and the audit line.
- **Rule 5 at the door:** both action routes now refuse an issued (provisional) PIN with 403 - before,
  only the pages did, so any action (this one included) was reachable through the API.
- **Smaller:** the audit reads "payment requested -> void"; the owner console's void label is the
  canonical `BILL_STATUS.void` ("Void"); the photo key is built from the database's bill id; the photo
  picker resets per order; a photo that cannot be redrawn says what to do; em-dashes match neighbours.
- **Tests:** the media route and the provisional refusal are now called for real (round rig), and the
  cross-restaurant case uses a real second restaurant.

## COPY CANDIDATES (shipped strings - not changed without the owner)
- Mark free's sheet ("…that is a payment or a void, not a floor operation") and `freeTable`'s refusal
  ("Record the payment or void the bill…") now name the wrong next step for a table with food: there is
  a floor action for it. Suggested: "…use Cancel order & free table, or record the payment."
- Kept as the owner asked, recorded as exceptions: "Are you sure you want to continue?" (ConfirmDialog
  standard says never ask that); "completed" for what the app calls Closed/Paid; "Cancel" beside
  "Cancel Order & Free Table".
- "Packaging charges" vs "Packaging Charges" casing differs across screens (pre-existing).

## NOT DONE / OPEN
- **Migration not applied anywhere.** `20261007090000_jalsa_order_cancel_and_takeaway_photo.sql` must
  reach an environment **before** this code: the bill read now selects `photo_url`, so every screen that
  reads a bill fails on a database without it. Proven on PGlite from scratch (`order-cancel.db.unit.spec.ts`).
- Production: nothing applied or deployed.
- No cancellation slip is printed (see KOT printing above).
- Takeaway orders cannot be cancelled with this action (it is a table action); their existing route is
  unchanged.
- A guest phone at the table after a cancellation lands on a fresh welcome (its session is let go, as
  Mark free does) - it says nothing about the cancellation.
- The gate's functional tier (G8) is red in this container for the four specs that need a reachable,
  seeded database (no database here; CI runs only the degraded spec for the same reason). Everything
  else is green.

## FOLLOW-UP (08-Oct-2026) - captain's floor: action buttons drawn over other tiles
Seen in production right after deploy (owner's screenshot): on the captain's floor, "Cancel order &
free table" under A1 was hidden behind A5, A2's fell into the empty slot, A5's lay across the legend.
**Root cause:** each floor tile was `h-full` inside its grid cell, so the tile took the cell's whole
height and any button after it spilled out of the cell. Not new - "Mark free" has the same structure -
but tables with rounds are the common case, so the new button made it visible at once. The owner's
Dashboard floor does not use `h-full` and was not affected.
**Fix:** the cell is a column (`flex flex-col gap-1`), the tile `flex-1`; buttons sit under their
own tile. `StaffTables.tsx` only.
**Rung:** `tests/render/staff-floor-actions.render.spec.ts` mounts the real FloorScreen with the
screenshot's floor and asserts every button is under its own tile and over no other tile, button or
the legend (390 px light/dark, 608 px). Observed failing before the fix ("staff-cancel-order-A1
overlaps tile A5"), passing after.
