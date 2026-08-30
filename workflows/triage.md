# Track 0 — Backlog Triage

> Run this ONCE when the request is a **list**. Each surviving item then enters its own track.

**LIST:** `<paste the items>`

---

## Why a list is not N requests

Handled item-by-item, a list produces: work on something already built, work in an order that
forces rework, and effort spent on the cheapest item rather than the most valuable one. Twenty
minutes here routinely removes several days of work.

---

## 0.1 — Dedupe against what already exists

For each item, query the codebase and the feature register. Report one of:

- **DONE** — it already ships. Say where, and close it.
- **PARTIAL** — some of it exists. Name exactly what, and reclassify the remainder as a Track B
  enhancement of the thing that exists.
- **NEW** — genuinely net-new.

The most common surprise is a "new feature" request for something that shipped six months ago
under a different name.

---

## 0.2 — Route by nature

| Item nature | Route |
|---|---|
| Feature, enhancement, bug, refactor | Tracks A–D as normal |
| Infrastructure, ops, monitoring, configuration | A small Track A/B item **with a feasibility check** — never silently absorbed as "just config" |
| Instrumentation and analytics | Track B |
| Not a software change at all | List it under "Routed out" and say where it goes. Do not let it sit in the backlog looking like work. |

---

## 0.3 — Dependency ordering

Identify build-order constraints. An item never enters its track before its prerequisites.
Emit the dependency-ordered sequence — this is where "we should do the pricing UI first" gets
corrected to "the entitlement model has to exist before any of this."

---

## 0.4 — Score and sequence → GATE

Score each surviving item. **Reach × Impact × Confidence ÷ Effort** works; so does any model
you apply consistently. What matters is that the ordering is *stated* and *challengeable*
rather than implicit.

Output ONE table:

| Item | Verdict | Track | Depends on | Score | Proposed order |
|---|---|---|---|---|---|

→ **GATE: the requester approves or reorders the queue.**

Then items execute top-down, each through its own track and gates.

**Never start item N+1's build while item N's test gate is unresolved.** Parallel unfinished
work is how a regression gets attributed to the wrong change.
