# Test summary

_Newest run first. **Append-only: never overwrite a prior run.**_
_`## Gate run` blocks are written by `scripts/gate-runner.mjs`; guard G2 greps for them._

---

FAIL-FIRST: jalsa/tests/unit/restaurant-details.unit.spec.ts - the HR email control's setter in
jalsa/src/features/owner/sections/SettingsSection.tsx changed from `set('hr_email')` to
`set('email')` (a copy-paste mis-binding that would silently stop saving HR email edits), and
nothing else touched: **1 failed, 9 passed**. Case "all TEN columns are still read into the form
and still written back" failed on `hr_email must have a setter`. The other nine read the tab
row, the shipped sentences, the one `write-identity` call, the `pair` grid and the token pair,
none of which the injection touched, and correctly stayed green. Restored and verified
byte-identical by checksum: **10 passed**.
FAIL-FIRST: jalsa/tests/render/restaurant-details.render.spec.ts - run against main's
IdentityPanel (the pre-fix tree, `git show HEAD:` of the same file, which has no `pair`
constant): **1 failed, 18 passed**. Case "the pinned classes are the ones the panel actually
ships" failed on `the grid measured here must be the grid that ships`. The eighteen width cases
build their own DOM from the pinned constants and measure that, so they stayed green on either
tree - the source assertion is the one that binds the measurement to the panel, and it is the one
that fired. Candidate restored from the index, checksum identical: **19 passed**.
Full suite on the isolated tree: **719 passed** (unit + render), 0 failed - main's 690 plus
exactly the 29 new cases. Chromium only: the WebKit-backed tablet and mobile-ios projects did not
run in this container (bundled Chromium supplied via PLAYWRIGHT_CHROMIUM_PATH; WebKit cannot be
fetched here). One earlier full run showed 22 render failures with corrupted class names in the
generated CSS while an untracked `.next-rd` build directory sat beside `src/` and was being read
by Tailwind's content scanner; with that directory removed the same tree passed 719/719. An
environment artefact of running the build before the suite, not a property of the change.
SHIPPED-STRING CHANGE, DECLARED: the single section label "One identity block, read by every
screen and every printed document" becomes four card headings - "Restaurant identity", "Contact
& location", "Business details", "Who signs" - and the brand block adds "What every screen and
every printed document reads." plus the HR email hint "Where offer letters and experience
certificates come from." Both sentences the unit spec freezes are unchanged and still inside the
panel. No string that any other spec asserts was touched.
THE BEHAVIOUR THE INJECTIONS PROVE IS PROTECTED: every one of the ten `restaurant` columns is
read into the form and bound to a control with its own setter, and the save is the same single
`write-identity` call carrying the whole patch; the grid the render cases measure is the grid
the panel ships. Presentation only - `writeIdentity`, the action route and the schema are
untouched, and no migration was needed or written. The logo upload, which shares this file on
the development branch, is NOT part of this change: the brand block shows the static badge.
Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so the panel was not opened against a real
restaurant row and no save was round-tripped.

---

FAIL-FIRST: jalsa/tests/unit/test-print.unit.spec.ts - the two checks inside `testPrintBlocker`
in jalsa/src/lib/test-print.ts removed so it returned null for every printer (the switched-off
refusal and the no-address refusal), and nothing else touched: **2 failed, 26 passed**. Case 13
"a printer with no address is called unconfigured, not unreachable" and case 13c "a switched-off
printer says so" both failed on `Received has value: null`. Case 13b (a USB printer needs no
address) and "a configured, switched-on printer is testable" expect null and correctly stayed
green, as did the other 24. Restored byte-for-byte from backup, verified identical to the source:
**28 passed**. Full suite on the isolated tree: **690 passed** (unit + render), 0 failed - main's
662 plus exactly the 28 new cases.
THE BEHAVIOUR THE INJECTION PROVES IS PROTECTED: a switched-off printer is refused; a non-USB
printer with no address is refused, with a sentence that sends the owner to Configure rather than
to the kitchen; a configured, switched-on printer remains testable. `testPrint` in
owner-mutations runs that blocker before writing, so a refused printer gets no `print_job` row.
No migration was needed and none was written: `print_job` with every column the test job sets,
`print_status` with `queued`, and free-text `kind` are all in the core schema.
Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no test job was queued against a real row and
no printer was reached; nothing in this deployment can open a connection to a thermal printer in
any case, which is the limitation the note beside the button states.

---

FAIL-FIRST: jalsa/tests/unit/kot-status.unit.spec.ts - the 13-line server guard removed from
`advanceKot` in jalsa/src/lib/db/mutations.ts (the `if (!canAdvanceKot(from, input.to)) throw`
block, and nothing else), then restored byte-for-byte: **1 failed, 42 passed**. Case 4c "the
server refuses it too - the UI is the courtesy, not the boundary" failed on `the transition is
checked before anything is written`. That is the right shape: 4c is the only case that reads the
guard. Cases 4 and 4b exercise `canAdvanceKot` as a pure function in status.ts and correctly
stayed green; 7b (stamp written once) and 8b (status pinned in the WHERE) read other parts of the
same body and stayed green. With the guard restored: **43 passed** (28 KOT + 15 status). Full
suite on the isolated tree: **657 passed** (unit + render), 0 failed - main's 629 plus exactly the
28 new cases.
SHIPPED-STRING CHANGE, DECLARED: `KOT_STATUS.new.guest` moves from `'Sent to the kitchen'` to
`'Order received'`, in the one vocabulary module, because the reference design draws the guest's
first step as Order received and CLAUDE.md makes the design set the specification. The status
spec case is amended to assert the new value AND that guest and staff words still differ - re-
expressed, not weakened. No other file on main carried the old string.
Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no captain tapped a real button against a real
row. The transition rules, the server guard, the once-only stamp and the concurrency pin are
source-level and pure-function assertions, and are recorded as such.

---

FAIL-FIRST: jalsa/tests/unit/combobox.unit.spec.ts and jalsa/tests/unit/combobox-migration.unit.spec.ts
- two injected defects, each reverted.
(A) the Expenses > Category migration reverted to the native `<datalist>` it replaced:
**3 failed, 13 passed** - "the three old implementations are gone" on `no datalist element`,
"the four migrated owner fields use the shared component" on `expense category renders it`, and
"creation is allowed on the two data-entry fields and nowhere else" on
`expense category allows create`.
(B) `comboboxExactMatch` made case-SENSITIVE (the `.toLowerCase()` dropped from both sides), so
typing `desserts` against an existing `Desserts` would offer to create a duplicate the database
would then refuse: **2 failed, 10 passed** - "the duplicate guard ignores case and surrounding
space" and "matching and the duplicate guard agree on the same string".
With both reverted: **28 passed**. Full suite on the isolated tree: **628 passed** (unit +
render), 0 failed.

THE GUEST BOUNDARY IS A RATCHET, NOT AN OMISSION. The sixth migrated field - Guest > "How did
you hear about us?" - is held back with its own workstream: `listHeardSources` selects
`guest_session.heard_about`, and 20260918030000_jalsa_guest_heard_about is not applied to
production, so shipping the field would throw on the guest's first screen (jalsa/CLAUDE.md
guardrail 6). The four cases covering it are named in the last test of
combobox-migration.unit.spec.ts, which asserts the field's ABSENCE and fails the moment the
guest workstream lands.

Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no seeded database was reachable. No browser
interaction case was executed against a running application; the interaction guarantees above
are source-level assertions, and are recorded as such rather than as a rendered pass.

---

FAIL-FIRST: jalsa/tests/unit/indoor-queue.unit.spec.ts - the queue-closed guard removed from
`guestJoinQueue` in jalsa/src/lib/db/mutations.ts (the two lines reading the `queue` setting and
throwing `QUEUE_CLOSED`), then reverted: **2 failed, 20 passed**. Case 2 "a CLOSED queue refuses a
new party in the mutation, not only on the screen" failed on `the closed check exists -
expect(received).toBeGreaterThan(expected) / Expected: > -1 / Received: -1` at
indoor-queue.unit.spec.ts:107, and case 1 "an open queue accepts a join" failed with it. With the
guard restored: **22 passed**. The injection targets the mutation deliberately - a guard that
lived only in the screen would leave the two cases green while a second tab could still enqueue.
Full suite on the isolated tree: **600 passed** (unit + render), 0 failed.
Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no sanctioned seeded database is reachable and
no data-bearing journey was executed. Recorded as BLOCKED, never as a pass.

---

FAIL-FIRST: jalsa/tests/unit/staff-access-tabs.unit.spec.ts - four injected defects on the
Owner > Staff access/availability organisation, each reverted. (A) `hasAccess` narrowed to
`p.hasPin && p.onDuty`, folding availability into access: **3 failed**, including case 6
"access must be decided by the PIN alone". (B) the Available section dropped from the section
list: **1 failed** - "tabs sit above the list, and Available comes before Unavailable".
(C) role grouping replaced with `[['All staff', members]]`, flattening the list: **2 failed**,
including case 8 "role grouping is preserved INSIDE each section". (D) `CHIP_NAV_WRAP` set back
to the pre-fix scrolling value: **1 failed** - "the tab row is the existing chip NAVIGATION".
19 passed with the change intact.
NOT OBSERVED FAILING: the 8 Staff-tab cases appended to
jalsa/tests/render/settings-submenu.render.spec.ts - run against defect (D) above, **8 passed**.
Two chips this short occupy about 270px of the 328px content box at 360px, so they fit whether
the row wraps or scrolls; the defect is real but cannot express itself through THESE labels. It
is caught at the unit tier instead (row D), and the container's own observed-failing evidence is
the ten-label block at the top of that same render file (17-Sep: 15 failed, 4 passed). The eight
are kept as a FORWARD guarantee - a third tab, a longer label or a three-digit count would be
caught there and nowhere else. Recorded verbatim in the spec header.
Gate for this change: **BLOCKED** - 11 pass, 0 fail, 1 blocked (G8 functional, no sanctioned
seeded database in this container). Full account in jalsa/TEST_SUMMARY.md,
"Change - 18-Sep-2026 - Owner > Staff organised by application access".

---

FAIL-FIRST: jalsa/tests/unit/restaurant-details.unit.spec.ts - three injected losses on the
Restaurant details redesign, each reverted: `hr_email` dropped from the save patch, a test id
renamed, and the old wrapping flex row restored. **1 failed, 9 passed** each time, 10 passed
with the redesign intact.
NOT OBSERVED FAILING as a fix: jalsa/tests/render/restaurant-details.render.spec.ts - **1 failed,
18 passed** against the old shape, and the one failure was the class-drift check rather than a
layout assertion. Measured, not assumed: the old `flex-wrap` + `min-w-[14rem]` row wrapped
correctly at 320px. The spec is a regression guard on the new grid, not evidence of an overflow
that existed. Full account in jalsa/TEST_SUMMARY.md, "Gate run - 2026-09-18 (fifth)".

---

FAIL-FIRST: jalsa/tests/unit/guest-phase.unit.spec.ts and
jalsa/tests/unit/guest-session-wiring.unit.spec.ts - the two new specs for the single-QR /
sequential-customer session model. Observed failing 18-Sep-2026: **9 failed, 10 passed** with
`decideGuestPhase` rewritten to the shipped table-first rule, and **5 failed, 3 passed** with
`src/` stashed. Full account in jalsa/TEST_SUMMARY.md under "Gate run - 2026-09-18 (third)".

NOT OBSERVED FAILING: 3 of the wiring cases passed pre-change because the new visit route is an
untracked file and survived the stash. Recorded rather than counted as coverage.

---

FAIL-FIRST: the four pre-commit-review cases added to
jalsa/tests/unit/combobox-migration.unit.spec.ts on 18-Sep-2026 — the polled-payload scan, focus
restored on close, focus-to-open removed, and the listbox owning its options. Each fix was
reverted in turn and its case observed failing: **1 failed, 16 passed** each time, 17 passed with
all four in place. Full account in jalsa/TEST_SUMMARY.md under "Gate run - 2026-09-18 (second)".

---

FAIL-FIRST: jalsa/tests/unit/combobox.unit.spec.ts and
jalsa/tests/unit/combobox-migration.unit.spec.ts - the two new specs for the shared Jalsa
combobox and the five fields migrated onto it. Both observed failing on 18-Sep-2026; the full
evidence is in jalsa/TEST_SUMMARY.md under "Gate run - 2026-09-18".

  - combobox.unit: THREE deliberate defects, each reverted, 12 passed each time afterwards.
    Search made case-sensitive: **6 failed, 6 passed**. The duplicate guard made case- and
    space-sensitive: **2 failed, 10 passed**. Matching only at the start of a label:
    **2 failed, 10 passed**.
  - combobox-migration.unit: **7 failed, 6 passed** with `src/` stashed.

NOT OBSERVED FAILING: the 6 migration cases that passed pre-change did so because
`git stash push -- src/` does not stash untracked files, so the new component survived into the
"pre-change" tree. They guard regressions in a file that existed in both; they are not evidence
of the defect. Recorded rather than counted as coverage.

These lines are at the repository root for the same reason as the ones below them: guard G3
reads TEST_SUMMARY.md relative to the working-tree root and cannot see a nested application's
ledger.

---

FAIL-FIRST: jalsa/tests/unit/bill-share.unit.spec.ts and
jalsa/tests/unit/bill-detail-wiring.unit.spec.ts - the two new specs for the bill-detail screen
opened from Closed today. Both observed failing on 17-Sep-2026; the full evidence is in
jalsa/TEST_SUMMARY.md under "Gate run - 2026-09-17 (third)".

  - bill-share.unit: FOUR deliberate defects, one per run, each reverted and the suite returned
    to 11 passed. Cancelled lines billed to the guest: **1 failed, 10 passed**. GST hard-coded
    instead of the bill's own totals rows: **3 failed, 8 passed**. An open bill claiming it was
    paid: **1 failed, 10 passed**. The text not URL-encoded: **1 failed, 10 passed**.
  - bill-detail-wiring.unit: **8 failed, 1 passed** with the component replaced by a placeholder
    and Payments.tsx and globals.css checked out.

NOT OBSERVED FAILING: jalsa/tests/unit/bill-detail-wiring.unit.spec.ts - the print-block scoping
case. The pre-change `@media print` block had no unscoped hide rule either, so it guards a
regression rather than proving the defect.

These lines are at the repository root for the same reason as the ones below them: guard G3
reads TEST_SUMMARY.md relative to the working-tree root and cannot see a nested application's
ledger.

---

FAIL-FIRST: jalsa/tests/unit/close-bill-order-pane.unit.spec.ts and
jalsa/tests/render/close-bill-panes.render.spec.ts - the two new specs for the Record payment
dialog's order pane. Both observed failing on 17-Sep-2026 against the pre-change tree; the full
evidence is in jalsa/TEST_SUMMARY.md under "Gate run - 2026-09-17 (second)".

  - close-bill-order-pane.unit: **5 failed, 3 passed** - "the rounds must come from the bill",
    "the veg/non-veg mark", the money-pane testid, "the grid must be responsive", the
    empty-state testid.
  - close-bill-panes.render: **9 failed, 18 passed** with `GRID` set to the shipped
    `flex flex-col gap-4` - the class pin went red and every side-by-side assertion from 768px
    up reported `both panes start on the same line (y 900 vs 936)`.

  The render spec also found a REAL defect in the change it was written for, which is the
  reason the tier exists: `md:grid-cols-[...]` alone left the base grid with one `auto` track,
  `auto` sizes to max-content, and an unbreakable dish name therefore set the dialog's width -
  the panes spilled at 430, 390, 375, 360 and 320px. Fixed with `grid-cols-1` at the base.

NOT OBSERVED FAILING: the 3 unit cases and 18 render cases that passed on the pre-change tree
are regression guards by construction, not proofs of the defect - a parse-found-the-file sanity
check, a list that was already singular, an import that was already absent, and the containment
and stacking checks that a flex column satisfies anyway.

These lines are at the repository root for the same reason as the ones below them: guard G3
reads TEST_SUMMARY.md relative to the working-tree root and cannot see a nested application's
ledger.

---

FAIL-FIRST: jalsa/tests/unit/upsell-action-bar.unit.spec.ts,
jalsa/tests/render/guest-upsell-bar.render.spec.ts,
jalsa/tests/render/settings-submenu.render.spec.ts,
jalsa/tests/unit/bill-role-eligibility.unit.spec.ts and
jalsa/tests/unit/function-overloads.unit.spec.ts - the five new specs for the guest closure bar,
the Settings submenu wrap, the bill-role guard and the set_staff_pin overload. All observed
failing on 17-Sep-2026 against the pre-fix tree; the full evidence, verbatim failure messages
included, is in jalsa/TEST_SUMMARY.md under "Gate run - 2026-09-17 - VERDICT: BLOCKED".

  - upsell-action-bar.unit: **5 failed, 1 passed** - ids came back as the three shipped buttons,
    "no nested flex row inside the bar", "the tip button must exist · expected > -1".
  - guest-upsell-bar.render: **20 failed, 6 passed** - "each button gets its own line
    (y: 840, 842, 842)" at all 13 widths; "No thanks, continue to payment (x 554 -> 841,
    viewport 834)". The 6 that passed are the viewport half at 1024px and wider, where the old
    three-button row genuinely fit; recorded rather than smoothed over.
  - settings-submenu.render: **15 failed, 4 passed** - "Printers & machines (x 1271 -> 1421,
    viewport 1280)", "the nav must not scroll sideways (1405 > 1248)".
  - bill-role-eligibility.unit: **6 failed, 3 passed**.
  - function-overloads.unit: **2 failed, 3 passed** with the DROP migration removed - "widen a
    function by DROPPING the narrow signature first, as verify_staff_pin does". Its
    parse-found-functions assertion passed in the same run, which is what proves those two
    failures are a real finding and not an empty scan.

NOT OBSERVED FAILING: jalsa/tests/render/responsive-sweep.render.spec.ts - it is a standing
sweep of the reachable routes at 13 widths rather than the proof of one fix, and it passed 79/79
on its first run. The defect it would have caught is the one settings-submenu.render.spec.ts
records above, on a route this sweep cannot sign into.

NOT OBSERVED FAILING: jalsa/tests/unit/upsell-action-bar.unit.spec.ts:119 - the sixth case in
that file guards the `resume-ordering` write which the request's MUST NOT CHANGE line protects,
so it passes on the pre-fix tree and the fixed one by design. It is a regression guard, not a
proof of the defect.

These lines are at the repository root for the same reason as the ones below them: guard G3
reads TEST_SUMMARY.md relative to the working-tree root and cannot see a nested application's
ledger.

---

FAIL-FIRST: jalsa/tests/unit/separate-a-table.unit.spec.ts - the new spec for separating a table
from a group bill. Observed failing on 16-Sep-2026; the full evidence is in jalsa/TEST_SUMMARY.md,
"FAIL-FIRST EVIDENCE - 2026-09-16 (twelfth)". Two deliberate defects: removing the
payment-requested branch (2 failed, 9 passed - the behaviour survived, the useful sentence did
not) and removing the host-table branch (3 failed, 8 passed). Both reverted; 11 passed.

---

FAIL-FIRST: jalsa/tests/unit/hr-documents.unit.spec.ts and
jalsa/tests/unit/report-range.unit.spec.ts - the two new specs for Jalsa's HR documents and the
Reports date range. Both observed failing on 16-Sep-2026; the full evidence is in
jalsa/TEST_SUMMARY.md, "FAIL-FIRST EVIDENCE - 2026-09-16 (eleventh)". Four deliberate defects
across four runs: a merge that drops blanks instead of marking them (5 failed, 22 passed), a
pronoun fallback to he/him on an unrecorded gender (1 failed, 26 passed), a date range that
swaps reversed dates instead of refusing them (2 failed, 19 passed), and a net that folds tips
into income (2 failed, 19 passed). All reverted; the suites returned to 27 and 21 passed.

This line is at the repository root for the same reason as the one below it: guard G3 reads
TEST_SUMMARY.md relative to the working-tree root and cannot see a nested application's ledger.

---

FAIL-FIRST: jalsa/tests/unit/print-template.unit.spec.ts and
jalsa/tests/unit/print-routing.unit.spec.ts - the two new specs for Jalsa's Print Setup slice.
Both were observed failing on 16-Sep-2026. The full evidence, with each injected defect and the
counts it produced, is in the application's own ledger at jalsa/TEST_SUMMARY.md, under
"FAIL-FIRST EVIDENCE - 2026-09-16 (tenth)". In short: four deliberate defects across four runs -
a `validateTemplate` that returns canSave regardless of its own failures (4 failed, 30 passed),
a reprint band spliced below the header instead of prepended (one of those four), a
`resolvePrinter` that returns nothing instead of falling back (3 failed, 15 passed), and a
fallback reporting the machine's own station rather than the one the ticket was meant for
(2 failed, 16 passed). All four reverted; both suites returned to 34 and 18 passed.

This line is at the repository root because guard G3 reads TEST_SUMMARY.md relative to the
working-tree root and cannot see a nested application's ledger. It is a pointer to the evidence,
not a second copy of it - the detail belongs beside the specs it describes.

---

NOT OBSERVED FAILING: starter/tests/unit/pwa.unit.spec.ts - arrived with the framework v1.35.0
sync (CP-30's named rung), not written here, and it cannot be run in this checkout: starter/ has
no node_modules, which is the same absence that leaves gate G5 BLOCKED and G6-G8 blocked behind
it. There is no pre-fix tree to run it against either — the code it exercises (starter/src/lib/
pwa.ts, PwaProvider) arrives in the very same commit, so the state where it would fail has never
existed in this repository. Recording the honest negative rather than escaping the guard: this
spec is unproven HERE, and whoever installs starter/'s dependencies should run it before relying
on it. Jalsa's own PWA work does not depend on it — jalsa/ keeps its own worker and registrar,
and that behaviour WAS proven, in a browser, in bc35c4e.

## Gate run - 2026-09-16 - VERDICT: BLOCKED

Steps: 8 pass, 0 fail, 4 blocked.
Time: 3.4s total - slowest G10 Backward compatibility (fixtures) (3.0s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (91ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (50ms)
- **G4 No hard-coded colours** - PASS (53ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified. - **20 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass - **20 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass - **20 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass - **20 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G9 Automation addressability** - PASS (50ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.0s)
- **G11 Wide tables are configurable** - PASS (50ms)
- **G12 Installable as an application** - PASS (53ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## FAIL-FIRST EVIDENCE - 2026-09-15 (fourth) - a probe that asked before the screen existed

FAIL-FIRST: jalsa/tests/functional/guest-journey.functional.spec.ts:120. OBSERVED FAILING in CI
run 34957008824 on 08b5e91, on five of six projects - desktop-wide, tablet, mobile, mobile-ios,
mobile-short:

    Test timeout of 30000ms exceeded.
    Error: expect(locator).toBeVisible() failed
    Locator: getByTestId('guest-tip')
    Call log:
      - Expect \"toBeVisible\" getByTestId('guest-tip') with timeout 8000ms
      - waiting for getByTestId('guest-tip')
    > 120 |   await expect(page.getByTestId('guest-tip')).toBeVisible();

(The sixth project, desktop, fails earlier at :82 on `guest-placed` - the residual send-to-kitchen
latency case, 1/12 slots since faf47f8. Unrelated, and not touched here.)

THE SYNCHRONIZATION DEFECT. `guest-tip` has no server contract at all: `guest-upsell-skip` is
`onClick={() => go('tip')}` (GuestClosure.tsx:274) and `phase === 'tip'` renders TipScreen
(GuestApp.tsx:263), so the tip row appears one React commit after the click - no API call, no
mutation, no poll ('upsell' and 'tip' are both PHONE_OWNED, so reconcilePhase cannot move them).
The transition works: closure-upsell-tip test 2 clicks the same control and reaches `guest-tip` on
four projects in the same run.

What failed is the step BEFORE it. Line 111 clicks `guest-request-payment`, and `requestPayment`
(GuestProgress.tsx:80-87) awaits its POST and only THEN calls `go('upsell')`. Playwright's click
returns as soon as the click dispatches. The `state()` read on line 112 is an independent request
that needs only the row to have landed, so line 113 can observe `payment_requested` seconds before
the phone has left the order list.

WHY `isVisible()` WAS INSUFFICIENT. The old probe was:

    const skip = page.getByTestId('guest-upsell-skip');
    if (await skip.isVisible().catch(() => false)) await skip.click();

`isVisible()` is a point-in-time check - it does NOT wait. At that instant the phone is still on
the STATUS screen, so there are three possible screens (status / upsell / tip) and the probe asks
a two-state question. It answered "no upsell", never clicked Skip, and the phone then landed on
the upsell - where line 120 waited for a tip screen it could never reach on its own. Deterministic,
not a race that sometimes wins.

THE FIX - the wait-then-branch pattern already validated by `reachTheUpsell` in
closure-upsell-tip:

    const upsell = page.getByTestId('guest-upsell');
    const tip = page.getByTestId('guest-tip');
    await expect(upsell.or(tip), '...').toBeVisible();
    if (await upsell.isVisible()) {
      await page.getByTestId('guest-upsell-skip').click();
    }
    await expect(tip).toBeVisible();

`expect(a.or(b)).toBeVisible()` waits for whichever closure screen the application actually
produces; only then is `isVisible()` a meaningful two-way question. The branch is still required -
UpsellScreen returns TipScreen directly when the owner's upsell switch is off or no tab has an
available item - so "skip the upsell IF it appears" remains the real contract, unchanged. No
sleep, no retry, no arbitrary wait, no timeout touched. The `guest-tip` assertion is not weakened;
it is the same line, now reachable. Every surrounding assertion is untouched: the tip-20 click,
`tipChosen === 20`, `billStatus === 'payment_requested'`, pay-at-table and `guest-status`.

AFTER: NOT OBSERVED PASSING. The seeded Supabase test project is unreachable from this container
(CONNECT tunnel 403) and .env.local points at yxgxmbyilpivbmeemqkp, the development/production
project, which is never an automated target - so no DB-backed functional spec can run here and
none was run. CI is the first execution. Observed locally: `playwright test --list` resolves the
file across all six projects, 247/247 unit, tsc and eslint clean, `next build` clean, guard:test
14/14, pre-commit guard exit 0.

HONEST CAVEAT, RECORDED RATHER THAN HIDDEN. All five failures hit the 30 000ms TEST cap while the
8 000ms expect was still waiting, which proves lines 62-119 already consume MORE than 22.6s of the
30s budget. The remaining steps after line 120 (the tip POST, the state read, pay-at-table) will
add roughly 5-8s, so this test may still land near or over the cap. This fix is necessary and
correct either way - it removes a probe that could never succeed - but it is not claimed to be
sufficient to turn the test green. The remainder is critical-path latency, not a budget to raise.

---

## FAIL-FIRST EVIDENCE - 2026-09-15 (third) - the same isolation defect, one test along

FAIL-FIRST: jalsa/tests/functional/closure-upsell-tip.functional.spec.ts, test 3 ("a table that
decides on one more round never has to cancel anything first"). OBSERVED FAILING in CI run
34949294483 on faf47f8, on all five projects where the file got that far - desktop, desktop-wide,
mobile, mobile-ios, mobile-short:

    Error: expect(locator).toBeVisible() failed
    Locator: getByTestId('guest-welcome')
    Timeout: 8000ms
    Error: element(s) not found
    >  41 |   await expect(page.getByTestId('guest-welcome')).toBeVisible();
      at orderAndAskForTheBill (...closure-upsell-tip.functional.spec.ts:41:51)   <- called from :179

That run is the FIRST that ever executed test 3: before faf47f8 the file died at `guest-placed` in
test 1, and before that at `guest-upsell-skip` in test 2. Each fix moved the frontier one test on,
and this is the frontier.

ROOT CAUSE - the same class as the test 2 defect, not a new one. Test 3 opened on
`orderAndAskForTheBill`, whose first act is to assert the WELCOME screen. That holds only on a
table with no bill. The table is shared by this file's tests BY DESIGN - one table per spec per
browser project, tests/support/tables.ts - so by the time test 3 runs, tests 1 and 2 have opened a
bill on it and the phone lands on the order list instead. The helper is not wrong; the assumption
that test 3 runs first is.

WHAT TEST 3 ACTUALLY REQUIRES, which is narrower than "a fresh table":
  1. a bill on this table with at least one round - otherwise StatusScreen renders
     `guest-status-empty` (rounds.length === 0), not `guest-status`;
  2. that bill in `payment_requested` - because `guest-continue-ordering` is rendered ONLY in the
     payment_requested branch of the status action bar (src/features/guest/GuestProgress.tsx:197),
     and that button is the whole subject of the test.

THE FIX - two lines, and no new helper. `reachTheUpsell`, added for test 2 and validated by run
34949294483 (test 2 passed on all five projects, 5.7-7.0s), already guarantees exactly those two
things and ends on the very assertion test 3 carried on its second line:

    - welcome            -> orderAndAskForTheBill: orders, requests payment, lands on the upsell
    - `guest-continue-closure` visible -> the bill is ALREADY payment_requested; tap it -> upsell
    - `guest-request-payment` visible  -> tap it; `requestPayment` posts request-payment and then
                                          go('upsell') (GuestProgress.tsx:80-87)
    - then: await expect(page.getByTestId('guest-upsell')).toBeVisible();

So `await orderAndAskForTheBill(page); await expect(guest-upsell).toBeVisible();` becomes
`await reachTheUpsell(page);`. Every branch is a control a guest has; none is a test-only path; no
sleep, no retry, no arbitrary wait. Test 3's own assertions - the `guest-continue-ordering`
control, `{billStatus: 'open', paymentPaused: true}`, `rounds.length > 1`, `billStatus === 'open'`,
`guest-payment-paused` and `guest-request-payment` - are untouched, and so are tests 1 and 2. Test
1 still calls `orderAndAskForTheBill` directly, which is correct: it runs first, on a reset table.

Writing a second helper for test 3 was rejected. Two ways to reach one screen is how the two
drift, and the second is always the one that rots.

AFTER: NOT OBSERVED PASSING. The seeded Supabase test project is unreachable from this container
(CONNECT tunnel 403) and .env.local points at yxgxmbyilpivbmeemqkp, the development/production
project, which is never an automated target - so no DB-backed functional spec can run here. CI is
the first execution. What IS observed locally: `playwright test --list` resolves all 18 tests in
the file across the six projects at their new lines (110/149/186), 247/247 unit, tsc clean, eslint
clean, `next build` clean, guard:test 14/14, pre-commit guard exit 0.

KNOWN AND NOT ADDRESSED HERE: the serial-group retry structure. When a later test in the group
fails, Playwright re-runs the whole group, and test 1 then fails at `guest-welcome` because its own
first attempt opened the bill - which is why run 34949294483 reported test 1 as "flaky" on five
projects although it passed first time. Retries cannot help this file. That is a separate decision,
not a workaround to be smuggled in here.

---

## FAIL-FIRST EVIDENCE - 2026-09-15 (second) - an 8s budget and a 22-trip path

FAIL-FIRST: no new spec file. This is an APPLICATION LATENCY change; the rung that fails against
the pre-fix tree already exists and is unchanged -
jalsa/tests/functional/guest-journey.functional.spec.ts:82 and the same assertion reached through
`orderAndAskForTheBill` in closure-upsell-tip.functional.spec.ts:49.

    Error: expect(locator).toBeVisible() failed
    Locator: getByTestId('guest-placed')
    Expected: visible
    Timeout: 8000ms
    Error: element(s) not found

OBSERVED FAILING in CI run 34940426793 (c2ba09a), 12 of 12 spec x project slots. ALSO OBSERVED
FAILING in run 34936577339 (cab1349), 2 of 12 - closure-upsell-tip on desktop and guest-journey on
mobile-short, byte-identical message. The defect is not new; its hit rate went from ~17% to 100%.

NOT A c2ba09a REGRESSION. `git diff --stat cab1349 c2ba09a` is two files: TEST_SUMMARY.md and
closure-upsell-tip.functional.spec.ts. No application code changed, so no test file can have
slowed a route. The two failing specs own disjoint tables (guest-journey A1-A6,
closure-upsell-tip N3-N8, tests/support/tables.ts), so neither can write into the other's state.
Both runs reset from the same seed - the reset step reported `bill=12 guest_session=72` and
`counters -> bill 1041, kot 105, group 7` in BOTH. And run 34940426793 was on the FASTER machine:
across the 380 tests that passed in both runs the total fell 375s -> 333s, and `reachability:53`,
which measures app-to-Supabase health directly, fell 855/776/1200ms -> 763/734/1000ms. A faster
runner against an equally reachable database still failed 12/12, which leaves only the budget.

ROOT CAUSE. `guest-placed` has NO polling contract. `place()` in GuestOrdering.tsx awaits
`flushCart()`, awaits `POST /api/guest/round`, then calls `go('placed')`; `PlacedScreen` renders
the testid unconditionally and `reconcilePhase` preserves `'placed'`. So the 8000ms expect is a
hard budget on ONE request - and that request performed ~22 serial PostgREST round trips to
Sydney on a fresh table.

THE OPTIMISATION - four independent reads taken off the serial path, no write reordered across
the response:
  1. queries.ts `listMenu`: the `menu_category` read is keyed by restaurant_id alone and never
     reads a menu item; it now issues alongside the `menu_item` read. -1 trip on EVERY payload
     build (first render, 6s poll, and every echo).
  2. guest-view.ts `assembleGuestPayload`: `readCart(ctx.sessionId)` depends on the context only,
     not on the menu or the settings; it joins the existing Promise.all. -1 trip. With (1) a
     payload build is now one wave instead of three.
  3. guest-echo.ts `freshState(session?)`: every echoing route has ALREADY read the session row to
     authorise the write. The round, cart and bill routes now hand it in instead of having it
     re-read by token. The round route passes the `bill_id` `attachBillToSession` just wrote, so
     `contextForSession` still finds the pointer correct and still skips its corrective write.
     -1 trip on four write paths, the tip among them.
  4. mutations.ts `ensureOpenBill`: the audit entry only ever needed the bill for its table NAMES,
     and a bill one line old has exactly one membership. That name is now read in the parallel
     wave already being awaited at the top, so `audit` overlaps `getBill` instead of following it.
     BOTH ARE STILL AWAITED BEFORE THE FUNCTION RETURNS - no response can observe an open bill
     whose audit entry has not landed. -1 trip.

~22 -> ~18 serial trips on the round critical path, about 18%. STATED PLAINLY: this is very
unlikely on its own to bring the path under 8s. It removes waste that is provably waste; it does
not claim to close the budget.

DELIBERATELY NOT DONE: `clearCart()` was NOT parallelised with the echo. `assembleGuestPayload`
READS the cart (guest-view.ts) to build `inCart`, `cartCount` and `cartSubtotalLabel`, so racing
them would echo the round just sent as though it were still in the cart. It also cannot be folded
into the earlier Promise.all, because the sold-out branch deliberately does not clear the cart.

VALIDATION: tsc --noEmit clean; eslint clean on all eight files; 247/247 unit; 5/5
degraded.functional against the real no-database instance on :3101 (the changed `resolveGuest` ->
`buildGuestPayload` path, rendered by a real server); `npm run build` clean; `npm run guard:test`
14/14; pre-commit guard exit 0 over the eight staged files (G7 SKIPPED at the repo root - covered
by the jalsa tsc run above).

LIMITATION - LOCAL E2E CANNOT PROVE THE FIX. The seeded Supabase TEST project is unreachable from
this container (CONNECT tunnel 403) and `.env.local` points at yxgxmbyilpivbmeemqkp, the
development/production project, which is never an automated target. So the render tier and every
DB-backed functional spec were NOT run here, and no local measurement of the round trip exists.
The trip counts above are read off the source, not measured. CI against the test project is the
first execution that can confirm or refute the reduction.

---

## FAIL-FIRST EVIDENCE - 2026-09-15 (first) - a test that opened on about:blank

FAIL-FIRST: jalsa/tests/functional/closure-upsell-tip.functional.spec.ts, test 2 ("the tip row
takes a preset in one tap and any other amount in one tap and a number"). OBSERVED FAILING in CI
run 34936577339 on cab1349, in four projects - desktop-wide, mobile, mobile-ios, mobile-short:

    TimeoutError: locator.click: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByTestId('guest-upsell-skip')
    >  97 |   await page.getByTestId('guest-upsell-skip').click();

Nothing on screen to wait for. Playwright's `page` fixture is per-TEST; `describe.serial` orders
the tests and keeps them in one worker but does NOT hand a page from one to the next, so this test
opened by clicking into `about:blank`. It was predicted from the code on 14-Sep and recorded then;
run 34936577339 is the first run that ever got far enough to execute it and prove it.

THE FIX: `reachTheUpsell(page)`, called at the top of test 2. It navigates to the spec's own table
and drives to the upsell along whichever route the application actually offers from where that
table is:
  - no rounds yet            -> welcome screen -> `orderAndAskForTheBill` (the existing helper)
  - a bill already requested -> order list -> "Carry on to pay" (`guest-continue-closure`, the
    payment_requested branch of the status action bar in GuestProgress.tsx)
  - rounds but no request     -> order list -> "Request payment"
Every one is a control a guest has; none is a test-only path. It branches rather than always
ordering because the table is shared by this file's tests BY DESIGN - one table per spec per
browser project - so assuming a fresh table would reintroduce the same ordering dependence in the
other direction. `expect(a.or(b)).toBeVisible()` waits for whichever screen the table opens on
before anything is probed: no sleep, no retry, no guess.

Test 2's assertions and intent are untouched; only the setup in front of them is new. Tests 1 and
3 are unchanged.

AFTER, OBSERVED LOCALLY: the same test, run alone against a deliberately unreachable database,
now fails at `unreachable-guest` toHaveCount(0) (line 82, inside the new helper) instead of timing
out on `guest-upsell-skip`. It navigates, renders the outage screen and goes RED honestly - the
property this file's header already claims for itself. That is the before/after in one line: a
10-second timeout on an empty tab becomes an 8-second assertion against a real rendered screen.

NOT OBSERVED: the test passing. It needs the seeded test project, which is unreachable from this
container (its host is not in the egress allowlist) and production must never be a target. CI is
where the fix meets a real database.

VALIDATION RUN: 247 unit tests pass · tsc clean · eslint clean (whole app) · `next build` green ·
pre-commit guard exit 0 · `playwright test --list` resolves 12 tests in the file across the four
Chromium-backed projects. `audit:all` is 7/8 - `theme-sync` drift, pre-existing from the framework
v1.35.0 sync and untouched by this change.

---

## FAIL-FIRST EVIDENCE - 2026-09-14 (second) - eighteen executions, one table

FAIL-FIRST: jalsa/tests/unit/table-allocation.unit.spec.ts (new) - `allocateTable` replaced with
the behaviour it replaces, `() => 'A5'`, in a temporary copy of the spec: **5 failed, 6 passed**.
The failures name the collision:
  - "different specs in the SAME project never share a table" - `desktop: A5, A5, A5`
  - "the same spec in DIFFERENT projects never shares a table" -
    `guest-journey: A5, A5, A5, A5, A5, A5`
  - "all 18 combinations are distinct" - `distinct tables among A5, A5, ...` (18 allocations,
    1 distinct)
  - "running out of tables throws loudly" - a constant never throws, so it would wrap silently
  - "an unknown spec or project is refused by name" - likewise silent
The temporary copy was removed after the run; nothing from it remains in the tree.

THE DEFECT IT ANSWERS: `guest-journey`, `guest-total-visibility` and `closure-upsell-tip` all
wrote to table A5, and six browser projects run all three - eighteen executions against one table.
None cleans up (each says so deliberately in its header) and the reset runs ONCE before the whole
suite, so the first execution to open a bill occupied A5 for the other seventeen. CI run
34834299122 on 3a43532: **18 failed, 48 did not run, 375 passed**, every failure on the same first
assertion - `guest-welcome` not visible, because a table with an open bill shows that bill's order
list instead (JP-4). Bill B-1041 was opened at 10:41:45 and never closed or released.

It is NOT primarily a race, and that is why serialising was rejected: the bill persists for the
rest of the run, so the collision happens at one worker as surely as at two. The six passing
assertions above are the ones a hard-coded 'A5' satisfies by luck - it IS seeded, it IS active, it
IS stable - which is exactly why nothing in the suite could have caught this.

NOT OBSERVED FAILING: "the allocator and the seed still agree", "the project list matches
playwright.config.ts", "the matrix is the size the seed has to cover" and "the registry the specs
actually use is the seeded one". All four were already true of this tree; they are asserted so the
hand-kept lists cannot drift from the seed or the config without a red test, and so a registry
that parsed to nothing cannot make the rest vacuous (binding rule 3).

RUNTIME EVIDENCE, not only unit: a temporary probe spec run across the four Chromium-backed
projects printed the live allocation - desktop `A1/A7/N3`, desktop-wide `A2/A8/N4`, mobile
`A4/A10/N6`, mobile-short `A6/N2/N8`. Twelve distinct tables, matching the allocator exactly.
tablet and mobile-ios were dropped by the container's Chromium override (KL-3), so their six
allocations are proven by the unit rung only. The probe was removed after the run.

NOT OBSERVED: the three functional specs passing. They cannot run here - the local environment
points at the development/production project, which they must never write to, and the test project
is unreachable from this container. They were run against a deliberately unreachable database to
prove the wiring loads and the specs go red rather than error on import: **2 failed** on
`guest-welcome` not visible, which is the documented pre-existing state on this container. The
end-to-end proof is the next CI run.

KNOWN, DELIBERATELY NOT FIXED HERE: two pre-existing defects in `closure-upsell-tip`, which this
change makes reachable for the first time. Test 2 (line 88) never navigates before using
`guest-upsell-skip`, and Playwright's `page` fixture is per-test, so `describe.serial` does not
carry a page into it. Test 3 (line 122) expects `guest-welcome` on a table test 1 deliberately
left at `payment_requested`. Isolation was never going to fix either; they are recorded so the
next CI run's failures are expected rather than surprising.

---

## FAIL-FIRST EVIDENCE - 2026-09-14 (first) - presence is not ownership

FAIL-FIRST: jalsa/tests/unit/schema-columns.unit.spec.ts (table-aware assertions appended) - the
new `declaresColumnOn(table, column)` was deliberately replaced with the old table-blind
`declaresColumn(column)` in a temporary copy of the spec, and the injected defect was observed:
the assertion accepted `audit_entry.created_at`, a column that does not exist. **2 failed, 8
passed**:
  - "audit_entry timestamps with `at`, and has no `created_at` - the CI reset defect" -
    `audit_entry.created_at must NOT be declared - expected false, received true`
  - "no table in the reset list may be filtered on a column it does not have" -
    `audit_entry.created_at - expected false, received true`
The temporary spec was removed after the run; nothing from it remains in the tree.

THE DEFECT IT ANSWERS: `jalsa/scripts/reset-test-db.mjs` filtered six tables on `created_at`.
`audit_entry` timestamps with `at`, so CI on main @ 91004d1 emptied the other five and then
refused - `column audit_entry.created_at does not exist`. The existing rung could not see it:
`declaresColumn('created_at')` asks whether the NAME appears anywhere in the migrations, and
fifteen tables have one. Ownership is the question that can fail.

NOT OBSERVED FAILING: "the table-aware parse actually parsed", "every bill column the app writes
by name exists ON THE BILL TABLE", and "the hand-swept columns are on the tables the application
writes them to". All three were already true of this tree; they are asserted so the new parser
carries its own parsed-something assertion (binding rule 3) and so the 12-Sep sweep is pinned with
its owning table rather than by name alone.

NOT OBSERVED FAILING: the reset script's own fix. `uxmyomxtosjlkvjxnvpy` is unreachable from the
build container (no secret key, and the host is not in its egress allowlist), so the corrected
delete loop has not been executed end to end. The predicate was verified against that database
read-only instead: `where id is not null` parses on all six tables; `where created_at >=
'1970-01-01'` still fails on `audit_entry` with 42703. The end-to-end proof is the next CI run.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (eighth) - the after-discount figure

FAIL-FIRST: jalsa/tests/unit/discount-both-ways.unit.spec.ts (appended) - modelled against what the
screen actually showed before this change: the discount and the base ("Taken once: Rs100 off
Rs1,300"), never the answer, using the naive `base - discount` a person reaches for without GST
in mind. **1 failed**: "the after-discount payable recharges GST on the reduced amount" -
`expected 1260, received 1200`.

Neither figure on the screen was the one the cashier needed: 1200 is the food after the discount,
1365 is the payable BEFORE it, and the guest hands over 1260.

NOT OBSERVED FAILING: "the preview IS the closure figure" and "a tip is added after tax, so a
discount never touches it". Both were already true of `totalBill`; they are asserted because the
screen now CALLS that function rather than repeating the rule, and the whole value of that choice
is that the two can never drift apart.

NOT OBSERVED FAILING: the layout itself - two fields in one row, and the captain's discount block
moving above Paid by. Owner-surface UI the functional tier cannot reach without a database.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (seventh) - a column name nothing was checking

FAIL-FIRST: jalsa/tests/unit/schema-columns.unit.spec.ts - run against the mapping exactly as it
shipped (`{ captain: 'captain_id', waiter: 'waiter_id' }`): **1 failed** -
`bill.captain_id must be declared in the core schema - expected true, received false`.

THE INCIDENT, recorded because it happened twice in one afternoon:
  1. `closeBill` shipped writing `discount_type` before its migration was applied. PostgREST
     rejected the update and bill closure broke in production.
  2. `reassignBillStaff` shipped writing `captain_id` / `waiter_id`. The real columns are
     `captain_staff_id` / `waiter_staff_id`, so "Change captain" would have thrown on every use.

Both are the same class: **application code naming a database column, with nothing checking the
column exists.** A column name is a string by the time PostgREST sees it, so tsc, the build, lint
and every existing spec are blind to it. The second was found BY ACCIDENT - a snapshot query
failed while applying the first one's migration - which is not a detection mechanism.

The rung reads the migration files rather than a live connection: the gate must run where there is
no database, and a rung that needs one is a rung that skips, and a skip reads as a pass. It carries
its own parsed-something assertion (binding rule 3) so a glob matching zero files cannot make every
other assertion vacuously true.

NOT OBSERVED FAILING: "the two roles map to two different columns" and "the other columns this run
added writes for are all real" - both were correct before the fix, and are asserted to pin a
hand-sweep of the live schema so it need not be repeated from memory.

WHAT THE RUNG STILL CANNOT SEE: whether a migration has been APPLIED to a given database. That is
a deployment question, and it is the half that broke production. Recorded rather than pretended
away.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (sixth) - column filters on the owner's tables

FAIL-FIRST: jalsa/tests/unit/column-filters.unit.spec.ts - run against the pre-change tree, modelled
exactly (`list-controls.ts` held SET-MEMBERSHIP filters only: no text kind, no range kind, no
notion of a per-column filter being "active", nothing counting columns for a badge). **4 failed**:
  - "a text filter narrows by what the cell contains" - `expected false, received true`. There was
    no text kind, so everything matched.
  - "a range filter keeps only what falls between its ends" - the same.
  - "the badge counts the columns actually narrowing the list" - `expected 2, received 0`.
  - "an emptied filter is not an active one" - `expected true, received false`: nothing could be
    active, so nothing could be counted or marked.

NOT OBSERVED FAILING: nothing in that file. The assertion worth naming is "a filter that matches
nothing returns nothing, rather than quietly returning everything" - a bad match rule that falls
back to `true` looks exactly like a working filter on a list where most rows happen to match, and
it was run red first with the rest.

NOT OBSERVED FAILING: the control itself (the header popover, the badge, Clear all). It is UI on
an owner screen the functional tier cannot reach without a database, and this container has no
egress. The pure rules underneath it are the ones carrying the evidence above.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (fifth) - one discount on both closure screens, and the captain's name

FAIL-FIRST: jalsa/tests/unit/discount-both-ways.unit.spec.ts - run against the pre-change tree,
modelled exactly (no shared both-ways helper existed at all: the owner's dialog had a
string-returning `mirrorDiscount`, the captain's sheet had a single percentage box, and there was
no `bill.reassign_staff` key). **3 failed**:
  - "a percentage becomes the rupees it comes to" - `expected {pct:10,amount:10}, received
    {pct:0,amount:0}`.
  - "an amount becomes the percentage it represents" - the same, the other way round.
  - "there is a permission for changing the captain on a bill" - `expected [..] to contain
    "bill.reassign_staff"`.

NOT OBSERVED FAILING: nothing in that file; every assertion was run red first, including the
requester's own ten cases.

DELIBERATE DEVIATION, recorded rather than fudged: the requester's case 3 asks for "Bill ₹1,030 →
5% → ₹51.50". The spec asserts **₹52**. This application holds money in integer rupees (JP-5,
CLAUDE.md, enforced by money.unit.spec.ts), and ₹52 is what the bill is actually discounted by,
what GST is then charged on, and what the ledger records. A box reading ₹51.50 beside a bill
discounted by ₹52 would be worse than no box. Moving the application to paise is a real option and
a separate piece of work.

NOT OBSERVED FAILING: the cancel-dialog string change ("Order status needs to be verified before
cancelling...") - a visible string with no behaviour behind it. The permission rule that decides
whether a captain may cancel or must escalate is untouched, and its rungs are unchanged. No new
rung was added; recorded here rather than left silent.

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

