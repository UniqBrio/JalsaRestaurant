# Track R — Post-Generation Review (the learning loop's input)

> Run this when a build is **finished and needs to be looked at**: a generated application, a
> completed slice, a handover. It is not a bug report and not a change request — it is the step
> that goes LOOKING for both, and converts what it finds into rules.
>
> **The governing instruction: find with evidence, name the cause, then generalise or say you
> cannot.**

**SUBJECT:** `<the application, slice or surface to review>`

---

## Why this exists

Every track ends by declaring itself done. None of them ends by asking *what did we just teach
ourselves?* Without this step the framework only learns from failures loud enough to be reported
as incidents — which means it learns from the expensive ones and never from the cheap ones, and
the cheap ones are where the patterns are.

It also exists because the request intake had no row for it. A reviewer's words — "review the
generated app and improve the process" — classify as neither NEW, CHANGE, BUG, nor a process
failure that has already happened. Routed by force into one of those, the review becomes a bug
hunt and the framework learns nothing.

---

## R1 — Evidence before opinion

**The binding rule of this track: no finding without a command and its output.** A review is the
one activity where fluent prose is indistinguishable from invention, because nothing downstream
executes it. So every finding carries the grep, the count, the file and line, or the failing
assertion that produced it.

Three buckets, and the boundary between them is not optional:

| Bucket | What qualifies | What it may claim |
|---|---|---|
| **CONFIRMED** | Reproduced, or read directly in the code, with the evidence quoted | "This is wrong" |
| **LIKELY RISK** | The mechanism is present and the failure follows, but it was not reproduced | "This can go wrong" |
| **OPPORTUNITY** | Works correctly; could be simpler, faster or clearer | "This could be better" |

A finding that cannot be evidenced is **dropped, not softened**. Inventing a plausible issue costs
more than missing a real one: it sends a fix into working code and it discredits the findings
beside it.

**Say what you could not look at.** A review of an application whose main surfaces were never
rendered is a review of the code, not of the experience — and it must say so in those words. The
list of what was NOT examined is part of the output, not an apology for it.

---

## R2 — Cause, not symptom

For every CONFIRMED finding and every LIKELY RISK, write the cause in one or two sentences, and
check it against this test: **does the cause explain the symptom, or merely restate it?**

- "The UI is not responsive" — restates.
- "Only the two screens reachable without a database were ever rendered, so no viewport evidence
  exists for the other nine" — explains.

Stop when the next "why" would leave the codebase. The cause of a defect is in the implementation
or the process that produced it, not in the language, the framework, or the hurry.

---

## R3 — Fix, in priority order

Correctness · simplicity · fewer interactions · responsiveness · accessibility · performance ·
maintainability · consistency with the existing architecture.

**Prefer the systemic fix.** If the same cause has three sites, fixing one is three-quarters of
the work with none of the benefit. If a canonical pattern already covers the concern, the fix is
to USE it — a second implementation is a defect, not a preference.

---

## R4 — Generalise, or decline out loud

For each cause, answer one question: **would this have happened in a different application?**

- **Yes** → it becomes a framework rule. Continue into
  [workflows/framework-update.md](./framework-update.md) — Route A if it came from an incident,
  Route B if it is a process correction.
- **No** → say so explicitly, in one line, and stop. *"App-specific: the bill/table model is
  Jalsa's, not a pattern."*

**A rule that only solves the application you just reviewed is worse than no rule.** It spends
budget from a capped set and it will be followed literally somewhere it does not apply. The test
is the lexicon grep from [workflows/promote.md](./promote.md) Filter 2: if the rule cannot be
stated without a noun from this business, it is not general yet.

Respect the rule budget: `automated check > checklist item > canonical-pattern row > prose rule`.
A review that produces four prose rules and no detector has not finished its job.

---

## R5 — Prevention, in order

For each rule, choose the earliest point it can act, and record which:

| | Ask | Prefer this when |
|---|---|---|
| **PREVENT** | Can generation avoid producing this at all? | The rule is a shape, not a judgement |
| **DETECT** | Can a gate find it immediately after generation? | The shape is checkable but not enforceable |
| **CORRECT** | Can the workflow fix it automatically? | The fix is mechanical and unambiguous |
| **REPORT** | Only a human can judge it | Everything else has been ruled out — say why |

Prevent > Detect > Correct > Report. Landing on REPORT is allowed; landing there *without having
considered the other three* is the failure this table exists to stop.

---

## Output format

**A. Overall quality assessment** — brief, and honest about what was not examined.
**B. Issues and improvement opportunities** — grouped CONFIRMED / LIKELY RISK / OPPORTUNITY, each
with its evidence.
**C. Root cause summary** — causes only, readable on their own.
**D. Fix summary** — fixes only, readable on their own.
**E. Reusable framework rules** — new or strengthened, each with the problem it prevents and when
it applies.
**F. Framework changes** — exactly what was added, modified or strengthened, as a file list.
**G. Prevention checklist** — what a future generation should validate automatically.

C and D must each stand alone: they are lifted whole into the framework, and a fix that only makes
sense beside its issue will be pasted somewhere it makes no sense at all.

---

## The close-out

This track ends in `framework-update.md`'s quadruple close-out — PROCESS · FLOW · CASES · VERSION
— or it ends with an explicit *"nothing general was learned"*. There is no third ending. A review
that produces a document and no committed change has converted effort into prose.
