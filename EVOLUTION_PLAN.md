# Evolution Plan — From Single Framework to Framework + Many Apps

**Status:** IMPLEMENTED — shipped as framework v1.1.0 and hardened in v1.2.0. This document is
kept as the historical record of the plan; the living reference is
`docs/22-FRAMEWORK-EVOLUTION.md`, and the per-version detail is in `UPGRADES.md`.
**Written:** 28-Aug-2026 · **Implemented:** 28–30-Aug-2026
**Language note:** written in simple English on purpose. Anyone on the team should be able to
read this and know what is changing and why.

---

## 1. What we are solving

Today the framework is one folder. When we create an app, the scaffolder **copies** the
framework into it. That copy is where improvements go to die: a lesson learned in app-one never
reaches app-two, and a framework improvement never reaches apps that already exist.

We will build apps in **two-digit numbers within 12 months**. Mostly our own, some shipped to
clients. Same tech stack for now.

### The goal loop

```
Framework → Create App → Develop App → Discover Improvement
    ↑                                        ↓
    ← Validate ← Improve Framework ← "Is it general or app-only?"
    ↓
Optionally upgrade existing apps
```

### The rules we must not break (from the requirements)

1. Existing features and workflows must keep working.
2. The framework stays independent — never just a pile of copied files inside an app.
3. App-specific changes must never leak into the framework by accident.
4. Framework improvements must be adoptable by old apps, in a controlled way.
5. Every framework change is validated automatically before it counts as stable.

---

## 2. The two decisions this plan is built on

### Decision 1 — The framework is TWO things, not one

| | Half A: THE PROCESS | Half B: THE SEED |
|---|---|---|
| What | `docs/` `workflows/` `checklists/` `scripts/` `.claude/` `templates/` | `starter/` (code, theme, tests, migrations) |
| Apps edit it? | **Never** | **Always** — that is its purpose |
| How it reaches an app | **Linked** (never copied) | **Copied once**, then tracked |
| On upgrade | Updated automatically | Compared file-by-file; a human decides |

Splitting these is what makes everything else simple. Half A can be updated freely because no
app ever changed it. Half B is *expected* to diverge, so upgrades there are a guided comparison,
never an overwrite.

### Decision 2 — One workspace for our apps; a versioned package for client apps

- **Our apps** live in one workspace next to the framework and point at it directly. Improve the
  framework once, every app sees it, and we can test everything together in one run.
- **Client apps** live in their own repos and get the framework as a normal versioned dependency.
  The client sees a clean repo; we decide when their version moves.

Rule of thumb: **inside the workspace = always current; outside = versioned and deliberate.**

---

## 3. The target shape

```
workspace/
├── framework/                     ← this repository, moved here unchanged
│   ├── docs/ workflows/ checklists/ scripts/ .claude/ templates/   (Half A)
│   ├── starter/                                                    (Half B)
│   ├── VERSION                    ← NEW: single version number, e.g. 1.0.0
│   ├── UPGRADES.md                ← NEW: what changed per version, what an app must do
│   └── docs/registers/CANDIDATES.md   ← NEW: parking lot for "maybe promote this"
│
├── fixtures/                      ← NEW: three tiny fake apps, used ONLY to test the framework
│   ├── minimal/                   bare scaffold, untouched
│   ├── with-debt/                 carries accepted baseline violations on purpose
│   └── diverged/                  has deliberately modified seed files
│
└── apps/
    ├── app-one/
    │   ├── .framework/lineage.json   ← NEW: "born from v1.2; these files, these fingerprints"
    │   ├── FRAMEWORK_ADOPTION.md     ← NEW: which versions adopted, what was skipped and why
    │   └── (its own code)
    └── app-two/ ...
```

A client app looks the same inside, except `framework` arrives as an installed package instead
of a workspace link.

---

## 4. The changes, as five workstreams

Ordered so each one is useful on its own, and nothing breaks in between.

---

### Workstream 1 — Reshape (the workspace and the version number)

*Everything else depends on this. No behaviour changes; things move.*

| # | Change | Details |
|---|---|---|
| 1.1 | Create the workspace | `workspace/` with `framework/`, `apps/`, `fixtures/` folders. Move this repo to `workspace/framework/` unchanged. |
| 1.2 | Add `VERSION` | One line: `1.0.0`. Read by the scaffolder, the upgrade tool, and the lineage file. `package.json` version is set from it, never the other way round. |
| 1.3 | Create `UPGRADES.md` | One section per version: what changed, whether it is PATCH / MINOR / MAJOR (see §6), and what an upgrading app must do. This is the file the upgrade tool reads out loud. |
| 1.4 | Split-awareness in the manifest | Mark every entry in `FRAMEWORK_MANIFEST.md` as Half A (process) or Half B (seed). One new column. This becomes the machine-readable source for what gets linked vs copied. |
| 1.5 | Scaffolder stops copying Half A | `new-app.mjs` today copies `scripts/ docs/ checklists/ workflows/ templates/ ci/ .claude/` into the app. Inside the workspace it will **link** them instead (thin wrapper scripts + a pointer file), so there is exactly one copy of the process. For a client app (`--standalone` flag) it still copies, and records that in the lineage file. |

**Existing-workflow safety:** the framework repo itself changes only by gaining three small
files (1.2–1.4). Every gate, guard and command keeps working unchanged. 1.5 changes only what
*future* scaffolds do.

---

### Workstream 2 — Lineage (knowing what an app received)

*The mechanical answer to "never clobber my work".*

| # | Change | Details |
|---|---|---|
| 2.1 | New script: `scripts/lineage.mjs` | Writes `.framework/lineage.json` at scaffold time: framework version, date, and a fingerprint (hash) of every seed file the app received. Three statuses per file: `pristine` (app never touched it), `modified` (app changed it), `expected-divergent` (meant to differ — `design/tokens.json`, `CLAUDE.md`, all registers). |
| 2.2 | Scaffolder writes it | `new-app.mjs` calls 2.1 as its last step. |
| 2.3 | `lineage --status` | Re-hashes the app's files and reports drift: which seed files are still pristine, which were modified. Read-only; useful on its own even before upgrades exist. |
| 2.4 | Template for `FRAMEWORK_ADOPTION.md` | New file in `templates/docs/`: a per-app log — version adopted, date, what was auto-applied, what was skipped **and why**. The scaffolder creates it empty. |

**Why the "skipped and why" column matters:** the real failure at two-digit scale is not tooling
— it is an app stuck on an old version with nobody remembering why. This file is the cheap fix,
and it must exist from day one, not be retrofitted.

---

### Workstream 3 — Upgrade (moving an app to a newer framework)

*The heart of the plan.*

| # | Change | Details |
|---|---|---|
| 3.1 | New script: `scripts/upgrade.mjs` | Run from inside an app. Compares the app's lineage file against the target framework version and produces a **plan first** (`--dry-run` is the default; applying requires `--apply`). |
| 3.2 | The three-way rule | Per seed file: **pristine** → update automatically. **modified** → show a side-by-side comparison; the human decides; never overwrite. **expected-divergent** → skip silently. Half A needs no comparison at all — linked apps get it instantly; standalone apps get it copied wholesale (they never edited it). |
| 3.3 | New gates arrive as ratchets, baselined on arrival | When an upgrade brings a new quality gate, the upgrade tool **generates the app's baseline from the app's current state** — all existing violations accepted, only new ones block. The build stays green on day one. This reuses `scripts/lib/ratchet.mjs` exactly as it is; it is the single property that satisfies "new practices without disrupting existing workflows". |
| 3.4 | Writes the adoption log | Every run appends to `FRAMEWORK_ADOPTION.md`: version, date, applied, skipped + why. Refuses to `--apply` if the app's git tree is dirty (an upgrade must be one clean, revertable commit). |
| 3.5 | Post-upgrade proof | The last step of `--apply` runs the app's own gate (`npm run gate`). The upgrade is not "done" when files land; it is done when the app's gate gives a verdict. BLOCKED is reported honestly, as always. |

**Command sketch** (what the user sees):

```
$ node framework/scripts/upgrade.mjs --to 1.3.0

UPGRADE PLAN  app-one : 1.1.0 → 1.3.0

Half A (process)                    linked — already current
Half B (seed)
  ✓ src/lib/logger.ts               pristine   → will auto-apply
  ⚠ src/theme/ThemeProvider.tsx     MODIFIED   → review required (diff below)
  ⊘ design/tokens.json              divergent by design → skipped
New gates
  + audit:inline-styles             will baseline at current state (23 accepted) — non-blocking
From UPGRADES.md
  ! 1.3.0 is MINOR — no mandatory action

Nothing has been changed. Re-run with --apply to proceed.
```

---

### Workstream 4 — Promotion (app lesson → framework improvement)

*Requirement 6. This changes the WORKFLOW files more than the code.*

| # | Change | Details |
|---|---|---|
| 4.1 | New register: `docs/registers/CANDIDATES.md` | The parking lot. Columns: candidate rule (stated **without** any app's business words) · source app + date · sightings count · status (`PARKED` / `PROMOTED` / `REJECTED` + why). Append-only like every register. |
| 4.2 | New workflow: `workflows/promote.md` + `/promote` command | The classification gate, run when an app fix looks general. Three filters, in order — **(1) Path test:** did it touch a framework-origin file at all? If only app feature code, stop: app-only. **(2) Domain-word test:** state the rule; if it cannot be said without naming a business thing, stop: app-only. Mechanically assisted: grep the proposed rule against the app's `PRODUCT_LEXICON.md`. **(3) Rule of three:** first sighting → PARK it (n=1). Second sighting **from a different app** → promote. |
| 4.3 | Human approval is the gate | The agent argues the case; a person decides. The verdict is one of `APP-ONLY` / `PARKED` / `PROMOTE`. Default is APP-ONLY — an eager classifier that over-promotes is the known failure mode, and a framework that absorbs one app's accidents becomes a museum of them. |
| 4.4 | Promotion routes into the existing machinery | A `PROMOTE` verdict runs the existing `/framework-update` (Route A/B) — incident entry, rule with a named rung, test cases, triple close-out. **No new promotion mechanics are invented**; we add only the classification gate in front of a workflow that already works. |
| 4.5 | Hook into Track C | One added step in `workflows/bug.md` close-out: after the root-cause entry, ask "could this class occur in another app?" If yes → run `/promote`. One line in the existing checklist, not a new ceremony. |

---

### Workstream 5 — Validation (proving a framework change is safe)

*Requirement 7. Machines prove it does not break; agents judge whether it is good.*

| # | Change | Details |
|---|---|---|
| 5.1 | Build the three fixtures | `fixtures/minimal` — a bare scaffold, never touched. `fixtures/with-debt` — carries deliberately baselined violations; **proves a new gate does not turn an existing app red**. `fixtures/diverged` — has deliberately modified seed files; **proves upgrades never clobber edits**. All three are domain-free and tiny. |
| 5.2 | New script: `scripts/conformance.mjs` | For each fixture: apply the current framework (link + upgrade), run the fixture's full gate, record the verdict. Three-valued like everything else; a fixture that cannot run reports BLOCKED, never silence. |
| 5.3 | New audit: `check-backward-compat.mjs` | Runs conformance **before and after** a framework change and diffs the verdicts. Any fixture going green → red = the change is not backward-compatible = blocked (or the change must declare itself MAJOR, see §6). This is the constraint "existing features must not break", tested instead of asserted. |
| 5.4 | Wire into CI and the gate runner | `conformance` becomes a step in `ci/github-actions-ci.yml` and a row in `gate-runner.mjs`. A framework change that skips it is BLOCKED. |
| 5.5 | Agent validation order | On every framework change, the existing agents run in this order: `blast-radius-explorer` (which apps/gates/workflows does this touch?) → **backward-compat check (5.3, mechanical)** → `code-reviewer` → `fresh-context-reviewer` → `close-out-auditor`. Only 5.3 is new; the rest already exist and already have this job. |

---

## 5. What changes in each existing file (the concrete edit list)

| File | Change | Size |
|---|---|---|
| `scripts/new-app.mjs` | Link Half A instead of copying (workspace mode); `--standalone` keeps copying; write lineage + adoption files | Medium |
| `FRAMEWORK_MANIFEST.md` | Add the Half A / Half B column | Small |
| `workflows/bug.md` | One close-out step: "general? → `/promote`" | Small |
| `workflows/framework-update.md` | Accept input from `/promote`; add "bump `VERSION` + write `UPGRADES.md` entry" to the triple close-out (making it a quadruple: process + flow + cases + **version**) | Small |
| `docs/00-OVERVIEW.md`, `README.md`, `CLAUDE.md` | Register the new files/commands; consistency sweep | Small |
| `ci/github-actions-ci.yml` | Add the conformance step | Small |
| `scripts/gate-runner.mjs` | Add the conformance row | Small |
| `package.json` | New scripts: `lineage`, `upgrade`, `conformance`, `audit:compat` | Small |
| **New files** | `VERSION` · `UPGRADES.md` · `docs/registers/CANDIDATES.md` · `workflows/promote.md` · `.claude/commands/promote.md` · `scripts/{lineage,upgrade,conformance}.mjs` · `scripts/audits/check-backward-compat.mjs` · `templates/docs/FRAMEWORK_ADOPTION.md` · `fixtures/*` · `docs/22-FRAMEWORK-EVOLUTION.md` (explains all of this) | — |

Nothing existing is deleted. Nothing existing changes behaviour except the scaffolder — and its
old behaviour survives as `--standalone`.

---

## 6. Version numbers, in one table

One number in `VERSION`, moved only by `/framework-update`, meaning defined for a *process*:

| Bump | Means | What an app must do |
|---|---|---|
| **PATCH** (1.2.**3**) | Wording, doc fixes, nothing behavioural | Nothing. Auto-adopt. |
| **MINOR** (1.**3**.0) | New optional capability, new advisory gate (arrives baselined), new doc | Nothing required. Adopt when convenient. |
| **MAJOR** (**2**.0.0) | A gate becomes blocking, a baseline format changes, a workflow step becomes mandatory | Explicit migration step, listed in `UPGRADES.md`, on the app's schedule. |

**Skew policy (decide now, while it is cheap):** apps must be within **2 MINOR versions** of
current; a MAJOR must be adopted within **one quarter**. The adoption log makes stragglers
visible; the policy makes them actionable.

---

## 7. Order of work and rough effort

| Phase | Workstreams | Effort | You get |
|---|---|---|---|
| **1** | WS1 + WS4 (reshape, promotion) | ~1–2 days | Workspace, version number, parking lot, `/promote`. Immediately useful; almost no new code. |
| **2** | WS2 + WS3 (lineage, upgrade) | ~1–2 weeks | Scaffold-with-lineage and the `upgrade` command. The core promise delivered. |
| **3** | WS5 (fixtures, conformance) | ~1 week | Framework changes proven safe automatically. |
| **4** | Standalone/client mode polish | when first client app ships | Versioned package for outside repos. Not before — no reason to carry the overhead early. |

Each phase leaves everything working. Phase 1 alone already fixes the biggest current problem
(lessons dying inside one app).

## 8. What we are deliberately NOT doing

- **No platform, no UI, no hosted service.** Git + a version number + three scripts do this job.
  A platform would add auth, hosting and an API to maintain, and none of them touch the hard parts.
- **No automatic propagation.** Upgrades are always app-initiated and human-approved. "Optionally
  propagate" is the requirement, and *optionally* is load-bearing.
- **No codemods yet.** A script that rewrites app code is expensive and brittle; we write one
  only when the same manual edit has been needed in **three** apps.
- **No promotion on first sighting.** n=1 parks; n=2 (different app) promotes.
- **No second copy of the process half.** Linked, or copied-wholesale for standalone apps — never
  edited per-app. An app needing to change a workflow file is a signal to run `/promote`, not to fork.

## 9. Risks, honestly

| Risk | Guard |
|---|---|
| Framework becomes a bottleneck (every fix waits on a classification) | The default verdict is APP-ONLY and the path test answers most cases in seconds. Classification must stay under a minute or it will be skipped. |
| Over-promotion (framework absorbs one app's quirks) | Rule of three + domain-word test + human gate. |
| Apps stuck on old versions | Adoption log + the skew policy in §6. |
| Upgrade clobbers app work | Lineage statuses: `modified` is never auto-applied; `diverged` fixture proves it stays true. |
| A "safe" change breaks an old app anyway | `with-debt` fixture + backward-compat audit run on every framework change. |
| This plan itself rots | It is governed by `/framework-update` like everything else: when it is approved, its contents move into `docs/22-FRAMEWORK-EVOLUTION.md`, the manifest, and the registers — and this file records the decision. |

---

## 10. What approval looks like

Reply with any of:
1. **"Approve Phase 1"** — reshape + promotion workflow begins (WS1 + WS4).
2. **"Approve the plan"** — all phases, in the stated order.
3. Edits — anything above is negotiable; the two §2 decisions are the load-bearing ones, so
   push on those first if anything feels wrong.
