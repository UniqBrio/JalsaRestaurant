# Request — KOT and invoice printing switches on one shared printer (22-Oct-2026)

**TYPE** enhancement · **RUN MODE** auto · **SCALE** scoped · **PRODUCTION** not touched, not deployed ·
**MIGRATION** none

## THE ASK (summarised; the full text is in the session)
"Implement KOT and invoice printing using one shared physical printer, with independent enable/disable
toggles under Settings → Printer Configuration." KOT ON prints each new KOT automatically, no popup; OFF
asks "Do you want to print this KOT?" — **Print KOT** prints only that KOT once, **Skip** prints nothing,
the saved switch is never changed, and the next KOT asks again. Invoice ON prints after a confirmed
payment, no popup; OFF asks "Payment successful. Do you want to print the invoice?" — **Print Invoice** /
**Skip**, same rules. Same printer, two independent switches, existing settings and permissions; exactly
once per intended print; never an invoice for a failed, pending or cancelled payment; printing errors never
cancel an order or reverse a payment; a printer that cannot be reached is said clearly and the person
continues.

## WHAT WAS THERE (traced before changing anything)
- Settings: one `setting` row per key, `readSettings` / `writeSetting` (merges), `print` key under the
  `set.printer` grant (templates, `splitByFoodType`).
- KOT: `placeRound` saves the round, then `queuePrint` writes one `print_job` per machine and station;
  the Windows print bridge claims and prints jobs. Called from the captain's phone, the owner's console,
  takeaway, and the guest's phone.
- Invoice: `closeBill` closes the bill in a conditional update, then queues one Invoice job.
- Printers: `printer.roles` — one machine may print `{KOT, Invoice}`; routing already sends both kinds to
  it. That IS the shared printer; nothing about machines changes here.

## DECISIONS (taken in auto mode, stated so they can be overturned)
1. **The switches live in the existing `print` setting** as `kotEnabled` and `invoiceEnabled`, edited on
   Settings → Printers & machines → Overview (the console's "printer configuration"). **Both default to
   ON**, so a restaurant that never saves them prints exactly as before. Only an explicit `false` turns
   one off.
2. **OFF means nothing is queued.** A round is stored with `kot.print_status = 'cancelled'` and no job —
   "never sent to a printer" (`neverPrinted`). That label already exists on the enum (02-Oct migration),
   so **no migration** and no window where deployed code writes a value the database refuses.
3. **The prompt is raised by the server's answer** to the one request that placed the round or took the
   payment — never by polling or a re-render — and is mounted above the screens (StaffApp, OwnerConsole)
   so navigating after Send or Record payment does not close it. Each ticket is asked about once per page.
4. **Print KOT** (`printKotOnce`, grant `orders.reprint` — the Reprint grant captains and the kitchen hold)
   claims the round in ONE conditional update (`cancelled → queued`); only the winner queues tickets. A
   round that printed automatically can never be "printed once" again — that is Reprint.
5. **Print Invoice** (`printInvoiceOnce`, grant `bill.record_payment` — whoever records the payment) only
   for a `closed` bill. A bill's FIRST invoice — automatic or one-time — is inserted under a fixed id
   (`firstInvoiceJobId`), so a second copy fails on the primary key, whatever the timing.
6. **A guest's round while KOT printing is off** is not printed and the guest is never asked: it shows
   **Not printed** with **Print KOT** on the captain's table, the captain's round list and Live orders.
   (The guest has no grant and no printer; asking them would be asking the wrong person.)
7. **Changing a quantity** on a round that was never printed does not print a "REPRINT" of paper that
   does not exist. A round that printed is still reprinted on a change, whatever the switch says — the
   kitchen holds wrong paper.
8. **A print that cannot be written never fails the round or the payment** (found on the way, below).

## FOUND ON THE WAY (fixed, because the ask names it)
- `closeBill` queued the invoice AFTER the closing write. A failure there returned an error over a bill
  already paid, so the screen said "did not go through" and the counter's "Bill requested" notice was
  never resolved. Now the payment stands, the notice is resolved, and the answer says the invoice did not
  print.
- `placeRound` likewise failed the request over a round already saved — inviting a second tap and a
  second round. Now the round stands, is marked `failed` (the existing "Print failed" and Reprint apply),
  and the answer says so. Superseded in place, with dated notes: `review-fixes` S2 and two
  `takeaway-flow` totals.

## THE FIVE PERMISSION QUESTIONS
1. **Who can do it?** Switches: `set.printer` (owner). Print KOT: `orders.reprint` (Captain, Chef, Owner
   presets). Print Invoice: `bill.record_payment` (Captain, Cashier, Owner).
2. **What changes when the grant is off?** No switch to change (disabled); no prompt is shown to someone
   who cannot act on it, and no Print KOT button; the server refuses (403) before any read.
3. **Can it reach another party's data?** No. Both one-time prints read and claim scoped to this
   restaurant; the invoice print reads only the bill named and only when closed.
4. **What does the database enforce?** The round's claim is a conditional update; the first invoice is
   held by `print_job`'s primary key; `bill_closure_is_attributed` and RLS unchanged. No migration.
5. **Where is it recorded?** `docs/registers/RBAC_MATRIX.md` (22-Oct-2026 rows); the audit log ("Print",
   naming the ticket and that the switch stays off; switch changes as "Settings").

## WHAT IS NOT VERIFIED
Physical printing. Nothing in this run touched a real printer or the print bridge on a real PC: the
tests prove which print jobs are written, once, and when — the bridge's printing of them is unchanged and
covered by `docs/GATE-7-HARDWARE-ACCEPTANCE.md`, which has not been re-run for this change.

## EVIDENCE
`tests/unit/print-switches.unit.spec.ts` (35, real mutations on the round rig with a stateful fake),
`tests/unit/print-switches.db.unit.spec.ts` (8, PGlite, every migration),
`tests/render/print-ask.render.spec.ts` (11, the real prompt, both themes),
`tests/render/print-switches.render.spec.ts` (9, the real Print setup, both themes, 390/1280 px).
Results and fail-first evidence in the root `TEST_SUMMARY.md`.
