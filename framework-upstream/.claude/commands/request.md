---
description: The single entry point - classify rough words, write the binding request file, continue into the right track
---

# /request

**Read `workflows/request.md` in full, then follow it.** That file is the single source of truth
for intake; this command exists to route you to it, not to restate it. Do not work from a
summary — the details this file omits are the ones that get skipped.

**Use when:** starting ANY piece of work from rough words — this is the single entry point;
the run continues into the right track by itself

**The rough description:** $ARGUMENTS

---

## The governing instruction

**Capture what was said, mark what was not, and hand off.**

Intake produces exactly one artifact: a filled request file in `requests/`, built from the
matching template in `templates/requests/`. The intake step itself never builds and never
plans, and never fills an uncovered field with a plausible value — an invented value reads
exactly like a stated one, and downstream it binds like one. Uncovered = `unknown`. Then the
run continues into the classified track, whose first gate restates the FIELDS for the
requester to confirm or correct before anything else happens.

## Hard boundaries

- Stated fields are **binding** on the track that consumes the file.
- A whole NEW APPLICATION (no scaffolded codebase yet) is **NEW-APP**: REQUEST_NEW scoped to
  the first shippable slice, then initialization runs BEFORE Track A —
  `docs/02-PROJECT-INITIALIZATION.md`, `npm run new:app` — the request file moves into the new
  app's `requests/`, and Track A runs inside the new app.
- A LIST, an open situation, a pure restructure, or a process failure generates **no file** —
  continue directly into `workflows/triage.md`, `workflows/brainstorm.md`,
  `workflows/refactor.md`, or `workflows/framework-update.md` **in this same run**; that
  runbook's own gates stop the work. The requester never retypes into a second command.
- Mixed input (app issue + process failure) produces the app request file AND continues
  directly into `workflows/framework-update.md` with the process half — never drop either half;
  process half first.
- When a request file was produced: continue directly into its track in this same run. The
  track's FIRST gate restates the FIELDS verbatim, marked "from your request — correct
  anything wrong"; a correction there updates the request file before work proceeds. Never
  end an intake by asking the requester to run a second command.
