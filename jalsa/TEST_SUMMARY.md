# Test summary

_Newest run first. Append-only: never overwrite a prior run._

---

## FAIL-FIRST EVIDENCE - 2026-09-11 - the guest journey (issue #3, row 1)

FAIL-FIRST: tests/functional/guest-journey.functional.spec.ts - first run on the build
container: `guest-welcome` never appears; `unreachable-guest` renders. Red where it cannot run.

NOT OBSERVED FAILING: tests/functional/guest-journey.functional.spec.ts (all data assertions) -
not executable here. First execution is the first CI run against the dedicated test project,
after `npm run test:reset`. Record that run's log here when it lands.

---

## FAIL-FIRST EVIDENCE - 2026-09-11 - the database reachability rung

FAIL-FIRST: tests/functional/reachability.functional.spec.ts - first run on the build container,
where egress to *.supabase.co is refused by policy: `expect(locator).toBeVisible() failed -
Locator: getByTestId('guest-unknown-table') - element(s) not found` after the 8s wait; the page
rendered `unreachable-guest` instead. That is the pre-fix state of KL-1, observed by the assertion
written to close it. Read-only by construction: an unknown table name runs the same two SELECTs
as a real one and returns before the guest_session insert, so the suite still writes nothing.

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 11 pass, 0 fail, 0 blocked.
Time: 2m 14s total - slowest G8 Functional / integration (1m 55s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (54ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (60ms)
- **G4 No hard-coded colours** - PASS (73ms)
- **G5 Types** - PASS (2.0s)
- **G6 Lint** - PASS (8.3s)
- **G7 Unit + pure specs** - PASS (4.9s)
- **G8 Functional / integration** - PASS (1m 55s)
- **G9 Automation addressability** - PASS (60ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.3s)
- **G11 Wide tables are configurable** - PASS (66ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 2m 27s total - slowest G8 Functional / integration (2m 07s).

- **G1 Theme artifacts in sync** - PASS (51ms)
- **G2 Contrast (all tokens, both themes)** - PASS (57ms)
- **G3 Theme assets present per theme** - PASS (56ms)
- **G4 No hard-coded colours** - PASS (76ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (9.1s)
- **G7 Unit + pure specs** - PASS (5.3s)
- **G8 Functional / integration** - FAIL (2m 07s)

```
    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/staff
      34 |     return route.fulfill({ status: 401, json: { error: { code: 'unauthenticated', message: 'Not tonight.' } } });
    Error Context: test-results/keyboard-signin.functional-e6c7d-visual-order-top-left-first-desktop/error-context.md
    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/staff
      34 |     return route.fulfill({ status: 401, json: { error: { code: 'unauthenticated', message: 'Not tonight.' } } });
    Error Context: test-results/keyboard-signin.functional-ac40c-y-shows-a-VISIBLE-indicator-desktop/error-context.md
    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/staff
      34 |     return route.fulfill({ status: 401, json: { error: { code: 'unauthenticated', message: 'Not tonight.' } } });
    test-results/keyboard-signin.functional-c31a7-sed-key-registers-the-digit-desktop/test-failed-1.png
    Error Context: test-results/keyboard-signin.functional-c31a7-sed-key-registers-the-digit-desktop/error-context.md
    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/staff
      34 |     return route.fulfill({ statu
... (truncated)
```

- **G9 Automation addressability** - PASS (58ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.1s)
- **G11 Wide tables are configurable** - PASS (58ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## FAIL-FIRST EVIDENCE - 2026-09-10 - the first build

A test never observed failing is not evidence that it CAN fail: it may be asserting exactly the
misunderstanding the code encodes. Every spec in this tree is accounted for below, as either an
observed failure or an honest negative with its reason. The full account of each is in the spec's
own header.

### Observed failing, against the real tree

FAIL-FIRST: tests/functional/signin.functional.spec.ts - "the fourth digit IS the submit, and it
submits exactly once" failed on its FIRST run against shipped code: `expected 1, received 2`.
PinSignIn called submit() from inside a setPin updater and React 19 invokes updaters twice under
StrictMode, so every correct four-digit PIN made two sign-in attempts. Fixed in
src/features/staff/PinSignIn.tsx.

FAIL-FIRST: tests/functional/signin.functional.spec.ts - "a fifth tap cannot slip a fifth digit
past the four-digit rule" failed on the same defect, same fix.

FAIL-FIRST: tests/functional/signin.functional.spec.ts - "a refused PIN is refused in the
restaurant's own words" failed with `expected "Ask Javeed", received "That PIN did not work."`:
the mock wrapped the body in {error:{...}} while fail() returns code and message at the top level.
A mock that had drifted from the contract, found by the assertion.

FAIL-FIRST: tests/functional/keyboard-signin.functional.spec.ts - "a whole sign-in, keyboard only,
end to end" failed with `expected 1, received 2` on the same StrictMode defect, found
independently by the keyboard route.

FAIL-FIRST: tests/functional/degraded.functional.spec.ts - EVERY assertion in the file failed
before the fix. `curl -o /dev/null -w '%{http_code}' http://localhost:3000/t/A5` returned 500: the
guest surface threw supabase-js's `TypeError: fetch failed` out of a server component and Next.js
rendered its own error page. Fixed with attempt() in src/lib/supabase/server.ts and
UnreachableState; the same request now returns 200.

FAIL-FIRST: tests/render/jalsa-surfaces.render.spec.ts - two dark-theme targets failed at 2.40:1
against a 4.5 floor, reporting `rgb(102, 93, 89) on rgb(160, 158, 157)` - colours in neither
palette. The theme was applied after navigation, so transition-colors was still running and
getComputedStyle sampled a blend of both themes. The measurement was wrong, not the screen; fixed
by setting the theme through the storage key the no-flash script reads, before first paint.

FAIL-FIRST: tests/unit/status.unit.spec.ts - `tableStateFrom` with the ready/preparing branches
reordered produced `expected "ready", received "in_the_kitchen"`. Recorded with its own correction:
the FIRST version of this assertion did NOT fail under that mutation (the fixture had no preparing
round for it to affect), and was therefore not evidence. The assertion was strengthened before the
mutation reproduced.

FAIL-FIRST: tests/unit/permissions.unit.spec.ts - removing 'bill.view' from the Waiter preset
produced `Expected value: not "bill.view"`. Recorded with its own correction: the first attempt
silently did not apply, because prettier had reflowed the array onto one line.

FAIL-FIRST: tests/unit/money.unit.spec.ts - discount ordering reversed (flat before percentage)
produced a payable of 594 where 585 was expected, on the design set's own worked example.

FAIL-FIRST: tests/unit/guest-phase.unit.spec.ts - reconcilePhase with no phone-owned list produced
`expected "tip", received "status"` - a guest with their thumb over "+ Rs 20" watching the screen
jump back to their order list every six seconds. And with the phone-owned check placed BEFORE the
closed-bill rule, `expected "paid", received "menu"`.

### Honest negatives

NOT OBSERVED FAILING: tests/unit/guest-phase.unit.spec.ts (startingPhase only) - three branches
over the same facts as the reconciliation above; no mutation makes it fail without also failing a
reconciliation assertion. Asserted because it is the FIRST thing a returning guest sees.

NOT OBSERVED FAILING: tests/functional/signin.functional.spec.ts (44px touch-target assertion) -
the keys are h-14 (56px) and no mutation short of editing that class makes it fail. Asserted
because a redesign changes that class without anyone re-measuring.

NOT OBSERVED FAILING: tests/functional/keyboard-signin.functional.spec.ts ("Enter registers the
digit", "the focused key shows a VISIBLE indicator", the Shift+Tab trap check) - all true of the
shipped code; no mutation was run. Asserted because a div-with-onClick and a stripped
focus-visible:outline-2 are the two ways this screen breaks elsewhere, and neither shows up on a
pointer run.

NOT OBSERVED FAILING: tests/render/jalsa-surfaces.render.spec.ts (the "every target was found"
guard) - no mutation run against it. Asserted because the reference shape it replaces SKIPPED a
missing target, and a skip reads as a pass in every report this suite produces.

FAILFIRST-NA: tests/cases/reference/reference.functional.spec.ts,
tests/cases/reference/keyboard.functional.spec.ts, tests/cases/reference/contrast.render.spec.ts -
these are the framework's worked examples, moved out of tests/ unedited on 10-Sep-2026 because
they assert against the starter's demo screen, which this application deliberately does not have.
They are not executed by any Playwright project and encode nothing about Jalsa. See
tests/cases/reference/README.md for what was lost (nothing) and which rungs are consequently NOT
EXECUTED (CP-25 and CP-26, blocked by KL-1).

FAILFIRST-NA: tests/unit/analytics.unit.spec.ts, audit.unit.spec.ts, column-prefs.unit.spec.ts,
errors.taxonomy.unit.spec.ts, list-controls.unit.spec.ts, loading.unit.spec.ts,
module-access.unit.spec.ts, module-customizer.unit.spec.ts, pricing.unit.spec.ts,
selection.unit.spec.ts, text-format.unit.spec.ts, undo.unit.spec.ts - these arrived with the
scaffold, carrying the framework's own fail-first evidence in their headers, recorded against the
starter tree where the defects were real. Re-deriving that evidence here would mean re-injecting
twelve defects into code this change did not write. They are executed on every run (they pass, and
they type-check against this tree's stricter compiler settings, which is what this build did
change about them).

---

## Gate run - 2026-09-10 - VERDICT: PASS

Steps: 11 pass, 0 fail, 0 blocked.
Time: 2m 06s total - slowest G8 Functional / integration (1m 50s).

- **G1 Theme artifacts in sync** - PASS (50ms)
- **G2 Contrast (all tokens, both themes)** - PASS (50ms)
- **G3 Theme assets present per theme** - PASS (46ms)
- **G4 No hard-coded colours** - PASS (60ms)
- **G5 Types** - PASS (1.7s)
- **G6 Lint** - PASS (7.2s)
- **G7 Unit + pure specs** - PASS (4.2s)
- **G8 Functional / integration** - PASS (1m 50s)
- **G9 Automation addressability** - PASS (61ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.6s)
- **G11 Wide tables are configurable** - PASS (54ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-10 - VERDICT: PASS

Steps: 11 pass, 0 fail, 0 blocked.
Time: 2m 07s total - slowest G8 Functional / integration (1m 51s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (50ms)
- **G2 Contrast (all tokens, both themes)** - PASS (50ms)
- **G3 Theme assets present per theme** - PASS (49ms)
- **G4 No hard-coded colours** - PASS (64ms)
- **G5 Types** - PASS (1.9s)
- **G6 Lint** - PASS (7.1s)
- **G7 Unit + pure specs** - PASS (4.1s)
- **G8 Functional / integration** - PASS (1m 51s)
- **G9 Automation addressability** - PASS (55ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.7s)
- **G11 Wide tables are configurable** - PASS (51ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-10 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 2m 28s total - slowest G8 Functional / integration (1m 50s).

- **G1 Theme artifacts in sync** - PASS (40ms)
- **G2 Contrast (all tokens, both themes)** - PASS (48ms)
- **G3 Theme assets present per theme** - PASS (48ms)
- **G4 No hard-coded colours** - PASS (51ms)
- **G5 Types** - PASS (1.8s)
- **G6 Lint** - FAIL (28.7s)

```
   57:9   error  Do not assign to the variable `module`. See: https://nextjs.org/docs/messages/no-assign-module-variable  @next/next/no-assign-module-variable
  300:22  error  Unexpected console statement. Only these console methods are allowed: warn, error                        no-console
  304:5   error  Unexpected console statement. Only these console methods are allowed: warn, error                        no-console
     9:5  error    Definition for rule '@typescript-eslint/no-unused-vars' was not found                                    @typescript-eslint/no-unused-vars
    58:5  error    Do not assign to the variable `module`. See: https://nextjs.org/docs/messages/no-assign-module-variable  @next/next/no-assign-module-variable
   143:5  error    Do not assign to the variable `module`. See: https://nextjs.org/docs/messages/no-assign-module-variable  @next/next/no-assign-module-variable
   251:5  error    Do not assign to the variable `module`. See: https://nextjs.org/docs/messages/no-assign-module-variable  @next/next/no-assign-module-variable
   267:5  error    Do not assign to the variable `module`. See: https://nextjs.org/docs/messages/no-assign-module-variable  @next/next
... (truncated)
```

- **G7 Unit + pure specs** - PASS (4.5s)
- **G8 Functional / integration** - PASS (1m 50s)
- **G9 Automation addressability** - PASS (51ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.8s)
- **G11 Wide tables are configurable** - PASS (65ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

