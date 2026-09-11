# BUG REQUEST — something is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->
<!-- Root cause comes before any fix - always. Stated fields are BINDING; "unknown" is honest. -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHERE: `<screen / flow / job where it happens>`
- WHAT HAPPENS: `<the wrong behaviour exactly as seen — the requester's error text/toast wording in quotes, verbatim>`
- WHAT SHOULD HAPPEN: `<expected behaviour>`
- WHEN IT STARTED: `<"always" / after <date or change> / unknown>`
- WHO IS AFFECTED: `<all users / one role / one environment / one data shape — selectivity verbatim as stated ("only on X, Y is fine") — it is a root-cause clue>`
- REPRO STEPS: `<numbered steps if known — or "intermittent, no repro" / unknown>`
- WAS WORKING BEFORE?: `<yes / no / unknown — "yes" means check external dependency status FIRST; an outage is never a code fix>`
- CORRECTION ROUND: `<1, or N with a pointer to the previous attempt (request file / commit / "unknown")>`

## STANDING INSTRUCTIONS (do not edit)
- Track C order is binding: search `docs/registers/ROOT_CAUSE_REGISTER.md` for the same class;
  state the ROOT CAUSE, distinct from the symptom, BEFORE any fix; reproduce with a failing
  test, fix at the root, make it pass; if the cause is a pattern, sweep EVERY sibling site;
  append the root-cause entry; then the test gate.
- WHO IS AFFECTED is evidence — a fix whose mechanism does not explain the stated selectivity
  has not found the root cause.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why. A recurring "fixed" bug is a process finding — flag `/framework-update`.
- Data-store-level cause → STOP, propose the change, wait for approval. Production is never
  touched automatically.

## EXAMPLE (filled)
- WHERE: Records list → approve action
- WHAT HAPPENS: "Couldn't approve, please retry" toast; the record stays pending.
- WHAT SHOULD HAPPEN: Record approves and moves to the active list.
- WHEN IT STARTED: unknown — first noticed this week
- WHO IS AFFECTED: only records with an instalment plan; single-payment records approve fine
- REPRO STEPS: 1) Create a record with an instalment plan 2) Open it 3) Tap Approve
- WAS WORKING BEFORE?: unknown for instalment plans; single-payment always worked
- CORRECTION ROUND: 1
