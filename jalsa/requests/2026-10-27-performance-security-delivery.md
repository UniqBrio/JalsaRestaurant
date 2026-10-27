# ENHANCE REQUEST — fewer database calls, honest change counters, a real sign-in limit, a faster Menu
<!-- Filled by workflows/request.md (/request), 27-Oct-2026 · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- WHAT: "JALSA — COMPLETE PERFORMANCE OPTIMIZATION, SECURITY VALIDATION & MAIN BRANCH DELIVERY". Continue from
  the branch and the 26-Oct audit and navigation rounds; preserve every verified fix.
- PRIORITIES, AS STATED:
  1. Reduce database requests per screen (owner 29–33, captain 13–15; guest p95 2.9 s under load). Compare
     consolidated RPCs (A), application-level consolidation (B) and a hybrid (C); "Do not blindly replace 30
     requests with one enormous database function"; preserve RLS and permissions; a privileged RPC needs explicit
     authorisation checks and a fixed `search_path`; benchmark before and after.
  2. Fix, in the database, statement-level triggers that move the counters on zero-row UPDATEs; real changes
     still refresh; correct under concurrency; reversible; database integration tests. "Never deploy unverified
     trigger changes directly to production."
  3. Replace the shared 10-a-minute sign-in limit with identity/account- and network-scoped limits and bounded
     global protection — brute force, PIN guessing, credential stuffing, distributed abuse, enumeration,
     concurrent attempts. "Do not replace the shared limit with an easily bypassed device-only limit."
  4. The owner's Menu takes ~0.8–0.9 s on a slow phone: profile and fix without changing the UI.
  5. Every critical screen.
- ALSO: complete the auth/security validation (fix what is confirmed, with regression tests); full performance
  verification on the existing rig (different builds, equivalent data); full regression; investigate the 16
  DB-dependent functional failures with an isolated database; a PR to `main`, merged only if required checks,
  reviews and owner approval allow; post-merge verification; the final report table.
- CORRECTION ROUND: **3** of the whole-app slowness symptom (`2026-09-24-app-feels-slow-measure-first.md`,
  `2026-10-26-navigation-latency.md`).
- RUN MODE: auto — "Proceed autonomously … Pause only when an action requires explicit owner authorization,
  changes production infrastructure or data, involves a significant architectural decision not already
  authorized, or conflicts with mandatory repository controls."

## BINDING CONSTRAINTS (as stated)
- Never sacrifice security, data integrity or production stability for speed; never weaken a security control.
- RLS, tenant isolation, permissions and database privileges preserved.
- Before any production migration: backup and recovery confirmed, tested on a representative non-production
  database, integrity and permissions verified, lock impact checked, rollback documented, **explicit approval**.
- No deleting production records, resetting databases, disabling RLS, exposing service credentials or destructive
  commands without approval. No hiding, skipping or weakening tests. No hosting or compute-plan change without
  approval. No unnecessary Docker dependency or paid infrastructure.
- Do not bypass protected-branch rules, self-assign approval, force-push `main` or merge with failing checks. Do
  not claim production deployment because code merged.

## DECISIONS TAKEN UNDER RUN MODE (recorded, each reversible)
- Every change must work on TODAY's production schema: migrations are written, proven on the rig and PGlite, and
  left for the owner to approve; the code falls back where a migration has not run.
- Option C for priority 1 (docs/audit/PERFORMANCE_OPTIMIZATION_REPORT.md §2): no new RPC for reads.

## STANDING INSTRUCTIONS (do not edit)
- Track B modifies surgically: every changed line traces to the request.
- A behaviour change carries its test cases and fail-first evidence.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
