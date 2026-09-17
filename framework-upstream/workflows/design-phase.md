# Design Phase — the master execution runbook

> **How to run a design decision.** The reasoning it draws on is
> [docs/26-DESIGN-DECISIONS.md](../docs/26-DESIGN-DECISIONS.md); the method for the screens
> themselves is [docs/24](../docs/24-DESIGN-PLANNING.md) and the bar is
> [docs/23](../docs/23-DESIGN-CRAFT.md). This file is the **order of operations** between them.
>
> Entered from Track A step **A3**, Track B step **B4**, and any run whose DESIGN SURFACE block
> is non-empty. Not a slash command: it is a phase inside a track, never a separate errand.

**The objective, stated once:**

> Produce the best justified design for the **actual** project context, with the fewest
> questions, the least documentation and the shortest execution that still prevents material
> error.

Optimise for **correctness · context · safety · usability · accessibility · feasibility ·
speed**. Not for maximum questioning, maximum documentation, maximum alternatives, maximum
autonomy, or visual novelty.

---

## The first principle

Never go **requirement → UI**. Go:

```text
requirement → decision → evidence → context → design → verification
```

**Depth is proportional to the decision.** Running the full sequence on a tooltip is the failure
the scale lanes exist to prevent; skipping it on a permission boundary is the failure everything
else here exists to prevent.

---

## D0 — Frame the decision, before touching anything

Answer, briefly: what is being asked · whose task it is · what outcome is expected · **what
design decisions actually have to be made** · which of those are material · what is already
known · what is missing · **who is authorised to decide the missing part**.

**Do not ask the requester anything yet.**

---

## D1 — Retrieve first

Inspect what exists before asking: **the supplied design artifacts, if any (D10) — they are the
first source, not a footnote** · requirements and the request file · existing UI and sibling
screens · the design system and [COMPONENT_LIBRARY](../docs/registers/COMPONENT_LIBRARY.md) ·
schema, APIs and the auth model · existing flows · the registers
([CANONICAL_PATTERNS](../docs/registers/CANONICAL_PATTERNS.md),
[DESIGN_RULES](../docs/registers/DESIGN_RULES.md),
[ROOT_CAUSE_REGISTER](../docs/registers/ROOT_CAUSE_REGISTER.md),
[DECISION_LOG](../docs/registers/DECISION_LOG.md),
[PRODUCT_LEXICON](../docs/registers/PRODUCT_LEXICON.md)) · analytics and research where they
exist · tests · real data.

Retrieve what could **change the decision**. Not everything that exists.

> **Never ask the requester what the codebase already answers.** That is docs/24 §2's
> *investigate* category, and it is the single largest source of avoidable questions.

---

## D2 — Classify what you found

Tag each material claim by its evidentiary status — the table in
[docs/26 §5](../docs/26-DESIGN-DECISIONS.md). The five conversions that cause real damage:

| Never turn | into |
|---|---|
| Existing behaviour | an approved requirement |
| API capability | authorisation |
| Stakeholder preference | a business requirement |
| Analytics correlation | causal proof |
| **An approved design decision** | **an implementation preference** |

The first three guard against treating weak evidence as strong. The fourth is the reverse, and it
is the one that cost two applications (RC-018): treating STRONG evidence as weak. An approved
navigation, brand or IA demoted to "a preference" is how an agent replaces a design while
following the process correctly.

And never turn an **agent inference** into a fact. If you concluded it, say you concluded it.

---

## D3 — Materiality, then one of six actions

For each unknown: **could the answer change the design, the options, the constraints, the risk,
the authority, the feasibility, the verification or the rollout?**

**No** → proceed on a stated default. Do not ask.

**Yes** → take the first of these that applies:

| | When | Action |
|---|---|---|
| **Retrieve** | It exists somewhere accessible | Go and read it |
| **Triangulate** | Sources disagree or may be stale — **including the requester's own brief against an artifact declared authoritative** | Resolve per [docs/26 §6](../docs/26-DESIGN-DECISIONS.md) on authority · scope · freshness · provenance · evidence — never on frequency, never on who said it, never silently. Record it as an `ASSERTION` row in the contract's §9; it blocks until `resolved` with a stated precedence |
| **Infer** | Low risk · reversible · visible · conservative default · verifiable | Assume it, and **label the assumption** |
| **Ask** | Different answers give materially different designs, and nothing inspectable decides it | One question, to the **right owner**, with a recommendation |
| **Prototype** | The uncertainty is better settled by showing than by arguing | Build the smallest thing that answers it |
| **Escalate / block** | Proceeding would be unsafe or unauthorised | Stop, with the package in D8 |

**Never infer**: legal applicability · privacy rights · security permissions · authorisation ·
consent · financial authority · safety · irreversible actions · regulatory obligations ·
approval authority. These are docs/24 §2's *never assume* row, and the list is not advisory.

---

## D4 — Ask well, or not at all

Before asking, answer for yourself: why the answer matters · which decision it changes · whether
it already exists · **who is actually authorised to answer** · what changes per answer.

**Ask about the business decision, not the UI pattern** — the pattern usually falls out of it.

> ✗ "Do you want a modal or a separate page?"
> ✓ "Can users leave this workflow and come back later without losing progress?"

The second decides the first, and only the requester can answer it.

---

## D5 — Separate the three, in writing

**Hard constraints** (must be satisfied): security · privacy · accessibility level · regulation ·
approved business rules · platform limits · contracts · **every material decision in an approved
design, when one was supplied** (D10).
**Objectives** (to optimise): completion, abandonment, support load, discoverability.
**Preferences** (bind nothing): layout, visual style, interaction taste — **when nobody has
approved them.**

> **That last qualifier is the whole of RC-018.** This line used to read "Preferences (bind
> nothing): layout, visual style, interaction taste", unconditionally. Read by an agent
> implementing a supplied design, it says that navigation, brand and interaction bind nothing —
> so replacing a maroon identity with its own palette was not a violation of this runbook, it was
> *compliance* with it. An unapproved preference binds nothing; **the same subject, once
> approved, is a hard constraint.** What changes its status is the approval, not the subject.

> **A preference never silently overrides a constraint.** When a stakeholder's preference
> conflicts with a hard constraint, that is an escalation (D8), not a design trade-off.

---

## D6 — Choose the depth, then design

| Path | When | Sequence |
|---|---|---|
| **Light** | Low risk · clear requirement · evidence available · approved pattern exists · reversible · authority clear | retrieve → check → apply → verify |
| **Standard** | Several legitimate approaches · real trade-offs · moderate uncertainty | retrieve → materiality → constraints → options → trade-offs → decide → design → verify |
| **Deep** | Security, privacy, financial, external, legal, safety, irreversible, unclear authority, or conflicting authoritative sources | retrieve → triangulate → materiality → **authority** → risk → alternatives → **human review** → decide → controlled implementation → layered verification → record |

**Deep is triggered by risk, not by size.** A large feature of low-risk screens is Standard; a
one-line change to a permission check is Deep — and is still `SCALE: micro`, because the lanes
size the *diff* and this sizes the *reasoning*. Read [docs/26 §18–19](../docs/26-DESIGN-DECISIONS.md)
with the review matrix, not instead of it.

**Alternatives only where they are real.** Eliminate anything violating a hard constraint first,
then compare what survives on criteria chosen for *this* decision. No invented weights, no
universal UX score — docs/24 §11 grades by verdict for exactly that reason.

**Then design the whole experience**, not the happy path: the states that apply from docs/24 §8,
the reuse check (A3.1), the subtraction pass (A3.1b), copy, permissions, theme and contrast.

---

## D7 — Verify before showing anyone

Requirement · context · workflow coherence · accessibility · security and privacy where
applicable · technical feasibility · the states · responsive behaviour · design-system fit · and
**decision quality**: were the assumptions, conflicts and material unknowns handled honestly?

**Automated checks cannot prove** comprehension, domain correctness, meaningful consent, policy
permission, translation quality or product fit. Those need a person, and saying so is not a gap.

---

## D8 — Escalate as a decision package, never as a question

When it cannot be safely resolved, hand over: the decision · why it matters · known facts ·
evidence · the unresolved question · options · **the consequence of each answer** · risk · the
required owner or specialist · **what you can proceed with meanwhile** · urgency.

> Never "more information required." That returns the problem with none of the work attached.

---

## D9 — Deliver

**To the customer**, lead with the result: what was designed · how it works · the decisions that
matter · assumptions and open questions · **the working prototype** · what needs approval.
Keep the evidence and provenance available, not in the foreground.

Produce, as the project needs: design summary · user flow · key decisions · material assumptions ·
states and behaviours · **an HTML/UI prototype** · acceptance criteria. Add a decision record
([ADR](../templates/docs/ADR.md) → [DECISION_LOG](../docs/registers/DECISION_LOG.md)) **when the
decision is material enough to justify provenance** — not for trivia.

> The prototype is the implementation of a decision, not a substitute for making one. **Do not
> start building before the material decisions are resolved.**

---

## D10 — When the design was SUPPLIED, not produced

Everything above assumes the design is being *decided*. When an approved design arrives — a
folder of exported pages, a prototype, a spec — the job changes: **you are implementing THAT
design.** You may still choose HOW. You may not quietly choose WHAT.

> **DESIGN DECISION ≠ IMPLEMENTATION DECISION.** Component architecture, file layout, state
> management, API shape, internal abstractions and performance work are yours. Navigation
> structure, screen hierarchy, whether a designed feature exists, brand identity, primary visual
> language, key interaction patterns, role capabilities and major content structure are **not** —
> changing one is a DESIGN CHANGE, recorded with an authoriser, never an implementation detail.

**The order, and none of it is optional when a design was supplied:**

```text
design source → source authority → ingestion → inventory → DESIGN CONTRACT
   → implementation → traceability → fidelity check → drift → accept | change | escalate
```

1. **Inventory before reading deeply.** `node scripts/design-ingest.mjs <folder>` — artifacts,
   what parsed and what did not, candidate inventories, the palettes, the conflicts. A corpus is
   routinely megabytes; this is how it is inspected systematically instead of by whichever file
   fits in context. It exits **3** on an unreadable source, and that is a stop, not a prompt to
   improvise.
2. **Declare source authority.** Which artifacts ARE the design, which are supporting, which are
   examples, which are superseded. **Never infer authority from a filename.**

   > **The trap, and it is not hypothetical.** A generated corpus carries TWO design systems. The
   > product's brand is drawn on the screens, usually as literal values. The design tool's own
   > document styling sits in a `_ds/` folder and a page called something like "Reusable Design
   > Standards", and it looks far more like an authoritative design system than the screens do.
   > On the corpus that produced RC-018, the stylesheet declared a cream-and-terracotta accent
   > while one maroon literal appeared **219 times across six product screens and zero times in
   > the stylesheet**. An agent trusting the folder named `_ds` implements the document's palette
   > with perfect fidelity and ships the wrong-coloured application. The ingest tool reports the
   > two ledgers separately and **refuses to choose** — that is a D3 *triangulate*, and if it
   > cannot be settled from evidence it is an **ask**, never a preference.

3. **Write the Design Contract** — `templates/docs/DESIGN_CONTRACT.md` into the application's own
   repo. Short by design: source authority · coverage (what was EXTRACTED, never "reviewed") ·
   identity and navigation · visual identity · **MUST PRESERVE** · implementation flexibility ·
   interaction and content · recorded changes · unknown/unresolved.
4. **Gate on it — gate step G13, in `npm run gate`.** Every MUST-PRESERVE row carries
   `implemented | deferred | changed | blocked | unresolved`, and **every status has to earn its
   word**: `implemented` needs Evidence the audit **resolves against the code** (`file:` `route:`
   `testid:` `text:` `spec:` `manual:`) and a Verified-by; `deferred`/`blocked` need an owner;
   `changed` needs a §8 row; `unresolved` **blocks** — recorded is not resolved, and a baseline
   is not an approval. A reference that does not resolve makes the row MISSING and blocks. This is
   what turns "I implemented the design" from a sentence into a check.
5. **Never invent what you could not read.** An inaccessible or unparsed artifact is reported and
   asked about. A design substituted for one you could not open is the failure this whole section
   exists to prevent, and it is indistinguishable from confidence.

**Drift is classified, not counted.** `SAME` · `IMPLEMENTATION DETAIL` · `MINOR VARIATION` ·
`MATERIAL DESIGN CHANGE` · `MISSING` · `CONFLICTING` · `UNKNOWN`. A different internal component
with the same appearance and behaviour is an implementation detail and must stay one — a check
that flags every difference gets switched off in a week, and then nothing is checked at all.

**Scale applies here too.** One supplied screen does not need the full apparatus; a multi-role
application with its own design system does. What never scales away: source authority, and not
inventing what you could not read.

**Rungs:** `rung: scripts/design-fidelity.test.sh` (12 cases, in `npm run guard:test`) ·
`scripts/audits/check-design-contract.mjs` (ratchet, in `npm run audit:all`).

---

## Stop conditions

Stop when: the scope is understood · material unknowns are resolved **or explicitly accepted** ·
constraints are identified · the decisions are made · the important states are covered · it is
implementable · accessibility, security and privacy are addressed where applicable · the
prototype represents the intent · verification is done · material assumptions are recorded.

**Do not keep researching because more information could theoretically help.** Stop when the
remaining uncertainty is no longer material to *this* decision.

---

## The cost rule, applied at every step

> **Does this next step have enough expected value to justify its cost?**

Cost is execution time, tokens, interruption, and the requester's patience. If the answer is no,
take the safest reasonable path and move on.

The purpose of this phase is not to demonstrate reasoning. It is to **produce a better design,
reliably and quickly** — and a run measured at 3h 38m for fifteen minutes of work (RC-017) is
the reminder that the cost is real and is paid by somebody who is waiting.
