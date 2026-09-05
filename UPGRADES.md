# Upgrade Log

> One section per framework version, **newest first**. This is the file `scripts/upgrade.mjs`
> reads out loud to an upgrading app, so every entry answers one question plainly:
> **what must an app do to adopt this version?**
>
> Bump meanings (defined for a *process*, see `docs/22-FRAMEWORK-EVOLUTION.md`):
> **PATCH** — wording/doc fixes, nothing behavioural → apps do nothing.
> **MINOR** — new optional capability or advisory gate (arrives baselined) → nothing required.
> **MAJOR** — a gate becomes blocking, a baseline format changes, a workflow step becomes
> mandatory → explicit migration step listed here, on the app's schedule.

---

## 1.11.0 — 05-Sep-2026 — MINOR

**The component library: discover → reuse → build the missing piece → register → reuse.**
The same functionality was being rebuilt per app — auth flows, theme plumbing, navigation,
shared states — costing time and breeding inconsistency. The framework already *was* a
component library for one stack (`starter/`); what was missing was the registry, the
lookup-before-build step, and the contribute-back loop.

### Added
- **`docs/registers/COMPONENT_LIBRARY.md`** — the central registry. §1 the **standard
  baseline** every app includes regardless of business requirements (light+dark themes and
  theme configuration, login/logout/forgot/reset, navigation shell, shared states, data
  plumbing, safety defaults) — the advisor pass places these in Must-Have automatically and
  spends no research on them. §3 implementations **keyed by stack**: the reference stack
  (`typescript-react-postgres`) seeded from `starter/` with honest **GAP** rows for what is
  wanted but not yet built (login/logout screens, forgot/reset flow, header/footer shell,
  common forms) — a row is a claim that working code exists, never an intention. New stacks
  get their own subsection pointing at one implementation repository each.
- **The lookup order** (feature.md A3.1, docs/24 §6): this app → the library for this stack →
  build. Rebuilding a registered component is a defect — the CANONICAL_PATTERNS rule applied
  to components.
- **The contribute-back loop** (registry §4, promote.md, DoD): a component built for a
  *baseline* concern is generalized (lexicon-grep clean), registered, and its GAP row flipped
  READY **in the same change** — baseline concerns were declared common in advance, so they
  skip the rule of three. Every other reusable-looking component still goes through
  `/promote` (park n=1, promote at n=2 from a different app) — the museum-of-accidents guard
  stands.
- `docs/02` step 2: a non-reference stack reads the registry first; unbuilt baseline concerns
  are built once against the same standards and contributed back, so the next app on that
  stack starts where this one finished.
- Cases FW-LIB-001..003; a DoD item carries the contribute-back obligation.

### App action required
**None.** Reference-stack apps already receive the library via the scaffold; the registry
makes it discoverable and gives its gaps a place to close.

---

## 1.10.0 — 05-Sep-2026 — MINOR

**The product-advisor pass.** For a new application or a new module there is no codebase to
answer scope questions from — they are product decisions, and guessing them ships the wrong
v1. Gate 1 now runs as an advisor for those cases: **research → context → questions →
recommend with reasoning → alternatives → the requester decides.**

### Added
- **`docs/24` §2 — the product-advisor pass.** Timeboxed research (3–5 comparable products,
  one pass; web research where available, model knowledge declared and dated where not);
  candidate features filtered through explicit context lenses (complexity, type/purpose,
  region and market, legal/regulatory/cultural, business context, target customers,
  scale/growth, industry standards, deliberate exclusions); triaged **Must-Have /
  Recommended / Good-to-Have**, each tier reasoned, plus the **ignored list** — features
  found in research and deliberately excluded, with why. Research is input, never authority.
- **Question format hardened** (`GATE1_QUESTIONS.md`, `feature.md` A1, `01-SDLC` Stage 1):
  every question carries the recommendation, *why it wins here*, and real alternatives;
  options always end with **"Other: describe your own"**; the requester's choice — including
  a custom one — binds like a stated FIELD.
- **Run-mode interaction defined:** the triage + questions are ONE consolidated package and
  a **hard stop in every run mode** — scope is the requester's decision and is expensive to
  undo. A scoped in-area feature skips the advisor pass entirely, so the 1.9.0 speed win is
  untouched where it matters.
- `REQUEST_NEW.md` gains a `MARKET / REGION` field feeding the regional/legal lenses.
- Cases FW-ADVISOR-001..003.

### App action required
**None.** The pass fires only for new applications and new modules.

---

## 1.9.0 — 05-Sep-2026 — MINOR

**The speed release: run modes and proportional ceremony.** Root-cause finding from a real
comparison (a bulk-import feature: ~40 minutes here vs ~5 minutes in the owner's previous
lighter flow): (1) Track A blocked **four times** waiting for a human — the synchronous
round-trips, not the work, dominated wall-clock; (2) every feature ran maximum ceremony —
four separate gate artifacts, the full 18-area loop, a canvas — regardless of size; (3) prose
restated and registers re-read across stages.

### Added
- **Run modes** (`docs/01` §Run modes). **auto** *(new default)*: gates 1–4 become
  checkpoints — the artifact is produced in full, open decisions are taken on the written
  recommendation and logged to the run's **ASSUMPTIONS ledger**, and the run proceeds
  immediately. **confirm**: the pre-1.9.0 behaviour, every gate waits — chosen with
  `RUN MODE: confirm` in the request file or by saying so. Auto moves the review to the end
  (the run report: FIELDS + ledger + artifacts + QA verdicts + preview URL); it never removes
  it. Stated request FIELDS bind identically in both modes.
- **Hard stops that survive auto**: destructive/hard-to-reverse operations, capability
  removal or reshaping, the safety floor, outbound sends, production (Gate 6 is human in
  every mode), and genuine expensive forks. The mechanical test gate blocks in every mode.
- **Proportional ceremony**: the run declares its **scale** at Step 0. A *scoped* feature
  (≤5 files, additive-only schema, no new nav area or shared component) produces ONE combined
  `RUN_<feature>.md` instead of four gate artifacts, skips the feasibility brief unless
  build-vs-buy is real, and skips the canvas in auto mode. Obligations identical — states,
  themes, keyboard, verdicts all still checked — only the packaging shrinks.
- **Speed discipline** (Track A Step 0): registers read once per run, terse tables over
  prose, no restating, independent checks batched.

### Changed
- `workflows/feature.md` (Step 0 items 7–8, gates 1–4, close-out run report),
  `workflows/enhance.md` (B3/B4), `workflows/refactor.md` (D0), `workflows/request.md`
  (RUN MODE capture), both request templates (RUN MODE field + standing instructions),
  `docs/01-SDLC.md`, `README.md`, `.claude/commands/feature.md`. Cases FW-MODE-001..004.

### App action required
**None mechanically — but note the default changed:** a run with no `RUN MODE` stated now
proceeds through gates 1–4 without waiting. Any requester who wants the old behaviour writes
`RUN MODE: confirm` in the request file or says so. Production approval and the test gate
are unchanged in every mode.

---

## 1.8.0 — 05-Sep-2026 — MINOR

**A new app can now be born through `/request`.** Audit finding: a whole-new-application ask
("build me a CRM") classified as **NEW** and dropped into Track A — a feature track whose
Step 0 reads the app's rules, registers and sibling screens, none of which exist for a
greenfield product. There was no intake route to initialization, so the one command that is
supposed to start *any* work could not start an application.

### Added
- **NEW-APP classification** in `workflows/request.md` — the test is whether a scaffolded
  codebase exists to receive the work. The flow: REQUEST_NEW scoped to the **first shippable
  slice** (the rest listed in EXPLICITLY OUT as later `/request` runs — an application is a
  list, and a list is triage's job, not one request file's) → continue into
  `docs/02-PROJECT-INITIALIZATION.md` (`npm run new:app`, day-one steps) → the request file
  moves into the new app's `requests/` as its first ledger entry → Track A runs **inside the
  new app**, first gate restating the FIELDS as always. Empty registers and the starter as
  the sibling pattern are stated as expected, not blockers.
- `scripts/new-app.mjs` seeds the **`requests/` intake ledger** (folder + contract README)
  in every scaffold, so `/request` inside a new app finds its ledger armed like the registers.

### Changed
- `templates/requests/REQUEST_NEW.md` standing instructions carry the NEW-APP note;
  `.claude/commands/request.md`, `docs/01-SDLC.md` §2 table, `docs/02` preamble and
  `docs/00-OVERVIEW.md` aligned. Case FW-INTAKE-007 added.

### App action required
**None.** Existing apps already exist — this route only fires when nothing is scaffolded.
An existing app missing `requests/README.md` gains it on the next upgrade or first `/request`.

---

## 1.7.0 — 04-Sep-2026 — MINOR

**The design release: the design stage becomes a design-intelligence layer.** Motivated by a
real adoption failure: simple design corrections were missed or misaligned with standards,
designs shipped as first drafts, and the design QA was effectively outsourced to the
requester — who paid for it in correction rounds. Built to the owner's Design Intelligence
Blueprint (04-Sep-2026) as the reference specification.

### Added
- **`docs/24-DESIGN-PLANNING.md`** — the method: the discovery inventory and inspect-first
  order; the infer/investigate/ask question framework ("ask only high-value questions", with
  good and bad examples); the design-plan structure; the IA-first placement table
  (tab/page/section/dialog/drawer/inline/disclosed/removed) and its anti-patterns; the
  ten-stage screen-design pipeline with exit tests; design-system strategy
  (reuse → extend → refactor → create); responsive planning per breakpoint; the state matrix;
  real-world scenario validation (first-time/daily/expert/keyboard-only/role/dataset/failure
  lenses); the iteration loop; the scoring model
  (Basic → Acceptable → Production-ready → High quality → Exceptional).
- **`docs/23-DESIGN-CRAFT.md`** — the bar: the wow factor decomposed into checkable
  mechanisms; IA and grouping; consolidation rules (**simplify the experience, not the
  capability** — nothing lost · logical groups · internal structure · scales); visual
  hierarchy; information density; flows; interaction craft; the polish pass; the
  **anti-gimmick rule** (no unnecessary animation/gradients/cards/colour/shadows/icons —
  sophistication through simplicity); ask-instead-of-assume.
- **`checklists/DESIGN_QUALITY_CHECKLIST.md`** — the judge: 18 areas (user flow → overall UX
  quality), each requiring a verdict (PASS · NEEDS-IMPROVEMENT · CRITICAL) **with evidence**;
  the validate → refine → re-validate protocol; the output verdict table that travels to
  Gate 3 and is re-run on the rendered screens.
- **`docs/registers/DESIGN_RULES.md`** — armed, empty: design lessons promoted via
  `/promote` land here as DR rows with enforcement rungs, so repeated design mistakes are
  prevented by process, not memory. Already parsed by `check-rule-coverage.mjs`.
- **Interaction principles** in `docs/04 §5`: navigation predictability, the
  **three-interaction budget** (counted in the scenario dry run, never estimated), one named
  primary action per screen, quick actions in contextual dialogs (substitution row added).
- **Keyboard parity** as a first-class contract: `docs/13 §4` (Tab/Shift+Tab order, Enter
  activates, **Space selects tab-style controls**, no traps, keyboard-only workflow parity),
  rule A-10, **CP-22** (real buttons, never div-as-button — Enter and Space come free), and
  the executable reference shape `starter/tests/functional/keyboard.functional.spec.ts`.
- Gate 3 gains the **design canvas deliverable**: where the environment provides Claude
  Design (`/design`), the key screens are published as a visual canvas the requester refines
  before approving; the spec remains the binding artifact, and unavailability is stated.

### Changed
- `workflows/feature.md` — A1 runs the docs/24 discovery order (inspect first, ask only
  high-value); A3 reframed as the design-intelligence layer with the ask-don't-assume
  discipline; A3.8 becomes the real-data **and scenario** dry run (interactions counted, one
  pass keyboard-only); new **A3.9 validation loop** — Gate 3 sees Production-ready or better,
  or the blocking findings with a question; A5 drives the primary flow once keyboard-only.
- `workflows/enhance.md` — the correction design pass gains a Keyboard row and, for
  visual-change scope, scoped design-quality validation with optional canvas.
- `checklists/SCREEN_CHECKLIST.md` — item 4 **merged** (cap respected: focus chain +
  keyboard operability in one item). Still 20 items, still full.
- `checklists/ACCESSIBILITY_CHECKLIST.md` — Enter/Space semantics, Shift+Tab, and the
  keyboard-only end-to-end pass.
- `docs/01-SDLC.md` Stage 3 — Interaction and Validation-loop passes added to the table.

### App action required
**None.** All additions are process guidance and an advisory reference spec; no gate,
baseline, or guard changed. The keyboard spec arrives as a reference shape — point it at
your own screens and observe it fail before trusting it (fail-first).

---

## 1.6.0 — 04-Sep-2026 — MINOR

**One command, end to end.** In 1.5.0 only the routed-out classifications flowed onward; a
NEW / CHANGE / BUG classification still stopped after writing the request file and asked the
requester to run the track themselves. Owner decision (04-Sep-2026, reaffirmed): the requester
types exactly one command.

### Changed
- `workflows/request.md` + `.claude/commands/request.md` — after writing the request file, the
  run **continues directly into the classified track**. The field review is not removed, it is
  **moved**: the track's first gate (Track A's Gate 1, Track B's B3/B4, Track C's root-cause
  statement) opens by restating the request FIELDS verbatim — "from your request — correct
  anything wrong" — and a correction there updates the request file before work proceeds, so
  the file and the work never tell different stories. Mixed input runs the framework-update
  half FIRST, so a process gap that caused the app issue is repaired before the app track runs.
- `workflows/feature.md`, `workflows/enhance.md`, `workflows/bug.md` — each carries the
  same-run arrival rule: first stop restates FIELDS.
- `requests/README.md` — the legitimate-edit window is now the first gate.
- `docs/01-SDLC.md` §2, `docs/00-OVERVIEW.md`, `FRAMEWORK_MANIFEST.md` aligned.
- `tests/cases/FRAMEWORK_PROCESS_CASES.md` — FW-INTAKE-001, FW-INTAKE-005, FW-ENH-001 updated.

### App action required
**None.** Every track still accepts a plain one-line request or a hand-run `requests/` file;
the human approval count is unchanged — the first approval simply carries the FIELDS with it.

---

## 1.5.0 — 04-Sep-2026 — MINOR

**Intake is the single entry point.** In 1.4.0, a `/request` run that classified the ask as a
list, an open situation, a pure restructure, or a process failure produced no file and told
the requester to run `/triage`, `/brainstorm`, `/refactor`, or `/framework-update` themselves.
That stop bought nothing — with no request file there is nothing to review — so it only made
the requester retype the same words into a second command, and a retype the requester forgets
is a process failure that never gets routed.

### Changed
- `workflows/request.md` + `.claude/commands/request.md` — routed-out classifications now
  **continue directly into the destination runbook in the same run**; that runbook's own gates
  (triage's queue approval, framework-update's diff approval) still stop the work before
  anything changes. The field-review STOP is unchanged for the file-producing classifications
  (NEW / CHANGE / BUG). Mixed input now continues into `workflows/framework-update.md` with the
  process half in the same run, instead of leaving it as advice.
- `docs/01-SDLC.md` §2 intake paragraph updated to match.
- `tests/cases/FRAMEWORK_PROCESS_CASES.md` — FW-INTAKE-004 and FW-INTAKE-005 updated in place.

### App action required
**None.** Behaviour within a single command's run; no gate, baseline, or guard changed.

---

## 1.4.0 — 04-Sep-2026 — MINOR

**Intake: `/request` writes the binding request file.** Motivated by a real adoption failure:
rough one-line requests fed straight into `/enhance` and `/feature` had the tracks filling the
gaps silently — each silent fill a design decision the requester never made — producing design
gaps found only after the build, and correction-on-correction loops. The gap was at intake,
not in the tracks.

### Added
- `workflows/request.md` + `/request` (`.claude/commands/request.md`) — classify rough words
  into the right track, fill the matching template using **only what the requester said**
  (uncovered = `unknown`, never invented), write `requests/<date>-<slug>.md`, and STOP.
  Stated fields **bind** the consuming track; `unknown` fields become its questions.
- `templates/requests/` — `REQUEST_NEW.md` (Track A) · `REQUEST_CHANGE.md` (Track B, with
  always-populated MUST NOT CHANGE and a DESIGN SURFACE declaration) · `REQUEST_BUG.md`
  (Track C, error wording verbatim, selectivity as root-cause evidence). CHANGE and BUG carry
  a CORRECTION ROUND field: round ≥ 2 obliges the track to explain what the previous fix
  missed before proposing anything.
- `requests/README.md` — the intake ledger's contract (committed, superseded files kept).
- `tests/cases/FRAMEWORK_PROCESS_CASES.md` — ten manual process cases (FW-INTAKE-001..006,
  FW-ENH-001..004) on classification, binding-field discipline, and the design pass.

### Changed
- `workflows/enhance.md` — the optional, undefined "mini design pass" is now the **correction
  design pass**: mandatory when the change is visual, still scoped to the touched area, and
  defined (states · both themes in semantic tokens · string table · permission answer). A
  "not visual" claim is verified against the diff at B6. B1 gains the correction-round check;
  B4's "deliberately NOT changing" list is seeded by the request's MUST NOT CHANGE line.

### App action required
**None.** Intake is a new optional entry point; every track still accepts a plain one-line
request. Adopt by using `/request` when the ask is rough. No gate, baseline, or guard changed.

---

## 1.3.0 — 30-Aug-2026 — MINOR

**CP-21: a wide table is the user's to arrange.** Promoted from `academies-dashboard` (see
`docs/registers/CANDIDATES.md` CAND-001 — an owner override of the n=2 rule, recorded as such).

Past three columns a table scrolls sideways and most of it is off screen. Which columns matter
is a property of the task, not the table, so a fixed layout guesses wrong for everyone. More
than three columns now means the user chooses which columns show and in what order, and the
choice persists.

### Added
- **Gate step G11** + `npm run audit:columns` — `scripts/audits/check-column-control.mjs`.
  Ratcheted like every other audit, so it **arrives baselined** and blocks only new violations.
- `starter/src/components/ColumnControl.tsx` and `starter/src/hooks/useColumnPrefs.ts` — the
  reference implementation. `reconcileOrder` is pure and exported: it is the part with all the
  branches, so it is the part worth testing without a browser.
- `starter/tests/unit/column-prefs.unit.spec.ts` — seven cases on the release-day failures
  (a column added or removed since the preference was stored; a newcomer landing at its code
  position rather than at the front of a reordered table).
- CP-21 in `CANONICAL_PATTERNS.md`; the rule in `docs/04` §5; a review item in
  `CODE_REVIEW_CHECKLIST.md`.

### Known limit, stated rather than implied
The audit counts **literal `<th>` elements**. A table built by mapping over a column definition
array is invisible to it — including, ironically, the 14-column table in the app that motivated
the rule. That is why the review checklist carries an item too: the gate is a floor, not the
substance. `--threshold` is configurable if three proves wrong for another app.

The screen checklist is **unchanged** — it is capped at 20 and full, and this rule earned an
automated check plus a review item instead of a slot.

### App action required
**None.** The gate arrives baselined at your current state: run
`node <framework>/scripts/audits/check-column-control.mjs --write-baseline` once and commit it,
or let `upgrade.mjs` do it for you. Existing tables are accepted as debt; only new ones block.

---

## 1.2.0 — 30-Aug-2026 — MINOR

**The adoption-safety release.** Everything here was found by running v1.1.0 against a real
adopted app (a JavaScript/Vite project) and against a workspace-mode scaffold. Each item was a
promise the framework made and did not keep.

### Fixed
- **The gate was entirely broken in workspace mode** — the default scaffold. Every step resolved
  its own script relative to the app being checked, but a workspace app deliberately has no
  `scripts/`, so all six framework gates reported `Cannot find module` as **FAIL**: the app's code
  judged broken because the checker was looking for itself in the wrong repository. Gate steps now
  resolve against the framework (`fwScript`), and a missing gate script reports BLOCKED, not FAIL.
- **`check-backward-compat` could pass having measured nothing.** It read
  `.gate-logs/conformance.json` if the file merely existed, so when conformance failed to run the
  *previous* run's results were reported as current. Observed: with `conformance.mjs` deleted
  outright, the gate printed three PASSes and exited 0. It now clears the file first, and requires
  that this run produced it.
- **`conformance` exit code depended on fixture ORDER** — a BLOCKED fixture ahead of a FAIL one
  reported exit 3, downgrading "this breaks an existing app" to "we could not check". FAIL now
  outranks BLOCKED, matching `gate-runner`.
- **Half A never reached a standalone app.** `new-app.mjs` promised the copied process half was
  "replaced wholesale on upgrade"; no such code existed, so a client app could never receive a
  fixed guard or a new workflow. `upgrade.mjs` now refreshes it — overwrite, never delete, and
  expected-divergent paths (`docs/registers/`, `docs/modules/`) are skipped so an app's own
  registers survive.
- **New gates were never baselined in workspace mode.** The baselining step looked only in
  `APP/scripts/audits`, which a linked app does not have, so WS3.3's "a new gate arrives baselined,
  green on day one" silently did not apply to the default scaffold.
- A corrupt or `files`-less `lineage.json` now fails with a stated reason instead of a bare
  `TypeError`.

### Changed
- **An ADOPTED app is now OFFERED new seed files, never given them.** `upgrade` routed any file
  absent from the lineage to auto-apply. For an app adopted via `lineage --init` — different
  layout, often a different stack — that is every seed file: 31 TypeScript files pushed into a
  JavaScript app, including a `playwright.config.ts` landing beside a working
  `playwright.config.js` and breaking its test harness. Adopted apps get the same rule modified
  files already had: offer it, a human decides. Scaffolded apps are unchanged — they asked for the
  seed, so a new file there is a gift, not a collision.

### Also fixed
- **Workspace apps had no commit guards at all.** The PreToolUse adapter looked for
  `pre-commit-guard.sh` only inside the app, warned, and allowed — on every commit, in the
  default scaffold mode. It now follows `.framework-link.json` to the linked guard, and the
  guard itself resolves `theme-build.mjs` the same way (guard G4 previously went SKIPPED-forever
  in workspace apps).
- **`lineage --refresh` refused a taken offer.** The upgrade plan's own instruction — copy the
  incoming file, then `--refresh` it — failed with "Not a tracked seed file" for offered files,
  which are untracked by definition. Refresh now accepts an untracked path when the current seed
  has that file; typos are still refused.

### Added
- `lineage.mjs --decline <path>` — permanently refuse an offered file. Without it every upgrade
  re-lists the same rejects, and a report nobody reads enforces nothing.

### App action required
**None.** Every change makes the tooling do less or report more honestly. Workspace-mode apps
should re-run `npm run gate` — it will now actually execute.

---

## 1.1.0 — 28-Aug-2026 — MINOR

**The evolution release** (EVOLUTION_PLAN.md, all phases). The framework becomes versioned,
apps become lineage-tracked, and improvements can travel in both directions.

### Added
- `VERSION` + this file — the framework now has a version identity.
- **Lineage**: `scripts/lineage.mjs` — apps record what they received and from which version.
- **Upgrade**: `scripts/upgrade.mjs` — plan-first (`--apply` to act); pristine files auto-update,
  modified files require review, expected-divergent files are skipped.
- **Promotion**: `workflows/promote.md` + `/promote` + `docs/registers/CANDIDATES.md` — the
  classification gate between an app lesson and a framework change.
- **Conformance**: `fixtures/` + `scripts/conformance.mjs` + `scripts/audits/check-backward-compat.mjs`
  — every framework change is proven against three fixture apps before it counts.
- `templates/docs/FRAMEWORK_ADOPTION.md` — the per-app adoption log.
- `docs/22-FRAMEWORK-EVOLUTION.md` — how all of this works.

### Changed
- `scripts/new-app.mjs`: workspace mode **links** the process half instead of copying it;
  `--standalone` keeps the old copy-everything behaviour for client apps. Writes
  `.framework/lineage.json` and `FRAMEWORK_ADOPTION.md` into every new app.
- `workflows/bug.md`: close-out gains the generality check (route to `/promote`).
- `workflows/framework-update.md`: the triple close-out becomes **quadruple** — every run now
  also bumps `VERSION` and writes its entry here.
- `FRAMEWORK_MANIFEST.md`: every entry marked Half A (process) or Half B (seed).

### App action required
**None.** Existing apps keep working untouched. To join the lineage system, run
`node <framework>/scripts/lineage.mjs --init` from the app root once; from then on
`upgrade.mjs` can serve it.

---

## 1.0.0 — 28-Aug-2026 — initial release

The framework as extracted and hardened: SDLC + runbooks, ratchet gates, theme/contrast system,
commit guards, `.claude/` wiring, starter. See `CHANGELOG.md`.
