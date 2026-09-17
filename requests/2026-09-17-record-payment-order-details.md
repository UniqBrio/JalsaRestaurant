# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: the owner's **Record payment** dialog — `CloseBillSheet.tsx`, screen 24,
  opened from Live orders and from Payments. The screenshot shows it on B-1044.
- CURRENT BEHAVIOUR: one column, scrolling, in this order — the totals block (Food, GST 5%,
  Tip for Ramesh, To pay), a per-table breakdown headed "What each table ordered" **which is
  amounts only, no dishes**, the Discount % / Discount in ₹ pair, "Paid by", Reference, and the
  attribution sentence. Nothing on it names a single dish.
- DESIRED BEHAVIOUR: as stated — `show the order details on the left pane`.
- WHY: unknown — no reason given.
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Named explicitly because they are
  in the same dialog and easy to disturb: the discount pair and its shared control
  (`components/ui/discount-fields.tsx`, used by the captain's Close bill screen too — this
  request does not name that screen), the Paid by chips, Reference, the attribution sentence,
  the close write itself and its toast, and the existing per-table breakdown.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the Record payment dialog only. States: **loaded** and **busy**.
  Two states are `unknown` and the track must decide them: a bill whose rounds are all
  cancelled, and a bill with many rounds — the dialog is already scrollable and a long dish
  list makes it longer.
- STRINGS ADDED OR ALTERED: a heading for the new pane — `unknown`, not stated. The adjacent
  shipped heading is "What each table ordered".
- PERMISSIONS: no. The dish list is already in the payload every opener of this dialog receives;
  showing it grants nothing new. (`canDiscount` still gates the discount pair, untouched.)
- USAGE: every bill closure passes through this dialog. unknown beyond that.
- RUN MODE: auto
- SCALE: scoped — one component, no data-layer change; **not micro**, because a new pane and a
  new heading exceed "no user-visible string except one the request states verbatim".

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
- **The data is already there.** `OwnerBillView.kots[].items[]` (`owner-view.ts:74-93`) carries
  every line: `name`, `qty`, `foodType`, `lineLabel`, `cancelled` — and the round carries
  `code`, `fromTable`, `source`, `sourceLabel`, `placedAt`. `CloseBillSheet` already receives
  the whole `bill` object and simply never reads `bill.kots`. **No query, no route, no
  migration.** That is the whole reason this is small.
- **The dialog is 736px at its widest.** `sheet.tsx:58` — `posture="modal"` is
  `w-[min(46rem,calc(100vw-2rem))]`. Two panes inside 736px gives roughly 350px each, which is
  workable for a dish list beside a form. Below that the width is the viewport minus 2rem, and
  at 360px two panes would be ~160px each — not a layout, a squeeze.
- **"Left pane" is a desktop instruction.** There is no width at which a phone has a left pane.
  The dialog must therefore be one column below some breakpoint, and which one is a decision.

## OPEN QUESTIONS CARRIED TO THE GATE (not decided at intake)
1. **What counts as "order details"?** The dish lines from `bill.kots[].items[]` is what the
   evidence supports — the per-table breakdown already shows amounts, so amounts are not what is
   missing. Confirm: dish name and quantity per round, or something else?
2. **Does the modal get wider?** 736px split two ways is tight for a long dish name beside a
   form. Widening it is a change to the shared `Sheet` primitive, which every other modal uses —
   so the alternative is a wider value used only by this dialog.
3. **Where does one column reappear** — at 1024px, 768px, or lower? And below it, does the dish
   list go above the form or below it?
4. **Cancelled lines and per-line prices** — shown, struck through, or omitted? `cancelled` and
   `lineLabel` are both in the payload, so either is free; neither was asked for.

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
