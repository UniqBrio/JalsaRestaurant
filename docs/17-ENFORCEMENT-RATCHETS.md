# 17 — Enforcement and Ratchets

> The mechanism that turns this framework from a document into a system.

---

## 1. The problem

Two failure modes, and they trap each other:

**Write the rule and trust people to follow it.** The rule is followed while it is remembered.
Then a deadline arrives, or someone new joins, or the person who cared moves on. The document
still says the rule is binding. The codebase disagrees. **Both look fine in isolation.**

**Write the rule and enforce it cleanly.** The gate blocks every commit on day one, because the
existing codebase already violates it in forty places. So it gets switched off — and now there
is an unenforced rule *plus* a disabled gate, which is strictly worse than where you started.

---

## 2. The ratchet

Do not demand clean. **Demand no-worse.**

1. Record today's violations in a **committed baseline**.
2. Anything **new** → block. "You introduced this."
3. Anything **in the baseline but now fixed** → **also block.** "You fixed it; delist it."

Step 3 is the half people leave out, and it is what makes it a ratchet rather than a suppression
list. Without it the file never shrinks, and a genuine regression can hide inside a stale
exemption indefinitely.

The result: you can adopt any rule **today**, on any codebase, with no cleanup sprint. The
backlog is visible, counted, and can only go down.

---

## 3. Designing a signature

The signature is what gets compared. Get it wrong and the ratchet cries wolf until someone
disables it.

**Stable under unrelated edits.**

```
✗ src/lib/pricing.ts:47:12|TS2345      inserting a blank line above reads as a new violation
✓ src/lib/pricing.ts|TS2345            survives every edit that is not the violation itself
```

**Count-based where the rule is "how many", not "which one".**

```
src/components/Card.tsx|3
```

A file may then only get better. A rise blocks; a fall blocks until the baseline is regenerated.
That second half proves itself the first time someone does a large sweep.

**Include the theme, the environment, or whatever else makes two otherwise-identical violations
genuinely different.**

```
dark|text.muted|surface
```

---

## 4. Fail open on tooling, block only on evidence

Missing interpreter, missing dependency, missing baseline → **print a loud SKIP on stderr and
pass.**

Never block for a tooling gap: a gate that fails the build when a container lacks a binary gets
disabled within a day. But never go *quietly* dead either — a dead gate must be audible, because
the failure mode to avoid is a check that has silently reported nothing for a week while
everyone trusted it.

**The corollary that catches the subtle version:**

> A detector that parsed nothing must report BLOCKED, never success.

A scan matching zero files looks exactly like a clean codebase. `evaluateRatchet` takes a
`parsedSomething` flag for precisely this.

---

## 5. Guards: the structural rule

Commit guards live in `scripts/hooks/pre-commit-guard.sh`. One rule matters more than the rest:

> **Every guard is a function that RETURNS. Only `main()` exits.**

If a guard exits on its own **success** path, every guard below it becomes unreachable — and an
unreachable guard is indistinguishable from a passing one for as long as nobody checks. This has
happened, in a real pipeline, for weeks, while both the documentation and the rule register
asserted enforcement.

The rung that proves it: `scripts/hooks/guard-reachability.test.sh` **executes** the hook against
scratch repositories, once per guard. A source scan cannot tell a live guard from a
commented-out one.

*(That test found two real defects while this framework was being built — one in a guard, one in
the test itself. Which is the argument for having it.)*

### Escape tokens
Each guard has its **own** token, written into the commit message with a justification, and it
excuses **only that guard**.

There is deliberately no global bypass. One token buying a pass on everything is the same as no
guards at all, and it is what a global bypass becomes within a month. Every use is auditable in
the git history — which is the point: an escape is a decision, not a workaround.

---

## 6. The rule budget

Rules are a **budgeted resource**. A process nobody can hold in their head is followed
selectively, and selective following is indistinguishable from not following.

Before adding a prose rule, take the cheapest workable enforcement level:

```
automated check  >  checklist item  >  canonical-pattern row  >  prose rule
    (best)                                                       (last resort)
```

The screen checklist is **capped at 20 items and declared full.** Adding one means removing,
merging or automating another. The cap is the mechanism, not an inconvenience — it forces the
question "is this more important than what it displaces?", which is the question that keeps a
checklist usable.

**Every new binding rule names where it is enforced, as a path.** A rule with no rung declares
itself prose-only, explicitly. `scripts/audits/check-rule-coverage.mjs` counts those and
ratchets the count downward.

> Scoping that obligation to one *class* of rule exempts the others by omission. That is exactly
> how a rule stays "binding" while being violated in dozens of places.

---

## 7. The gates in this framework

| Gate | Script | Kind |
|---|---|---|
| Theme artifacts in sync | `theme-build.mjs --check` | Clean gate |
| Contrast, all pairs, both themes | `check-contrast.mjs` | Ratchet (currently clean) |
| Theme assets present per theme | `check-theme-assets.mjs` | Clean gate |
| No hard-coded colours | `audits/check-hardcoded-colors.mjs` | Ratchet |
| Automation addressability | `audits/check-testid-coverage.mjs` | Ratchet |
| Rules have an enforcement point | `audits/check-rule-coverage.mjs` | Ratchet |
| Commit obligations | `hooks/pre-commit-guard.sh` | Guards + escape tokens |
| Guards are reachable | `hooks/guard-reachability.test.sh` | Executable proof |
| The whole gate | `gate-runner.mjs` | Ordered, three-valued |

---

## 8. Adopting this on an existing codebase

```bash
# 1. See the damage. Do not fix it yet.
node scripts/audits/check-hardcoded-colors.mjs --report
node scripts/audits/check-testid-coverage.mjs --report

# 2. Freeze it as accepted debt.
node scripts/audits/check-hardcoded-colors.mjs --write-baseline
node scripts/audits/check-testid-coverage.mjs --write-baseline
git add .baselines && git commit -m "chore: baseline quality ratchets

Counts recorded so they can only shrink. No behaviour change."

# 3. Turn the gates on. They now block only NEW violations.
npm run guard:install
```

Day one: nothing is blocked that was not already broken.
Day ninety: the backlog is measurably smaller, and no new violation was ever merged.
