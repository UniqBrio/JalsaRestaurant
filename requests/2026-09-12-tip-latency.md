# BUG REQUEST — something that ships is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->

Run **Track C** ([workflows/bug.md](../workflows/bug.md)) with this request.

> ROUTING NOTE. Arrived with `workflows/framework-update.md` attached. Route C of that runbook:
> an application defect, not a process failure. No framework change, no VERSION bump.

## FIELDS
- WHAT HAPPENS: "The tip addition or removing tip is taking too long."
- WHO IS AFFECTED: a guest on the tip screen, on a phone. Selectivity beyond that: `unknown`.
- WHERE: guest phone → tip screen ("Add a tip for Imran?"), the No tip / + ₹10 / + ₹20 / + ₹30 row and the bill summary under it.
- WAS IT WORKING BEFORE?: `unknown` — not stated.
- REPRO STEPS: `unknown` as stated, but the requester's screenshot is itself the repro and the evidence: the **+ ₹30** chip is the highlighted one while the summary underneath still reads **Tip for Imran ₹20** and **To pay ₹1,659**. The chip is optimistic; the figures are not. That gap is the complaint.
- ERROR WORDING: none — this is latency, not an error.
- CORRECTION ROUND: 1
- RUN MODE: auto

## STANDING INSTRUCTIONS (do not edit)
- Track C finds the ROOT CAUSE before proposing a fix, and states it in one sentence.
- The fix is the minimum change that removes the cause, not the symptom.
- A regression rung is added for the cause, not for the report.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## ROOT CAUSE (stated at Track C's first stop, from reading the code)
One tap costs **three serial round trips**, and the screen is frozen for all of them:

1. `POST /api/guest/bill {action:'tip'}` — writes the tip, answers `{ tip: amount }`.
2. `useLiveData.send` then calls `refreshNow()`, which is `GET /api/guest/state`.
3. `refreshNow` is `if (await refreshOnce(true)) await refreshOnce(true)` — a read a person
   caused is never dropped (JP-13), so when the six-second poll is already on the wire the read
   is owed and runs **again**. A second GET.

Each trip is a phone → Vercel → Supabase (ap-southeast-2) → back. Meanwhile `runBusy` holds
`busy = true` from the tap until the last of them lands, so every chip is disabled and the
summary shows the old figures — which is exactly the screenshot.

The server already knows the new state at step 1. It has just written it and is sitting next to
the database. Nothing about the design required it to make the phone go and ask.
