# 15 — Writing Test Cases

> A test case is not "what a human might do". It is **an instruction precise enough that a
> machine — or an agent — can execute it without asking a question.**

---

## 1. The anatomy of a case

Every case carries these, in order:

| Field | Why it is here |
|---|---|
| **Preconditions** | State the world must be in. "Logged in as X, with 3 records, one overdue." |
| **Test data** | The exact values. Not "some data" — a runner cannot generate "some". |
| **Entry point** | The exact route or control. Not "go to settings". |
| **Element** | The test id. Not "the save button". |
| **Action** | One verb: click, type, swipe, wait. |
| **Expected UI** | What is visible afterwards. |
| **Expected data change** | **What changed in the datastore.** |
| **Expected external send** | Any outbound message, declared. |
| **Negative case** | What must NOT happen. |
| **Cleanup** | So the suite can run twice. |

Three of these are the ones usually missing, and each has a specific cost:

- **Expected data change.** Without it the case asserts a toast. A success message is what the
  application *claims* happened. Several classic data-loss bugs are the application cheerfully
  reporting a save that never landed.
- **Expected external send.** Undeclared, an automated run fires a real message to a real person
  by accident. This is the field that prevents that.
- **Cleanup.** Without it the suite passes once and fails on every subsequent run, and everyone
  learns to ignore it.

---

## 2. Coverage is a shape, not a count

For every feature: **happy path · empty · loading · error · prerequisite-missing ·
role-specific · unhappy path.**

A single happy-path case is not coverage of a five-state screen. It is coverage of one fifth of
it, reported as done.

---

## 3. The four dimensions

Every change states, per touched module, either the cases created **or** "covered — none
needed" with one line of reasoning, for each of:

1. **Functional**
2. **Responsive** — every viewport profile
3. **Performance** — against the stated budget
4. **Security** — roles, tenant isolation, injection

**A dimension not mentioned at all is a defect of the run, not an implicit pass.**
Silence is how cases sit unexecuted behind a green gate.

---

## 4. Cases that must exist and are usually forgotten

### Idempotency cases, derived from constraints
For every table a change writes to, read its unique constraints **from the live schema** — never
assume the migration files are complete — and write:

- the same action performed twice (retry, double-tap);
- a second *legitimate* row sharing the constraint's key window;
- an existing system-created row for the same key;
- a mid-cascade failure for any multi-write flow — assert **no partial state**.

Any raw constraint error reaching the UI is a failure.

### Non-default configuration cases
If behaviour depends on configuration, test it **outside** the default:

- everything optional turned off at once;
- the "wrong kind first" arrangement for any heterogeneous list a rule selects from;
- **the undo round-trip** — every setting reversible from the screen that set it. A settings
  screen whose off-switch removes its own on-switch is a real and recurring defect.

### Geometry cases
Overlap, clipping, occlusion, truncation and reachability are **computable from a bounding
box**, so they are automated by definition.

Left "manual", they are the cases that sit unrun for months while the exact defect they guard
against ships to users.

### Cases that compute the rule
At least one case per behaviour rule must **compute the rule's answer for a real input** —
including the input an earlier version got wrong.

Tests written from the design only confirm the design. If the design was the defect, a suite of
green assertions confirms the defect. A source scan is a ratchet, not a behaviour test.

---

## 5. The registry lifecycle

Cases live in a registry (`tests/cases/`) — a spreadsheet, a markdown table, whatever your team
will actually maintain.

| Verb | When | Rule |
|---|---|---|
| **ADD** | A change adds behaviour | New sequential ID + today's date |
| **UPDATE** | A change modifies an existing flow | Edit in place, refresh the date. Never leave a case describing a flow that no longer exists. |
| **RETIRE** | The feature is removed from the product | Only then. List the ID and reason. **IDs are never reused.** |

Every run ends with an explicit delta:

> `Registry delta: added UB-INV-041..043; updated UB-INV-012; retired none.`

And then it is **verified against the file**. A claimed delta the file does not reflect is a
failed run regardless of the test results.

---

## 6. Fail-first evidence

> **A test that has never been observed failing is not evidence that it can fail.**

Run every new behaviour test against the pre-fix tree. Paste the failure output beside the
passing one:

```
FAIL-FIRST: tests/unit/pricing.unit.spec.ts — "expected 1200, received 0" against the pre-fix tree
```

Where the pre-fix state cannot be reconstructed — a brand-new surface with no prior behaviour —
inject the defect the test describes, capture that failure, and revert the injection.

If neither is possible, record the honest negative:

```
NOT OBSERVED FAILING: tests/render/badge.render.spec.ts — new surface, no prior behaviour
```

### The failure must be NAMED, not merely claimed *(v2.9.0)*

**`FAIL-FIRST: x — red first` no longer satisfies guard G3.** The line must carry an observable
signal: an exit code, a count, a measurement, or the message in quotes. Quoting is always
available, so the rule is always satisfiable.

The reason is not tidiness. "A failure happened" cannot show the failure belonged to **this**
check — and one week produced five results that were green or red for a reason nobody had
looked at, every one of which satisfied fail-first as it then stood:

| Shape | What it looked like |
|---|---|
| **Zero-match scan** | A sweep whose regex the shell had mangled matched nothing, in both the broken and the fixed tree — indistinguishable from clean (RC-012) |
| **Program never ran** | An injected defect had a syntax error, so the tool died on load; the "it can fail" probe passed against something that never executed |
| **Shared exit code** | A new check passed on an *older* check's identical exit 2 — twice, in v2.1.0 and v2.2.0 |

### Three questions, for a new behaviour rung

1. **Did the unfixed tree fail?** — fail-first, as always.
2. **What exactly did the failure say?** — the signal above. If you cannot name it, you did not
   look at it.
3. **Could anything else have produced that same failure?** — if yes, the evidence is not yet
   attributable, and step 3 is not optional.

**If the answer to 3 is yes, isolate before recording** — release the other checks with their
escape tokens, clean the precondition, or assert on the message rather than the code. Observed
in this repository: an app-code change with a weak fail-first line exits 2 from **G2**, the
gate-ledger guard, not from G3 at all. Releasing G2 moves the same exit 2 to G3. Without that
step the evidence names the wrong check, confidently.

Where the failure signal is already unique, do nothing — isolation is a fix for ambiguity, not a
ritual.

> **A green test is a claim about the test** until its failure mode and its attribution establish
> what it actually verified.

**For detectors and scanners**, the companion rule already stands and is unchanged: a scan that
matched nothing reports **BLOCKED**, never a clean result — an empty input set and a clean
codebase look identical from the outside (CLAUDE.md rules 3 and 5).

**That is a verdict. Silence is not.**

Enforced by guard G3 in `scripts/hooks/pre-commit-guard.sh`.

The reason this is a required step and not a good habit: a suite of green assertions written
from a design cannot distinguish "the code is correct" from "the code and the test share the
same misunderstanding". Watching the test go red is the only cheap way to tell them apart.
