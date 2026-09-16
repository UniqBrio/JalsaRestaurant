# Framework Manifest

> Every file that constitutes the framework. A file not listed here is one nobody maintains.
> Maintained by [workflows/framework-update.md](./workflows/framework-update.md).

## The two halves (EVOLUTION_PLAN.md §2, decision 1)

Every entry below belongs to exactly one half, and the half decides how it reaches an app:

| Half | Contents | Reaches an app by | Apps may edit it? |
|---|---|---|---|
| **A — PROCESS** | `docs/` `workflows/` `checklists/` `scripts/` `.claude/` `templates/` `ci/` `CLAUDE.md` | **Linked** (workspace) or copied wholesale (`--standalone`) — never edited per-app | **Never.** Needing to edit a process file is the signal to run `/promote`, not to fork. |
| **B — SEED** | `starter/` — code, theme, tokens, tests, migrations | **Copied once** at scaffold, fingerprinted in `.framework/lineage.json` | **Always** — divergence is its purpose. Upgrades compare, never overwrite. |

`scripts/lineage.mjs` and `scripts/upgrade.mjs` read this split mechanically: the Half A path
list above is the authority for what gets linked, and everything under `starter/` is seed.

## Wiring — `.claude/` and `CLAUDE.md`
**This is what makes the framework load rather than merely exist.**

| File | Role |
|---|---|
| `CLAUDE.md` | Binding rules, read before every task |
| `.claude/settings.json` | Wires the commit guard as a PreToolUse hook. **Committed.** |
| `.claude/commands/*.md` | Eleven slash commands — **pointers to `workflows/`, never copies** |
| `.claude/agents/*.md` | Twelve sub-agents — eleven reviewers and one `implementation-builder` — each with a boundary and a verdict format |
| `.claude/hooks/pre-tool-use-guard.mjs` | Bridges the hook protocol to the git guard |
| `.claude/hooks/adapter.test.sh` | **Executes** the adapter — a correct guard behind a broken adapter enforces nothing |
| `.codex/agents/*.toml` · `.codex/hooks/*` · `.codex/hooks.json` | The same wiring for Codex: twelve agents (descriptions kept identical to `.claude/agents` — the review matrix applies), the same hook adapter, `hooks.json` with a **relative** command path. Framework-repo wiring today: not yet in `HALF_A`, so scaffolds do not carry it |
| `AGENTS.md` | Vendor-neutral **pointer** to `CLAUDE.md` — never a second copy of the rules |

## Entry points
| File | Role |
|---|---|
| `README.md` | What this is and how to start |
| `docs/00-OVERVIEW.md` | The map |
| `docs/01-SDLC.md` | The spine: tracks, stages, gates, the learning loop |

## Reference documentation — `docs/`
`02` initialization · `03` structure · `04` architecture · `05` configuration · `06` errors ·
`07` security · `08` cloud · `09` code quality · `10` documentation · `11` theme · `12` themes
light/dark · `13` contrast and accessibility · `14` assets · `15` test cases · `16` testing ·
`17` ratchets · `18` deployment · `19` AI agents · `20` glossary · `21` agent wiring ·
`22` framework evolution · `23` design craft · `24` design planning · `25` analytics and dashboards

## Runbooks — `workflows/`
| File | Track |
|---|---|
| `request.md` | Intake, the single entry point — rough words → one binding request file in `requests/`, then straight into the classified track (FIELDS confirmed at its first gate) |
| `feature.md` | A — new feature, gates 1–4 |
| `enhance.md` | B — modify an existing feature |
| `bug.md` | C — bug fix |
| `refactor.md` | D — refactor |
| `triage.md` | 0 — a list of items |
| `brainstorm.md` | E — no clear next action |
| `test-gate.md` | The merge gate |
| `promote.md` | P — classify an app lesson: app-only, parked, or promoted |
| `framework-update.md` | F — the process learns |

## Point-of-use checks — `checklists/`
`SCREEN_CHECKLIST.md` *(capped at 20 items)* · `DESIGN_QUALITY_CHECKLIST.md` *(the Gate 3
judge — 18 areas, verdict + evidence each)* · `DEFINITION_OF_DONE.md` ·
`CODE_REVIEW_CHECKLIST.md` · `SECURITY_CHECKLIST.md` · `ACCESSIBILITY_CHECKLIST.md` ·
`RELEASE_READINESS.md` · `BUSINESS_READINESS.md` · `MANUAL_TEST_CHECKLIST.md`

## Review passes — `workflows/agents/README.md`
Eleven narrow reviewers and one builder, with explicit boundaries and machine-readable verdicts.

## Registers — `docs/registers/`
`ROOT_CAUSE_REGISTER.md` · `CANONICAL_PATTERNS.md` · `DESIGN_RULES.md` ·
`COMPONENT_LIBRARY.md` *(stack-keyed reusable implementations + the standard baseline)* ·
`KNOWN_LIMITATIONS.md` · `RBAC_MATRIX.md` · `FEATURE_TRUTH.md` · `PRODUCT_LEXICON.md` ·
`AI_GOVERNANCE.md` · `ENVIRONMENTS.md` · `TEST_ACCOUNTS.md` · `TECH_DEBT.md` ·
`DECISION_LOG.md` · `CANDIDATES.md`

## Templates — `templates/`
`gates/` GATE1_QUESTIONS · FEASIBILITY_BRIEF · IMPLEMENTATION_PLAN
`docs/` ADR · MODULE_DOC · ROOT_CAUSE_ENTRY · RELEASE_NOTES · AGENTS
`requests/` REQUEST_NEW · REQUEST_CHANGE · REQUEST_BUG *(filled by `/request`, consumed by tracks A/B/C)*
`tests/` TEST_CASE · TEST_SUMMARY

## Intake ledger — `requests/`
`README.md` *(the folder contract)* plus one committed `<date>-<slug>.md` per ask, written by
`workflows/request.md`. Stated fields bind the consuming track; correction round N names
round N−1's file.

## Framework process cases — `tests/cases/`
`FRAMEWORK_PROCESS_CASES.md` — manually-executed cases for the process's own behaviour
(intake classification, binding-field discipline, the Track B correction design pass).

## Executable — `scripts/`
| File | What it enforces |
|---|---|
| `theme-build.mjs` | Generates the theme; `--check` blocks hand-edited output |
| `check-contrast.mjs` | Every declared pair, both themes. Ratcheted. |
| `check-theme-assets.mjs` | A real file per theme, per declared asset |
| `gate-runner.mjs` | The ordered, three-valued gate. Writes the dated report. |
| `new-app.mjs` | Scaffolds an application from `starter/` |
| `lib/color.mjs` | WCAG luminance and contrast. No dependencies. |
| `lib/ratchet.mjs` | The generic no-worse-than-yesterday engine |
| `lib/layout.mjs` | Resolves default paths in both layouts: framework repo (`starter/…`) and scaffolded app (root) |
| `audits/check-hardcoded-colors.mjs` | Nothing bypassed the token system |
| `audits/check-testid-coverage.mjs` | Interactive elements are addressable |
| `audits/check-rule-coverage.mjs` | Every rule names its enforcement point |
| `audits/check-fixture-leak.mjs` | Placeholder data wired into a screen a user can reach (ratcheted) |
| `audits/check-column-control.mjs` | A table wider than three columns lets the user choose its columns (CP-21) |
| `hooks/pre-commit-guard.sh` | Close-out obligations, per-guard escape tokens |
| `hooks/guard-reachability.test.sh` | **Executes** the guard, proving each one can fire |
| `upgrade.test.sh` | **Executes** lineage + upgrade against scratch apps — the behaviour rung for the three-way rule |
| `fanout-check.mjs` | Validates a parallel-build plan before any agent is spawned: no file written twice, no task reading another's write, every task declaring a contract and an acceptance |
| `fanout-check.test.sh` | **Executes** the validator — each block observed firing, each pass observed passing |
| `gate-timing.test.sh` | **Executes** the gate runner and proves the report states its own cost — total, slowest step, per-step duration, and `-` for a step that never ran. The rung under FW-SPEED-003 (gate stage) |
| `gate-scope.test.sh` | **Executes** the gate runner and proves it tells the truth about its **subject** — that the application steps run where the application actually is (`starter/` here, the root in a scaffolded app), and that a run narrowed by `--only`/`--skip` never records the whole tree as verified. The rung under RC-009 |
| `theme-build.test.sh` | **Executes** the theme builder and proves its output is a function of its inputs alone — identical tokens build byte-identically from any working directory, `--check` agrees from both the framework root and the application, and a genuinely hand-edited file is still caught. The rung under RC-009 |
| `run-log.mjs` | Appends a row to the run log: what was asked, its type, and a **measured** duration. Reads the clock at `start` and at `end`; refuses to invent a start it never took |
| `run-log.test.sh` | **Executes** the logger — including that `end` without `start` is BLOCKED rather than a guessed duration |
| `starter/src/lib/pwa.ts` | CP-30: the installability and update DECISIONS as pure functions — install state (installed outranks dismissed outranks available), update state (a waiting worker is an update only where one already controls the page), display mode (including iOS, which predates the media query), and whether registering a worker is appropriate at all |
| `starter/src/components/PwaProvider.tsx` | CP-30: owns the browser APIs and the affordances — registers the worker, captures the deferred install prompt, and surfaces "you can install this" and "a new version is ready". Decides nothing itself; every branch asks `src/lib/pwa.ts` |
| `starter/src/app/layout.tsx` | The root layout, and the only place PWA support has to be wired: links the generated manifest, sets a theme-color per colour scheme, points `apple-touch-icon` at the raster, and mounts `<ThemeProvider>` + `<PwaProvider>`. It ships so that "installable with no manual configuration" is true in the box |
| `starter/public/sw.js` | CP-30: the service worker. Network-first for HTML (cache-first pins users to a version that no longer exists), stale-while-revalidate for content-addressed assets, and the data layer never cached at all. Never calls `skipWaiting()` on its own |
| `starter/tests/unit/pwa.unit.spec.ts` | The rung under CP-30's decision half — 11 assertions executed against the compiled lib |
| `starter/src/features/items/{types,items.api}.ts` · `ItemsScreen.tsx` · `ItemForm.tsx` | **The reference screen** - the subject of every spec under `tests/functional/`, which described it for as long as they existed while nothing served it. Composes TabRow, ListControls, Dialog, ConfirmDialog and ToastHost; builds no second implementation of any of them. Archive model (CP-26), edit parity (CP-25), re-read after every write |
| `starter/docs/modules/items.md` | The reference screen's module doc: what it composes and builds none of, the rules it encodes (re-read after every write · the verb matches the model · edit arrives populated · Save hands control back), and how to run it |
| `starter/next.config.mjs` | Inlines the framework's `PUBLIC_*` variables into the client bundle. Next only inlines `NEXT_PUBLIC_*` on its own, which left `publicConfig` throwing at import in every client component - found the first time G8 could boot the app |
| `starter/eslint.config.js` | Gate G6's configuration: the two recommended sets and nothing else, with generated files and `public/` excluded. G6 had no configuration to run against until it did |
| `starter/src/lib/audit.ts` | CP-27: the audit model — actor resolution that never invents "System", secret redaction, set-diffing so a reorder is not a change, and the three RBAC event builders. No updater, no deleter |
| `starter/src/components/AuditLogTable.tsx` | CP-27: the audit log table. Read-only by construction; composes CP-23 and CP-21 rather than rebuilding search, filters, sorting or column control |
| `starter/tests/unit/audit.unit.spec.ts` | The rung under CP-27 — 19 assertions executed against the compiled lib |
| `starter/src/lib/loading.ts` | CP-3 (user half): the waiting screen's decision — working / slow / stalled, configurable copy that falls back rather than blanking, and thresholds repaired so the stalled state can never be unreachable |
| `starter/src/components/LoadingScreen.tsx` | The full-surface wait: the promise, the named stages, a `currentColor` line diagram needing no per-theme asset, and a route onward once stalled |
| `starter/tests/unit/loading.unit.spec.ts` | The rung under CP-3's user half — 7 assertions executed against the compiled lib |
| `starter/src/lib/pricing.ts` | CP-29: the money breakdown — rows rounded once and summed, tax after adjustments, pass-through out of revenue, an over-discount reported not clamped |
| `starter/src/components/PricingPanel.tsx` | CP-29: the one itemised price breakdown, for screen, dialog, export and print. Reuses the shared currency formatter; never adds up its own props |
| `starter/tests/unit/pricing.unit.spec.ts` | The rung under CP-29 — 11 assertions executed against the compiled lib |
| `starter/src/lib/undo.ts` | CP-28: undo as a **deferred commit** — the window, the refusals (`too-late`, `already-undone`), overflow that commits rather than drops, and the message composed from real values |
| `starter/src/components/ToastHost.tsx` | CP-28: the message carrying Undo. Owns the clock; drains pending commits on tick and on unmount, so no action is silently discarded |
| `starter/tests/unit/undo.unit.spec.ts` | The rung under CP-28 — 9 assertions executed against the compiled lib |
| `starter/src/lib/selection.ts` | CP-18: the set arithmetic behind the checkboxes — three-state header, visible-set scope, reconciliation that reports what a filter change dropped |
| `starter/src/components/SelectionColumn.tsx` | CP-18: the row checkbox and the indeterminate header checkbox, as native inputs (CP-22) |
| `starter/tests/unit/selection.unit.spec.ts` | The rung under CP-18's selection half — 9 assertions executed against the compiled lib |
| `starter/src/components/components.css` | The shared visual treatments: tabs (DR-3), toasts, the wait, the price breakdown, row selection. Semantic tokens only — no literal, no second stylesheet to drift |
| `par.mjs` | Runs independent checks **concurrently** and reports each one's cost. Backs `audit:all` and `guard:test`; deliberately NOT the gate, whose order is a prerequisite chain. Aggregates every failure instead of stopping at the first |
| `review-plan.mjs` | Decides **which review passes a change needs, from the diff** — the executable form of the review matrix, and the authority for selection |
| `review-plan.test.sh` | **Executes** the selector against built diffs in scratch repositories, including that the same diff twice yields a byte-identical plan |
| `close-out.mjs` | Renders the release story **once** into the four places it must appear (upgrade notes, changelog, commit message, summary). Owns scaffolding and duplication; never the prose |
| `close-out.test.sh` | **Executes** the generator — one record reaches every rendering, and `--apply` can never overwrite a prior entry |
| `hooks/tsc-baseline.sh` | Regenerates the type-error ratchet baseline |
| `audits/check-dead-weight.mjs` | Scripts nothing references any more (review candidates) |
| `audits/check-pwa-baseline.mjs` | CP-30, gate **G12**: is this application actually installable? Manifest present and complete · every declared icon resolving to a real file · a maskable raster among them · a service worker that handles fetch · something that REGISTERS it · something that LINKS the manifest · an offline fallback the worker names. Ratcheted, so an adopting app arrives baselined |
| `ratchet.test.sh` | **Executes** the ratchet engine and its two consumers (`par.mjs`, the gate) and proves they speak three values: no baseline is exit 3 — BLOCKED, the check did not run — never 0, never 2; `par` labels it BLKD and exits 3; a FAIL still outranks it. The rung under RC-010 |
| `pwa-baseline.test.sh` | **Executes** that audit against thirteen scratch applications, each broken in exactly one way — and one that is not broken at all, because a gate nobody can satisfy is a gate that gets switched off |
| `lib/shpath.sh` | CP-31. Hands a filesystem path from the shell into **JavaScript source**, where the shell's argv translation does not reach. `jspath` for anything `fs` opens; `jsurl` for an ESM specifier, the only form Node accepts. Sourced by every harness that crosses the boundary — RC-012 |
| `audit-scope.test.sh` | **Executes** the dead-weight audit and proves its verdict states a SCOPE line — what it looked at, what it declined, and not to cite it as `src/` coverage. Written for the 11-Sep-2026 close-out that read "CLEAN GATE" as "dead weight deleted" while 1,988 unreferenced lines sat in `src/components/`. The audit was honest; the verdict was unreadable. Plants an unreferenced script to prove the scope survives a BLOCKED verdict, with the probe's name assembled at runtime — written out, it would appear in this harness, which the audit scans for references, and the plant would never fire |
| `shpath.test.sh` | **Executes** those helpers, and sweeps every shell harness in the tree for the raw-path form that caused RC-012 — then plants a violation and proves the sweep fires on it, because a sweep never observed failing is not evidence it can fail |
| `lib/png.mjs` | Writes a valid PNG with no dependency (Node's own zlib). Exists so the maskable launcher icons can be GENERATED from the tokens: committed as binaries they would be the one brand asset that ignores a rebrand, and a rasteriser would put a native-compiled package in the path of every scaffold for two flat images |

## Evolution — versioning, lineage, promotion *(Half A)*
| File | Role |
|---|---|
| `VERSION` | The framework's single version number. Moved only by `/framework-update`. |
| `UPGRADES.md` | Per-version: what changed and what an app must do. Read by `upgrade.mjs`. |
| `EVOLUTION_PLAN.md` | The approved plan this system was built from (historical record). |
| `scripts/lineage.mjs` | Writes/refreshes an app's `.framework/lineage.json` (file fingerprints). |
| `scripts/upgrade.mjs` | Plan-first app upgrade: pristine→auto, modified→review, divergent→skip. |
| `scripts/conformance.mjs` | Applies the framework to every fixture and runs its gate. |
| `scripts/audits/check-backward-compat.mjs` | Conformance before vs after — a fixture going green→red blocks. |
| `workflows/promote.md` | The app-lesson → framework-improvement classification gate. |
| `docs/registers/CANDIDATES.md` | Parking lot for n=1 promotion candidates. |
| `templates/docs/FRAMEWORK_ADOPTION.md` | Per-app adoption log template. |
| `fixtures/` | Three tiny domain-free apps: `minimal` · `with-debt` · `diverged`. |
| `docs/22-FRAMEWORK-EVOLUTION.md` | How versioning, upgrade, promotion and conformance work. |

## Reference implementation — `starter/` *(Half B — the seed)*
`design/tokens.json` *(the only file containing a colour)* · `src/theme/` · `src/lib/` ·
`tests/{unit,render,functional}/` · `supabase/{migrations,functions/_shared}/` ·
`playwright.config.ts` · `tsconfig.json` · `.env.example`

## CI — `ci/github-actions-ci.yml`

Copy to `.github/workflows/ci.yml`. It **calls** `npm run audit:all` and `npm run guard:test`
rather than restating the checks they contain, then runs the application's own type, lint and
test scripts. Enumerating the audits here would make this file a hand-maintained copy of
`audit:all`, and it drifted exactly that way once (RC-009): two audits sat in the script and
not in CI, so neither could fail a pull request. A new audit is now wired into CI by the same
edit that adds it to the script.

**Two jobs, deliberately asymmetric.** `gate` runs the whole pipeline on `ubuntu-latest`.
`self-tests-windows` runs only `audit:all` and `guard:test`, on `windows-latest`, with
`shell: bash` because the suites are bash scripts and the runner's default is pwsh. It exists
because RC-012 was invisible to a POSIX-only CI: a path crossing from the shell into JavaScript
source resolves differently where the shell's path namespace and the interpreter's disagree,
and ubuntu is where they agree. It installs no browsers and runs no application gate — those
exercise the app's toolchain, which is not where that class lives. Decision 003.

**The installed copy is a COPY, and nothing compares them.** This file is a template; CI runs
whatever is in `.github/workflows/`. The two drifted within an hour of the first install, and
this is currently caught by remembering — honest debt, recorded in v1.35.0's notes.

---

## Adding a file
1. Add it to this manifest **and** to `docs/00-OVERVIEW.md`.
2. If it introduces a rule, the rule names where it is enforced.
3. Run the consistency sweep: do the runbooks, docs and checklists still agree on the gate list,
   the paths, and the automation boundary?
