# Authentication, session, role and abuse scenarios — Jalsa

> 26-Oct-2026 · Part of the [audit](AUTH_PERFORMANCE_SECURITY_AUDIT.md). Every row says HOW it is verified, and
> rows that nothing executes say so. **BLOCKED is never a pass.**

**Legend — how a row is verified**
- **EXEC** — executed here: a unit spec running real code, or an HTTP request to a production build of the app.
- **PIN** — source-pinned: a spec asserts the line that carries the rule exists (the house idiom for server paths
  that need Postgres). Proves the rule is written, not that it behaves.
- **DB-RO** — read-only query on production.
- **BLOCKED** — needs a database the suite can write to. TEST (`uxmyomxtosjlkvjxnvpy`) is paused (OPS-02), and
  production is never an automated target.
- **N/A** — the feature does not exist in this application (see audit §1).

## 1. Sign-in and sign-out (staff PIN)

| # | Scenario | Expected | Verified by | Result |
|---|---|---|---|---|
| A1 | Correct PIN, active person | Session for that surface only | `session-surfaces.unit.spec.ts` (PIN) | PASS |
| A2 | Wrong PIN | 401, one message for every failure | HTTP to a production build: an unknown PIN reaches the DB call | PASS (EXEC, no DB → 500 here; path confirmed) |
| A3 | **Shared setup PIN `1234` / `4321` / `0000` / `1111`** | 401 "That PIN did not work", database never asked | `security-audit-26oct` SEC-01 (EXEC pure + PIN); HTTP: 401 before vs 500 on the unfixed build | **PASS — was FAIL (SEC-01)** |
| A4 | Non-4-digit input | 401 without a DB call | `auth.ts` regex (PIN) | PASS |
| A5 | 10 failed attempts in a minute | 429 | HTTP EXEC | PASS — **but global: locks out everyone on the instance (SEC-03, open)** |
| A6 | Deactivated / removed person with a live cookie | Next request refused | `currentStaff` re-reads `active`, `removed_at` (PIN) | PASS (PIN); live behaviour BLOCKED |
| A7 | Sign-out | Cookie for that surface deleted | `session-surfaces` (PIN) | PASS |
| A8 | Sign-out, then a copied cookie is replayed | Refused | — | **FAIL by design (SEC-10, open)**: valid until 14 h TTL |
| A9 | Expired cookie (> 14 h) | Refused | `decodeStaffSession` TTL check (PIN) | PASS (PIN) |
| A10 | Tampered cookie (payload or MAC) | Refused, constant-time compare | `sessions.ts` HMAC (PIN) | PASS (PIN) |
| A11 | Signing in on the owner console does not sign in the staff app | Separate cookies | `session-surfaces.unit.spec.ts` (EXEC + PIN) | PASS |
| A12 | Back button / direct URL after sign-out | Sign-in screen; API 401 | Pages render `PinSignIn` without a session (PIN) | PASS (PIN) |
| A13 | Database unreachable during sign-in | Designed error, no session | `outage.unit.spec.ts`, `degraded.functional.spec.ts` | PASS (existing) |
| A14 | Two people with the same self-chosen PIN | Refused or disambiguated | — | **FAIL (SEC-09, open)**: either may be signed in |

## 2. Issued PIN (rule 5) and PIN change

| # | Scenario | Expected | Verified by | Result |
|---|---|---|---|---|
| B1 | Provisional session opens a page | "Choose your own PIN" only | pages (PIN, existing) | PASS |
| B2 | Provisional session calls an action route | 403 PROVISIONAL_REFUSAL | `order-cancel` etc. (PIN, existing) | PASS |
| B3 | **Provisional session calls a read route** (state, report, QR, favourites, heard, bridge download) | 403 PROVISIONAL_REFUSAL | `security-audit-26oct` SEC-02 ratchet over every route | **PASS — was FAIL on 8 routes** |
| B4 | Choose own PIN with wrong current PIN | 400, unchanged | `set_own_pin` (PIN, existing) | PASS |
| B5 | Choose `1234`/`0000`/`1111`/`4321` as new PIN | Refused | `set_own_pin` SQL; SEC-01 parity rung | PASS |
| B6 | "Skip for now" | Opens the app for this session | — | Behaves as built; **contradicts rule 5 (SEC-08, open)** |
| B7 | Owner reissues a PIN mid-shift | Person back at the prompt on next request | `currentStaff` re-reads `pin_provisional` (PIN) | PASS (PIN); poll shows stale notice until reload (by design) |
| B8 | PIN change ends other sessions | Other sessions end | — | **FAIL by design (SEC-10)** |
| B9 | Issued PIN is unique and unpredictable | Redrawn if held; CSPRNG | `pin-and-attribution` (PIN); SEC-05 | **PASS — was Math.random** |

## 3. Roles and permissions (negative tests)

Roles in the database: Owner / Admin, Captain, Waiter, Cashier, Chef, Cleaning. Grants are per person
(`staff_permission`), presets in `src/lib/permissions.ts`. One restaurant: **tenant/branch rows are N/A.**

| # | Scenario | Expected | Verified by | Result |
|---|---|---|---|---|
| C1 | A person without the grant calls a mutation | 403 naming the grant | `demand()` in each mutation; `permissions.unit.spec.ts` (EXEC) | PASS |
| C2 | Owner console without `orders.view` | 403 | `owner/state` (PIN) | PASS |
| C3 | Reports without `rep.sales` / `rep.products` | 403 | report, heard, favourites routes (PIN) | PASS |
| C4 | Grant revoked mid-shift | Refused on next request | grants read per request (PIN) | PASS (PIN) |
| C5 | Client sends a role/grant in the body | Ignored | Grants come from DB only; no route reads them from a body (code review) | PASS (review) |
| C6 | Complete a table request / reply to a suggestion with no grant | 403 | — | **FAIL (SEC-13, open)**: allowed for any signed-in person |
| C7 | Staff edits ids in the body (another bill's id) | Single-restaurant: allowed if granted | One tenant; ids are scoped by `restaurant_id` | N/A (no second tenant) |
| C8 | Staff PIN on the owner surface without grants | Console 403; nothing else | `owner/state` grant check | PASS (PIN) |
| C9 | The browser key reads a table | Nothing | RLS on, no policy (advisor, DB-RO) | PASS |
| C10 | The browser key calls a privileged function | permission denied | ENVIRONMENTS.md, 03-Oct (DB-RO, live call) | PASS (existing) |

## 4. Guest surface

| # | Scenario | Expected | Verified by | Result |
|---|---|---|---|---|
| D1 | Guest action with no cookie | 401 "scan the code again" | every guest route (PIN) | PASS |
| D2 | Guest names another bill or session in the body | Impossible — no such field | routes read the cookie only (review) | PASS |
| D3 | Guest marks a bill paid | Impossible | `bill_closure_is_attributed` (DB) + no route | PASS (existing) |
| D4 | Remote person opens `/t/A5` and orders | Refused / confirmed | — | **Allowed by design (SEC-12, open)** |
| D5 | Many "Need water" taps | 429 after 6/min per session | `/api/guest/ask` (PIN) | PASS per instance (SEC-15) |
| D6 | Double tap on "Send to kitchen" | One round | client in-flight lock + cart cleared server-side (existing specs) | PASS (existing) |
| D7 | Guest phone after the bill closes | Receipt for the rescan window, then welcome | `guest-phase.unit.spec.ts` | PASS (existing) |
| D8 | Queue cookie on a shared phone | HttpOnly, Lax, **Secure** | SEC-06 | **PASS — was not Secure** |

## 5. Abuse and failure scenarios (prompt §6, mapped to what exists)

| Prompt scenario | Here | Result |
|---|---|---|
| Unauthenticated request to a private API | `/api/staff/*`, `/api/owner/*` → 401 | PASS (PIN) |
| User accesses another user's record | Single restaurant; guests have no record ids | N/A / PASS |
| User changes tenant/branch id | No tenants | N/A |
| Expired or revoked session | Expired: refused. Revoked (sign-out elsewhere): not possible | PARTIAL (SEC-10) |
| Simultaneous token refresh | No refresh tokens | N/A |
| Repeated OTP attempts | No OTP. PIN attempts: SEC-03 | PARTIAL |
| Network disconnect during sign-in | Designed outage screen | PASS (existing) |
| Database timeout | 2 s read deadline, designed screen, writes not retried | PASS (existing, fix 5) |
| Double-click on payment/submission | Close-bill and rounds guarded server-side | PASS (existing specs) |
| Duplicate webhook delivery | No webhooks. Bridge reports are idempotent on job id | PASS (existing bridge specs) |
| Large or malformed CSV | No CSV import | N/A |
| Unauthorised file upload | Grant-gated, size-capped, magic-byte sniffed | PASS (existing) |
| Logout with cached data present | SW never caches `/api/` or pages | PASS (review of `public/sw.js`) |
| Account suspended during a session | Next request refused | PASS (PIN) |
| Third-party unavailable | Printer bridge down → job stays queued, said on screen | PASS (existing) |
| Malicious input reaches a query | PostgREST parameterises; no SQL built from strings in app code | PASS (review) |
| Concurrent updates | Row locks in `move_bill_to_table`, `cancel_bill_and_free`; unique index on `bill_table` | PASS (existing db specs) |
| Rate limit exceeded | 429 with a sentence; **not monitored** (OPS-01) | PARTIAL |
| Schema mismatch on deploy | `isSchemaFault` → designed message; fallbacks for unapplied columns | PASS (existing) |
| Background job retries | Stale-claim sweep marks `failed`, never `printed` | PASS (existing) |
| **Report larger than one API page** | Read whole | **PASS — was FAIL (PERF-02)** |

## 6. Not executed, and why

- Every live-database behaviour row above marked PIN: the TEST project is paused (OPS-02) and production is never
  a test target. Resuming TEST and running `npm run test:reset` then the functional tier would turn these into
  EXEC.
- WebKit (`tablet`, `mobile-ios`) does not run in this container (KL-3 — CI runs it).

---

## 7. Round 3 (27-Oct-2026) — the sign-in limit, cross-site writes, and a real database

New legend entries: **PGLITE** — executed in a real Postgres in-process (every migration in order); **RIG** —
executed against the performance rig (Postgres 16 + PostgREST 12.2.3 + the production build of the app). Rows above
stand as written; where this section changes one, it says so.

| Scenario | How | Result |
|---|---|---|
| Correct PIN / wrong PIN — answer, and what is recorded (no address) | PGLITE | PASS |
| A shift signing in at once from one wifi (12 correct PINs) | PGLITE | PASS — none refused |
| A correct PIN never spends the allowance (4 wrong, 6 right, 5th wrong still answered) | PGLITE | PASS |
| The restaurant's wifi (correct PIN tonight) gets 10 mistakes, not 5 | PGLITE | PASS |
| Recovery: failures older than the window stop counting | PGLITE | PASS |
| One network guessing: the 6th in 15 min throttled, with the wait | PGLITE | PASS |
| **Not an oracle**: over the limit, the right PIN gets the wrong PIN's answer | PGLITE · RIG | PASS |
| Hammering a throttled network does not extend its wait | PGLITE | PASS |
| A slow guesser (20 failures spread over 24 h) | PGLITE | PASS |
| Distributed guessing: 30 untrusted networks → the keypad closes to strangers, not to the trusted wifi | PGLITE | PASS |
| The owner console has its own budget (15) and the staff keypad is unaffected by it | PGLITE | PASS |
| Not-a-PIN input (empty, 2 or 6 digits, letters, SQL text) is a counted wrong PIN | PGLITE | PASS |
| An invalid surface or network key is an error, not a sign-in | PGLITE | PASS |
| Only service_role may call it; RLS on the attempts, no API-role grant | PGLITE | PASS |
| **Concurrent attempts**: 50 simultaneous wrong owner PINs from one address | RIG | PASS — exactly 5 judged and recorded, 45 throttled; other addresses signed in |
| The address never reaches the database; one IPv6 /64 is one network | EXEC (round rig) | PASS |
| A throttled answer is a 429 with `Retry-After` and a wait in words | EXEC (round rig) | PASS |
| Database without the migration: sign-in works on the old limit, logged | EXEC (round rig) · RIG | PASS |
| Old behaviour, for the record: the shared limit locked the restaurant's wifi out after 10 attempts from anyone | RIG | Reproduced (before) |
| Cross-site POST/PUT/PATCH/DELETE (`Origin` another site, `null`, or `Sec-Fetch-Site: cross-site`) | EXEC | PASS — 403 before the route runs |
| This site's own writes, reads, and header-less clients (the print bridge) | EXEC | PASS — not refused |
| Repeated OTP / PIN attempts (§5 row) | — | **Supersedes PARTIAL**: PASS once migration `20261027100000` is applied; until then the old limit |
| Credential stuffing | — | N/A as a username/password pair; the PIN-only equivalent is the distributed-guessing row |
| Account enumeration | PGLITE | PASS — refused, throttled and right-but-throttled answers name no account |
| The data journeys against a real database (KL-1 residual) | RIG | **128/128** on four projects, with and without the 27-Oct migrations; one real defect found and fixed on the way (JP-26) |

**Still not executed:** WebKit projects (KL-3 here); a real phone; production (never an automated target).
