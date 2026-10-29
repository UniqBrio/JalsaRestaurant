# ENHANCE REQUEST — Explicit Data API grants before Supabase's 30-Oct-2026 default change
<!-- Filled by workflows/request.md (/request), 27-Oct-2026 · Consumed by Track B: /enhance requests/<this-file> -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- WHAT: "Audit and Fix Supabase Data API Permission Changes — Current App Only". Audit and remediate this
  application's Supabase permissions for the 30-Oct-2026 change that stops granting Data API access to new
  `public` tables by default; implement safe fixes, validate them, report. "Do not stop after producing an audit
  report."
- SCOPE: this repository's application only (`jalsa/`); no other repository, no production database.
- REQUIRED: explicit least-privilege grants per table; narrowly scoped revokes; default privileges only once role,
  grantor and ownership are verified; sequences, views and functions handled separately; RLS preserved;
  forward-only migration; fresh database, reset and CI reproduce the intended permissions; why each permission
  is required, documented.
- VALIDATION: effective privileges per table; authorised roles succeed; unauthorised roles refused; RLS;
  sequence and RPC permissions; a disposable database built from the migrations; the existing suite, with
  baseline failures reported separately; nothing claimed that was not executed.
- RUN MODE: auto — "proceed through remediation and testing without waiting for approval for ordinary local code
  changes. Request approval only for production changes or other consequential actions requiring authorization."
- SCALE: scoped (schema and permission change; not micro).
- DESIGN SURFACE: none — no screen, string or rendered element changes.
- CORRECTION ROUND: none (first request on this concern).

## MUST NOT CHANGE
- Rule 3: the browser never speaks to Supabase; RLS enabled with no permissive policy on every table.
- Every request the server makes today succeeds after the migration, on an existing project and on a fresh one.
- The privileged functions stay executable by `service_role` only.
- Nothing is applied to `yxgxmbyilpivbmeemqkp` (development, becoming production) or `uxmyomxtosjlkvjxnvpy`
  (test) without the owner's explicit approval.

## BINDING CONSTRAINTS (as stated)
- Do not blindly grant all privileges to every role; do not introduce speculative permissions.
- A GRANT does not replace RLS, and enabling RLS does not grant table privileges.
- Do not rewrite already-applied migrations; production changes need a confirmed target, a reviewed migration,
  a recovery plan and explicit approval. No destructive SQL, no reset of production, no weakened RLS, no exposed
  secret, no automatic deploy.

## THE FIVE PERMISSION QUESTIONS (answered before build)
1. **Who may do it?** The server (`service_role`, the secret key) — and only the server — reaches tables through
   the Data API. `anon` and `authenticated` reach nothing; the publishable key is configured but never used to
   query (`src/lib/supabase/server.ts`, rule 3).
2. **Where is it enforced?** Postgres privileges (this change) under RLS-with-no-policy (unchanged); the
   permission matrix stays in `src/lib/db/mutations.ts` (`demand`).
3. **What can they do?** SELECT/INSERT/UPDATE/DELETE on the 30 tables the server reaches; SELECT/UPDATE on
   `number_series`; nothing on `sign_in_attempt`; USAGE on `audit_entry_id_seq`. No TRUNCATE, REFERENCES,
   TRIGGER or MAINTAIN for any API role.
4. **What happens to existing data / grants?** No row changes. Existing grants converge on the same set a fresh
   project gets: `anon` and `authenticated` lose the default grants they never used; `service_role` loses
   TRUNCATE/REFERENCES/TRIGGER/MAINTAIN everywhere, INSERT/DELETE on `number_series`, and everything on
   `sign_in_attempt` and the identity sequences.
5. **How is it tested?** `tests/unit/data-api-grants.db.unit.spec.ts` (every migration on PGlite, as a fresh and
   as an existing project, every role executed), and a disposable PostgreSQL 16 built from `scripts/perf/bootstrap.sql`.

## DECISIONS TAKEN UNDER RUN MODE (recorded, each reversible)
- Revoke-then-grant in one transaction, so fresh and existing databases end identical (rollback in the
  migration header).
- `anon`/`authenticated` grants revoked as defence in depth (precedent: `guest_favourite`, `sign_in_attempt`),
  not because a leak was observed: RLS with no policy already returns them zero rows.
- Postgres's default privileges for `postgres` in `public` revoked for the three API roles (opting in before the
  platform does); PUBLIC EXECUTE on new functions left alone.
- `scripts/perf/bootstrap.sql` stops emulating the old default grants, so the rig models every post-30-Oct project.

## STANDING INSTRUCTIONS (do not edit)
- Track B modifies surgically: every changed line traces to the request.
- A behaviour change carries its test cases and fail-first evidence.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## REVIEW ROUND (27-Oct-2026 - appended; the sections above are kept as written)
- code-reviewer and permission-reviewer: no server path refused. Decision 1's grant set narrowed where every
  call site was traced: `audit_entry` SELECT/INSERT/DELETE, `change_version` and `restaurant` SELECT/UPDATE
  (answer 3 above is superseded for these three). The remaining 27 tables keep all four verbs.
- The spec now enforces what the migration header promises (sequences, functions, default privileges, the
  source's own `.from`/`.rpc` calls).
