# Track F — Framework Update (the self-healing loop)

> This workflow's subject is **the process itself**. It maintains the framework; it never
> touches application code.
>
> Invoked automatically by the framework-learning check at the end of every root-cause
> analysis, and manually whenever the process demonstrably failed.

**INPUT:** `<the incident, the correction, or the gap>`

---

## Why this exists

A process that cannot learn decays. Every root cause it fails to catch is a lesson paid for and
then discarded — and the same defect class returns, at full price, some months later.

Equally: a process that only ever *grows* decays differently. Nobody can hold forty rules in
their head, so they follow the ones they remember, and selective following is
indistinguishable from not following.

This workflow does both jobs: it makes the process learn, and it keeps the process small
enough to be followed.

---

## The governed files

| File | Role |
|---|---|
| `workflows/*.md` | The track runbooks |
| `docs/*.md` | The reference documentation |
| `checklists/*.md` | Point-of-use verification |
| `docs/registers/*.md` | The living registers |
| `scripts/**` | The mechanical enforcement |
| `AGENTS.md` / `CLAUDE.md` | The project's binding rules |
| `VERSION` + `UPGRADES.md` | The framework's version identity and per-version app instructions |
| `docs/registers/CANDIDATES.md` | The promotion parking lot (fed by `workflows/promote.md`) |
| `fixtures/**` | The conformance apps — a framework change is proven against them |
| `templates/docs/FRAMEWORK_ADOPTION.md` | The per-app adoption log template |
| **This file** | Yes — see *self-modification* below |

---

## Route A — a new incident or root cause

1. **Append the incident entry.** Next number, newest first, wording preserved. Never renumber;
   never backfill. Include: symptom · root cause · fix · files · verification step ·
   recurrence risk.

2. **Derive a rule only if the cause reveals a genuinely NEW class.** Otherwise map it to an
   existing rule. Most incidents are an existing rule not being executed, and minting a second
   rule for the same class makes both weaker.

3. **Every new binding rule states where it is enforced, as a path.**
   `rung: tests/unit/pricing-rounding.unit.spec.ts`
   A rule with no rung declares itself prose-only, explicitly. That is honest debt, and
   `scripts/audits/check-rule-coverage.mjs` counts it so it can be ratcheted down.

   > Scoping this obligation to *one* class of rule exempts the others by omission. That is how
   > a design rule stays "binding" while being violated in dozens of places. Apply it to every
   > rule class, without exception.

4. **Add test cases.** State the registry delta.

5. If the cause was a permanent platform limitation, it becomes a limitations entry instead of
   a rule. If it was a process gap, also run Route B.

---

## Route B — a process correction

1. **Identify EVERY file the correction touches, not just the one you were pointed at.** A
   testing change spreads to the test-gate workflow *and* the checklists. A gate change spreads
   to the track runbooks *and* the worked example.

2. Apply the edits.

3. **Add test cases for the process change too.** A process change alters behaviour — a gate
   step runs or it does not, a guard fires or stays silent — and behaviour is testable.

   > This step was itself added retroactively. Route B had no test-case obligation for its
   > entire existence, so every process change legitimately reached for the escape token and
   > shipped uncovered. **A requirement that names one route silently exempts the others.**

4. Register any genuinely new file in the governed-files table above **and** in
   `FRAMEWORK_MANIFEST.md`. An unregistered file is one nobody maintains.

---

## Route P — a PROMOTED candidate (from `workflows/promote.md`)

The classification gate has already run: the rule is stated domain-free, sighted in two
different apps, and human-approved. Treat it as Route A (if it derives from an incident) or
Route B (if it is a process correction) — **with one addition**: after the close-out, update the
candidate's row in `CANDIDATES.md` to `PROMOTED → <id, version>`.

A promotion arriving here WITHOUT a CANDIDATES row, or at n=1, goes back through
`workflows/promote.md` first. This workflow does not re-litigate the classification, but it does
verify the classification happened.

---

## Route C — the input is actually a feature or bug request

It belongs in the normal pipeline, not here. Extract only the process-level learning and route
it via A or B. If nothing process-level is revealed, **say so explicitly and stop** — rather
than manufacturing a rule to justify the run.

---

## The rule budget

Before adding any prose rule, take the cheapest workable enforcement level:

```
automated check   >   checklist item   >   canonical-pattern row   >   prose rule
     (best)                                                            (last resort)
```

The screen checklist is **capped at 20 items and declared full**. Adding one means removing,
merging or automating another. The trade is the mechanism.

Periodically propose **compaction**, not only growth. A rule that has never fired, or whose
class is now prevented structurally, is a candidate for removal — and removing it makes the
remaining rules more likely to be followed.

---

## Binding editing rules

**The quadruple close-out.** Every run of this workflow delivers all four:

1. **PROCESS** — the governed files learn the lesson.
2. **FLOW** — the actual issue is fixed in the codebase.
3. **CASES** — test cases are added.
4. **VERSION** — `VERSION` is bumped (PATCH / MINOR / MAJOR per
   `docs/22-FRAMEWORK-EVOLUTION.md`) and `UPGRADES.md` gains the entry an upgrading app will
   read: what changed, and what the app must do — even when the answer is "nothing".

A run delivering fewer states which it skipped and why, **in that run**, never "later". Each has
been skipped in isolation, and each skip was invisible at the time. The fourth exists because a
framework change without a version bump is invisible to every app's `upgrade` command — improved
and undeliverable at the same time.

**Conformance before the version counts.** A MINOR or MAJOR change runs
`node scripts/audits/check-backward-compat.mjs` — the fixtures prove no existing app goes
green → red. A fixture regression means either the change is reworked, or it is declared MAJOR
with its migration step written in `UPGRADES.md`. Never silently shipped.

**Anchored edits, then verify.** Edit against the file's actual current text. Re-check that
every intended change landed. **Assert on the result, not the precondition** — confirm the new
state, do not confirm that you issued the command. Change one variable at a time.

**Evidence or it did not happen.** Any claimed sweep includes the exact search command and its
match count. "I checked everywhere" is not a finding.

**Consistency sweep, as the last step of every run.** The runbooks, the reference docs and the
checklists must still agree on the gate list, the paths, the registry lifecycle wording and the
automation boundary. A worked example describing an older flow teaches the wrong flow, with
confidence. Every reference document is either updated or explicitly declared "no change
needed".

**Self-modification is allowed and bounded.** This file updates its own governed table, routes
and editing rules the same way it updates anything else — version-noted and diffed. An updater
that cannot update itself is how a process drifts away from its own documentation.

**The safety floor this workflow may never weaken:** the project's binding architectural rules ·
the production-approval gate · outbound-send stop-and-ask · append-only registers and spec
files. If asked to weaken one, push back and propose the safe alternative.

---

## Output format

1. **Change log** — one line per file, or "unchanged".
2. **The revised files**, in full.
3. **Pending on your end** — anything requiring a human action.
4. If the input is ambiguous between routes, **ask exactly one question first.**
