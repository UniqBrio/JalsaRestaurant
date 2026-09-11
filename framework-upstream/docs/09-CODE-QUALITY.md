# 09 — Code Quality and Review

---

## 1. Surgical implementation discipline

The default posture for every change:

1. **State assumptions before acting.** Where a request admits two readings, present both rather
   than silently choosing one and building for three days.
2. **Minimum change for the ask.** No speculative abstraction, no drive-by refactor. If a
   refactor is genuinely needed, it is a separate approved change.
3. **Every changed line traces to the request.** A line you cannot justify is either an
   unrequested change or a mistake. Both are worth finding before merge.
4. **A verifiable goal per task**, so "done" is a fact rather than a feeling.

---

## 2. Diagnostic discipline

Rules for the specific activity of clearing errors, warnings and failures. Each exists because
the intuitive approach fails in a predictable way.

**D-1 — Classify before fixing.** An error message names a **detection point**, not a cause.
Bucket the failure first: genuine defect · one shared cause with N symptoms · dependency drift ·
contract mismatch · stale artifact · defective test · configuration · tooling.
**N failures clustered on one API is one cause with N symptoms** — fixing them individually
leaves the cause in place and produces N slightly different patches.

**D-2 — Fix at the shared boundary, then sweep it.** After fixing the abstraction, find every
other site with that shape, *including sites not currently failing*. A **suppressed** site still
counts as a site.

**D-3 — A passing check proves only what it looked at.** Distinguish compile / type / runtime /
behavioural / user-visible. A type check says nothing about files it excludes; a suite says
nothing about tests it did not select. If a change can fail at runtime while satisfying every
static check, add a runtime check — or state plainly that you did not.

**D-4 — A fallback that hides a failure is a defect.** See [06](./06-ERROR-HANDLING.md).

**D-5 — Dependency drift is its own class.** Verify against the **installed** version's own
types, not memory and not the documentation site. One import change beats ten workarounds.

**D-6 — Never silence a type error with a cast that expresses no verified invariant.** Prefer
correcting the type, the call, or the shared abstraction. A cast that asserts something untrue
converts a compile error into a runtime one.

**D-7 — Prove environment causes from a clean state.** Would this fail in a fresh clone with
declared dependencies and freshly generated artifacts? Stale generated types and
editor-vs-CLI toolchain divergence produce hours of confident wrong debugging.

**D-8 — Verify the experiment.** A result that confirms your hypothesis is exactly when to check
what else moved. **Assert on the result, not the precondition.** Move one variable at a time.

**D-9 — A detector must be able to read what it audits.** Use a real parser where you can. Never
let a detector read its own output as evidence. Every scanning check needs a companion assertion
that its parse produced a **non-empty** result — a scan that matched nothing looks exactly like
a clean codebase.

**D-10 — Regression tests protect the invariant, not the line.** A test pinned to the failing
line dies at the next refactor and takes its protection with it.

**D-11 — Reclassify after fixing.** Re-run the original validation. Which failures remain, and
do they share a *different* cause?

**D-12 — Documentation describes intent; the running system defines reality.** Verify a
referenced screen or route exists before automating against it. A disagreement between the two
is a finding to surface, not to quietly work around.

---

## 3. Review

**Reviewers read the files, not just the diff.** A diff shows what changed; only the file shows
whether it is now correct. Most review misses are things the diff could not display.

**Re-check the previous round's findings.** A finding that recurs after being marked resolved is
worth escalating, not repeating.

Full list: [checklists/CODE_REVIEW_CHECKLIST.md](../checklists/CODE_REVIEW_CHECKLIST.md).

---

## 4. What a linter is actually for

Configure rules that **decide correctness**, and let a formatter handle everything else.

Worth enforcing: unused variables · unresolved imports · floating promises · exhaustive
switches · no `any` in new code · hook dependency arrays · no client import of server-only
modules.

Not worth arguing about: quotes, semicolons, line width. Delegate to a formatter, commit its
config, and never discuss it again.

A configuration where nearly every rule is disabled is a linter that runs and reports nothing —
which is worse than no linter, because it looks like coverage.

---

## 5. Delete what you finished with

Every change deletes the one-off script it used, the module it superseded, the helper nothing
imports any more.

Without this, the codebase grows a second copy of everything, and the next reader cannot tell
which one is live. `scripts/audits/check-dead-weight.mjs` finds candidates.

**Unreferenced is not the same as unused.** Some scripts are run by hand and appear in no file.
Treat the output as a **review candidate list, never a delete list**, and record a reason for
each entry you keep.

---

## 6. Technical debt is recorded, not remembered

`docs/registers/TECH_DEBT.md`: what · why it was accepted · what it costs · what would need to
be true to pay it down.

Debt nobody wrote down is not debt; it is a surprise with a delay fuse. Writing it down also
makes the cost arguable, which is the only way it ever gets prioritised.
