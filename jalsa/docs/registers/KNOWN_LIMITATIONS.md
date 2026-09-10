# Known Limitations — Jalsa

> Things the **platform or the environment** prevents, distinguished from things that are broken.
>
> Consulted at **design time** (do not design a flow on an unavailable capability) and at **test
> time** (a matching case is BLOCKED with its ID, never quietly skipped and never reported green).

---

## Two rules that keep this register trustworthy

**1. An entry requires evidence that something outside this codebase blocks it.**
No evidence, no entry. Without this rule the register fills with bugs misfiled as limitations,
and then the real entries stop being believed — which is worse than having no register.

**2. Nothing is hard-deleted.**
A resolved limitation moves to the resolved section, dated, with what resolved it. Old
screenshots, old support answers and old test cases still refer to it.

Newest first.

---

## Active

### KL-4 — The setup PIN is `1234` for every member of staff
**Since** 10-Sep-2026 · **Category** deliberate, temporary · **Review by** first live service

Every seeded account carries the PIN `1234`, marked `pin_provisional` in the database. Requested
for testing.

**Why it is not an unlocked till.** A provisional PIN opens exactly one screen — "choose your own
PIN" — and nothing else: not the floor, not the console, not a dismissible banner over either
(`src/app/staff/page.tsx`, `src/app/owner/page.tsx`). `set_own_pin` requires the current PIN, and
refuses `1234`, `0000`, `1111` and `4321` outright, so nobody can "change" their PIN back to the
one everybody knows.

**What must happen before real service.** Nothing in the code: the first person to sign in as each
account replaces the code and the account leaves this state permanently. What must NOT happen is
shipping a build where `pin_provisional` is ignored — that single line is the whole of this
mitigation. Rung: `set_own_pin` rejects the shared code (verified against the live database,
10-Sep-2026: `old_owner_pin_rejected: 0, bad_pin_rejected: 0`).

---

### KL-3 — WebKit is not installed on the build container, so `tablet` and `mobile-ios` do not run
**Since** 10-Sep-2026 · **Category** environment

`/opt/pw-browsers` supplies Chromium only. The two iOS-flavoured Playwright projects are backed by
WebKit; pointing WebKit at a Chromium binary produces a Chromium run wearing an iPhone's viewport,
which is worse than no run because the report then says `mobile-ios passed`.

**What we do instead.** `playwright.config.ts` drops those two projects when
`PLAYWRIGHT_CHROMIUM_PATH` is set, and writes `SKIPPED: tablet, mobile-ios … Safari-engine
coverage did NOT run` to stderr on every run. Geometry is still covered at four viewports
(`desktop`, `desktop-wide`, `mobile`, `mobile-short`), on Chromium.

**What is therefore unverified.** Safari-specific layout and input behaviour — `100dvh` under the
iOS toolbar, momentum scrolling inside the bottom sheets, and date/number input rendering. Run
`npx playwright install webkit` on a machine with egress and re-run without the override to close
this.

---

### KL-2 — Thermal printers are unvalidated, so every KOT is written and then marked failed
**Since** 10-Sep-2026 · **Category** unvalidated dependency

No printer has been connected to this build. All four seeded printers carry `online = false`, and
`queuePrint` persists the job first and then marks it `print_status = 'failed'` when no printer is
reachable, with a visible retry on the KOT.

**Why not hide it.** A kitchen ticket that silently did not print is the single most expensive
failure this application can have — the guest waits, the kitchen never knew, and nobody finds out
until the table asks. A visible red retry on every KOT is the honest state until a printer is
actually on the network, and it is what the staff surface is designed around.

---

### KL-1 — The database is unreachable from the build container, so the data journeys are BLOCKED, not passing
**Since** 10-Sep-2026 · **Category** environment · **Blocks** the largest part of the functional tier

The container's egress policy refuses `yxgxmbyilpivbmeemqkp.supabase.co`. This is a policy denial,
not a credential problem.

**Evidence** (`curl -sS "$HTTPS_PROXY/__agentproxy/status"`, 10-Sep-2026):

```
{ "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "yxgxmbyilpivbmeemqkp.supabase.co:443" }
```

The schema, the seed, the PIN policy and the bill/table/KOT constraints were all verified by
executing SQL against the live project through the Supabase MCP tools, which are not subject to
this policy. What could NOT be done is run the application's own server against it.

**What is therefore NOT EXECUTED** — every one of these is BLOCKED, and BLOCKED is never a pass:

| Journey | Where the case is written | Screens |
|---|---|---|
| Scan → order → kitchen → add more → request payment → tip → invoice | `tests/cases/reference/README.md` | 1–13 |
| Captain's floor, rounds, cancellations, joining tables | — | 14–21 |
| Owner console: live orders, closures, menu edit + archive, staff, audit | `tests/cases/reference/README.md` (CP-25, CP-26) | 23–29, 33 |

**What IS executed, and why it is not nothing.** 252 assertions across three tiers, including the
whole of the outage behaviour on a real second instance of the application
(`tests/functional/degraded.functional.spec.ts`), the complete sign-in journey, keyboard parity,
geometry at four viewports, and computed contrast in both themes. The pure rules the data journeys
turn on — money, bill status, the permission matrix, and which screen a poll may move a guest to —
are unit-tested against their real modules (56 cases).

**To close this.** Add `*.supabase.co` to the environment's network egress allowlist
(https://code.claude.com/docs/en/claude-code-on-the-web), or run the suite on a machine with
outbound access: `npm run dev` then `npx playwright test`.

## Resolved / expired

| ID | Resolved | Date | Notes |
|---|---|---|---|
| _none yet_ | | | |
