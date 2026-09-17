# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: the guest's **"One last thing?"** screen — the upsell that appears at `/t/<table>`
  once the bill has been requested (`UpsellScreen`, guest screen 9). Identified from the
  screenshot: it is the only screen carrying all three named buttons. The tip screen in the
  second screenshot also shows "Pay ₹200"; it was **not** named and is not in scope.
- CURRENT BEHAVIOUR: the bottom action bar holds three controls, in this order —
  1. `Pay ₹200` (large, primary) → goes to the tip screen
  2. `＋ Continue Ordering` (secondary) → pauses the payment request and returns to the menu
  3. `No thanks, continue to payment` (ghost) → goes to the tip screen
- DESIRED BEHAVIOUR: as stated, verbatim —
  `Remove "Pay Rs. 200" button and change to "Continue ordering"` → the large primary slot
  becomes **Continue ordering**;
  `add tip button in the place of "Continue ordering" button` → the slot the secondary
  "＋ Continue Ordering" occupies becomes a **tip** button;
  `Remove "No thanks, continue to payment" button` → that control goes;
  `Ensure the page is responsive`.
- WHY: unknown — no reason given.
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. Named explicitly because they are
  one tap away and easy to touch by accident: the tip screen's own action bar ("Pay ₹200",
  "I will pay Imran directly"), the `resume-ordering` write itself and its "Payment request
  paused. Order away." toast, the three upsell tabs and their offer lists, the bill-ready banner.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest screen 9 ("One last thing?") action bar only. States affected:
  **loaded** and **busy** (both remaining buttons are disabled while a write is in flight).
  Empty / error / offline / permission-denied are not affected — the action bar renders the same
  controls in all of them.
- STRINGS ADDED OR ALTERED:
  - removed: `Pay {amount}`, `No thanks, continue to payment`
  - the primary button's label: `Continue ordering` — the requester's own capitalisation, which
    differs from the shipped `＋ Continue Ordering`. **Exact label and whether the ＋ survives:
    unknown — the gate asks.**
  - the tip button's label: **unknown — not stated.** The tip screen's shipped words are
    "Add a tip for Imran?" / "No tip" / "Custom".
- PERMISSIONS: no — guest surface, no role gate on any of these controls.
- USAGE: every guest who requests the bill passes this screen once per visit. unknown beyond that.
- RUN MODE: auto
- SCALE: scoped

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
- All three controls live in one `ActionBar` in `src/features/guest/GuestClosure.tsx:265-279`,
  test ids `guest-upsell-pay`, `guest-upsell-continue-ordering`, `guest-upsell-skip`.
- `guest-upsell-pay` and `guest-upsell-skip` do the **same thing** — `go('tip')`. Removing the
  first and re-labelling it, and removing the second, leaves this screen with **no control that
  moves the guest towards payment** unless the new tip button carries that route. That is what
  makes "add tip button" load-bearing rather than decorative, and it is the one thing the gate
  must confirm before anything is built.
- The responsive half has a concrete cause, not a vague one: row 2 is
  `<div className="flex items-center gap-2">` with a `flex-1` secondary button and a ghost
  button that is **not** width-constrained — a long label pushes the row past the viewport. That
  pressure disappears with the third button, but the two-button row still needs a wrap rule
  rather than a fixed split (framework precedent: JP-22, four hand-rolled non-wrapping rows).

## OPEN QUESTIONS — HOW THEY WERE ANSWERED (auto mode; say the word and either flips)
1. **Does the tip button lead to payment?** → **Yes.** It runs the identical `go('tip')` both
   removed buttons ran. Chosen rather than asked because the alternative — a tip control that
   sets an amount without leaving the screen — would leave "One last thing?" with no route to
   payment at all, and Standard 1.6 does not allow a dead end with an open bill on it. The tip
   step still ends in "Pay ₹482" and its first chip is still "No tip", so a guest who wants to
   settle up without tipping is one tap further on than before and is never asked to tip.
2. **The two labels.** → `Continue ordering` exactly as the requester wrote it (the ＋ went with
   the old secondary weight; a full-width primary does not need a glyph to say it adds).
   The tip button reads **`Add a tip`**, borrowed from the tip screen's own shipped heading
   "Add a tip for {captain}?" rather than invented — the freeze rule's preference.
   **The one judgement worth a second opinion:** a guest who simply wants to pay now reads two
   buttons, neither of which says "pay". "Add a tip" is the route, and it is not obviously the
   route. It is one string; changing it is a one-line change.

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
