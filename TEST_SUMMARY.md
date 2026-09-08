# Test summary

_Newest run first. **Append-only: never overwrite a prior run.**_
_`## Gate run` blocks are written by `scripts/gate-runner.mjs`; guard G2 greps for them._

> The run below is real — produced while this framework was being verified. It is BLOCKED rather
> than PASS because the build environment had no package registry, so the type, lint and test
> steps could not be obtained. That is the correct verdict: those classes were **not verified**,
> and reporting them as passing would be exactly the green-by-omission this design prevents.
>
> Note that the blocked steps name the reason, and that the four gates needing no dependencies —
> theme sync, contrast, theme assets, and colour literals — all ran and passed.

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

