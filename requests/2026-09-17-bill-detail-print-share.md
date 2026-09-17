# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is a Gate 1 question, never a blank to fill. -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: a bill can be opened from a list and read in full. Stated twice, for two
  entry points:
  - `In "Closed today" section, on click of the bill number, the whole order details including
    GST should be shown up. In next screen, add "Print" and "Share to whatsapp" button.`
  - `Even in this screen [Reports], on click of the bill number or invoice number, the whole
    order details including GST should be shown up. In next screen, add "Print" and "Share to
    whatsapp" button.`
- WHERE IT LIVES: Owner → **Payments → Closed today** (the BILL column of that table), and
  Owner → **Reports** (bill number or invoice number). One screen, two entry points — the
  requester described the same destination both times.
- MUST-HAVE (requester to trim at Gate 1):
  - the bill number in both lists is clickable
  - the screen it opens shows **the whole order details including GST**
  - that screen carries a **Print** button and a **Share to whatsapp** button
- EXPLICITLY OUT: nothing stated.
- WHO USES IT: the owner. Whether staff get it too is `unknown`.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: a new bill-detail screen, plus the two lists that link into it.
  States `unknown` and needed: a bill whose rounds were all cancelled, a group bill over several
  tables, and what Print and Share do while they are working or when they fail.
- STRINGS ADDED OR ALTERED: `Print` and `Share to whatsapp`, the requester's exact words.
  Everything on the detail screen itself is `unknown`.
- PERMISSIONS: `unknown`. It matters: this screen shows a full bill with tax, and `bill.tax_view`
  is already a confidential grant in `permissions.ts`. Who may open it, and who may share it
  outward, are two separate questions.
- USAGE PROFILE: `unknown`.
- RUN MODE: auto
- SCALE: unknown — **not micro**.

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
- **The content already exists twice over and is not reachable from a list.** `OwnerBillView`
  carries `kots[].items[]`, `totals`, `taxRate`, `tip` and `perTable`; the Record payment dialog
  now renders the dish lines from it (17-Sep-2026). And the guest already has a finished bill
  screen of their own — `InvoiceScreen` in `GuestClosure.tsx`. So "the whole order details
  including GST" is a display problem, not a data problem.
- **Print is not new either.** Jalsa has a whole print stack: `printer`, `print_job`, a
  character-grid template engine, and a five-section Print Setup surface. Whether "Print" here
  means the browser's print dialog or a thermal ticket through that stack is **the first
  question** — they are entirely different pieces of work.
- **"Share to whatsapp" is the one genuinely new thing**, and it is the one with a rule attached.
  The safety floor in this repository includes **outbound-send deny-by-default**. Sending a
  customer's itemised bill to WhatsApp is an outbound send of restaurant data to a third party,
  and it needs an explicit decision, not an implementation.

## OPEN QUESTIONS FOR GATE 1 (not decided at intake)
1. **What is "Print"** — the browser's print dialog over a styled page, or a ticket through the
   existing printer stack?
2. **What is "Share to whatsapp"** — a `wa.me` deep link the owner sends from their own phone
   (no server, no integration, no stored number), or the WhatsApp Business API (an account,
   credentials, templates, and an outbound-send policy decision)? These are hours apart.
3. **Does it send a link or the bill itself?** A link to a bill is a URL anyone holding it can
   open; the guest's own invoice screen is already PIN-scoped to their table.
4. **Is it one screen or two?** The requester says "next screen" both times, which reads as a
   full screen rather than a dialog — but the Record payment dialog is a dialog, and consistency
   between them is a design decision.
5. **Permissions**, per the DESIGN SURFACE note above.

## STANDING INSTRUCTIONS (do not edit)
- Track A order is binding: Gate 1 questionnaire (every `unknown` above is a question) → design
  → plan → build → test gate. Nothing is built before Gate 1 is answered.
- The five permission questions are answered in the plan, before build.
- **Outbound send is deny-by-default and is part of the safety floor.** Any WhatsApp path is
  approved explicitly or it is not built.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
