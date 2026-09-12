# Test summary

_Newest run first. **Append-only: never overwrite a prior run.**_
_`## Gate run` blocks are written by `scripts/gate-runner.mjs`; guard G2 greps for them._

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (fourth) - the stale banner, and freeing a table

FAIL-FIRST: jalsa/tests/unit/stale-notice.unit.spec.ts - run against the pre-change rule, modelled
exactly (the FIRST failed poll set `staleReason` from `handleError`'s generic fallback).
**2 failed**:
  - "one failed read says nothing" - `expected null, received "Something went wrong. Please try
    again."` That is the reported defect in one line: the screen was correct, the order was safe,
    and the application raised an alarm about neither.
  - "what it does say is the restaurant's sentence, not the runtime's" - the taxonomy fallback,
    which names nothing and asks a guest to retry something they did not do.

NOT OBSERVED FAILING: "a success resets the count" - the counter did not exist to reset, so there
was no pre-change behaviour to run it against. Asserted because the threshold is worthless if a
run of blips separated by successes ever accumulates into an alarm.

FAIL-FIRST: jalsa/tests/unit/free-a-table.unit.spec.ts - run against the pre-change tree (the Tables
permission group ended at `tables.transfer`; no floor view carried any notion of a releasable
table). **2 failed of 3**:
  - "there is a permission for freeing a table by hand" - `expected [..] to contain
    "tables.free"`. There was no such key, which is the whole of "there is no way we can free the
    table".
  - "a table held by an empty bill can be released" - `expected true, received false`.

NOT OBSERVED FAILING: "a table with food in the kitchen cannot be freed". It PASSED against the
pre-change rule, because that rule was `false` for every table — nothing could be freed, so
nothing unsafe could be freed either. Recorded honestly, and it is the assertion that matters most
in the file: it is the only thing between a tile on a floor grid and writing off a bill, and the
fix that made the other two pass is exactly the fix that could have broken it.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (third) - adding an item was never immediate

FAIL-FIRST: jalsa/tests/unit/cart-draft.unit.spec.ts - run against the pre-change tree's own
rules, modelled exactly (a row's quantity was `item.inCart` and nothing else, no overlay existed,
and `runBusy` opened with `if (busy) return`). **3 failed**:
  - "a tap shows on the row before the server has confirmed it" - `expected 2, received 0`. The
    number under the guest's thumb was the last thing on the screen to move.
  - "the bar appears on the first add, not a round trip later" - `expected 1, received 0`. The
    Review order bar is gated on the count, so the first add left the screen looking inert.
  - "a second tap during a write is never silently dropped" - `expected "ran", received
    "dropped"`. This is the half that made it look erratic rather than merely slow.

NOT OBSERVED FAILING: jalsa/tests/functional/guest-total-visibility.functional.spec.ts, the
appended rung "a tap lands on the row at once, and a run of taps all count" - it cannot execute
here (no database egress; curl to the project REST endpoint returns 000). Its timeouts are
deliberately tight (400ms) so that it could not pass on the old write-then-wait behaviour, and
its last assertion covers the risk this fix INTRODUCES: the 200ms collapse window means the
screen can be ahead of the stored cart, and Send reads the stored cart, so a tap made just
before Send must still be in the round. First execution is the next CI run.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (second batch) - closure path, tip, dashboard, discount

Repeated from `jalsa/TEST_SUMMARY.md` because this is the ledger the pre-commit guard at this
repository root reads.

FAIL-FIRST: jalsa/tests/unit/write-echo.unit.spec.ts - against the pre-change rules (`send`
posting then calling `refreshNow()` unconditionally; four fixed tip presets; the upsell screen
navigating away on the first add). **3 failed**: `expected ["POST"], received ["POST","GET"]`;
`expected "upsell", received "tip"`; `expected true, received false`.

FAIL-FIRST: jalsa/tests/unit/discount-mirror.unit.spec.ts - against the pre-change rules (two
independent boxes; preview = the sum of both). **3 failed**: `expected {pct:"10",flat:"166"},
received {pct:"",flat:""}`; the same the other way round; and `expected 166, received 332` — the
double-discount that is the reason one of the two boxes had to become a readout.

FAIL-FIRST: jalsa/tests/functional/closure-upsell-tip.functional.spec.ts - the database is
unreachable on this container (curl to the project's REST endpoint returns 000) and the first
assertion fails with `unreachable-guest`. The file goes RED rather than silent.

NOT OBSERVED FAILING: jalsa/tests/functional/closure-upsell-tip.functional.spec.ts (every
behavioural assertion) - not executable here at all; the first CI run is their first execution.

NOT OBSERVED FAILING: the owner Dashboard move - placement only, no rung added, recorded rather
than left silent.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 - the guest's order total, the footer, the categories

Two new specs in the app (`jalsa/`). The app's own ledger, `jalsa/TEST_SUMMARY.md`, carries the
same entries alongside the gate run they belong to; they are repeated here because this is the
ledger the pre-commit guard at this repository root reads.

FAIL-FIRST: jalsa/tests/unit/guest-features.unit.spec.ts - run against the PRE-change tree's
own rules, modelled exactly (the owner panel's `checked={values[key] !== false}` and a
DEFAULT_FEATURES literal with no `orderTotal` in it). **3 failed**:
  - "an unsaved feature resolves to its own default, not to 'on'" - expected false, received
    true. The panel drew every unsaved key as ON, unconditionally.
  - "the owner switch and the guest phone agree about an unsaved feature" - expected false,
    received true. The switch said the guest could see their total while the phone showed none.
    That disagreement across the server boundary is what the shared module exists to prevent.
  - "the order total is off until someone turns it on" - expected false, received undefined.
    There was no such default to read.

FAIL-FIRST: jalsa/tests/functional/guest-total-visibility.functional.spec.ts - on this build
container, where the database is unreachable (curl to the project's REST endpoint returns 000),
the first assertion fails with `unreachable-guest` rendered instead of the welcome screen. The
file goes RED rather than silent where it cannot run, which is the property that matters for a
spec whose real execution is in CI.

NOT OBSERVED FAILING: jalsa/tests/functional/guest-total-visibility.functional.spec.ts (every
behavioural assertion - default hidden, tick reveals, choice survives navigation, nothing under
the bar, every category reachable in one tap, the thumbnail holds its space) - they cannot be
executed here at all, for the reason above. The first CI run against the test project is their
first execution, and its log is the evidence to record in the change that proves it green. Two
of them are known red on the pre-change tree by inspection of the diff - there was no
`guest-menu-total-toggle` element to find, and the bar overlapped its own totals card - but
inspection is a weaker claim than a recorded run, which is why it is written here as one.

---

## Test project seeded and the reset interlocks proven - 2026-09-11

Supabase project uxmyomxtosjlkvjxnvpy (JalsaRestaurant-test, ap-southeast-2) created on the
user's free-tier confirmation ($0/month, second of two free projects) and seeded with the four
migrations verbatim. Verified by SQL: restaurant 1, tables 20 (A5 active), menu items 57,
staff 27 (10 with PIN, all provisional), permission rows 278, settings 11, tip options
[0,10,20,30], counters bill 1041 / kot 105 / group 7, bills 0, sessions 0.

FAIL-FIRST: jalsa/scripts/reset-test-db.mjs - all four interlocks observed refusing with exit 2
BEFORE any network call: APP_ENV=development -> `APP_ENV is "development", not "test"`;
RESET_TEST_DB=no -> `RESET_TEST_DB is not "yes"`; the development/production ref
yxgxmbyilpivbmeemqkp -> `is the development/production project. This script must never touch
it`; empty SUPABASE_SECRET_KEY -> refused. With all four satisfied for the TEST ref it got past
every interlock and failed only at `deleting bill: TypeError: fetch failed` - this container's
egress policy - which is the proof the deny-list ALLOWS the test project.

Spec correction before first run: the seed's first tip option is 0, so "click the first chip"
would have chosen a zero tip that addTip drops; the spec now chooses guest-tip-20 and asserts
tipChosen === 20. Found by reading the seed, not by a run - recorded so the first CI run is not
credited with a defect the fixture already revealed.

## Guest journey spec - 2026-09-11 - written, not yet executed against data

Runs ONLY against a dedicated test project, reset to its seed first by
jalsa/scripts/reset-test-db.mjs (refuses the development/production project by ref, refuses
without APP_ENV=test and RESET_TEST_DB=yes). Issue #3, row 1.

FAIL-FIRST: jalsa/tests/functional/guest-journey.functional.spec.ts - run first on the build
container, where the database is unreachable: the first assertion (`guest-welcome` visible)
fails with `unreachable-guest` rendered instead. Proves the file goes red, not silent, where it
cannot run.

NOT OBSERVED FAILING: jalsa/tests/functional/guest-journey.functional.spec.ts (every data
assertion - round present in state, status payment_requested, tip recorded, second phone joins
the same bill) - they cannot be executed on the build container at all. The first CI run against
the test project is their first execution; its log is the evidence to record here in the same
change that proves it green. Until then this file has never been seen passing.


---

## Close-out - KL-1 - 2026-09-11 - run 34577750747 on claude/close-kl1-kl3 @ 5e49d73

304 passed, 0 skipped, 0 failed. `reachability.functional.spec.ts` green on all six functional
projects; zero unreachable/unseeded errors from the configured instance. KL-1 CLOSED on this run.
The residual - the data journeys still have no specs - is a coverage gap, recorded as such.

---

## Close-out - KL-1 and KL-3 - 2026-09-11

KL-3 closed on CI run 34575687627 (298 passed, 0 skipped, `[tablet]` and `[mobile-ios]` present,
zero `SKIPPED:` lines). KL-1 could NOT be closed on the same run: `grep supabase.co` on its log
matches zero lines - nothing in the suite touched the database. The rung below is what makes the
claim true; KL-1 closes on the first green run that includes it.

FAIL-FIRST: jalsa/tests/functional/reachability.functional.spec.ts - run first on the build
container, where egress to *.supabase.co is refused by policy: `expect(locator).toBeVisible()
failed - Locator: getByTestId('guest-unknown-table') - element(s) not found` after the 8s wait;
the page rendered `unreachable-guest` instead. That is the pre-fix state of KL-1 observed by the
assertion written to close it. The file must go red, never skip, wherever the database cannot be
reached; it is expected green only in CI.


---

## Review run - Track R - 2026-09-11 - VERDICT: PASS

Post-generation review of the generated Jalsa application. Framework `audit:all` 10/10,
`guard:test` 10/10 (89 assertions, 6 new), fixtures green -> green, app gate PASS 11/11.

FAIL-FIRST: jalsa/tests/unit/refresh-gate.unit.spec.ts - "a refresh a person caused is never
dropped" was written against the behaviour `useLiveData` actually shipped with: a single
`inFlight` boolean and an unconditional `if (inFlight.current) return;`. Modelled exactly, it
fails - `begin(g)` true, `begin(g, true)` false, `end(g)` **false** where true is required, so
nothing ever re-runs the read. `expected true, received false`. That is a captain's round sent,
the screen refused its own confirmation for up to six seconds, and the obvious human response
being to press Send again. Fixed by src/hooks/refresh-gate.ts; the same run turned green.

NOT OBSERVED FAILING: jalsa/tests/unit/refresh-gate.unit.spec.ts ("a scheduled poll is dropped
freely") - it is the behaviour the old code already had. It is asserted so the fix above cannot
be implemented by making every refresh queue, which would rebuild the request pile-up the drop
existed to prevent.

FAIL-FIRST: scripts/audit-scope.test.sh - all six cases failed against the pre-scope audits,
which printed the OK line and nothing else. The load-bearing one is "the scope travels WITH the
verdict, whatever the verdict is": it was observed failing a second time mid-run, when adding
the test file itself turned the dead-weight audit BLOCKED and the assertion was still pinned to
the OK line. Both the audit (it caught its own new unreferenced script) and the test (it was
over-specified) were doing their jobs; the assertion is now verdict-agnostic.

FAILFIRST-NA: framework-upstream/** - every spec under this path is a READ-ONLY SNAPSHOT of
UniqBrio/custom-web-app-development-framework v1.35.0 (commit 4cdc7b4), copied verbatim so this
review could read the current canonical runbooks rather than this repository's v1.29.0 copy.
Nothing under that directory is executed, maintained, or authoritative here, and re-deriving
fail-first evidence for sixteen upstream specs would mean injecting sixteen defects into code
this repository did not write and does not run. See framework-upstream/README-SNAPSHOT.md.

> Guard G3 reads only the ROOT `TEST_SUMMARY.md`, so `jalsa/`'s own evidence is invisible to it
> and has to be summarised here as well. That is CAND-002 in `docs/registers/CANDIDATES.md`,
> parked at n=1 - and this run is its second sighting. It is now at n=2 and eligible for
> promotion through `workflows/promote.md`.


---

## Application run - jalsa - 2026-09-10 - VERDICT: PASS

Gate 11/11, 0 blocked. 252 assertions across three tiers, 8/8 audits clean.

**The full record for this run lives in `jalsa/TEST_SUMMARY.md`**, which is the append-only gate
log for that application. This block exists because guard G3 reads only the root file, and an
application in a subdirectory is a layout the guard does not yet understand - recorded as
CAND-002 rather than escaped with a token.

FAIL-FIRST: jalsa/tests/functional/signin.functional.spec.ts - "submits exactly once" failed on
its first run against shipped code: `expected 1, received 2`. PinSignIn called submit() inside a
setPin updater and React 19 invokes updaters twice under StrictMode, so every correct PIN made two
sign-in attempts. Fixed.

FAIL-FIRST: jalsa/tests/functional/keyboard-signin.functional.spec.ts - the same defect, found
independently by the keyboard route: `expected 1, received 2`.

FAIL-FIRST: jalsa/tests/functional/degraded.functional.spec.ts - every assertion failed before the
fix. `/t/A5` returned **500**: supabase-js's `TypeError: fetch failed` escaped a server component
and Next.js rendered its own error page in a guest's hand. Fixed with `attempt()` and
`UnreachableState`.

FAIL-FIRST: jalsa/tests/render/jalsa-surfaces.render.spec.ts - two dark-theme targets failed at
2.40:1, reporting colours in neither palette, because the theme was applied after navigation and
`transition-colors` was still running. The measurement was wrong, not the screen.

FAIL-FIRST: jalsa/tests/unit/{money,status,permissions,guest-phase}.unit.spec.ts - four mutations
observed failing; two of them are recorded with their own corrections, where the FIRST attempt did
not reproduce and was therefore not evidence.

NOT OBSERVED FAILING and FAILFIRST-NA entries for every remaining spec in that tree - including
the fifteen inherited from the scaffold, which this change did not write - are enumerated in
`jalsa/TEST_SUMMARY.md`.


> The run below is real — produced while this framework was being verified. It is BLOCKED rather
> than PASS because the build environment had no package registry, so the type, lint and test
> steps could not be obtained. That is the correct verdict: those classes were **not verified**,
> and reporting them as passing would be exactly the green-by-omission this design prevents.
>
> Note that the blocked steps name the reason, and that the four gates needing no dependencies —
> theme sync, contrast, theme assets, and colour literals — all ran and passed.

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 4.3s total - slowest G10 Backward compatibility (fixtures) (3.8s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (76ms)
- **G2 Contrast (all tokens, both themes)** - PASS (71ms)
- **G3 Theme assets present per theme** - PASS (73ms)
- **G4 No hard-coded colours** - PASS (91ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (74ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.8s)
- **G11 Wide tables are configurable** - PASS (73ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Cases added - 2026-09-10 - v1.29.0 (the six design directives)

Four new unit specs, 36 assertions, executed against the **tsc-compiled actual modules** with a
minimal `test`/`expect` harness, because this environment has no package registry and therefore
no Playwright runner. That substitution is stated rather than hidden: the specs are written for
`@playwright/test` and will run under `npm run test:unit` in any environment with dependencies
installed; what was verified here is the **logic**, not the runner.

FAIL-FIRST: starter/tests/unit/pricing.unit.spec.ts - with `payable` summed from the RAW line
values instead of the rounded rows, "THE ROWS SHOWN ADD UP TO THE TOTAL SHOWN" failed: three
rows of 33.34 under a total of 100.01. Fixed: 11 passed.

FAIL-FIRST: starter/tests/unit/loading.unit.spec.ts - with `resolveThresholds` returning the
configured value unordered, "a stalled threshold at or below the slow one is REPAIRED" failed
with `expected > 5000, got 1000` - the state carrying the only way out of the screen was
unreachable. Fixed: 7 passed.

FAIL-FIRST: starter/tests/unit/undo.unit.spec.ts - with `pushToast` returning an empty commit
list for its overflow, "AN OVERFLOWING QUEUE COMMITS THE OLDEST" failed with
`expected ["a"], got []` - a pending archive silently discarded. Fixed: 9 passed.

FAIL-FIRST: starter/tests/unit/selection.unit.spec.ts - with `reconcileSelection` keeping every
id regardless of the view, "a filter change drops what left the view, and SAYS how many" failed
with `expected ["r1","r2"], got ["r1","r2","r9"]` - a bulk action reaching a row the user could
no longer see. Fixed: 9 passed.

FAIL-FIRST: scripts/audits/check-column-control.mjs (gate change, so it carries cases) - the
detector counted `<th scope="row">` as a column, so a correct three-column table with a row
header was reported as four and demanded a column control. Observed BLOCKED on
`starter/src/components/PricingPanel.tsx|4` before the fix. After the fix, executed against
scratch fixtures: a 4-column table with a row header still BLOCKS (exit 2), an unmarked
4-column table still BLOCKS, and the 3-column table with a row header passes (exit 0). The gate
can still fire; it no longer pushes an accessibility regression to make itself green.

NOT OBSERVED FAILING: starter/tests/render/contrast.render.spec.ts (two tab targets added under
DR-3) - it needs a browser and a running application, and this environment has neither. The
token pair it asserts (`primarySurface` / `onPrimarySurface`) IS verified here, in both themes,
by G2.

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 4.1s total - slowest G10 Backward compatibility (fixtures) (3.6s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (74ms)
- **G2 Contrast (all tokens, both themes)** - PASS (67ms)
- **G3 Theme assets present per theme** - PASS (64ms)
- **G4 No hard-coded colours** - PASS (69ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (67ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.6s)
- **G11 Wide tables are configurable** - PASS (77ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

FAIL-FIRST: starter/tests/unit/audit.unit.spec.ts - 19 assertions executed against the
esbuild-compiled actual lib (19/19 pass). Two defects were INJECTED into
starter/src/lib/audit.ts and both were observed failing before revert:

  1. renderActor() returning 'System' for an unresolved actor - the RC-007 defect verbatim.
     Observed: FAIL "an UNRESOLVED actor never becomes System - it renders visibly wrong"
  2. sameValue() comparing arrays POSITIONALLY instead of as sets.
     Observed: FAIL "reordering a role list is NOT a change"

  Injected run: 17 passed, 2 failed. After revert: 19 passed, 0 failed.
  Harness: esbuild-compiled ESM + a minimal test shim, because this repository carries no
  node_modules; the same route v1.17.0/v1.18.0 took for their pure libs.

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.6s total - slowest G10 Backward compatibility (fixtures) (5.8s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (130ms)
- **G2 Contrast (all tokens, both themes)** - PASS (129ms)
- **G3 Theme assets present per theme** - PASS (128ms)
- **G4 No hard-coded colours** - PASS (143ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (159ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.8s)
- **G11 Wide tables are configurable** - PASS (148ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.3s total - slowest G10 Backward compatibility (fixtures) (5.6s).

- **G1 Theme artifacts in sync** - PASS (112ms)
- **G2 Contrast (all tokens, both themes)** - PASS (111ms)
- **G3 Theme assets present per theme** - PASS (108ms)
- **G4 No hard-coded colours** - PASS (116ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (111ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.6s)
- **G11 Wide tables are configurable** - PASS (117ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.2s total - slowest G10 Backward compatibility (fixtures) (5.5s).

- **G1 Theme artifacts in sync** - PASS (109ms)
- **G2 Contrast (all tokens, both themes)** - PASS (107ms)
- **G3 Theme assets present per theme** - PASS (109ms)
- **G4 No hard-coded colours** - PASS (125ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (113ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.5s)
- **G11 Wide tables are configurable** - PASS (113ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.3s total - slowest G10 Backward compatibility (fixtures) (5.5s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (124ms)
- **G2 Contrast (all tokens, both themes)** - PASS (138ms)
- **G3 Theme assets present per theme** - PASS (130ms)
- **G4 No hard-coded colours** - PASS (121ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (122ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.5s)
- **G11 Wide tables are configurable** - PASS (117ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.1s total - slowest G10 Backward compatibility (fixtures) (5.4s).

- **G1 Theme artifacts in sync** - PASS (111ms)
- **G2 Contrast (all tokens, both themes)** - PASS (107ms)
- **G3 Theme assets present per theme** - PASS (108ms)
- **G4 No hard-coded colours** - PASS (117ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (112ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.4s)
- **G11 Wide tables are configurable** - PASS (111ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.3s total - slowest G10 Backward compatibility (fixtures) (5.6s).

- **G1 Theme artifacts in sync** - PASS (109ms)
- **G2 Contrast (all tokens, both themes)** - PASS (109ms)
- **G3 Theme assets present per theme** - PASS (116ms)
- **G4 No hard-coded colours** - PASS (122ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (118ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.6s)
- **G11 Wide tables are configurable** - PASS (116ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.3s total - slowest G10 Backward compatibility (fixtures) (5.5s).

- **G1 Theme artifacts in sync** - PASS (113ms)
- **G2 Contrast (all tokens, both themes)** - PASS (155ms)
- **G3 Theme assets present per theme** - PASS (111ms)
- **G4 No hard-coded colours** - PASS (123ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (115ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.5s)
- **G11 Wide tables are configurable** - PASS (112ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 7.0s total - slowest G10 Backward compatibility (fixtures) (6.3s).

- **G1 Theme artifacts in sync** - PASS (120ms)
- **G2 Contrast (all tokens, both themes)** - PASS (123ms)
- **G3 Theme assets present per theme** - PASS (110ms)
- **G4 No hard-coded colours** - PASS (122ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (130ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.3s)
- **G11 Wide tables are configurable** - PASS (153ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.2s total - slowest G10 Backward compatibility (fixtures) (5.5s).

- **G1 Theme artifacts in sync** - PASS (110ms)
- **G2 Contrast (all tokens, both themes)** - PASS (110ms)
- **G3 Theme assets present per theme** - PASS (107ms)
- **G4 No hard-coded colours** - PASS (122ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (115ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.5s)
- **G11 Wide tables are configurable** - PASS (114ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.1s total - slowest G10 Backward compatibility (fixtures) (5.4s).

- **G1 Theme artifacts in sync** - PASS (110ms)
- **G2 Contrast (all tokens, both themes)** - PASS (109ms)
- **G3 Theme assets present per theme** - PASS (108ms)
- **G4 No hard-coded colours** - PASS (119ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (110ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.4s)
- **G11 Wide tables are configurable** - PASS (118ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.2s total - slowest G10 Backward compatibility (fixtures) (5.5s).

- **G1 Theme artifacts in sync** - PASS (115ms)
- **G2 Contrast (all tokens, both themes)** - PASS (115ms)
- **G3 Theme assets present per theme** - PASS (108ms)
- **G4 No hard-coded colours** - PASS (118ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (112ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.5s)
- **G11 Wide tables are configurable** - PASS (113ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 6.1s total - slowest G10 Backward compatibility (fixtures) (5.4s).

- **G1 Theme artifacts in sync** - PASS (110ms)
- **G2 Contrast (all tokens, both themes)** - PASS (106ms)
- **G3 Theme assets present per theme** - PASS (105ms)
- **G4 No hard-coded colours** - PASS (117ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (113ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.4s)
- **G11 Wide tables are configurable** - PASS (112ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-08 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS
- **G10 Backward compatibility (fixtures)** - PASS
- **G11 Wide tables are configurable** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-04 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS
- **G10 Backward compatibility (fixtures)** - PASS
- **G11 Wide tables are configurable** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-30 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS
- **G10 Backward compatibility (fixtures)** - PASS
- **G11 Wide tables are configurable** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-30 - VERDICT: BLOCKED

Steps: 6 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS
- **G10 Backward compatibility (fixtures)** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-30 - VERDICT: BLOCKED

Steps: 6 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS
- **G10 Backward compatibility (fixtures)** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-28 - EVOLUTION RELEASE (v1.1.0) - VERDICT: PASS (framework-runnable classes)

Change under test: EVOLUTION_PLAN.md implementation - lineage, upgrade, promote, fixtures,
conformance, backward-compat, quadruple close-out.

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: scripts/upgrade.test.sh - injected "review files copied like pristine" into
upgrade.mjs -> 3 cases red ("the app's edit SURVIVED", "incoming copy staged", "incoming copy is
the NEW seed"); injected "dirty-tree check disabled" -> "apply REFUSES a dirty tree" red
(expected 2, got 0). Both injections reverted; suite green (18/18).
FAIL-FIRST: scripts/audits/check-backward-compat.mjs - injected the pre-fix RC-005 behaviour
(adopted-modified not sticky) into lib/lineage.mjs -> "fixture diverged: required PASS, got
FAIL". Reverted; audit green.
FAIL-FIRST (inherent): scripts/conformance.mjs was observed failing on its FIRST run against
the real defects RC-005 and RC-006 - the red output preceded both fixes.

### Execution ledger (framework scope)
| suite | cases | pass | fail |
|---|---|---|---|
| upgrade/lineage (upgrade.test.sh) | 18 | 18 | 0 |
| conformance fixtures | 3 fixtures / 10 checks | 10 | 0 |
| backward-compat | 3 verdicts | 3 | 0 |
| guard reachability + adapter | 19 | 19 | 0 |
| theme/audit gates | 8 | 8 | 0 |

### Registry delta
Framework-level executable cases added: upgrade.test.sh (18), conformance checks (10),
compat audit (3). App-level registry: N/A - framework repo carries executable rungs, per
FRAMEWORK_MANIFEST. RC-005 and RC-006 appended to the root-cause register.

---

## Gate run - 2026-08-28 - VERDICT: BLOCKED

Steps: 5 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-28 - VERDICT: BLOCKED

Steps: 5 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-28 - VERDICT: BLOCKED

Steps: 5 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - toolchain not installed: no local "tsc" under Custom-Web-App-Development-Framework. Run `npm install` (provided by typescript), or state why this class is unverified. Not fetched from the registry on 
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-08-28 - VERDICT: FAIL

Steps: 5 pass, 1 fail, 3 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - FAIL

```
exit 1
```

- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-08-28 - VERDICT: FAIL

Steps: 4 pass, 2 fail, 3 blocked.

- **G1 Theme artifacts in sync** - FAIL

```
BLOCKED: 2 generated theme file(s) are stale or hand-edited.
```

- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - FAIL

```
exit 1
```

- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-08-28 - VERDICT: BLOCKED

Steps: 5 pass, 0 fail, 4 blocked.

- **G1 Theme artifacts in sync** - PASS
- **G2 Contrast (all tokens, both themes)** - PASS
- **G3 Theme assets present per theme** - PASS
- **G4 No hard-coded colours** - PASS
- **G5 Types** - BLOCKED - tooling unavailable - npm error code E403
- **G6 Lint** - BLOCKED - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

