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

## NOT DONE / OPEN
- **Migration not applied anywhere.** `20261007090000_jalsa_order_cancel_and_takeaway_photo.sql` must
  reach an environment **before** this code: the bill read now selects `photo_url`, so every screen that
  reads a bill fails on a database without it. Proven on PGlite from scratch (`order-cancel.db.unit.spec.ts`).
- Production: nothing applied or deployed.
- No cancellation slip is printed (see KOT printing above).
- Takeaway orders cannot be cancelled with this action (it is a table action); their existing route is
  unchanged.
- The gate's functional tier (G8) is red in this container for the four specs that need a reachable,
  seeded database (no database here; CI runs only the degraded spec for the same reason). Everything
  else is green.
