# Business Readiness

> **A change is not done when code merges. It is done when every affected surface tells the same
> story.**
>
> The tiers exist so you run the *right amount* of this, not all of it. A protocol that costs
> the same for a typo fix and a new pricing model gets skipped for both.

---

## Pick the tier first, and say it out loud

| Tier | Qualifies | What it costs you |
|---|---|---|
| **T0 — invisible** | Internal refactor, performance work, process files. Zero user-visible change. | One line: *"T0 — no user-facing impact."* |
| **T1 — noticeable** | A fixed bug, a changed validation, a changed message. | Impact scan + release-note line + a note for whoever answers questions |
| **T2 — visible** | New screens, changed flows, new settings. | T1 + user communication + a note on anything that demonstrates the product |
| **T3 — new capability** | A new module, or anything affecting pricing or plans. | Everything, plus a pre-release review |

Most changes are T0 or T1. Saying the tier out loud is what stops a T3 being shipped as a T1 —
which is the failure this exists to prevent.

---

## §A — Impact scan (T1 and above)

One line each, or an explicit N/A:

| Surface | The question |
|---|---|
| Product | Does anything else in the product now behave differently? |
| Pricing | Does this affect what a plan includes? |
| Sales | Does this change what can be promised? |
| Marketing | Does any published claim become true, false, or newly available? |
| Support | What new question will arrive, and what is the answer? |
| Onboarding | Does a new user's first experience change? |
| Finance | Does this change what is billed, when, or how it is reported? |
| Demo | Does anything that demonstrates the product now show something different? |

**N/A is a fine answer. An unconsidered surface is not** — that is the one that ships with a
stale demo.

---

## §B — Deliverables, scaled by tier

Always sourced from the existing registers, never forked into a parallel copy:

- **Release note** — in the language of the user, not the commit.
- **Support reference** — the scenario, the answer, and when to escalate.
- **Feature register update** — [FEATURE_TRUTH.md](../docs/registers/FEATURE_TRUTH.md). *Every
  external claim about the product is sourced from this file only.* Skip it and a website ends up
  promising what the product no longer does.
- **User communication** (T2+) — per channel, with the timing.
- **Sales and demo updates** (T2+) — the demo is a surface like any other, and it is the one that
  goes stale silently.
- **Pricing and plan updates** (T3).

**Every action has a named owner.** An unowned action is how a launch ships with a stale demo:
everyone assumed it belonged to someone else, and nobody was wrong.

---

## §C — Risk (T2 and above)

Confusion risk · migration risk · training need · documentation gaps · support load ·
what happens if it must be reversed after users have seen it.

---

## §D — Pre-release review (T3 only)

Walk every §B item. Each is **DONE**, or explicitly listed as **MISSING with its impact**.

- A listed gap can ship, with written acceptance.
- **An unlisted gap blocks.**

The distinction is the whole mechanism: it is not "everything must be perfect", it is
"everything must be *known*". A launch that ships with three known gaps and one owner per gap is
in far better shape than one that ships with three gaps nobody named.
