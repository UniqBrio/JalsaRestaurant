# Verification report — 26-Oct-2026 audit

> Part of the [audit](AUTH_PERFORMANCE_SECURITY_AUDIT.md). What was run, where, and what it returned. Failures are
> reported as failures.

## 1. Environment

- Container: Linux, Node 20+, Chromium from `/opt/pw-browsers` (`PLAYWRIGHT_CHROMIUM_PATH`), so the two WebKit
  projects did not run here (KL-3; CI runs them).
- Configuration: the literal no-database values CI uses (`.github/workflows/ci.yml`: Supabase at
  `http://127.0.0.1:1`, placeholder keys). **No test touched a database.**
- Production (`yxgxmbyilpivbmeemqkp`): read-only queries through the Supabase connector — counts, statistics and
  advisors. No names, hashes or row contents were read; nothing was written.

## 2. Suites and checks

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | **PASS** |
| Lint | `eslint . --max-warnings 0` | **PASS** |
| Unit + pure specs | `playwright test tests/unit` | **PASS — 1631 passed, 0 failed** (1619 existing + 12 new) |
| All framework audits | `npm run audit:all` | **PASS — 10/10** (theme, contrast, assets, colours, test ids, columns, fixtures, dead weight, PWA, typography) |
| Production build | `next build` on 16.4.2 | **PASS** — same two warnings as on 16.3.4 (`middleware` → `proxy`; dynamic fs tracing) |
| Dependency advisories | `npm audit` | **0 vulnerabilities** (before: 1 critical, 3 high in production deps; 1 high dev-only) |
| Ordered gate | `npm run gate` | **FAIL — 11 pass, 1 fail (G8), 0 blocked.** G1–G7 and G9–G12 PASS |
| Formatting | `prettier --check` on touched files | New files clean. `queries.ts`, `owner-mutations.ts`, `owner/qr`, `owner/report` were already unformatted before this change (74 files repo-wide, pre-existing; not a gate step) and were not reformatted, to keep the diff to the change |

### G8 Functional — failing, and not because of this change

- After: **16 failed, 80 passed.** The four data-journey specs that need a seeded database —
  `reachability`, `guest-journey`, `guest-total-visibility`, `closure-upsell-tip` — on each of four viewports.
  `reachability` asserts the server reaches a seeded database; this container has none, by design.
- **The unmodified tree (`69b25c5`), same container, same configuration: 16 failed, 80 passed. The failing sets
  were compared with `diff`: identical.**
- The previous recorded gate run (22-Oct, `TEST_SUMMARY.md`) was FAIL at G8 as well.
- Closing it needs the TEST project resumed and seeded (OPS-02). The gate's verdict stands: **merge is blocked
  by G8 until it is green or the requester decides how this pre-existing failure is handled.**

## 3. Evidence for each fix

| Finding | Evidence | Fail-first |
|---|---|---|
| SEC-01 | Rungs (pure + pinned). **HTTP, local production builds, no database:** `POST /api/staff/session {"pin":"1234"}` → unfixed build **500** (it asked the database) · fixed build **401** "That PIN did not work" (database never asked). Same for `4321`. An ordinary PIN (`2580`) still reaches the database on the fixed build (500 here only because there is none) | Recorded in `TEST_SUMMARY.md` |
| SEC-02 | Ratchet over every route calling `currentStaff(`: before, 8 routes lacked the check; after, none (only `/api/staff/pin` is exempt, by rule 5) | Recorded |
| SEC-04 | Rung executes `next.config.ts` `headers()`. **HTTP:** every route of the fixed build returns `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`; the unfixed build returned neither | Recorded |
| SEC-05, SEC-06 | Pinned rungs | Recorded |
| SEC-07 | `npm audit` before/after; build; full unit tier; client JS per route before/after (PERFORMANCE_BASELINE.md §2.4) | n/a (dependency) |
| PERF-02 | The real functions against a PostgREST-shaped fake, 2,007 rows: before **1,000**; after **2,007, 3 requests, no duplicates** | Recorded |

### Read-only production queries used as evidence (re-runnable)

```sql
-- SEC-01: who is still on a shared code (counts by role only)
select s.role, s.pin_provisional, count(*)
  from public.staff s
  cross join (values ('0000'),('1111'),('1234'),('4321')) c(code)
 where s.active and s.removed_at is null and s.pin_hash is not null
   and s.pin_hash = extensions.crypt(c.code, s.pin_hash)
 group by 1, 2;
-- 26-Oct: Cashier/true 1, Waiter/true 3. After the owner issues PINs: no rows.

-- PERF-01: sign-in cost
select calls, mean_exec_time, max_exec_time from extensions.pg_stat_statements
 where query like '%verify_staff_pin%' and query like '%pgrst_call%';
-- 26-Oct: 122 calls, 286 ms mean, 630 ms max.
```

## 4. Not verified, said plainly

- **Nothing here ran against a live database.** Every rule marked PIN in the scenario matrix is proved written,
  not proved to behave. The live journeys are BLOCKED on the paused TEST project (OPS-02).
- **The fixes are not deployed.** SEC-01 stays open in production until this branch deploys, or until the owner
  issues PINs to the four accounts (which closes it with no deploy).
- WebKit (Safari engine) did not run here.
- Field performance (RUM: LCP, INP, CLS at p75; API p95 in production) is not measured anywhere — PERFORMANCE_BASELINE.md §3.
- Whether the Next.js image-optimiser advisories were reachable on Vercel was not established (SEC-07).
- No penetration test beyond the reproductions above; no third-party scanner was run.

## 5. Final diff inspection

- No secret, key, token, PIN or personal data in the diff (the only PIN digits are the published shared codes,
  already in migration `20260910073000`).
- No migration, no environment variable, no CI change, no test removed or weakened. One existing spec's pinned
  text (`finance-section`: `.gte('spent_on', from).lte('spent_on', to)`) was kept by naming the new loop counter
  `at` rather than editing the spec.
- `tests/support/fake-supabase.ts`: `.range()` now records its arguments; no other behaviour changed.
- `AGENTS.md`: the `nextjs-agent-rules` block was rewritten by Next.js 16.4.2 itself (`#` → `##`); committed with
  the upgrade so it does not reappear as noise.

## 6. Business readiness — **T1 (noticeable)**: fixed defects and a changed validation

| Surface | Impact |
|---|---|
| Product | `1234`/`0000`/`1111`/`4321` no longer sign anybody in. An issued PIN's session gets "Choose your own PIN first" from every screen's data, not only its buttons. Reports over 1,000 bills now count every bill. |
| Pricing / Sales / Marketing | N/A — no plan, promise or published claim changes. |
| Support | **"My PIN 1234 stopped working."** Answer: it was the shared setup code and no longer opens anything; the owner issues you your own from Staff → Generate PIN, then you choose your own. |
| Onboarding | A new member of staff never had `1234` (`issuePin` draws a random code); unchanged. |
| Finance | Sales, GST, expenses and tips past 1,000 rows were under-counted silently; now whole. No historic report was large enough to be affected (largest table: 450 rows). |
| Demo | N/A. |

Release note: `CHANGELOG.md`, "Security — 26-Oct-2026".

## 7. Definition of done (`checklists/DEFINITION_OF_DONE.md`)

| Item | Status |
|---|---|
| Implements the request, no unrequested scope | Done — every line traces to a finding ID (IMPLEMENTATION_CHANGELOG.md). Design changes left for decision. |
| Canonical pattern per concern | Done — the existing provisional refusal; the existing paging loop (`listFavouritesBetween`). |
| No colour literals | N/A — no UI change. |
| Dead weight deleted | N/A — nothing superseded. |
| New dependencies verified | Done — no new package; upgrades of existing ones, versions and dates checked on the registry. |
| Every state looked at | Partly — the 403 path for a reissued PIN mid-shift reviewed in code (stale notice, as for 401); not rendered. No new screen. |
| Failure path exercised | Done — SEC-01 over HTTP; PERF-02 executed; existing outage specs pass. |
| Idempotent writes / transactions / save proved on data | N/A — no write path changed. |
| Screen checklist, both themes, contrast | N/A — no visual change (headers only). Contrast G2 PASS. |
| Five permission questions + matrix row | N/A — no permission added or changed. SEC-13 proposes two, for decision. |
| Deep route and API gated | Done — SEC-02 is exactly this, with a ratchet. |
| Tenant scoping | Unchanged — every changed query keeps `restaurant_id`. |
| No secret in client, log or repository | Done — §5. |
| Cases added, registry delta stated | Done — `security-audit-26oct.unit.spec.ts` +12, `paging.scenarios.ts` +1 support file; unit total 1619 → 1631. |
| Four dimensions | Functional (rungs), negative (provisional, shared codes), scale (2,007 rows), regression (ratchet) — addressed. |
| Fail-first evidence | Done — `TEST_SUMMARY.md`, 26-Oct section (one honest negative). |
| The gate ran; PASS or BLOCKED accepted | **FAIL at G8** — pre-existing and identical on the unmodified tree (§2). Not accepted on the requester's behalf. |
| Module doc / feature register | This audit set is the record; KL-4 addendum in the limitations register. |
| Root-cause entry | Per finding in AUTH_PERFORMANCE_SECURITY_AUDIT.md. The framework's `ROOT_CAUSE_REGISTER.md` records process failures; the process lesson is below. |
| Limitations entry | KL-4 addendum (dated). No new platform limit found. |
| Decision record | N/A — every hard-to-reverse decision is left to the requester. |
| Changelog in the user's language | Done. |
| Tier stated | T1, §6. |
| Run log closed | At commit time. |
| **Learning check** | Would a correct process have caught SEC-02? The 07-Oct fix applied rule 5 to the write doors by hand, with nothing scanning for the doors it missed — a rule enforced door by door, unexecuted (binding idea 1). This change adds the scan. The same shape caused PERF-02 (one read paged by hand on 03-Oct, its siblings missed). Candidate for `/promote`: "a fix applied per call site ships with a scan over every call site". Parked, not promoted here. |

---

## Round 3 — 27-Oct-2026 ([PERFORMANCE_OPTIMIZATION_REPORT.md](PERFORMANCE_OPTIMIZATION_REPORT.md))

The sections above stand as written for 26-Oct. This one records the verification of round 3.

### Environment
The performance rig (`scripts/perf/`): Postgres 16 + PostgREST 12.2.3 in Docker, the calibrated gateway, a production
build of the app built with `scripts/perf/rig.env`. Production was read only (trigger list, Postgres version, a
count of paired PCs, the security advisor). TEST was not touched.

### Suites and checks (on the final tree)
| Check | Result |
|---|---|
| `npm run gate` | **PASS — 12 pass, 0 fail, 0 blocked** (TEST_SUMMARY.md, newest gate run) — the first full PASS here: G8 ran against a seeded database |
| G7 unit + pure specs | 1,689 passed |
| G8 functional (desktop, desktop-wide, mobile, mobile-short; WebKit dropped, KL-3) | **128 passed** against the rig with the 27-Oct migrations; 128/128 also without them (pre-migration snapshot) |
| Render tier | 378 passed |
| `npm run audit:all` | 10/10 |
| tsc, eslint (`--max-warnings 0`) | clean |
| `npm audit` (production and all) | 0 advisories |
| Benchmark | Full suite per build, same snapshot; load test three alternating runs per build (report §7) |

### Evidence for each change
| Change | Executed evidence | Fail-first |
|---|---|---|
| RC-028 lost tap | Functional `a tap lands on the row at once`: red 2/2 full runs before, green 3/3 full runs after | Recorded (TEST_SUMMARY) |
| Catalog cache, merges, sweep | `request-reduction.unit` through the real routes; rig inventory (`/__rig/calls`) owner 31→25, captain 14→10, guest 12→8; load §7.1 | 5 of 14 red before |
| Zero-row counters | `change-counters-zero-rows.db.unit` (PGlite); rig: zero-row statements, real writes, two concurrent writers, rollback, re-apply | 3 of 6 red without the migration |
| Sign-in limit | `sign-in-throttle.db.unit` (15), `sign-in-throttle.unit` (8); rig: 50 concurrent guesses → 5 judged; fallback on an unmigrated database | Red without the migration / on the old code |
| SEC-14 | `same-origin.unit` (rules + wiring) | Wiring rung red on the old `handler()` |
| SEC-16 | `change-counters-zero-rows.db.unit` (search_path rung); advisor shows the 4 warnings today | Red without the migration |
| Menu | Event Timing click → paint, n=10 per build; `data-table-first-rows.render` | First-commit rung red on the old DataTable |

### Not verified, said plainly
- **No migration is applied to production or TEST.** Their production effect is not observed; it is proven on the
  rig and PGlite, and production's trigger set was confirmed identical to the rig's pre-change set.
- No real phone, no India network, no Vercel cold start. WebKit projects not run here (KL-3); CI runs them.
- The sign-in limit's production behaviour depends on Vercel writing `x-real-ip`; observed on the rig with the
  header set by the test client, not on Vercel.
- The rig runs Postgres 16; production runs 17.6. The transition-table restriction that shaped the trigger design is
  the same in both (documented); nothing in the three files is version-specific.

### Definition of done (round 3)
| Item | |
|---|---|
| Implements the request, no unrequested scope | done — every change traces to a priority or a confirmed finding |
| Every changed line traces to the request | done |
| Canonical patterns | done — JP-26, JP-27 recorded first |
| No colour literals | gate: PASS (G4) |
| Dead weight | done — the route's in-memory limiter moved into the fallback, no orphan |
| Dependencies | N/A: none added |
| Component library | N/A: no new component |
| States looked at | done — throttled answer (429 + wait), outage paths unchanged, fallback on an unmigrated database |
| Loading terminates | done — no new waits; the sweep is awaited beside the build, never alone |
| Failure path exercised | done — fallback, throttled, cross-site, failed cache reads not kept |
| Writes idempotent / one transaction | done — `sign_in_with_pin` is one transaction; migrations re-runnable |
| Saves proved against data | done — sign-in attempts and counters read back |
| Screen checklist / both themes / contrast | N/A: no visual change (the Menu's final DOM is identical); gate G1–G3 PASS |
| Five permission questions | done — no new permission; sign-in throttle and SEC-14 sit before any grant check; RBAC matrix unchanged |
| Deep route and API gated | N/A: no permission added |
| Tenant scoping | done — cache keyed by restaurant id; throttle is per restaurant's sign-in |
| No secret in code/log/repo | done — network key is an HMAC; no address stored; rig placeholders only |
| Cases and registry delta | done — 7 new spec files, 4 pins superseded with dated notes |
| Four dimensions | done — behaviour (specs), performance (rig), security (throttle/SEC-14 rungs), concurrency (rig) |
| Fail-first | done — TEST_SUMMARY.md, every new rung or the honest negative |
| Gate | PASS |
| Module doc / feature register | done — report, matrix, plan, changelog; no feature added |
| Root cause | done — RC-028 |
| Limitations | N/A: no new platform limit |
| Decision record | done — Option C and the sign-in rules in the report; SEC-09 left for the owner |
| Changelog | done — CHANGELOG.md, in the user's language |
| Business readiness | **T1 (noticeable)**: faster screens under load; a keypad that can say "wait N minutes" once the migration is applied |
| Run log | done — closed with a marked back-filled start |
| Learning check | Yes — CI never runs the database-backed journeys (RC-028); recommended, not repaired here |
