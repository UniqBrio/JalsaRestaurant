# Changelog

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
