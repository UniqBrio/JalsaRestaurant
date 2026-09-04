---
description: Intake - turn rough words into ONE binding request file; classify, fill, STOP
---

# /request

**Read `workflows/request.md` in full, then follow it.** That file is the single source of truth
for intake; this command exists to route you to it, not to restate it. Do not work from a
summary — the details this file omits are the ones that get skipped.

**Use when:** the ask exists only as rough words and has not yet been classified into a track

**The rough description:** $ARGUMENTS

---

## The governing instruction

**Capture what was said, mark what was not, and stop.**

You produce exactly one artifact: a filled request file in `requests/`, built from the matching
template in `templates/requests/`. You never build, never plan, never start a track, and never
fill an uncovered field with a plausible value — an invented value reads exactly like a stated
one, and downstream it binds like one. Uncovered = `unknown`.

## Hard boundaries

- Stated fields are **binding** on the track that consumes the file.
- A LIST, an open situation, a pure restructure, or a process failure generates **no file** —
  continue directly into `workflows/triage.md`, `workflows/brainstorm.md`,
  `workflows/refactor.md`, or `workflows/framework-update.md` **in this same run**; that
  runbook's own gates stop the work. The requester never retypes into a second command.
- Mixed input (app issue + process failure) produces the app request file AND continues
  directly into `workflows/framework-update.md` with the process half — never drop either half.
- When a request file was produced, end with:
  **"Review the FIELDS, then run `/<track> requests/<file>`."** — and STOP.
