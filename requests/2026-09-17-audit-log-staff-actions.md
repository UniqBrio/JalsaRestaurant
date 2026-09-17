# BUG REQUEST — something is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->
<!-- Root cause comes before any fix - always. Stated fields are BINDING; "unknown" is honest. -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHERE: Owner console → **Audit log**.
- WHAT HAPPENS: `"In this screen, whatever action done by the staff are not included."` The
  screenshot shows 65 entries; every BY value is either **Guest · QR** or **Javeed Ahmed**, and
  the filter chips are Bill opened 6, Captain changed 1, Discount 4, Order placed 18, Payment 4,
  Payment attempt 1, Payment request paused 1, Payment requested 5.
- WHAT SHOULD HAPPEN: staff actions appear in the log. `"Fix them."`
- WHEN IT STARTED: unknown.
- WHO IS AFFECTED: stated as all staff actions, not a subset.
- REPRO STEPS: 1) Owner console → Audit log 2) read the BY column
- WAS WORKING BEFORE?: unknown
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND WHILE CLASSIFYING — AND IT DOES NOT SUPPORT THE STATED DEFECT
This is recorded honestly rather than worked around, because a fix for a defect that is not
there would make the log worse, not better. **Track C must not start from "staff actions are not
audited".** Three checks, all negative:

1. **Every staff verb already writes an audit entry.** `/api/staff/action` exposes eleven:
   add-round, change-qty, cancel-item, advance-kot, reprint, complete-request, close-bill,
   join-table, free-table, clear-table, set-availability. Each maps to a mutation in
   `mutations.ts`, and **all eleven call `audit()`**. `audit()` itself re-throws on failure
   (`mutations.ts:64-66`) precisely so a missing entry cannot be silent.
2. **Nothing is filtered on the way out.** `listAudit` (`queries.ts:658`) selects every row for
   the restaurant, newest first, limit 200. There is no actor filter, no role filter, and
   `confidential` is returned rather than excluded.
3. **The actor label is whoever is signed in.** `audit()` writes `actor.label`. In the
   screenshots the same person — **Javeed Ahmed, Owner / Admin** — is signed in on the owner tab
   AND on the staff tab (the staff header shows the `JA` avatar). A staff action performed by
   Javeed is therefore correctly logged as "Javeed Ahmed". It is in the log; it is under his
   name, because it was his hand.

So two candidate explanations survive, and they are different requests:

- **(a) The actions never happened.** The one staff verb that would obviously be missing is
  `advance-kot`, and it is provably unreachable — see
  `requests/2026-09-17-kot-status-dead-end.md`: nothing anywhere moves a round off `new`, so
  "Served" and "Ready" can never be logged because they can never occur. **Fixing the KOT dead
  end makes those rows appear by itself.**
- **(b) The expectation is about the NAME, not the presence.** If what is wanted is to see
  Imran's and Ramesh's names against floor work, the missing piece is staff signing in as
  themselves — not a change to the audit log.

## THE ONE QUESTION TRACK C MUST ASK FIRST
**Which action, done by whom, did you expect to see and could not find?** One concrete example
resolves (a) versus (b) immediately. Without it, any change to this screen is a guess, and the
audit log is the last place in this application where a guess belongs.

## STANDING INSTRUCTIONS (do not edit)
- Track C order is binding: search `docs/registers/ROOT_CAUSE_REGISTER.md` for the same class;
  state the ROOT CAUSE, distinct from the symptom, BEFORE any fix; reproduce with a failing
  test, fix at the root, make it pass; if the cause is a pattern, sweep EVERY sibling site;
  append the root-cause entry; then the test gate.
- WHO IS AFFECTED is evidence — a fix whose mechanism does not explain the stated selectivity
  has not found the root cause.
- **Registers are append-only.** The audit log is one. No entry is edited, backfilled or
  deleted to make this screen look right.
- Data-store-level cause → STOP, propose the change, wait for approval.
