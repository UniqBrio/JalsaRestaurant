# AUDIT REQUEST — authentication, authorisation, performance and security
<!-- Filled by workflows/request.md (/request), 26-Oct-2026 · Classified TRIAGE: the ask is a LIST of audits and
     fixes, not one change. Each confirmed finding was handled as its own item; this file is the "why" of every
     commit on the branch, and docs/audit/ is where the findings, evidence and plan live. -->

## FIELDS
- WHAT WAS ASKED (the requester's own heading): "Complete Authentication, Application Performance Optimisation,
  and Security Audit" — "conduct a complete, evidence-based audit of this application's authentication,
  authorization, performance, and security. Identify root causes, fix confirmed issues, and verify".
- SCOPE (as stated): account creation, login/logout, recovery, sessions and tokens, roles and tenant isolation,
  page/API/database performance, uploads, caching and offline, API/database/browser security, secrets and
  integrations, infrastructure and deployment, abuse scenarios, tests, monitoring.
- DELIVERABLES (as stated): `AUTH_PERFORMANCE_SECURITY_AUDIT.md`, `AUTH_SCENARIO_TEST_MATRIX.md`,
  `PERFORMANCE_BASELINE.md`, `SECURITY_REMEDIATION_PLAN.md`, `IMPLEMENTATION_CHANGELOG.md`,
  `VERIFICATION_REPORT.md` — "in the repository's existing documentation convention". Written to
  `docs/audit/`.
- APPROVAL BOUNDARY (as stated): approval before "breaking changes, authentication-provider changes, production
  database changes, destructive operations, or changes that weaken existing safeguards". Changes "that can be
  implemented safely without architectural decisions" may be implemented.
- PRODUCTION (as stated): "Do not modify production data, delete resources, rotate credentials, or perform
  destructive migrations during the audit without explicit approval." **Honoured:** production
  (`yxgxmbyilpivbmeemqkp`) was READ only — aggregate counts and statistics, no names, no hashes — following the
  read-only verification precedent in `docs/registers/ENVIRONMENTS.md`. Nothing was written to any database.
- RUN MODE: `unknown` — not stated. Applied as: investigate first, fix only confirmed defects with a contained
  fix, and leave every design decision to the requester (SECURITY_REMEDIATION_PLAN.md, "Needs your decision").
- CORRECTION ROUND: performance is round 2 of `2026-09-24-app-feels-slow-measure-first.md` (its measurements are
  reused, not repeated); security follows the 01–03 Oct privileged-function lockdown (`20261001090000`,
  `20261003090000`).

## NOT STATED BY THE REQUESTER
- A performance target for this application: `unknown`. The prompt's generic targets are recorded as targets
  in PERFORMANCE_BASELINE.md, not as commitments.
- Whether the four accounts still on the shared setup PIN are in use: `unknown`. They have never chosen a PIN
  since 10-Sep; after this change they sign in with a PIN the owner issues them (SEC-01).
- Whether "Skip for now" (a requested testing aid) should stay now the app is live: `unknown` — SEC-08.

## STANDING INSTRUCTIONS (do not edit)
- Find the ROOT CAUSE of each finding before proposing a fix, and state it in one sentence.
- The fix is the minimum change that removes the cause, not the symptom.
- A regression rung is added for the cause, and observed failing on the pre-fix tree.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
