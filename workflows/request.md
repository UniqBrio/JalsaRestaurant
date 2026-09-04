# Intake — Write the Request

> Run this when the ask exists only as **rough words**. It produces ONE filled request file —
> nothing else. It never builds, never plans, never starts a track.
>
> **The governing instruction: capture what was said, mark what was not, and stop.**

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
| Something that does not exist yet | **NEW** | Fill [templates/requests/REQUEST_NEW.md](../templates/requests/REQUEST_NEW.md) → Track A |
| Something works, but should behave or look different | **CHANGE** | Fill [templates/requests/REQUEST_CHANGE.md](../templates/requests/REQUEST_CHANGE.md) → Track B |
| Something is broken — erroring, wrong output, wrong data | **BUG** | Fill [templates/requests/REQUEST_BUG.md](../templates/requests/REQUEST_BUG.md) → Track C |
| Same behaviour, better structure | no file — run [/refactor](./refactor.md) directly; its scope statement is its own intake |
| A LIST of several things | no file — run [/triage](./triage.md) on the list; each surviving item returns here individually |
| A situation with no clear next action ("what should happen when…", weighing options) | no file — run [/brainstorm](./brainstorm.md); its decision summary drafts the request file afterwards if one is needed |
| The PROCESS misbehaved — a track skipped a step, a gate stayed silent, a template has a gap | no file — run [/framework-update](./framework-update.md) on the description |
| Genuinely ambiguous (e.g. "improve X" where X may be broken) | ask exactly **one** question, then classify |

**The classification boundary that matters most:** "it should behave differently" (CHANGE) vs
"it does not do what it already promises" (BUG). A bug run as a change skips root cause; a
change run as a bug invents a defect that was a decision. When the requester's words carry an
error message, wrong data, or "stopped working" — it is a BUG. When they carry "instead",
"also", "rather than", "would be better" — it is a CHANGE.

**Mixed input rule.** A description containing BOTH an app issue AND a process failure ("the
price bug shipped AND the gate never caught it") produces the request file for the app issue
AND names the process half for a `/framework-update` run — never silently drop either half.

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

## R3 — Deliver, then STOP

1. Write the filled file to `requests/<yyyy-mm-dd>-<short-slug>.md` (see
   [requests/README.md](../requests/README.md) for the folder's lifecycle).
2. Report: the classification, the file path, every field left `unknown`, and the one line:
   **"Review the FIELDS, then run `/<track> requests/<file>`."**
3. **STOP. Never start the track yourself.** The requester reviewing the fields IS the gate —
   an intake that flows straight into execution removes the only moment the requester can
   catch a wrong classification or a wrong binding field cheaply.

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
- Output: `requests/2026-09-04-report-export-columns.md`, then
  "Review the FIELDS, then run `/bug requests/2026-09-04-report-export-columns.md`."
