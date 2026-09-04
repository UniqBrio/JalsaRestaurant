# Track B — Modify an Existing Feature

> For enhancements, UI/UX improvements and behaviour changes to something that already ships.
>
> **The governing instruction: do not regenerate the feature. Modify it surgically.**

**REQUEST:** `<one line, or the path of a requests/ file written by /request>`

When the request is a `requests/` file: its stated fields are **binding** — never re-ask them,
never override them — and every field marked `unknown` is precisely a B3 question. Its
MUST NOT CHANGE line seeds B4 item 2, and its DESIGN SURFACE block declares whether the B4
correction design pass runs. Arriving via `/request` in the same run, the first stop (B3's
questions, or the B4 plan when there are none) OPENS by restating the FIELDS verbatim — "from
your request — correct anything wrong" — because the requester has not reviewed them yet; a
correction there updates the request file before anything proceeds.

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

**The correction-round check.** If this surface was corrected before — the request says so
(CORRECTION ROUND ≥ 2), or the words "still" / "again" / "after the last fix" appear, or the
git log shows these files recently changed for the same complaint — read the previous request
and the diff that closed it, and state **what the last attempt missed and why**, before
proposing anything. A second correction that cannot explain the first is about to repeat it.
If the miss was the process's fault (a step skipped, a gap no track covers), also flag it for
[/framework-update](./framework-update.md) — fixing the symptom twice is how it ships a third
time.

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
   When the request carries a MUST NOT CHANGE line, it seeds this list verbatim; the plan may
   add to it, never subtract.
3. **Regression risks and their mitigations** — from B2, each with the test that covers it.

**The correction design pass (mandatory when the change is visual or interactive).** This is
Track A's design discipline, **scoped to the touched area only** — an enhancement is not a
licence to redesign the screens around it, but a smaller canvas does not waive the obligations
on it. The plan states, explicitly:

| Obligation | What the plan must contain |
|---|---|
| States | For the touched area: empty · loading · error · offline · permission-denied — what each renders, or N/A per state with a reason |
| Both themes | What the touched surfaces render as in light AND dark, **semantic tokens only** — never "it will inherit" |
| Strings | The string table for every string this change adds or alters (surface · placement · final string) |
| Permissions | Does who-can-see-or-do change? If yes, the five RBAC questions; if no, say so |

The design gaps that force a second correction live exactly here: a correction built without
this pass ships the happy path in one theme and leaves every other state to be discovered by
the requester — who then files the next correction. Skipping the pass requires the claim
**"not visual"**, and the diff review in B6 checks that claim against the files actually
touched.

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
either an unrequested change or a mistake, and both are worth finding before merge. If the
plan claimed **"not visual"**, verify it here: a diff touching anything rendered voids the
claim, and the B4 correction design pass runs before this change proceeds.

If the change is visual: **render and look at the touched area, in both themes**, before
calling it done. "The build compiled" is not evidence that text is readable.

Then the close-out checklist and the test gate
([workflows/test-gate.md](./test-gate.md)). The blast radius from B2 defines the regression
scope — that is what B2 was for.
