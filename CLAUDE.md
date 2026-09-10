# CLAUDE.md — Custom Web App Development Framework

> **Read this file in full before every task in this repository.**
>
> This repository is the framework **itself**. If you are looking for the rules of an
> application built *with* it, that application has its own `CLAUDE.md` — generated from
> `templates/docs/AGENTS.md` when it was scaffolded.

---

## What this repository is

A domain-agnostic development framework: an SDLC, runbooks, quality gates that execute, a theme
system with enforced contrast, and runnable starter code.

**It contains no application.** `starter/` is a reference implementation — every file there is a
worked example of a canonical pattern, and it is verified by the same gates as everything else.

---

## The two ideas everything here rests on

Judge every proposed change against these. A change that weakens either is wrong, however
reasonable it looks in isolation.

### 1. A rule that nothing executes is not a rule
Every rule names the thing that runs it — a spec, a script, a hook, a checklist item — or it
declares itself prose-only, **honestly**. What is forbidden is *implying* enforcement that does
not exist. `scripts/audits/check-rule-coverage.mjs` counts the answers.

### 2. Demand no-worse, not clean
Every gate is a ratchet: a committed baseline, new violations blocked, **and fixed-but-still-listed
violations also blocked** so the list can only shrink. A clean gate over an existing backlog gets
switched off within a day, and then there is an unenforced rule *and* a disabled gate.

---

## Binding rules (do not weaken these)

### 1. No guard may exit on its own success path
Every guard in `scripts/hooks/pre-commit-guard.sh` is a function that **returns**. Only `main()`
exits.

A guard that exits on success makes every guard below it unreachable — and an unreachable guard
is indistinguishable from a passing one until someone checks. Adding a guard means adding a call
in `main()` **and** a case in `scripts/hooks/guard-reachability.test.sh`.
**Honoured in:** `scripts/hooks/pre-commit-guard.sh`, proven by `guard-reachability.test.sh`.

### 2. Every escape token excuses exactly one guard
There is deliberately **no global bypass**. One token buying a pass on everything is the same as
no guards at all, and that is what a global bypass becomes within a month. Every use is auditable
in git history.

### 3. Fail open on tooling; block only on evidence — and never go quietly dead
A missing interpreter, dependency or baseline prints a loud `SKIPPED` on stderr and passes.
**A dead gate must be audible.**

Its corollary: **a detector that parsed nothing reports BLOCKED, never success.** A scan matching
zero files looks exactly like a clean codebase.
**Honoured in:** `scripts/lib/ratchet.mjs` (`parsedSomething`), `scripts/gate-runner.mjs`
(`unavailable()`).

### 4. Three verdicts, and BLOCKED is never a pass
PASS · FAIL · **BLOCKED**. There is deliberately no fourth value for "absent". A step that did
not run is BLOCKED and says why. Every `--skip` flag records BLOCKED. **No flag can produce
green.**
**Honoured in:** `scripts/gate-runner.mjs`.

### 5. A detector must be able to read what it audits
Use a real parser where you can. **Never let a detector read its own output as evidence** — the
dead-weight audit excludes its own baseline for exactly this reason. Every scanning check needs a
companion assertion that its parse produced a non-empty result.
**Honoured in:** `scripts/audits/check-dead-weight.mjs`, `check-rule-coverage.mjs`.

### 6. Colour lives in exactly one file
`starter/design/tokens.json`. Generated theme files are **never** hand-edited. Application code
references semantic tokens, never literals.
**Honoured in:** `scripts/theme-build.mjs --check`, `audits/check-hardcoded-colors.mjs`, guard G4.

### 7. Fail-first evidence
A new behaviour rung is run against the pre-fix tree and its failure recorded — or the honest
negative `NOT OBSERVED FAILING:` with a reason.

A test never observed failing is not evidence that it can fail; it may encode exactly the
misunderstanding the code encodes.
**Honoured in:** guard G3, `docs/15-TEST-CASE-GENERATION.md` §6.

### 8. Registers are append-only
Newest first. Never renumber, never backfill, never hard-delete. A superseded entry is marked and
kept — old screenshots and old support answers still contain it.

---

## The rule budget

Rules are a **budgeted resource**, not a collection. A process nobody can hold in their head is
followed selectively, and selective following is indistinguishable from not following.

Before adding any prose rule, take the **cheapest workable** enforcement level:

```
automated check  >  checklist item  >  canonical-pattern row  >  prose rule
    (best)                                                      (last resort)
```

`checklists/SCREEN_CHECKLIST.md` is **capped at 20 items and declared full**. Adding one means
removing, merging or automating another. **The trade is the mechanism.**

Periodically propose **compaction**, not only growth.

---

## Where things are

| | |
|---|---|
| The map | `docs/00-OVERVIEW.md` |
| The spine | `docs/01-SDLC.md` |
| Runbooks | `workflows/` — invoked as `/request`, `/feature`, `/bug`, `/enhance`, `/refactor`, `/triage`, `/brainstorm`, `/test`, `/gate`, `/promote`, `/framework-update` |
| Intake ledger | `requests/` — one binding request file per ask, written by `/request` |
| Point-of-use checks | `checklists/` |
| Living registers | `docs/registers/` |
| The gates | `scripts/` |
| Evolution: version, upgrade, promotion, fixtures | `VERSION` · `UPGRADES.md` · `scripts/{lineage,upgrade,conformance}.mjs` · `fixtures/` · [docs/22](docs/22-FRAMEWORK-EVOLUTION.md) |
| Reference implementation | `starter/` |
| What every file is for | `FRAMEWORK_MANIFEST.md` |

---

## Working in this repository

- **Slash commands are POINTERS, never copies.** `.claude/commands/*.md` route you to the
  canonical runbook in `workflows/`. Duplicating a runbook guarantees two versions, and the
  drifted one is always the one someone finds first.
- **A change to a gate, guard, audit or runbook IS a behaviour change** — a guard fires or stays
  silent — so it carries test cases like any other. Guard G1 enforces this; scoping the case
  obligation to application code would exempt the process from its own rule by construction.
- **Adding a file** means adding it to `FRAMEWORK_MANIFEST.md` **and** `docs/00-OVERVIEW.md`. An
  unregistered file is one nobody maintains.
- **A framework change ends with the quadruple close-out** — process + flow + cases +
  **version** (`VERSION` bump + `UPGRADES.md` entry). A change without its version bump is
  invisible to every app's `upgrade` command: improved and undeliverable at the same time.
  MINOR/MAJOR changes must pass `npm run audit:compat` (fixtures must not go green → red).
- **The consistency sweep is the last step of every change**: do the runbooks, docs and
  checklists still agree on the gate list, the paths and the automation boundary? A worked
  example describing an older flow teaches the wrong flow, with confidence.

## Before finishing

```bash
npm run audit:all      # every gate
npm run guard:test     # EXECUTE every guard; prove each can still fire
npm run gate           # the ordered, three-valued gate
```

Then `checklists/DEFINITION_OF_DONE.md` — every item, or an explicit N/A with a reason.

## The safety floor — never weaken these, even if asked

The eight binding rules above · the production-approval gate · outbound-send deny-by-default ·
append-only registers and spec files.

If asked to weaken one, **push back and propose the safe alternative.**
