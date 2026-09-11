# 22 — Framework Evolution

> How the framework and the apps built on it improve each other over time, without either
> breaking the other. Implemented from `EVOLUTION_PLAN.md` (v1.1.0); this document is the
> living reference, the plan is the historical record.

---

## The loop

```
Framework vN → create app → develop app → discover improvement
     ↑                                          ↓
     ← validate (fixtures + agents) ← /framework-update ← /promote (classify)
     ↓
apps adopt vN+1 via `upgrade`, each on its own schedule
```

## The two halves

| | Half A — PROCESS | Half B — SEED |
|---|---|---|
| What | `docs/ workflows/ checklists/ scripts/ .claude/ templates/ ci/` | `starter/` |
| Reaches an app by | **linked** (workspace) or copied wholesale (`--standalone`) | copied once, fingerprinted |
| Apps edit it? | never — the urge to is the signal to `/promote` | always — divergence is its purpose |
| On upgrade | instant (linked) or wholesale replace | three-way: pristine→auto · modified→review · divergent→skip |

The authoritative half-assignment lives in `FRAMEWORK_MANIFEST.md`.

## Versioning

One number in `VERSION`, moved **only** by `/framework-update` (the quadruple close-out's fourth
leg). Every bump gets an entry in `UPGRADES.md` — the file `upgrade.mjs` reads aloud to an
upgrading app.

| Bump | Means | App action |
|---|---|---|
| PATCH | wording/docs, nothing behavioural | none — auto-adopt |
| MINOR | new optional capability; new gate **arriving baselined** | none required |
| MAJOR | a gate becomes blocking; a format changes; a step becomes mandatory | explicit migration, listed in `UPGRADES.md` |

**Skew policy:** apps stay within 2 MINOR versions; a MAJOR is adopted within one quarter. The
per-app `FRAMEWORK_ADOPTION.md` makes stragglers visible; the policy makes them actionable.

## Lineage and upgrade

- `scripts/lineage.mjs` — the app's birth certificate: framework version + fingerprint of every
  seed file. `--init` adopts a pre-lineage app (**files already differing from the seed are
  recorded `adopted-modified`**, so no upgrade ever auto-overwrites them — a real defect class,
  caught by `fixtures/diverged` before release). `--refresh <file>` is the human sign-off after
  a hand-merge. `--status` reports drift, read-only.
- `scripts/upgrade.mjs` — plan first, always; `--apply` to act. Pristine → auto. Modified →
  incoming copy at `.framework/incoming/`, **never overwrite**. Expected-divergent → silent skip.
  Refuses a dirty git tree (one clean, revertable commit). New gates baseline themselves at the
  app's current state. Appends `FRAMEWORK_ADOPTION.md`. Done when the app's **gate gives a
  verdict**, not when files land.

## Promotion

`workflows/promote.md` — three filters (path → domain-word → rule of three), human-approved,
default APP-ONLY. n=1 parks in `docs/registers/CANDIDATES.md`; n=2 from a different app promotes
via `/framework-update` Route P. Track C asks the generality question at every bug close-out.

## Validation

- `fixtures/` — `minimal` (happy path) · `with-debt` (a new gate must not turn an existing app
  red) · `diverged` (upgrades must not clobber edits). Domain-free, governed, load-bearing debt.
- `scripts/conformance.mjs` — applies the framework to scratch copies of each fixture through
  the **real** upgrade pipeline; three-valued verdicts.
- `scripts/audits/check-backward-compat.mjs` — live conformance vs the committed
  `fixtures/expected-verdicts.json`, two-sided like every ratchet: green→red blocks, and a stale
  expectation also blocks. Gate-runner step **G10**; CI step; `npm run audit:compat`.
- Agent order on a framework change: `blast-radius-explorer` → **compat (mechanical)** →
  `code-reviewer` → `fresh-context-reviewer` → `close-out-auditor`.

## Proof it works

Building this system, the fixtures caught **two genuine defects before release** — the
`adopted-modified` clobbering bug and a baseline-writer bug that silently dropped every
baseline's first entry (`RC-005/RC-006` in the root-cause register). Machines prove; agents
judge. That is the division of labour, demonstrated.
