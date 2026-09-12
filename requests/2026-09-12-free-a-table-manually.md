# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A -->

Run **Track A** ([workflows/feature.md](../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: "allow owner to mark the table free manually."
- THE SITUATION, in the requester's words: "If the customer has come till this screen and left, no KOT request made. For some reason (Example: if they changed the table) if they left, there is no way we can free the table. Hence, allow owner to mark the table free manually. Owner can mark this feature to someone else in RBAC like captains — even captains can mark it as free despite a first screen is brought out when owner enables access."
- MUST-HAVE (all of it, requester to trim at Gate 1 — no priority was signalled):
  1. An owner can mark a table free by hand.
  2. The capability is a PERMISSION, grantable to other people — captains are named — through the existing RBAC screen, not hard-coded to the owner role.
  3. It covers the case described: a phone that reached the menu, put things in a cart and left without sending anything to the kitchen.
- EXPLICITLY OUT: nothing stated.
- WHO IS IT FOR: the owner, and whoever the owner grants it to. Captains named explicitly.

## USAGE PROFILE
- How often: `unknown` — the requester describes it as an exception ("for some reason"), not a routine.
- Essential information at the moment of use: `unknown`.
- Frequent vs occasional: occasional, by its own description.
- What to automate: `unknown` — nothing was asked to happen on its own.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the floor, wherever a table is shown — the owner's Dashboard floor grid and the captain's Tables screen. States: a table that can be freed, one that cannot (because food has gone to the kitchen), the confirmation, and the permission-denied state for someone who has not been granted it.
- STRINGS ADDED OR ALTERED: the action's label, its confirmation and its refusal. The requester gave no wording, so all are `unknown` and drafted in the design's own voice.
- PERMISSIONS: **yes, and it is the point.** A new key in the permission registry, held by the owner and grantable per person. Captains do not get it by default — "owner can mark this feature to someone else" means the owner grants it.
- RUN MODE: auto
- SCALE: scoped

## STANDING INSTRUCTIONS (do not edit)
- Track A runs its four gates. Gate 1 restates these FIELDS for confirmation.
- The five permission questions are answered in the plan, before build.
- Every backend change is a migration file.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## WHAT THE CODE SAYS ABOUT THE SITUATION — read before Gate 1
The described case, exactly as described, does NOT currently hold a table. `listFloor` derives a
table's state from OPEN BILLS only (`tableStateFrom`: no bill → `free`), and a bill is not created
until the first round is sent (`ensureOpenBill` lives in `/api/guest/round`). A guest who filled a
cart and left leaves a `guest_session` row and no bill, and the floor already shows that table free.

What DOES hold a table, and cannot be released today:
- an OPEN BILL with no rounds on it — possible via the captain's own "start a bill" path — which
  the partial unique index then uses to refuse the next party's bill on that table;
- the departed party's `guest_session`, which still carries their cart. Harmless to the floor, but
  it is genuinely stale data on a table the restaurant considers free.

So the capability is worth building and the requester is right that there is no way to clear it —
but the sentence "there is no way we can free the table" is true of a slightly different state than
the one their screenshot shows. **Flagged for Gate 1 rather than quietly built against a guess.**

## NOT STATED BY THE REQUESTER
- What should happen when food HAS gone to the kitchen: not stated, and this is the one place a
  wrong guess costs real money. Read as — refuse, and say which route to take instead (record the
  payment, or void the bill). Freeing a table with unpaid food on it is not a table operation, it
  is writing off a bill, and it should not be reachable from a floor tile.
- Whether the guest's phone should be told: `unknown`. Its session is ended, so the next thing it
  does lands on the welcome screen for that table.
- "despite a first screen is brought out when owner enables access" — this clause is not clear
  enough to build from. Read tentatively as: the person granted it sees the action appear on their
  own floor screen once the owner switches it on. Confirm at Gate 1.
