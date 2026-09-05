---
description: Track A - a new feature, through four gates (auto: logged checkpoints; confirm: approvals)
---

# /feature

**Read `workflows/feature.md` in full, then follow it.** That file is the single source of truth for this
track; this command exists to route you to it, not to restate it. Do not work from a summary —
the details this file omits are the ones that get skipped.

**Use when:** the request adds a capability that does not exist yet

**The request:** $ARGUMENTS

---

## Before you start (every track)

1. Read `CLAUDE.md` in full. Its architectural rules are **binding** and nothing in the
   request overrides them.
2. Read `docs/registers/CANONICAL_PATTERNS.md` for every concern this change touches. One
   blessed idiom per concern — mirror the reference file. A second way is a defect.
3. Read `docs/registers/ROOT_CAUSE_REGISTER.md` entries whose module overlaps this change.
4. Load **only** the slice of the codebase this request touches. Never a full-repo read for a
   scoped request, and never work from memory of a file — read it.
5. State your assumptions before acting. Where the request admits two readings, present both.

## The four gates
Requirements → **GATE 1** · Feasibility → **GATE 2** · Design → **GATE 3** · Plan → **GATE 4**

Each gate is a **stop**. Present the deliverable and wait. Do not proceed on assumptions, and do
not run two gates together to save time — the gates exist because being wrong is cheapest early.

## Close out

`checklists/DEFINITION_OF_DONE.md` — every item, or an explicit N/A with a reason.
Then the gate: `/gate`. **Nothing merges without a PASS.**
