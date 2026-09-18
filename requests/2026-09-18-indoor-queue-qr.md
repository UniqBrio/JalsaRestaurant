# NEW FEATURE REQUEST
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - the Gate 1 questionnaire covers it. -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- FEATURE NAME: `Indoor Queue QR + waitlist management`
- ONE-LINE GOAL: `A party scans one code at the entrance, joins the queue, watches their place update, is welcomed to a real table, and walks into the ordinary ordering journey — while the owner or an authorised captain opens and closes that queue at will.`
- WHO USES IT: `the waiting GUEST at the entrance; the OWNER; a CAPTAIN the owner has granted queue permissions to. The existing table/bill/session lifecycle is the downstream consumer.`
- MUST-HAVE in v1:
  - `A dedicated Indoor Queue QR, distinct from the table QRs, carrying the queue entry point ONLY — no bill id, session id, token, phone or party information.`
  - `Owner/captain can OPEN or CLOSE the queue at any time. Closed refuses NEW parties and never cancels existing ones.`
  - `Settings → Tables & QR gains an "Indoor Queue QR" section: status, open/close action, the QR itself, and how to display it at the entrance.`
  - `Captain access through the EXISTING module-access/permission system — never hardcoded names or ids. Owner/Admin always retains access.`
  - `An operator "Waiting outside" view answering: how many PARTIES, how many PEOPLE, who is next, who can be welcomed, which table. "3 requests · 10 guests" — not just "10 waiting".`
  - `Each queue row shows token, party size, position, wait, state, assigned table when ready, and its actions.`
  - `Customer states: JOIN (party size 1,2,3,4,5,6,8,10+) → token → WAITING with live position → READY/WELCOMED with the assigned table → Start ordering into the EXISTING flow. Plus QUEUE CLOSED as an independent state.`
  - `The waiting screen updates without a manual refresh, using the application's existing live-data architecture — no arbitrary sleeps, retry loops, aggressive polling or timers.`
  - `Welcoming uses the EXISTING table assignment logic: no inactive table, no occupied table, no duplicate assignment, no duplicate bill or session.`
  - `Audit the operational actions where comparable staff actions are already audited.`
- EXPLICITLY OUT of v1:
  - `A second waitlist table, token system, table-assignment system, permission system, guest-session system, ordering flow, or QR system. Extend what exists.`
  - `An invented inventory/stock model. If no capacity mechanism exists, surface the queue numbers and let the operator decide.`
  - `Playwright/E2E — not to be restored or introduced.`
  - `Every other workstream in the tree, named by the requester: Restaurant Details logo upload, searchable combobox, heard_about migration, menu image upload, menu promotions, Uplift, payment/bill detail, staff table ordering, and unrelated responsive cleanup. Guest-session/QR lifecycle work ONLY where this feature must safely integrate with it.`
- KNOWN CONSTRAINTS:
  - `Do NOT commit. Do NOT push. Leave all changes uncommitted for review.`
  - `Do NOT touch framework-sync files.`
  - `Do not write automated test data to production; use the sanctioned non-production environment, and report clearly if credentials are unavailable rather than pointing tests at production.`
  - `Do not weaken the security model to make tests pass.`
  - `A customer must NEVER see another customer's token, party size, queue information, table assignment, bill, order or session.`
  - `Do not regress the recent guest-session correction (a session must not be re-pointed to another party's bill/table state).`
  - `The QR does not change when the queue opens or closes.`
- MARKET / REGION: `Hosur, Tamil Nadu (from the application; not restated)`
- RUN MODE: `auto`

## USAGE PROFILE
- PRIMARY OBJECTIVE: `Guest: hold a place in line from my own phone and know when to walk in. Operator: see what is waiting and decide whether to keep taking parties.`
- PRIMARY WORKFLOW: `Scan at the door → pick how many → join → watch position → get welcomed → start ordering.`
- FREQUENCY OF USE: `Guest: once per visit. Operator: continuously through a busy service — the requester frames open/close as the operational decision of the evening.`
- OPERATING ENVIRONMENT: `the guest's own phone, standing at an entrance; the operator on the console or a captain's handset. Stated widths: 320/360/375/390/430/768/834/1024+.`
- ESSENTIAL INFO (visible immediately): `Guest: token, position, approximate wait, party size, and — when welcomed — the table. Operator: queue status, number of requests, total guests, who is next, the welcome action.`
- OPTIONAL INFO (progressively disclosed): `opening hours on the closed screen; the menu while waiting.`
- FREQUENT ACTIONS (immediate access): `Guest: join, leave. Operator: welcome the next party; open/close the queue.`
- OCCASIONAL ACTIONS (secondary access): `add a walk-in; mark a no-show; remove a party.`
- AUTOMATE (no interaction wanted): `token allocation, position, the wait estimate, and the live refresh.`
- MUST STAY MANUAL: `opening and closing the queue, and welcoming a party — both stated as operator decisions.`

## DESIGN SURFACE
- SCREENS / ENTRY POINTS: `Guest → the entrance code (four states: join / in queue / table ready / queue closed). Owner → Settings → Tables & QR (Indoor Queue QR section). Owner and authorised Captain → the "Waiting outside" queue view.`
- STATES REQUESTER CARES ABOUT: `all four customer states, drawn in the reference and to be treated as the interaction model, not as visual inspiration; plus: waiting party survives a close; waiting party survives a reopen; unauthorised captain refused.`
- VISIBLE STRINGS STATED:
  - `"We have stopped taking the queue"`
  - `"We're sorry — we're unable to take any more queue requests right now. We'd love to welcome you another time."` (offered as "an honest explanation such as", i.e. a suggestion)
  - `"Your table is ready"` · `"Start ordering"` · `"Waiting outside"` · `"3 requests · 10 guests"` · `"Welcome"` (or "the existing equivalent terminology if the codebase already has a better established term")
  - `"See the menu"` · `"Call the restaurant"` — both qualified as "where appropriate" / "if that capability already exists"

## PHASE 1 — INVENTORY (read before any code was changed, as the requester required)

### What ALREADY EXISTS and will be reused, not rebuilt

| # | Thing | Where | Verdict |
|---|---|---|---|
| 1 | `waitlist_entry` table — token, code, party_size, `source` ('scanned'\|'walk_in'), joined_at, notified_at, seated_at, removed_at, seated_table_id, actor_label, and a `one_ending` constraint | `20260916090000_jalsa_waitlist.sql` | **Reuse. No new table.** |
| 2 | Token from the SHARED `number_series` (`kind='waitlist'`, prefix `W`) | same migration | **Reuse. No second token system.** |
| 3 | Entrance page and component, already rendering FOUR states: join · in queue · table ready · queue closed | `src/app/q/page.tsx`, `src/features/guest/GuestQueue.tsx` | **Reuse.** |
| 4 | Guest queue API — GET own row, POST join/leave | `src/app/api/guest/queue/route.ts` | **Reuse.** |
| 5 | Isolation already correct: the row's id is an **http-only cookie**, never in the URL; the route reads exactly one row and authorises only read+leave | same file | **Already satisfies the isolation requirement.** |
| 6 | `readQueueEntry` — computes `ahead`, `position`, `estimateMinutes`, `state`, `tableName` | `src/lib/db/queries.ts:881` | **Reuse.** |
| 7 | **Six granular queue permissions already exist**: `queue.view`, `queue.walkin`, `queue.notify`, `queue.seat`, `queue.close`, `queue.clear` | `src/lib/permissions.ts:49-54` | **Reuse exactly. The requester asked that the existing separation be followed rather than replaced — it exists and is finer-grained than the request assumed.** |
| 8 | Owner waitlist view with open/close toggle, walk-in, notify, seat, no-show, remove | `src/features/owner/sections/WaitlistSection.tsx` | **Reuse and extend.** |
| 9 | `settings.queue.open` | read in `src/app/q/page.tsx:59` | **Reuse.** |
| 10 | Audit already records joins and seatings | `mutations.ts` `guestJoinQueue`, seat path | **Reuse.** |
| 11 | `useLiveData` — the ONE polling idiom (stops when hidden, never blanks on failure) | `src/hooks/useLiveData.ts` | **Reuse.** |
| 12 | QR generator | `src/app/api/owner/qr/route.ts` | **Extend.** |
| 13 | Party sizes `[1,2,3,4,5,6,8,10]`, rendered `10+` | `GuestQueue.tsx:33` | **Already exactly the reference's set.** |
| 14 | An existing entry is rendered BEFORE the closed screen, so a waiting party keeps its token when the queue closes | `GuestQueue.tsx` order | **Requirement C already satisfied.** |

**So most of this request is already built.** The honest inventory is that four things are missing
or wrong, and they are the work:

### GAPS — what is missing or incorrect

**G1 — the closed queue is not actually closed (the real defect).**
`guestJoinQueue` (`mutations.ts:1407`) validates the party size and inserts. **It never reads
`settings.queue.open`.** Closure is enforced only by what `/q/page.tsx` chooses to render. A tab
opened before the queue closed, a direct POST, or a party tapping Join in the same second the
owner closes, all join a closed queue. The requester's requirement 2 — "Queue closed rejects a new
customer" — is **false at the server today**.

**G2 — there is no Indoor Queue QR.**
`/api/owner/qr` requires `?table=` and refuses without it; Settings → Tables & QR offers a QR per
table and nothing for the entrance. The owner cannot print the entrance code at all. The `/q`
route it would point at already exists.

**G3 — the operator view answers "how many parties" but buries "how many people", and shows no position.**
`WaitlistSection` renders parties as the tile value and people as its sub-note, and each row shows
token, party size and joined-time but **not its place in line**. The requester is explicit that
both numbers must read at a glance and that "#1 / #2 / #3" is part of the row.

**G4 — the guest queue screen invents its own polling.**
`GuestQueue.tsx` runs a bare `setInterval` and does not use `useLiveData` — so it polls while the
phone is in a pocket, and a failed poll can blank it. That is a second live-data idiom, which
`CLAUDE.md` calls a defect, and the requester asked that the existing architecture be used.

### Schema verdict
**No migration is required.** Every column this feature needs already exists. `queue.open` is a
settings row, and settings are `jsonb` — no DDL. Recorded here because the requester asked for the
answer before implementation rather than after.

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

## GATE 1 — ANSWERED BY THE REQUESTER (binding, 18-Sep-2026)

| # | Question | Answer |
|---|---|---|
| 1 | Most of this exists. Fix the four gaps, re-skin as well, or rebuild? | **Fix the four gaps only.** Everything in the inventory table is reused untouched. |
| 2 | The codebase separates queue permission into six, finer than the request assumed. Keep, extend to the captain's handset, or collapse to one `queue.manage`? | **Keep the six, grant-gated.** No new permission key and no new screen: an authorised captain sees the queue where the owner does, and each action is gated on its own grant, so a captain without `queue.close` simply has no open/close control. |
| 3 | The shipped queue-closed copy is more specific than the request's suggested sentence, and is frozen. | **Keep the shipped wording.** The request's heading — "We have stopped taking the queue" — is already the heading verbatim; only the body differs, and the shipped body says WHY and what to do next. |

### The four gaps, as the work

1. **G1** `guestJoinQueue` must read `settings.queue.open` and refuse a closed queue at the server.
2. **G2** An Indoor Queue QR in Settings → Tables & QR, pointing at `/q`, carrying nothing else.
3. **G3** The operator view must read "N requests · M guests" at a glance, with a position on each row.
4. **G4** The guest queue screen must use `useLiveData` rather than its own `setInterval`.

**No migration.** Confirmed in Phase 1: every column exists and `queue.open` is a settings row.
