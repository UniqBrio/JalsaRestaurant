# Changelog

## 1.27.0 — the request pre-sorter is withdrawn

Owner decision, one release after it shipped. It classified a SINGLE sentence, and a real chat carries several requests at once - so its input was ambiguous exactly where the stakes are highest, and a confident wrong route costs an entire track. Set against that, it never demonstrated a measured saving: the case for it rested on one run's ground stage which also contained a long design conversation. Removing an unproven mechanism that can be confidently wrong is the correct trade, and the framework's own rule-budget guidance says to propose compaction, not only growth.

audit:all clean (10/10); guard:test 9/9 suites (31.7s parallel vs 2m09s serial); audit:compat clean, no fixture green to red. Live-reference sweep for classify.mjs / classify.test.sh / classify= across the tree: 0 outside git's own index and the append-only history in CHANGELOG.md and UPGRADES.md. Gate BLOCKED on G5-G8: pre-existing, no local tsc.
## 1.26.0 — delete is a declared contract; verification is per commit; requests are pre-sorted

Three things in one release, deliberately: the release itself demonstrates the middle one. Corrections that land in one commit share one verification pass, so batching them is not a shortcut - it is the correct unit.

Added: CP-26 - deleting a record. The reported defect was 'Supabase soft-deletes where the frontend expects a hard delete'. The backend was behaving exactly as the reference schema intends: status active|archived, a PARTIAL unique index, and no delete policy granted at all. The defect is that the two layers disagree about what delete means, and each is self-consistent - which is why a row returning on refresh, a re-add hitting a unique constraint and a stale id 404-ing present as three unrelated bugs. Every entity now declares ONE model in writing - ARCHIVE or REMOVE - and the assertion is a round trip, never the response to the delete call, which only proves the request was accepted. · A3.3b-delete in feature.md - the design pass asks the question before any delete control is drawn. Unasked, each layer picks an answer independently, and both are defensible. · The gate names an avoidable run. It verifies a TREE, not a change, so re-running it after each correction in one tree re-verifies the same tree N times - only the last run describes what ships. When the tree is byte-identical to the previous run the report says so. A NOTICE, never a block and never a cache: a gate that skipped work because it believed nothing had changed would be trusting a fingerprint over the code. · classify.mjs - the request pre-sorter, the first piece of the routing question. One command sorts the obvious requests into their track before any agent reads the nine-row table, and answers UNSURE rather than guessing. NEW vs NEW-APP it settles by looking for a source tree, because that is a fact about the repository and no amount of re-reading the sentence can answer it. workflows/request.md R1 remains the authority on what the classes mean. · Cases FW-DEL-001..002, FW-VERIFY-001, FW-CLASS-001..002. classify.test.sh (18 executed cases) joins guard:test, now ten suites.

audit:all clean (10/10); guard:test 10/10 suites (31.8s parallel vs 2m23s serial); audit:compat clean, no fixture green to red. Gate BLOCKED on G5-G8: pre-existing, no local tsc in this repository.
## 1.25.0 — four levers on execution time, aimed by measurement

Owner report: runs take too long, and the proposal was to replace English decision-making with code. Measured first, on this repository: the whole mechanical stack was ~87s against runs of 27 to 65 minutes, and instruction-interpretation was the SMALLEST term, not the largest. So the four changes here are aimed where the time actually is - generation, sequential checking, and repeated judgement - and the routing question is deliberately still open.

Added: Stage breakdown in the run log. run-log.mjs stage <ground|plan|build|verify|gate> marks each boundary from the clock, and the row carries ground 4m · plan 2m · build 14m beside the total. Closes the last part of FW-SPEED-003 that was still prose: a total says a run was slow, only the breakdown says what to fix. An unmarked stage is absent, never 0. · par.mjs - independent checks run concurrently. audit:all 17.7s to 5.7s; guard:test 60.2s to 29.4s; the mechanical stack 87s to ~41s, now nine suites rather than six. It also aggregates every failure instead of stopping at the first, so one run tells you everything that is wrong. It deliberately does NOT parallelise the gate, whose order is a prerequisite chain: there is no value in running a browser suite against code that does not compile. · review-plan.mjs - the review matrix, executed. Reads the diff and names the passes: scale derived and justified, reviewers selected with reasons, the same diff twice giving a byte-identical plan. The matrix in workflows/agents/README.md now points here for SELECTION and keeps the job of saying why each pass exists. · close-out.mjs - write the release story once. One record renders the upgrade section, the changelog paragraph and the commit message. Generation is the dominant cost of a run, and telling the same story four times by hand was the largest single block of writing in a close-out - three quarters of it transcription. The record carries the real sentences; the script owns only scaffolding and repetition. · Cases FW-STAGE-001..002, FW-PAR-001, FW-PLAN-001..002, FW-CO-001..002. Two new executed suites (review-plan.test.sh 20 cases, close-out.test.sh 23) in guard:test.

audit:all clean (10/10, 5.7s); guard:test 9/9 suites (38.1s parallel vs 2m45s serial); audit:compat clean, no fixture green to red. Gate BLOCKED on G5-G8: pre-existing, no local tsc in this repository.
## 1.24.0 — the run log

An audit log of runs: what was asked (in the requester's words), which kind of request it was,
when it started, when it ended, how long it took — plus the gate's own measured cost beside the
total, so every row says whether a long run was the machine or the agent. Written by
`scripts/run-log.mjs`, never by hand: a start time recorded once a run is over is a recalled
time, and v1.23.0's RC-008 is what that costs. `end` without `start` is BLOCKED rather than a
guessed duration; back-fills are explicit and marked on the row. Opened at `/request` R1,
closed at the Definition of Done. 23 executed cases, fail-first by defect injection. Seeding
the first rows immediately found a defect — they filed into the glossary table above the data
table, and the write reported success anyway — now fixed by anchoring on the data header and
held by its own regression case.

## 1.23.0 — verification learns to measure itself

Owner report: corrections are quick, verification exceeds an hour. Measurement, not intuition:
the whole mechanical stack is ~87s (`audit:all` 17.7 · `guard:test` 60.2 · `gate` 8.6), about
2.4% of it. Root cause (RC-008): the stage-timing rule shipped in v1.13.0 had no rung, so three
versions produced no number and the first slow stage was diagnosed by feeling — the exact
anti-pattern its own case names. And proportionality had only ever been applied to the build
half: T1's nine blocking sub-steps ran identically for a two-file fix and a schema migration.
Fix: the gate now times every step and names the slowest in the append-only ledger
(`gate-timing.test.sh`, 8 cases, 4 observed failing first); `test-gate.md` gains a verification
lane on the existing `SCALE:` declaration, with fail-first, the registry delta and the gate
itself marked never-scales. No check was removed. See `UPGRADES.md`.

## 1.22.0 - seventeen escaped defects, three process failures closed

Root cause of a release that shipped 17 defects through a green run (RC-007): rules that
existed but had no rung; rules that did not exist at all; and capabilities re-implemented
instead of reused, re-inheriting bugs the library had already fixed. Added: the
`check-fixture-leak` ratchet (placeholder data in shipped source), **CP-25** edit parity with
three new reference journeys as its rung, CP-15 amended for imported/pasted dates, and
`bug.md` C2b - the five classes a green suite cannot see. See `UPGRADES.md`.

## 1.21.0 - reuse before you build, and the components that proves it

framework-update Route B gains step 0 (read the component library first) and a four-way
capability decision recorded every run: REUSE what exists, REFINE the shared implementation
rather than working around it locally, CONTRIBUTE a baseline concern in the same run, or say
app-only. Four components close standing gaps: ConfirmDialog, MoreMenu (isolated sign out),
HelpSupport (email/call/WhatsApp) and sentence-case text formatting (DR-1). DESIGN_RULES gets
its first two rows. Fixed: the command shim said "triple close-out" and omitted the VERSION
leg. See `UPGRADES.md`.

## 1.20.0 — validated parallel build

Generation is the slowest part of a run and the only part parallel agents genuinely shorten. A
plan with 3+ independent tasks now builds in concurrent lanes: `scripts/fanout-check.mjs`
validates the plan first (blocking a file written by two tasks, a task reading a file another is
rewriting, or a task with no contract/acceptance), then one `implementation-builder` per lane is
spawned in a single message. Contracts are declared before any lane starts; integration and the
gate happen once, centrally. Review still follows the build — it never overlaps it. See
`UPGRADES.md`.

## 1.19.0 — the micro lane

A third scale below scoped, for the corrections you make every day: ≤2 files, no schema, no
new screen or component, not correction round ≥ 2. It skips the design pass, the plan document
and the QA verdict table; it keeps every mechanical gate, the freeze rule and the hard stops.
New guard **G8** checks a `SCALE: micro` claim against the actual diff and blocks an
over-reaching one with a single instruction — promote to scoped. Guard suite 10 → 17 cases.
See `UPGRADES.md`.

## 1.18.0 — CP-24: analytics and dashboards as a reusable module

A dashboard is now configuration, not code: business-agnostic components (MetricCard,
DashboardShell, InsightCard, BarChart, Sparkline, ProgressMeter, AnalyticsTable) driven by a
DashboardConfig, with four honesty rules enforced in the logic — direction is not sentiment,
growth from zero is null, absent is never zero, restricted metrics are removed not hidden.
Filters reuse CP-23; no charting dependency. Restaurant, gym, academy and badminton configs
ship as the proof. See `UPGRADES.md` and `docs/25`.

## 1.17.0 — CP-23: every list searchable, filterable, sortable

New ListControls / useListControls / list-controls lib: one search box across key fields
(phone digits normalised), multi-select filters, date presets (Today · This week · Last week ·
This month · Custom, local time, inclusive), stable asc/desc sort with blanks last, and a
matching/total count. CP-23 with an executable rung; a baseline concern in the component
library; asked for by A3.3b, the Track B Lists row, docs/04 and design QA. See `UPGRADES.md`.

## 1.16.0 — Codex wiring committed, four defects fixed first

`.codex/` (agents, hook adapter, hooks.json) and root `AGENTS.md` are now tracked. Before
committing: the absolute machine path in hooks.json made relative; the Codex adapter test now
tests the .codex copy (it was testing .claude's) and runs in guard:test; agent descriptions
synced to the v1.15.0 review matrix; AGENTS.md turned into a pointer to CLAUDE.md instead of
a drifted copy. Registered in manifest/overview/docs 21. See `UPGRADES.md`.

## 1.15.1 — fix: starter tsconfig rejected by tsc

`"//strict"` and `"//paths"` inside compilerOptions were TS5025 errors (unknown compiler
option) since the initial commit, making tsc fail on the config in every scaffolded app —
so the type gate never truly ran. Converted to real JSONC comments; content preserved. Apps:
remove or convert those two lines in your tsconfig, then re-run the gate. See `UPGRADES.md`.

## 1.15.0 — the third speed pass: reviewers by scale, in parallel

Root cause: all eleven review agents self-described as "use PROACTIVELY" and the runbooks
never scoped them, so a run could spawn up to ten cold sub-agents in sequence to review a
scoped change already analysed inline. Fix: a review matrix (scoped vs full-scale) wired into
every agent description — scoped runs spawn code-reviewer plus only the reviewers the diff
triggers, in one parallel message; blast radius, plan, gate run and close-out stay inline.
DoD and screen checklist now emit compact tables. See `UPGRADES.md`.

## 1.14.0 — module access + app customizer components

Two contributed reference components: ModuleAccessPanel (role preset as reset-to-role,
per-capability custom grants, deny-by-default, worded confidential marks, honest save label)
and ModuleCustomizer (enable/disable + button reorder, alwaysOn locks the toggle not the
position, enabled-only position badges). Pure logic in libs with unit specs — executed
against the compiled actual files, and observed failing when inverted. Registered under
Settings and Permissions in COMPONENT_LIBRARY. See `UPGRADES.md`.

## 1.13.0 — the second speed release

Root cause of remaining slowness: process weight — ~1,700+ lines of process docs read up
front and ~130 checklist items answered with hand-written evidence, much of it duplicating
mechanical audits. Fix: the three budgets. Reading — runbook + rules + touched registers
once, everything else opened at the named section; evidence — one verdict + one line per
AREA, audits cited never re-verified, scoped runs cover the core six areas plus touched;
writing — line caps on scoped artifacts. Run reports now carry stage timings. No check was
removed. See `UPGRADES.md`.

## 1.12.0 — requirements that drive design

The requirement→UI gap was a format gap: prose carries the what, not the facts simplicity is
built from. REQUEST_NEW gains a structured USAGE PROFILE (objective, workflow, frequency,
environment, essential/optional, frequent/occasional, automate/manual); docs/24 §3b translates
those facts into forced UI decisions mechanically; §3c adds the subtraction pass (see it? do
it? fewer steps?) with recorded evidence; the no-manual bar lands in the craft doc and design
QA. Unknown profile lines are asked at Gate 1, never invented. See `UPGRADES.md`.

## 1.11.0 — the component library

New COMPONENT_LIBRARY register: the standard baseline every app ships (themes, auth flows,
navigation, states — auto-Must-Have in the advisor pass), stack-keyed implementations seeded
from starter/ with honest GAP rows, a lookup-before-build order (app → library → build), and
a contribute-back loop — baseline builds register immediately, everything else faces
/promote's rule of three. Discover → reuse → build missing → register → reuse. See
`UPGRADES.md`.

## 1.10.0 — the product-advisor pass

For a new application or module, Gate 1 now researches comparable products (timeboxed,
sources declared), filters through context lenses (region, legal, customers, scale, industry
standards), and delivers a Must-Have / Recommended / Good-to-Have triage plus a reasoned
ignored list. Every question ships with a recommendation, its reasoning, alternatives, and an
always-available "Other" — the requester decides, in every run mode, in one consolidated
stop. Scoped in-area features skip the pass. See `UPGRADES.md`.

## 1.9.0 — the speed release

Run modes: **auto** (new default) turns gates 1–4 into logged checkpoints with an ASSUMPTIONS
ledger and an end-of-run report — no waiting; **confirm** keeps the old stop-and-approve.
Hard stops (destructive ops, capability removal, safety floor, production) and the mechanical
test gate bind in every mode. Proportional ceremony: a scoped feature produces one combined
RUN document instead of four gate artifacts. Root cause of the 40-minute run: four synchronous
human waits plus uniform maximum ceremony. See `UPGRADES.md`.

## 1.8.0 — a new app can be born through /request

New NEW-APP classification: a whole-new-application ask now routes through initialization
(docs/02, `npm run new:app`) before Track A runs inside the new app, with the request file —
scoped to the first shippable slice — moving into the new app's `requests/` as entry #1.
Scaffolds now seed the intake ledger. Previously such an ask misclassified as NEW and ran a
feature track with no application under it. See `UPGRADES.md`.

## 1.7.0 — the design release

The design stage becomes a design-intelligence layer. New: docs/24 (the planning method —
discovery, infer/investigate/ask, IA-first placement, the ten-stage pipeline, scoring),
docs/23 (the craft bar and the anti-gimmick rule), the 18-area design-quality checklist with
verdict + evidence and a validate→refine→re-validate loop (Gate 3 sees Production-ready or
better), the armed DESIGN_RULES register, the three-interaction budget, named primary actions,
contextual dialogs, keyboard parity (CP-22, A-10, Space selects tabs, a reference spec), and
the Claude Design canvas as a Gate 3 deliverable. Simplify the experience, not the capability.
See `UPGRADES.md`.

## 1.6.0 — one command, end to end

`/request` now continues into the classified track after writing the request file — for every
classification. The field review moves to the track's first gate, which opens by restating the
FIELDS "from your request — correct anything wrong"; a correction there updates the file before
work proceeds. Mixed input repairs the process half first. See `UPGRADES.md`.

## 1.5.0 — intake is the single entry point

Routed-out classifications (list, open situation, restructure, process failure) produce no
request file, so `/request` now continues directly into triage / brainstorm / refactor /
framework-update in the same run — the destination runbook's own gates still stop the work.
Mixed input hands its process half to framework-update in the same run. The field-review STOP
for NEW/CHANGE/BUG is unchanged. See `UPGRADES.md`.

## 1.4.0 — intake

`/request` turns rough words into ONE binding request file (`requests/`): classify, fill only
what was said (`unknown` never invented), stop. Stated fields bind the track; `unknown` fields
become its questions; CORRECTION ROUND ≥ 2 forces "what did the last fix miss" before any new
fix. Track B's vague "mini design pass" became the defined, mandatory-when-visual correction
design pass (states · both themes · string table · permissions). Ten process cases. See
`UPGRADES.md`.

## 1.3.0 — CP-21, wide tables

More than three columns means the user chooses which show and in what order, and the choice
persists. Gate step G11 (`audit:columns`, ratcheted), a reference `ColumnControl` +
`useColumnPrefs` in the starter, seven unit cases on `reconcileOrder`, and a review item for the
dynamically-built tables the audit cannot see. Promoted from `academies-dashboard` at n=1 by
owner override — recorded as such in `CANDIDATES.md`.

## 1.2.0 — the adoption-safety release

See `UPGRADES.md` (the canonical per-version entry). Everything found by running v1.1.0
against a real adopted app and a workspace scaffold: the workspace gate and commit guards now
actually run, adopted apps are offered seed files instead of being buried in them
(`--decline` to refuse, `--refresh` to take), the backward-compat gate can no longer pass on
stale results, and Half A now genuinely reaches standalone apps on upgrade.

## 1.1.0 — the evolution release

See `UPGRADES.md` (the canonical per-version entry) and `docs/22-FRAMEWORK-EVOLUTION.md`.
Lineage + upgrade + promotion + fixtures + backward-compat gate; quadruple close-out.
The fixtures caught RC-005 (adoption clobbering) and RC-006 (baseline first-entry loss)
before release.

## 1.0.0

Initial release.

### The process
- Eight-stage SDLC with six gates, and seven track runbooks (feature, enhance, bug, refactor,
  triage, brainstorm, framework update) plus a test gate.
- The learning loop: every root cause asks whether the process should have caught it, and the
  process repairs itself when the answer is yes.
- The rule budget: cheapest workable enforcement level, and a screen checklist capped at 20 items.

### The theme system
- `design/tokens.json` as the single source of truth for every colour and scale.
- Generated CSS custom properties and typed tokens; hand-editing the output is blocked.
- Three-state theme preference (light / dark / system) with no flash of the wrong theme.
- 92 contrast assertions across both themes, all passing, as a build gate.
- Per-theme brand assets, verified to exist, switched by CSS rather than JavaScript.

### The gates
- A generic ratchet engine: adopt any rule today, on any codebase, backlog can only shrink.
- Contrast · theme sync · theme assets · hard-coded colours · test-id coverage · rule coverage.
- A three-valued gate runner where BLOCKED is a verdict and green-by-omission is impossible.
- Seven commit guards with per-guard escape tokens, and an executable proof that each can fire —
  including a type-error ratchet, a case-loss guard, and a guard that holds *process* changes to
  the same test-case obligation as application code.

### The wiring (`.claude/` + `CLAUDE.md`)
- `CLAUDE.md` at the root — binding rules, read before every task, each stating what, **why**, and
  **where it is honoured in code**.
- `.claude/settings.json` wires the commit guards as a `PreToolUse` hook, so they run in **every**
  session — including the ad-hoc fix that never opened a runbook. Committed, because settings that
  live on one machine enforce nothing on anyone else.
- Nine slash commands, written as **pointers to `workflows/`, never copies** — duplicating a
  runbook guarantees two versions, and the drifted one is always the one someone finds first.
- Eleven review sub-agents, each with a scope, a boundary, and a machine-readable verdict.
- A hook-protocol adapter that recovers escape tokens from the **command** at commit time and from
  the **log range** at push time, because a guard must read the same *change* in both modes, not
  the same *string*.
- Nine executable adapter tests: a correct guard behind a broken adapter enforces nothing, and
  looks installed.
- `new-app.mjs` carries all of it into every scaffolded application.

### The starter
- Pure/impure split error taxonomy with a reference unit spec.
- Fail-closed API handler, config with fail-fast validation, signature-based logging.
- Reference migration, cloud-function pipeline, and three test tiers.
