# BUG REQUEST — something that does not do what it promises
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- FEATURE / SCREEN: `Captain / Staff app → a table's "Rounds sent to the kitchen"`
- WHAT HAPPENS: `The Captain cannot mark a round served. The requester asks for a "Mark served" action to be added, as a real backend transition, with the customer's status following.`
- WHAT SHOULD HAPPEN: `Ready → Served, on that round alone, persisted, visible to the customer, bill untouched.`
- WAS IT WORKING BEFORE?: `unknown — not stated.`
- WHO IS AFFECTED: `Captains and waiters. Stated scope: Captain/Waiter operational action, not an Owner one.`
- MUST NOT CHANGE: `Bill closure, payment, tip, discount, staff assignment, table release, printer routing, KOT printing, the Captain UI's design, the customer status architecture. No new KOT architecture, no new realtime architecture, no arbitrary polling.`
- CORRECTION ROUND: `1`

## C1 — THE ROOT CAUSE, PROVEN AGAINST LIVE DATA

**The "Mark served" button already exists, and has shipped since before today.** At HEAD —
the code running in production — `StaffTables.tsx` renders it on every round card:

```tsx
{canServe && (k.status === 'ready' || k.status === 'picked_up') ? (
  <Button data-testid={`staff-serve-${k.id}`} …>Mark served</Button>
) : null}
```

It is gated on `orders.status`, and production says that grant is in place:

| Role | staff | can sign in | hold `orders.status` |
|---|---|---|---|
| Captain | 5 | 4 | **5** |
| Waiter | 10 | 4 | **10** |

So eight people can sign in today holding the right grant, looking at a screen that contains the
button. **They still cannot use it, and the reason is one query:**

```
select status, count(*) from kot group by status;
→ new : 18     (12-Sep to 17-Sep)
```

**Every KOT ever created in this restaurant is still `new`.** Not one has ever reached
`preparing`, `ready`, `picked_up` or `served`. The button is conditioned on `ready`, the condition
has never once been true, and so the button has never once rendered.

### Why no round ever becomes Ready

`advance-kot` has exactly two call sites, and **both act only on rounds that are ALREADY ready or
picked up** — `StaffTables.tsx` (the button above) and `StaffLists.tsx` (fed by a view that
filters `status === 'ready' || 'picked_up'`). Nothing in the application can move a round out of
`new`. The states exist in the enum and are unreachable.

**So the reported symptom is real and the requested fix would not have fixed it.** Adding a
"Mark served" button adds a second button beside one that already exists and is already invisible
for the same reason. The missing step is not Served. It is Ready.

## THE FIX ALREADY EXISTS IN THIS TREE, AND IS NOT DEPLOYED

The KOT status workflow built earlier today (`RUN_LOG.md`, 18-Sep, "KOT ORDER STATUS WORKFLOW")
closes exactly this:

| This request asks for | Already in the working tree |
|---|---|
| Ready → Served for the Captain | `captainNextKot('ready') → { to: 'served', label: 'Mark served' }` |
| A round can actually reach Ready | `captainNextKot` also gives **Start preparing** and **Mark ready**, which is the step that did not exist |
| Not premature, not from cancelled | `KOT_TRANSITIONS` refuses `new → served`, `preparing → served`, `served → *`, `cancelled → *`, server-side |
| Two devices at once | the update pins the status it read in its `WHERE` clause, so the second write matches no row |
| Only that round changes | `.eq('id', input.kotId)`, never keyed on bill or table |
| The customer sees Served | `rounds[].status` on the guest payload, through `useLiveData`, rendered as the design's timeline |
| Audited with the actor | `audit({ action: 'Status', … actor })` |
| Bill untouched | nothing in the path writes `bill`, payment, tip or discount |

**It is uncommitted, along with eleven other workstreams.** Nothing in this list reaches a captain
until it is pushed.

## THE ONE GENUINE DIVERGENCE, NOT CLOSED HERE

On the **"To serve" list** (the bottom-nav tab, a different screen from the one in the reference
image), a `ready` round still offers **"Picked up from the counter"** first, and only then
"On the table — served" — two taps rather than one. That is the counter-pickup workflow, and on
18-Sep the requester was asked about it directly and chose: *"Leave it, skip it in the new flow —
the existing counter-pickup button keeps working untouched."*

This request's "READY → Show Mark served" contradicts that earlier decision **on that screen
only**. It is left alone rather than silently reversed, and is raised in the report instead.

## STANDING INSTRUCTIONS (do not edit)
- Track C is ROOT CAUSE FIRST. The fix follows the cause; a symptom patched without a cause is a
  second defect with better manners.
- MUST NOT CHANGE seeds the "deliberately not touching" list.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges without
  a PASS.
