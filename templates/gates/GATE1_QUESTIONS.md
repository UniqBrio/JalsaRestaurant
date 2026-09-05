# Gate 1 — Requirements: `<feature>`

> One question, or one tight group, at a time.
> **Every question carries a recommendation, its reasoning, and alternatives.** The
> recommendation explains why that option wins in THIS context — not just which one. Options
> always end with **"Other: describe your own"**; the requester may take the recommendation,
> pick any option, or define their own. Their answer binds.
>
> Skip anything the loaded context already answers.

| # | Question | Why it matters | Options (last is always "Other: …") | **Recommendation + why** | Answer |
|---|---|---|---|---|---|
| 1 | | | | | |

---

## Feature triage *(new application / new module only — [docs/24 §2](../../docs/24-DESIGN-PLANNING.md))*

> From timeboxed research (3–5 comparators; sources or "model knowledge, <date>") filtered
> through the context lenses: type · region · legal/regulatory · customers · scale ·
> standards. **The requester decides every row — in every run mode.**

| Tier | Feature | Why this tier, here | Requester's decision |
|---|---|---|---|
| Must-Have | | | keep / move / drop |
| Recommended | | | build next / promote to v1 / drop |
| Good-to-Have | | | park / promote / drop |

**Ignored (found in research, deliberately excluded):**

| Feature seen in | Why it is wrong here |
|---|---|

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
