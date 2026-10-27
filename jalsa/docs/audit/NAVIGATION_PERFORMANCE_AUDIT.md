# Navigation performance audit — Jalsa

> 26-Oct-2026 · Request: [`requests/2026-10-26-navigation-latency.md`](../../requests/2026-10-26-navigation-latency.md)
> (round 2 of [`2026-09-24-app-feels-slow-measure-first.md`](../../requests/2026-09-24-app-feels-slow-measure-first.md)).
> Companions: [baseline](NAVIGATION_PERFORMANCE_BASELINE.md) · [plan](NAVIGATION_OPTIMIZATION_PLAN.md) ·
> [tests](NAVIGATION_PERFORMANCE_TESTS.md) · [changelog](NAVIGATION_PERFORMANCE_CHANGELOG.md)

**Evidence rule.** *Confirmed* = reproduced here or seen in production telemetry. *Measured* numbers say where
they come from. Production was READ ONLY (Supabase edge logs, `pg_stat_statements`, aggregate counts).

---

## 1. Summary — where a person's seconds go

1. **Taps thrown away before the screen works (N-01).** A server-rendered screen is *visible* well before it
   *works*: on an emulated India 4G phone, 0.85–1.0 s at p50 (1.0–1.3 s at p95) on every surface. A tap in that
   gap is discarded without a sign. On a PIN keypad one lost digit means the sign-in is **never sent**: on
   identical data, 20 of 40 slow-network sign-ins on the unchanged build sat waiting for a screen that was not
   coming (30 s timeout); after the change, 0 of 120 (three runs). This is the one mechanism found that produces an
   open-ended wait. **Fixed** for both keypads — the keys now show they are not ready.
2. **Screens rebuilt for nothing (N-02, N-03).** The owner console and captain floor are served without their
   change stamp, so the first poll after every page load, sign-in and reload rebuilds the screen just rendered
   (owner: 29–33 database calls). And a once-a-minute print sweep runs an `UPDATE` that matches no row, which
   still moves the floor counter — so every console and captain phone rebuilds once a minute for a change that
   did not happen (52 such updates in production on 24-Oct). **Fixed** in the application.
3. **Every rebuild queues (N-05).** Supabase answers a call alone in 41–53 ms, but a call inside a burst of 21+
   in **402 ms** at p50 (production, 24-Oct, 3,819 calls): the calls queue. An owner rebuild is ≈30 calls, so
   ≈560 ms (production p50) to ≈680 ms (rig) of database time, and under load the queue is shared: with 26
   screens open, a guest's full read took **2.9 s at p95**. Not fixed here — the structural fix (fewer calls per
   screen) is a design change: [plan](NAVIGATION_OPTIMIZATION_PLAN.md).
4. **The sign-in throttle is shared by everyone (N-06).** 10 attempts per minute per server process, for the
   whole restaurant. The 11th person signing in within a minute waits up to 60 s. Confirmed by the rig itself,
   which tripped it. A security mechanism; left as it is, with a proposal.

**What did not reach 5 seconds anywhere it could be measured.** With the region move of 24-Sep in place, every
measured journey that reaches the server finished within 2.2 s on the India 4G model (p95), and within 1.4 s on
the rig without client throttling — except under concurrent load (guest full read 2.9 s at p95) and the open-ended
waits above. **Not measurable here, and so unverified:** Vercel cold starts, a real phone on a real Indian
network, and field (RUM) data — see §5.

---

## 2. Screens and navigation paths (from the code, not assumed)

| Surface | Route | Screens (how they switch) | Data on arrival | Data on navigation inside |
|---|---|---|---|---|
| Owner console | `/owner` | 15 sections: Dashboard, Day setup, Live orders, Waitlist, Payments, Menu, Printers, Staff, Tips, Income & expenses, Reports, Uplift, Settings, Audit log (client state, no URL change) | Server-rendered: identity (2 calls) + `buildOwnerPayload` (≈28 calls, 274 KB JSON on the rig) | **No request** for 11 sections (all in the payload). Reports and Income & expenses call `/api/owner/report`; Uplift calls `/api/owner/heard`; the loved-dishes card calls `/api/owner/favourites` |
| Captain / staff | `/staff` | Tables, Ready / To serve, KOTs, Clear, Requests, Me, a table, the menu (client state) | Server-rendered: identity + `buildStaffPayload` (≈13 calls, 21 KB) | No request |
| Guest | `/t/<table>` | Welcome, menu, cart, placed, status, upsell, tip, paying (client state) | Server-rendered: `buildGuestPayload` (≈10 calls) | No request; writes answer with the new screen |
| Entrance queue | `/q` | one screen | small | `/api/guest/queue` |
| Sign-in | `/owner`, `/staff` with no session | PIN keypad → `POST /api/staff/session` → `router.refresh()` (a second, server-rendered request) | `verify_staff_pin` (bcrypt per PIN holder) | — |
| Live updates | every surface | `useLiveData`: owner 8 s, staff 6 s, guest 6 s; `?since=<stamp>` → `{unchanged}` (1–3 calls) or a full rebuild | | |

**Not present:** an attendance screen, a separate kitchen display (KOTs are a captain tab and the owner's Live
orders), client-side routing between surfaces (moving owner ↔ staff is a full page load, by design: separate
sessions).

### The request path, traced

```
tap ─▶ (client state switch: 0 requests)                                    ← most navigation
tap ─▶ fetch /api/… ─▶ route handler ─▶ currentStaff (2 calls) ┐
                                          floor stamp (1 call) ┴─ round 1 ─▶ build screen (13–30 calls) ─ round 2
                                          │                                     │
                                          └ supabase-js ─▶ Supabase gateway ─▶ PostgREST ─▶ Postgres (≈1–3 ms)
                                                              ▲ the queue: a call alone 41–53 ms, in a burst 402 ms
◀─ JSON (owner: 274 KB raw, 35 KB gzip) ◀─ JSON.parse ─▶ React render (Menu section on a 4× slower CPU: ≈0.9 s)
```

---

## 3. Findings

| ID | Severity | Status | Finding |
|---|---|---|---|
| N-01 | **High** | **Fixed** (keypads) | Screens are visible ≈1 s before they work on a slow phone; taps in the gap are lost; a lost PIN digit = sign-in never sent |
| N-02 | Medium | **Fixed** | Owner and staff screens served without their stamp: the first poll rebuilds them |
| N-03 | Medium | **Fixed** (app side) | Zero-row `UPDATE`s move the floor counter (statement-level triggers); the stale-print sweep did it every minute |
| N-04 | Low | **Fixed** | The sign-in audit record was awaited between a correct PIN and the screen |
| N-05 | High | Open — design | Each screen rebuild is 13–30 parallel calls that queue at Supabase: ≈10× per-call cost in a burst; shared by every user |
| N-06 | Medium | Open — security decision | The sign-in throttle is one counter per server process for the whole restaurant |
| N-07 | Medium | Open | The Menu section takes 0.9 s (p50) to render on a slow phone with no request at all |
| N-08 | Low | Open | `verify_staff_pin` costs one bcrypt per PIN holder: 286 ms mean in production, 580 ms for a wrong PIN on the rig |
| N-09 | Low | Open — growth | The owner payload ships every bill paid today with every dish (≈2.5 KB each), on every rebuild |
| N-10 | Info | Ruled out | Lost PIN digits from fast taps after hydration (React 19 commits each tap before the next) |
| N-11 | Info | Not confirmed in production | The 2 s read deadline failing a rebuild under load — no call over 1.5 s in production on 24-Oct; none failed on the rig under 26 screens |

### N-01 — Visible before it works · High · Confirmed · Fixed for both PIN keypads

- **Reproduction:** `node scripts/perf/hydration.mjs india4g 10` — the in-page time from the element's first
  paint to React attaching to it.
- **Measured (rig, production build, India 4G model):** `/owner` keypad 905 ms p50 / 1,112 ms p95, `/staff`
  keypad 846 / 1,019, guest `/t/A3` 1,003 / 1,283. Without client throttling: 120–205 ms.
- **Consequence measured:** India 4G sign-in journeys (n=20 each). Unchanged build, same data as the after-run:
  owner **10/20 never opened**, captain **10/20** (an earlier run: 8/20 and 4/20). Traced one by one: in every
  failure `POST /api/staff/session` was never sent — the keypad held fewer than four digits. Hypothesis "fast
  taps lose digits after hydration" was tested at 50/80/120 ms between taps and **ruled out** (N-10): the loss
  happens only before hydration. Deterministic probe (`pretaps.mjs`, scripts held back while four digits are
  tapped): before, the keys look ready and keep 0 digits (5/5); after, they look unavailable (opacity 0.45) and
  keep 0 digits (5/5).
- **Root cause:** the keypad's buttons are painted by the server's HTML and have no handler until the page's
  JavaScript has downloaded, parsed and hydrated; the browser accepts the tap and nothing receives it.
- **Why the dead time itself is not cut here:** `/staff` (222 KB of JS) is dead almost as long as `/owner`
  (294 KB) — 846 vs 905 ms — so splitting the console's code off the sign-in page would save ≈60 ms. The bulk is
  framework start-up on a slow CPU plus round trips. Buffering taps before hydration needs an inline script,
  which the planned script CSP (audit SEC-11) would block.
- **Fix:** `useInteractive()` (false in the server's HTML, true once React is attached; no effect, no extra
  render). Both keypads are marked `aria-disabled` — dimmed like their designed disabled state, still focusable —
  until it is true. (First built with `disabled`; the gate's keyboard-parity spec showed that a key focused before the
  page was ready lost its focus, so it became `aria-disabled` — see the tests doc.) A tap in
  the gap is still not taken; what changes is that the person can SEE that, and types once the keys light up.
  **After: 60/60 owner and 60/60 captain sign-ins opened** on India 4G (three runs on the same data; the last
  with the shipped `aria-disabled` keypad: 20/20 and 20/20).
- **Not fixed:** other controls (guest menu, owner sections) have the same gap; a lost tap there is visible
  (nothing happens, the person taps again) rather than a never-ending wait. Listed in the plan.

### N-02 — Served without a stamp · Medium · Confirmed · Fixed

- **Evidence:** `useLiveData` starts with no stamp, so its first tick is always a full read. Production trace
  26-Oct 05:33 UTC: owner page render at :24 (28 calls), first poll at :34–35 (30 calls), again at :42.
  Rig (`idle.mjs`): owner first poll 27–30 calls / ≈600 ms of database time; captain 14 / ≈350 ms; guest 8 / ≈230.
- **Root cause:** the pages built the screen without reading the floor counter, and `useLiveData`'s URL effect
  also cleared any stamp on mount.
- **Fix:** both pages read `floorStamp()` in the same `Promise.all` as `currentStaff()` (no extra round — both
  precede the build, as the change-stamp rule requires) and pass `staffStamp(floor, staff)`; `useLiveData` takes
  `initialStamp` and forgets a stamp only on a *change* of URL.
- **Guest page not changed, deliberately:** its first scan creates the phone's session, which is part of the
  guest stamp, so a served stamp would differ from the next one anyway; and reading it before the build would
  be an extra serial round on the scan.

### N-03 — Empty writes move the counters · Medium · Confirmed · Fixed in the app; root cause open

- **Evidence:** rig: `update print_job set status = status where false` → floor 1652 → 1653. Production 24-Oct:
  52 `PATCH print_job … status=eq.processing&claimed_at=lt.…` (the stale-claim sweep), each matching nothing.
- **Root cause:** `bump_change_version` triggers are `for each statement`, which fire for a statement that
  changed no row.
- **Fix (app):** `sweepStaleClaims` reads first and updates only when something is stale; the update keeps its own
  conditions, so a claim resolving in between is not touched.
- **Root-cause fix (open, needs approval):** a migration making the triggers fire only when rows changed
  (transition tables, one trigger per event: ≈69 triggers). Any other no-op write on a watched table still
  bumps today.

### N-04 — Sign-in waited for its own audit record · Low · Confirmed · Fixed

- **Evidence:** production trace 05:33:23 — `verify_staff_pin` 483 ms, then `audit_entry` 115 ms, both before the
  answer. Rig: one serial call (≈40 ms + queue).
- **Fix:** `after()` writes the record once the answer is sent; it is still written, and still never fails a
  sign-in. Trade-off recorded: `audit_entry` moves the floor counter, so a record landing after the console read
  its stamp makes the first tick rebuild once (correct, only slower).

### N-05 — Fan-out queues · High · Confirmed · Open

- **Production, 24-Oct, 5,986 calls (bridge heartbeats excluded):**

  | Calls in the same second | Calls | p50 | p95 | p99 |
  |---|---|---|---|---|
  | 1 | 77 | 53 ms | 370 ms | 578 ms |
  | 2–3 | 1,055 | 41 ms | 153 ms | 249 ms |
  | 7–12 | 342 | 87 ms | 373 ms | 529 ms |
  | 13–20 | 511 | 143 ms | 435 ms | 550 ms |
  | **21+** | **3,819** | **402 ms** | **631 ms** | **876 ms** |

  Per rebuild (bursts of 10+ calls, n=190): **558 ms p50, 773 ms p95, 1,009 ms p99**, max 1,421 ms. Postgres
  executes the same statements in 1–3 ms (`pg_stat_statements`).
- **Under load (rig, 1 owner + 5 captains + 20 guests, a round every 10 s, 90 s):** guest full read 1,089 ms p50 /
  2,933 ms p95; captain full read 416 / 1,340; captain action 934 / 1,388; owner full read 807 / 1,201.
- **Root cause:** each screen is assembled from 13–30 independent PostgREST requests; at this project's size
  they are served nearly one at a time. Round 1 (24-Sep) measured *rounds* on a rig that charged a flat 100 ms
  per call regardless of concurrency, so a 28-call burst looked like 100 ms; it costs ≈560 ms.
- **Why not fixed here:** fewer calls per screen means either merging reads across query functions or one SQL
  function per screen returning its JSON — a design change to the data layer, and a compute upgrade is a paid
  change. Plan items P-1 to P-3.

### N-06 — Shared sign-in throttle · Medium · Confirmed · Open

- `src/app/api/staff/session/route.ts`: one in-memory array, 10 per 60 s, per process, for everyone. The rig hit
  it at 11 sign-ins a minute and every further sign-in waited out a 30 s timeout. A shift change with ten people
  signing in inside a minute locks the eleventh out for up to a minute. Same finding as audit SEC-03; the fix is a
  security decision (per-device/per-address limits).

### N-07 — Menu section render · Medium · Measured · Open

- Dashboard → Menu: **875 ms p50, 1,119 ms p95** on the India 4G model (176 / 219 ms without throttling), with no
  request — React rendering 57 dishes with their controls on a 4× slower CPU. Other client-only sections:
  244–422 ms p50.

### N-08 — Sign-in cost · Low · Measured · Open

- Production `verify_staff_pin`: 122 calls, 286 ms mean, 630 ms max (audit PERF-01). Rig: a correct PIN 68–202 ms
  depending on its row's position, a wrong one 580 ms (10 PIN holders; production has 7). It is part of every
  sign-in, not of navigation once signed in.

### N-09 — The owner payload grows all day · Low · Measured · Open (growth)

- Rig, 40 bills paid: 274 KB raw / 35 KB gzip; `closedToday` 99 KB (≈2.5 KB per bill, every dish of every
  round). Production has had 1 paid bill in 14 days, so this is not today's cause; a real 150-bill evening would
  ship ≈375 KB of `closedToday` on every owner rebuild.

### Verified unchanged

- **Paging (audit PERF-02):** reports read ≤1,000 rows per request; at today's data size every report read is
  still one request (Reports: 7 calls, ≈200 ms of database time, unchanged).
- **The 2 s read deadline (N-11):** no production call over 1.5 s on 24-Oct; no failure on the rig under 26 screens.

---

## 4. Ranked by measured cost

| Rank | Cause | Time it costs a person | Status |
|---|---|---|---|
| 1 | N-01 lost taps before hydration | open-ended on the keypad (until noticed); ≈1 s of dead screen on every slow-phone load | fixed (keypads) |
| 2 | N-06 shared sign-in throttle | up to 60 s, at shift change | open (security) |
| 3 | N-05 fan-out queue | 0.56–0.8 s per rebuild; 1.3–2.9 s at p95 under load | open (design) |
| 4 | N-02/N-03 rebuilds for nothing | each one is a whole N-05 burst in front of everyone else | fixed |
| 5 | N-07 Menu render | 0.9–1.1 s on a slow phone | open |
| 6 | N-08 bcrypt sign-in | 0.07–0.6 s per sign-in | open |
| 7 | N-04 audit before answer | one queued call per sign-in | fixed |

---

## 5. Limitations

- **No real phone in India.** The India 4G profile is a Chrome DevTools model (150 ms RTT, 9/1.5 Mbps, CPU 4×);
  real networks add variance and loss. **No field data (RUM) exists.**
- **Vercel cold starts are not reproduced.** Production shows the first call on a fresh instance (restaurant
  lookup) at 408 ms; the function start itself is invisible to Supabase's logs.
- **The rig's queue is a model**, calibrated on production (single call 54 ms vs 41–53; 28-call burst 605–625 ms
  vs 558 p50 / 773 p95). Supabase's compute size was not readable through the tools available.
- **Production traffic is testing traffic:** 1 paid bill in 14 days.
