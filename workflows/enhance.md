# Track B — Modify an Existing Feature

> For enhancements, UI/UX improvements and behaviour changes to something that already ships.
>
> **The governing instruction: do not regenerate the feature. Modify it surgically.**

**REQUEST:** `<one line>`

---

## Why this track is separate from Track A

A new feature has no users and no expectations. An existing one has both. The risk profile is
completely different: the dominant failure here is not "the new thing doesn't work", it is
**"something else stopped working and nobody looked"**.

So this track spends its effort where Track A spends it on discovery: on knowing what else is
attached to the thing you are about to move.

---

## B1 — Read what actually exists

Load the context slice for the named feature and **read the current files**. Not your memory of
them, not a design document describing them, not last month's screenshot. The files.

State, in one short paragraph, how the feature works today. If you cannot, you are not ready to
change it.

---

## B2 — Impact analysis (before proposing anything)

Enumerate, explicitly:

| Surface | Question |
|---|---|
| Screens | Which screens render this, including ones that embed it as a component? |
| Components | Who imports the components you will touch? |
| Data | Which tables does it read and write? **Who else writes those tables?** |
| Contracts | Which API routes, functions or events carry this data? |
| Background work | Scheduled jobs, triggers, notifications keyed on this data? |
| Reports/exports | Anything that aggregates or exports these records? |
| Permissions | Which roles can see or do this, and does that change? |
| Documentation | Which module docs and registers describe current behaviour? |

**The sibling call-site sweep.** If the change touches a shared write path, grep for *every*
other writer of that table or function and check each carries the same guard. A fix or change
applied at one call site while its twin ships unchanged elsewhere is the single most common
way a "surgical" change causes an outage somewhere unrelated.

Mirroring a sibling screen means mirroring its **guards**, not just its columns.

---

## B3 — Clarify only the genuine unknowns

Ask only what the code and context cannot answer. One question at a time, each with a
recommendation. A small, well-specified change often needs zero questions — asking anyway is
friction, not diligence.

---

## B4 — Plan → GATE

A short plan, but it must contain all three of:

1. **What changes** — files and behaviour.
2. **What is deliberately NOT changing** — the guarantee the requester is actually buying.
3. **Regression risks and their mitigations** — from B2, each with the test that covers it.

If the change is visual or interactive, add a mini design pass **scoped to the touched area
only**. An enhancement is not a licence to redesign the screens around it.

**Copy scope (the freeze rule).** Only strings this change *adds*, or whose meaning it
genuinely alters, get new wording. Every other string on the touched screen stays exactly as
shipped — byte for byte.

Silent rewording is a product change nobody approved. It breaks the requester's own muscle
memory, invalidates every support answer that quoted the old word, and invalidates every test
expectation that asserted it — and none of those failures show up as a red test. If you notice
off-voice copy nearby, log it as a candidate for a dedicated copy pass; do not fix it here.

→ **GATE: the requester approves the plan.**

---

## B5 — Apply

Preserve all existing behaviour not explicitly in scope. When you find yourself "improving"
something adjacent, stop: that is a separate request with its own approval.

Update the known-limitations register if this change resolves, alters or removes a capability
any entry depends on.

---

## B6 — Verify

**Diff review: every changed line must trace to the request.** A line you cannot justify is
either an unrequested change or a mistake, and both are worth finding before merge.

Then the close-out checklist and the test gate
([workflows/test-gate.md](./test-gate.md)). The blast radius from B2 defines the regression
scope — that is what B2 was for.
