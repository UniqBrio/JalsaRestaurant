# Test summary

_Newest run first. **Append-only: never overwrite a prior run.**_
_`## Gate run` blocks are written by `scripts/gate-runner.mjs`; guard G2 greps for them._

> Every run below is real. The oldest ones report G5–G8 BLOCKED, and this header used to say
> that was because "the build environment had no package registry". It was not: the registry was
> reachable the whole time, and the starter declared no toolchain, so `npm install` produced
> nothing — anywhere (RC-011). That claim sat here for thirty-one runs and nobody executed it.
> BLOCKED was still the correct verdict for those runs: the classes were **not verified**, and
> saying so beat a green nobody had earned. What was wrong was the stated reason, and a stated
> reason is a claim like any other. From v1.33.0 the four steps run, with measured durations —
> which is the only proof that they did.
>
> Runs are append-only and are never edited; this header is documentation, and was.

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 39s total - slowest G8 Functional / integration (1m 22s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (181ms)
- **G2 Contrast (all tokens, both themes)** - PASS (120ms)
- **G3 Theme assets present per theme** - PASS (113ms)
- **G4 No hard-coded colours** - PASS (121ms)
- **G5 Types** - PASS (2.3s)
- **G6 Lint** - PASS (2.8s)
- **G7 Unit + pure specs** - PASS (4.5s)
- **G8 Functional / integration** - PASS (1m 22s)
- **G9 Automation addressability** - PASS (121ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.4s)
- **G11 Wide tables are configurable** - PASS (124ms)
- **G12 Installable as an application** - PASS (123ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 33s total - slowest G8 Functional / integration (1m 13s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (154ms)
- **G2 Contrast (all tokens, both themes)** - PASS (111ms)
- **G3 Theme assets present per theme** - PASS (109ms)
- **G4 No hard-coded colours** - PASS (133ms)
- **G5 Types** - PASS (2.6s)
- **G6 Lint** - PASS (3.8s)
- **G7 Unit + pure specs** - PASS (5.6s)
- **G8 Functional / integration** - PASS (1m 13s)
- **G9 Automation addressability** - PASS (123ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.7s)
- **G11 Wide tables are configurable** - PASS (115ms)
- **G12 Installable as an application** - PASS (121ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 49s total - slowest G8 Functional / integration (1m 27s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (280ms)
- **G2 Contrast (all tokens, both themes)** - PASS (186ms)
- **G3 Theme assets present per theme** - PASS (179ms)
- **G4 No hard-coded colours** - PASS (180ms)
- **G5 Types** - PASS (5.8s)
- **G6 Lint** - PASS (3.4s)
- **G7 Unit + pure specs** - PASS (4.9s)
- **G8 Functional / integration** - PASS (1m 27s)
- **G9 Automation addressability** - PASS (132ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.9s)
- **G11 Wide tables are configurable** - PASS (123ms)
- **G12 Installable as an application** - PASS (120ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: FAIL

Steps: 11 pass, 1 fail, 0 blocked.
Time: 1m 32s total - slowest G8 Functional / integration (1m 06s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (169ms)
- **G2 Contrast (all tokens, both themes)** - PASS (122ms)
- **G3 Theme assets present per theme** - PASS (167ms)
- **G4 No hard-coded colours** - PASS (135ms)
- **G5 Types** - PASS (5.7s)
- **G6 Lint** - PASS (3.9s)
- **G7 Unit + pure specs** - PASS (7.5s)
- **G8 Functional / integration** - FAIL (1m 06s)

```
  x    9 [desktop] › tests\functional\reference.functional.spec.ts:66:3 › reference journey › a failed save says so honestly and does not claim success (17ms)
  x   27 [desktop-wide] › tests\functional\reference.functional.spec.ts:66:3 › reference journey › a failed save says so honestly and does not claim success (13ms)
  x   45 [tablet] › tests\functional\reference.functional.spec.ts:66:3 › reference journey › a failed save says so honestly and does not claim success (13ms)
  x   63 [mobile] › tests\functional\reference.functional.spec.ts:66:3 › reference journey › a failed save says so honestly and does not claim success (13ms)
  x   81 [mobile-ios] › tests\functional\reference.functional.spec.ts:66:3 › reference journey › a failed save says so honestly and does not claim success (11ms)
  x   99 [mobile-short] › tests\functional\reference.functional.spec.ts:66:3 › reference journey › a failed save says so honestly and does not claim success (14ms)
    Error: browserType.launch: Executable doesn't exist at C:\Users\sugum\AppData\Local\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe
    Error Context: test-results\keyboard.functiona
... (truncated)
```

- **G9 Automation addressability** - PASS (142ms)
- **G10 Backward compatibility (fixtures)** - PASS (7.8s)
- **G11 Wide tables are configurable** - PASS (113ms)
- **G12 Installable as an application** - PASS (125ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-10 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 14s total - slowest G8 Functional / integration (1m 05s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (91ms)
- **G2 Contrast (all tokens, both themes)** - PASS (52ms)
- **G3 Theme assets present per theme** - PASS (51ms)
- **G4 No hard-coded colours** - PASS (56ms)
- **G5 Types** - PASS (1.4s)
- **G6 Lint** - PASS (1.7s)
- **G7 Unit + pure specs** - PASS (2.5s)
- **G8 Functional / integration** - PASS (1m 05s)
- **G9 Automation addressability** - PASS (50ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.3s)
- **G11 Wide tables are configurable** - PASS (49ms)
- **G12 Installable as an application** - PASS (43ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-10 - VERDICT: FAIL

Steps: 10 pass, 2 fail, 0 blocked.
Time: 4m 10s total - slowest G7 Unit + pure specs (2m 01s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (82ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (42ms)
- **G4 No hard-coded colours** - PASS (51ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (1.6s)
- **G7 Unit + pure specs** - FAIL (2m 01s)

```
Error: Timed out waiting 120000ms from config.webServer.
```

- **G8 Functional / integration** - FAIL (2m 01s)

```
Error: Timed out waiting 120000ms from config.webServer.
```

- **G9 Automation addressability** - PASS (55ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.1s)
- **G11 Wide tables are configurable** - PASS (51ms)
- **G12 Installable as an application** - PASS (53ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-10 - VERDICT: FAIL

Steps: 8 pass, 1 fail, 3 blocked.
Time: 9.0s total - slowest G10 Backward compatibility (fixtures) (5.4s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (247ms)
- **G2 Contrast (all tokens, both themes)** - PASS (50ms)
- **G3 Theme assets present per theme** - PASS (62ms)
- **G4 No hard-coded colours** - PASS (50ms)
- **G5 Types** - FAIL (3.1s)

```
playwright.config.ts(24,20): error TS2307: Cannot find module 'dotenv' or its corresponding type declarations.
playwright.config.ts(30,29): error TS2769: No overload matches this call.
  The last overload gave the following error.
src/components/Dialog.tsx(78,83): error TS18048: 'lastEl' is possibly 'undefined'.
src/components/Dialog.tsx(79,88): error TS18048: 'firstEl' is possibly 'undefined'.
src/components/PwaProvider.tsx(57,82): error TS2345: Argument of type 'Window & typeof globalThis' is not assignable to parameter of type '{ matchMedia?: (q: string) => { matches: boolean; }; navigator?: { standalone?: boolean; }; } | undefined'.
src/components/analytics/InsightCard.tsx(87,29): error TS2375: Type '{ key: string; insight: Insight; onAction: ((actionId: string) => void) | undefined; }' is not assignable to type '{ insight: Insight; onAction?: (actionId: string) => void; testId?: string; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
src/components/analytics/MetricCard.tsx(70,74): error TS2379: Argument of type '{ unit: string | undefined; locale?: string; currency?: string; compactStyle?: "in" | "intl"; decimals
... (truncated)
```

- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass - **30 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass - **30 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass - **30 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G9 Automation addressability** - PASS (68ms)
- **G10 Backward compatibility (fixtures)** - PASS (5.4s)
- **G11 Wide tables are configurable** - PASS (51ms)
- **G12 Installable as an application** - PASS (52ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 8 pass, 0 fail, 4 blocked.
Time: 3.6s total - slowest G10 Backward compatibility (fixtures) (3.3s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (77ms)
- **G2 Contrast (all tokens, both themes)** - PASS (49ms)
- **G3 Theme assets present per theme** - PASS (49ms)
- **G4 No hard-coded colours** - PASS (44ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified. - **29 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass - **29 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass - **29 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass - **29 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G9 Automation addressability** - PASS (42ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.3s)
- **G11 Wide tables are configurable** - PASS (51ms)
- **G12 Installable as an application** - PASS (53ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 8 pass, 0 fail, 4 blocked.
Time: 3.6s total - slowest G10 Backward compatibility (fixtures) (3.2s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (91ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (54ms)
- **G4 No hard-coded colours** - PASS (49ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified. - **28 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass - **28 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass - **28 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass - **28 consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing
- **G9 Automation addressability** - PASS (48ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.2s)
- **G11 Wide tables are configurable** - PASS (61ms)
- **G12 Installable as an application** - PASS (46ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 8 pass, 0 fail, 4 blocked.
Time: 3.5s total - slowest G10 Backward compatibility (fixtures) (3.0s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (91ms)
- **G2 Contrast (all tokens, both themes)** - PASS (55ms)
- **G3 Theme assets present per theme** - PASS (52ms)
- **G4 No hard-coded colours** - PASS (63ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (62ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.0s)
- **G11 Wide tables are configurable** - PASS (45ms)
- **G12 Installable as an application** - PASS (60ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

FAIL-FIRST: starter/tests/unit/pwa.unit.spec.ts - the module was compiled with tsc under the
starter's own strict settings (clean) and its 23 assertions executed against the COMPILED
output, not read. 23 passed. Then three defects were injected into that compiled module, one
at a time, and each failed EXACTLY ONE assertion and no others - which is the evidence that
the assertions are specific rather than blanket:
  - `previouslyDismissed` checked before `alreadyInstalled`
        -> "INSTALLED outranks dismissed" failed: got "dismissed", want "installed".
           An app that is already installed would have been offered an install.
  - `updateState` returning 'ready' for any waiting worker
        -> "a first install is NOT an update" failed: got "ready", want "none".
           A first-time visitor would have been told "a new version is ready".
  - `readDisplayMode` reading only the media query
        -> "iOS standalone is read" failed: got "browser", want "standalone".
           An iOS home-screen launch would have been treated as a browser tab.

FAIL-FIRST: scripts/pwa-baseline.test.sh - 13 cases, each breaking ONE thing in an otherwise
complete application. Case 10 ("an unlinked manifest is reported") was OBSERVED FAILING against
the first version of the audit, which matched the bare string `manifest.webmanifest` anywhere in
src/ and therefore read a COMMENT in tokens.generated.ts - one explaining why the layout does
not import the manifest file - as proof the manifest was linked. An app with its entire layout
deleted reported no problems. The detector now strips comments and requires a declaration
(`rel="manifest"` or a `manifest:` metadata field), not a mention.

FAIL-FIRST: scripts/upgrade.test.sh - "the app's installed NAME survives an upgrade" and "the
app's generated theme module is not reset to the framework's", both OBSERVED FAILING against
HEAD:scripts/lib/lineage.mjs. Reproduced end to end: `new-app --name acme-invoices`, commit,
then one `upgrade --apply` reported `public/manifest.webmanifest`, `public/offline.html` and
`src/theme/tokens.generated.ts` under "Auto-apply - pristine, framework changed them" and
renamed the installed application from "Acme Invoices" to "Default Framework App".

FAIL-FIRST: scripts/theme-build.test.sh case 11 (build isolation) - OBSERVED FAILING while this
change was being written: with the served artifacts defaulting to the working directory rather
than to the directory beside the TOKENS, a suite building a scratch app wrote its manifest and
offline page over the real starter's, stamped with a source path into a temp directory. It
surfaced as two unrelated-looking G1 failures in scripts/gate-scope.test.sh.

NOT OBSERVED FAILING: scripts/pwa-baseline.test.sh case 0 ("a complete application reports no
problems") and case 12 ("an empty tree is BLOCKED"). Both are regression guards on the audit's
contract rather than assertions about a defect, and both pass in every tree. Recorded as the
honest negative rather than claimed as fail-first evidence.


## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 8 pass, 0 fail, 4 blocked.
Time: 3.3s total - slowest G10 Backward compatibility (fixtures) (2.9s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (84ms)
- **G2 Contrast (all tokens, both themes)** - PASS (49ms)
- **G3 Theme assets present per theme** - PASS (49ms)
- **G4 No hard-coded colours** - PASS (59ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (48ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.9s)
- **G11 Wide tables are configurable** - PASS (43ms)
- **G12 Installable as an application** - PASS (53ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 8 pass, 0 fail, 4 blocked.
Time: 3.3s total - slowest G10 Backward compatibility (fixtures) (3.0s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (75ms)
- **G2 Contrast (all tokens, both themes)** - PASS (51ms)
- **G3 Theme assets present per theme** - PASS (48ms)
- **G4 No hard-coded colours** - PASS (56ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (42ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.0s)
- **G11 Wide tables are configurable** - PASS (41ms)
- **G12 Installable as an application** - PASS (51ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

FAIL-FIRST: scripts/theme-build.test.sh - 3 of 5 cases observed failing against the pre-fix
tree: identical tokens built byte-differently from the framework root and from starter/
("GENERATED ... from starter/design/tokens.json" vs "... from design/tokens.json"); --check
reported DRIFT from the application directory; and the header path did not resolve from the
generated file. Cases 3 and 5 are regression guards and correctly pass in both trees.

FAIL-FIRST: scripts/gate-scope.test.sh - 6 of 12 cases observed failing against
HEAD:scripts/gate-runner.mjs (restored for the run, replaced afterwards): the report named no
application subtree; a BLOCKED G5 named no directory to install in; a scaffolded app did not
resolve its own root; a full run recorded nothing under --logdir; a genuinely new tree was
announced "avoidable"; and --logdir was ignored, writing step logs into the subject's own
.gate-logs/. Instance 3 was additionally reproduced by hand: gate a tree, edit a file, run
npm run guard:test, gate again -> the redundancy notice fired on a mandatory run.

FAIL-FIRST: scripts/close-out.test.sh case 3 (commit width) - observed failing at 241 chars
once the fixture's appAction was made long enough to overflow. It had passed for its whole
existence against a fixture too short to exercise it.

FAIL-FIRST: scripts/close-out.test.sh cases 3a (banner scope) - both observed failing before
the fix: `--commit` alone emitted "===== commit message =====" as its first line, so the
subject line of a commit generated by redirecting it was the banner. This repository made
exactly that commit before the case existed.


## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 3.2s total - slowest G10 Backward compatibility (fixtures) (2.9s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (54ms)
- **G2 Contrast (all tokens, both themes)** - PASS (52ms)
- **G3 Theme assets present per theme** - PASS (42ms)
- **G4 No hard-coded colours** - PASS (66ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (55ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.9s)
- **G11 Wide tables are configurable** - PASS (48ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 3.1s total - slowest G10 Backward compatibility (fixtures) (2.8s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (41ms)
- **G2 Contrast (all tokens, both themes)** - PASS (47ms)
- **G3 Theme assets present per theme** - PASS (48ms)
- **G4 No hard-coded colours** - PASS (51ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (41ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.8s)
- **G11 Wide tables are configurable** - PASS (55ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 3.0s total - slowest G10 Backward compatibility (fixtures) (2.7s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (52ms)
- **G2 Contrast (all tokens, both themes)** - PASS (52ms)
- **G3 Theme assets present per theme** - PASS (55ms)
- **G4 No hard-coded colours** - PASS (46ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (56ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.7s)
- **G11 Wide tables are configurable** - PASS (45ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 3.0s total - slowest G10 Backward compatibility (fixtures) (2.7s).
Application steps ran in starter

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (56ms)
- **G2 Contrast (all tokens, both themes)** - PASS (52ms)
- **G3 Theme assets present per theme** - PASS (52ms)
- **G4 No hard-coded colours** - PASS (51ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" in starter - not fetched from the registry on purpose. Run `npm install` in starter (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (48ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.7s)
- **G11 Wide tables are configurable** - PASS (53ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-10 - VERDICT: BLOCKED

Steps: 7 pass, 0 fail, 4 blocked.
Time: 3.2s total - slowest G10 Backward compatibility (fixtures) (2.9s).

> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this verdict was already known. The gate verifies a TREE, not a change: corrections landing in one commit share one verification, and only the last run describes what ships. Corrections in SEPARATE commits each need their own, so every commit is independently bisectable.

- **G1 Theme artifacts in sync** - PASS (56ms)
- **G2 Contrast (all tokens, both themes)** - PASS (66ms)
- **G3 Theme assets present per theme** - PASS (51ms)
- **G4 No hard-coded colours** - PASS (51ms)
- **G5 Types** - BLOCKED (-) - no local "tsc" - not fetched from the registry on purpose. Run `npm install` (provides typescript), or state why this class is unverified.
- **G6 Lint** - BLOCKED (-) - prerequisite G5 did not pass
- **G7 Unit + pure specs** - BLOCKED (-) - prerequisite G5 did not pass
- **G8 Functional / integration** - BLOCKED (-) - prerequisite G5 did not pass
- **G9 Automation addressability** - PASS (49ms)
- **G10 Backward compatibility (fixtures)** - PASS (2.9s)
- **G11 Wide tables are configurable** - PASS (55ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

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

