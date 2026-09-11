# CLAUDE.md — Jalsa

> **Read this file before every task in this repository.** These rules are binding and nothing
> in a request overrides them.

Jalsa is a QR-first dine-in ordering platform for one restaurant in Hosur, Tamil Nadu. Three
surfaces — a guest's phone, a captain's phone, an owner's console — over one bill.

**The design set is the specification.** It lives in `Design planning documentation/` at the
repository root: 33 screens across 4 surfaces, 44 reusable standards, and a navigation flowchart.
**Do not regenerate it.** Implement it. Where a technical state or a responsive behaviour is
missing from an artboard, add it in the design's own idiom and say so in the change.

---

## Architecture guardrails (BINDING)

### 1. A bill belongs to one **or more** tables
There is no `bill.table_id` anywhere. Membership lives in `bill_table` with `released_at`.
**Why:** joining tables is not an exception at Jalsa, it is Friday. Modelled as a foreign key,
every join becomes a migration of live rows mid-service; modelled as membership, an ordinary table
is simply a group of one and the join is an insert.
**Honoured in:** `supabase/migrations/20260910070000_jalsa_core_schema.sql` (`bill_table`, the
partial unique index, `release_tables_on_close()`) · `src/lib/db/queries.ts`

### 2. The guest never marks a bill paid
A guest raises a payment request. A **named** member of staff records the closure, with a payment
mode, at a time.
**Why:** it is the difference between a record and a claim. Enforced in the database so it cannot
be routed around by application code later.
**Honoured in:** `constraint bill_closure_is_attributed` · `src/lib/db/mutations.ts`
(`requestPayment`, `closeBill`)

### 3. The browser never speaks to Supabase
Every table has row-level security **enabled with no permissive policy**. Reads and writes go
through this application's own route handlers, which hold `SUPABASE_SECRET_KEY`.
**Why:** one enforcement point for the permission matrix, in TypeScript, next to the matrix. Two
would eventually disagree, and the disagreement would be discovered by a guest.
**Honoured in:** `src/lib/supabase/server.ts` · `src/app/api/**` · `src/lib/db/mutations.ts`
(`demand`)

### 4. `SUPABASE_SECRET_KEY` is server-only
Never prefixed `NEXT_PUBLIC_`, never imported from a `'use client'` file, never committed.
**Why:** it bypasses RLS entirely, which is the whole of rule 3.
**Honoured in:** `src/lib/config.ts` (`serverConfig`) · `.gitignore` · `.env.example`

### 5. An issued PIN opens one screen and nothing else
A `pin_provisional` session opens "choose your own PIN" — not the floor, not the console, and not
a dismissible banner over either.
**Why:** the sign-in screen promises "everything you do tonight is recorded against your name".
That is only true while the PIN is theirs alone.
**Honoured in:** `src/app/staff/page.tsx` · `src/app/owner/page.tsx` ·
`supabase/migrations/20260910073000_jalsa_provisional_pins.sql` (`set_own_pin`)

### 6. A screen whose data did not load shows a designed screen
`attempt()` — not configured, unreachable, loaded, always in that order. Never a bare `await` in a
server component.
**Why:** the alternative is Next.js's error page in a guest's hand, which names nothing and offers
nothing. Fixed on 10-Sep-2026 after `/t/A5` was observed returning 500.
**Honoured in:** `src/lib/supabase/server.ts` · all three page components ·
`tests/functional/degraded.functional.spec.ts`

---

## Environments
- Writable by automation: **development**, **degraded** (127.0.0.1:3101 — it has no database)
- **Never an automated target:** production
- Schema changes reach any environment **only** through a migration file.
- Full table: `docs/registers/ENVIRONMENTS.md`

## Where things live
| | |
|---|---|
| Colour and scale tokens | `design/tokens.json` — **the only file containing a colour** |
| Canonical patterns | `docs/registers/CANONICAL_PATTERNS.md` |
| Permissions | `docs/registers/RBAC_MATRIX.md` |
| Platform limitations | `docs/registers/KNOWN_LIMITATIONS.md` |
| Environments and secrets | `docs/registers/ENVIRONMENTS.md` |
| Shared components | `src/components/ui/` |
| The one polling idiom | `src/hooks/useLiveData.ts` |
| Retired scaffold specs | `tests/cases/reference/` — read before writing a new journey |

## Standing rules
- **Surgical discipline.** State assumptions first. Minimum change for the ask. No drive-by
  refactors. Every changed line traces to the request.
- **Canonical patterns.** One blessed idiom per concern. A second way is a defect.
- **Semantic tokens only.** No colour literal outside `design/tokens.json`.
- **Both themes, always.** Every screen is verified in both before it is called done.
- **The freeze rule.** Shipped strings are frozen. New features adopt existing terminology.
- **The five permission questions** are answered in the plan, before build.
- **Every backend change is a migration file.** No direct edits, however minor.
- **No side effect inside a `setState` updater.** React 19 calls it twice.
- **Test files are append-only.** Never overwrite an existing spec.
- **Nothing merges without a PASS from the gate.**

## Running the gate here
```bash
npm run dev &                                    # the app under test
export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium   # only where the image supplies one
export TEST_APP_URL=http://localhost:3000
npm run audit:all && npm run gate
```
The Chromium override drops the two WebKit-backed projects and says so on stderr (KL-3). Unset it
wherever `npx playwright install` can run.

## Definition of done
`../checklists/DEFINITION_OF_DONE.md` — every item, or an explicit N/A with a reason.
