# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

> ROUTING NOTE. Arrived with `workflows/framework-update.md` attached. Route C of that runbook:
> a feature request, not a process failure, and nothing process-level is revealed. No framework
> change, no VERSION bump. It proceeds here as an ordinary CHANGE.

## FIELDS
- FEATURE / SCREEN: Guest phone → tip screen ("Add a tip for Imran?") — the tip option row and the bill summary beneath it.
- CURRENT BEHAVIOUR: Four one-tap options — No tip, + ₹10, + ₹20, + ₹30 — and no way to give any other amount. The chosen tip lands in the summary as "Tip for Imran" above "To pay".
- DESIRED BEHAVIOUR: "Display a compact row of five options: [ No tip ] [ + ₹10 ] [ + ₹20 ] [ + ₹30 ] [ Custom ]. Keep the existing preset amounts because they allow one-tap selection. Add 'Custom' as the final option." Tapping Custom expands it in place into a compact numeric input, auto-focused, mobile numeric keyboard, with an "Apply" action; after applying, that option reads "✓ ₹50" and behaves exactly like a preset; the bill total updates immediately; tapping the selected custom amount edits it again; picking No tip or a preset replaces it.
- WHY: "ONE-TAP for common tips. ONE-TAP + TYPE for any custom amount." — without cluttering the screen.
- MUST NOT CHANGE: stated by the requester, verbatim — "Keep the existing overall layout, Jalsa branding, bill summary and payment CTA. Improve only the tip-selection interaction." · "Do not redesign the entire screen." · "Keep the explanation that the tip is tracked separately from restaurant income." · "Preserve the existing visual hierarchy." **Explicitly forbidden:** a permanently displayed text input · extra preset buttons such as ₹40 / ₹50 / ₹100 · a full-screen navigation · an unnecessary modal · losing sight of the payment button once the keyboard is dismissed.
- CORRECTION ROUND: 1

## VALIDATION (stated)
Positive whole numbers only. No negatives, no letters, no invalid characters. Empty or invalid
shows a subtle inline message — not a toast, not a modal.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest tip screen — the five-option row, the expanded custom input state, the invalid-entry state, the applied state, and the busy state while the write settles. Nothing else on the screen moves.
- STRINGS ADDED OR ALTERED: "Custom", "Custom tip", "Apply", and the inline validation message. The requester gave the first three; the validation wording is `unknown` and drafted in the design's own voice. Every other string on the screen is frozen.
- PERMISSIONS: no
- USAGE: once per bill, at the end, one-handed, with a keyboard covering the lower half of the screen.
- RUN MODE: auto
- SCALE: scoped

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks
  (B4), touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## NOT STATED BY THE REQUESTER
- An upper bound on a custom tip: `unknown`, and **none is applied**. One was considered — a tip
  larger than the bill is usually a missing decimal point — and dropped for two reasons: the
  requester did not ask for it, and judging it needs the bill figure as a NUMBER on the phone,
  which this application deliberately does not have (CLAUDE.md: "the phone holds NO pricing
  logic"). A guest who mistypes taps the amount and corrects it.
- Whether a custom tip survives leaving and returning to the screen: `unknown`. It is stored on
  the bill like any other tip, so it does; the row simply shows it as the selected custom value.
