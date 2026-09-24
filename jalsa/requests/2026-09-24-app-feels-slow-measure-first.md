# BUG REQUEST — something that ships is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHAT HAPPENS: "The app feels slow even with little data."
- WHO IS AFFECTED: users in India (as stated). Which surface — guest, captain, owner — and which screens: `unknown`.
- WHERE: "per main screen". Corrected at the first gate (24-Sep): JS size and Lighthouse for **all screens**, not the 3 most-used.
- WAS IT WORKING BEFORE?: `unknown` — not stated.
- REPRO STEPS: `unknown` — the requester asks for measurement in place of repro steps:
  1. "Supabase project region and Vercel function region vs users in India"
  2. "per main screen: number of database/API calls, whether they run one after another, total time (network waterfall)"
  3. "initial JS size and Lighthouse on mobile throttling for the 3 most-used screens"
  4. "Supabase performance advisors: unindexed foreign keys, RLS auth.uid() per-row calls, missing indexes on list filters/sorts"
- ERROR WORDING: none — this is latency, not an error.
- CORRECTION ROUND: 1 of this whole-app symptom. The same CLASS was fixed on single screens before:
  `2026-09-12-tip-latency.md` and `2026-09-12-cart-add-latency.md` (that file already names
  "Hosur → Vercel → Supabase ap-southeast-2 → back" as the round trip).
- RUN MODE: confirm — "Measure before fixing … Rank the causes by measured cost. Fix the top ones only after I see the numbers."
- SCALE: `unknown` — the track decides once the ranking exists.

## STANDING INSTRUCTIONS (do not edit)
- Track C finds the ROOT CAUSE before proposing a fix, and states it in one sentence.
- The fix is the minimum change that removes the cause, not the symptom.
- A regression rung is added for the cause, not for the report.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## NOT STATED BY THE REQUESTER
- Which environment to measure: production is not provisioned (`docs/registers/ENVIRONMENTS.md`);
  the reachable candidates are the Vercel preview deployments on `development`
  (`yxgxmbyilpivbmeemqkp`) and a local build. `unknown`.
- Where the measurement is taken from: answered at the first gate — **Vercel + Supabase logs for server
  timings; call counts and waterfall from the code and a local production build; India latency added
  from published round-trip figures; JS size and Lighthouse locally with mobile throttling.**
- Vercel function region: requester does not know (their Blob store is Mumbai, which is storage, not
  functions). Recorded as **inferred iad1, not confirmed**.
- A target (e.g. "under N seconds"): `unknown`.

## MEASUREMENTS (Track C's first stop — 24-Sep-2026; nothing fixed yet, per RUN MODE: confirm)

**Root cause, one sentence:** every screen is built from 7–8 sequential database calls
(owner/staff: 3–5 waves, plus a second request after every action), and every one of them crosses
from Washington DC (where the Vercel functions run) to Sydney (where Supabase is), about 250 ms
each. The database itself answers in about 1 ms.

### 1. Regions
| | Region | Evidence |
|---|---|---|
| Supabase `yxgxmbyilpivbmeemqkp` (dev) and `uxmyomxtosjlkvjxnvpy` (test) | ap-southeast-2 **Sydney** | `list_projects` |
| Vercel functions | **iad1, Washington DC** | Supabase edge logs: all 39,357 REST calls in 24 h came from `cf.colo=IAD`, Ashburn VA, AWS. Repo has no `vercel.json`/`preferredRegion` (the default is iad1). The requester's Mumbai setting is Blob storage, not functions. |
| Users | Hosur, India | request |

Measured Vercel→Supabase per call (`response.origin_time`, 24 h, n=39,357): **min 229 ms · p50 375 ms · p90 748 ms**.
Postgres execution time for the same queries (`pg_stat_statements`): **0.2–2.7 ms mean**.
Phone→iad1 round trip: **not measured** (this container is outside India and cannot reach vercel.app).
Published figures are about 200–250 ms for Mumbai/Chennai→US-East and about 140–160 ms for Chennai→Sydney.

### 2. Per screen: calls, waves, time
Calls and waves come from the code (file:line map in the run notes). Times come from one real
trace in the edge logs, 24-Sep 03:06:51.
| Load | Supabase calls | Sequential waves | Server time |
|---|---|---|---|
| Guest `/t/[table]`, page **and every 6 s poll** | 12 | 8 (2 are writes: `last_seen_at` and an unconditional `bill_id` update) | **≈2.9 s measured**: seven one-at-a-time calls at 231–260 ms each, then a 5-call burst of about 440–650 ms |
| Owner `/owner`, page and every 8 s poll | 30 (open-bills query ×3, requests ×2) | 5 | **≈2.1 s measured**. The 25-call burst takes 400–870 ms per call, versus 250 ms for a call on its own. |
| Staff `/staff`, page and every 6 s poll | 12 (open-bills ×2, requests ×2) | 3 | ≈1.3 s estimated (2 × 250 ms, then a 10-call burst of about 800 ms) |
| Guest `/q` | 3–5 | 1–2 | ≈0.3–0.6 s estimated |
| Guest cart tap | 11 | 6 | ≈1.8 s estimated |
| Guest place round | about 25 (new bill: about 32) | about 18 (new bill: about 21) | ≈4.5–5 s estimated |
| Staff action (e.g. advance KOT) | 5, then a 12-call re-read in a **second request** | 5 + 3 | ≈2.3 s estimated, plus 2 phone round trips |
| Owner action | 5–10, then a 30-call re-read in a second request | 5–10 + 5 | ≈3–4 s estimated |

### 3. Initial JS and Lighthouse
Local production build, Lighthouse 12, mobile, simulated slow 4G, Moto G class CPU.
The server was stubbed to answer instantly, so these numbers **exclude** the server time in §2.
| Screen | Score | FCP | LCP | TBT | JS transferred (gzip) | Unused JS |
|---|---|---|---|---|---|---|
| `/` | 100 | 0.8 s | 1.5 s | 60 ms | 153 KB / 8 files | 29 KB |
| `/t/[table]` | 94 | 0.8 s | 3.1 s | 70 ms | 214 KB / 12 | 29 KB |
| `/q` | 97 | 0.8 s | 2.7 s | 60 ms | 163 KB / 9 | 54 KB |
| `/staff` | 99 | 0.8 s | 2.3 s | 50 ms | 199 KB / 11 | 28 KB |
| `/owner` | 94 | 0.8 s | 3.1 s | 40 ms | 254 KB / 13 | 86 KB |
| `/offline` | 99 | 0.8 s | 2.1 s | 80 ms | 144 KB / 7 | 54 KB |

Limitation: with the server stubbed empty, `/t/A1` rendered the "table not found" state. A static
estimate from the build manifest puts the full guest screen at 239 KB gzip.

### 4. Supabase performance advisors
| Advisor | Count | Measured cost |
|---|---|---|
| Unindexed foreign keys | 28 (INFO) | **≈0 ms**. The largest table is `staff_permission` with 319 rows, and app queries take 0.2–2.7 ms mean. |
| RLS `auth.uid()` per-row | **0**. There are no RLS policies (guardrail 3), so nothing calls `auth.uid()`. | n/a |
| Missing indexes on list filters/sorts | `bill.closed_at`, `tip.created_at`, `suggestion.*`, `print_job.kot_id/bill_id`, `staff_table.table_id`, `dining_table ilike name` | **≈0 ms** at this data size |
| Unused indexes | 8 (INFO) | write cost only, negligible |
| Duplicate index | 1: `bridge_printer_pkey` = `bridge_printer_unique` (WARN) | negligible |
| Slowest statements | `pg_timezone_names` 298 ms mean, 45 calls (dashboard/introspection, not the app); PIN RPC 100 ms mean, 41 calls (sign-in only, hashing by design) | not on the hot path |

### Ranked by measured cost (per guest screen load or poll)
1. **Function region iad1 ↔ database Sydney: about 250 ms per call × 8 waves ≈ 2.0–2.9 s.** Measured. With functions next to the database, each wave would cost a few ms.
2. **Waves that could run together** (guest 8 → about 3; the owner's final `staff_permission` read; `currentStaff`'s 2 reads): **≈1.0–1.3 s** at today's latency. This cost multiplies with #1.
3. **Actions that don't return state** (staff and owner): a second request with 3–5 more waves, **≈0.75–1.3 s per tap**.
4. **Burst contention**: in a 10–25-call burst each call takes 400–870 ms instead of 250 ms. **≈+0.3–0.6 s** per staff or owner poll.
5. **Phone ↔ iad1 distance**: about 200–250 ms per request (published figure, not measured).
6. **Client JS / render**: TBT ≤ 80 ms, LCP 1.5–3.1 s under slow-4G simulation. Small, and not the cause.
7. **Indexes / advisors**: ≈0 ms at this data size.

Side finding, not part of the everyday slowness: when the database is unreachable, `supabase-js`
retries for **≈7 s** before the designed "unavailable" screen appears (measured locally, 7.03–7.17 s).

## APPROVED (24-Sep-2026, from the requester, verbatim)
> Approved, in this order, separate commits, re-measure after each (before/after table):
> 1. Vercel functions → syd1 (next to the database). Re-measure guest-screen server time.
> 2. Guest screen: 8 sequential rounds → ≤3 (parallelise independent reads).
> 3. Staff/owner actions return the updated screen state — no second request.
> 4. Polling: replace "re-read everything every 6 s" with a cheap change check (one
>    updated-at value per table/order) and reload only on change — or Supabase Realtime,
>    whichever is simpler here. Report calls/second at 40 open tables, before and after.
> 5. Outage: fail fast (~2 s) to the unavailable screen instead of the 7 s retry.
> Users/diners are located in: <India | Australia>. No database move until I confirm.

- Diner location: **India**, from `jalsa/CLAUDE.md` ("one restaurant in Hosur, Tamil Nadu"). No database move.
- Fix 4 uses a **change check, not Supabase Realtime**. Realtime would make the browser subscribe to
  Supabase directly, which breaks binding guardrail 3 ("the browser never speaks to Supabase").
- Re-measurement method (requester's choice): after each push, the requester uses the preview on
  a phone in India, and the timings are read from the Supabase edge logs as before.
- Region is set in code (`jalsa/vercel.json`), not the dashboard (requester's choice).

## BEFORE / AFTER (guest-screen server time, Supabase edge logs)
| Step | Function region (edge `cf.colo`) | Per-call time (origin_time p50) | Guest load/poll server time | Measured |
|---|---|---|---|---|
| Before | iad1 (IAD) | 375 ms (min 229) | ≈2.9 s | 24-Sep 03:06 trace |
| After fix 1 | *pending: requester's phone run* | | | |
