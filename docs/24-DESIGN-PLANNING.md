# 24 — Design Planning

> The systematic process an AI agent follows to understand, plan, structure, design,
> validate, refine and prepare an application — or a significant redesign — for
> implementation. [23-DESIGN-CRAFT.md](./23-DESIGN-CRAFT.md) is the taste; this file is the
> method; [checklists/DESIGN_QUALITY_CHECKLIST.md](../checklists/DESIGN_QUALITY_CHECKLIST.md)
> is the judge. The feature track ([workflows/feature.md](../workflows/feature.md)) executes
> this at stages A1–A3; nothing here replaces its gates.

---

## 1. Discovery — what to understand before designing anything

Design decisions encode answers to these whether or not anyone asked the questions. Unasked,
they get the default answer, which is usually wrong. The inventory:

| Dimension | What to establish |
|---|---|
| Purpose | Product objective · business objective · what "success" measurably means |
| People | Target users · roles · personas at the level that changes design (novice/expert mix, frequency of use, environment) |
| Work | Primary jobs-to-be-done · core workflows · the 3–5 journeys the product exists for |
| Rules | Business rules · permissions per role · what each role must never see or do |
| Data | Entities, cardinalities, volumes ("how many rows will this list really have?") · sensitivity |
| Boundaries | Integrations · technical constraints · platform and mobile requirements · performance ceilings |
| Access | Accessibility requirements beyond the framework floor (WCAG 2.2 AA is the floor, [13](./13-CONTRAST-AND-ACCESSIBILITY.md)) |
| What exists | Current app context · design system · components · codebase · database · APIs · visual references · brand |

**Inspect before asking — in this order, because each layer constrains the next:**

1. **The registers** — `KNOWN_LIMITATIONS` (design inputs), `CANONICAL_PATTERNS` (the blessed
   idioms), `RBAC_MATRIX` (who can do what), `ROOT_CAUSE_REGISTER` (mistakes already paid
   for), `PRODUCT_LEXICON` (the words the design must use), `DESIGN_RULES` (design lessons already learned).
2. **The existing design system** — `design/tokens.json`, the theme, the component inventory.
   What exists shapes what is cheap; a design ignorant of the component library specifies a
   month of work where a day existed.
3. **The existing screens** the change touches or sits beside — the sibling patterns a new
   screen must mirror.
4. **The data** — the real schema and realistic volumes. A beautiful list design collapses
   against 10,000 rows it never anticipated; an elaborate one insults 12.
5. **Only then, the requester** — with the questions inspection could not answer (§2).

Skipping inspection and going straight to questions wastes the requester's time on answers
the codebase already holds; skipping questions and going straight to design bakes in guesses.

---

## 2. The question framework — infer, investigate, or ask

**Ask only high-value questions that materially affect architecture, UX, business logic, or
implementation.** Everything else: infer it and *state the inference*, or investigate it.

| Category | Test | Action |
|---|---|---|
| **Infer** | Convention answers it, and being wrong is cheap to fix | Apply the convention, state it in the plan ("assumed: dates display DD-MM-YYYY per lexicon") |
| **Investigate** | The codebase, schema, registers or running app answers it | Look. Never ask the requester what the code already says |
| **Ask** | Different answers produce materially different designs, and nothing inspectable decides it | One question, with a reasoned recommendation |
| **Never assume** | Wrong answer corrupts data, violates a permission boundary, drops a capability, or locks in navigation | Always ask — these are the dangerous assumptions |

**Good questions** (materially different designs behind each answer):
- "Can one student belong to two courses at once? This decides the schema and every roster
  screen. Recommend: yes, N:M — the register shows transfers mid-term."
- "When a payment fails, does staff retry it or does the student? This decides whose screen
  the retry lives on. Recommend: staff — students have no login today."

**Bad questions** (the inspection or a convention already answers them):
- "What colour should the button be?" — the token system decides.
- "Should there be a loading state?" — every state exists, always ([SCREEN_CHECKLIST](../checklists/SCREEN_CHECKLIST.md)).
- "What should we call this field?" — the lexicon decides, and if the lexicon is silent, that
  is a lexicon addition, not a design question.

**Stop-and-ask triggers:** conflicting requirements · several defensible directions with
different experiences · a constraint forcing a visible trade-off · a step in the flow whose
necessity only the requester can judge · anything that removes or reshapes an existing
capability.

---

## 3. The design plan — what exists before any screen is drawn

One document, produced top-down, each layer constraining the next. Its structure:

```
DESIGN PLAN
├─ 1. Product structure        the areas of the product, named in the user's words
├─ 2. Information architecture what lives where, grouped by task (§4)
├─ 3. Navigation architecture  primary / secondary / contextual; the three-interaction budget
├─ 4. User journeys            the 3–5 scenarios, entry → steps → exit, interaction counts
├─ 5. Screen inventory         every screen with: purpose · primary action · states · roles
├─ 6. Role experiences         what each role sees, cannot see, and does differently
├─ 7. Data relationships       cardinalities stated (1:1 / 1:N / N:M), volumes estimated
├─ 8. Interaction patterns     which blessed pattern each need maps to (CP register)
├─ 9. Responsive strategy      per breakpoint: what stays, collapses, moves (§7)
└─ 10. Accessibility strategy  keyboard model, focus plan, announcements — designed, not audited
```

The order is the method: IA before screens, journeys before layout, patterns before pixels.
A plan written screen-first produces screens that each make sense and a product that doesn't.

---

## 4. Information architecture first — the placement decision table

For every piece of content or capability, decide its container by asking what it *is*:

| It is… | It becomes… |
|---|---|
| A top-level area users visit deliberately, daily | **Primary navigation** item |
| A distinct view within one area, switched between often | **Tab** — capped by the seven-item scanning limit; past that, restructure |
| A destination with its own context, linkable, cold-loadable | **Page** |
| A subordinate cluster within a page's reading flow | **Section** |
| A quick, focused action that returns to where the user was | **Dialog** — small, contextual, at the point of need |
| A large auxiliary task that must not lose the page behind it | **Drawer** |
| An edit of one value in place | **Inline** |
| Detail that most users don't need most of the time | **Progressive disclosure** ("more", expand, secondary screen) |
| Something no scenario in §5 of the plan actually visits | **Removed** — and the removal stated, not silent |

**The anti-patterns this table exists to prevent** — each is a symptom, with its cause:

| Symptom | Cause and correction |
|---|---|
| Too many tabs | Data-model grouping. Regroup by task; consolidate per the [consolidation rules](./23-DESIGN-CRAFT.md) — *simplify the experience, not the capability* |
| Deep navigation | Hierarchy mirroring the org chart or schema. Flatten: three interactions to anything key |
| Duplicate navigation | Two paths kept "so users can find it either way" — pick the one the journey uses; the other confuses more than it helps |
| Redundant screens | A list, a report and an export that are one dataset in three dresses. One screen, three verbs |
| Excessive modals | Dialogs used for navigation. A dialog is for an action, never a place |
| Cluttered dashboard | Everything "important" promoted until nothing is. A dashboard answers: what needs my attention *today*? |
| Long workflows | Steps that gather nothing. Every step either collects a decision or is deleted |

---

## 5. The screen-design pipeline

Requirement → Flow → IA → Wireframe → Layout → Components → Visual → States → Responsive →
Accessibility. Each stage has an exit test; moving on without it is how rework happens.

| Stage | Objective | Output | Exit test (and the classic mistake) |
|---|---|---|---|
| Requirement | Know what job this screen does | One sentence: who comes here to do what | Can't write the sentence → it's two screens or none *(mistake: designing the data, not the job)* |
| User flow | The path through, end to end | Entry → steps → exit per scenario, interactions counted | Every step gathers a decision; budget met or justified *(mistake: happy path only)* |
| IA | What's on the screen and its grouping | Grouped content list, task-named | Each group answers to one task word *(mistake: schema-shaped groups)* |
| Wireframe | Structure without style | Boxes and order; primary action placed | The one-second read works: what is this, what matters, what do I do *(mistake: opening the visual layer here)* |
| Layout | Spatial hierarchy | Grid, density, spacing rhythm from tokens | Focal point unique; density matches the task *(mistake: eyeballed gaps)* |
| Components | Map every element to the library | Component names per element; gaps flagged | Reuse → extend → create, in that order, with justification (§6) *(mistake: novel components for solved problems)* |
| Visual | Apply the design system | Tokens, type scale, both themes stated | Zero literals; hierarchy survives theme swap *(mistake: colour doing hierarchy's job)* |
| States | Every state of every element | The state matrix (§8) filled in | No state marked "later" *(mistake: default-state-only design)* |
| Responsive | Behaviour per breakpoint | The §7 decisions per screen | Narrowest width walked, nothing lost — only rearranged *(mistake: desktop shrunk)* |
| Accessibility | Keyboard and announcement model | Focus order, key model, live regions | Keyboard-only walk of the flow succeeds on paper *(mistake: deferring to QA)* |

---

## 6. Design-system strategy — before individual screens

Inventory first: typography scale · spacing scale · colour roles · grid and containers ·
every interactive component the library holds (buttons, inputs, forms, tables, cards,
navigation, tabs, dialogs, drawers, dropdowns, tooltips, alerts, toasts, badges) · the shared
state treatments (empty, loading, error, success) · responsive and accessibility behaviour
each component already implements.

Then, for every need a screen has, in strict order:

1. **Reuse** — the component as it stands. The default; deviation needs a reason.
2. **Extend** — a new variant or prop on the existing component, upstreamed so every consumer
   gains it. Never a local fork.
3. **Refactor** — when the third variant request reveals the component was carved wrong.
   A deliberate, separate change (Track D), not a drive-by.
4. **Create** — only when nothing owns the concern. Arrives with: written justification, all
   states, both themes, keyboard model, and a canonical-patterns row if it embodies one.

A second way of doing the same thing is a defect, not a preference — this is the design-system
form of that rule.

---

## 7. Responsive planning — decided, not discovered

Plan per breakpoint class before implementation — desktop, laptop, tablet, mobile — and for
each screen answer, explicitly: what remains visible · what collapses · what moves · what
becomes a drawer · what becomes a menu · what scrolls horizontally inside its own container ·
what is progressively disclosed · what changes priority.

The decisions follow from the journeys, not from the viewport: the scenario a mobile user
actually performs keeps its one-interaction access; everything else may step back. "Make it
fit" is the anti-method — a desktop screen shrunk until it fits is a design for nobody.
The narrowest supported width is walked in the scenario dry run like any other case, and the
[wide-table rule](./04-ARCHITECTURE-AND-DESIGN.md) (the user arranges columns) is the model
for every dense surface: the *user* decides what survives on a small screen where the task
varies.

---

## 8. The state matrix

Every interactive component, before implementation, has an answer for each applicable state —
and "N/A" is an answer; blank is not:

`default · hover · focus (visible!) · active/pressed · selected · disabled (with a reason the
user can learn) · loading · empty · error · success · validation · permission-restricted ·
offline/degraded`

Screens add: first-run, partial-data, large-dataset. The matrix is filled at design time
because half of these states cannot be improvised at build time — an improvised error state is
a toast, an improvised empty state is a blank div, and both are what "unfinished" looks like.

---

## 9. Real-world scenario validation

A design is walked, on paper and against the canvas, by people who don't exist yet:

| Lens | What it exposes |
|---|---|
| First-time user | Discoverability; the empty state that must teach the first action |
| Returning daily user | Interaction cost of the *frequent* path — this is where the budget bites |
| Expert user | Keyboard flow, bulk actions, density ceiling |
| Keyboard-only user | The full journey without a pointer ([13 §4](./13-CONTRAST-AND-ACCESSIBILITY.md)) |
| Each role | What they see, what they must not, what the denial state says |
| Large dataset | Scanning, paging, search — the 10,000-row day |
| Empty / partial / invalid data | Every state in §8 earns its keep |
| Failed API / slow network / offline | Feedback honesty; nothing hangs, nothing lies |
| Mobile / tablet / desktop | The §7 plan actually walked, not assumed |
| Rare-but-critical workflow | The once-a-year task still findable without retraining |

Each walk either passes or produces a design change *now* — a scenario gap found at design
time costs a sentence; the same gap after build costs a correction round.

---

## 10. The iteration loop — a first design is a draft by definition

```
Design → (canvas/build) → Render → Inspect → Identify issues → Refine → Render again → Validate
```

- **Inspect visually**, both themes, at real widths, with real-shaped data — the canvas at
  Gate 3, the rendered screens at build. Look for: hierarchy (does the one-second read work?),
  alignment and rhythm, density, truncation, state coverage, contrast, focus visibility.
- **Identify issues against the checklist**, not against taste — every finding names the
  checklist area it fails.
- **Prioritise**: critical issues (capability lost, state missing, accessibility broken,
  budget blown) before polish; polish before preference.
- **Iterate again** while critical or repeated findings remain; **good enough to proceed** is
  a clean checklist pass at the target verdict — not fatigue.

## 11. Scoring — how the agent judges a design

Each of the checklist's areas receives a verdict: **PASS · NEEDS-IMPROVEMENT · CRITICAL**.
The design's grade is derived, never vibes:

| Grade | Definition |
|---|---|
| Basic | Any CRITICAL open |
| Acceptable | No CRITICAL; several NEEDS-IMPROVEMENT |
| Production-ready | No CRITICAL; NEEDS-IMPROVEMENT only in polish areas, each with a stated reason |
| High quality | All areas PASS |
| Exceptional | All PASS **and** the scenario walks surface zero friction findings — the [craft bar](./23-DESIGN-CRAFT.md) |

A poorly scoring design is **refined and re-scored, not presented**: Gate 3 sees a design at
Production-ready or better, or sees the specific findings that block it with a question for
the requester. Presenting a Basic design for approval outsources the QA to the requester —
which is the exact failure this file exists to end.

## 12. Reusable design intelligence — where lessons live

- **Framework-level, reusable** (this repo): the method (this file), the craft
  ([23](./23-DESIGN-CRAFT.md)), the judge (the checklist), the rules with IDs
  ([registers/DESIGN_RULES.md](./registers/DESIGN_RULES.md)) — append-only, each rule naming
  its enforcement rung or declaring itself prose-only.
- **Project-level** (an app's repo): its `AGENTS.md`/`CLAUDE.md` binding rules, its tokens,
  its component inventory, its lexicon — the *instances* of the method.
- **Feedback becomes rules**: a design correction the requester makes twice is a candidate
  (`/promote`); promoted, it lands as a DESIGN_RULES row with an ID, so the third occurrence
  is prevented by process, not memory. That is how the agent stops repeating design mistakes:
  not by remembering, but by the register being read at every design run (§1 step 1).

## 13. The sequence, end to end

Understand → Inspect (registers, system, siblings, data) → Discover (§1) → Ask (§2) → Define
users and journeys → IA (§4) → Navigation → Design system pass (§6) → Plan screens (§3.5) →
Interactions → States (§8) → Responsive (§7) → Accessibility → **Gate 3 validate** (checklist
+ scoring §11, canvas inspected, scenarios §9 walked) → refine → re-validate → requester
approves → build → render → visual inspect → design QA re-run on the built screens → refine →
re-test → **test gate**.

In track terms: A1 covers Understand→Ask; A3 covers Define→re-validate with Gate 3 as the
stop; A5–A6 cover build→re-test. The loop in §10 runs inside both A3 and A5. Nothing in this
sequence adds a gate — it defines what the existing gates demand.
