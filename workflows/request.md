# Intake — Write the Request

> Run this when the ask exists only as **rough words** — the ONE command a requester ever
> needs to start work. It writes ONE filled request file, then continues into the classified
> track, whose first gate restates the FIELDS for confirmation. The intake step itself never
> builds and never plans.
>
> **The governing instruction: capture what was said, mark what was not, and hand off.**

**ROUGH DESCRIPTION:** `<the requester's words, however rough>`

---

## Why this step exists

Every track downstream assumes a classified, honest request. Fed a rough one-liner instead,
the pipeline does not stop — it **fills the gaps itself**, silently, and each silent fill is a
design decision the requester never made. The result is the correction-on-correction loop:
the build is "done", the requester lists what is wrong, the next run fills the *new* gaps
silently, and the loop repeats. The gap was never in the build. It was at intake.

This step converts rough words into a request file with two properties the tracks can rely on:

1. **Stated fields are binding.** What the requester actually said cannot be overridden by an
   assumption downstream.
2. **Unstated fields say `unknown`.** An `unknown` is a question the track MUST ask (Track A's
   Gate 1 questionnaire, Track B's B3, Track C's repro). It is never a blank for the agent to
   fill.

The most expensive word this file can contain is a plausible value the requester never said.

---

## R1 — Classify

Read the rough description and pick exactly one:

| The description says… | Classification | Then |
|---|---|---|
| A whole new APPLICATION — no scaffolded codebase exists to receive the work | **NEW-APP** | Fill [templates/requests/REQUEST_NEW.md](../templates/requests/REQUEST_NEW.md) for the **first shippable slice** → initialization, then Track A (see the NEW-APP flow below) |
| Something that does not exist yet, in an app that does | **NEW** | Fill [templates/requests/REQUEST_NEW.md](../templates/requests/REQUEST_NEW.md) → Track A |
| Something works, but should behave or look different | **CHANGE** | Fill [templates/requests/REQUEST_CHANGE.md](../templates/requests/REQUEST_CHANGE.md) → Track B |
| Something is broken — erroring, wrong output, wrong data | **BUG** | Fill [templates/requests/REQUEST_BUG.md](../templates/requests/REQUEST_BUG.md) → Track C |
| Same behaviour, better structure | no file — continue directly into [workflows/refactor.md](./refactor.md); its scope statement is its own intake |
| A LIST of several things | no file — continue directly into [workflows/triage.md](./triage.md) with the list; each surviving item returns here individually |
| A situation with no clear next action ("what should happen when…", weighing options) | no file — continue directly into [workflows/brainstorm.md](./brainstorm.md); its decision summary drafts the request file afterwards if one is needed |
| The PROCESS misbehaved — a track skipped a step, a gate stayed silent, a template has a gap | no file — continue directly into [workflows/framework-update.md](./framework-update.md) with the description |
| Genuinely ambiguous (e.g. "improve X" where X may be broken) | ask exactly **one** question, then classify |

**One entry point, every exit continues.** The requester starts here and only here, and
never retypes into a second command. A classification that produces a request file
(NEW / CHANGE / BUG) writes it and continues into its track **in this same run**; the review
of the FIELDS is not lost — it moves to the track's first gate, which restates them for
confirmation (see R3). A routed-out classification (list, open situation, restructure,
process failure) produces no file and continues into its runbook the same way. Either way,
the first stop the requester meets is a gate with real content in front of it — never a
prompt to run another command.

**The NEW-APP flow.** NEW asks for a feature; NEW-APP asks for a product — the test is
whether a scaffolded codebase exists to receive the work. When none does, Track A alone would
build a feature with no application under it, so initialization comes first:

1. Fill REQUEST_NEW as usual, scoped to the **first shippable slice** — the app's
   one-paragraph brief comes from ONE-LINE GOAL. An application is a *list* of features, and
   a list belongs to triage: note the remaining wants in EXPLICITLY OUT as later `/request`
   runs, never as one request file trying to bind a whole product.
2. Continue into [docs/02-PROJECT-INITIALIZATION.md](../docs/02-PROJECT-INITIALIZATION.md) —
   scaffold (`npm run new:app`), then the day-one steps in order.
3. Move the request file into the new app's `requests/` folder — its first ledger entry, the
   "why" of the first build.
4. Run Track A **inside the new app** with that file; its first gate restates the FIELDS as
   always. A fresh scaffold has empty registers and no sibling screens — the starter's
   reference implementation is the sibling pattern, and that is expected, not a blocker.

**The classification boundary that matters most:** "it should behave differently" (CHANGE) vs
"it does not do what it already promises" (BUG). A bug run as a change skips root cause; a
change run as a bug invents a defect that was a decision. When the requester's words carry an
error message, wrong data, or "stopped working" — it is a BUG. When they carry "instead",
"also", "rather than", "would be better" — it is a CHANGE.

**Mixed input rule.** A description containing BOTH an app issue AND a process failure ("the
price bug shipped AND the gate never caught it") produces the request file for the app issue
AND then continues directly into [workflows/framework-update.md](./framework-update.md) with
the process half — never silently drop either half. Both halves proceed: the app half into its
track (FIELDS confirmed at its first gate), the process half to framework-update's own
diff-approval gate. Run the process half FIRST — if the process gap caused the app issue, the
track that fixes the app should run with the gap already repaired.

---

## R2 — Fill the template

Binding rules, in order of how expensive their violation is:

1. **Use only what the requester said.** A field the description does not cover is `unknown`.
   Never invent affected users, must-haves, repro steps, or motivations — an invented value
   reads exactly like a stated one, and downstream it binds like one.
2. **BUG:** preserve the requester's exact error wording in quotes. Record WHO IS AFFECTED
   with whatever selectivity the description states ("only on X, Y is fine") — selectivity is
   a root-cause clue and Track C's step C2 depends on it verbatim.
3. **CHANGE:** MUST NOT CHANGE is always populated. If the requester named nothing, write
   `everything not named in DESIRED BEHAVIOUR`. This line is the guarantee the requester is
   actually buying, and Track B's plan (B4 item 2) starts from it and may only add to it.
4. **NEW:** split wants into MUST-HAVE vs EXPLICITLY OUT only if the requester signalled
   priority; otherwise put them all in MUST-HAVE and note `requester to trim at Gate 1`.
   **NEW-APP:** scope MUST-HAVE to the first shippable slice only; every further want is
   listed in EXPLICITLY OUT as a later `/request` run of its own.
5. **DESIGN SURFACE (NEW and CHANGE):** if anything the user sees changes, fill the block —
   name the screens/states touched and which state and theme obligations apply. Writing
   `not visual` for a change that touches anything rendered is a defect: this block is what
   the track's design pass executes against, and an empty block is how design gaps ship.
6. **CORRECTION ROUND (CHANGE and BUG):** if the description says or implies this surface was
   already corrected before ("still", "again", "after the last fix"), record the round number
   and where the previous attempt lives (request file, commit, or "unknown"). Round ≥ 2
   obliges the track to read the previous attempt and state what it missed **before proposing
   anything** — a second correction that cannot explain the first is about to repeat it.
7. **Keep the template's STANDING INSTRUCTIONS block verbatim.** It is the track contract,
   not per-request content.

---

## R3 — Deliver, then continue into the track

1. Write the filled file to `requests/<yyyy-mm-dd>-<short-slug>.md` (see
   [requests/README.md](../requests/README.md) for the folder's lifecycle).
2. Report, briefly: the classification and why, the file path, and every field left `unknown`.
3. **Continue directly into the classified track with the file — in this same run.** Do not
   ask the requester to run a second command.
4. **Capture the run mode.** If the description says how to run — "don't wait for approvals",
   "confirm each step" — record `RUN MODE: auto` or `confirm` in the file; say nothing and the
   default (`auto`, [docs/01 §Run modes](../docs/01-SDLC.md)) applies. In auto mode the
   FIELDS restatement below lands at the top of the run report instead of waiting at a gate —
   stated fields bind identically in both modes.
5. **The field review happens at the track's first gate, not here.** The first stop the track
   presents (Track A's Gate 1 questionnaire, Track B's B3 questions or B4 plan, Track C's
   root-cause statement) MUST restate the request file's FIELDS verbatim at the top, marked
   "from your request — correct anything wrong". A wrong classification or a wrong binding
   field corrected there costs nothing; the same error discovered after the build is the next
   correction round. If the requester corrects a field at that gate, update the request file
   to match before proceeding — the file and the work must never tell different stories.

---

## Worked example

Rough description: *"the export on the report screen still gives the old columns even after
last week's fix, and finance says the totals row is missing too — totals worked before"*

- Classification: **BUG** (was working, now wrong output) — not CHANGE, despite "columns"
  sounding like a preference: "still gives the old columns **after the fix**" means the
  previous correction did not land.
- CORRECTION ROUND: 2 — previous attempt "last week's fix" (commit unknown).
- WHO IS AFFECTED: finance users of the report export (as stated; scope beyond that `unknown`).
- WHAT HAPPENS: old columns in export; totals row missing. WAS WORKING BEFORE?: totals — yes.
- Fields not covered by the description — repro steps, when it started, which report variants —
  are written as `unknown`, and Track C will ask.
- Output: `requests/2026-09-04-report-export-columns.md`, then the run continues directly
  into [workflows/bug.md](./bug.md) with that file. Track C's first stop — the root-cause
  statement, and before it the round-2 account of what last week's fix missed — opens by
  restating these FIELDS for confirmation.
