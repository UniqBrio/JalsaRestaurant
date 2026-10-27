# Performance optimisation, security validation and delivery — round 3

> 27-Oct-2026 · Request: [requests/2026-10-27-performance-security-delivery.md](../../requests/2026-10-27-performance-security-delivery.md)
> · Continues [NAVIGATION_PERFORMANCE_AUDIT.md](NAVIGATION_PERFORMANCE_AUDIT.md) (26-Oct) and
> [AUTH_PERFORMANCE_SECURITY_AUDIT.md](AUTH_PERFORMANCE_SECURITY_AUDIT.md). Every number says where it came from;
> **a difference inside the rig's own run-to-run noise is reported as no change.**

## 1. Summary

| Priority | What was found | What changed | Evidence | Production |
|---|---|---|---|---|
| — The 16 G8 failures | 15 need a database the build container does not have; **1 is a real defect** — a guest's tap lost when an earlier write answers between taps | `settleDraft` (JP-26) | Functional tier against a seeded Postgres: 127/128 red twice → 128/128 ×3 | Code only |
| 1. Calls per screen | Five catalog tables re-read by every full read; a third serial round for a paired PC's printers; the sweep a serial round ahead of the console | Catalog cache keyed by the counter the route already reads (JP-27); printers embedded in the PC read; sweep beside the build | Owner 31 → 25 calls and 3 → 2 rounds; captain 14 → 10; guest 12 → 8. Under load, guest full read p95 2.6–3.5 s → 1.0–1.2 s (3 runs each, §7.1) | Code only |
| 2. Counters on zero rows | 26 statement-level triggers fire for statements that change nothing | Per-event triggers with transition tables (`bump_change_version_if_rows`) | PGlite + rig Postgres 16: zero-row statements move nothing, real ones unchanged, concurrency, rollback | **Migration — awaits approval** |
| 3. Sign-in limit | 10 a minute per process, shared by everyone; per process, so multiplied by instances | Per network (keyed hash, IPv6 /64), per surface, a bound across untrusted networks, failures only, exact under concurrency | 15 database rungs; 50 simultaneous guesses → exactly 5 judged | **Migration — awaits approval**; code falls back until then |
| 4. Menu on a slow phone | The click built all 57 rows (1,523 of 1,780 elements) | First 24 rows in the click, the rest straight after (`DataTable`) | Click → next paint, 4× CPU: 472 / 576 → 360 / 440 ms p50 / p95 | Code only |
| Security | SEC-14 (no Origin check), SEC-16 (4 functions), SEC-03 (above) | `handler()` refuses cross-site writes; migration for SEC-16 | Rungs + fail-first | SEC-16 migration awaits approval |

## 2. Priority 1 — the three options, and why C

Measured first (`/__rig/calls`, rig snapshot with 40 paid bills today, 14 open, one paired PC with 4 printers):

| Screen | Calls | Rounds | What was duplicated or avoidable |
|---|---|---|---|
| Owner full read | 31 (+1 with a paired PC) | 2 (+1 once a minute for the sweep, +1 with a paired PC) | `menu_item`, `menu_category`, `menu_food_type`, `setting`, `restaurant` — unchanged between reads; `bridge_discovered_printer` read AFTER the PCs, by their ids |
| Captain full read | 14 | 2 | the same four catalog tables |
| Guest full read | 12 | 3 | the same four catalog tables |

| Option | What it would take | Calls saved | Risk | Verdict |
|---|---|---|---|---|
| A — one RPC per screen | Three SQL functions re-implementing every join and shape in `queries.ts` / `*-view.ts` (bills with rounds, items, print jobs, tips, favourites; the floor; the people and grants) — SECURITY DEFINER or invoker, each needing its own authorisation and a migration before the code could ship | ~29 of 31 | **High**: two answers to "what does the owner see" (SQL and TypeScript) that drift — the canonical-idiom rule's defect by definition; a migration on the critical path; a 274 KB JSON built in one statement; the prompt's own warning | Rejected |
| B — application merges only | Embed the PC's printers; move the sweep; merge duplicate reads | 1–2, and one serial round | Low | Kept, as part of C |
| C — B plus a version-keyed catalog cache | `catalogRead` (JP-27): the rows of the five catalog tables kept per server instance under the catalog counter the route reads in its first round | 4–6 per read, one round | Low: no migration, no new privilege, no shape duplicated; stale data impossible while the counter is honest (§2.1) | **Chosen** |

### 2.1 Why the cache cannot serve a stale menu
The catalog counter moves in the same transaction as any write to those tables (statement trigger). The route reads
the counter first and the rows after it, so rows kept under version *V* are at least as new as *V*; a later request
that reads *V* again knows nothing has committed since. A request holding no version reads fresh. The one blind spot
— a database restored to an older counter — is bounded to 60 s by `MAX_AGE_MS`. Proven through the real routes
(`tests/unit/request-reduction.unit.spec.ts`): a cold instance reads the catalog once; while the counter holds no
screen reads it again; the moment it moves, it is read again; without a counter, every read is fresh.

### 2.2 Merges kept
- `listPrintComputers` embeds `bridge_discovered_printer` (one FK path; same filter, same order): production has one
  paired PC with 4 printers (read-only count, 27-Oct), so every full owner read there paid a third serial round.
- The stale-claim sweep runs BESIDE the owner's build: once a minute it was a serial round in front of the console,
  unchanged polls included. A sweep that expires a claim moves the floor; the next poll shows it.
- Not merged: the two `bridge_token` reads and the two `latestPerKey` reads — specs pin their exact shapes for
  security reasons (no `token_hash`), and each is one call in an existing round.

## 3. Priority 2 — counters that moved for nothing

`20261027090000_jalsa_bump_only_when_rows_change.sql`. Postgres runs a FOR EACH STATEMENT trigger once per statement,
whether it changed zero rows or a thousand; production on 24-Oct had 52 empty `PATCH print_job` sweeps, each moving
the floor and making every open captain's phone and the owner's console rebuild.

- **Design.** Each of the 26 statement-level triggers becomes one trigger per event (`_ins`, `_upd`, `_del`) with the
  transition table that event fills, calling `bump_change_version_if_rows` — the same scopes in the same order, only
  when the transition table holds a row. The first draft used one trigger with three events; **the rig refused it**
  (`transition tables cannot be specified for triggers with more than one event`, Postgres 16 and 17 alike).
- **Deliberately not changed:** an UPDATE that rewrites identical values still counts (json has no equality; a
  counter that fails to move is the one failure this design must never have).
- **Concurrency:** one statement is one event, so exactly one trigger runs, as before; lock order unchanged
  (scopes sorted). Two overlapping writers on both scopes: both counted, no deadlock (rig).
- **Tests:** `tests/unit/change-counters-zero-rows.db.unit.spec.ts` (PGlite, every migration in order): every
  statement trigger asks; the same tables and scopes as before; seven zero-row statements move nothing; real writes
  move exactly what they moved before; the documented rollback restores the previous trigger set exactly and the
  change re-applies idempotently.
- **Production parity:** production's 31 counter triggers (read-only) are the rig's pre-change set exactly.

## 4. Priority 3 — the sign-in limit

`20261027100000_jalsa_sign_in_throttle.sql` + `src/lib/db/auth.ts` (`checkPin`) + `src/lib/network-key.ts`.

| Rule | Value | Why |
|---|---|---|
| What counts | **Failures only** | A shift arriving at once never spends anyone's allowance (the old limit locked the restaurant out after ten sign-ins) |
| Network | Keyed HMAC of the address under the server secret; IPv6 cut to its /64 | No address is stored; one machine's /64 is one network |
| Per network, 15 min | 5 failures (untrusted) · 10 (trusted: a correct PIN from it in the last 14 h) | A guesser meets the limit in five tries; the restaurant's wifi has room for mistakes |
| Per network, 24 h | 20 · 50 | A slow guesser too |
| All untrusted networks, per surface, 15 min | staff 30 · owner 15 | Bounds a distributed guesser; trusted networks are exempt, so an outside attack cannot lock the restaurant's own wifi out |
| Over a limit | "throttled" **whether the PIN was right or wrong**, not recorded, with the wait | The limit is never an oracle; hammering does not extend it |
| Concurrency | bcrypt first, unlocked; then one transaction-scoped advisory lock to count and record | 50 simultaneous guesses from one address: exactly 5 judged, 45 throttled (rig) |
| Account/identity dimension | Not available on a failure: a PIN-only scheme names no account until a PIN matches, and naming one would be the enumeration the keypad is designed to prevent. The owner console has its own, tighter budget | Stated, not implied |
| Unmigrated database | `sign_in_with_pin` missing → `verify_staff_pin` and the old per-process window, logged, re-asked after 5 min | Merging the code cannot break sign-in |

Attacker arithmetic, four digits and 27 PIN holders (≈0.27 % per guess): before, 14,400 guesses a day per process;
after, an outside network 20 a day, the whole untrusted internet 2,880 a day on the staff keypad and 1,440 on the
owner's, an insider on the trusted wifi 50 a day. **Four digits remain four digits** — the residual risk and the
real fix (longer PINs or device enrolment) are in [SECURITY_REMEDIATION_PLAN.md](SECURITY_REMEDIATION_PLAN.md).

## 5. Priority 4 — the Menu on a slow phone

Profiled (CPU 4×, a source-mapped throwaway build, timeline trace): no network and no hot application function.
≈320 ms of native style, layout and paint and ≈130 ms of React reconciliation, for 1,780 elements, 1,523 of them the
57-row table (25 per row, two inline SVG icons each). Only ~17 rows fit a 900 px screen.

`DataTable` now renders the first 24 rows in the click's commit and the rest in an interruptible background pass
straight after (`useDeferredValue(true, false)`). The final DOM is identical; search, filters, the count and the
export always use every row; a search cleared later shows every row at once.

| Click → next paint (Event Timing), CPU 4×, first switch on a fresh page, n=10 | Before p50 / p95 | After p50 / p95 |
|---|---|---|
| Dashboard → Menu | 472 / 576 | **360 / 440** |
| Dashboard → Payments | 176 / 240 | 160 / 296 (no change) |
| Dashboard → Staff | 184 / 216 | 168 / 224 (no change) |

Warm timeline (n=6): event dispatch 143 → 103 ms, paint 89 → 56, style 67 → 48, layout 50 → 28. The rest of the
remaining ~360 ms is the first screen of rows and the section's three cards — rendering what is on screen.

## 6. Migrations — what production needs, and how

Three files, **none applied to production or TEST**. Code may precede all three (§4, §3: nothing reads them).

| Order | File | Locks | Data touched | Rollback |
|---|---|---|---|---|
| 1 | `20261027090000_jalsa_bump_only_when_rows_change.sql` | SHARE ROW EXCLUSIVE on 26 tables until commit (0.13 s on the rig) | none | in its header (proven) |
| 2 | `20261027090100_jalsa_trigger_functions_search_path.sql` | function catalog rows | none | in its header |
| 3 | `20261027100000_jalsa_sign_in_throttle.sql` | none on existing tables (new table, new function) | none | in its header; the app falls back by itself |

**Before applying (owner):** a fresh backup or a PITR point; outside service hours; the three files in order in the
SQL editor (each in its own transaction), then their history rows — the route the 04-Oct and 08-Oct applies took
(`docs/registers/ENVIRONMENTS.md`). **Read-only checks after:** 76 triggers call `bump_change_version_if_rows`, none
at statement level calls `bump_change_version`; `select proconfig` shows `search_path=public` on the four functions
and the advisor's four warnings are gone; `sign_in_with_pin` executable by service_role only, `sign_in_attempt` RLS
on with no API-role grant; one owner sign-in succeeds and the app log no longer says "using the per-process limit".

## 7. Before and after — the full suite

`scripts/perf/suite.sh`: **before** = `696033b` (a clean worktree) on the rig snapshot of 27-Oct (40 bills paid
today, 14 open, 69 rounds, one paired PC with 4 printers); **after** = this branch (`bf86b2c`) on the SAME snapshot
with the three migrations applied. Rig latency 20 ms parallel + 20 ms serial per call (calibrated on production,
NAVIGATION_PERFORMANCE_BASELINE.md §1). n = 20 per journey per profile; every sample of both builds succeeded.

### 7.1 Under load — the change that matters (1 owner + 5 captains + 20 guests polling, 90 s)

Three runs per build, **alternated** (before, after, before, after; the first pair inside the full suites). Times in
ms, each cell `run 1 · run 2 · run 3`.

| Request | Before p50 | After p50 | Before p95 | After p95 |
|---|---|---|---|---|
| Guest full read (n≈28 each) | 938 · 1,112 · 1,321 | **640 · 464 · 512** | 2,555 · 2,733 · 3,540 | **1,219 · 1,067 · 1,038** |
| Captain full read | 404 · 411 · 357 | **301 · 307 · 292** | 1,125 · 949 · 1,013 | **763 · 750 · 551** |
| Owner full read | 856 · 919 · 865 | **615 · 648 · 728** | 1,337 · 3,383 · 1,313 | **774 · 844 · 990** |
| Captain action (add a round) | 916 · 899 · 935 | 908 · 913 · 939 | 1,543 · 1,099 · 1,510 | 1,164 · 1,288 · 1,114 |
| Failures | 0 | 0 | | |

The two sets do not overlap on any full read: the slowest "after" guest p95 (1,219) is below the fastest "before"
(2,555). The prompt's "guest p95 2.9 s under load" is ≈1.1 s on the rig. Why: every full read asks the database
4–6 fewer things, and in a burst a call's cost is its place in the queue — each removed call shortens everyone
else's wait. A write (add a round) is unchanged: it was never the reads' problem.

### 7.2 Journeys (click → usable data, ms, p50 / p95)

| Profile | Journey | Calls before → after | Before | After | Verdict |
|---|---|---|---|---|---|
| local | Owner PIN → console | 33 → **27** | 1,353 / 1,363 | 1,354 / 1,377 | No change (time is the PIN check and the page, not the calls) |
| local | Reload `/owner` | 31 → **25** | 899 / 939 | **762 / 818** | Faster (−15 % p50; noise for this journey ≈4 %) |
| local | Captain PIN → floor | 16 → **12** | 849 / 862 | 850 / 861 | No change |
| local | Reload `/staff` | 14 → **10** | 459 / 498 | **382 / 427** | Faster (−17 %) |
| local | Guest scans a QR | 10 → 10 | 449 / 514 | 424 / 500 | No change (the guest PAGE has no counter in hand; its POLLS do) |
| local | Dashboard → Menu / Reports / Uplift / Expenses / range | 0–7 | 140–287 | 98–280 | No change |
| india4g | Owner PIN → console | 33 → **27** | 1,625 / 2,012 | 1,538 / **1,708** | p95 −15 %, inside the 15 % sign-in noise band: reported as no change |
| india4g | Reload `/owner` | 31 → **25** | 1,287 / 1,421 | 1,226 / 1,358 | No change beyond noise |
| india4g | Dashboard → Menu (journey harness) | 0 | 722 / 1,042 | 623 / 1,051 | No change in this harness (its polling adds ≈150 ms); the Event Timing measurement in §5 is the one that isolates the click |
| india4g | Captain PIN → floor · Reload `/staff` | 16 → 12 · 14 → 10 | 1,012 · 764 | 973 · 739 | No change beyond noise |
| india4g | Guest scan · scan with a running bill | 10 | 705 · 711 | 697 · 693 | No change |

### 7.3 Idle cost (60 s per open screen) and hydration

| Screen | Before: calls / full rebuilds | After |
|---|---|---|
| Owner console | 22 / 0 | 22 / 0 |
| Captain floor | 41 / 1 | 41 / 1 |
| Guest phone (running bill) | 31 / 1 | **27** / 1 |
| Owner: two actions, then 20 s | 107 / 3 | 104 / 3 |

Hydration gap (India 4G, p50): owner 825 → 725, staff 802 → 739, guest 887 → 911 — no change beyond noise; nothing
here touched hydration.

**The migrations' effect is invisible in these numbers by construction:** the rig's sweep no longer writes when
nothing is stale (26-Oct), so no zero-row statement happens during a suite. Their effect is proven by the counters
(§3), and in production it is the 52 rebuilds-for-nothing a day measured on 24-Oct.

## 8. What is not done, and why

- **The owner payload is still 274 KB** for a day with 40 paid bills (P-6). Shrinking it changes what the console
  receives; it was not needed for any target here and is left with its measurement.
- **Field data from real phones in India, and Vercel cold starts** — not measurable here; not claimed.
- **SEC-09** (two people choosing the same PIN): unchanged. Refusing an ambiguous match locks both out, the owner
  included, with no in-app recovery; rejecting a taken PIN at choice time tells the chooser someone else's PIN. An
  owner decision, set out in the remediation plan.
- **CI never runs the data journeys** (the functional tier's database-backed specs): a GitHub Actions service
  container would make it possible at no cost, but it is a CI design change; recommended, not made.
