# Implementation changelog — 26-Oct-2026 audit

> Part of the [audit](AUTH_PERFORMANCE_SECURITY_AUDIT.md). Branch `claude/awesome-cannon-pkg2qg`. Every changed line
> traces to a finding ID. **No migration, no database write, no environment-variable change.**

## Application code

| Finding | File | Change |
|---|---|---|
| SEC-01 | `src/lib/setup-pins.ts` (new) | `SHARED_SETUP_CODES` (`1234`, `0000`, `1111`, `4321` — exactly what `set_own_pin` refuses) and `isSharedSetupCode()` |
| SEC-01 | `src/lib/db/auth.ts` | `signInWithPin` returns no session for a shared setup code, before the database is asked |
| SEC-02 | `src/app/api/staff/state/route.ts` | `if (staff.provisional) return fail(403, { code: 'forbidden', message: PROVISIONAL_REFUSAL })` |
| SEC-02 | `src/app/api/owner/state/route.ts` | same |
| SEC-02 | `src/app/api/owner/report/route.ts` | same |
| SEC-02 | `src/app/api/owner/favourites/route.ts` | same |
| SEC-02 | `src/app/api/owner/heard/route.ts` | same |
| SEC-02 | `src/app/api/owner/qr/route.ts` | same |
| SEC-02 | `src/app/api/owner/review-qr/route.ts` | same |
| SEC-02 | `src/app/api/owner/print-bridge/download/route.ts` | same |
| SEC-04 | `next.config.ts` | Header rule on `/:path*`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. The `/sw.js` rule is unchanged |
| SEC-05 | `src/lib/db/owner-mutations.ts` | `issuePin`: `randomInt(10000)` (node:crypto) in place of `Math.random()` |
| SEC-06 | `src/app/api/guest/queue/route.ts` | `jalsa_queue` cookie: `secure: process.env.NODE_ENV === 'production'` |
| PERF-02 | `src/lib/db/queries.ts` | `listClosedBillsBetween`, `listExpensesBetween`, `listTips`, `listExpenses`: paged loop (1,000 per request, `id` tiebreak, stop on a short page) — the `listFavouritesBetween` idiom |

## Dependencies (SEC-07)

| Package | Before | After |
|---|---|---|
| `next` | 16.3.4 | **16.4.2** |
| `eslint-config-next` (dev) | 16.3.4 | 16.4.2 (kept in step with `next`) |
| `zod` | 4.6.1 | 4.6.7 |
| `sharp` (transitive) | 0.35.4 | 0.35.5 |
| `source-map-js` (transitive) | 1.2.1 | 1.2.2 |
| `brace-expansion` (transitive, dev) | vulnerable range | patched (`npm audit fix`) |

`package.json` ranges and `package-lock.json` are committed together. 16.4.3 (published 23-Oct) was not taken:
3 days old, and 16.4.2 is outside every affected range.

## Tests

| File | What |
|---|---|
| `tests/unit/security-audit-26oct.unit.spec.ts` (new) | 12 rungs: SEC-01 (parity with the migration; refusal before the RPC), SEC-02 (ratchet over every route that reads a staff session; the exact refusal on the 8 routes), SEC-04 (headers, executed from `next.config.ts`), SEC-05, SEC-06, PERF-02 (pinned ×4, and executed against a PostgREST-shaped fake) |
| `tests/support/rounds/paging.scenarios.ts` (new) | Runs the four real query functions over 2,007 rows with a 1,000-row cap |
| `tests/support/fake-supabase.ts` | `.range(from, to)` is now recorded on the query (was a no-op), so a scenario can answer by page. No other behaviour changed |

## Documentation

| File | Change |
|---|---|
| `requests/2026-10-26-auth-performance-security-audit.md` (new) | The binding request record |
| `docs/audit/*.md` (new, 6 files) | The deliverables |
| `docs/registers/KNOWN_LIMITATIONS.md` | KL-4: dated addendum — the mitigation did not hold, and what replaces it (original text kept) |
| `CHANGELOG.md` | "Security — 26-Oct-2026" under Unreleased |
| `TEST_SUMMARY.md` | Fail-first evidence for the new rungs; the gate run |

## Migration and deployment considerations

- **None of this needs a migration.** Deploying the branch is enough.
- **After deploy, 4 accounts cannot sign in** until issued a PIN (SEC-01). The owner can do it before the deploy.
- **Next.js minor upgrade:** watch the preview for anything the unit tier cannot see (rendering, middleware).
  The build reports the same two warnings as before the upgrade (`middleware` → `proxy` deprecation; dynamic
  filesystem tracing), so none is new.
- **Rollback:** revert the merge. No data, schema or configuration to undo.

---

## Round 3 — 27-Oct-2026 ([PERFORMANCE_OPTIMIZATION_REPORT.md](PERFORMANCE_OPTIMIZATION_REPORT.md))

### Application code
| File | Change | Why |
|---|---|---|
| `src/lib/cart-draft.ts`, `src/features/guest/GuestApp.tsx` | `settleDraft`: a write's answer drops a row's draft only if it is still the figure that write carried, and never while a newer one waits to leave (JP-26) | A tap made while an earlier write was in flight was lost (functional spec red 2/2 on a real database) |
| `src/lib/db/catalog-cache.ts` (new), `src/lib/db/queries.ts` | `catalogRead`; `listMenu`, `readAllSettings`, `readRestaurant` take the catalog counter (JP-27) | 4–6 calls per full read, every screen |
| `src/lib/db/change-stamp.ts` | `readVersions()` (both counters, one read); `guestVersions()`; `floorStamp`/`guestStamp` delegate | The counter must be read before the rows it keys |
| `src/app/api/{owner,staff,guest}/state/route.ts`, `src/app/{owner,staff}/page.tsx`, `src/lib/db/{owner,staff,guest}-view.ts`, `src/lib/db/guest.ts` | Pass the version read in the first round | — |
| `src/app/api/owner/state/route.ts` | The stale-claim sweep runs beside the build | A serial round once a minute |
| `src/lib/db/queries.ts` (`listPrintComputers`) | Discovered printers embedded in the PC read | A third serial round wherever a PC is paired (production) |
| `src/lib/db/auth.ts`, `src/lib/network-key.ts` (new), `src/lib/sessions.ts` (`clientAddress`), `src/app/api/staff/session/route.ts` | Sign-in through `sign_in_with_pin` with a keyed network; `SignInThrottled` → 429 + `Retry-After`; fallback to the old window where the function is missing | SEC-03 / N-06 |
| `src/lib/same-origin.ts` (new), `src/lib/route.ts` | `handler()` refuses cross-site writes | SEC-14 |
| `src/components/ui/data-table.tsx` | First 24 rows in the opening commit, the rest deferred | Menu on a slow phone |

### Migrations (none applied outside the rig)
`20261027090000_jalsa_bump_only_when_rows_change.sql` · `20261027090100_jalsa_trigger_functions_search_path.sql` ·
`20261027100000_jalsa_sign_in_throttle.sql` — register rows in `docs/registers/ENVIRONMENTS.md`; apply procedure in
the report §6.

### Tests
New: `cart-draft-settle.unit`, `request-reduction.unit` (+ `rounds/catalog-cache.scenarios.ts`),
`change-counters-zero-rows.db.unit`, `sign-in-throttle.db.unit`, `sign-in-throttle.unit` (+ `rounds/sign-in.scenarios.ts`),
`same-origin.unit`, `data-table-first-rows.render` (+ `mounts/data-table.entry.tsx`). Superseded in place with dated
notes (contract changes): `change-versions.db.unit` (the counter function list), `table-move.db.unit` (assumed its
migration was the newest file), `security-audit-26oct.unit` SEC-01 (the first database call is now `checkPin`),
`navigation-latency.unit` N-02 (`readVersions`). Support: `fake-sessions.ts` (`surfaceFrom`, `clientAddress`),
`rounds/polling.scenarios.ts` (answers the two-counter read).

### Registers
`CANONICAL_PATTERNS.md` JP-26, JP-27 · `ENVIRONMENTS.md` three migration rows and a dated rig note.
