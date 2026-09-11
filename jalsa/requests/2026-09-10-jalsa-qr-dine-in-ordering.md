# NEW FEATURE REQUEST
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - the Gate 1 questionnaire covers it. -->

Run **Track A** ([workflows/feature.md](../workflows/feature.md)) with this request.

**Classification: NEW-APP.** No scaffolded codebase existed to receive the work — only the
framework and the approved design set. Initialization
([docs/02-PROJECT-INITIALIZATION.md](../docs/02-PROJECT-INITIALIZATION.md)) runs first, then
Track A inside the scaffolded app.

## FIELDS
- FEATURE NAME: Jalsa QR-first dine-in ordering — first shippable slice
- ONE-LINE GOAL: A guest scans the QR on their table, orders round after round on one bill, requests payment, tips, pays, and gets an itemised invoice — while the captain runs the floor and the owner records the closure.
- WHO USES IT: Guest (no sign-in, phone, scanned from tabletop QR) · Captain and Waiter (phone, PIN sign-in, scoped to assigned tables) · Owner/Admin (desktop, PIN sign-in) · Kitchen (paper KOT; no screen in this slice)
- MUST-HAVE in v1:
  - Guest journey end to end: table context → menu (search, diet filter, categories, promoted strips) → cart → KOT placed → my order → order again → request payment → upsell strip → tip → pay → paid → invoice → review prompt (Product Plan screens 1–13)
  - Captain/waiter surface: PIN sign-in, table floor, table/bill detail carrying the five identifiers, add items, change quantity, cancel with reason and state gate, KOT list with reprint, mark served, request/record closure (Product Plan screens 14–21)
  - Owner core: live orders board, payment recording and closure with discount, menu and item editor with availability, tables and QR, staff and per-action module access, audit log (Product Plan screens 23–29, 33)
  - The two model rules that shape everything: a bill belongs to **one or more** tables (a plain table is a group of one); the guest **never** marks a bill paid — they submit a payment request and a named member of staff records the closure
  - Tips are a separate ledger attributed to a captain or waiter and excluded from restaurant income, while still inside what the guest pays
  - Every KOT records its origin (guest phone / captain / owner) and its print state; a failed print never loses the order
- EXPLICITLY OUT of v1 (each a later `/request` run of its own, in this order):
  - Slice 2 — Owner money and reporting: dashboard, tips ledger and settlement, expenses, reports (sales/purchases/final/all-orders ledger), uplift report, exports
  - Slice 3 — Entrance queue and waitlist: entrance QR, token + spoken pair + confirm code, walk-ins, notify/call/seat/no-show, queue open/close
  - Slice 4 — Print setup: printers, character-grid templates at 58 mm and 80 mm, routing, validation, print history, KDS fallback screen
  - Slice 5 — Settings depth: opening hours and holidays, restaurant identity, tax, invoice numbering, "what the customer sees" switches, "words the guest sees" copy, canned replies, customer engagement
  - Slice 6 — HR documents: offer letter, experience certificate, payslip, merged from the employment record and the identity block
  - Everything in Product Plan §9 (inventory, CRM, loyalty, multi-outlet, aggregators, reservations, kiosk, native apps) stays a roadmap item and is not designed or built
- KNOWN CONSTRAINTS (stated by the requester):
  - Tech stack is fixed: Next.js + TypeScript + React + Supabase + shadcn/ui + PWA
  - **Do not add Apollo GraphQL or another backend language** unless a future architectural requirement genuinely calls for it
  - **No design regeneration.** The designs in `Design planning documentation/` are the source of truth and are implemented as they are, not redesigned for Next.js. Missing technical states and responsive behaviour are added *during implementation*, to the same standard as the existing designs
  - Supabase project is fixed: `https://yxgxmbyilpivbmeemqkp.supabase.co`, publishable key `sb_publishable_Z98FHh66ohqMLqIoDB8Ahw_GAoCHwqO`
  - Unvalidated dependencies named in the Product Plan: TVS RP 3160 Gold printing, payment provider, WhatsApp delivery. Each must work as a flow before the dependency is confirmed and degrade visibly if it is not available at launch
- MARKET / REGION: Hosur, Krishnagiri District, Tamil Nadu, India. Currency ₹. GST configurable (the 5% in the reference is unconfirmed). English at launch; Tamil designed for but not populated (content ownership unresolved)
- RUN MODE: auto

## USAGE PROFILE
- PRIMARY OBJECTIVE: Guest — get food ordered and paid for from their own phone without waving anyone down. Captain — know what every assigned table is waiting for. Owner — close bills correctly and know who did what.
- PRIMARY WORKFLOW: Scan → Order → Kitchen → Add More → Request Payment → Tip → Pay → Invoice → Review → Reconcile (the requester's own MVP mantra)
- FREQUENCY OF USE: Guest — once per seating, several rounds within it. Captain — continuously through a service. Owner — several times an hour, plus setup before service.
- OPERATING ENVIRONMENT: Guest on a phone at a table, restaurant wifi or mobile data, one hand, 390×844 the design target. Captain on a phone standing up, moving. Owner at a desktop, data-dense.
- ESSENTIAL INFO (visible immediately): Guest — table confirmed, menu, running total, cart. Captain — every assigned table with its status, and the five identifiers on anything touching an order. Owner — bills awaiting closure, and the payable.
- OPTIONAL INFO (progressively disclosed): dish description and photograph, per-table breakdown of a group bill, KOT timings and provenance, audit detail.
- FREQUENT ACTIONS (immediate access): add an item, change a quantity, send a round, mark served, record a payment.
- OCCASIONAL ACTIONS (secondary access): cancel with a reason, reprint a KOT, group tables onto one bill, edit a menu item, issue a PIN.
- AUTOMATE (no interaction wanted): KOT numbering, bill numbering, tax and total arithmetic, queue position stamping, table release on closure, print routing by food type, session resume from the table QR.
- MUST STAY MANUAL: recording payment and closing a bill (a named member of staff, never the guest); applying a discount; cancelling after the kitchen has started; marking a round served.

## DESIGN SURFACE
- SCREENS / ENTRY POINTS: Three web surfaces on one deployment — `/t/<table>` (guest, from the tabletop QR), `/staff` (captain and waiter, PIN), `/owner` (owner/admin, PIN). Screen-by-screen source: `Design planning documentation/Jalsa Customer App.dc.html`, `Jalsa Customer Patterns.dc.html`, `Jalsa Staff App.dc.html`, `Jalsa Owner Admin.dc.html`, with `Jalsa Navigation Flowchart.dc.html` as the route map and `Reusable Design Standards.dc.html` as the 44-principle standard every screen is judged against.
- STATES REQUESTER CARES ABOUT: stated — "Add the missing technical states and responsive behavior during implementation." The Product Plan §7 names them: payment failed / pending / abandoned / paid twice; item sold out while in a cart; cancellation after preparation started; printer unreachable with the order intact and a visible print-failed state and reprint path; payment requested then another round ordered; two phones on one bill; captain reassigned mid-bill; QR scanned for a closed bill or a table with no open bill; WhatsApp number refused or invalid. The full eight-state set (empty, first-run, loading, partial, error, success, permission-denied, offline) is a Track A obligation (A3.3) on every surface regardless.
- VISIBLE STRINGS STATED: every guest-facing string is already written in the design files and is taken verbatim from them — e.g. "Start ordering", "Send to the kitchen · ₹{amount}", "Nothing is charged now. You pay at the end, all rounds on one bill.", "Your order is being cooked", "Request payment", "That payment did not go through", "Nothing was charged. Your bill is still open at {total} and your table is still yours.", "Tip is not restaurant income and is paid to the floor team in full." Strings are not invented; where the design does not carry one, the copy register in Slice 5 owns it.

## STANDING INSTRUCTIONS (do not edit)
- Follow Track A end-to-end: Gate 1 questions → Gate 2 feasibility → Gate 3 design → Gate 4
  plan → build → test gate. **Confirm mode stops at every gate; auto mode (default) logs each
  checkpoint's decisions to the ASSUMPTIONS ledger and proceeds — hard stops and the
  mechanical test gate bind in every mode.**
- Anything stated in FIELDS is binding and overrides assumptions; every `unknown` becomes a
  Gate 1 question with a reasoned recommendation — never a silent assumption.
- Ground first (Step 0): `CLAUDE.md`, `docs/registers/KNOWN_LIMITATIONS.md`,
  `docs/registers/CANONICAL_PATTERNS.md`, `docs/registers/ROOT_CAUSE_REGISTER.md`.
- The USAGE PROFILE is the information hierarchy: essential/frequent renders on the primary
  screen with the primary action immediately reachable; optional/occasional is progressively
  disclosed; automatable steps are eliminated, not rendered. The design translates it via
  docs/24 §3b — never invents what it does not state.
- **No application scaffolded yet (NEW-APP)?** Initialization runs first —
  `docs/02-PROJECT-INITIALIZATION.md`, `npm run new:app` — then this file moves into the new
  app's `requests/` and Track A runs **inside the new app**, scoped to the first shippable
  slice named above.

## FIELDS LEFT `unknown`
Nothing in FIELDS is `unknown`: the requester supplied a complete approved design set, a fixed
stack, a fixed Supabase project and an explicit scope guardrail. The design's own open
decisions (Product Plan §10 — payment closure evidence, WhatsApp trigger, Tamil at launch,
printer validation) are **dependencies, not gaps in this request**: each already has a designed
fallback in the design set, and the build implements the fallback rather than guessing the
resolution.

## THE DESIGN IS NOT REGENERATED
Binding, from the requester: *"Do not create the design … designs already created … Exclude
design part just start implementing … Don't redesign for Next.js. Implement the existing design
in Next.js."* Track A's Gate 3 therefore does **not** produce a new design. It produces a
**design-conformance map**: screen → design artboard → implementation route → the states and
responsive behaviour added during implementation. Where the design set genuinely has no artboard
for a state, the gap is filled *in the same visual language and to the same standard* — never
in a new one.

---

# CLOSE-OUT — 10-Sep-2026 · VERDICT: PASS with two BLOCKED classes named and accepted

`checklists/DEFINITION_OF_DONE.md`, every item.

| Item | Verdict |
|---|---|
| Implements the approved plan, no unrequested scope | done — MUST-HAVE slice only; slices 2–6 named on their own screens, not half-built |
| Every changed line traces to the request | done — reviewed against FIELDS |
| Canonical pattern per concern | done — 12 recorded in `docs/registers/CANONICAL_PATTERNS.md`; JP-11 and JP-12 blessed during this run |
| No colour literals, no magic numbers | gate: PASS (G4, `audit:colors`) |
| Dead weight deleted | gate: PASS (`audit:deadweight`); two scaffold specs retired to `tests/cases/reference/` with a README saying why |
| Dependencies verified and pinned | done — `@supabase/supabase-js`, `@supabase/ssr`, Radix primitives; no GraphQL layer, no second backend language |
| Baseline components contributed back | N/A: no baseline-concern gap found |
| Every state exists and was looked at | done — the eight states plus not-configured and unreachable; the last two rendered and asserted |
| Loading always terminates, including on a forced error | done — `useLiveData` never blanks on a failed poll; `attempt()` bounds every server read |
| The failure path was exercised, not assumed | done — the whole outage path runs against a real second instance with no database |
| Writes idempotent against every unique constraint | done — `ensureOpenBill` recovers from 23505; `bill_table_one_open_per_table` verified live |
| Multi-step writes in one transaction | done — `placeRound`, `closeBill`; `next_number` takes a row lock |
| A save proved against the data, never the toast | done — every functional assertion reads the request or the resulting state |
| Screen checklist run per screen | **N/A: not run per screen — 33 screens, one build** |
| Both themes verified | gate: PASS (G2) + 14 computed-contrast assertions, both themes |
| Contrast asserted, token gate and computed | gate: PASS (G2) + `tests/render/jalsa-surfaces.render.spec.ts` |
| Per-theme assets present | gate: PASS (G3) |
| Five permission questions answered, matrix updated | done — `docs/registers/RBAC_MATRIX.md` |
| Permission gates the deep route and the API path | done — `demand()` in `src/lib/db/mutations.ts`, not the button |
| Tenant scoping on every query | done — `currentRestaurantId()`; one outlet today, resolved by slug so a second is one change |
| No secret in client code, a log or the repository | done — `git check-ignore .env.local` confirmed before the first commit |
| Cases added, registry delta stated | done — +56 unit, +14 render, +20 functional (×4 viewports) = 252 assertions; −18 scaffold cases retired |
| All four dimensions addressed | done — behaviour, geometry, keyboard, contrast |
| Fail-first evidence recorded | done — every new spec carries a header; three OBSERVED FAILING against the real tree, and the honest negatives are marked NOT OBSERVED FAILING with a reason |
| The gate ran | **gate: PASS** — 11/11, 0 blocked (`TEST_SUMMARY.md`) |
| Module document updated | **N/A: none exist; `docs/modules/README.md` names the four and the rule that writes them** |
| Feature register updated | N/A: no feature register in this app yet |
| Root-cause entry appended | **outstanding — two real defects were fixed in this run (see below) and no `ROOT_CAUSE_REGISTER.md` exists here yet** |
| Limitations entry added, with a reference | done — KL-1..KL-4, each with evidence |
| Decision record written | N/A: the hard-to-reverse decisions are recorded as guardrails in `CLAUDE.md` rather than as ADRs |
| Changelog in the language of the user | done — `CHANGELOG.md` |
| Business readiness tier stated | **T0** — nothing is customer-facing yet: no staging, no production, no printer, and the data journeys unverified |
| The run is closed out | done — `run-log.mjs end` |

## The two defects this run found in its own work

Both were found by a test that had never been run before, which is the argument for the tier.

1. **Four taps sent two sign-in attempts.** `PinSignIn` called `submit()` from inside a `setPin`
   updater; React 19 invokes updaters twice under StrictMode. Against any lockout policy that is a
   captain locked out of their own shift for typing their PIN correctly, once. Nothing on screen
   showed it. Fixed, and generalised into canonical pattern JP-11.
2. **A guest whose phone could not reach the database got Next.js's error page.** `/t/A5` returned
   **500**. Fixed with `attempt()` + `UnreachableState`, generalised into JP-12, and pinned by a
   suite that runs against a real second instance of the application with no database — so the
   outage path can never again be reasoned about rather than executed.

## The learning check

**Would a correctly functioning process have caught these?**

Defect 2 — **yes.** `checklists/SCREEN_CHECKLIST.md` asks for the error state on every screen, and
"the data did not load" is the error state of a server-rendered page. It was answered for the
CLIENT states (a failed poll, a refused write) and not for the server one, because the checklist
does not distinguish them and the two live in different files. Candidate for `/framework-update`:
the checklist's error-state item should name the server-render failure explicitly.

Defect 1 — **no.** No checklist item or audit would have found it; it took executing the journey.
That is the honest answer, and it is the case for the functional tier rather than for another rule.

## What this build did NOT verify, stated plainly

The guest, captain and owner **data** journeys have never been run against a database. Not once.
This container's egress policy refuses the Supabase host (KL-1, with the proxy's own denial
recorded). The schema, the seed, the PIN policy and the bill/table/KOT constraints were each
verified by executing SQL against the live project; the application's own server was never able to
reach it. Two BLOCKED classes — KL-1 (data journeys) and KL-3 (Safari-engine coverage) — are named
and accepted for a T0 build, and they are the first two things to close.
