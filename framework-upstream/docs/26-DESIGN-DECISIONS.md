# 26 — Design Decisions: the reasoning knowledge base

> **Version 1.0.** The reasoning model for the design phase — how to decide, not what to draw.
>
> [docs/24](./24-DESIGN-PLANNING.md) is the **method**: discovery, IA, the screen pipeline, the
> state matrix, scoring. [docs/23](./23-DESIGN-CRAFT.md) is the **bar**. This file is the
> **judgement layer underneath both**: what counts as evidence, who is allowed to decide, when
> to ask rather than infer, and how far to go before a human must.
>
> It is **not** a component catalogue, a design system, a list of mandatory UX patterns, a
> decision tree, a scoring system, a replacement for domain, security, legal or accessibility
> expertise, or permission to make high-impact decisions alone.

**The central principle:**

> Do not ask *"what is the best UI pattern?"* Ask *"given this product, user, task, constraint,
> evidence, risk and authority context, what design decision is justified?"*

---

## 0. What this file does NOT restate — and where it already lives

This framework already had half of this knowledge base under its own names, and **a second
vocabulary for one concern is a defect**: two names for a thing produce two answers to any
question about it. So the sections below that overlap are **pointers, not restatements**. Each
says only what it adds beyond the existing mechanism.

| The knowledge base's concern | Already in this framework as |
|---|---|
| Retrieve before asking · materiality · question selection · safe inference | [docs/24 §2](./24-DESIGN-PLANNING.md) — the **Infer · Investigate · Ask · Never assume** table |
| Context before design | docs/24 §1 Discovery |
| Design states | docs/24 §8 The state matrix |
| Responsive | docs/24 §7 Responsive planning |
| Design-system governance · reuse before building | docs/24 §6 · [COMPONENT_LIBRARY](./registers/COMPONENT_LIBRARY.md) reuse check · [framework-update](../workflows/framework-update.md) Route B step 0 |
| Alternatives and scoring | docs/24 §11 — verdicts (PASS · NEEDS-IMPROVEMENT · CRITICAL), **not** numeric weights, which is what §16 below argues for |
| Decision provenance | [DECISION_LOG](./registers/DECISION_LOG.md) + `templates/docs/ADR.md` |
| Revision triggers | docs/24 §12 Reusable design intelligence · [DESIGN_RULES](./registers/DESIGN_RULES.md) |
| Lightweight / standard / deep execution | The **scale lanes** — micro · scoped · full-scale ([workflows/agents/README.md](../workflows/agents/README.md) review matrix, guard G8) |
| Unknowns are never filled in silently | [workflows/request.md](../workflows/request.md) R2 — an uncovered field is literally `unknown` |
| Verification layers | [DEFINITION_OF_DONE](../checklists/DEFINITION_OF_DONE.md) · the 12-step gate |

**What this file genuinely adds:** evidence classification (§5), conflict resolution (§6),
decision classes (§11–13), risk-calibrated execution (§18–19), the **authority separation**
(§20), the escalation contract (§21), analytics as descriptive-not-causal (§29), and the
failure-mode and never-assume lists (§36–37).

---

## 1. The reasoning flow

```text
REQUEST → FRAME → RETRIEVE → CLASSIFY → MATERIALITY → DECIDE → DESIGN → VERIFY → RECORD
```

Frame the decision · retrieve project context · classify the evidence · identify material
unknowns · choose retrieve/ask/infer/escalate/prototype/proceed · identify hard constraints and
objectives · generate alternatives where trade-offs are real · eliminate invalid options ·
compare · select · design · verify proportionally to risk · record what was material · name the
conditions that should reopen it.

**This is dynamic, not a mandatory sequence.** A low-risk decision stays lightweight. Running
the full flow on a tooltip is the failure the scale lanes exist to prevent.

---

## 2–4. Context, retrieval, and asking

See [docs/24 §1 and §2](./24-DESIGN-PLANNING.md). What this file adds:

**Context is decision-relative.** Do not collect everything that exists — retrieve what could
change the options, the outcome, the constraints, the risk, or the verification.

**"User" is not one role.** Requester · end user · developer · designer · product owner ·
business stakeholder · decision owner · specialist. They are frequently different people, and
§20 is where that matters.

**Existing implementation is evidence of what currently happens. It is not evidence of what
should happen.** See §28.

---

## 5. Evidence classification *(new)*

Every material claim has an evidentiary status, and the status changes what may be done with it.

| Class | What it is |
|---|---|
| **Binding obligation** | Law, regulation, contract, mandatory policy |
| **Approved local requirement** | An approved project/product requirement |
| **Technical fact** | A verified fact about the system, API, schema or platform |
| **User-provided fact** | Supplied by a participant, not independently verified |
| **Existing behaviour** | What the product observably does today |
| **Research evidence** | Usability, accessibility, performance, experiment data |
| **Domain expertise** | A qualified specialist's input |
| **Stakeholder preference** | An opinion — not automatically a requirement |
| **Agent inference** | A conclusion the agent derived |
| **Assumption** | A temporary proposition needed to proceed |
| **Unknown** | Currently unavailable |
| **Conflicting evidence** | Two sources that materially disagree |
| **Proposed decision** | The agent's recommendation |
| **Approved decision** | Accepted by the appropriate authority |

**Never silently convert one into another.** Each of these is a real failure, not a hypothetical:

preference → requirement · existing behaviour → requirement · technical capability → permission ·
analytics correlation → causation · generic UX guidance → local truth · agent inference → fact ·
requester statement → authoritative decision.

> This framework already refuses one of these mechanically: `/request` writes `unknown` rather
> than a plausible value, because **an invented value reads exactly like a stated one, and
> downstream it binds like one**. The table above is that same rule, generalised.

### 5b. The six kinds, for anything you are about to rely on *(v2.9.0)*

The table above classifies *where a claim came from*. This classifies *how much weight it can
carry* — and it is the shorter list to hold in your head.

| Kind | What it is | May it decide alone? |
|---|---|---|
| **Direct** | Observed in the system under test | Yes |
| **Derived** | Computed from direct evidence by a **stated** rule | Yes, once the rule is stated |
| **Inferred** | Concluded by the agent | No — label it, then verify it |
| **Estimate** | A number carrying its method and its bound | Only with both attached |
| **Assumption** | Needed to proceed, not established | No — label it, scope it, name the consequence if wrong |
| **Bookkeeping** | Proves an event was **recorded**, or a process **ran** | **Never** |

**Bookkeeping is the one that bites.** A log line proves logging ran. A commit proves a commit.
A passing gate proves the gate executed. None of them is evidence of the property you care
about. RC-017 is the worked example: `start` and `end` marks proved a run began and finished,
were briefly counted as proof that someone *worked* in it, and produced an "active" figure for a
run in which nothing happened.

> **Prefer a weaker explicit source over a stronger inferred one.** A stated lower bound people
> can see beats a confident number derived from a proxy, because the first fails visibly and the
> second fails silently — and the silent kind is what RC-008 already cost this framework once.

This is deliberately **not** a universal hierarchy. Which kind suffices depends on the decision;
§18–19 is where that is decided.

### 5c. A number recorded in a register says which kind it is *(v2.9.0)*

Any figure written into a register carries its status:

| | |
|---|---|
| **measured** | read from a clock, a counter, a test run |
| **derived** | computed from measured values, by a rule the register states |
| **estimate** | with its method and bound — `12m active (lower bound, 10m idle cap)` |
| **unknown** | the honest value when there is nothing to support a figure |

**An unsupported estimate is never written as a measured value.** Where a figure cannot be
supported, the register records its absence and why — `active: no marks`, not a flattering
number ([RUN_LOG](./registers/RUN_LOG.md) header).

> No scanner enforces this, and none should: nothing can tell `11m`-measured from `11m`-guessed
> by looking at it. Claiming otherwise would be the verification theatre §36 warns about. It is a
> register convention and a review item, and it is written down so it can be pointed at.

---

## 6. Source authority and conflicts *(new)*

There is **no universal source hierarchy**. Authority depends on scope, ownership,
applicability, status, version, freshness, binding nature, and relationship to the decision.

When sources conflict: detect it · state both claims · inspect owner, authority, scope, status,
version, date · check they apply to the same situation · check for supersession · separate fact
from intent · identify who resolves it · **do not silently pick** when the conflict touches a
material constraint, risk or authority · record the conflict and its resolution.

> Current binding obligations and applicable local constraints normally outrank generic
> recommendations. **Technical feasibility constrains what can be built; it does not determine
> what is permitted.**

---

## 7–10. Materiality, question selection, safe inference

See [docs/24 §2](./24-DESIGN-PLANNING.md), whose four categories are this framework's names for
the same thing. What this file adds:

**An unknown is material when its answer could change the decision** — the options, the
constraints, the risk, the authorisation, the feasibility, the verification, the rollout, the
recovery, the safety, or the privacy posture. Evaluate against *this* decision, never against a
generic checklist.

**Beyond infer/investigate/ask, three further outcomes exist:**

- **Material and conflicting/stale** → triangulate and resolve (§6)
- **Material and experimentally learnable** → prototype or test, rather than argue
- **Material and blocking** → block and escalate; proceeding would be unauthorised

**Ask the smallest question that separates materially different paths.**

> ✓ "Should users without approval authority be able to submit this request?"
> ✗ "Do you want a modal or a separate page?"

The first resolves an authority decision. The second forces a UI choice prematurely — and the
answer to the first may well decide it.

**Never infer** legal applicability · privacy rights · security permissions · authorisation ·
consent · financial authority · safety · irreversible actions · regulatory obligations ·
ownership or approval authority. Infer only when the risk is low, the decision reversible, the
assumption visible, the default conservative, and verification possible.

When an assumption is material, record: the assumption · why it was needed · the missing
evidence · the decision it influenced · the consequence if wrong · its owner · its validity ·
its scope · the follow-up.

---

## 11–13. Decision classes *(new)*

A **decision class** is a reusable reasoning playbook for a recurring, materially consequential
decision. It supplies context, evidence sources, recurring constraints, failure modes, candidate
options, criteria, material questions, risks, authority and verification requirements — **it
does not supply the answer.**

Formalise one when the pattern is recurring, context-variable, materially consequential, has
several real alternatives, and is costly to handle inconsistently. **Do not create one merely
because a UI pattern exists.**

**High-priority classes — these deserve playbooks:** security/authorisation · sensitive-data
display, masking, export · destructive and irreversible actions · approval workflows and
separation of duties · financial or externally consequential actions · privacy, consent and
retention · state persistence, drafts and recovery · offline, retry and sync conflict ·
AI-assisted workflows and human oversight · legacy migration and rollback · high-accessibility,
public-service and multilingual workflows · design-system exceptions and deprecations.

**Lighter classes — contextual reasoning, not a governance process:** IA and navigation ·
search/filter/sort · data presentation and density · pagination vs load-more vs infinite scroll ·
workflow structure · modal vs page vs panel · confirmation, review and undo · loading, empty,
error and recovery · onboarding and progressive disclosure · responsive representation.

> Several of these already have blessed answers here and should be **reused, not re-reasoned**:
> CP-26 (delete model), CP-28 (reversibility: irreversible confirms first, reversible acts with
> Undo), CP-27 (the audit trail), DR-5 (searchable select), DR-6 (filters that do not fit),
> DR-7 (column-level filtering).

---

## 14–17. Principles, patterns, alternatives, objectives

Established guidance is a **baseline, not an answer**: clear hierarchy · predictable navigation ·
recognition over recall · visible status · contextual feedback · user control · error prevention ·
actionable recovery · accessible focus order · preserved context.

**Never use a universal rule.** Not *always paginate*, *never use tabs*, *always use a wizard*,
*always confirm destructive actions*. Selection depends on goals, frequency, complexity, scale,
risk, device, input modality, accessibility, discoverability and constraints. Most debated
patterns have several valid answers depending on context.

Generate alternatives **only where materially different approaches remain viable** — not to look
thorough. Eliminate what violates a hard constraint, then compare on criteria chosen for *this*
decision.

**Do not invent weights or a universal UX score.** A matrix aids transparency; numbers invented
to fill it create false precision. (docs/24 §11 is verdict-based for exactly this reason.)

**Separate the three, always:** *hard constraints* that must be satisfied · *objectives* to
optimise · *preferences* that bind nothing. **An aesthetic preference never silently overrides a
security, accessibility, privacy or business constraint.**

---

## 18–19. Risk-calibrated execution *(new)*

**Risk changes the process, not merely a number.** Dimensions: reversibility · financial
consequence · privacy · security · legal · safety · external side effects · privilege · blast
radius · recovery difficulty · operational impact · uncertainty · dependent users.

| Risk | What it demands |
|---|---|
| **Low** | Safe inference · lightweight reasoning · automated verification · direct implementation within delegated authority |
| **Moderate** | Stronger evidence · stated assumptions · alternatives · a fuller decision record |
| **High** | Authoritative evidence · named authority · human approval · provenance · rollback considered · controlled rollout |
| **Very high** | Specialist review · explicit owner approval · restricted agent authority · staged implementation · monitoring · possibly human-only |

> **This is a second axis, not a replacement for the scale lanes.** Those are sized by *file
> count* (guard G8: micro is ≤2 source files). A one-file change to a permission check is
> `SCALE: micro` **and high risk** — small lane, deep reasoning. Read them together; neither
> subsumes the other.

---

## 20. Authority *(new — and the section most often skipped)*

Four distinct things, frequently held by different people:

- **Requester** — who asked
- **Decision owner** — who is authorised to decide what should happen
- **Action authority** — what permits the agent to perform the action
- **Specialist authority** — the expertise to validate a domain-specific call

A person's title, seniority, technical access, tool permissions or confidence **does not
establish decision authority**.

> **Tool permission ≠ decision authority.** The agent being *able* to run a migration says
> nothing about whether it is *allowed* to.

---

## 21. Escalation *(new)*

Escalate when material uncertainty cannot be safely resolved · sources conflict · authority is
unclear · a high-impact decision lacks approval · security, privacy or legal questions are
unresolved · financial or external consequences exist · safety may be affected · the action is
irreversible · a specialist is required · the agent would exceed delegated authority.

**An escalation is a decision package, not a request for clarification.** It contains: the
decision · why it matters · context · known facts · unknowns · assumptions · evidence ·
alternatives · trade-offs · risks · a recommendation where one is defensible · what is needed ·
**the consequence of each possible answer** · urgency · the decision-record reference.

> Never merely *"please clarify."* That hands the work back with none of the reasoning attached.

---

## 22–27. Verification, states, responsive, forms, data, auth

Verification derives from the decision. Layers: requirement · functional · accessibility ·
security/authorisation · privacy · visual/responsive · domain · performance · operational ·
user-outcome. See [DEFINITION_OF_DONE](../checklists/DEFINITION_OF_DONE.md) and the gate.

**Automated tests cannot alone prove** user comprehension · domain correctness · meaningful
consent · policy permission · translation quality · product fit · AI safety. Human, domain and
user verification remain necessary for those.

States: [docs/24 §8](./24-DESIGN-PLANNING.md). Responsive: docs/24 §7, **DR-8** (an arrangement
follows available space, not a device name) and **DR-6** (its narrow instance: a set of options
that does not fit). Forms and data-heavy interfaces:
[SCREEN_CHECKLIST](../checklists/SCREEN_CHECKLIST.md), CP-23, DR-7. **Data volume and growth:**
every read that feeds a list, a count or an export states the maximum rows it can see and takes
the shape that survives it - CP-34, [docs/28](./28-SUPABASE-LARGE-DATA-SAFETY.md).

**Two determinations belong to the design phase, not to implementation.** Both are cheap to make
early and expensive to discover late, and both were previously made by default — which is to say,
not made at all:

1. **Does this arrangement remain usable across the materially relevant width range?** If it
   depends on available space, that dependency is part of the decision (DR-8, docs/24 §7).
2. **Is this value a canonical/internal representation, or language written for a reader?** A
   machine vocabulary reaching a screen needs a presentation label decided here — the canonical
   value never changes, and the two are declared apart (CP-32). Renaming the canonical value to
   make it read better is the same defect moved into the schema.

**Authentication and security-sensitive UI is not a visual problem.** Consider auth states ·
first login · password setup and reset · session · recovery · error behaviour · rate limiting ·
lockout · authorisation · sensitive exposure · security-sensitive messaging.

> **Never infer security policy from UI appearance. Never assume that because an API permits an
> operation, the user is authorised to perform it.**

---

## 28–29. Existing code, and analytics *(§29 new)*

**Existing implementation tells you what exists, not what is correct.** Where it conflicts with
an approved requirement or policy: name the conflict, do not preserve the behaviour by default,
find the authoritative source, record the decision, and identify the migration implication.
Guard against *implementation bias* — reproducing the current UI because it is easiest.

**Analytics are descriptive, not causal.** They show usage, drop-off, frequency, errors and
conversion. They do not show *why*. "Users abandoned because the button is in the wrong place"
is a hypothesis, not a finding, unless causal evidence exists. Use analytics to generate
hypotheses; do not use them to manufacture certainty.

---

## 30–32. Design system, provenance, revision triggers

Reuse check first — [COMPONENT_LIBRARY](./registers/COMPONENT_LIBRARY.md), and
[framework-update](../workflows/framework-update.md) Route B step 0, which already makes the
four-way call: **reuse · refine · contribute · park/app-only**.

> **Consistency must not preserve an unsuitable pattern merely because it exists.** Extend where
> appropriate; make an exception where justified, and record it.

Provenance: [DECISION_LOG](./registers/DECISION_LOG.md). **Documentation scales with risk** — no
heavyweight record for a trivial decision.

Revisit a decision when material evidence changes: new requirement · changed policy, security,
privacy, API or data model · new research · behavioural evidence · production failure ·
accessibility finding · regulatory change · changed risk or authority · a superseding decision.

---

## 33–35. Action policy, questioning, autonomy *(new framing)*

**Action is proportional to Risk × Uncertainty × Consequence × Authority.** The available
actions: retrieve · triangulate · infer · ask · recommend · prototype · implement · escalate ·
block.

**Do not optimise for maximum questioning.** The objective is *the minimum number of questions
needed to avoid material error*. Questions cost interruption, latency and goodwill. Weigh the
consequence of being wrong against the cost of finding out. Low risk proceeds on safe defaults;
high risk tolerates friction.

**Do not optimise for maximum autonomy.** The objective is **maximum safe autonomy within
delegated authority**. Not every action a tool permits is an action the agent may take.

---

## 36–37. Failure modes, and what must never be assumed *(new)*

**Guard actively against:** hallucinated requirements · false authority · stale evidence ·
wrong source precedence · implementation bias · premature convergence · over-questioning ·
excessive escalation · unsafe inference · unauthorised implementation · policy blind spots ·
security and privacy omissions · **verification theatre** · analytics as causal proof · LLM
output as evidence · capability as permission · preference as requirement · blindly copied
precedent · experiments where experimentation is wrong · automation bias in human review ·
documentation overload · false precision from invented scores · universalising a
context-dependent pattern · ignoring failure and recovery states.

**Never assume, absent evidence:** the requester is the decision maker · the requester
represents all users · the existing UI is correct · an API permission is user authorisation · a
preference is a requirement · analytics explain causation · generic guidance overrides local
requirements · a design-system component fits because it exists · a missing policy means no
policy · absence of evidence is absence of requirement · confidence is correctness · one pattern
is universally best · all users share needs · risk thresholds are universal · automated tests
prove product correctness.

---

## 38–40. Execution depth and output

Depth follows the scale lanes; see §0 and §18–19. A design is **not complete because it looks
polished**. It is complete when it is:

> contextually justified · functionally coherent · accessible · technically feasible ·
> risk-appropriate · **verifiable**

The agent must be able to answer, for any material decision: what was decided · what context
shaped it · what evidence supports it · what constrained it · what alternatives were weighed ·
why this one · what assumptions remain · what risks remain · how it will be verified · when it
should be revisited.

Outputs, as the project needs them: decision summary · user flow · IA placement · interaction
spec · component spec · responsive behaviour · accessibility requirements · error and recovery
behaviour · security and privacy notes where applicable · **a concrete HTML/UI prototype** ·
acceptance criteria · verification plan · a decision record where provenance is warranted.

---

## 41. The operating principle

> **Retrieve before asking. Ask before guessing when the unknown is material. Infer only when
> the assumption is safe, bounded and reversible. Separate requirements, constraints, facts,
> preferences and assumptions. Generate alternatives when meaningful trade-offs remain. Never
> treat a generic UX pattern as universally correct. Scale reasoning, documentation, oversight
> and verification to risk and uncertainty. Never exceed delegated authority. Produce a
> concrete, verifiable design — not design advice.**
