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

### KL-2 — There is no printer transport, so no ticket is ever delivered
**Since** 10-Sep-2026 · **Restated** 19-Sep-2026 (Phase 1) · **Category** unvalidated dependency

Nothing in this repository opens a socket, a USB handle or a print API. A round is routed,
assigned to a specific machine and written as a `print_job` with `status = 'queued'` — and there
it stays, because the thing that would deliver it does not exist. Phase 2 (`docs/modules/printing.md`)
is that thing.

**What changed on 19-Sep-2026.** This entry used to say every KOT was *"marked failed"*, and that
was true: `queuePrint` set the status from `printer.online`, so "printed" meant a boolean on
another table was true and "failed" meant it was not. Neither word was about paper. A job now
settles at `queued` — assigned, undelivered, and saying exactly that. `failed` is reserved for the
one failure this layer can actually see (no machine could be assigned at all) and for Phase 2's
reports; **`printed` is not written anywhere in this repository.**

**Why not hide it.** A kitchen ticket that silently did not print is the single most expensive
failure this application can have — the guest waits, the kitchen never knew, and nobody finds out
until the table asks. So every round names its machine and its station on all three surfaces and
carries a retry, and "Waiting to print" is on screen for as long as that is what is true. The one
thing the application must never do is claim a print it has no way of knowing about.

**The mitigation is executable, not prose.** `tests/unit/print-assignment.unit.spec.ts` fails if
any function in the print path becomes able to write `printed`, in any expression.

---

## Resolved / expired

| ID | Resolved | Date | Notes |
|---|---|---|---|
| KL-1 | `.github/workflows/e2e.yml`, run [34577750747](https://github.com/UniqBrio/JalsaRestaurant/actions/runs/34577750747) on `claude/close-kl1-kl3` @ `5e49d73` | 11-Sep-2026 | **304 passed, 0 skipped, 0 failed.** `tests/functional/reachability.functional.spec.ts` passed on all six functional projects — a read-only round trip (`restaurant` by slug, then `dining_table`) that only renders `guest-unknown-table` after a reachable, **seeded** database answered; `unreachable-guest` and `not-configured` both asserted absent, and zero unreachable/unseeded errors from the configured instance in the log. **Not closed on run 34575687627** — that run never touched the database (`supabase.co` appears nowhere in its log), and citing it would have been RC-009. **Residual, stated plainly:** the guest, captain and owner data journeys still have **no specs** (`tests/cases/reference/README.md`). That was never the platform's doing; it is the next test-writing task, and it is no longer blocked by anything. |
| KL-3 | `.github/workflows/e2e.yml`, run [34575687627](https://github.com/UniqBrio/JalsaRestaurant/actions/runs/34575687627) on `main` @ `6fdc6d2` | 11-Sep-2026 | **298 passed, 0 skipped**, on Chromium and WebKit. The log carries 20 `[tablet]` and 20 `[mobile-ios]` results and **zero** `SKIPPED:` lines, so the conditional drop did not fire; the job's own assertion step would have failed it if it had. What the build container cannot run, CI now runs on every dispatch. (Attempt 1 of the same run failed before attempt 2 went green; its log was not retrievable through the API and is not part of this evidence.) |

---

### KL-3 — WebKit is not installed on the build container, so `tablet` and `mobile-ios` do not run
**Since** 10-Sep-2026 · **CLOSED** 11-Sep-2026 · **Category** environment

> **Resolved.** Kept in full, below the table, because the build container it describes has not
> changed — only where the evidence comes from has.

`/opt/pw-browsers` supplies Chromium only. The two iOS-flavoured Playwright projects are backed by
WebKit; pointing WebKit at a Chromium binary produces a Chromium run wearing an iPhone's viewport,
which is worse than no run because the report then says `mobile-ios passed`.

**What we do instead.** `playwright.config.ts` drops those two projects when
`PLAYWRIGHT_CHROMIUM_PATH` is set, and writes `SKIPPED: tablet, mobile-ios … Safari-engine
coverage did NOT run` to stderr on every run. Geometry is still covered at four viewports
(`desktop`, `desktop-wide`, `mobile`, `mobile-short`), on Chromium.

**What is therefore unverified _here_.** Safari-specific layout and input behaviour — `100dvh`
under the iOS toolbar, momentum scrolling inside the bottom sheets, and date/number input
rendering.

**Closed in CI, 11-Sep-2026.** `.github/workflows/e2e.yml` installs both engines
(`npx playwright install --with-deps chromium webkit`), never sets `PLAYWRIGHT_CHROMIUM_PATH`, and
**fails the job** if the two WebKit projects are absent from `--list` — so the conditional drop
cannot quietly reappear there. This entry stays active because it still describes the build
container, where the suite is written; it is no longer a gap in what the repository verifies.

---

---

### KL-1 — The database is unreachable from the build container, so the data journeys are BLOCKED, not passing
**Since** 10-Sep-2026 · **CLOSED** 11-Sep-2026 · **Category** environment

> **Resolved as a limitation.** Kept in full because the build container it describes has not
> changed. What follows is the entry as written while it was open; the residual it leaves behind
> is a **coverage gap**, not a platform limit — see the Resolved row.

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
