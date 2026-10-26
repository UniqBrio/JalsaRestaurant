# Navigation performance baseline — before and after

> 26-Oct-2026 · Part of the [navigation audit](NAVIGATION_PERFORMANCE_AUDIT.md). Every number says where it came from.
> **A difference smaller than the rig's own run-to-run noise (§3) is reported as "no change", not as a gain.**

## 1. Test environment

| | |
|---|---|
| Production telemetry | Supabase project `yxgxmbyilpivbmeemqkp` (ap-southeast-2), read only: edge logs 24-Oct (a day of console use; 6,661 calls) and 26-Oct, `pg_stat_statements`, aggregate counts. Functions in `syd1` (24-Sep). |
| Rig | Postgres 16.15 + PostgREST 12.2.3 (Docker) + `scripts/perf/gateway.mjs` latency model 20 ms parallel + 20 ms serial per call, calibrated on production (single call 54 ms vs 41–53 ms; 28-call burst 605–625 ms vs 558 p50 / 773 p95). All 36 migrations. |
| Data | Seeded through the app's own routes (`seed-service.mjs`): 27 staff, 57 dishes, 20 tables; 40 paid bills, 14 open, 69 rounds, 400 audit entries — **one snapshot restored before every measured build**. |
| App | `next build` + `next start` (production), Next.js 16.4.2, built with `scripts/perf/rig.env`. Before = commit `4425538` (clean worktree); after = this change. |
| Browser | Chromium (Playwright), a fresh context per sample (cold browser cache), 1280×900. |
| Profiles | `local`: no client throttling. `india4g`: 150 ms RTT, 9 Mbps down, 1.5 Mbps up, CPU 4× slower — a DevTools model of a mid-range Android in Hosur, not a measurement of one. |
| Samples | n = 20 per journey per profile per build (p99 = the 20th of 20, i.e. the max; reported for completeness); hydration n = 10; idle 60 s; load 90 s. |

## 2. Before and after — journeys (identical data, identical rig)

"ok" = the screen's own data appeared within 30 s. Times are click (or navigation) → usable data, in ms.
`calls` = database calls in the journey (p50).

### Sign-in on a slow phone — the change that matters

| Journey (India 4G) | Before: opened | After: opened (run 1 · run 2 · **final keypad**) | Before p50 / p95 | After p50 / p95 (run 1 · run 2 · **final**) |
|---|---|---|---|---|
| Owner PIN → console | **10 / 20** | **20 / 20 · 20 / 20 · 20 / 20** | 1,955 / 2,110 (of the 10) | 1,737 / 2,085 · 1,994 / 2,068 · **1,617 / 1,977** |
| Captain PIN → floor | **10 / 20** | **20 / 20 · 20 / 20** · **20 / 20** | 1,149 / 1,475 (of the 10) | 1,103 / 1,275 · 1,065 / 1,135 · **1,096 / 1,198** |

Runs 1 and 2 used the first keypad change (`disabled`); the **final** run is the shipped code (`aria-disabled`,
after the keyboard-parity spec caught the focus regression), same snapshot. A separate first run of the unchanged
build (same rig, earlier data) gave 12/20 and 16/20. The failures are
taps landing while the page is visible but not yet working (§4); after the change the keypad shows it is not
ready, and the taps come once it is.

### Everything else — no change beyond noise

| Profile | Journey | Before p50 / p95 / p99 | After p50 / p95 / p99 | After, rerun p50 / p95 | calls before → after |
|---|---|---|---|---|---|
| local | Owner PIN → console | 1,360 / 1,379 / 1,386 | 1,351 / 1,364 / 1,371 | 1,363 / 1,375 | 31 → 32 |
| local | Reload `/owner` | 901 / 943 / 963 | 882 / 982 / 990 | 918 / 1,030 | 29 → 30 |
| local | Dashboard → Menu (no request) | 155 / 185 / 187 | 143 / 168 / 178 | 206 / 250 | 0 |
| local | Dashboard → Reports | 290 / 313 / 322 | 285 / 308 / 309 | 298 / 323 | 7 |
| local | Reports: Today → Last 30 days | 268 / 286 / 289 | 267 / 291 / 294 | 276 / 291 | 7 |
| local | Dashboard → Income & expenses | 97 / 117 / 117 | 113 / 121 / 129 | 119 / 140 | 1 |
| local | Dashboard → Uplift | 197 / 227 / 230 | 203 / 238 / 257 | 209 / 231 | 3 |
| local | Captain PIN → floor | 845 / 860 / 869 | 845 / 866 / 871 | 854 / 864 | 15 → 16 |
| local | Reload `/staff` | 458 / 515 / 533 | 469 / 533 / 537 | 502 / 558 | 13 → 14 |
| local | Guest scans a QR | 462 / 514 / 610 | 442 / 538 / 594 | 463 / 520 | 10 |
| local | Guest scans a table with a running bill | 437 / 486 / 498 | 454 / 479 / 498 | 461 / 529 | 10 |
| india4g | Reload `/owner` | 1,323 / 1,495 / 1,506 | 1,406 / 1,514 / 1,556 | 1,404 / 1,561 | 29 → 30 |
| india4g | Dashboard → Menu (no request) | 817 / 1,024 / 1,048 | 832 / 977 / 980 | 952 / 1,243 | 0 |
| india4g | Dashboard → Reports | 611 / 758 / 818 | 542 / 654 / 752 | 632 / 748 | 7 |
| india4g | Reports: Today → Last 30 days | 449 / 522 / 529 | 438 / 497 / 499 | 444 / 541 | 7 |
| india4g | Dashboard → Income & expenses | 406 / 598 / 626 | 432 / 543 / 568 | 419 / 493 | 6 → 7 |
| india4g | Dashboard → Uplift | 382 / 473 / 477 | 388 / 548 / 672 | 408 / 546 | 3 |
| india4g | Reload `/staff` | 846 / 940 / 957 | 861 / 937 / 1,003 | 879 / 988 | 13 → 14 |
| india4g | Guest scans a QR | 755 / 864 / 940 | 758 / 860 / 866 | 777 / 857 | 10 |
| india4g | Guest scans a table with a running bill | 780 / 848 / 905 | 774 / 843 / 845 | 764 / 845 | 10 |

The one extra call on owner and staff loads is the floor counter, read in the identity round (same round, no
extra wait). Client-only section switches measured once on the earlier data (India 4G p50 / p95): Live orders
363 / 464, Payments 422 / 590, Staff 320 / 412, Tips 244 / 337; local 68–98 ms p50.

## 3. Run-to-run noise (the same build, twice, same data)

The fixed build was measured twice on the same snapshot (a runner fault produced the second run — see the tests
doc). The two runs of identical code differ by **up to 33 % on short client-only journeys** (Menu, local: 143 vs
206 ms p50) and **up to 15 % on India 4G sign-in** (1,737 vs 1,994 ms p50). Any before/after difference inside
that band is no change.

## 4. Visible before it works (N-01)

`hydration.mjs`, n = 10: first paint of the element → React attached to it, in ms.

| Screen | Before local p50 / p95 | Before India 4G p50 / p95 | After India 4G p50 / p95 |
|---|---|---|---|
| `/owner` keypad | 134 / 195 | **928 / 1,172** | 890 / 1,026 |
| `/staff` keypad | 132 / 174 | **856 / 1,215** | 895 / 1,226 |
| `/t/A3` guest | 193 / 233 | **1,013 / 1,308** | 1,231 / 1,648 |

Unchanged by design: the change makes the gap visible on the keypads, it does not shorten it. The guest row's
difference is noise — the guest page is not changed by this work.

`pretaps.mjs` (scripts held back until four digits are tapped, then released), n = 5 each:

| | Before | After (`disabled`) | After, final (`aria-disabled`) |
|---|---|---|---|
| Keys while not yet working | look ready (enabled, opacity 1) | look unavailable (opacity 0.45) | **look unavailable (opacity 0.45), still focusable** |
| Digits kept / sign-in sent | 0 / no (5 of 5) | 0 / no (5 of 5) | 0 / no (5 of 5) |

Taps in the gap are not taken in either build. Before, nothing showed it; after, the keys are visibly not ready.

## 5. Rebuilds for nothing (N-02, N-03) — `idle.mjs`, 60 s from 3 s after the first screen

| Screen | Before: calls / full rebuilds | After: calls / full rebuilds |
|---|---|---|
| Owner console | 76 / 2 (+0.2 s: 25 calls 578 ms; +8.0 s: 30 calls 674 ms) | **22 / 0** |
| Captain floor | 41 / 1 (first tick: 14 calls 339 ms) | 41 / 1 (the 60 s clock, at +54 s) |
| Guest phone | 31 / 1 | 31 / 1 (not changed) |
| Owner: two actions, then 20 s | 104 / 3 | 104 / 3 (not changed — see plan, rejected) |

Owner console: **−71 % database calls** in its first minute. Captain floor: the rebuild moves from the first tick
to the clock — one rebuild fewer per page load or sign-in, the same rate thereafter.

## 6. Under load (`concurrency.mjs`, 1 owner + 5 captains + 20 guests, a round every 10 s, 90 s)

| Request | Before p50 / p95 / max | After p50 / p95 / max | After, rerun p50 / p95 / max |
|---|---|---|---|
| Guest full read (n=28) | 1,255 / 2,551 / 2,555 | 1,632 / 3,260 / 3,296 | 1,107 / 2,079 / 2,312 |
| Captain full read | 370 / 1,254 / 1,658 | 405 / 1,303 / 1,806 | 392 / 1,181 / 1,253 |
| Captain action (add round), n=9 | 933 / 1,743 / 1,743 | 963 / 1,510 / 1,510 | 945 / 1,289 / 1,289 |
| Owner full read | 721 / 1,118 / 1,118 | 787 / 1,169 / 1,169 | 750 / 1,057 / 1,057 |
| Failures | 0 | 0 | 0 |

**No change beyond noise** (the two after-runs straddle the before-run). Expected: the load clients start without
a served stamp, and the rebuilds here are real (every round moves the floor). This is N-05, not fixed.

## 7. Production (read only)

| Metric | Value | Source |
|---|---|---|
| Per call, alone | 41–53 ms p50 | edge logs 24-Oct, `x_envoy_upstream_service_time` |
| Per call, in a burst of 21+ | 402 ms p50, 631 p95, 876 p99 (n=3,819 — 64 % of all calls) | same |
| Per screen rebuild (bursts ≥ 10 calls) | 558 ms p50, 773 p95, 1,009 p99, max 1,421 (n=190: 139 owner, 41 guest) | same |
| Owner rebuild intervals | 97 of 154 gaps ≤ 20 s; only 16 at the 60 s clock | same |
| Empty sweep updates | 52 `PATCH print_job` (each bumped the floor) | same |
| `verify_staff_pin` | 286 ms mean, 630 max (n=122) | `pg_stat_statements` |
| Statement execution | 1–3 ms mean for every screen read | `pg_stat_statements` |
| Calls over 1.5 s | 0 of 6,661 | edge logs 24-Oct |
| Paid bills, last 14 days | 1 | aggregate count |

## 8. Targets

| Target (prompt) | Measured | Met? |
|---|---|---|
| Common in-app navigation ≤ 1 s p95 | Client-only sections: India 4G p95 337–1,243 ms (Menu over); local ≤ 250 ms | Mostly; Menu on a slow phone is over (N-07) |
| Critical data ≤ 2 s p95 | Every journey ≤ 2.11 s p95 on India 4G; owner sign-in 2.07–2.11 s is the outlier | Nearly; owner sign-in on a slow phone is at the edge |
| Backend operations < 500 ms p95 | Reports 7 calls ≈200 ms; an owner rebuild ≈670 ms of database time on the rig, 773 ms p95 in production | No for owner rebuilds (N-05) |
| No routine navigation consistently > 5 s | None on the rig. Open-ended waits found: lost keypad taps (fixed — now visible), the shared sign-in throttle (open) | Yes on the rig, with N-06 open |
| p50 / p95 / p99 with sample counts | Above | — |

**Not measured, so not claimed:** field data from real phones, Vercel cold starts, India ↔ Sydney round trips
from a real network.
