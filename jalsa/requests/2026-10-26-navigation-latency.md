# BUG REQUEST — something that ships is broken
<!-- Filled by workflows/request.md (/request), 26-Oct-2026 · Consumed by Track C: /bug requests/<this-file> -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHAT HAPPENS: "Navigation and data loading can take more than five seconds." "users should not have to wait
  several seconds for routine operations or for a single record to appear."
- WHO IS AFFECTED: `unknown` — all three surfaces are named as candidates (owner console, staff/captain, guest
  QR); which screens are slow for whom was not stated.
- WHERE: "when users navigate between screens and wait for data to appear". Screens named by the requester as
  candidates: owner dashboard and console, orders and active bills, tables and QR ordering, KOTs, staff screens
  and PIN verification, attendance "if present", reports and financial summaries, expenses, tips, favourites,
  closed bills, settings. "Do not assume that every screen exists."
- WAS IT WORKING BEFORE?: `unknown`.
- REPRO STEPS: `unknown` — the requester asks for measurement: "Start by measuring a slow navigation journey end
  to end. Find the exact point where time is being lost before implementing optimizations."
- ERROR WORDING: none — latency, not an error.
- CORRECTION ROUND: **2** of the whole-app slowness symptom. Round 1:
  `requests/2026-09-24-app-feels-slow-measure-first.md` (region move to syd1, waves parallelised, actions return
  the screen, change-check polling, fail-fast reads). Also read: `docs/audit/PERFORMANCE_BASELINE.md` (26-Oct,
  PERF-01 sign-in cost, PERF-02 paging). What round 1 left: it measured DATABASE ROUNDS on a rig that added a
  flat 100 ms per call, so a burst of 28 parallel calls looked like one round of 100 ms. Production shows the
  same burst costs ≈560 ms, because the calls queue (docs/audit/NAVIGATION_PERFORMANCE_AUDIT.md, N-01). The
  number of calls per read, not only the number of rounds, is what costs time.
- RUN MODE: auto — "Continue through remediation and verification wherever safe … Stop before production
  deployment and report any approval requirements."
- SCALE: `unknown` — decided by the measurements.

## BINDING CONSTRAINTS (as stated)
- No removal of authentication, authorisation, permission checks or RLS to look faster.
- No new framework, hosting provider, paid service or major rewrite without approval.
- No production data change, destructive migration, production configuration change or deploy without approval.
- No blind caching, indexes, pools, retries or spinners — evidence first.
- Separate shell time from usable-data time; never call a screen fast because its frame appeared.
- No flaky timing assertions in CI.
- Not a security audit.

## NOT STATED BY THE REQUESTER
- A device, network or location for the 5 s: `unknown`. Diner location is Hosur, India (`jalsa/CLAUDE.md`);
  functions and database are in Sydney (`docs/registers/ENVIRONMENTS.md`). Measured here as an emulated India 4G
  phone; no measurement from a real phone in India exists.
- Whether the 5 s is the first load of the day, a sign-in, or moving between sections: `unknown`.
- Production telemetry: Supabase edge logs and `pg_stat_statements` (read-only) are available; Vercel function
  logs and real-user timings are not.

## STANDING INSTRUCTIONS (do not edit)
- Track C finds the ROOT CAUSE before proposing a fix, and states it in one sentence.
- The fix is the minimum change that removes the cause, not the symptom.
- A regression rung is added for the cause, not for the report.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
