# Performance baseline — Jalsa

> 26-Oct-2026 · Part of the [audit](AUTH_PERFORMANCE_SECURITY_AUDIT.md). This is **round 2** of
> [`requests/2026-09-24-app-feels-slow-measure-first.md`](../../requests/2026-09-24-app-feels-slow-measure-first.md):
> its measurements (regions, round trips, polling load, outage timing) are the baseline and are summarised, not
> repeated. New here: production statement statistics, sign-in cost, report correctness at scale, and the
> client-JS effect of the dependency upgrade.

**Every number says how it was taken. "Not measured" is written where it was not.**

## 1. The baseline already established (24–26 Sep, summarised)

| Metric | Before | After the 24-Sep fixes | How |
|---|---|---|---|
| Vercel → Supabase per call | p50 375 ms (iad1 → Sydney) | p50 71 ms, min 25 ms (syd1) | Supabase edge logs, production traffic |
| Guest page / poll, server time | ≈2.9 s, 8 sequential rounds | ≈0.54 s warm, 2 rounds | edge logs; local rig at 100 ms/call |
| Staff tap | 2 requests, 8 rounds | 1 request, 5 rounds | local rig |
| Owner poll | 5 rounds, ≈570–630 ms (rig) | 2 rounds, ≈254 ms (rig) | local rig |
| DB calls/s at 40 open tables | 84.5/s busy | 27.0/s busy, 17.3/s quiet | local rig, real PostgREST |
| DB down → designed screen | 7.17 s | 0.27 s (refused) / 2.2 s (hung) | local production build |
| Lighthouse (mobile, slow 4G, server stubbed) | score 94–100, LCP 1.5–3.1 s, TBT ≤ 80 ms | unchanged | Lighthouse 12, local |

Root cause then: functions in Washington and the database in Sydney, multiplied by sequential reads. Fixed.

## 2. New measurements (26-Oct)

### 2.1 Production statement statistics (read-only, `pg_stat_statements`)

| Statement | Calls | Mean | Max | Note |
|---|---|---|---|---|
| **`verify_staff_pin`** (sign-in, and every `issuePin` draw) | 122 | **286 ms** | **630 ms** | σ 180 ms. Slowest statement the app issues. **PERF-01** |
| `set_own_pin` | 7 | 105 ms | 132 ms | one bcrypt compare + one hash, by design |
| `next_number` (bill/KOT numbering) | 78 | 8.4 ms | 59.8 ms | |
| Bill reads (`BILL_SELECT`) | 4,734 | 3.1 ms | 89 ms | |
| Audit reads | 5,641 | 2.2 ms | 197 ms | |
| Menu reads | 6,936 | 1.4 ms | 128 ms | |
| Bridge `last_seen_at` stamp | 13,161 | 0.8 ms | 172 ms | the print bridge's heartbeat |
| `pg_timezone_names`, extension listing, `pg_sleep(20)` | — | 330–20,000 ms | | dashboard/introspection, not the application |

Data size: largest table `audit_entry` 450 rows, `staff_permission` 325, `print_job` 104, `kot_item` 98.

### 2.2 Sign-in cost (PERF-01)

- **Root cause:** `verify_staff_pin` computes bcrypt (cost 10) for each staff row that holds a PIN until one
  matches; a wrong PIN pays for every row. 7 accounts hold a PIN today.
- **Projection (not measured):** cost grows linearly with PIN holders: ≈4× at 28.
- **Target:** sign-in ≤ 150 ms of database time at p95 — achievable only by identifying the person first, so one
  bcrypt is computed (a sign-in design change; SECURITY_REMEDIATION_PLAN.md).

### 2.3 Report correctness at scale (PERF-02, fixed)

| Read | Before (2,007 rows stored, PostgREST cap 1,000) | After |
|---|---|---|
| `listClosedBillsBetween` (sales report) | **1,000 rows**, 1 request | 2,007 rows, 3 requests, none twice |
| `listExpensesBetween` (expenses and net) | **1,000** | 2,007, 3 requests |
| `listTips` (tip ledger) | **1,000** | 2,007, 3 requests |
| `listExpenses` (expense ledger) | **1,000** | 2,007, 3 requests |

Measured by executing the real functions against a fake that answers like PostgREST
(`tests/support/rounds/paging.scenarios.ts`). Cost of the fix: one extra request per additional 1,000 rows,
only for a range that large. At today's data size every read is still one request.

### 2.4 Client JavaScript after the Next.js 16.3.4 → 16.4.2 upgrade

Both trees built with `next build` (production), served by `next start` locally, each route loaded in headless
Chromium, and JavaScript counted as transferred (compressed). The database was unreachable on purpose, so
`/staff`, `/owner`, `/t/A1` and `/q` rendered their designed states — **identical conditions for both builds**,
not the full screens.

| Route | Before (KB / files) | After (KB / files) | Δ |
|---|---|---|---|
| `/` | 152.7 / 8 | 155.2 / 8 | +2.5 |
| `/offline` | 144.0 / 7 | 146.5 / 7 | +2.5 |
| `/t/A1` | 211.0 / 11 | 213.1 / 11 | +2.1 |
| `/q` | 163.2 / 9 | 165.5 / 9 | +2.3 |
| `/staff` | 221.3 / 12 | 222.9 / 12 | +1.6 |
| `/owner` | 292.8 / 12 | 294.0 / 12 | +1.2 |

About +1%, accepted for the security fixes. Load times on localhost (610–1,230 ms, noisy) are not a user
measurement and are not reported as one.

### 2.5 Growth risks (not measured: the data is too small to show them)

- `listTips`, `listExpenses`: whole history on every owner full read (PERF-03).
- Report ranges have no upper bound; a year-long range reads every closed bill with its rounds (now correctly).
- 33 unindexed foreign keys (PERF-04). ≈0 ms today.

## 3. Targets, measured and not

| Metric | Prompt's initial target | Measured here | Gap / status |
|---|---|---|---|
| API p95 for common authenticated operations | < 500 ms | Rig: staff tap 552–562 ms at 100 ms/call; production per-call p50 71 ms (syd1) | **Not measured in production at p95.** Needs Vercel function logs or RUM. |
| LCP p75 | ≤ 2.5 s | Lighthouse lab: 1.5–3.1 s (slow 4G, server stubbed) | Lab only; `/t` and `/owner` 3.1 s in lab. No field data (no RUM). |
| INP p75 | ≤ 200 ms | Not measured (TBT ≤ 80 ms in lab) | No field data. |
| CLS p75 | ≤ 0.1 | Not measured | No field data. |
| Sign-in | — | DB 286 ms mean / 630 ms max | PERF-01 |
| Session restoration | — | One cookie decode + 2 parallel reads (`currentStaff`) ≈1 round | Not timed in production |
| Error rates (auth failures, 5xx, timeouts) | tracked | **Not tracked** (OPS-01) | Monitoring needed |

**India → Vercel (syd1) phone round trip:** still not measured (this container cannot be in India). Published
figures put Chennai → Sydney at ≈140–160 ms.
