# Environments — Jalsa

> Ambiguity here produces "which database did that just write to?" — a question with no good
> answers, usually asked after the fact.

| Name | Purpose | URL | Datastore | Who may write | Automated target? |
|---|---|---|---|---|---|
| **development** | Local `npm run dev` | `localhost:3000` | Supabase project `yxgxmbyilpivbmeemqkp` | anyone with the secret key | yes |
| **degraded** | Proves the outage screen is real | `127.0.0.1:3101` | `http://127.0.0.1:1` — refuses instantly, by design | nobody: it has no database | yes |
| **test** | Automated tests | the dev server above | none — the browser boundary is mocked | CI + developers | **yes — the only automated target** |
| **ci** | `.github/workflows/e2e.yml`, on demand | the two servers above, started by Playwright | the secrets named below | the workflow | yes |
| **staging** | Pre-production verification | not provisioned | — | deploys only | no |
| **production** | Real service at Jalsa, Hosur | not provisioned | — | **approved deploys only** | **NEVER** |

**There is currently one Supabase project and it is doing development duty.** That is stated
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

## Applied migrations

| File | Applied to `yxgxmbyilpivbmeemqkp` | What it does |
|---|---|---|
| `20260910070000_jalsa_core_schema.sql` | ✅ 10-Sep-2026 | 22 tables, RLS enabled with no policies, the bill/table membership model, `next_number` |
| `20260910071000_jalsa_seed_and_pin.sql` | ✅ 10-Sep-2026 | restaurant, 11 settings, 20 tables, 11 categories, 57 items, 27 staff, 4 printers, 5 expenses |
| `20260910072000_jalsa_bootstrap_pins_and_permissions.sql` | ✅ 10-Sep-2026 | role presets — 278 permission rows |
| `20260910073000_jalsa_provisional_pins.sql` | ✅ 10-Sep-2026 | `pin_provisional`, `set_own_pin`, the `1234` setup code (KL-4) |

The project was left in its seeded state on 10-Sep-2026: the verification bill, its two KOTs, its
tip and its audit rows were deleted and `number_series` was reset to `bill 1041 / kot 105 /
group 7`. Verified: `bills 0, kots 0, tips 0, audits 0, staff 27, menu_items 57`.
