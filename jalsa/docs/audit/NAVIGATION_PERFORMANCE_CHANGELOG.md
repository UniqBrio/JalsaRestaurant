# Navigation performance — changelog

> 26-Oct-2026 · Part of the [navigation audit](NAVIGATION_PERFORMANCE_AUDIT.md). Branch `claude/awesome-cannon-pkg2qg`,
> stacked on the unmerged security audit. **No migration, no configuration, no dependency, no copy change.**
> Before/after evidence: [baseline](NAVIGATION_PERFORMANCE_BASELINE.md).

## Application code

| Finding | File | Change |
|---|---|---|
| N-01 | `src/hooks/useInteractive.ts` (new) | `useInteractive()`: `useSyncExternalStore` with server snapshot `false`, client `true` — false in the server's HTML and during hydration, true once React is attached |
| N-01 | `src/features/staff/PinSignIn.tsx` | Keypad buttons `aria-disabled` until interactive, with `aria-disabled:opacity-45` (the designed disabled look); `disabled={busy}` unchanged. Not `disabled`: it cannot take focus (keyboard-parity spec) |
| N-01 | `src/features/staff/ChoosePin.tsx` | Same, on the choose-your-own-PIN keypad |
| N-02 | `src/app/owner/page.tsx`, `src/app/staff/page.tsx` | `Promise.all([currentStaff(surface), floorStamp()])` — the floor counter read in the identity round, before the build — and `initialStamp={staffStamp(floor, staff)}` passed to the app |
| N-02 | `src/features/owner/OwnerConsole.tsx`, `src/features/staff/StaffApp.tsx` | Accept `initialStamp`, pass it to `useLiveData` |
| N-02 | `src/hooks/useLiveData.ts` | `LiveOptions.initialStamp`; the check starts from it (and the 60 s clock from mount); a stamp is forgotten on a CHANGE of URL, no longer on the first render |
| N-02 | `src/hooks/change-check.ts` | `newCheck(fullEveryMs, first?)` |
| N-03 | `src/lib/db/bridge-mutations.ts` | `sweepStaleClaims` reads (`select id … limit 1`) before it updates; returns `{ expired: 0 }` without writing when nothing is stale. The update keeps its own conditions |
| N-04 | `src/app/api/staff/session/route.ts` | The "Signed in" audit record is written in `after()`; still best-effort, still never fails a sign-in |

## Tests

| File | What |
|---|---|
| `tests/unit/navigation-latency.unit.spec.ts` (new) | N-01 (SSR renders the control `aria-disabled`; both keypads gated, still focusable), N-02 (`newCheck`, pages, apps, hook), N-03 (executed on the round rig), N-04 |
| `tests/render/navigation-latency.render.spec.ts` (new) + `tests/render/mounts/live-data.entry.tsx` (new) | The real `useLiveData` in Chromium: served stamp → first poll asks; no stamp → one full read; echo → next poll full |
| `tests/support/rounds/sweep.scenarios.ts` (new) | The real `sweepStaleClaims` against fake-supabase |

## Measurement rig (new, `scripts/perf/`)

`bootstrap.sql`, `gateway.mjs`, `rig.env`, `seed-service.mjs`, `journeys.mjs`, `hydration.mjs`, `pretaps.mjs`,
`idle.mjs`, `concurrency.mjs`, `suite.sh` — see [tests §2](NAVIGATION_PERFORMANCE_TESTS.md). Not part of the
application or the gate; nothing in `src/` imports them.

## Documentation and registers

| File | Change |
|---|---|
| `requests/2026-10-26-navigation-latency.md` (new) | The binding request record (BUG, correction round 2) |
| `docs/audit/NAVIGATION_*.md` (new, 5 files) | The deliverables |
| `docs/registers/CANONICAL_PATTERNS.md` | JP-25: `useInteractive` for a control that must not lose a pre-hydration tap |
| `README.md` | Where the audits and the rig live |
| `CHANGELOG.md` | "Faster — 26-Oct-2026" |
| `TEST_SUMMARY.md` | Fail-first evidence; the gate run |

## Root causes fixed, and what remains

| | Fixed | Remains (plan) |
|---|---|---|
| Taps lost before hydration | On both PIN keypads | Every other control (P-8); the dead time itself (≈0.8–1.0 s on a slow phone) |
| Rebuilds for nothing | The served screen's first poll (owner, staff); the sweep's empty update | Other empty writes (P-4, migration); the poll after a write echo (rejected — costs every action a round) |
| Queue cost per rebuild | — | P-1/P-2/P-3 |
| Shared sign-in throttle | — | P-5 (security decision) |
