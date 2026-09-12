# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Owner / cashier console → the **Record payment** dialog (header "Record payment · B-1041"), the two discount fields under "To pay": "Discount %" and "or flat ₹".
- CURRENT BEHAVIOUR: Two independent boxes. The second is labelled "or flat ₹", and the "or" is doing real work — they are alternatives, and typing in one leaves the other empty. The sentence under them ("Takes ₹166 off — the payable becomes about ₹1,493") is the only place the other half of the arithmetic appears.
- DESIRED BEHAVIOUR: 'Replace "or flat ₹" with "Discount in ₹". As soon as the percentage added, the money should be calculated and correct discounted amount shown up in "Discount in ₹" field. Similarly, when amount is added, % should be calculated and show it in "Discount %" field.'
- WHY: `unknown` — not stated. (The screenshot shows the gap it closes: 10% is typed, and what 10% actually comes to is in a sentence rather than in the box beside it.)
- MUST NOT CHANGE: everything not named in DESIRED BEHAVIOUR. The rest of the dialog — the totals block, "PAID BY", the Reference field, the explanation line, the Cancel / Record buttons and what pressing Record does — is untouched.
- CORRECTION ROUND: 1
- RUN MODE: auto
- SCALE: micro

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the Record payment dialog — empty, percentage-entered, amount-entered, and invalid-entry. Nothing else.
- STRINGS ADDED OR ALTERED: "or flat ₹" → "Discount in ₹" (the requester's exact words). Everything else in the dialog is frozen.
- PERMISSIONS: no — `bill.disc_pct` and `bill.disc_flat` keep their present meanings and their present holders.
- USAGE: once per discounted bill, at the till, with a guest waiting.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks (B4),
  touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## THE ONE THING THIS REQUEST CHANGES THAT IT DOES NOT MENTION
Today the two fields are **alternatives** — the label says "or" — and `money.ts` applies the
percentage first and then the flat amount, so filling both takes BOTH off. Mirroring them makes
them two views of one number, and two views of one number that are also cumulative would double
the discount the moment both boxes have something in them.

So: with mirroring, **one discount is sent, not two.** Whichever box was typed in is the one that
decides; the other shows what that comes to. This is the correct reading of "the money should be
calculated and shown up in Discount in ₹" — a calculated field is a readout, not a second input —
but it is a change to what pressing Record does in the both-boxes-filled case, and it is recorded
here rather than made quietly.

## NOT STATED BY THE REQUESTER
- Rounding. A percentage of a bill is rarely a whole number of rupees, and this application keeps
  money in integer rupees. The rupee field shows the rounded figure the bill will actually be
  discounted by, and the percentage derived from a typed rupee amount is shown to one decimal
  place — so a guest is never told 10% and charged 9.7%.
- Whether the percentage field should keep an exact value the cashier typed (10) when the rupee
  round-trip would produce 9.9: `unknown`. Read as — the box the cashier typed in is never
  rewritten under their fingers; only the other one is computed.
- Behaviour on clearing a box: not stated. Read as — clearing the typed box clears both, because
  a stale computed figure beside an empty field is the most misleading state either box can show.
