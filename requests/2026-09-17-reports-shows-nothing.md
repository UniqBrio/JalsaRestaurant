# BUG REQUEST — something is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->
<!-- Root cause comes before any fix - always. Stated fields are BINDING; "unknown" is honest. -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHERE: Owner console → **Reports**, on the deployed app (`jalsa-restaurant-phi.vercel.app/owner`).
- WHAT HAPPENS: `"In 'Report' section, nothing is showing up"`. The screenshot shows the range
  bar reading **`2026-09-17 · reading...`** and the panel below stuck on **"Reading the range /
  The rows are being read for the dates above."** The Today chip is selected and the four panel
  chips (Sales & products, All orders, Purchases & expenses, Final report) are present. It is a
  **permanent loading state**, not an empty state and not an error.
- WHAT SHOULD HAPPEN: the report loads, or says why it cannot.
- WHEN IT STARTED: unknown.
- WHO IS AFFECTED: the owner. Whether other roles or other ranges are affected is unknown — the
  requester named only this screen.
- REPRO STEPS: 1) Owner console 2) Reports 3) the default Today range — it never resolves
- WAS WORKING BEFORE?: unknown
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a root cause)
Recorded to narrow Track C's search, **not** as a diagnosis — intake did not reproduce it.

- The stuck string is exactly `loading` in `ReportsSection.tsx:142`:
  `const loading = !verdict.problem && result?.key !== key`. So `result` never arrived carrying
  the current range key.
- `ReportsSection.tsx:112-134` is the only thing that sets it. It fetches
  `/api/owner/report?from=..&to=..`, and **both** outcomes write a `result`: `res.ok` false
  writes the server's own message, and `.catch` writes a connection message. A 403, a 500 or a
  dropped connection would therefore all show *text*, not this.
- **A permanent "reading…" means the promise never settled at all** — the request is still in
  flight, or something upstream of `.then` and `.catch` swallowed it. That is a different class
  of fault from "the report failed", and it is where Track C should start.
- The route (`src/app/api/owner/report/route.ts`) is `force-dynamic`, checks `currentStaff()`,
  gates on `rep.sales`, and reads `listClosedBillsBetween` + `listExpensesBetween` +
  `readAllSettings`. Any of those refusing would still return a response.

## WHAT INTAKE COULD NOT DO, STATED PLAINLY
It was **not reproduced**. The only application instance available in this session reads
`.env.local`, which points at the project holding the only copy of the restaurant's real data,
and the standing instruction is not to point tests at it. Track C needs either the deployed
app's server logs for that request, or a run against the non-production project. Guessing a
root cause from a screenshot is exactly what Track C's order forbids.

## STANDING INSTRUCTIONS (do not edit)
- Track C order is binding: search `docs/registers/ROOT_CAUSE_REGISTER.md` for the same class;
  state the ROOT CAUSE, distinct from the symptom, BEFORE any fix; reproduce with a failing
  test, fix at the root, make it pass; if the cause is a pattern, sweep EVERY sibling site;
  append the root-cause entry; then the test gate.
- WHO IS AFFECTED is evidence — a fix whose mechanism does not explain the stated selectivity
  has not found the root cause.
- Data-store-level cause → STOP, propose the change, wait for approval. Production is never
  touched automatically.
