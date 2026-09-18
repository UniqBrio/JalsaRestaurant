# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: `Owner → Staff`
- CURRENT BEHAVIOUR: `One flat list of every staff member, grouped only by role ("CHEF · 5", "WAITER · 10"). Whether somebody can sign in is visible only as a pill inside each row, so answering "who still needs the app?" means reading 26 rows.`
- DESIRED BEHAVIOUR:
  - `Two subtabs above the list: HAS ACCESS and NO ACCESS, defaulting to HAS ACCESS.`
  - `Each tab splits into AVAILABLE TODAY and UNAVAILABLE TODAY, in that order.`
  - `Role grouping is preserved INSIDE each availability section — the list is never flattened.`
  - `Each tab carries a count derived from the real staff data, never hardcoded.`
  - `Switching tabs filters only. It must not mutate anything.`
  - `Empty states on both tabs — e.g. "Everyone has app access." — never a blank page.`
- WHY: `To answer, at a glance, who has application access and who still needs it — while keeping today's availability visible, because a person who is out today has not lost their access.`
- MUST NOT CHANGE:
  - `Module access — reading, saving, granting, revoking, persistence, authorization. Explicitly named by the requester as the thing that must not regress.`
  - `Give them the app · Paperwork · Edit · Remove — all keep their underlying behaviour.`
  - `The staff row design, beyond any very small adjustment the new organisation genuinely needs.`
  - `The existing Jalsa design language: typography, spacing, rounded surfaces, pills, buttons, active-tab treatment, colours, borders, hover/focus.`
  - `Everything not named in DESIRED BEHAVIOUR — and explicitly: Indoor Queue, Tables & QR, Restaurant Details, logo upload, Menu, Uplift, Payments, WhatsApp, staff ordering, unrelated responsive work, unrelated permission architecture. No framework-sync files.`
- CORRECTION ROUND: `1`

## THE TWO STATES, AND WHY THEY MUST NOT BE CONFLATED
The requester is emphatic, and gives the four combinations: has access + in, has access + out,
no access + in, no access + out. A person with access who is out today **stays under HAS ACCESS**,
in its lower section. Unavailable staff are never hidden merely for being out.

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `Owner → Staff only. States: both tabs' empty states are new. Loading, error, offline and permission-denied are unaffected — this is a client-side filter over a payload the screen already holds.`
- STRINGS ADDED OR ALTERED:
  - `"Has access"` / `"No access"` (the two tabs, with counts — requester's words)
  - `"Available today"` / `"Unavailable today"` (the two sections — requester's words)
  - `"Everyone has app access."` (offered as "a clear empty state such as", i.e. a suggestion)
  - Everything already on the screen is frozen — including the row's own `"Can sign in"` / `"No PIN yet"` pill and the `"In today"` / `"Out today"` button.
- PERMISSIONS: `no. This is a filter over data the screen already receives; every action keeps the grant that gates it today (staff.perms, staff.pin, staff.paperwork, staff.create).`
- USAGE: `The owner, when provisioning people — "who still needs the app?" is the question the NO ACCESS tab exists to answer in one tap. Availability is read daily; access is read when somebody joins or a phone changes hands.`
- RUN MODE: `auto`
- SCALE: `scoped`

## B1 — WHAT THE CODE ALREADY DEFINES (read before any change, as the requester required)

The requester asked that the existing source of truth be found rather than a new one invented,
and specifically warned against inferring access from role, or from the PIN **unless the
application explicitly defines the PIN as the access criterion**. It does:

| Question | The existing field | How the app itself words it |
|---|---|---|
| **Has access?** | `StaffMember.hasPin`, from `queries.ts:576` — `hasPin: !!s.pin_hash` | The row's pill reads **"Can sign in"** / **"No PIN yet"**, and the action reads **"Give them the app"** / **"Reissue PIN"** (`StaffSection.tsx:116,166`) |
| **Available today?** | `StaffMember.onDuty`, from `queries.ts:575` — `onDuty: s.on_duty` | The row's toggle reads **"In today"** / **"Out today"** (`StaffSection.tsx:135`) |
| **Role grouping** | `byRole`, a `Map<string, StaffMember[]>` built from `data.staff`, rendered as `{role} · {members.length}` | unchanged |

So "application access" is **not** being inferred — the application already names having a PIN
"can sign in" and names issuing one "give them the app". That is the explicit definition the
requester's own condition asks for.

**`staff_permission` is deliberately NOT the criterion.** The app calls that **Module** access —
what a person may do once inside — and names it differently on the very same row. Using it here
would answer a different question from the one the tabs ask, and would put every seeded chef
under HAS ACCESS while the screen says "No PIN yet" beside their name.

**Consequence worth stating up front:** in production 10 of 26 staff have a PIN, so HAS ACCESS
will show 10 and NO ACCESS 16 — and every chef in the screenshot lands under NO ACCESS, which
is exactly what "No PIN yet" on each of their rows already says.

**No schema change.** Both fields are already on the payload this screen receives.

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
