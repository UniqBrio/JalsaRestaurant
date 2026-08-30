# Gate 1 — Requirements: `<feature>`

> One question, or one tight group, at a time.
> **Every question carries a reasoned recommendation.** A blank question hands the work back to
> the requester; a recommendation lets them answer by agreeing.
>
> Skip anything the loaded context already answers.

| # | Question | Why it matters | Options | **Recommendation** | Answer |
|---|---|---|---|---|---|
| 1 | | | | | |

---

## Mandatory sections

### Cardinality
For **every** entity pair this feature touches, state 1:1 / 1:N / N:M explicitly, with a
recommendation. Left implicit, it is discovered during build — and by then the schema is wrong.

| Entity A | Entity B | Relationship | Recommendation | Answer |
|---|---|---|---|---|

### Roles and permissions
| Capability | Which roles | Default on/off per role | Owner-configurable? | Answer |
|---|---|---|---|---|

### States
Every screen: empty · loading · error · offline · permission-denied · first-run.
What should each say and offer?

### Platform limitations
Does any requirement depend on a capability with an entry in the limitations register?
State it here, with the proposed per-platform fallback. **Never let a limitation surface for the
first time during testing** — by then it is a redesign.

### Out of scope
What this feature explicitly does **not** do. Often the most valuable section: it is what stops
the scope conversation happening three times.
