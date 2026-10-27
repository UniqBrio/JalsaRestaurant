# Authentication, performance and security audit — Jalsa

> 26-Oct-2026 · Request: [`requests/2026-10-26-auth-performance-security-audit.md`](../../requests/2026-10-26-auth-performance-security-audit.md)
> Companions: [scenario matrix](AUTH_SCENARIO_TEST_MATRIX.md) · [performance baseline](PERFORMANCE_BASELINE.md) ·
> [remediation plan](SECURITY_REMEDIATION_PLAN.md) · [changelog](IMPLEMENTATION_CHANGELOG.md) ·
> [verification](VERIFICATION_REPORT.md)

**Evidence rule used throughout.** *Confirmed* means reproduced, by running code here or by a read-only query
on production. *Potential* means the code path exists but was not exercised. *Hypothesis* means it is
inferred and not checked. Production (`yxgxmbyilpivbmeemqkp`) was **read only**: aggregate counts and
statistics, no names, no hashes, no writes.

---

## 1. What this application is, as the repository shows it

Assumptions were checked against the code, not taken from the prompt. Several features the prompt names
**do not exist here**, and no coverage is claimed for them:

| Prompt asks about | Present? | What exists instead |
|---|---|---|
| Registration, email/phone verification, OTP | **No** | Staff accounts are created by the owner (`upsertStaff`). Guests have no account. |
| Passwords, password reset, recovery links | **No** | A four-digit staff PIN, verified in Postgres (bcrypt). Recovery = the owner issues a new PIN (`issuePin`). |
| Third-party auth provider, JWT, refresh tokens | **No** | A self-signed HMAC cookie per surface (`src/lib/sessions.ts`). No refresh; a fixed 14-hour lifetime. |
| Multi-tenant / branches | **No** (one restaurant) | Every query is scoped by `restaurant_id` resolved from a fixed slug. Tenant isolation is out of scope until a second outlet exists. |
| Payments, payment webhooks | **No** | The guest *reports* a payment; staff record it. No provider is chosen (rule 2). |
| Email / SMS / WhatsApp | **No** | `ALLOW_OUTBOUND_MESSAGES` exists and is off; nothing sends. |
| React Native / Expo | **No** | A PWA (`public/sw.js`). |
| CSV import | **No** | Image upload only (menu photos, logo, takeaway photos). |
| Edge Functions, cron, background jobs | **No** (a `supabase/functions/_shared` stub only) | A Windows print bridge (separate process, bearer token) and a stale-claim sweep run inside the owner poll. |

### 1.1 Architecture map

```
 Guest phone ──/t/<table>──▶ middleware.ts (mints opaque jalsa_guest cookie, Edge)
      │                         │
      │  /api/guest/*  ◀────────┘   cookie → guest_session row (server resolves table, bill, cart)
      ▼
 Next.js route handlers (Vercel, syd1) ── db() with SUPABASE_SECRET_KEY ──▶ Supabase Postgres (Sydney)
      ▲                                     RLS ON, NO policies on all 31 tables → the browser key reads nothing
      │  /api/staff/*  cookie jalsa_staff_app ─┐
 Captain phone                                  ├─ HMAC-SHA256(SESSION_SECRET) {staffId,name,role,provisional,issuedAt}
 Owner console  /api/owner/* cookie jalsa_owner ┘   currentStaff(): re-reads staff row + grants EVERY request
      │
      └ mutations: demand(grants, key) inside each write (src/lib/db/mutations.ts, owner-mutations.ts)

 Print bridge (Windows PC) ── Bearer jbt_… ──▶ /api/bridge  (SHA-256 of token stored; list/claim/report only)
                           ── pairing code ──▶ /api/bridge/pair (8 chars, CSPRNG, 10 min, single use)
```

| Question | Answer, with the file that answers it |
|---|---|
| Where is authentication performed? | Staff: `signInWithPin` → `verify_staff_pin` (bcrypt in Postgres, service_role only) — `src/lib/db/auth.ts`. Session check: `currentStaff(surface)` on every staff/owner request. Guest: opaque cookie → `guest_session` row (`src/lib/db/guest.ts`). Bridge: `authenticateBridge` (`src/lib/bridge-auth.ts`). |
| Where is authorisation enforced? | `demand(grants, key)` inside each mutation; per-route `grants.can(...)` on read routes; rule 5 (`provisional`) at every staff/owner route door. Database: RLS with no policy + privileged functions executable by `service_role` only. |
| How do requests travel? | Browser → this app's route handlers → Supabase (PostgREST) with the secret key. The browser never speaks to Supabase (guardrail 3). |
| Where are sessions stored and refreshed? | HttpOnly, SameSite=Lax, Secure-in-production cookies. Staff 14 h fixed TTL, no refresh; guest 8 h. Grants and `active`/`removed_at`/`pin_provisional` are re-read from the database on every request, so revocation of a person or a grant is immediate. |
| What is expensive? | `verify_staff_pin` (bcrypt per PIN holder, 286 ms mean in production); report and ledger reads over whole history; the owner console poll (≈29 calls). See PERFORMANCE_BASELINE.md. |
| What is security-sensitive? | Sign-in, choose-your-own-PIN, `issuePin`, close-bill/discount, cancel, PIN/permission administration, the bridge token. |
| Shared across roles? | One staff session type with per-person grants; the owner console is open to any signed-in person holding `orders.view`, each section gated again on its own grant. |

### 1.2 What was already sound (checked, not assumed)

- **No secret has ever been committed.** Every `sb_secret_*` string in the tree and in git history is a
  labelled placeholder (`…_ci_reaches_no_database`, `…_should_not_be_here`). No `.env` with values is tracked.
- **No client file imports a server secret.** No `'use client'` module imports `serverConfig`,
  `supabase/server` or `sessions`; `serverConfig()` throws if called in a browser.
- **The publishable key reads nothing.** RLS is enabled with no policy on all 31 public tables (security
  advisor `rls_enabled_no_policy`, by design); `verify_staff_pin`, `set_own_pin`, `set_staff_pin`,
  `next_number`, `redirect_print_job`, `cancel_bill_and_free`, `move_bill_to_table` are executable by
  `service_role` only (verified 03/04/08-Oct, `docs/registers/ENVIRONMENTS.md`).
- **Session cookie integrity.** HMAC-SHA256 with a constant-time compare; length checked first; TTL enforced
  server-side from `issuedAt`.
- **Deactivation is immediate.** `currentStaff` re-reads `active`, `removed_at`, `pin_provisional` and the grants
  on every request.
- **No user enumeration at the keypad.** One message for every failed PIN.
- **Guest isolation by cookie.** No guest route takes a bill, session or table id from the body; the session is
  resolved from the HttpOnly cookie.
- **The bridge credential.** Only its SHA-256 is stored; revocation is a timestamp; pairing codes are 8 chars
  of CSPRNG (31⁸ ≈ 8.5×10¹¹), 10 minutes, single use.
- **Uploads.** Size-capped (`MAX_IMAGE_BYTES`) and type-sniffed by magic bytes (`sniffImage`); takeaway photos
  are served only to staff holding `orders.view`, `no-store`.
- **The service worker never caches `/api/` and never caches a page**, so nothing private survives a sign-out
  in the PWA cache (`public/sw.js`).
- **Fail-fast reads.** A 2 s deadline on reads, no silent retries; writes are never cut off
  (`src/lib/supabase/server.ts`, fix 5 of 24-Sep).

---

## 2. Findings

Severity: **Critical** — exploitable now by an anonymous person for money or identity · **High** — exploitable
with modest effort, or silent wrong financial data · **Medium** · **Low** · **Info**.

| ID | Severity | Status | Title |
|---|---|---|---|
| SEC-01 | **Critical** | **Fixed in this branch** (not deployed) | Shared setup PIN `1234` still live on 4 accounts → anonymous staff takeover |
| SEC-02 | High | **Fixed** | Eight read routes served a provisional (issued-PIN) session |
| SEC-07 | High | **Fixed** (upgrade) | Next.js 16.3.4 / zod 4.6.1 / sharp / source-map-js carried published advisories (3 critical in Next.js) |
| PERF-02 | High (data integrity) | **Fixed** | Sales report, expenses and tip ledger silently truncated at 1000 rows |
| SEC-03 | High | Open — decision | PIN throttle is per-process and global: weak against brute force, and a lockout for everyone |
| SEC-09 | High | Open — decision | A self-chosen PIN may equal someone else's; sign-in then picks either person |
| SEC-08 | Medium | Open — decision | "Skip for now" makes the provisional screen dismissible (contradicts rule 5 and KL-4) |
| SEC-10 | Medium | Open — decision | Sign-out and PIN change do not revoke a copied session cookie (14 h) |
| SEC-12 | Medium | Open — decision | Anyone with a table's URL reads its live bill and can order onto it from anywhere |
| SEC-04 | Medium | **Fixed** (partly) | No anti-framing, nosniff or referrer headers |
| SEC-11 | Medium | Open | No script Content-Security-Policy |
| PERF-01 | Medium | Open — decision | Sign-in is the slowest statement in production (286 ms mean) and grows with staff |
| SEC-13 | Low | Open — decision | Completing a table request and replying to a suggestion need no grant |
| SEC-14 | Low | Open | CSRF defence is SameSite=Lax alone; JSON parsed regardless of Content-Type |
| SEC-05 | Low | **Fixed** | `issuePin` drew a credential from `Math.random` |
| SEC-06 | Low | **Fixed** | Entrance-queue cookie not `Secure` |
| SEC-15 | Low | Open | Guest request/suggestion rate limits are per process |
| PERF-03 | Low | Open | Tip and expense ledgers read the whole history on every owner full read |
| SEC-16 | Info | Open | Four trigger functions still have a mutable `search_path` (advisor WARN) |
| SEC-17 | Info | Open | No dependency-vulnerability scan in CI |
| PERF-04 | Info | Open | 33 unindexed foreign keys, 9 unused indexes, 1 duplicate index — ≈0 ms today |
| OPS-01 | Medium | Open | No monitoring or alerting: logs go to the console only |
| OPS-02 | Info | Open | TEST Supabase project is paused and two migrations behind; last gate run FAIL (G8) |

### SEC-01 — Shared setup PIN still live → anonymous staff takeover · Critical · Confirmed · Fixed in branch

- **Affected:** `POST /api/staff/session`, `POST /api/staff/pin`; `verify_staff_pin`; KL-4.
- **Evidence (production, read-only, 26-Oct):** 4 active accounts — 1 Cashier, 3 Waiters — have
  `pin_provisional = true` and a hash that matches `1234`. No other account holds any of the codes
  `set_own_pin` refuses. The Cashier holds `bill.record_payment`, `bill.disc_pct`, `bill.view`,
  `orders.view`, `tips.settle`, `queue.notify`; the Waiters hold `menu.availability`, `orders.status`,
  `tables.clear` and views.
- **Reproduction (no database needed to see the door):** `POST /api/staff/session {"pin":"1234"}` signs in as
  whichever of the four Postgres returns first (provisional). Then either
  `POST /api/staff/pin {"skip":true}` (a full session for 14 h) or
  `POST /api/staff/pin {"current":"1234","next":"<any>"}` (the account, permanently). The site is public: the
  table QR codes point at it.
- **Root cause:** KL-4's mitigation ("an issued PIN opens one screen") assumed the *person* would be the first
  to type the code. A code shared by every account and published as the setup PIN proves nothing about who
  typed it, and the one screen it opens both accepts it as the current PIN and offers "Skip".
- **Impact:** a stranger can record payments and percentage discounts against a real cashier's name, mark
  dishes sold out, clear tables — every action attributed to an innocent employee.
- **Fix:** `signInWithPin` refuses the shared setup codes before asking the database, with the ordinary
  "That PIN did not work" (`src/lib/setup-pins.ts`, `src/lib/db/auth.ts`). The list is exactly the one
  `set_own_pin` refuses, and a rung parses the migration so the two cannot drift. No legitimate PIN is
  affected: `issuePin` never draws these and `set_own_pin` refuses them.
- **Consequence (approval point):** after deploy, the four accounts **cannot sign in until the owner issues
  each a PIN** (Staff → Generate PIN). They have not chosen a PIN since 10-Sep. **Until this branch is
  deployed, the hole is open in production;** the owner can close it today, with no deploy, by issuing those
  four a PIN now.
- **Rungs:** `tests/unit/security-audit-26oct.unit.spec.ts` (SEC-01 ×2); HTTP demonstration in
  VERIFICATION_REPORT.md.

### SEC-02 — Read routes served a provisional session · High · Confirmed · Fixed

- **Affected:** `GET /api/staff/state`, `/api/owner/state`, `/api/owner/report`, `/api/owner/favourites`,
  `/api/owner/heard`, `/api/owner/qr`, `/api/owner/review-qr`, `/api/owner/print-bridge/download`.
- **Evidence:** a static scan of every route that calls `currentStaff(` found these 8 with no `provisional`
  check; the pages and both action routes had one (action routes since 07-Oct).
- **Root cause:** rule 5 was applied per door, and the fix of 07-Oct covered the write doors only.
- **Impact:** with SEC-01, `GET /api/owner/state` handed a stranger the whole owner console payload (the
  Cashier holds `orders.view`). Independently, any issued PIN read data it was not meant to.
- **Fix:** the same refusal the action routes use, at each read door. **Ratchet:** a rung fails if ANY route
  that reads a staff session lacks the check — only `/api/staff/pin` (the one screen rule 5 opens) is exempt.
- **Residual (UX, by design):** a person whose PIN the owner reissues mid-shift now gets a 403 on the next poll;
  the screen keeps its last data under the stale notice — the same as for an expired session — and a reload
  opens "choose your own PIN".

### SEC-07 — Vulnerable dependencies · High · Confirmed (advisories) · Fixed

- **Evidence (`npm audit --omit=dev`, before):** 1 critical, 3 high. `next@16.3.4` sits in the ranges of
  GHSA-2464-fhr4-w9xw (unauthenticated RCE, Image Optimization with SVG, ≤16.4.0), GHSA-673q-mjm6-r5xr (RCE,
  `use cache`, ≤16.4.0), GHSA-cjq9-62q9-8jv4 (SSRF, Image Optimization, <16.3.8), GHSA-p3m5-59mp-jv5r (DoS,
  Server Actions, ≤16.4.0) and five moderate cache/info-disclosure advisories. `zod@4.6.1`
  (GHSA-mrhx-c7xc-m3w5, memory exhaustion), `sharp@0.35.4` (librsvg), `source-map-js@1.2.1` (DoS). Dev-only:
  `brace-expansion` (high, eslint tooling).
- **Reachability (hypothesis, not verified):** the app uses `next/image`, so the optimiser endpoint exists;
  no `use cache`, no `next/og`, no Server Actions were found. Whether Vercel serves `/_next/image` from its own
  optimiser rather than Next's was not verified. Treated as High because the upgrade is cheap and contained.
- **Fix:** `next` and `eslint-config-next` → **16.4.2** (released 15-Oct, 11 days old; 16.4.3 is 3 days old
  and was not taken), `zod` → 4.6.7, transitive `sharp` 0.35.5, `source-map-js` 1.2.2, `brace-expansion`.
  After: `npm audit` → **0 vulnerabilities** (all dependencies). Build, typecheck, lint and all unit specs
  pass; client JS +1.2–2.5 KB per route (PERFORMANCE_BASELINE.md).

### PERF-02 — Reports and ledgers truncated at 1000 rows · High (data integrity) · Confirmed · Fixed

- **Affected:** `listClosedBillsBetween` (Reports — sales, GST), `listExpensesBetween` (Income & expenses),
  `listTips` and `listExpenses` (owner ledgers).
- **Evidence:** each issued ONE request with no `.range()`. PostgREST answers at most `max_rows` (1000 by
  default). Executed: the real functions against a fake answering like PostgREST over 2,007 stored rows
  returned **1,000** (before) and **2,007 in 3 requests, none twice** (after).
- **Root cause:** the paging idiom introduced for `listFavouritesBetween` (review, 03-Oct) was applied to that
  one read and not to the others of the same shape.
- **Impact:** a month's sales report past ~1000 bills, or the tip ledger past 1000 tips, under-counts
  **without any error** — wrong money on the owner's screen. Not reached yet (bill counts are in the tens).
- **Fix:** the same loop, with an `id` tiebreak.

### SEC-03 — PIN throttle: weak against brute force, and a lockout for everyone · High · Confirmed · Open

- **Evidence:** `src/app/api/staff/session/route.ts` keeps one in-memory array per server instance: 10 attempts
  per minute **in total**, not per person or per address. Reproduced on a local production build: 9 requests
  from 9 different `X-Forwarded-For` addresses, then a member of staff from a tenth address → **429**.
- **Root cause:** a speed bump designed for one process ("not a lockout"), on a serverless host that runs many
  processes and shares nothing between them.
- **Impact:** (a) anyone can stop all staff sign-in on an instance by sending 10 requests a minute; (b) the
  brute-force ceiling scales with the number of instances an attacker can wake. With 3 usable PINs after
  SEC-01, a single instance needs ≈2,500 guesses on average (≈4 h at 10/min) to hit one of them; N instances
  divide that by N. Each wrong guess costs the database ≈0.3 s of bcrypt (PERF-01).
- **Remedy:** a durable throttle — needs a table (a migration) and a lockout policy, so it is a decision. See
  the plan.

### SEC-09 — Self-chosen PINs are not unique · High · Potential (code path confirmed) · Open

- **Evidence:** `verify_staff_pin` matches on the PIN alone with `LIMIT 1` and no ORDER BY. `issuePin` already
  redraws any PIN somebody holds — its own comment names the risk — but `set_own_pin` does not check. Whether
  any two live PINs collide cannot be checked from bcrypt hashes and was not attempted.
- **Impact:** a waiter who chooses the owner's PIN signs in as whichever row Postgres returns — possibly the
  owner. Every action is then recorded against the wrong person.
- **Why not fixed here:** refusing a taken PIN tells the chooser someone else's PIN. The safe designs (identify
  the person first, then the PIN; or refuse ambiguous sign-ins and have the owner reissue) change sign-in.

### SEC-08 — "Skip for now" makes the provisional screen dismissible · Medium · Confirmed · Open

- **Evidence:** `POST /api/staff/pin {"skip":true}` rewrites the cookie with `provisional: false` for the session
  (`src/app/api/staff/pin/route.ts`). Rule 5 (binding) says "not a dismissible banner"; KL-4 says "nothing
  else". It was added on request, for testing, on 19-Sep.
- **After SEC-01** it no longer opens anything to a stranger: the only provisional PINs left are ones the
  owner issued privately. What remains is attribution: the owner knows every issued PIN, and Skip lets an
  account work on one indefinitely.

### SEC-10 — Sessions cannot be revoked · Medium · Confirmed (by design) · Open

- Stateless HMAC cookie, 14-hour TTL. Sign-out deletes the cookie on that browser only; a copied cookie stays
  valid. Choosing a new PIN does not end other sessions. **Deactivating or removing a person does** take effect
  on the next request. A per-person `session_version` checked in `currentStaff` would make PIN change, "sign
  out everywhere" and owner revocation real — a migration.

### SEC-12 — The table URL is the only key a guest needs · Medium · Confirmed (by design) · Open

- `/t/A5` and `GET /api/guest/state?table=A5` need no secret: table names are short and guessable. Anyone, from
  anywhere, can read that table's open bill (items, totals, any occasion name a guest typed) and place a round,
  raise requests or report a payment attempt. Bills cannot be closed by a guest (rule 2) and staff see every
  round, so the damage is food made for nobody and floor noise. Remedies (a per-stand random token in the QR,
  staff confirmation of a remote first round) are product decisions.

### SEC-04 — Missing browser security headers · Medium · Confirmed · Fixed (partly)

- **Before:** no `X-Frame-Options`, no `frame-ancestors`, no `X-Content-Type-Options`, no `Referrer-Policy` on any
  page (verified on a production build). The owner console could be framed for clickjacking.
- **Fixed:** all four on every response (`next.config.ts`). Nothing in the app frames itself (checked).
- **Not done (SEC-11):** a script CSP needs per-request nonces for Next's inline scripts.

### PERF-01 — Sign-in is the slowest statement in production · Medium · Confirmed · Open

- `pg_stat_statements` (production, read-only): `verify_staff_pin` **122 calls, mean 286 ms, max 630 ms,
  σ 180 ms** — the slowest statement the application issues (next: `set_own_pin` 105 ms; every ordinary read
  is 1–3 ms).
- **Root cause:** the function computes bcrypt (cost 10) against every PIN holder until one matches; a wrong PIN
  pays for all of them. 7 accounts hold a PIN today; when all 28 do, cost grows ≈4×. `issuePin` calls it again
  for every candidate it draws.
- Fixes change sign-in (see SEC-09: identifying the person first reduces it to one bcrypt) — a decision.

### SEC-13 — Two staff actions need no grant · Low · Confirmed · Open

- `completeRequest` and `replyToSuggestion` call no `demand(...)`. Any signed-in, non-provisional person —
  including one with no grants, signed in on the owner surface — can reply to a guest suggestion; the reply
  shows on that table's phone. No RBAC_MATRIX row exists for either. Adding a key is a permission decision
  (the five questions).

### SEC-14 — CSRF relies on SameSite=Lax alone · Low · Potential · Open

- Every state change is a POST with a JSON body, and the staff, owner and guest cookies are `SameSite=Lax`, which
  browsers do not send on cross-site POSTs. `body()` parses JSON regardless of `Content-Type`, so a cross-site
  `text/plain` form would be parsed if a cookie ever arrived with it. Defence in depth: refuse a state-changing
  request whose `Origin` is not this site.

### SEC-05, SEC-06 — small hardening · Low · Fixed

- `issuePin` used `Math.random()` for a credential → `crypto.randomInt(10000)`.
- The `jalsa_queue` cookie was set without `Secure` → `Secure` in production, like every other cookie.

### SEC-15, SEC-16, SEC-17, PERF-03, PERF-04, OPS-01, OPS-02

- **SEC-15:** `/api/guest/ask` limits per session in a per-process `Map` — per instance, cleared at 500 entries.
  Low risk (staff absorb the noise).
- **SEC-16:** security advisor WARN `function_search_path_mutable` on `touch_updated_at`,
  `release_tables_on_close`, `print_job_printer_is_immutable`, `print_job_food_side_is_immutable` (trigger
  functions, not SECURITY DEFINER, not callable by the browser roles in practice). A one-line migration each.
- **SEC-17:** CI runs no dependency scan. A plain `npm audit` gate goes red on the day an advisory is published,
  on unrelated PRs — the framework's own warning about clean gates. A ratcheted scan is proposed.
- **PERF-03:** `listTips` and `listExpenses` now read every page of the whole history on each owner full read
  (every 60 s and after a change). Correct, and the cost grows linearly; bound them to "unsettled plus a window".
- **PERF-04:** 33 unindexed foreign keys, 9 unused indexes, 1 duplicate (`bridge_printer_pkey` =
  `bridge_printer_unique`). Largest table: `audit_entry` 450 rows. ≈0 ms today; revisit when `kot`/`print_job`
  pass ~50k rows.
- **OPS-01:** `logger.ts` writes to the console (Vercel function logs). Nothing alerts on 5xx, 429s, failed
  sign-ins or an unreachable database.
- **OPS-02:** the TEST project (`uxmyomxtosjlkvjxnvpy`) is **INACTIVE** (paused) and lacks the 04-Oct and 07-Oct
  migrations. The most recent recorded gate run (22-Oct) is **FAIL** at G8 Functional — a baseline failure that
  predates this audit.

---

## 3. Separating confirmed, potential and hypothetical

- **Confirmed:** SEC-01, 02, 03, 04, 05, 06, 07 (advisories), 08, 10, 12, 13, 15, 16, PERF-01, 02, 04, OPS-01, 02.
- **Potential:** SEC-09 (no collision observed; cannot be checked from hashes), SEC-14 (no working exploit).
- **Hypothesis:** SEC-07 reachability on Vercel; PERF-03 cost at scale.
