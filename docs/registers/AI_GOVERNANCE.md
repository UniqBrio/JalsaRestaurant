# AI Governance Register

> For applications that **ship** an AI capability to users — generative, predictive, agentic,
> retrieval, or a vendor model behind a feature.
>
> Distinct from [docs/19](../19-AI-AGENT-GUIDE.md), which covers an agent **writing** your code.
> Conflating the two is the main way this gets misapplied: a payment bug fix written by an agent
> does not need a fairness review.
>
> **One register. No parallel spreadsheets.** Append-only.

---

## Classify first — and exit cheaply

Before anything else, one line:

> *"No AI capability in this feature — sections below are N/A."*

That is the common case and it should cost one sentence. **Governance that costs more than the
capability is a defect of its own**, and a classifier that can only ever start a review will be
routed around within a month.

Dropping the AI for a deterministic rule is a legitimate — often correct — outcome. If a lookup
table does the job, the right move is to remove the model, not to govern it harder.

---

## §1 Inventory

| ID | Touchpoint | What it does | What LEAVES the product | Whose data | Risk tier | State |
|---|---|---|---|---|---|---|

**What leaves the product** is the column that matters and the one people skip. State the actual
payload, the retention period, whether it may be used for training, and the jurisdiction. *A
vendor boundary you cannot state in one paragraph is not yet feasible.*

Risk tier: `low` (assistive, easily verified by the user) · `medium` (influences a decision) ·
`high` (affects a person's access, money, or standing) · `prohibited` (do not build).

Anything that scores, ranks, flags or predicts something about an **identifiable person** is
`high` by default.

---

## §2 Risk register

| ID | System | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|

Risks worth naming explicitly, because they are specific to this class of system:

- **Confident wrongness.** The output is fluent and incorrect, which is harder to catch than an
  error, because it does not look like one.
- **Injection.** Untrusted content in the input is read as an instruction.
- **Leakage.** Retrieval crosses a tenant or permission boundary — test this, never assume it.
- **Drift.** The vendor changes the model under you. This arrives as a production incident with
  no deploy to correlate against.
- **Cost.** An unbounded loop with no ceiling.

---

## §3 Residual-risk acceptances

| ID | Risk accepted | Why | **Named owner** | Review date |
|---|---|---|---|---|

**A named person, not a team.** An unowned acceptance is an unmanaged risk with paperwork.

---

## §4 Decisions and evidence

| Date | Decision | Evidence |
|---|---|---|

---

## Requirements before shipping an AI capability

- [ ] Classified, and the inventory row exists.
- [ ] The data boundary is stated in one paragraph: what leaves, retention, training use,
      jurisdiction.
- [ ] A **kill switch** with a named owner, and a cost ceiling.
- [ ] **Disclosure** — the user can tell AI output from system fact.
- [ ] **A human oversight path that is a SCREEN** — review, correct, override, reach a person.
      It exists in the design, or it does not exist.
- [ ] Untrusted input boundaries and output validation specified.
- [ ] **A versioned evaluation set with a recorded baseline.** Non-deterministic output cannot
      be regression-tested by a single pass/fail run.
- [ ] For retrieval: every claim traceable to a retrieved source, and **cross-tenant leakage
      explicitly tested**.
- [ ] Adversarial cases for injection, jailbreak and data exfiltration — re-run on every prompt,
      model or index change.
- [ ] **Prompt, model and index versions pinned and recorded.** An unpinned prompt is an
      unreproducible release; "we changed the prompt slightly" is an undocumented migration.
- [ ] Generated media carries provenance labelling.
- [ ] Monitoring, cost and safety alerting, and an incident runbook.
