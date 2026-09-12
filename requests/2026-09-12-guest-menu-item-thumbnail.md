# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

> ROUTING NOTE. This ask arrived with `workflows/framework-update.md` attached. It is that
> runbook's **Route C**: a feature request, not a process failure. Route C says to extract only
> the process-level learning and, if there is none, to say so and stop rather than manufacture a
> rule. There is none here — no gate stayed silent, no track skipped a step; the requester simply
> wants a thumbnail. So: no framework change, no VERSION bump, and the ask goes through the
> normal pipeline as this file.

## FIELDS
- FEATURE / SCREEN: Guest phone → menu screen → the dish rows (Egg Burji / Egg Masala / Egg Kheema Masala in the requester's screenshot — mark, name, "Egg · Indian Curry", price, and the + or stepper on the right).
- CURRENT BEHAVIOUR: A dish row is text only. The row begins with the veg/non-veg/egg mark and the name; there is no picture and the menu data carries no image.
- DESIRED BEHAVIOUR: "Put image placeholder on the left to the item name."
- WHY: unknown
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Named as still binding: the food-type mark, the name, the "type · category" line, the price, the Sold out pill, and the + / stepper on the right all stay, and tapping the row still opens the dish.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest menu screen, dish rows — available, in-cart and Sold out states. Loading / error / offline / permission-denied unaffected.
- STRINGS ADDED OR ALTERED: none — a placeholder carries no words. It is marked `aria-hidden`, because a decorative tile announced to a screen reader is noise between the mark and the name.
- PERMISSIONS: no
- USAGE: every guest, on the screen they spend longest on, once per dish in a 57-row list.
- RUN MODE: auto
- SCALE: micro

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks
  (B4) — confirm mode waits for approval; auto mode (default) logs it and applies — touching
  only what DESIRED BEHAVIOUR requires. Every changed line must trace to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4), scoped to the touched
  area: states, both themes in semantic tokens, the string table, the permission answer.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why (B1). If the miss was the process's fault, flag `/framework-update` too.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.

## NOT STATED BY THE REQUESTER — Track B must ask or assume in the open
- "Placeholder" is read literally: a tile in the shape and size a photograph will occupy, so the
  row does not re-flow the day real photographs arrive. No photograph is invented and no upload
  path is built — neither was asked for.
- Whether the ORDER-REVIEW rows get one too: not stated. Read as no. The requester's screenshot
  is the menu, and the review screen is a list of things already chosen, where a picture aids
  nothing and costs a third of the row.
- Where the photographs would eventually come from (owner upload, a menu import, a stock set):
  `unknown`, and out of scope for a placeholder.
