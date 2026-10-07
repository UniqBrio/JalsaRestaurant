# Permission Matrix — Jalsa

> **A feature with no row here ships owner-only by accident — and accident is not a default.**
>
> Rows are append/supersede-only; never deleted. The authoritative copy is
> `src/lib/permissions.ts` (`PERMISSION_GROUPS`, `ROLE_PRESETS`) and the `staff_permission` table.
> This file is the reasoning; that file is the enforcement, and `tests/unit/permissions.unit.spec.ts`
> is what keeps them from drifting apart.

---

## Where a permission is enforced

Once, on the server, in `src/lib/db/mutations.ts` via `demand(grants, key)`. The browser in this
application never speaks to Supabase — every table carries row-level security with **no permissive
policy**, so a browser holding the publishable key can read nothing at all. Reads and writes go
through this application's own route handlers, which hold the secret key.

The UI withholds a control it cannot honour (Standard 5.6 — a button that silently does nothing is
worse than an absent one), but a hidden button is a convenience, never a boundary. Both sides call
the same `Grants.can`.

---

## The five questions, answered for this build

1. **New capabilities?** 46, in nine groups: orders, queue, tables, menu, bills, tips, reports,
   staff, settings. All appear in the owner's permissions UI except where noted below.
2. **Existing permissions changed meaning?** None — this is the first build.
3. **Which roles, and why?** See the presets below. Each is a job on the floor, not a tier.
4. **Default enabled or disabled, per role?** Every preset is an explicit allow-list. A key absent
   from a preset is denied; there is no inherit and no wildcard except `Owner / Admin`.
5. **Owner-configurable, or hidden?** All 46 are owner-configurable per person. Sixteen are marked
   `confidential`, which changes how they are PRESENTED (grouped and warned about), never who may
   grant them.


### `tables.free` — why it is a grant and not a role

Requested 12-Sep-2026: "allow owner to mark the table free manually. Owner can mark this feature
to someone else in RBAC like captains." That sentence is the design. It is **not** in the Captain
preset, deliberately — a captain who has it was given it by name, which is exactly what was asked
for, and a preset would hand it to every captain the restaurant ever hires.

It is marked `confidential` because of what it discards: the phone attached to that table loses a
cart it never sent, and an empty bill is voided. The permission cannot reach a bill with food on
it — `tableIsFreeable` and `freeTable` both refuse the moment a round exists, because a tile on a
floor grid must never be able to write off a bill. That refusal is the boundary; the permission
only decides who may do the safe half.

> **Superseded in part, 07-Oct-2026.** `tables.free` alone still cannot reach a bill with food on it.
> Held **together with** `orders.cancel_after`, it now can: "Cancel order & free table" voids a running
> order - rounds served or not, asked to pay or not - and frees its tables. That is a 100% write-off of
> food already made, with no discount grant and no `bill.void` (which covers CLOSED bills only), so it
> is a money power: the owner grants the pair to a person only deliberately. It is never silent: the
> bill keeps every line, who, when, why and the order value (`cancelled_total`), one audit row is
> written in the same transaction, and Reports → All orders lists it. Mark free itself is unchanged.

Enforced in `src/lib/db/mutations.ts` (`freeTable` → `demand(actor, 'tables.free')`), offered in
`src/features/owner/sections/Dashboard.tsx` and `src/features/staff/StaffTables.tsx`, granted to
the owner by `supabase/migrations/20260912100000_jalsa_free_a_table.sql`.
rung: `tests/unit/free-a-table.unit.spec.ts`


### `bill.reassign_staff` — why a name change is a money permission

The captain on a bill is not a label. `addTip` attributes the tip to `bill.captain_id`, and the
tips ledger and the settle-up screen read from that attribution — so changing the captain on a
**closed** bill moves money that has already been counted.

Requested 12-Sep-2026 as "allow owner to modify the Captain or Waiter name in any bill while it is
running or after it is closed". Built with an unsettled tip following the name and a **settled**
one staying put, because re-crediting a payout nobody can reverse would be the one genuinely
dangerous version of this. The audit line carries the old name, the new name, the amount that
moved and who moved it — that, not a time limit, is what makes it safe.

Not in any role preset. A captain who could reassign a bill to themselves could reassign a tip to
themselves.

Enforced in `src/lib/db/mutations.ts` (`reassignBillStaff`), offered in
`src/features/owner/sections/LiveOrders.tsx`, granted by
`supabase/migrations/20260912120000_jalsa_reassign_bill_staff.sql`.
rung: `tests/unit/discount-both-ways.unit.spec.ts`

---

## Role presets

| Permission group | Captain | Waiter | Chef | Cashier | Owner / Admin |
|---|---|---|---|---|---|
| Orders — view, status | ✅ | ✅ | ✅ | view only | ✅ |
| Orders — create, add items, change qty | ✅ | ❌ | ❌ | ❌ | ✅ |
| Orders — cancel before the kitchen starts | ✅ | ❌ | ❌ | ❌ | ✅ |
| Orders — cancel **after** the kitchen starts | ❌ | ❌ | ❌ | ❌ | ✅ |
| Orders — reprint a KOT | ✅ | ❌ | ✅ | ❌ | ✅ |
| Queue — view | ✅ | ✅ | ❌ | ✅ | ✅ |
| Queue — walk-in, notify, seat | ✅ | ❌ | ❌ | notify only | ✅ |
| Queue — close, clear | ❌ | ❌ | ❌ | ❌ | ✅ |
| Tables — view | ✅ | ✅ | ❌ | ✅ | ✅ |
| Tables — assign, QR | ✅ | ❌ | ❌ | ❌ | ✅ |
| Tables — transfer a bill | ❌ | ❌ | ❌ | ❌ | ✅ |
| Tables — **mark a table free by hand** (`tables.free`, added 12-Sep-2026) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Menu — view, mark sold out | ✅ | ✅ | ✅ | ❌ | ✅ |
| Menu — edit items, prices, categories | ❌ | ❌ | ❌ | ❌ | ✅ |
| Menu — **add a dish from the ordering screen** (same `menu.item_edit`, added 25-Sep-2026, E1 — the "+" on Add items and New round shows only to a holder; a captain gets it only when the owner grants it) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Menu — **add a dish from the ordering screen, as corrected in review** (25-Sep-2026: `menu.item_edit` **and** `menu.price_edit` - a new dish sets a price; supersedes the row above) | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Bills — see a bill and its total** | ✅ | **❌** | ❌ | ✅ | ✅ |
| Bills — record payment, reprint | ✅ | ❌ | ❌ | ✅ | ✅ |
| Bills — discounts | ❌ | ❌ | ❌ | percentage only | ✅ |
| Bills — void a closed bill | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bills — **change the captain or waiter on a bill** (`bill.reassign_staff`, added 12-Sep-2026) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bills — **set the waiter on their OWN open bill** (via `tables.assign`, added 24-Sep-2026, G1 — the waiter moves no money; the captain position stays `bill.reassign_staff`) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Tips — own | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tips — everyone's, settlement | ❌ | ❌ | ❌ | settle only | ✅ |
| Reports — products | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reports — sales, staff, expenses, reviews | ❌ | ❌ | ❌ | ❌ | ✅ |
| Staff — view, create, permissions, PINs | ❌ | ❌ | ❌ | ❌ | ✅ |
| Settings — all | ❌ | ❌ | ❌ | ❌ | ✅ |
| Orders — **open a takeaway, add items to one** (`orders.create` **and** `orders.add_items`, both checked before any write; added 02-Oct-2026 — the button is on the owner console's Dashboard and Live Orders; the captain app has none yet) | ✅ grant, no button | ❌ | ❌ | ❌ | ✅ |
| Orders — **set a takeaway's packaging charge** (`orders.create`, added 02-Oct-2026; only while the takeaway is open, never once the guest has asked to pay. Whether LOWERING it should need a discount grant is an open owner decision) | ✅ grant, no button | ❌ | ❌ | ❌ | ✅ |
| Orders — **Print elsewhere / Retry** a ticket (`orders.reprint`, unchanged; 02-Oct-2026: a waiting or failed original is cancelled in the same transaction, and sending a BILL elsewhere also needs `bill.reprint`) | ✅ | ❌ | ✅ | ❌ | ✅ |
| Bills — **thermal reprint of a settled bill, marked REPRINT** (`bill.reprint`, added 02-Oct-2026 — one print job and an audit row, nothing on the bill; owner console → Payments) | ✅ grant, no button | ❌ | ❌ | ✅ | ✅ |
| ~~Settings — **decide whether GST applies to packaging** (`set.tax`, added 02-Oct-2026; until decided, no non-zero packaging charge can be saved)~~ **SUPERSEDED 02-Oct-2026** by the row below: the owner fixed the rule, so there is no decision to grant | ❌ | ❌ | ❌ | ❌ | ✅ |
| Settings — **GST on takeaway packaging** (02-Oct-2026): no grant and no setting. GST is charged on food only; the packaging charge is never taxed, by the owner's rule. The tax RATE stays `set.tax` | — | — | — | — | — |
| Settings — **printer roles and defaults** (`set.printer`, added 02-Oct-2026) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Guest (no grant) — **answer "How did you hear about us?", or Not now** (added 02-Oct-2026 — their own session only, found by their cookie; never another phone's answer) | — | — | — | — | — |
| Guest (no grant) — **heart / un-heart a dish on "See my order"** (added 03-Oct-2026 — `/api/guest/favourite`; their own session's bill only, found by their cookie, no bill id accepted from the request; a heart only for a dish SERVED on that bill (`setFavourite`); un-heart always allowed on their own bill; a new heart is refused by the route while Settings → What the customer sees → `heart` is off) | — | — | — | — | — |
| Reports — **People loved items** (`rep.products`, added 03-Oct-2026 — `/api/owner/favourites`, Reports → Guest insights; hearted dishes counted in parties, no guest identity) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reports — **How guests found Jalsa, also on Reports → Guest insights** (`rep.sales`, unchanged — `/api/owner/heard`; the card is shown on the tab only to a holder, so a `rep.products`-only holder sees the tab with People loved items alone) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Owner console — **search the console's screens** (added 03-Oct-2026): no grant of its own. It lists only screens the person's grants open (a Settings panel needs `set.tables` and the panel's own grant) and opening one still passes the console's section gate; it grants nothing | — | — | — | — | — |
| Tables — **Cancel order & free table** on a table whose order has rounds (`tables.free` **and** `orders.cancel_after`, both demanded in `cancelOrderAndFreeTable` before any read; added 07-Oct-2026 — captain floor and owner Dashboard floor, `/api/staff/action` and `/api/owner/action` `cancel-free-table`. The bill is voided and kept, never deleted; the database function `cancel_bill_and_free` (service_role only) checks the bill is this restaurant's, still open or asked to pay, unchanged since read, and still on the tapped table. No preset but Owner holds both; the owner grants them per person) | ✅ grants, by owner | ❌ | ❌ | ❌ | ✅ |
| Orders — **add, replace or remove a takeaway's photo** (`orders.create`, added 07-Oct-2026 — `/api/owner/action` `takeaway-photo`, owner console → Live orders; the order must be this restaurant's takeaway, open or asked to pay; the server checks the bytes and makes the storage key) | ✅ grant, no button | ❌ | ❌ | ❌ | ✅ |
| Orders — **see a takeaway's photo** (`orders.view`, added 07-Oct-2026 — `/api/media/takeaway/…` answers only a signed-in, non-provisional owner or staff session holding it, for this restaurant's bill whose current photo it is; `private, no-store`. Guests and anyone signed out get 404) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ~~Tables — Cancel order & free table … Captain "✅ grants, by owner"~~ **SUPERSEDED 07-Oct-2026 (permission review)**: the Captain cell of the 07-Oct row above read "✅ grants, by owner"; neither key is in the Captain preset, so the default is **❌** - only a captain given both keys by name has it | ❌ | ❌ | ❌ | ❌ | ✅ |
| Note, 07-Oct-2026 — **`orders.view` now also opens takeaway photo bytes** (not only "orders on assigned tables": a takeaway is at no table). Every preset holds it. Images of a parcel or slip, served only inside the console, never cached | — | — | — | — | — |
| **Every staff and owner action route refuses an issued (provisional) PIN** (07-Oct-2026, permission review - rule 5 at the door, not only on the page): `/api/staff/action` and `/api/owner/action` answer 403 "Choose your own PIN first" before any action; choosing a PIN is `/api/staff/pin` and is unaffected | — | — | — | — | — |

---

## The three decisions worth defending

**A Waiter cannot see a bill total.** This is the one that looks like an oversight and is not. A
waiter's job is to carry food and update status; money conversations belong to the captain or the
cashier, whose names are then the ones on the record. Giving every waiter the total makes the
question "who quoted that figure?" unanswerable on a busy night, which is exactly the question that
gets asked when a table disputes one. Rung:
`tests/unit/permissions.unit.spec.ts` asserts `bill.view` is absent from the Waiter preset, and
fails if anyone adds it without changing this row.

**Cancelling after the kitchen has started is owner-only.** Before the kitchen starts, a
cancellation costs nothing and the captain owns it. After, it is food already cooked — a write-off,
which is a money decision. `cancelItem` returns `{ outcome: 'escalated' }` rather than refusing, so
the captain gets a designed "this needs Javeed" path instead of a dead button.

> **Note, 07-Oct-2026.** `orders.cancel_after` is also one of the two keys of "Cancel order & free
> table", which voids a whole order rather than one line. That action has **no** escalation path: a
> person without both keys is not offered the button, and the server answers 403. The per-line
> escalation above is unchanged.

**Nobody but the owner may void a closed bill.** A closed bill is the accounting record. Voiding one
is the only operation in this application that changes a number after the guest has left.

---

## What no role may do, at any grant level

**Nobody may mark a bill paid on the guest's behalf from the guest surface.** The guest raises a
payment request; a named member of staff records the closure. This is not a permission — it is a
database constraint:

```sql
constraint bill_closure_is_attributed
  check (status <> 'closed' or (closed_at is not null
     and closed_by_staff_id is not null and payment_mode is not null))
```

Verified against the live database on 10-Sep-2026: an unattributed closure is refused by Postgres,
not by application code that someone could later route around.
