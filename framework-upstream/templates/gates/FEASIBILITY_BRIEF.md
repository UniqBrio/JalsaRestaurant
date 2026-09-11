# Feasibility Brief — `<feature>`

**Date:** · **Verdict:** Build now | Build later | Buy | Defer | Drop

---

## Summary
Two or three sentences. What is being proposed, and what the verdict is.

## Approach
The one defensible pick, and **why the alternatives lost**. A brief that lists options without
choosing has moved the decision, not made it.

## Effort and cost
| | |
|---|---|
| Build effort | |
| One-time cost | |
| Recurring cost | |
| **Cost at 10× current volume** | *(the number that changes the decision)* |

## Manual and configuration actions
Anything a human must do, with **lead times**: vendor approvals, template registrations, DNS,
credentials, compliance sign-off.

A feature needing a two-week approval nobody has started is not shippable on the date just
quoted, and this table is where that is discovered — not in week three.

## Constraints and ceilings
Request timeouts · payload limits · rate limits · cold starts · storage · concurrency.

**Name the ceiling that actually binds.** A synchronous report generator that works for the
first customer and times out for the largest one is a design problem discovered in production.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

## Alternatives — **required if the verdict is Defer or Drop**
Also required if the preferred approach is blocked by cost or a platform ceiling.

At least one feasible alternative — a descoped version, a phased plan, different tooling — each
with its own cost and trade-offs.

**A dead-end verdict with no way forward is an incomplete brief.**

## Recommendation
The verdict, one paragraph of reasoning, and the next step.
