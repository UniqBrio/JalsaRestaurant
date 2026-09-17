# Test summary

_Newest run first. Append-only: never overwrite a prior run._

---

## Gate run - 2026-09-17 (third) - VERDICT: BLOCKED

Closed today -> the bill, in full, with Print and Share to whatsapp.

- **Static + audits** - PASS. `npm run audit:all` 10/10.
- **Types** - PASS. **Lint** - PASS over all of `src/`.
- **Unit + render tiers** - PASS. **579/579** (up from 559; +20 unit).
- **G8 Functional / integration** - **BLOCKED**, same reason as the two runs below: the only app
  instance here points at the project holding the only copy of real data.

WHAT THE TESTID AUDIT CAUGHT, TWICE, AND IT WAS RIGHT BOTH TIMES
  1. The share control was `Button asChild` wrapping an anchor. The audit reads the source, so
     it saw an anchor with no id - and it was correct that the anchor is the element that ships.
     Rewritten as a real anchor carrying `buttonVariants`, which is also better: middle-click,
     long-press and "open in new tab" all work, and a screen reader announces a link.
  2. Then it flagged the comment EXPLAINING that change, because a bare angle-bracket tag in
     prose matches its element regex. Reworded. Noted in the file so the next person does not
     rediscover it.

TWO SPEC ASSERTIONS CORRECTED, RECORDED RATHER THAN QUIETLY WIDENED
  1. `bill-share.unit` asserted the share URL contained no apostrophe. Wrong:
     `encodeURIComponent` leaves `'` alone because it is legal in a query string, and nothing
     truncates on it. The round-trip assertion is what actually proves the message arrives
     whole, and it stays.
  2. `bill-detail-wiring.unit` asserted the literal `>Print<`. The formatter breaks a multi-prop
     button across lines, so that literal never appears in correctly formatted code. Matched
     from the testid to the label instead.

FAIL-FIRST: tests/unit/bill-share.unit.spec.ts - four deliberate defects, one per run, each
reverted; the suite returned to 11 passed each time.
  - cancelled lines billed to the guest (removed the skip): **1 failed, 10 passed**
  - GST hard-coded instead of the bill's own totals rows: **3 failed, 8 passed**
  - an open bill claiming it was paid (`if (true)`): **1 failed, 10 passed**
  - the text not URL-encoded: **1 failed, 10 passed**
FAIL-FIRST: tests/unit/bill-detail-wiring.unit.spec.ts - **8 failed, 1 passed** with
BillDetailSheet.tsx replaced by a placeholder and Payments.tsx and globals.css checked out.
NOT OBSERVED FAILING: the 1 that passed is the print-block scoping test - the pre-change block
had no unscoped hide rule either, so it guards against a regression rather than proving a defect.

_Merge blocked: G8 BLOCKED._

---

## Gate run - 2026-09-17 (second) - VERDICT: BLOCKED

Record payment: the order details moved onto a left pane.

- **Static + audits** - PASS. `npm run audit:all` 10/10.
- **Types** - PASS. `tsc --noEmit` clean. **Lint** - PASS.
- **Unit + render tiers** - PASS. **559/559** (up from 524; +8 unit, +27 render).
- **G8 Functional / integration** - **BLOCKED**, unchanged and for the same reason as the run
  below: the only app instance here points at the project holding the only copy of real data.
  Not re-run. A step that did not run is BLOCKED and says why.

WHAT THE RENDER SPEC FOUND, AND IT WAS A REAL DEFECT, NOT A TEST PROBLEM
  `md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` alone was not enough. Below `md` there was no
  explicit column at all, so the grid got ONE `auto` track, `auto` sizes to max-content, and a
  dish name with no space in it therefore set the dialog's width. The panes spilled out of the
  dialog at **430, 390, 375, 360 and 320px** - every phone. Fixed by `grid-cols-1` at the base
  (Tailwind emits `repeat(1, minmax(0, 1fr))`). No class-name assertion could have found this,
  which is the whole argument for the render tier.

TWO SPEC BUGS OF MY OWN, RECORDED RATHER THAN QUIETLY FIXED
  1. `close-bill-order-pane.unit.spec.ts` first asserted the file contained no `send<` at all.
     Wrong: the close-bill write has always used one. The assertion now counts sends (exactly
     one) and names it, which is the claim actually worth making.
  2. `close-bill-panes.render.spec.ts` first compared a pane's viewport x-coordinate against the
     dialog's WIDTH. The dialog is centred, so its left edge is not 0 and the two numbers were
     never comparable; it reported a spill at every width. It now measures the dialog's content
     box and compares edges to edges.

FAIL-FIRST: tests/unit/close-bill-order-pane.unit.spec.ts - **5 failed, 3 passed** against the
pre-change tree (`git checkout` of CloseBillSheet.tsx): "the rounds must come from the bill",
"the veg/non-veg mark", the money-pane testid, "the grid must be responsive", the empty-state
testid.
NOT OBSERVED FAILING: the 3 that passed are regression guards by construction - the parse-found-
the-dialog sanity check (must pass on both trees or the suite is measuring the wrong file), the
per-table list already being exactly one, and no data-layer import already being true.
FAIL-FIRST: tests/render/close-bill-panes.render.spec.ts - **9 failed, 18 passed** with the
component stashed and `GRID` set to the shipped `flex flex-col gap-4`: the class pin went red,
and every side-by-side assertion from 768px up reported `both panes start on the same line
(y 900 vs 936)`. The 18 that passed are the containment checks (a flex column contains fine) and
the stacked checks at phone widths (a flex column does stack) - recorded rather than smoothed
over, because they are not evidence of the defect.

_Merge blocked: G8 BLOCKED._

---

## Gate run - 2026-09-17 - VERDICT: BLOCKED

Steps run directly rather than through `npm run gate`; the gate's own G8 was **stopped on
purpose** and is recorded BLOCKED, not skipped and not passed.

- **Static + audits** - PASS. `npm run audit:all` 10/10 (colors, testids, columns, fixtures,
  deadweight, pwa, typography, assets all zero-violation).
- **Types** - PASS. `tsc --noEmit` clean.
- **Lint** - PASS on every changed source file.
- **Unit + render tiers** - PASS. **524/524** across `tests/unit` and `tests/render`.
- **G8 Functional / integration** - **BLOCKED**.

_Why G8 is BLOCKED and not FAIL or PASS._ The functional tier drives the running app, and the
only app instance available here reads `.env.local`, which points at the project holding the
ONLY copy of the restaurant's real data. `npm run gate` was started without that being checked;
it ran 16:21-16:24 UTC and was killed. The database was then read to establish what it had
written: the newest row of any kind in that project is **16:17:55 UTC** - four minutes before
the run started - and every row in the window belongs to a person driving table A5 by hand
(KOT-120/121/122, a Need water and a Water bottle request, four tips). **Zero rows written.**

The tier was not re-run and must not be until a non-production target is reachable. Two
functional specs in this commit had selectors repointed for the new action bar
(`guest-upsell-pay` -> `guest-upsell-confirm`, `guest-upsell-skip` -> `guest-upsell-tip`) and
those edits are therefore **unexecuted**. A step that did not run is BLOCKED and says why.

FAIL-FIRST: tests/unit/upsell-action-bar.unit.spec.ts - 5 failed, 1 passed against the pre-fix
bar; ids came back ['guest-upsell-pay','guest-upsell-continue-ordering','guest-upsell-skip'],
"no nested flex row inside the bar", "the tip button must exist · expected > -1".
NOT OBSERVED FAILING: tests/unit/upsell-action-bar.unit.spec.ts:119 (the 6th case) - it guards
the `resume-ordering` write that the request's MUST NOT CHANGE line protects, so it passes on
both trees by design.
FAIL-FIRST: tests/render/guest-upsell-bar.render.spec.ts - 20 failed, 6 passed against the
three-button row; "each button gets its own line (y: 840, 842, 842)" at all 13 widths, and
"No thanks, continue to payment (x 554 -> 841, viewport 834)". The 6 that passed are the
viewport half at 1024px and wider, where the old row genuinely fit.
FAIL-FIRST: tests/render/settings-submenu.render.spec.ts - 15 failed, 4 passed with
CHIP_NAV_WRAP holding its shipped non-wrapping value; "Printers & machines (x 1271 -> 1421,
viewport 1280)", "the nav must not scroll sideways (1405 > 1248)".
FAIL-FIRST: tests/unit/bill-role-eligibility.unit.spec.ts - 6 failed, 3 passed against the
picker that listed every active person and the server that checked nothing.
FAIL-FIRST: tests/unit/function-overloads.unit.spec.ts - 2 failed, 3 passed with the DROP
migration removed; "widen a function by DROPPING the narrow signature first, as verify_staff_pin
does". The parse-found-functions assertion passed, which is what proves the 2 failures are real
rather than an empty scan.
NOT OBSERVED FAILING: tests/render/responsive-sweep.render.spec.ts - it is a standing sweep of
the reachable routes at 13 widths, not the proof of one fix; it passed 79/79 on first run. The
defect it would have caught is the one settings-submenu.render.spec.ts records above, on a route
this sweep cannot sign into.

_Merge blocked: G8 BLOCKED. BLOCKED is a verdict that may be committed; silence is not._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 10s total - slowest G8 Functional / integration (52.5s).

- **G1 Theme artifacts in sync** - PASS (47ms)
- **G2 Contrast (all tokens, both themes)** - PASS (43ms)
- **G3 Theme assets present per theme** - PASS (46ms)
- **G4 No hard-coded colours** - PASS (56ms)
- **G5 Types** - PASS (1.8s)
- **G6 Lint** - PASS (6.8s)
- **G7 Unit + pure specs** - PASS (6.1s)
- **G8 Functional / integration** - FAIL (52.5s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (54ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.7s)
- **G11 Wide tables are configurable** - PASS (46ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 09s total - slowest G8 Functional / integration (52.5s).

- **G1 Theme artifacts in sync** - PASS (43ms)
- **G2 Contrast (all tokens, both themes)** - PASS (43ms)
- **G3 Theme assets present per theme** - PASS (44ms)
- **G4 No hard-coded colours** - PASS (61ms)
- **G5 Types** - PASS (1.7s)
- **G6 Lint** - PASS (6.6s)
- **G7 Unit + pure specs** - PASS (5.9s)
- **G8 Functional / integration** - FAIL (52.5s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (48ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.3s)
- **G11 Wide tables are configurable** - PASS (50ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 09s total - slowest G8 Functional / integration (52.6s).

- **G1 Theme artifacts in sync** - PASS (41ms)
- **G2 Contrast (all tokens, both themes)** - PASS (42ms)
- **G3 Theme assets present per theme** - PASS (40ms)
- **G4 No hard-coded colours** - PASS (57ms)
- **G5 Types** - PASS (1.6s)
- **G6 Lint** - PASS (6.5s)
- **G7 Unit + pure specs** - PASS (6.1s)
- **G8 Functional / integration** - FAIL (52.6s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (47ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.4s)
- **G11 Wide tables are configurable** - PASS (48ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 15s total - slowest G8 Functional / integration (55.1s).

- **G1 Theme artifacts in sync** - PASS (51ms)
- **G2 Contrast (all tokens, both themes)** - PASS (48ms)
- **G3 Theme assets present per theme** - PASS (55ms)
- **G4 No hard-coded colours** - PASS (64ms)
- **G5 Types** - PASS (1.9s)
- **G6 Lint** - PASS (8.3s)
- **G7 Unit + pure specs** - PASS (6.4s)
- **G8 Functional / integration** - FAIL (55.1s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (57ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.7s)
- **G11 Wide tables are configurable** - PASS (51ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 23s total - slowest G8 Functional / integration (1m 01s).

- **G1 Theme artifacts in sync** - PASS (51ms)
- **G2 Contrast (all tokens, both themes)** - PASS (49ms)
- **G3 Theme assets present per theme** - PASS (50ms)
- **G4 No hard-coded colours** - PASS (68ms)
- **G5 Types** - PASS (2.0s)
- **G6 Lint** - PASS (9.2s)
- **G7 Unit + pure specs** - PASS (7.2s)
- **G8 Functional / integration** - FAIL (1m 01s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (56ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.8s)
- **G11 Wide tables are configurable** - PASS (56ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 21s total - slowest G8 Functional / integration (1m 00s).

- **G1 Theme artifacts in sync** - PASS (54ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (60ms)
- **G4 No hard-coded colours** - PASS (68ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (8.4s)
- **G7 Unit + pure specs** - PASS (7.0s)
- **G8 Functional / integration** - FAIL (1m 00s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (55ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.8s)
- **G11 Wide tables are configurable** - PASS (55ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 21s total - slowest G8 Functional / integration (1m 00s).

- **G1 Theme artifacts in sync** - PASS (49ms)
- **G2 Contrast (all tokens, both themes)** - PASS (50ms)
- **G3 Theme assets present per theme** - PASS (51ms)
- **G4 No hard-coded colours** - PASS (65ms)
- **G5 Types** - PASS (2.0s)
- **G6 Lint** - PASS (8.2s)
- **G7 Unit + pure specs** - PASS (6.8s)
- **G8 Functional / integration** - FAIL (1m 00s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (59ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.8s)
- **G11 Wide tables are configurable** - PASS (60ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## FAIL-FIRST EVIDENCE - 2026-09-16 (twelfth) - separating a table from a group bill

FAIL-FIRST: tests/unit/separate-a-table.unit.spec.ts - NEW, so it did not collect against the
pre-change tree (`billSeparability` did not exist). Two deliberate defects were put into the
finished predicate and the suite re-run.

Removing the `payment_requested` branch: **2 failed, 9 passed** - "the refusal for a payment
request names the thing to do instead" and "the four refusals say four different things". Worth
recording exactly, because it is the more interesting of the two: "A TABLE THAT HAS ASKED TO PAY
CANNOT BE SEPARATED" still PASSED. The table was still refused, by the generic not-open branch
below it. The BEHAVIOUR survived the defect; the useful sentence did not. That is why the wording
is asserted separately - a bill whose guest is waiting to pay, told it is "closed", sends the host
looking for a closure that never happened instead of at Withdraw, which is one tap away.

Removing the host-table branch: **3 failed, 8 passed** - "THE HOST TABLE CANNOT LEAVE ITS OWN
BILL", "the host refusal points at the other tables", and "every refusal carries a sentence".
`host_table_id` anchors the bill's code; detaching it leaves a bill whose host table belongs to a
different bill, which is the same table claimed twice and is what the partial unique index exists
to prevent.

Both reverted; 11 passed.

---

## FAIL-FIRST EVIDENCE - 2026-09-16 (eleventh) - the signed document, and the one date range

Both files are NEW, so neither collected against the pre-fix tree. Four deliberate defects were
introduced into the finished modules and each suite re-run.

FAIL-FIRST: tests/unit/hr-documents.unit.spec.ts - `merge()` returning `{ text: '', placeholder:
false }` for a blank value instead of the bracketed label: **5 failed, 22 passed** - "A BLANK
VALUE IS NEVER A BLANK STRING", "a placeholder cannot be mistaken for the sentence around it",
"whitespace is not a value", "undefined and null are the same as empty", and "AN UNPARSEABLE DATE
RETURNS EMPTY so the merge marks it". That is the defect the flowchart's own rule exists to
prevent: an offer letter reading "a gross monthly salary of  , subject to applicable statutory
deductions" is a blank cheque that looks like a typo. Separately, `pronounsFor` falling back to
he/him on an empty gender field: **1 failed, 26 passed** - "an unrecorded gender is THEY, never a
guess from the name". Both reverted; 27 passed.

FAIL-FIRST: tests/unit/report-range.unit.spec.ts - `checkRange` swapping a reversed pair instead
of refusing it: **2 failed, 19 passed** - "A REVERSED RANGE IS REFUSED, never quietly swapped" and
"a refused range is still returned unchanged". A swap hands back a correct-looking report for a
question nobody asked. Separately, `summarise` computing net as `sales + tips - purchases`:
**2 failed, 19 passed** - "THE NET EXCLUDES TIPS" and "tips are reported separately and never
folded into sales", which overstates the business by the staff's own money. Both reverted;
21 passed.

---

## FAIL-FIRST EVIDENCE - 2026-09-16 (tenth) - the character grid and the routing fallback

Both files are NEW, so against the pre-fix tree neither collected: the modules did not exist and
the import threw, which proves the files are new rather than that their assertions can fail. Four
deliberate defects were therefore introduced into the finished modules and each suite re-run.

FAIL-FIRST: tests/unit/print-template.unit.spec.ts - `validateTemplate` returning
`canSave: true` regardless of its own failures: **4 failed, 30 passed** - "AN OVER-WIDTH LINE
BLOCKS THE SAVE", "a printable width WIDER than the roll is refused", "AUTO-FIT PRODUCES A
TEMPLATE THAT ACTUALLY VALIDATES", and, from the second defect, "A REPRINT IS MARKED BEFORE
ANYTHING ELSE" with the band spliced in below the header instead of prepended (`expected the
first line to contain *** REPRINT ***`). The first is the defect the design's own failure note
describes - an over-width line does not shrink on a thermal printer, it disappears, and a warning
nobody is forced to read is how it reaches the kitchen. The second is a cook reading the top of
an unmarked reprint and cooking the round twice.

FAIL-FIRST: tests/unit/print-routing.unit.spec.ts - `resolvePrinter` returning
`{ printer: null }` when the claiming machine is unreachable instead of falling back: **3 failed,
15 passed**, among them "AN UNREACHABLE STATION FALLS BACK TO THE MAIN KITCHEN - a ticket never
vanishes". Separately, the fallback decision reporting the FALLBACK machine's station rather than
the intended one: **2 failed, 16 passed** - "A FALLBACK TICKET CARRIES THE STATION IT WAS MEANT
FOR" (`expected "Tandoor", received "Main Kitchen"`). A tandoor ticket coming out of the main
kitchen machine stamped "Main Kitchen" is picked up by the wrong cook.

All four defects were reverted; the suites returned to 34 and 18 passed respectively.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (eighth) - the after-discount figure

FAIL-FIRST: tests/unit/discount-both-ways.unit.spec.ts (appended) - modelled against what the
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

FAIL-FIRST: tests/unit/schema-columns.unit.spec.ts - run against the mapping exactly as it
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

FAIL-FIRST: tests/unit/column-filters.unit.spec.ts - run against the pre-change tree, modelled
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

FAIL-FIRST: tests/unit/discount-both-ways.unit.spec.ts - run against the pre-change tree,
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

FAIL-FIRST: tests/unit/stale-notice.unit.spec.ts - run against the pre-change rule, modelled
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

FAIL-FIRST: tests/unit/free-a-table.unit.spec.ts - run against the pre-change tree (the Tables
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

FAIL-FIRST: tests/unit/cart-draft.unit.spec.ts - run against the pre-change tree's own
rules, modelled exactly (a row's quantity was `item.inCart` and nothing else, no overlay existed,
and `runBusy` opened with `if (busy) return`). **3 failed**:
  - "a tap shows on the row before the server has confirmed it" - `expected 2, received 0`. The
    number under the guest's thumb was the last thing on the screen to move.
  - "the bar appears on the first add, not a round trip later" - `expected 1, received 0`. The
    Review order bar is gated on the count, so the first add left the screen looking inert.
  - "a second tap during a write is never silently dropped" - `expected "ran", received
    "dropped"`. This is the half that made it look erratic rather than merely slow.

NOT OBSERVED FAILING: tests/functional/guest-total-visibility.functional.spec.ts, the
appended rung "a tap lands on the row at once, and a run of taps all count" - it cannot execute
here (no database egress; curl to the project REST endpoint returns 000). Its timeouts are
deliberately tight (400ms) so that it could not pass on the old write-then-wait behaviour, and
its last assertion covers the risk this fix INTRODUCES: the 200ms collapse window means the
screen can be ahead of the stored cart, and Send reads the stored cart, so a tap made just
before Send must still be in the round. First execution is the next CI run.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 (second batch) - closure path, tip, dashboard, discount

FAIL-FIRST: tests/unit/write-echo.unit.spec.ts - run against the pre-change tree's own rules,
modelled exactly (`send` posting then calling `refreshNow()` unconditionally; a tip row of four
fixed presets with no custom option; `UpsellScreen.add` navigating to the tip step). **3 failed**:
  - "a write that answers with the new state costs one round trip, not two" -
    `expected ["POST"], received ["POST","GET"]`.
  - "adding from the upsell screen leaves the guest on the upsell screen" -
    `expected "upsell", received "tip"`.
  - "the tip row offers a custom amount as well as the presets" - `expected true, received false`.

FAIL-FIRST: tests/unit/discount-mirror.unit.spec.ts - run against the pre-change rules (two
independent boxes, neither computing the other, preview = the SUM of both). **3 failed**:
  - "typing a percentage fills in what it comes to in rupees" -
    `expected {pct:"10",flat:"166"}, received {pct:"",flat:""}`.
  - "typing an amount fills in the percentage it represents" - same, the other way round.
  - "one discount is taken, not two" - `expected 166, received 332`. This is why the boxes could
    not simply mirror each other: `discountOf` applies the percentage and THEN the flat amount,
    so two live mirrored inputs would discount every bill twice.

FAIL-FIRST: tests/functional/closure-upsell-tip.functional.spec.ts - on this build container,
where the database is unreachable (curl to the project's REST endpoint returns 000), the first
assertion fails with `unreachable-guest` rendered instead of the welcome screen. The file goes
RED rather than silent where it cannot run.

NOT OBSERVED FAILING: tests/functional/closure-upsell-tip.functional.spec.ts (every behavioural
assertion - three tabs visible at once, adding without navigating away, the live payable, the
five-option tip row, the custom amount, Continue Ordering pausing the request and keeping the
bill) - they cannot be executed here at all, for the reason above. The first CI run against the
test project is their first execution. The PURE halves of the same changes are covered by the two
recorded red-then-green runs above.

NOT OBSERVED FAILING: the owner Dashboard move (Table requests above the floor grid, capped at
three rows with the rest scrolling inside the section). No rung was added: it is placement, and
the existing owner specs assert the section's content, which is unchanged. Recorded as the
honest negative rather than left silent.

---

## FAIL-FIRST EVIDENCE - 2026-09-12 - the guest's order total, the footer, the categories

FAIL-FIRST: tests/unit/guest-features.unit.spec.ts - run against the PRE-change tree's own
rules, modelled exactly (the owner panel's `checked={values[key] !== false}` and a
DEFAULT_FEATURES literal with no `orderTotal` in it). **3 failed**:
  - "an unsaved feature resolves to its own default, not to 'on'" - expected false, received
    true. The panel drew every unsaved key as ON, unconditionally.
  - "the owner switch and the guest phone agree about an unsaved feature" - expected false,
    received true. The switch said the guest could see their total while the phone showed none.
    This is the defect the shared module exists to make impossible.
  - "the order total is off until someone turns it on" - expected false, received undefined.
    There was no such default to read.

FAIL-FIRST: tests/functional/guest-total-visibility.functional.spec.ts - on this build
container, where the database is unreachable (curl to the project's REST endpoint returns 000),
the first assertion fails with `unreachable-guest` rendered instead of the welcome screen. That
proves the file goes RED rather than silent where it cannot run, which is the property that
matters for a spec whose real execution is in CI.

NOT OBSERVED FAILING: tests/functional/guest-total-visibility.functional.spec.ts (every
behavioural assertion - default hidden, tick reveals, choice survives navigation, nothing under
the bar, every category reachable in one tap, the thumbnail holds its space) - they cannot be
executed here at all, for the reason above. The first CI run against the test project is their
first execution, and its log is the evidence to record here in the change that proves it green.
Two of them are nonetheless known red on the pre-change tree by inspection of the diff: there
was no `guest-menu-total-toggle` element to find, and the bar overlapped its own totals card.
That is a weaker claim than a recorded run, which is why it is written here as one.

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 1m 24s total - slowest G8 Functional / integration (58.8s).

- **G1 Theme artifacts in sync** - PASS (52ms)
- **G2 Contrast (all tokens, both themes)** - PASS (54ms)
- **G3 Theme assets present per theme** - PASS (57ms)
- **G4 No hard-coded colours** - PASS (65ms)
- **G5 Types** - PASS (6.7s)
- **G6 Lint** - PASS (8.2s)
- **G7 Unit + pure specs** - PASS (7.7s)
- **G8 Functional / integration** - FAIL (58.8s)

```
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-4e119-nd-is-told-what-still-works-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-b1f49-t’s-voice-not-the-runtime’s-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-a99d4-hable-control-at-phone-size-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
    Error Context: test-results/degraded.functional-the-da-91076-nd-on-the-database-being-up-desktop/error-context.md
    Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-
... (truncated)
```

- **G9 Automation addressability** - PASS (56ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.8s)
- **G11 Wide tables are configurable** - PASS (57ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-12 - VERDICT: FAIL

Steps: 10 pass, 1 fail, 0 blocked.
Time: 3m 32s total - slowest G8 Functional / integration (2m 53s).

- **G1 Theme artifacts in sync** - PASS (68ms)
- **G2 Contrast (all tokens, both themes)** - PASS (73ms)
- **G3 Theme assets present per theme** - PASS (70ms)
- **G4 No hard-coded colours** - PASS (83ms)
- **G5 Types** - PASS (9.3s)
- **G6 Lint** - PASS (10.5s)
- **G7 Unit + pure specs** - PASS (15.2s)
- **G8 Functional / integration** - FAIL (2m 53s)

```
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop/test-failed-1.png
    Error Context: test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop/error-context.md
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/reachability.functional-th-66ce5--it-—-without-writing-a-row-desktop/test-failed-1.png
    Error Context: test-results/reachability.functional-th-66ce5--it-—-without-writing-a-row-desktop/error-context.md
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop-wide/test-failed-1.png
    Error Context: test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop-wide/error-context.md
```

- **G9 Automation addressability** - PASS (80ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.6s)
- **G11 Wide tables are configurable** - PASS (71ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Production defect - 2026-09-12 - the guest page could never open a session

Found by the user on the live Vercel deployment, not by the suite.

SYMPTOM: /t/A5 rendered "We cannot reach the till just now" while /staff and /owner both loaded
and greeted the signed-in owner by name - so the database was reachable and the secret key valid
the whole time.

ROOT CAUSE: `resolveGuest` called `writeGuestToken` -> `cookies().set()`. Next.js permits that
only in a Server Action or a Route Handler; `/t/[table]/page.tsx` is a server component, so it
threw, `attempt()` caught it, and the guest was shown the outage screen. The `guest_session` row
was INSERTED before the throw, so every scan also left an orphan row behind.

WHY THE SUITE MISSED IT: `reachability.functional.spec.ts` uses a table name that does not exist,
which returns before the insert AND before the cookie write - by design, so the suite writes
nothing. A read-only probe proves the database answers and nothing about the path that writes.
`guest-journey.functional.spec.ts` does cover it and has still never run (its only CI attempt
died at the reset step on dev-project secrets).

FIX: `src/middleware.ts` mints the guest cookie before the render (Edge-safe Web Crypto);
`resolveGuest` no longer writes cookies at all, and a table change now drops the old session row
to free its unique token instead of rotating the token.

NOT OBSERVED FAILING: no new spec. The existing guest-journey spec is the rung for this class and
needs no change; what it needs is a CI run. Recorded rather than papered over with a fresh test
that would assert the same thing in a file that also does not run.

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

