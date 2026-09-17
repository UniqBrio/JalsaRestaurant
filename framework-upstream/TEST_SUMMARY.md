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

## Gate run - 2026-09-14 - VERDICT: FAIL

Steps: 13 pass, 1 fail, 0 blocked.
Time: 58.6s total - slowest G8 Functional / integration (22.3s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (215ms)
- **G2 Contrast (all tokens, both themes)** - PASS (154ms)
- **G3 Theme assets present per theme** - PASS (126ms)
- **G4 No hard-coded colours** - PASS (187ms)
- **G5 Types** - PASS (3.3s)
- **G6 Lint** - PASS (7.1s)
- **G7 Unit + pure specs** - PASS (8.9s)
- **G8 Functional / integration** - FAIL (22.3s)

```
Error: Process from config.webServer was not able to start. Exit code: 1
[WebServer] ⚠ Attempted to load @next/swc-win32-x64-msvc, but an error occurred: An Application Control policy has blocked this file.
[WebServer] Error: Turbopack is not supported on this platform (win32/x64) because native bindings are not available. Only WebAssembly (WASM) bindings were loaded, and Turbopack requires native bindings.
```

- **G9 Automation addressability** - PASS (147ms)
- **G10 Backward compatibility (fixtures)** - PASS (15.7s)
- **G11 Wide tables are configurable** - PASS (126ms)
- **G12 Installable as an application** - PASS (137ms)
- **G13 Approved design still being built** - PASS (110ms)
- **G14 Supabase reads survive table growth** - PASS (138ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 13 pass, 0 fail, 0 blocked.
Time: 2m 44s total - slowest G8 Functional / integration (2m 12s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (312ms)
- **G2 Contrast (all tokens, both themes)** - PASS (171ms)
- **G3 Theme assets present per theme** - PASS (147ms)
- **G4 No hard-coded colours** - PASS (171ms)
- **G5 Types** - PASS (2.9s)
- **G6 Lint** - PASS (4.6s)
- **G7 Unit + pure specs** - PASS (5.7s)
- **G8 Functional / integration** - PASS (2m 12s)
- **G9 Automation addressability** - PASS (160ms)
- **G10 Backward compatibility (fixtures)** - PASS (17.0s)
- **G11 Wide tables are configurable** - PASS (359ms)
- **G12 Installable as an application** - PASS (400ms)
- **G13 Approved design still being built** - PASS (247ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 42s total - slowest G8 Functional / integration (2m 13s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (152ms)
- **G2 Contrast (all tokens, both themes)** - PASS (107ms)
- **G3 Theme assets present per theme** - PASS (114ms)
- **G4 No hard-coded colours** - PASS (126ms)
- **G5 Types** - PASS (2.5s)
- **G6 Lint** - PASS (3.7s)
- **G7 Unit + pure specs** - PASS (5.0s)
- **G8 Functional / integration** - PASS (2m 13s)
- **G9 Automation addressability** - PASS (137ms)
- **G10 Backward compatibility (fixtures)** - PASS (16.5s)
- **G11 Wide tables are configurable** - PASS (117ms)
- **G12 Installable as an application** - PASS (127ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 57s total - slowest G8 Functional / integration (2m 31s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (155ms)
- **G2 Contrast (all tokens, both themes)** - PASS (110ms)
- **G3 Theme assets present per theme** - PASS (109ms)
- **G4 No hard-coded colours** - PASS (155ms)
- **G5 Types** - PASS (2.3s)
- **G6 Lint** - PASS (4.1s)
- **G7 Unit + pure specs** - PASS (5.3s)
- **G8 Functional / integration** - PASS (2m 31s)
- **G9 Automation addressability** - PASS (134ms)
- **G10 Backward compatibility (fixtures)** - PASS (13.9s)
- **G11 Wide tables are configurable** - PASS (132ms)
- **G12 Installable as an application** - PASS (137ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 54s total - slowest G8 Functional / integration (2m 27s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (244ms)
- **G2 Contrast (all tokens, both themes)** - PASS (126ms)
- **G3 Theme assets present per theme** - PASS (155ms)
- **G4 No hard-coded colours** - PASS (143ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (3.2s)
- **G7 Unit + pure specs** - PASS (6.9s)
- **G8 Functional / integration** - PASS (2m 27s)
- **G9 Automation addressability** - PASS (132ms)
- **G10 Backward compatibility (fixtures)** - PASS (12.9s)
- **G11 Wide tables are configurable** - PASS (122ms)
- **G12 Installable as an application** - PASS (122ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 29s total - slowest G8 Functional / integration (2m 05s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (152ms)
- **G2 Contrast (all tokens, both themes)** - PASS (108ms)
- **G3 Theme assets present per theme** - PASS (145ms)
- **G4 No hard-coded colours** - PASS (122ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (3.1s)
- **G7 Unit + pure specs** - PASS (6.4s)
- **G8 Functional / integration** - PASS (2m 05s)
- **G9 Automation addressability** - PASS (124ms)
- **G10 Backward compatibility (fixtures)** - PASS (11.4s)
- **G11 Wide tables are configurable** - PASS (114ms)
- **G12 Installable as an application** - PASS (124ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 33s total - slowest G8 Functional / integration (2m 08s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (177ms)
- **G2 Contrast (all tokens, both themes)** - PASS (114ms)
- **G3 Theme assets present per theme** - PASS (111ms)
- **G4 No hard-coded colours** - PASS (130ms)
- **G5 Types** - PASS (2.3s)
- **G6 Lint** - PASS (3.2s)
- **G7 Unit + pure specs** - PASS (6.3s)
- **G8 Functional / integration** - PASS (2m 08s)
- **G9 Automation addressability** - PASS (122ms)
- **G10 Backward compatibility (fixtures)** - PASS (11.6s)
- **G11 Wide tables are configurable** - PASS (125ms)
- **G12 Installable as an application** - PASS (130ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 36s total - slowest G8 Functional / integration (2m 11s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (158ms)
- **G2 Contrast (all tokens, both themes)** - PASS (109ms)
- **G3 Theme assets present per theme** - PASS (120ms)
- **G4 No hard-coded colours** - PASS (157ms)
- **G5 Types** - PASS (2.7s)
- **G6 Lint** - PASS (3.0s)
- **G7 Unit + pure specs** - PASS (5.1s)
- **G8 Functional / integration** - PASS (2m 11s)
- **G9 Automation addressability** - PASS (120ms)
- **G10 Backward compatibility (fixtures)** - PASS (13.3s)
- **G11 Wide tables are configurable** - PASS (121ms)
- **G12 Installable as an application** - PASS (124ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 40s total - slowest G8 Functional / integration (2m 14s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (178ms)
- **G2 Contrast (all tokens, both themes)** - PASS (156ms)
- **G3 Theme assets present per theme** - PASS (123ms)
- **G4 No hard-coded colours** - PASS (171ms)
- **G5 Types** - PASS (2.9s)
- **G6 Lint** - PASS (3.5s)
- **G7 Unit + pure specs** - PASS (5.7s)
- **G8 Functional / integration** - PASS (2m 14s)
- **G9 Automation addressability** - PASS (134ms)
- **G10 Backward compatibility (fixtures)** - PASS (12.9s)
- **G11 Wide tables are configurable** - PASS (129ms)
- **G12 Installable as an application** - PASS (126ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 53s total - slowest G8 Functional / integration (2m 23s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (181ms)
- **G2 Contrast (all tokens, both themes)** - PASS (123ms)
- **G3 Theme assets present per theme** - PASS (131ms)
- **G4 No hard-coded colours** - PASS (168ms)
- **G5 Types** - PASS (3.3s)
- **G6 Lint** - PASS (5.5s)
- **G7 Unit + pure specs** - PASS (6.6s)
- **G8 Functional / integration** - PASS (2m 23s)
- **G9 Automation addressability** - PASS (121ms)
- **G10 Backward compatibility (fixtures)** - PASS (13.3s)
- **G11 Wide tables are configurable** - PASS (133ms)
- **G12 Installable as an application** - PASS (157ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-13 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 3m 40s total - slowest G8 Functional / integration (3m 12s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (155ms)
- **G2 Contrast (all tokens, both themes)** - PASS (114ms)
- **G3 Theme assets present per theme** - PASS (107ms)
- **G4 No hard-coded colours** - PASS (161ms)
- **G5 Types** - PASS (2.6s)
- **G6 Lint** - PASS (4.2s)
- **G7 Unit + pure specs** - PASS (5.1s)
- **G8 Functional / integration** - PASS (3m 12s)
- **G9 Automation addressability** - PASS (196ms)
- **G10 Backward compatibility (fixtures)** - PASS (14.8s)
- **G11 Wide tables are configurable** - PASS (133ms)
- **G12 Installable as an application** - PASS (151ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 53s total - slowest G8 Functional / integration (2m 21s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (225ms)
- **G2 Contrast (all tokens, both themes)** - PASS (170ms)
- **G3 Theme assets present per theme** - PASS (158ms)
- **G4 No hard-coded colours** - PASS (191ms)
- **G5 Types** - PASS (3.2s)
- **G6 Lint** - PASS (4.4s)
- **G7 Unit + pure specs** - PASS (6.4s)
- **G8 Functional / integration** - PASS (2m 21s)
- **G9 Automation addressability** - PASS (174ms)
- **G10 Backward compatibility (fixtures)** - PASS (16.5s)
- **G11 Wide tables are configurable** - PASS (166ms)
- **G12 Installable as an application** - PASS (181ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 3m 03s total - slowest G8 Functional / integration (2m 35s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (195ms)
- **G2 Contrast (all tokens, both themes)** - PASS (130ms)
- **G3 Theme assets present per theme** - PASS (121ms)
- **G4 No hard-coded colours** - PASS (138ms)
- **G5 Types** - PASS (3.1s)
- **G6 Lint** - PASS (4.5s)
- **G7 Unit + pure specs** - PASS (6.3s)
- **G8 Functional / integration** - PASS (2m 35s)
- **G9 Automation addressability** - PASS (126ms)
- **G10 Backward compatibility (fixtures)** - PASS (13.0s)
- **G11 Wide tables are configurable** - PASS (149ms)
- **G12 Installable as an application** - PASS (139ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 12s total - slowest G8 Functional / integration (1m 50s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (156ms)
- **G2 Contrast (all tokens, both themes)** - PASS (107ms)
- **G3 Theme assets present per theme** - PASS (111ms)
- **G4 No hard-coded colours** - PASS (122ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (2.8s)
- **G7 Unit + pure specs** - PASS (4.7s)
- **G8 Functional / integration** - PASS (1m 50s)
- **G9 Automation addressability** - PASS (117ms)
- **G10 Backward compatibility (fixtures)** - PASS (10.9s)
- **G11 Wide tables are configurable** - PASS (115ms)
- **G12 Installable as an application** - PASS (120ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 2m 43s total - slowest G8 Functional / integration (2m 17s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (232ms)
- **G2 Contrast (all tokens, both themes)** - PASS (147ms)
- **G3 Theme assets present per theme** - PASS (139ms)
- **G4 No hard-coded colours** - PASS (155ms)
- **G5 Types** - PASS (2.7s)
- **G6 Lint** - PASS (3.6s)
- **G7 Unit + pure specs** - PASS (6.3s)
- **G8 Functional / integration** - PASS (2m 17s)
- **G9 Automation addressability** - PASS (140ms)
- **G10 Backward compatibility (fixtures)** - PASS (12.8s)
- **G11 Wide tables are configurable** - PASS (115ms)
- **G12 Installable as an application** - PASS (124ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 32s total - slowest G8 Functional / integration (1m 09s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (174ms)
- **G2 Contrast (all tokens, both themes)** - PASS (124ms)
- **G3 Theme assets present per theme** - PASS (107ms)
- **G4 No hard-coded colours** - PASS (121ms)
- **G5 Types** - PASS (2.2s)
- **G6 Lint** - PASS (2.8s)
- **G7 Unit + pure specs** - PASS (6.3s)
- **G8 Functional / integration** - PASS (1m 09s)
- **G9 Automation addressability** - PASS (122ms)
- **G10 Backward compatibility (fixtures)** - PASS (11.0s)
- **G11 Wide tables are configurable** - PASS (119ms)
- **G12 Installable as an application** - PASS (117ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 38s total - slowest G8 Functional / integration (1m 14s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (182ms)
- **G2 Contrast (all tokens, both themes)** - PASS (127ms)
- **G3 Theme assets present per theme** - PASS (151ms)
- **G4 No hard-coded colours** - PASS (133ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (3.1s)
- **G7 Unit + pure specs** - PASS (5.3s)
- **G8 Functional / integration** - PASS (1m 14s)
- **G9 Automation addressability** - PASS (143ms)
- **G10 Backward compatibility (fixtures)** - PASS (12.4s)
- **G11 Wide tables are configurable** - PASS (114ms)
- **G12 Installable as an application** - PASS (128ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 46s total - slowest G8 Functional / integration (1m 20s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (158ms)
- **G2 Contrast (all tokens, both themes)** - PASS (109ms)
- **G3 Theme assets present per theme** - PASS (122ms)
- **G4 No hard-coded colours** - PASS (128ms)
- **G5 Types** - PASS (2.7s)
- **G6 Lint** - PASS (3.1s)
- **G7 Unit + pure specs** - PASS (5.4s)
- **G8 Functional / integration** - PASS (1m 20s)
- **G9 Automation addressability** - PASS (148ms)
- **G10 Backward compatibility (fixtures)** - PASS (13.1s)
- **G11 Wide tables are configurable** - PASS (134ms)
- **G12 Installable as an application** - PASS (134ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-12 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 51s total - slowest G8 Functional / integration (1m 32s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (164ms)
- **G2 Contrast (all tokens, both themes)** - PASS (115ms)
- **G3 Theme assets present per theme** - PASS (107ms)
- **G4 No hard-coded colours** - PASS (127ms)
- **G5 Types** - PASS (2.3s)
- **G6 Lint** - PASS (4.0s)
- **G7 Unit + pure specs** - PASS (5.1s)
- **G8 Functional / integration** - PASS (1m 32s)
- **G9 Automation addressability** - PASS (114ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.9s)
- **G11 Wide tables are configurable** - PASS (122ms)
- **G12 Installable as an application** - PASS (135ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 25s total - slowest G8 Functional / integration (1m 08s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (158ms)
- **G2 Contrast (all tokens, both themes)** - PASS (108ms)
- **G3 Theme assets present per theme** - PASS (107ms)
- **G4 No hard-coded colours** - PASS (118ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (3.5s)
- **G7 Unit + pure specs** - PASS (4.5s)
- **G8 Functional / integration** - PASS (1m 08s)
- **G9 Automation addressability** - PASS (122ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.4s)
- **G11 Wide tables are configurable** - PASS (124ms)
- **G12 Installable as an application** - PASS (128ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 41s total - slowest G8 Functional / integration (1m 21s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (176ms)
- **G2 Contrast (all tokens, both themes)** - PASS (177ms)
- **G3 Theme assets present per theme** - PASS (198ms)
- **G4 No hard-coded colours** - PASS (155ms)
- **G5 Types** - PASS (2.6s)
- **G6 Lint** - PASS (3.3s)
- **G7 Unit + pure specs** - PASS (5.8s)
- **G8 Functional / integration** - PASS (1m 21s)
- **G9 Automation addressability** - PASS (199ms)
- **G10 Backward compatibility (fixtures)** - PASS (7.8s)
- **G11 Wide tables are configurable** - PASS (120ms)
- **G12 Installable as an application** - PASS (120ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

---

## Gate run - 2026-09-11 - VERDICT: PASS

Steps: 12 pass, 0 fail, 0 blocked.
Time: 1m 28s total - slowest G8 Functional / integration (1m 10s).
Application steps ran in starter

- **G1 Theme artifacts in sync** - PASS (158ms)
- **G2 Contrast (all tokens, both themes)** - PASS (113ms)
- **G3 Theme assets present per theme** - PASS (111ms)
- **G4 No hard-coded colours** - PASS (122ms)
- **G5 Types** - PASS (2.4s)
- **G6 Lint** - PASS (3.5s)
- **G7 Unit + pure specs** - PASS (4.5s)
- **G8 Functional / integration** - PASS (1m 10s)
- **G9 Automation addressability** - PASS (119ms)
- **G10 Backward compatibility (fixtures)** - PASS (6.2s)
- **G11 Wide tables are configurable** - PASS (118ms)
- **G12 Installable as an application** - PASS (136ms)

_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._

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


## v2.11.0 - DR-7 column-header filter

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: starter/tests/unit/column-filter.unit.spec.ts - 1 of 7 failed: "FILTERING DOES NOT DISTURB THE SORT", with "expected 'module', received undefined"
Injection: `sort: undefined` added to the filter update. The other 6 passed, so the failure is
attributable to that assertion alone - nothing else in the unit tier asserts that a sort survives
a filter change.

FAIL-FIRST: starter/tests/unit/column-filter.unit.spec.ts - 1 of 7 failed: "two values in one field are OR, not AND", with "expected 3 rows, received 0"
Injection: OR turned into AND within one field (`[...set].every(...)` in place of `.has(...)`) -
the shape of every multi-select filter that silently shows nothing. A FIRST attempt targeted
`.some(`, which does not appear in the filter function, so NO test failed; that ineffective
injection is recorded here rather than counted as evidence, because a probe that changed nothing
proves nothing.

NOT OBSERVED FAILING: the `clearField` isolation test - its first run failed with "TypeError: list.clearField is not a function"
which is a missing-symbol failure, not a behaviour failure: it proves the hook lacked the method,
not that the isolation rule can break. Recorded as the weaker evidence it is.

### What is NOT covered
No render-tier or functional-tier rung exists for the menu itself - open, keyboard, Escape, or the
44px coarse-pointer target. `test:render` is ungated (RC-016), so a rung there would not run in
the gate that guards this repository. The library row is PARTIAL for this reason among others.

## v2.12.0 - DR-8 adaptive arrangement, CP-32 canonical vs presentation

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: starter/tests/functional/responsive-fit.functional.spec.ts - 1 of 3 failed: "item-category-trigger is 127px inside a 288px form at 320px - below the 256px floor"
Injection: `.form-grid` changed to `grid-template-columns: 1fr 1fr` - a desktop arrangement kept
at every width, which is the defect class exactly. The other 2 tests passed, so the failure is
attributable to the cramping assertion alone. Note what did NOT fire: narrow-width.functional
(the overflow spec) stayed GREEN throughout the injection, because two 127px fields in a 288px
form do not overflow anything. That is the gap this rung exists to close.

FAIL-FIRST: scripts/audits/check-presentation-labels.mjs - 2 violations on the pre-change tree, 0 after: ItemForm.tsx|119|value:s and ItemsScreen.tsx|134|value:it.status
Both were real defects in the framework's own reference implementation - the starter rendered
`active` and `archived` to users. 65 files, 452 text regions, 84 canonical values scanned with
ZERO false positives.

NOT OBSERVED FAILING: the first version of that detector resolved type bindings per-file and
therefore found only 1 of the 2 defects - it missed `{it.status}` because `Item` is declared in
types.ts and rendered in ItemsScreen.tsx, which is the ORDINARY shape and so most real cases.
Recorded because a detector that finds half the instances of what it claims to find is the kind
of green that is worse than no gate. Fixed by collecting canonical property names tree-wide;
bare identifiers stay file-local, since a global set of names like `s` would flag everything.

FAIL-FIRST: starter/tests/unit/presentation.unit.spec.ts - 2 of 7 failed on first run, and ONE was a real code defect: humanise("sent_to_WhatsApp") returned "Sent to Whats App"
The camelCase split in `humanise` corrupted a product name - precisely the trap DR-1 and
text-format.ts exist to prevent, reintroduced in a new file. The split was REMOVED rather than
the assertion relaxed: it only ever handled camelCase, which is not a canonical shape by the
audit's own definition. The second failure was a wrong expectation of mine about sort order
("2","3","1", not "1","2","3") and is recorded as such - a test corrected, not evidence.

### What is NOT covered
Helper and validation text expanding without clipping is part of DR-8 and is NOT asserted: the
reference form has no helper or error text, and an assertion over an empty set is a green light
for nothing. Carried as review until a worked example exists. Whether a stacked group still
READS as a group is design review by nature, and DR-8 declares it so.

## v2.13.0 - CP-33 / RC-018: implementing a design that was supplied

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: scripts/design-fidelity.test.sh - 2 of 12 failed: cases "B navigation row with no status" and "C feature omission", both with "no finding matching /NO STATUS/"
Injection: the MUST-PRESERVE status check in check-design-contract.mjs replaced with `if (false)`.
The other 10 passed, so both failures are attributable to the status rule alone - which is the
one rule that makes silent omission impossible.

FAIL-FIRST: scripts/design-fidelity.test.sh - 1 of 12 failed: case "A theme drift (maroon -> cream)", with "no finding matching /MATERIAL DESIGN CHANGE/"
Injection: the brand-colour comparison replaced with `if (false)`. 11 passed. This is the
headline case - a whole-theme substitution caught by ONE comparison, which works only because
binding rule 6 already put colour in exactly one file.

NOT OBSERVED FAILING: scripts/design-ingest.mjs has no injected-defect run of its own. Its
behaviour is asserted through design-fidelity cases D, F, F2, G and H (unreadable source exits 3,
conflicts surfaced not resolved, both palettes reported separately, a 40-artifact corpus
inventoried, structure extracted where <nav> scanning finds nothing). A real defect WAS found in
it during this run and is recorded below rather than counted as fail-first evidence.

### A defect the tool found in itself, before it was trusted
The first run of design-ingest on the real corpus reported "0 page(s)" while printing a full
product palette - it parsed every page and never pushed them into the inventory. A plausible
undercount of exactly the kind the tool exists to prevent, caught only because the two numbers
contradicted each other on screen. Fixed by pushing the artifact at the end of the loop.

### What is NOT covered
This layer makes the ACCOUNTING honest, not the fidelity. Nothing here proves the built
navigation actually has the named sections, that a screen resembles its mock-up, or that an
implemented feature behaves as designed - those need the running application
(preview-smoke-verifier) or a human. What it removes is SILENCE: a design decision can no longer
be absent, only accounted for.

## v2.13.1 - the design-contract audit could not read its own template

FAIL-FIRST: scripts/audits/check-design-contract.mjs - running it on the REAL Jalsa contract reported "NO CANONICAL BRAND COLOUR DECLARED - the drift check cannot run", and 13 unresolved rows passed in silence
Two defects, both found by using the tool rather than by reasoning about it:
  1. The brand regex required the hex to follow the colon with only whitespace, so it could not
     read `**Brand colour (canonical hex):** `#7a1c24``  - the form its OWN template writes. A
     drift check that cannot parse its own template is a drift check that never runs, and it
     would have reported a clean contract forever.
  2. `unresolved` is a member of the valid status set, so 13 unresolved MUST-PRESERVE rows
     produced no findings at all. Accounted for is not the same as settled; implementation must
     not begin on top of one. It is now a ratchet signature that counts DOWN as decisions are
     made, rather than a blank-only check.

AFTER: the same contract against a cream token file reports
"MATERIAL DESIGN CHANGE: contract #7a1c24 vs tokens #f5ead8" - the reported Jalsa defect,
detected mechanically, end to end. The 12-case suite still passes.

## v3.0.0 - RC-019: the commit guards were bypassed by the commonest commit shape

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: .claude/hooks/adapter.test.sh - 2 of 13 failed: "git add IN THE SAME COMMAND does not bypass the guards" and "commit -am does not bypass the guards", both "expected 2, got 0"
Injection: the single line setting GUARD_WORKTREE removed, restoring the bypass. The other 11
passed, so both failures are attributable to that line alone. Exit 0 is the bypass itself -
the adapter allowing a commit that the guard, run by hand on the same tree, blocks.

HOW IT WAS FOUND (not by a test): a guard printed "BLOCKED [G1]" and the commit in the same
command succeeded and pushed. guard:test passed throughout and would never have caught it - it
executes the guards directly, never through the adapter against an unstaged tree.

### Two defects in the fix itself, both caught by running it
1. The adapter regex was written through a shell heredoc and the \b escapes became literal
   BACKSPACE bytes, so the file would not parse. All 10 adapter cases failed with exit 1 -
   loudly, which is the only reason it took a minute rather than a day.
2. The new fixtures over-escaped their JSON payload, so the adapter received malformed input
   and correctly waved it through. The cases passed for the wrong reason until the escaping
   was corrected - and correcting it with a blanket replacement then broke an UNRELATED case
   that legitimately contained the same sequence, which the syntax check caught.

### What is NOT covered
The adapter parses a command string, not an AST, so it cannot distinguish a git command from a
string that contains one. A command whose text mentions both `git add` and `git commit` now
runs the guards against the real tree and may block. That false positive is deliberate and
stated: loud and escapable beats a silent bypass of the entire guard layer.

## v4.0.0 - RC-020: the design gate reads the code, and recorded is not resolved

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: scripts/design-fidelity.test.sh - 5 of 39 failed under injection: "A nav A,B,C required; code has A,C; C-row says implemented -> MISSING", "A ...and it BLOCKS (expected exit 2, got 0)", "B feature B required, absent, marked implemented", "D application tree unreadable", "D2 an evidence kind the audit cannot evaluate"
Injection: `resolveRef` made to return ok:true unconditionally - "evidence is believed". Exactly the
five cases that depend on evidence resolution failed and the other 34 passed, so the failures are
attributable to the resolution rule alone. Exit 0 under injection IS the previous behaviour: a false
"implemented" producing a clean verdict.

FAIL-FIRST: scripts/design-fidelity.test.sh case C - "still exit 2 AFTER --write-baseline" is the assertion that a baseline cannot approve an unresolved row; under the v2.13 audit the same sequence exited 0 (recorded in the validation that preceded this change)

FAIL-FIRST: scripts/design-fidelity.test.sh case I - "logo-copy.png byte-identical" and "logo.png REQUIRES VISUAL INSPECTION" both failed on the first run: directory order made the REFERENCED logo the duplicate of an unreferenced copy, and class E vanished (0 of 3 image cases passed)
Fixed by grouping images by hash first and choosing the referenced file as the survivor.

NOT OBSERVED FAILING: case H (DOCX) against a Word-authored file - the fixture is built by a .NET zip writer, which names the entry `word\document.xml`; the extractor was extended to tolerate either separator, and the real corpus (four Word-authored DOCX, 387-2,281 words each) extracts through the forward-slash path. The backslash path is exercised by the fixture only.

### Three defects in the change, each found by running it, none by reading it
1. Five "passes" cases exited 3: the scratch app had no ratchet baseline and the ratchet correctly
   said BLOCKED. The FIXTURE was wrong (an adopting app always carries one); the rule was right.
2. The image survivor bug above - a plausible inventory with the one material image misfiled.
3. The DOCX fixture yielded 8 words and landed in class B, whose lede was not printed, so the
   case read "not extracted" when it was partially extracted. B rows now print their lede.

### What is NOT covered
`manual:<who> <date>` is accepted as evidence for what only eyes can verify. It is counted and
printed, never hidden - and it is still a person's word. The audit resolves the app from the
working directory; the gate runner's --app flag does not reach G13 (nor G9, G11, G12), so the
gate is run FROM the application. No evidence kind renders the application: `route:` proves a
page file or a link exists, not that the page resembles its mock-up.

## v5.0.0 - CP-34: Supabase large-data safety, gate G14

### New behaviour rungs + FAIL-FIRST evidence
FAIL-FIRST: starter/tests/unit/supabase-safety.unit.spec.ts - 3 of 16 failed under injection: "Expected: 103, Received: 50" (reads to completion at a page size above the cap), "Expected: 4, Received: 3" (four calls for 45 rows at 20), and the short-page case
Injection: `if (rows.length < opts.pageSize) return out;` added to pageAllByKey - short-page
termination, the pagination "fix" that reproduces the truncation inside itself. 103 rows became
50, which IS the incident. The other 13 passed; the failures are attributable to the termination
rule alone. Cap in the test project: 50 (starter/.env.test).

FAIL-FIRST: scripts/supabase-safety.test.sh - 7 of 31 failed under injection 1 ("every read believed bounded"): "SAFE-BY-FILTER needs constraint + max rows + authority", "an annotated max AT the cap is BROKEN NOW", "an annotated max at 80% of the cap is BREAKS SOON", "12 --warn-at not honoured", "13 low cap did not expose limit(50)" and two exit-code cases
FAIL-FIRST: scripts/supabase-safety.test.sh - 3 of 31 failed under injection 2 ("prohibited-pattern flags disabled"): "10 an estimated count cannot establish completeness", "Content-Range /* read as truncation evidence", "12 a read outside the data layer is rejected even when bounded"
Under injection 2 the offset, short-page and N+1 cases STILL passed - those reads were already hard
as unbounded, and the flag names reached the report through the blocking signature. Recorded so
the attribution is not overstated: injection 2 isolates the three flags that apply to otherwise-SAFE reads.

NOT OBSERVED FAILING: starter/tests/functional/load-failed.functional.spec.ts - the browser cannot launch on the authoring machine ("browserType.launch: spawn UNKNOWN"; @next/swc "blocked by an Application Control policy")
A spec that passed that same morning (narrow-width, 108-case tier green at v2.12.0) fails
identically, so the block is environmental. The defect the spec pins is not hypothetical: the
pre-change ItemsScreen did `catch { setRows([]) }` and rendered "No items yet - Add the first
item" after a 500, which is read directly from the diff. The spec must be run on a machine that
can launch Chromium before this version is merged; gate G8 reports FAIL here for that reason.

### Three defects in the change found by running it
1. The ESLint boundary flagged `status.from('active')` in an existing spec. A receiver blocklist
   cannot know what `status` is; the rule now matches the CHAIN SHAPE and the audit agrees.
2. `failed` already named the error-toast helper in ItemsScreen; the new state is `loadFailed`.
3. The scratch app lacked a ratchet baseline; every "passes" case exited 3. The ratchet was right.

### What is NOT covered
The audit reads source with a regex. A query assembled across statements, or through a wrapper
the app wrote, is invisible unless the wrapper is named in .supabase-safety.json. Whether an
annotated maximum is TRUE is a person's judgement. Write paths are not classified.

### A fourth defect, found while staging
`starter/.env.test` - the file that carries the low cap - was gitignored by `.env.*`, and the
unit spec defaulted to 50 when the variable was absent, so a fresh clone would have run the
helper at 50 in the spec and the application at 1,000, with nothing saying so. `.gitignore` now
excepts `.env.test` (test configuration, no secrets by construction) and the spec asserts the
variable is PRESENT, not merely defaulted.
