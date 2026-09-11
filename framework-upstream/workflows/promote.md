# /promote — App Lesson → Framework Improvement

> The classification gate between "an app learned something" and "the framework changed".
>
> **The default verdict is APP-ONLY.** An eager classifier that over-promotes is the known
> failure mode — agree-able by nature, it will find generality everywhere. A framework that
> absorbs one app's accidents becomes a museum of them, and every future app inherits the
> exhibits.

**INPUT:** `<the app fix or improvement, with its root cause — usually straight from a Track C
close-out>`

> **Components:** a reusable-looking COMPONENT follows these same filters, with one carve-out —
> a component implementing a **baseline concern** listed in
> [docs/registers/COMPONENT_LIBRARY.md](../docs/registers/COMPONENT_LIBRARY.md) §1 was declared
> common in advance and is contributed back immediately (registry §4), skipping the rule of
> three. Everything else parks at n=1 like any other candidate.

---

## The three filters, in order — stop at the first NO

### Filter 1 — the path test *(mechanical, seconds)*

Did the change touch framework-origin behaviour at all?

- Only app feature code (`src/features/…`, app-specific modules) → **VERDICT: APP-ONLY. Stop.**
- A seed file (check `.framework/lineage.json`), a pattern the framework prescribes, or a gap a
  framework gate should have caught → continue.

Most candidates end here, and should. Classification must stay under a minute or it will be
skipped — and a skipped gate is worse than no gate, because it looks like coverage.

### Filter 2 — the domain-word test

**State the improvement as a rule. If you cannot write it without naming a business concept, it
is app-specific.**

> ✗ "Invoice totals must recompute after a line item is deleted" → app-only
> ✓ "A derived value must recompute when any input to it changes" → continue

Mechanical assist: grep the proposed rule against the source app's `PRODUCT_LEXICON.md`. A
lexicon word appearing in the rule is a strong app-specific signal. (A heuristic, not a proof —
but a cheap one that catches most over-promotion.)

### Filter 3 — the rule of three *(the register decides)*

Check `docs/registers/CANDIDATES.md` for the same class:

- **Not there** → this is n=1. **VERDICT: PARKED.** Add the row: domain-free rule · source app ·
  date · `PARKED (n=1)`. Do not touch the framework.
- **Already parked, and this sighting is from a DIFFERENT app** → n=2. **VERDICT: PROMOTE.**
  Update the row's sighting count and status.
- Already parked, same app again → still n=1 for promotion purposes. Note the recurrence — a
  same-app repeat means the app's own fix did not hold, which is a Track C matter, not a
  promotion signal.

---

## The human gate

The agent argues the case — states the domain-free rule, the filter results, and the sighting
evidence. **A person approves the verdict.** All three verdicts are recorded; a REJECTED
candidate keeps its reason in the register, because the reason it lost is the most valuable line
when someone proposes it again.

---

## On PROMOTE

Run [workflows/framework-update.md](./framework-update.md) with the candidate as input — Route A
if it derives from an incident, Route B if it is a process correction. **No new promotion
mechanics exist**; this workflow is only the gate in front of machinery that already works:

- incident entry / rule with a named rung (or declared prose-only)
- test cases with a stated registry delta
- the quadruple close-out — including the `VERSION` bump and `UPGRADES.md` entry
- conformance: the fixtures prove the change breaks no existing app
  (`scripts/audits/check-backward-compat.mjs`)

Then update the CANDIDATES row: `PROMOTED → <rule/RC id, version>`.

## What this workflow never does

- Promote on first sighting.
- Let an agent's verdict stand without a human.
- Edit application code (that already happened, in the app, under its own track).
- Weaken the safety floor.
