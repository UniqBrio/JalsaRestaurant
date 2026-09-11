---
description: Track E - think it through; no code, no gates, no file edits
---

# /brainstorm

**Read `workflows/brainstorm.md` in full, then follow it.** That file is the single source of truth for this
track; this command exists to route you to it, not to restate it. Do not work from a summary —
the details this file omits are the ones that get skipped.

**Use when:** there is no clear next action yet

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

## The constraint
**Thinking only.** No code, no gates, no file edits until the decision routes back into a normal
track. The deliverable is a Decision Summary whose next step is a drafted request, a recorded
rule, or an explicit "no change".

## Close out

`checklists/DEFINITION_OF_DONE.md` — every item, or an explicit N/A with a reason.
Then the gate: `/gate`. **Nothing merges without a PASS.**
