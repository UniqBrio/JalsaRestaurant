# Navigation optimisation plan — Jalsa

> 26-Oct-2026 · Part of the [navigation audit](NAVIGATION_PERFORMANCE_AUDIT.md). Ordered by measured user impact.
> Every item names how it will be verified: the rig in `scripts/perf/` measures before and after on the same
> data (`suite.sh <build> <label> <out> <snapshot>`).

## Done in this change (branch `claude/awesome-cannon-pkg2qg`, not deployed)

| ID | Change | Expected effect | Risk | Verified by |
|---|---|---|---|---|
| N-01 | `useInteractive()`; both PIN keypads marked `aria-disabled` (dimmed, still focusable) until React is attached | No sign-in silently lost on a slow phone; the keypad looks unavailable for ≈1 s instead | A keypad stuck unavailable if hydration failed — the page would be broken anyway; functional sign-in specs tap the real keypad | journeys `owner-signin` / `staff-signin` errors on India 4G; `hydration.mjs`; unit + functional rungs |
| N-02 | Owner and staff pages serve their change stamp | One full rebuild fewer after every page load, sign-in and reload (owner ≈30 calls) | A stamp read after the build would hide a change — it is read in the same round as the identity check, before the build | `idle.mjs` full reads; render rung on the real `useLiveData` |
| N-03 | Stale-print sweep reads before it writes | No once-a-minute rebuild of every console and captain phone | A stale claim missed between the read and the write is picked up next minute; the update keeps its conditions | executed round-rig rung; `idle.mjs` |
| N-04 | Sign-in audit record written with `after()` | One queued call less between PIN and screen | If the function were killed before `after` runs, a sign-in record would be lost; Vercel keeps it alive (`waitUntil`) | journeys `*-signin` dbCalls; unit rung |

No migration, no configuration, no dependency. **Deploying is the approval point.**

## Next — needs a decision

| ID | Problem (measured) | Proposal | Expected effect | Dependencies / risk | Verification |
|---|---|---|---|---|---|
| **P-1** (N-05) | An owner rebuild is ≈30 calls; in a burst each costs ≈400 ms instead of ≈45 ms | **One SQL function per screen** (`owner_screen(restaurant)`, `staff_screen(...)`, `guest_screen(...)`) returning the payload's rows as JSON in ONE call; TypeScript keeps the shaping | Owner rebuild ≈560–680 ms → one call ≈60–120 ms (estimate: the same reads run inside Postgres in 1–3 ms each). Under load, the shared queue drains ≈10× faster | A migration per screen (service_role only, like every privileged function); the payload builders move their reads, not their logic; must be checked byte-identical against today's payloads (the 24-Sep method) | rig `suite.sh`; payload equality on the snapshot |
| **P-2** (N-05) | — cheaper, partial | Merge duplicate reads inside the owner build: `bridge_token` ×2, `print_job` ×3–4, `staff`/`staff_permission` ×3 | ≈5–8 calls fewer per owner rebuild (≈100–160 ms at 20 ms each) | Touches 5–6 query functions used elsewhere | rig calls per rebuild |
| **P-3** (N-05) | — infrastructure | Check the Supabase compute size (Dashboard → Settings → Compute) — the serial behaviour fits a small shared-CPU instance | Unknown until measured; a paid change | Cost; approval | the production burst table in the audit, re-read after |
| **P-4** (N-03 root) | Statement-level counter triggers fire on empty writes | Migration: bump only when rows changed (transition tables; one trigger per event) | Ends every remaining no-op rebuild | ≈69 triggers rewritten; a production schema change | PGlite spec: an empty `UPDATE` leaves every counter alone; rig `idle.mjs` |
| **P-5** (N-06) | Sign-in throttle is one counter per process for everyone | Per-device / per-address limits in a small table (audit SEC-03), with a global ceiling | Shift-change lock-outs end; brute force stays bounded | Security decision; a migration | rig: 12 people signing in within a minute all succeed |
| **P-6** (N-09) | `closedToday` ships every dish of every bill paid today on every owner rebuild | Send the day's paid bills as summary rows; read a bill's rounds when it is opened | Owner payload stops growing with the day | Payments / bill detail read on demand (a request on open) | payload size on a 150-bill snapshot |
| **P-7** (N-07) | Menu section 0.9 s render on a slow phone | Render the dish list in pages or virtualise it; memoise rows | ≈0.9 s → ≈0.3 s (estimate) | UI code only | journeys `owner-nav-menu` India 4G |
| **P-8** (N-01, rest) | Other controls are dead for ≈1 s after a slow load | Apply `useInteractive` to the guest's first actions (Start ordering, add to cart); consider a smaller first bundle | Taps visibly not taken rather than lost | Copy: none needed (disabled look) | `hydration.mjs`; a guest journey that taps immediately |
| **P-9** | No field data | Real-user timing: Next's `useReportWebVitals` + a beacon to the app's own route (no third party) | LCP/INP/CLS at p75 from real phones; cold starts visible | A small route and a table; privacy: no personal data | dashboards |

## Considered and rejected

- **Stamping action responses** so the poll after a write is quiet: the stamp must be read after the write and
  before the screen is built, which adds a serial round (≈40 ms) to every action a person is waiting on, to save
  background work. Wrong trade for a latency task.
- **Supabase Realtime instead of polling:** the browser would speak to Supabase directly — binding guardrail 3.
- **Caching the owner payload:** it is per person (grants) and changes every few seconds in service; the stamp
  already answers "unchanged" with 1–3 calls. Nothing to cache safely that the stamp does not already cover.
- **Splitting the console's code off the sign-in page:** measured ≈60 ms of the ≈900 ms dead time.
- **Buffering keypad taps before hydration:** needs an inline script the planned script CSP would block.

## Verification strategy for every item

1. Restore the rig snapshot; build before and after with `scripts/perf/rig.env`.
2. `scripts/perf/suite.sh` for each build — journeys (n=20, local + India 4G), hydration gap, idle cost, load.
3. Compare p50/p95 on identical data; a change ships only with its before/after row.
4. Correctness: the payloads before and after compared byte for byte (ids and clock times normalised).
5. Production after deploy: the edge-log burst table (audit §N-05) re-read for the same weekday.
