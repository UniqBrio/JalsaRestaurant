# Track C — Bug Fix

> **The governing instruction: state the root cause before writing the fix.**
>
> Not the symptom. Not the file where the error surfaced. The cause.

**REPORT:** `<what was expected, what happened, how to reproduce — or the path of a requests/ file written by /request>`

When the report is a `requests/` file: its stated fields are **binding** — the quoted error
wording and the WHO IS AFFECTED selectivity are evidence for C2, verbatim — and every field
marked `unknown` is a question to ask, never a blank to fill. CORRECTION ROUND ≥ 2 means a
previous fix did not hold: read that attempt and state what it missed **before** theorising,
and treat the recurrence itself as a process finding for /framework-update. Arriving via
`/request` in the same run, the root-cause statement OPENS by restating the FIELDS verbatim —
"from your request — correct anything wrong" — because the requester has not reviewed them
yet; a correction there updates the request file before anything proceeds.

---

## C0 — Is it us? (always first, for any "it was working yesterday")

Before theorising about code, check whether an external dependency is degraded — your database
host, your platform, your messaging provider, your identity provider, your CDN.

If an active incident matches the failure signature: log it, tell the affected people with the
evidence link, and **do not write a code fix for an outage**. Hours have been spent debugging
code that was working perfectly.

---

## C1 — Root cause

### Classify before fixing
An error message names a **detection point**, not a cause. Bucket the failure first:

genuine defect · one shared cause with N symptoms · dependency drift · type/contract mismatch ·
stale build artifact · defective test · configuration · tooling · not actually reproducible

**N failures clustered on one API is one cause with N symptoms.** Fixing them individually
produces N slightly different patches and leaves the cause in place.

### Check the register
Read `docs/registers/ROOT_CAUSE_REGISTER.md` for the same *class* of issue. If this has
happened before, the entry already contains the fix, the prevention rule, and the test.

### State it explicitly
Write the root cause as a sentence, distinct from the symptom, **before** any fix:

> ✗ "The list was empty." *(symptom)*
> ✓ "The query filtered on a value that is null until the session finishes hydrating, so it
>    ran once with the wrong filter and the result was cached." *(cause)*

### Sweep the pattern
If the root cause is a pattern rather than a typo, find every other occurrence and fix them
all in this change. **A bug fixed at one call site while its twin ships elsewhere is not
fixed.** Count the sites you found and say how you searched — an unevidenced sweep did not
happen.

---

## C2 — Reproduce, fix, prove

1. **Write the failing test first.** Watch it fail against the current tree, and keep that
   output. A test that has never been observed failing is not evidence that it can fail — it
   may be asserting exactly the misunderstanding the code encodes.
2. Fix at the root, not the symptom.
3. Watch the test pass.
4. Record both outputs in `TEST_SUMMARY.md`:

   ```
   FAIL-FIRST: tests/unit/pricing.unit.spec.ts — "expected 1200, received 0" against the pre-fix tree
   ```

   Where the pre-fix state genuinely cannot be reconstructed, inject the defect the test
   describes, capture that failure, and revert the injection. If neither is possible, record
   the honest negative:

   ```
   NOT OBSERVED FAILING: tests/render/badge.render.spec.ts — new surface, no prior behaviour
   ```

   **That is a verdict. Silence is not.**

### When the MESSAGE is the bug
If what the user READ was the defect — a raw database error surfaced to a customer, an
untranslated code, a dead-end message with no next step, blame-the-user phrasing — then
rewriting that string **is** the fix, and it is the one sanctioned exception to the copy freeze
rule. The user gets plain, calm, actionable language; the real machine detail still reaches the
log. State which shipped string changed and why the exception applied. Do not extend the
rewrite to neighbouring strings.

### A fallback that hides a failure is itself a defect
For every `catch`, default value and skipped branch you touch, ask: what triggers it, is it
observable, and could a user mistake its output for real data? A silent empty array that looks
like a valid "no results" is how a failed read becomes a destructive write.

---

## C3 — Edge cases around the fix

Scoped to the path you changed: time zones and day boundaries · offline and slow networks ·
duplicate submissions and retries · concurrent edits · the same-day / just-now case · the
first record and the very large collection · a permission-denied variant.

---

## C4 — Close out

1. **Append a root-cause entry.** Use
   [templates/docs/ROOT_CAUSE_ENTRY.md](../templates/docs/ROOT_CAUSE_ENTRY.md): symptom · root
   cause · fix · files · how to verify · recurrence risk · prevention rule.
   Newest first. Never renumber; never backfill.

2. **Reclassify.** Re-run the original validation. Which failures remain, and do they share a
   *different* cause? Confirm the original symptom is gone rather than assuming it.

3. **The generality check** — could this defect class occur in another app built on this
   framework?

   - **No** — it is inseparable from this app's domain. One line, done.
   - **Yes** — run [workflows/promote.md](./promote.md) (`/promote`). Note: this is a
     *classification*, not a promotion — most answers are APP-ONLY, and a first sighting only
     PARKS a candidate. The point is that the question gets asked while the root cause is fresh,
     because nobody re-derives it a month later.

4. **The framework learning check** — one binary question:

   > Would a correctly functioning process have caught or prevented this?

   - **No** → say so in one line. Done.
   - **Yes** → the process failed too. Run
     [workflows/framework-update.md](./framework-update.md) with this incident as input.
     An application fix without the process fix means paying for the same lesson twice.

5. Run the test gate. Nothing merges without a PASS.
