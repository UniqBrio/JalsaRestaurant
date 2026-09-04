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
| `.claude/agents/*.md` | Eleven review sub-agents, each with a boundary and a verdict format |
| `.claude/hooks/pre-tool-use-guard.mjs` | Bridges the hook protocol to the git guard |
| `.claude/hooks/adapter.test.sh` | **Executes** the adapter — a correct guard behind a broken adapter enforces nothing |

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
`22` framework evolution

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
`SCREEN_CHECKLIST.md` *(capped at 20 items)* · `DEFINITION_OF_DONE.md` ·
`CODE_REVIEW_CHECKLIST.md` · `SECURITY_CHECKLIST.md` · `ACCESSIBILITY_CHECKLIST.md` ·
`RELEASE_READINESS.md` · `BUSINESS_READINESS.md` · `MANUAL_TEST_CHECKLIST.md`

## Review passes — `workflows/agents/README.md`
Eleven narrow reviewers with explicit boundaries and machine-readable verdicts.

## Registers — `docs/registers/`
`ROOT_CAUSE_REGISTER.md` · `CANONICAL_PATTERNS.md` · `KNOWN_LIMITATIONS.md` · `RBAC_MATRIX.md` ·
`FEATURE_TRUTH.md` · `PRODUCT_LEXICON.md` · `AI_GOVERNANCE.md` · `ENVIRONMENTS.md` ·
`TEST_ACCOUNTS.md` · `TECH_DEBT.md` · `DECISION_LOG.md` · `CANDIDATES.md`

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
| `audits/check-column-control.mjs` | A table wider than three columns lets the user choose its columns (CP-21) |
| `hooks/pre-commit-guard.sh` | Close-out obligations, per-guard escape tokens |
| `hooks/guard-reachability.test.sh` | **Executes** the guard, proving each one can fire |
| `upgrade.test.sh` | **Executes** lineage + upgrade against scratch apps — the behaviour rung for the three-way rule |
| `hooks/tsc-baseline.sh` | Regenerates the type-error ratchet baseline |
| `audits/check-dead-weight.mjs` | Scripts nothing references any more (review candidates) |

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

---

## Adding a file
1. Add it to this manifest **and** to `docs/00-OVERVIEW.md`.
2. If it introduces a rule, the rule names where it is enforced.
3. Run the consistency sweep: do the runbooks, docs and checklists still agree on the gate list,
   the paths, and the automation boundary?
