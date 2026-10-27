# Navigation performance — tests and scenarios

> 26-Oct-2026 · Part of the [navigation audit](NAVIGATION_PERFORMANCE_AUDIT.md). What runs automatically, what was
> run by hand on the performance rig, and how to repeat it. Results: [baseline](NAVIGATION_PERFORMANCE_BASELINE.md).

## 1. Automated — in the gate (no timing assertions)

Timing is measured on the rig, never asserted in CI: a millisecond threshold on a shared CI runner fails on the
runner's mood, and a gate that fails on noise is switched off within a week. The gate asserts the **causes** —
request counts, what a poll asks for, what a write sends, what a keypad renders — which do not vary.

| Spec | Tier | What it proves | Executed or pinned |
|---|---|---|---|
| `tests/render/navigation-latency.render.spec.ts` | render | The REAL `useLiveData`, mounted with a served stamp: the first poll asks `?since=` — no rebuild (duplicate-fetch prevention). Without a stamp: one full read, then `?since=`. After a write echo: the next poll still reads in full (rule unchanged) | Executed in Chromium; requests recorded via `page.route` |
| `tests/unit/navigation-latency.unit.spec.ts` | unit | N-01: `useInteractive` renders an `aria-disabled` control in server HTML; both keypads use it, focusable. N-02: `newCheck` from a served stamp asks first and keeps the 60 s clock; both pages read the stamp in the identity round, before the build; both apps pass it. N-03: the REAL `sweepStaleClaims` on the round rig — nothing stale: **no write**; one stale: expired with the update's own conditions. N-04: the sign-in record is in `after()` and nothing in POST awaits it | N-03 and `newCheck` executed; page/route wiring pinned (house idiom) |
| `tests/unit/change-check.unit.spec.ts` (existing, unchanged) | unit | The change-check rules: stamp encoding, the clock, a forced read, an echo forgetting its stamp | Executed |
| `tests/unit/bridge-contract.unit.spec.ts` (existing, unchanged) | unit | The sweep still expires stale claims to `failed`, never `queued`, and is unreachable from the bridge | Pinned |
| `tests/functional/signin.functional.spec.ts`, `keyboard-signin.functional.spec.ts` (existing) | functional | The real keypad, hydrated, in a browser: tapping and tabbing through the keys signs in — a keypad left unavailable would fail them | Executed |
| `tests/unit/security-audit-26oct.unit.spec.ts` PERF-02 (existing) | unit | Reports and ledgers are paged — re-run here: still one request at today's size | Executed |

Fail-first: recorded in `TEST_SUMMARY.md` (26-Oct, navigation). Against the pre-fix source 8 of 11 new rungs
failed; the 3 that held pin behaviour that did not change (a stampless first read, an echo's next read) or a new
pure module.

## 2. On the performance rig — by hand, reproducible

### The rig (`scripts/perf/`)

```
app (next start, production build) ─▶ gateway.mjs :54321 ─▶ PostgREST 12.2.3 :54330 ─▶ Postgres 16 :54329
                                       (Supabase-shaped; latency model; records every call)
```

| File | Role |
|---|---|
| `bootstrap.sql` | The Supabase parts the migrations assume: roles, `extensions`, `storage.buckets` |
| `gateway.mjs` | `/rest/v1` → PostgREST with a service-role JWT; latency `RIG_FIXED_MS` (parallel) + `RIG_SERIAL_MS` (one at a time) = 20 + 20, **calibrated on production**: a single call 54 ms (production 41–53), a 28-call burst 605–625 ms (production 558 p50 / 773 p95); `GET /__rig/calls`, `/__rig/reset` |
| `rig.env` | The app's build and run environment for the rig (placeholders only) |
| `seed-service.mjs` | A service in progress through the app's own routes: 40 paid bills, 12 tables eating, 2 guest phones ordering |
| `journeys.mjs` | Click → usable data per journey, n samples, profiles `local` and `india4g` (150 ms RTT, 9/1.5 Mbps, CPU 4×); sessions saved once; sign-ins paced under the app's own throttle |
| `hydration.mjs` | Visible-but-not-working time per screen |
| `pretaps.mjs` | Holds the page's scripts back while four PIN digits are tapped, then releases them: do the keys look ready, are the digits kept, is a sign-in sent |
| `idle.mjs` | Database calls and full rebuilds per open screen for 60 s; two owner actions and the 20 s after |
| `concurrency.mjs` | 1 owner + 5 captains + 20 guests polling as `useLiveData` does, a round every 10 s, 90 s |
| `suite.sh` | All of the above for ONE build, after restoring a database snapshot |

### Reproduce

```bash
dockerd &                                   # where no Docker daemon runs
docker network create jalsa-rig
docker run -d --name jalsa-pg --network jalsa-rig -p 54329:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
psql -h 127.0.0.1 -p 54329 -U postgres -f scripts/perf/bootstrap.sql
for f in supabase/migrations/2026*.sql; do psql -h 127.0.0.1 -p 54329 -U postgres -v ON_ERROR_STOP=1 -f "$f"; done
psql -h 127.0.0.1 -p 54329 -U postgres -c "grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role; grant execute on all functions in schema public to service_role;"
docker run -d --name jalsa-rest --network jalsa-rig -p 54330:3000 \
  -e PGRST_DB_URI=postgres://authenticator:rig@jalsa-pg:5432/postgres -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=jalsa-perf-rig-not-a-credential-0123456789 postgrest/postgrest:v12.2.3
node scripts/perf/gateway.mjs &
# rig PINs (RIG DATABASE ONLY): owner 2580, one captain 3691
psql -h 127.0.0.1 -p 54329 -U postgres -c "select set_staff_pin(id,'2580',false) from staff where role='Owner / Admin'"
psql -h 127.0.0.1 -p 54329 -U postgres -c "select set_staff_pin(id,'3691',false) from staff where id=(select id from staff where role='Captain' order by name limit 1)"
source scripts/perf/rig.env && npx next build && (npx next start -p 3400 &) && node scripts/perf/seed-service.mjs
docker exec jalsa-pg pg_dump -U postgres -Fc postgres > rig-snapshot.dump
scripts/perf/suite.sh "$PWD" after  out rig-snapshot.dump      # this build
scripts/perf/suite.sh <old-checkout>/jalsa before out rig-snapshot.dump
```

### Scenarios run (the prompt's §7 list, mapped)

| # | Scenario | How | Result |
|---|---|---|---|
| 1 | First application load | `guest-scan`, `owner-reload`/`staff-reload` from a fresh browser context (cold cache) | Baseline table |
| 2 | First navigation after sign-in | `owner-signin`, `staff-signin` (PIN → screen with data) | Baseline table; **India 4G screens opened, same data: owner 10/20 → 60/60, captain 10/20 → 60/60 (final keypad 20/20 each)** |
| 3 | Between two frequent screens | Dashboard → Live orders / Payments / Menu / Staff / Tips | Baseline table |
| 4 | Returning to a visited screen | Owner sections keep their data (one payload): same as 3 | Baseline table |
| 5 | Refresh on a protected screen | `owner-reload`, `staff-reload` | Baseline table |
| 6 | A screen needing several calls | Owner console (≈30), Reports (7) | Baseline table |
| 7 | One record | `guest-scan-open-bill` (one table's bill) | Baseline table |
| 8 | Larger dataset | Owner console with 40 paid + 14 open bills (274 KB) | N-09 |
| 9 | Search / filter / date range | `owner-reports-range` (Today → Last 30 days) | Baseline table |
| 10 | Create/update, then the list | `idle.mjs` owner actions (dish off/on) and what follows | Baseline §idle |
| 11 | Navigate while a request is in flight | Covered by `refresh-gate` (existing unit spec): a scheduled poll is dropped, a person's read waits; not re-measured | Existing |
| 12 | Slow network / backend latency | `india4g` profile; the rig's calibrated backend latency on every call | Baseline table |
| 13 | Many users at once | `concurrency.mjs` (26 screens) | Baseline §load |
| 14 | Cold and warm | Fresh browser context per sample (cold browser cache); server warm. **Vercel cold start: not reproducible here** | Limitation |

### Faults in the rig itself, and what they taught (kept, because they shape how to read the numbers)

- **A previous build kept serving.** The runner stopped the server with `lsof`, which cannot see listeners in
  this container; the next suite's server failed with `EADDRINUSE` and the suite measured the PREVIOUS build. The
  runner now stops by port with `fuser` and refuses to measure unless the listener's working directory is the
  build it was given. The mislabelled run was kept as a second run of the fixed build — it is the
  run-to-run noise estimate in the baseline (§3).
- **The app's own sign-in throttle** stalled every sample after the 10th sign-in in a minute (N-06). The rig now
  saves one session per surface and paces sign-in journeys.
- **A "network idle" wait and a start point taken from the gateway log** each put the rig's own time into a
  number; both were replaced (explicit settle; a clean log 3 s after the first screen) before the compared runs.

### Caught by the gate

- **`disabled` keys cannot take focus.** The keypad fix was first built with `disabled`. The keyboard-parity
  functional spec (`keyboard-signin`) failed 3 cases in G8: a key focused before the page was ready lost its focus,
  so Enter went nowhere. A keyboard user would have lost it the same way. The keys are now `aria-disabled` —
  dimmed exactly as before, still focusable — and the spec passes.

### Ruled out on the way (with the probe that ruled it out)

- **Lost PIN digits from fast taps after hydration:** four taps 50/80/120 ms apart on a 4× slower CPU, 8 each —
  24/24 sent all four digits (React 19 commits each tap before the next).
- **The harness's own 30 s stalls:** not the app's `networkidle` — the app's sign-in throttle (10/min, shared),
  which the rig then respected by pacing (N-06).
