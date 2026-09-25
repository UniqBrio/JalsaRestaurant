# Environments — Jalsa

> Ambiguity here produces "which database did that just write to?" — a question with no good
> answers, usually asked after the fact.

| Name | Purpose | URL | Datastore | Who may write | Automated target? |
|---|---|---|---|---|---|
| **development** | Local `npm run dev` | `localhost:3000` | Supabase project `yxgxmbyilpivbmeemqkp` | anyone with the secret key | yes |
| **degraded** | Proves the outage screen is real | `127.0.0.1:3101` | `http://127.0.0.1:1` — refuses instantly, by design | nobody: it has no database | yes |
| **test** | Automated tests, and the ONLY target the suite may write to | the servers Playwright starts | Supabase project `uxmyomxtosjlkvjxnvpy` (`JalsaRestaurant-test`, ap-southeast-2) — created 11-Sep-2026, reset to its seed before every CI run by `scripts/reset-test-db.mjs` | CI + developers | **yes — the only automated target** |
| **ci** | `.github/workflows/e2e.yml`, on demand | the two servers above, started by Playwright | the secrets named below | the workflow | yes |
| **staging** | Pre-production verification | not provisioned | — | deploys only | no |
| **production** | Real service at Jalsa, Hosur | not provisioned | — | **approved deploys only** | **NEVER** |

**Server functions run in `syd1` (Sydney), next to both Supabase projects (24-Sep-2026, `jalsa/vercel.json`).** Before that they ran in Vercel's default `iad1` (Washington DC), and every database call paid ≈250–375 ms (requests/2026-09-24-app-feels-slow-measure-first.md). Guarded by `tests/unit/function-region.unit.spec.ts`.

**There are now two Supabase projects.** `yxgxmbyilpivbmeemqkp` does development duty and will become production; `uxmyomxtosjlkvjxnvpy` exists so the suite has somewhere to write. The reset script refuses the first by ref. Staging is still not provisioned.

~~**There is currently one Supabase project and it is doing development duty.**~~ That is stated
plainly rather than dressed up: staging and production do not exist yet, and the first
provisioning task is to create them so that development stops writing to the only copy of the
menu. Until then, treat every migration as if it were production, because it is.

---

## Binding rules

1. **Production is never an automated test target.** Not "usually not". Never.
2. **A staging deploy is a production BUILD pointed at NON-PRODUCTION DATA.** Two separate
   questions; conflating them is how a test run reaches live customers.
3. **Every schema change reaches any environment only through a migration file** in
   `supabase/migrations/`, applied in filename order. No direct edits, however minor — "minor" is
   not an exemption, and a hand-edit is drift by definition.
4. **The functional suite writes nothing to any database.** It mocks at the browser boundary
   (`**/api/**`), which in this application is the whole outside world, because the browser never
   speaks to Supabase.

---

## Variables, and which of them is a credential

| Variable | Where it may appear | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | anywhere, including the browser bundle | the project's address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anywhere, including the browser bundle | safe by construction: every table has RLS enabled with **no permissive policy**, so this key can read nothing |
| `SUPABASE_SECRET_KEY` | **server only** — `.env.local` and the deployment environment | bypasses RLS entirely. Never `NEXT_PUBLIC_`, never imported from a `'use client'` file, never committed |
| `SESSION_SECRET` | **server only** | HMACs the staff cookie. Rotating it signs everyone out, which is the correct behaviour if it ever leaks |
| `NEXT_PUBLIC_QR_ORIGIN` | anywhere | what the printed table QRs point at. Wrong here means reprinting every stand |
| `PRINT_BRIDGE_DOWNLOAD_URL` | **server only, optional** | an **https** address where the deployment has published `jalsa-print-bridge-windows.zip` (built by `npm run bridge:package -- --origin <this deployment's origin>`). Set: *Download for Windows* redirects there. Unset: the route streams `bridge/dist/jalsa-print-bridge-windows.zip` if it exists on the server's disk, otherwise the Printers screen says the installer is not published. A serverless host cannot stream a 35 MB file, so production sets this. Never a credential — the package holds none. |

In CI the same variables come from repository secrets — `SESSION_SECRET`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` —
with `APP_ENV=test` and `ALLOW_OUTBOUND_MESSAGES=false` set as literals in the workflow, because a
value that must never vary does not belong in a secret where it can be changed without review. The
job checks all four are present before installing anything, so a missing secret costs ten seconds
rather than a twenty-minute run that was never testing a configured application.

`DATABASE_URL` is carried through the workflow but **nothing in this application reads it** — it is
the starter's variable, superseded by the three Supabase ones when the data layer was built.

`.gitignore` line 5 (`.env.*`) covers all of them; `.env.example` documents them with no values.
Confirmed with `git check-ignore .env.local` before the first commit.

---

## Publishing the Windows installer (production step, not yet done)

1. `npm run bridge:package -- --origin https://<the production origin>` — downloads the pinned
   Node 24 Windows runtime from nodejs.org (SHA-256 verified), bundles the bridge, writes
   `jalsa/bridge/dist/jalsa-print-bridge-windows.zip` (~35 MB) and its manifest.
2. Upload the zip to object storage / a CDN under an https address.
3. Set `PRINT_BRIDGE_DOWNLOAD_URL` to that address in the production environment.

Rebuild and re-upload whenever `bridge/src` or `bridge/windows` changes (bump `BRIDGE_VERSION`).
Until step 3 is done the owner's *Download for Windows* button shows the honest sentence rather
than a link. `20260923090000` is applied to both projects (23-Sep-2026).

## Applied migrations

> **This table was three rows stale on 16-Sep-2026** and said so to anybody who read it: the
> 12-Sep migrations had been applied and never recorded. It is now written from
> `list_migrations` on both projects rather than from memory, which is the only way it can be
> checked. **Read it against the database, not instead of it.**

| File | `yxgxmbyilpivbmeemqkp` | `uxmyomxtosjlkvjxnvpy` | What it does |
|---|---|---|---|
| `20260910070000_jalsa_core_schema.sql` | ✅ 10-Sep | ✅ 11-Sep | 22 tables, RLS enabled with no policies, the bill/table membership model, `next_number` |
| `20260910071000_jalsa_seed_and_pin.sql` | ✅ 10-Sep | ✅ 11-Sep | restaurant, 11 settings, 20 tables, 11 categories, 57 items, 27 staff, 4 printers, 5 expenses |
| `20260910072000_jalsa_bootstrap_pins_and_permissions.sql` | ✅ 10-Sep | ✅ 11-Sep | role presets — 278 permission rows |
| `20260923090000_jalsa_print_bridge_pairing.sql` | ✅ 23-Sep (clean: no draft present) | ✅ 23-Sep (over an unrecorded draft `20260923075759 jalsa_bridge_pairing` present on TEST only; the file converges it — see its RECONCILIATION note) | `bridge_pairing_code`, `bridge_discovered_printer`, `bridge_printer`; `bridge_token.source/hostname/bridge_version/last_sync_at` |
| `20260910073000_jalsa_provisional_pins.sql` | ✅ 10-Sep | ✅ 11-Sep | `pin_provisional`, `set_own_pin`, the `1234` setup code (KL-4) |
| `20260912100000_jalsa_free_a_table.sql` | ✅ 12-Sep | ✅ 16-Sep | `tables.free` to the owner |
| `20260912110000_jalsa_discount_type.sql` | ✅ 12-Sep | ✅ 12-Sep | the discount kind on a bill |
| `20260912120000_jalsa_reassign_bill_staff.sql` | ✅ 12-Sep | ✅ 16-Sep | `bill.reassign_staff` to the owner |
| `20260916090000_jalsa_waitlist.sql` | ✅ 16-Sep | ✅ 16-Sep | `waitlist_entry`, the `W-` series, six `queue.*` grants |
| `20260916091000_jalsa_table_clearing.sql` | ✅ 16-Sep | ✅ 16-Sep | `bill_table.cleared_at` / `cleared_by`, the trigger's reopen branch, `tables.clear` |
| `20260916100000_jalsa_guest_queue.sql` | ✅ 16-Sep | ✅ 16-Sep | `waitlist_entry.seated_table_id` and its check |
| `20260916110000_jalsa_print_setup.sql` | ✅ 16-Sep | ✅ 16-Sep | printer station / connection / address / port / enabled; routes re-seeded onto menu categories |
| `20260916120000_jalsa_hr_documents.sql` | ✅ 16-Sep | ✅ 16-Sep | the last five employment columns and `staff.paperwork` |
| `20260924120000_jalsa_change_versions.sql` | ✅ 25-Sep | ✅ 25-Sep | `change_version` ('floor', 'catalog'), `bill.version`, bump triggers — the polling change check (latency fix 4). Verified after apply: 32 triggers, RLS on, staff 28 / menu 57 / tables 20 / bills 12 unchanged on development |
| `20260924130000_jalsa_change_versions_exact.sql` | ✅ 25-Sep | ✅ 25-Sep | bridge_token / guest_session bump only on a real change: the bridge sync rewrote `hostname`/`bridge_version` unchanged and moved 'floor' ten times in minutes after the first apply |
| `20260925090000_jalsa_change_versions_review.sql` | ✅ 25-Sep | ✅ 25-Sep | Fix-4 review: a child row moves its old AND new bill (id order); scopes bumped in a fixed order; staff rename moves 'catalog'; guest cart no longer moves 'floor'; bridge first contact and discovered printers move 'floor'. Verified after apply on both: the 4 triggers present, `guest_cart_line_bump_floor` gone |

**Verified after the 16-Sep run**, on `yxgxmbyilpivbmeemqkp`, against the counts taken immediately
before it: staff 27, menu items 57, tables 20, bills 2, KOTs 6, printers 4, settings 11 — every
one unchanged. Permission rows 280 → 297, which is exactly the seventeen the three grant
migrations add (six `queue.*`, `tables.clear` across three roles, `staff.paperwork`).
`waitlist_entry` exists with 0 rows.

**Two advisor notes, neither introduced by this run.** `rls_enabled_no_policy` now lists 23 tables
including `waitlist_entry` — that is the posture guardrail 3 requires, not a finding, and the new
table appearing there is the evidence it followed it. `function_search_path_mutable` flags
`release_tables_on_close`; the table-clearing migration re-creates that function and did **not**
add `set search_path`, so the pre-existing warning is carried forward rather than fixed.
`touch_updated_at` has carried the same warning since the core schema.

The project was left in its seeded state on 10-Sep-2026: the verification bill, its two KOTs, its
tip and its audit rows were deleted and `number_series` was reset to `bill 1041 / kot 105 /
group 7`. Verified: `bills 0, kots 0, tips 0, audits 0, staff 27, menu_items 57`.
