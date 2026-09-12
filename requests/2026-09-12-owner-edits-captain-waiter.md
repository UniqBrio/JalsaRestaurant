# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: the captain and waiter named on a bill — shown on the owner's Live orders header (CAPTAIN Imran · WAITER Mani), on the bill itself, on the guest's phone, and on the tip ledger.
- CURRENT BEHAVIOUR: both names are set when the bill is opened and cannot be changed afterwards from any screen. A bill that opened under the wrong captain stays that way — including after it is closed, when the tip has already posted to that person's ledger.
- DESIRED BEHAVIOUR: "Allow owner to modify the Captain or Waiter name in any bill while it is running or after it is closed."
- WHY: `unknown` — not stated.
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Nothing about the rounds, the totals, the payment, or the closure moves because a name did.
- CORRECTION ROUND: 1
- RUN MODE: auto
- SCALE: scoped

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the owner's bill view (Live orders and Payments share one), in both states named — a running bill and a closed one. The closed case needs its own treatment: it is an edit to a settled record.
- STRINGS ADDED OR ALTERED: the control's label and its confirmation. No wording given, so `unknown` and drafted in the design's own voice.
- PERMISSIONS: **yes.** "Allow OWNER" is the stated scope. Following the pattern the rest of this application uses — and what was asked for one request earlier, that a capability be grantable rather than welded to a role — it becomes a permission the owner holds and may hand on.
- USAGE: occasional, by its own description — a correction, not a routine.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with the
  sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks (B4),
  touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it, never
  subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## WHAT "AFTER IT IS CLOSED" COSTS — read before building
The captain on a bill is not a label. `addTip` attributes the tip to `bill.captain_id`, and the
tips ledger and the settle-up screen both read from that attribution. So changing the captain on a
**closed** bill moves money that has already been counted, and possibly already paid out.

Three ways to handle it, and the requester chose none of them explicitly:
1. Change the name and leave the tip where it posted. Honest, but the bill then names one person
   and pays another, which is worse than the wrong name.
2. Change the name and move the tip with it. What most people mean by "fix the captain" — and it
   silently debits one person and credits another after the fact.
3. Refuse on a closed bill. Contradicts the request, which names the closed case explicitly.

**Built as (2), with the whole of it written into the audit log** — the old name, the new name, the
tip amount that moved, and who moved it. A correction that cannot be traced is indistinguishable
from a skim. Recorded here because it is the decision the request did not make, and because the
requester may well want (1) or a rule about settled tips.

## NOT STATED BY THE REQUESTER
- Whether the guest's phone should show the new name on a bill they are still sitting at: not
  stated. It does — the name comes from the same row, and a guest told "Imran is bringing your
  bill" should be told the truth when it is no longer Imran.
- Whether there is a time limit on editing a closed bill (end of shift, end of day): `unknown`.
  None is imposed, and the audit line is what makes that safe rather than a cut-off nobody
  remembers.
- Whether a waiter change has any ledger consequence: it does not — waiters are not tip-attributed
  in this build — so that half is a straightforward rename.
