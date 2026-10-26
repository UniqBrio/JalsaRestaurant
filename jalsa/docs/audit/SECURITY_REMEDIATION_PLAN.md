# Security remediation plan — Jalsa

> 26-Oct-2026 · Part of the [audit](AUTH_PERFORMANCE_SECURITY_AUDIT.md). Ordered by what to do first.

## Do now — operational, no deploy needed (owner, 5 minutes)

1. **Issue a PIN to each of the four accounts still on the shared `1234`** (1 Cashier, 3 Waiters): Staff →
   the person → Generate PIN. This closes SEC-01 in production **today**, before any code is deployed, and is
   also what those four will need after the deploy. Nothing else about the accounts changes.
2. Then, once, check nobody is left on it. The read-only count used for this audit is in
   VERIFICATION_REPORT.md §3; it should return no rows.

## Ready to merge — implemented on `claude/awesome-cannon-pkg2qg`

| ID | Change | Risk | Rollback |
|---|---|---|---|
| SEC-01 | Refuse the shared setup codes at sign-in | The 4 accounts above cannot sign in until issued a PIN (step 1 removes this) | Revert the commit |
| SEC-02 | Rule 5 on the 8 read routes, plus a ratchet over every route | A reissued person's open screen goes stale until reload (same as an expired session) | Revert |
| SEC-07 | Next 16.4.2, zod 4.6.7, sharp 0.35.5, source-map-js 1.2.2, brace-expansion | Framework minor upgrade. Build, typecheck, lint, 1631 unit specs pass; the functional tier is **not** green (pre-existing G8 failure, see VERIFICATION_REPORT.md) — **watch the preview** | Revert the dependency commit (lockfile restores 16.3.4) |
| PERF-02 | Page four report/ledger reads | One extra request per 1,000 rows, only beyond 1,000 | Revert |
| SEC-04 | Anti-framing, nosniff, referrer policy on every response | Any future need to embed a Jalsa page in a frame is refused | Remove the header rule |
| SEC-05/06 | CSPRNG for issued PINs; `Secure` queue cookie | None found | Revert |

No migration, no production data change, no environment variable change. Deploying is the approval point.

## Needs your decision — designs that change behaviour

| ID | Problem | Options (recommendation first) | Needs |
|---|---|---|---|
| **SEC-03** PIN throttle | Global, per instance: one stranger can lock all staff out; the brute-force ceiling grows with instances | **(a)** A `sign_in_attempt` table: per-address and per-device limits (e.g. 5/min), a global ceiling, alert on breach; never lock a *person* out. **(b)** Vercel WAF rate limit on `/api/staff/session`. **(c)** Longer PINs (6 digits) — 100× the search space, a habit change for staff | (a) a migration + policy numbers; (b) a Vercel plan feature |
| **SEC-09** PIN collisions | A chosen PIN may equal someone else's; sign-in picks either | **(a)** Pick your name, then the PIN (one bcrypt; also fixes PERF-01; reveals the staff list to whoever holds the device). **(b)** `verify_staff_pin` returns all matches and sign-in refuses an ambiguous one; the owner reissues. Interim, no UX change, fails closed. **(c)** `set_own_pin` refuses a taken PIN — rejected: it tells the chooser someone else's PIN | (a) UX change; (b) a migration |
| **SEC-08** Skip for now | Rule 5 says the issued PIN opens one screen; Skip opens the app | **(a)** Remove Skip now the app is live. **(b)** Keep it behind an explicit `ALLOW_PIN_SKIP=true`, off by default, for test environments only | Your call — Skip was your request on 19-Sep |
| **SEC-10** Revocation | Sign-out / PIN change do not end a copied session | `staff.session_version`, carried in the cookie, compared in `currentStaff` (already reads the row: no new round trip). Bump it on PIN change and on "sign out everywhere" | A migration; a button on Staff |
| **SEC-12** Remote ordering | Anyone with `/t/A5` reads the bill and orders | **(a)** A random token per stand in the QR (`/t/A5?k=…`), checked server-side; reprint the stands. **(b)** A remote first round waits for a captain's tap. **(c)** Accept: staff see every round | (a) reprinting 20 stands; (b) a floor workflow |
| **SEC-13** Ungranted actions | Any signed-in person may complete a request or reply to a suggestion | New keys `requests.complete` (in every floor preset) and `suggestions.reply` (Owner, Manager) | The five permission questions + RBAC_MATRIX rows |
| **PERF-01** Sign-in cost | 286 ms mean, grows with staff | Comes with SEC-09 (a) | — |

## Proposed, no decision needed beyond prioritising

| ID | Change | Effort |
|---|---|---|
| SEC-11 | Script CSP with per-request nonces (middleware → `Content-Security-Policy` with `'nonce-…' 'strict-dynamic'`), report-only first for a week | M |
| SEC-14 | Refuse a state-changing request whose `Origin` is not this site (in `handler()`), defence in depth behind SameSite=Lax | S |
| SEC-16 | `alter function … set search_path = public` for the 4 trigger functions — one migration | S |
| SEC-17 | Ratcheted dependency scan in CI: a committed baseline of known advisories; new ones block, fixed ones must be removed — the framework's ratchet shape, not a plain `npm audit` | M (framework change: version bump) |
| SEC-15 | Move guest request limits to the same durable table as SEC-03 (a) | S, after SEC-03 |
| PERF-03 | Ledgers: read unsettled tips plus the last 90 days; older on demand | S |
| OPS-01 | Monitoring — see below | M |
| OPS-02 | Resume the TEST project, apply 04-Oct and 07-Oct, run the functional tier against it; fix the G8 failure recorded 22-Oct | M |

## OPS-01 — monitoring to add

`src/lib/logger.ts` already has one swappable sink and structured records. Point it at a provider (Vercel Log
Drains, or Sentry), then alert on:

| Signal | Threshold (initial) | Owner | First response |
|---|---|---|---|
| `POST /api/staff/session` 401 + 429 | > 30 in 5 min | Owner | Check for a brute-force run; issue fresh PINs if any account was hit |
| Any 5xx on `/api/*` | > 1% of requests over 5 min | Developer | Logs by signature; the designed outage screen is already shown |
| Database unreachable (`attempt` failures) | > 3 in 1 min | Developer | Supabase status; the app shows the designed screen meanwhile |
| Print jobs `failed` | any during service | Owner | Printers screen → retry; check the PC |
| Sign-in by a person outside their usual surface | informational | Owner | Already in the audit log (`Signed in`) |

Never log: a PIN, a cookie value, a bridge token, a guest token. `logger.ts` states this; nothing found
breaking it (route errors log the URL, which carries no secret).

## Rollout and rollback for the branch

1. Owner does "Do now" step 1.
2. Merge after the gate; Vercel deploys from `main`.
3. Smoke on the preview first: sign in with a real PIN on both surfaces; `1234` is refused; owner console and
   reports load; a takeaway photo loads; response headers carry `X-Frame-Options: DENY`.
4. Rollback = revert the merge commit; no data or schema to undo.
