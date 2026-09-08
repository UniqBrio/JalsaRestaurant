# Track A — New Feature

> **How to use this file.** Paste it into your coding agent (or open it beside you) together
> with one line describing the request. Everything else is prescribed below.
>
> As a slash command: save to `.claude/commands/feature.md` and invoke `/feature <request>`.

**REQUEST:** `<one line — e.g. "Bulk import for records from a spreadsheet" — or the path of a requests/ file written by /request>`

When the request is a `requests/` file: its stated fields are **binding** and are never re-asked
at Gate 1; every field marked `unknown` becomes a Gate 1 question with a reasoned
recommendation. VISIBLE STRINGS the requester stated verbatim enter the A3.5 string table as
given. Arriving via `/request` in the same run, the Gate 1 questionnaire OPENS by restating
the FIELDS verbatim — "from your request — correct anything wrong" — because the requester has
not reviewed them yet; a correction there updates the request file before anything proceeds.

---

## Step 0 — Ground rules (always, before anything)

1. Read `AGENTS.md` / `CLAUDE.md` in full. Its architectural rules are **binding** and nothing
   below overrides them.
2. Read `docs/registers/KNOWN_LIMITATIONS.md`. Platform limitations are **design inputs**.
3. Read `docs/registers/CANONICAL_PATTERNS.md`. For every cross-cutting concern this feature
   touches, there is already one blessed idiom. Mirror it. A second way of doing the same
   thing is a defect, not a preference.
4. Load context the **cheap** way: only the routes, components, schema and contracts this
   request names. Never a full-repo read for a scoped request. Never design from memory — read
   the current files, because "what shipped last week" is not in your context.
5. Confirm the working branch. Confirm which environment is writable. Production is never an
   automated target.
6. State your **assumptions** before acting. Where the request admits two readings, present
   both rather than silently choosing one.
7. **Declare the run mode and the scale** ([docs/01 §Run modes](../docs/01-SDLC.md)) — one
   line each. Mode: `auto` (default — gates 1–4 are checkpoints with an ASSUMPTIONS ledger)
   or `confirm` (each gate waits). Scale: `micro`, `scoped` or `full`
   ([docs/01 §Run modes](../docs/01-SDLC.md) has the entry tests). A **scoped** run produces
   ONE combined `RUN_<feature>.md` in place of the four gate artifacts and skips A2 unless
   build-vs-buy is a real question. A **micro** run is rarely a Track A shape at all — a new
   feature that fits in two files with no new screen is usually an enhancement; classify it
   again before continuing. The obligations are identical at every scale; the packaging
   shrinks. **Write the scale into the commit message (`SCALE: micro`) — guard G8 checks the
   claim against the diff.**
8. **Speed discipline — the three budgets.**
   - **Reading budget.** A run READS: this runbook, the project's `CLAUDE.md`, and the
     registers relevant to the touched modules — once each. Everything else
     (docs/23, docs/24, docs/04, docs/13, checklists) is **lookup material**: open the named
     section at the moment a stage points at it, never front-load the library. The process
     documents describe the work; reading all of them IS not the work.
   - **Evidence budget.** Verdicts are per AREA or per screen, one evidence line each; a
     checklist's bullet items are prompts for the eye, not documents to write. **Never
     hand-verify what a mechanical gate already checks** — contrast, tokens, test ids,
     column control are the audits' job; cite their result ("theme:contrast PASS") as the
     evidence line and move on. Duplicating an audit by hand is waste on top of noise.
   - **Writing budget.** Scoped scale: `RUN_<feature>.md` ≤ ~150 lines, ledger entries one
     line each, the QA verdict table 18 lines + the grade. Artifacts are terse tables;
     never restate the runbook, never re-derive what an earlier stage established.
     Independent checks run together, not in sequence.

---

## A1 — Requirements discovery → GATE 1

Run discovery in the [docs/24-DESIGN-PLANNING.md](../docs/24-DESIGN-PLANNING.md) order:
**inspect first** (registers, design system, sibling screens, real data), then ask only what
inspection cannot answer, using its infer / investigate / ask framework — high-value questions
that materially affect architecture, UX, business logic or implementation; never a question
the codebase already answers.

**The product-advisor pass** ([docs/24 §2](../docs/24-DESIGN-PLANNING.md)) — runs for a
NEW-APP, a new module, or a full-scale feature opening a new area; a scoped feature inside an
existing area skips it. Research comparable products (timeboxed: 3–5 comparators, one pass;
web research where available, model knowledge declared and dated where not), filter every
candidate through the context lenses (type, region, legal/regulatory, customers, scale,
standards), and deliver the **feature triage**: Must-Have / Recommended / Good-to-Have, each
tier reasoned, plus the ignored list with why. The **standard baseline**
([COMPONENT_LIBRARY §1](../docs/registers/COMPONENT_LIBRARY.md) — themes, auth flows,
navigation shell, shared states) enters Must-Have automatically; research effort goes to what
is genuinely undecided, never to whether login should exist. The triage and its questions are presented as
**one consolidated package and are a hard stop in every run mode** — scope is the requester's
decision, and it is expensive to undo; everything else about auto mode stays as it is.

Produce an adaptive questionnaire. **One question, or one tight group, at a time.** Skip
anything the loaded context already answers.

Cover: objective · users and roles · primary flow · entry points · navigation placement ·
permissions · business rules · validation · edge cases · empty/loading/error states · fields ·
search, filter, sort · notifications · integrations · affected modules · analytics events ·
security and data sensitivity · performance expectations.

**Every question carries a recommendation, its reasoning, and real alternatives.** State
*why the recommended option wins here* — context, not preference; options always include
**"Other: describe your own"**. A blank question hands the work back to the requester; a
bare list of choices without a reasoned pick does the same thing more slowly. The requester
may take the recommendation, pick any alternative, or define their own — their answer binds.

Three mandatory items:

- **Usage-profile completion.** Every `unknown` line of the request's USAGE PROFILE —
  frequency, essential vs optional info, frequent vs occasional actions, what to automate —
  is asked here, with a recommendation. The profile is what the design subtracts with
  ([docs/24 §3b](../docs/24-DESIGN-PLANNING.md)); designing without it produces a UI for an
  imaginary user.

- **Cardinality check.** For every entity pair the feature touches, state 1:1 / 1:N / N:M
  explicitly, with a recommendation. Left implicit, it is discovered during build, and by then
  the schema is already wrong.
- **Limitation awareness.** If a requirement touches a capability with a register entry, say
  so in the question and propose the per-platform fallback up front.

Deliver as `templates/gates/GATE1_QUESTIONS.md`:
`Question | Why it matters | Options | Recommendation | Answer`

→ **GATE 1 — confirm mode: STOP, the requester answers. Auto mode:** take each written
recommendation as the answer, log it to the ASSUMPTIONS ledger, and proceed — a stated FIELD
is never overridden, and a hard-stop question ([docs/01 §Run modes](../docs/01-SDLC.md))
still waits.

---

## A2 — Feasibility → GATE 2

Produce `FEASIBILITY_BRIEF_<feature>.md` from
[templates/gates/FEASIBILITY_BRIEF.md](../templates/gates/FEASIBILITY_BRIEF.md):

- Approach, with the one defensible build-vs-buy pick and why the alternatives lost.
- Effort estimate and cost — one-time, recurring, and at 10× current scale.
- Manual/configuration actions someone must perform, with lead times. A feature that needs a
  vendor approval nobody started is not shippable on the date you just quoted.
- Risks, and the environment ceilings that constrain the approach (request timeouts, payload
  limits, rate limits, cold starts).
- Verdict: **Build now · Build later · Buy · Defer · Drop**.

**Alternative-plan rule (binding).** If the verdict is Defer/Drop, or the preferred approach is
blocked by cost or a platform ceiling, the brief MUST offer at least one feasible alternative —
descoped, phased, or different tooling — each with its own cost and trade-offs. A dead-end
verdict with no way forward is an incomplete brief.

→ **GATE 2 — confirm mode: STOP for approval. Auto mode:** a *Build now* verdict proceeds,
logged; *Defer / Drop / Buy* or a real build-vs-buy fork is a hard stop. (Scoped scale: this
stage is one paragraph inside `RUN_<feature>.md` unless build-vs-buy is real.)

---

## A3 — Design (specification only) → GATE 3

A design run produces documents and, where the environment provides the Claude Design canvas,
a visual design. **It writes no application code and touches no database.**

This stage is the framework's **design-intelligence layer**, not a formality between gates:
it follows the method in [docs/24-DESIGN-PLANNING.md](../docs/24-DESIGN-PLANNING.md) (IA
before screens, journeys before layout, patterns before pixels), holds the bar in
[docs/23-DESIGN-CRAFT.md](../docs/23-DESIGN-CRAFT.md), and does not finish until the
validation loop (A3.9) grades the design **Production-ready or better**. Its governing
principle: **simplify the experience, not the capability.** And its question discipline is
Gate 1's: a design decision that materially affects the experience — conflicting
requirements, several defensible directions, a constraint forcing a visible trade-off — goes
to the requester as a question with a recommendation, never a silent assumption.

### A3.1 Reuse first — app, then library, then build
Resolution order, one read each ([docs/registers/COMPONENT_LIBRARY.md](../docs/registers/COMPONENT_LIBRARY.md)):

1. **This app** already has the component → use it.
2. **The component library**, for this app's stack → use the registered implementation.
   Rebuilding a registered component is a defect, not a preference.
3. Neither → build it, with a written justification — and if it implements a **baseline
   concern** (library §1), contribute it back in this same change: generalize (no domain
   words), register, flip the GAP row to READY. Other reusable-looking components go through
   `/promote` (n=2 rule) as always.

Follow the project's naming conventions for anything genuinely new.

### A3.1b Translate the usage profile, then subtract
Apply the translation table ([docs/24 §3b](../docs/24-DESIGN-PLANNING.md)) mechanically:
frequent/essential → primary screen, one interaction; occasional/optional → progressive
disclosure; automatable → eliminated, outcome shown. Then run the **subtraction pass**
([§3c](../docs/24-DESIGN-PLANNING.md)) on every screen: *need to see it? need to do it?
fewer steps possible?* — recording what was removed (or "nothing removable", per screen) as
design-QA evidence. A separate screen is never created merely because information exists.

### A3.2 Simplify before you add
Run the substitution table before adding any control:

| Instead of | Use |
|---|---|
| N action buttons per row | a swipe/context action + a smart default |
| dropdown + "add new" dialog | a type-to-create searchable combobox |
| a separate edit screen | inline tap-to-edit |
| a separate screen for a quick action | a small contextual dialog at the point of need |
| a confirmation dialog | immediate action + undo (destructive actions excepted) |
| a long form | smart defaults + progressive disclosure |
| a global menu action | a context action at the point of need |

**Fewest actions wins.** The most common case should need zero actions — the right default is
already selected. Any gesture needs a discoverability cue, an undo path and a non-gesture
fallback; never gesture-only.

**The three-interaction budget** ([docs/04 §5](../docs/04-ARCHITECTURE-AND-DESIGN.md)): every
key action and key piece of information sits within three interactions of where the user
starts, wherever practical — counted, in A3.8's scenario walk, never estimated. Over budget
means remove a step or state in the design why the longer path is deliberate.

**Name the primary action of every screen** in the spec — the one thing a user most often
comes there to do, rendered unmistakably, with at most one primary treatment. A screen whose
primary action cannot be named is a finding, not an exemption.

### A3.3 Every state, every screen
Empty · loading · error · offline · partial-data · permission-denied · first-run.
An empty state that only says "nothing here" is incomplete — it must offer the next action.

### A3.3b Every list view: the standard controls
Any screen that renders a list or table carries CP-23 through `ListControls` /
`useListControls` — never a per-module search box or sort. The design states, per list:
**search fields** (name, phone, email, and the module's own key fields) · **filter groups** ·
**the date field**, if any, which turns on the presets (Today · This week · Last week · This
month · Custom) · **sortable columns**. A list designed without these is incomplete, not
minimal — the subtraction pass removes clutter, and these are how the user removes *theirs*.

### A3.3b-delete — what does DELETE mean for this entity? (CP-26)

One of two answers, in writing, **before any delete control is drawn**: **ARCHIVE** (the row
survives, reads filter it out, the unique index is partial so the name frees up, the control
says *Archive*, a restore path exists) or **REMOVE** (the row is gone, dependants handled by a
chosen `on delete` rule, the confirmation says it is irreversible).

Unanswered, the two layers each pick one and they are each self-consistent — which is why the
symptoms surface far from the cause, as a row that comes back on refresh or a name the user is
told is taken by a record they cannot see.

### A3.3c Dashboards and analytics
A screen that reports numbers uses CP-24 (`DashboardShell` + `MetricCard` + the analytics
config), never a bespoke dashboard. The design states, per dashboard: the **question each
section answers** · which metrics are **cost-like** (`higherIsBetter: false`) · the **breakdown
ladder** for anything drillable · **role visibility** per metric. A section whose question
cannot be written is decoration and does not ship ([docs/25](../docs/25-ANALYTICS-AND-DASHBOARDS.md)).

### A3.4 Theme and contrast (see [docs/11](../docs/11-THEME-AND-COLOR-SYSTEM.md), [docs/13](../docs/13-CONTRAST-AND-ACCESSIBILITY.md))
- **Semantic tokens only.** No colour literal enters the design or the code.
- **Both themes specified.** Not "it will inherit" — state what each surface renders as.
- Any new colour ROLE is added to `design/tokens.json` with a light AND a dark value, plus its
  contrast pairs, in this design — not during build.
- Decide per-theme asset variants **now** ([docs/14](../docs/14-LOGO-AND-IMAGE-ASSETS.md)).
  A logo is a colour decision that happens to live in a file.

### A3.5 Copy
Author every visible string here: titles, labels, helper text, placeholders, buttons, empty
and error text, toasts, confirmations. Use the approved lexicon; reuse the shipped word rather
than coining a better synonym for it. Output a **string table** (surface · placement · final
string) so the build implements approved copy rather than inventing placeholders.

**The freeze rule:** shipped strings are frozen. A new feature adopts existing terminology; it
does not "improve" wording on screens it happens to pass through.

### A3.6 Permissions
Answer the five questions from
[docs/registers/RBAC_MATRIX.md](../docs/registers/RBAC_MATRIX.md) **in the design**:
new capability? · does an existing permission change meaning? · which roles and why? ·
default enabled or disabled, per role? · owner-configurable or deliberately hidden?

A change with no permission answer is not plannable, let alone shippable.

### A3.7 Customer-facing artifacts
Any file this feature produces or consumes — an import template, an export, a receipt, a
certificate — is a **product surface**, designed with the same rigour as a screen: written
instructions for a non-technical user; sample data unmistakably marked as sample and separable
from real input; editable areas explicit; multi-row semantics defined.

### A3.8 Real-data and scenario dry run (before Gate 3)
Walk the design against 8–10 realistic records as a real user would produce them — including a
duplicate, a missing required field, a mistyped value, and one record at the top of the size
range. A design never exercised against realistic data is not ready.

Then walk the **3–5 most frequent real scenarios** end to end — "record a payment", "find last
month's report", whatever this feature actually exists for — **counting the interactions**
against the three-interaction budget, and make **one full pass keyboard-only** (Tab, Enter,
Space — [docs/13 §4](../docs/13-CONTRAST-AND-ACCESSIBILITY.md)). A scenario over budget or a
step that needs a pointer is a design gap to fix here, at the price of a sentence — the same
gap found after the build is the next correction round.

### A3.9 Design validation loop (before Gate 3)

Run [checklists/DESIGN_QUALITY_CHECKLIST.md](../checklists/DESIGN_QUALITY_CHECKLIST.md) —
**one verdict per AREA** (PASS · NEEDS-IMPROVEMENT · CRITICAL) with **one line of evidence**;
the bullet items under each area are prompts for the reviewer's eye, not per-item paperwork.
Full scale: all 18 areas. **Scoped scale: the core six** — user flow · visual hierarchy ·
accessibility · states · simplicity · overall — **plus any area the change touches**; the
untouched rest is one line: "not touched by this change". Where an area overlaps a mechanical
audit, the audit's result is the evidence — never re-verify it by hand. Fix the findings,
re-run the affected areas, and compute the grade ([docs/24 §11](../docs/24-DESIGN-PLANNING.md)).
Iterate while critical or repeated findings remain: **Design → render/canvas → inspect →
identify → refine → re-validate.**

Gate 3 sees a design graded **Production-ready or better** — or it sees the specific blocking
findings with a question for the requester. A first draft presented as final outsources the
design QA to the requester, which is the exact failure this loop exists to end.

**Deliverables:**

1. `DESIGN_SPEC_<feature>.md` — flow, screen hierarchy, every state, prescribed
   interaction patterns, exact token names, real component names, accessibility (focus order,
   labels, contrast, non-gesture fallbacks), and responsive behaviour from the narrowest
   supported width upward. **The spec is the binding artifact.**
2. **The design canvas** — where the environment provides the Claude Design capability
   (`/design`), publish a canvas of the key screens — both themes, the states that matter —
   so the requester *sees* the design and can refine it visually before approving. Where the
   capability is unavailable, say so and the spec stands alone.
3. **The completed DESIGN QA verdict table** (checklist output format), including the grade
   and the iteration count.

→ **GATE 3 — confirm mode: STOP for approval. Auto mode:** a design graded
**Production-ready or better** proceeds, verdict table logged; a lower grade or a material
design fork (docs/24 §2 hard triggers) is a hard stop. The canvas is produced in confirm
mode and on request; in auto mode it is skipped by default — it exists for a human review
that auto defers to the run report.

---

## A4 — Implementation plan → GATE 4

Produce `IMPLEMENTATION_PLAN_<feature>.md` from
[templates/gates/IMPLEMENTATION_PLAN.md](../templates/gates/IMPLEMENTATION_PLAN.md).

**Backend obligations, when the change touches data:**

1. **Parity check.** Generate schema snapshots of the non-production and production databases
   and diff them. Any unacknowledged difference is a blocking finding, and production is the
   source of truth. Snapshots are *generated*, never hand-maintained — a maintained snapshot
   becomes a third environment that drifts.
2. **Migration ledger audit.** For every table, index, constraint, trigger and function this
   change touches, verify it is defined in a migration file. An object that exists in both
   databases but in no migration is blocking: backfill an idempotent migration
   (`CREATE ... IF NOT EXISTS`) before building on it. The ledger, not the live database, is
   the system of record.
3. **Constraint-aware write audit.** For every table written, enumerate its unique constraints
   *from the live schema* and design each write idempotent against each one. The plan lists
   each constraint and the guard that satisfies it. A double-tap, a retry and a duplicated
   webhook are the same event to your API.
4. **Multi-step writes go through one transaction.** A cascade that can half-apply will.

**Also in the plan:**

- Task breakdown: objective · files · dependencies · acceptance criteria per task.
- **Root-cause compliance**: for each module touched, state how this avoids each recorded
  root-cause class in that module, or N/A with a reason. A new feature must never reintroduce
  a bug class already paid for once.
- Performance budgets, on the slowest device and network you support, and how they are verified.
- Security: what personal data this stores and why; which policies change; new endpoints are
  authenticated by default and any public one carries a written justification.
- The test plan, by dimension (functional · responsive · performance · security).
- Rollback plan.

→ **GATE 4 — confirm mode: STOP for approval before any code. Auto mode:** log the plan and
start the build immediately. Hard stops regardless of mode: a destructive or non-additive
migration, removing or reshaping an existing capability, anything on the safety floor.

---

## A5 — Build

- Implement to the plan. Minimum change for the ask. No drive-by refactors.
- **Build in parallel when the plan supports it.** Token *generation* is the slowest part of a
  run, and it is the only part that parallel agents genuinely shorten. When the plan has **3+
  independent tasks**, serialise them to `fanout.json` and validate first:

  ```bash
  npm run fanout:check -- fanout.json     # BLOCKED on a collision, a race read, or a task
  ```                                     # that declares no contract or no acceptance

  Then spawn one `implementation-builder` per task, **all in one message**, and the wall-clock
  becomes the slowest lane instead of the sum. Each task declares `files` (owned exclusively),
  `reads` (never written by a parallel task — the validator proves it), `contract` (the exported
  signatures, **written by the planner before any agent starts**) and `acceptance`.

  **Contract-first is the rule that makes this work.** Agents implement against declared
  signatures, never against each other's in-progress code — interface drift discovered at
  integration costs every lane that built on it. A lane that needs a file outside its set
  reports back; it never takes it.

  Fan out **only** the build. Design and planning are sequential by nature — each stage
  constrains the next — and a reviewer cannot run concurrently with the code it reviews
  ([workflows/agents/README.md](./agents/README.md)). Below three tasks, build inline: the
  per-agent context costs more than it saves. Never at `micro` scale.
- **Integrate, then gate — once, centrally.** When every lane returns, the coordinating agent
  reconciles the reports, checks that nothing was written outside its declared lane
  (`git status` against the union of `files`), and runs the gate on the whole tree. A lane that
  gates alone is testing a half-built repository.
- **Verify every dependency before installing**: it exists, it is the intended name, it is
  pinned. An unverified dependency blocks the change.
- Implement the approved string table verbatim. A string the design never covered is a NEW
  string: author it properly now and add it to the table. Never ship a developer placeholder.
- Add a stable test id to every new or modified interactive element:
  `<module>-<element>`, or `<module>-<element>-<entityId>` for a row, where the entity id is
  the **database** id and never the list position. Place it on the control that handles the
  interaction, never on a wrapper.
- Run [checklists/SCREEN_CHECKLIST.md](../checklists/SCREEN_CHECKLIST.md) per screen and output
  the ✅/❌/N-A list. Any ❌ means not done.
- **Render and look at every new screen, in both themes, before calling it done.** "The build
  compiled" is not evidence that text is readable.
- **Drive the primary flow once keyboard-only** — Tab, Enter, Space, no pointer. A flow that
  needs a mouse is unfinished (CP-22, rule A-10).
- **Review passes per the matrix** ([workflows/agents/README.md](./agents/README.md)): a
  scoped run spawns `code-reviewer` plus only the conditional reviewers the diff actually
  triggers (visible strings → copy; roles/tenant data → permissions; schema → parity) — **in
  one message, in parallel**. Blast radius, plan, gate run and close-out stay inline. Every
  spawn is a cold start; ten of them in sequence was the largest time sink after the budgets.

---

## A6 — Close out

State the **business-readiness tier** ([checklists/BUSINESS_READINESS.md](../checklists/BUSINESS_READINESS.md))
and deliver that tier's outputs. Then discharge every obligation in
[checklists/DEFINITION_OF_DONE.md](../checklists/DEFINITION_OF_DONE.md), then run the test gate
([workflows/test-gate.md](./test-gate.md)).

**Nothing merges without an explicit PASS.**

On PASS: merge, deploy to preview, report the preview URL. Automation stops there — production
promotion is a separate approved step, **in every run mode**.

**The auto-mode run report** (delivered with the preview URL): the FIELDS restated from the
request file · the ASSUMPTIONS ledger — every decision taken at a checkpoint, with its
recommendation and why · the gate artifacts (or the one combined `RUN_<feature>.md`) · the QA
verdict table · the gate result · **stage timings** — one line per stage (ground · plan ·
build · verify · gate), minutes each, so a slow run names the stage that ate the time and the
next process fix starts from data instead of a feeling. **The gate stage is copied from the
runner's own `Time:` line, never estimated** — `npm run gate` measures every step and names the
slowest; the other four stages remain narrator-reported, which is honest debt recorded in
RC-008 rather than an enforcement claim. The review the gates deferred happens here, with everything
on one screen — and anything the requester corrects becomes the next `/request`, round 2,
with the ledger showing exactly which assumption missed.
