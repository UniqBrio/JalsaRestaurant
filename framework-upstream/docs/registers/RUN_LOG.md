# Run log

> **What was asked, which kind of request it was, and what it cost.** One row per run,
> **newest first**, append-only — never renumber, never backfill silently, never hard-delete.
>
> **Rows are written by `scripts/run-log.mjs`, not by hand.** The two timestamps are read from
> the machine clock at the moment each event happens. A start time typed in at the *end* of a
> run is a recalled time, and a duration derived from two recalled times is an estimate wearing
> the costume of a record — which is precisely what [RC-008](./ROOT_CAUSE_REGISTER.md) cost
> this framework: "run reports carry stage timings" was a rule for three versions and produced
> **not one measured number**, because the only party asked to honour it was a narrator.
>
> ### Reading the Total column (v2.7.0)
>
> Rows from v2.7.0 read **`12m active · 3h 38m elapsed`**. Earlier rows carry one figure, and it
> is the **elapsed** one.
>
> They differ because an agent-run session spends much of its wall clock waiting for a person to
> read something and reply. R-006 recorded **3h 38m** for about fifteen minutes of work — the
> requester stepped away between two messages — and a column that silently measures a lunch
> break cannot answer the one question it exists for: *was it the machine or the agent?*
>
> **Active is a lower-bound estimate, not a measurement.** It sums the gaps between the marks
> the script leaves as it runs, counting at most 10 minutes of any single gap; work done between
> two marks further apart than that is not counted at all. A run with too few marks gets
> **`active: no marks`** rather than a flattering number — the same rule as everything else
> here: a figure nobody measured is never printed beside figures that were.
>
> **Elapsed is still recorded, always.** The honest answer to "how long did this take?" is
> different for the machine and for the calendar, so the row carries both.

```bash
node scripts/run-log.mjs start --type CHANGE --action "sign-out lands on the wrong screen" --scale micro
node scripts/run-log.mjs stage ground     # then: plan · build · verify · gate
#   … the run happens, marking each stage as it begins …
node scripts/run-log.mjs end --verdict PASS
node scripts/run-log.mjs status           # what is open, which stage, how long
```

**Mark a stage at its start, not its end.** Each stage runs until the next mark, so no
wall-clock falls between two stages unattributed. A total tells you a run was slow; the stage
breakdown is the only thing that tells you *what to fix*.

> **Column added 08-Sep-2026 (v1.25.0): `Stages`.** Rows R-001 and R-002 predate it and carry
> `-`. Their content is unchanged — the cell is added, nothing is rewritten — and `-` is the
> honest value, because those runs were never staged. Backfilling a plausible split would put
> invented numbers beside measured ones with nothing to tell them apart.

## The columns

| Column | What it holds |
|---|---|
| **ID** | `R-001`, ascending, never reused |
| **Action** | What the requester asked, **in their words** — not a summary of what was built |
| **Type** | The classification from [`workflows/request.md`](../../workflows/request.md) R1 |
| **Scale** | `micro` · `scoped` · `full-scale` · `n/a` — the lane the run declared |
| **Started · Ended** | Local time, read from the machine clock at each event |
| **Total** | Computed, never typed |
| **Stages** | `ground · plan · build · verify · gate`, each with its own measured duration. Only stages actually marked appear — **an unmarked stage is absent, never `0`**, because zero would claim the stage ran instantly rather than that nobody measured it |
| **Gate** | The gate's own measured cost, lifted from the newest `Time:` line in `TEST_SUMMARY.md` |
| **Verdict** | `PASS` · `FAIL` · `BLOCKED` — the three the gate has; there is no fourth |
| **Notes** | `back-filled start` when a row's start was supplied rather than measured, plus anything worth a phrase |

**Type** uses the same vocabulary as `/request` R1, deliberately — a second set of names for
one concern means two different answers to "how many bug runs did we do".

| Type | In plain words |
|---|---|
| `NEW-APP` | a whole new application |
| `NEW` | a new feature, in an app that already exists |
| `CHANGE` | a functionality correction — it works, it should behave or look different |
| `BUG` | a defect — erroring, wrong output, wrong data |
| `REFACTOR` | same behaviour, better structure |
| `TRIAGE` · `BRAINSTORM` · `FRAMEWORK` | a list to order · thinking it through · the process itself was repaired |

## Why `Total` and `Gate` sit next to each other

They answer the only question a slow run really raises: **was it the machine or the agent?**
Measured on this repository 08-Sep-2026, the entire mechanical stack — `audit:all` 17.7s,
`guard:test` 60.2s, `npm run gate` 8.6s — is about **87 seconds**. So a two-minute gap between
those two columns is the tooling, and a fifty-minute gap is not. Any proposal to speed up a run
should start by reading this table rather than by guessing which part felt slow.

---

| ID | Action | Type | Scale | Started | Ended | Total | Stages | Gate | Verdict | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| R-023 | Supabase large-data safety as a reusable framework capability | FRAMEWORK | n/a | 2026-09-14 16:17 | 2026-09-14 16:45 | 28m elapsed · active: no marks | - | 58.6s | BLOCKED | - |
| R-022 | Close the six proven design-fidelity gaps: evidence-backed status, executable gate, traceability, ingestion classes, drift classification, assertion reconciliation | FRAMEWORK | n/a | 2026-09-13 15:28 | 2026-09-13 22:00 | 6h 32m elapsed · active: no marks | - | 2m 44s | PASS | - |
| R-021 | Validate the design-fidelity pipeline end to end: which stages are executable, which are documentation | FRAMEWORK | n/a | 2026-09-13 15:17 | 2026-09-13 15:22 | 5m elapsed · active: no marks | - | 2m 42s | PASS | - |
| R-020 | RC-019: close the commit-guard bypass | FRAMEWORK | n/a | 2026-09-13 15:10 | 2026-09-13 15:10 | 0s elapsed · active: no marks | - | 2m 42s | PASS | - |
| R-019 | Repair two defects in the v2.13.0 design-contract audit, found by running it on the real corpus | FRAMEWORK | n/a | 2026-09-13 14:55 | 2026-09-13 14:57 | 2m elapsed · active: no marks | - | 2m 57s | PASS | - |
| R-018 | Design-to-implementation fidelity: why an approved design can be silently replaced during implementation | FRAMEWORK | n/a | 2026-09-13 14:35 | 2026-09-13 14:52 | 18m elapsed · active: no marks | - | 2m 57s | PASS | - |
| R-017 | DR-8 adaptive arrangement + CP-32 canonical vs presentation: two defect classes traced to the reference implementation and to verification that asked the wrong question | FRAMEWORK | n/a | 2026-09-13 13:55 | 2026-09-13 14:34 | 40m elapsed · active: no marks | - | 2m 54s | PASS | back-filled start |
| R-016 | Implement Member Records using the repository's established architecture, preserving the design decisions; implement DR-7 column-header filter as the smallest reusable component | NEW | scoped | 2026-09-13 13:31 | 2026-09-13 13:51 | 15m active · 21m elapsed | ground 2m · build 3m · verify 15m | 2m 29s | PASS | - |
| R-015 | Design a Customer/Member Management module: registration, list, search, filtering, view details, edit details, validation, success/error states, responsive mobile/tablet/desktop | NEW | scoped | 2026-09-13 13:20 | 2026-09-13 13:26 | 6m active · 6m elapsed | ground 4m · verify 2m | 2m 40s | PASS | Member module design + prototype; 0 questions; CP-26 assertion took 3 iterations |
| R-014 | Design the Login/Authentication module: username-password login, forgot password, first-time login credentials / first-time password setup | NEW | scoped | 2026-09-13 13:11 | 2026-09-13 13:16 | 5m active · 5m elapsed | ground 1m · plan 1m · build 2m · verify 47s | 2m 40s | PASS | Login module design + prototype; no framework or app code modified |
| R-013 | Proceed with the next queued SDCL item: Stack-Selection Policy - make stack selection deterministic, context-aware and reusable | FRAMEWORK | scoped | 2026-09-13 12:59 | 2026-09-13 13:09 | 10m active · 10m elapsed | ground 1m · build 2m · verify 7m | 2m 40s | PASS | stack selection + guide rule |
| R-012 | Implement only the changes recommended as ADOPT or ADOPT CONDITIONALLY: B1 fail-first names the failure, B2 isolation, B3 numeric evidence labels, C verification semantics, D evidence categories, E scope control | FRAMEWORK | scoped | 2026-09-13 12:39 | 2026-09-13 12:52 | 14m active · 14m elapsed | ground 2m · build 6m · verify 6m | 2m 53s | PASS | B1/B2/B3/C/D/E only; 9 candidates not adopted |
| R-011 | Add this in design phase of this SDLC workflow: SDLC Design Decision Knowledge Base v1.0 (42 sections) | FRAMEWORK | scoped | 2026-09-13 12:18 | 2026-09-13 12:38 | 20m active · 21m elapsed | ground 3m · build 52s · verify 10m · gate 6m | 3m 40s | PASS | docs/26 + design-phase runbook |
| R-010 | the run log should measure actual active work time, not the time I spend thinking or waiting between messages | FRAMEWORK | scoped | 2026-09-12 23:10 | 2026-09-12 23:21 | 11m active · 11m elapsed | - | 2m 53s | PASS | RC-017: active beside elapsed |
| R-009 | Column-level filtering: for data tables with multiple columns, provide a small filter control in each relevant column header. Filters must be independent, combinable, clearly show active filters, and allow individual or Clear all removal. Keep filtering separate from sorting and avoid large filter panels or toolbars. | FRAMEWORK | micro | 2026-09-12 18:51 | 2026-09-12 22:29 | 3h 38m | - | 3m 03s | PASS | DR-7; CP-23 amended for placement only |
| R-008 | When a set of filters or categories does not fit comfortably on the screen, use a visible button that opens a compact sheet or grid. Avoid horizontal scrolling. Prioritize one-hand usability, fast discovery, and minimal interaction. | FRAMEWORK | micro | 2026-09-12 14:36 | 2026-09-12 14:44 | 9m | - | 2m 12s | PASS | DR-6 + its executable half |
| R-007 | build the reusable searchable dropdown per DR-5: search, auto-focus, existing options, + Add, persistence, keyboard, a11y, both themes | NEW | scoped | 2026-09-12 13:56 | 2026-09-12 14:20 | 24m | - | 2m 43s | PASS | DR-5 built; RC-016 found and recorded |
| R-006 | Audit log whenever RBAC is enabled: super admin creates an account, assigns a role, customizes features. Reusable component, table view with search, filter by date and module, and sorting | NEW | full-scale | 2026-09-08 13:45 | 2026-09-08 13:54 | 8m | ground 6m · verify 2m · gate 14s | 6.6s | BLOCKED | v1.28.0; CP-27 audit trail; 19/19 audit spec with 2 injected defects observed failing; gate BLOCKED on G5-G8 pre-existing |
| R-005 | Remove the request pre-sorter: it cannot classify reliably when one chat carries more than one request | FRAMEWORK | scoped | 2026-09-08 12:46 | 2026-09-08 12:48 | 2m | ground 9s · build 42s · verify 59s · gate 13s | 6.3s | BLOCKED | v1.27.0; pre-sorter withdrawn; gate BLOCKED on G5-G8 pre-existing |
| R-004 | Validation testing time is high and unmeasured (each correction tested individually); and Supabase soft-deletes where the frontend expects a hard delete | FRAMEWORK | scoped | 2026-09-08 12:22 | 2026-09-08 12:29 | 7m | ground 44s · plan 52s · build 3m · verify 2m · gate 7s | 6.2s | BLOCKED | v1.26.0; CP-26 delete contract, per-commit verification, request pre-sorter; gate BLOCKED on G5-G8 pre-existing |
| R-003 | Reduce execution time: instrument the four unmeasured stages, and make the review matrix executable | FRAMEWORK | scoped | 2026-09-08 10:57 | 2026-09-08 11:21 | 25m | ground 13m · plan 0s · build 7m · verify 3m · gate 14s | 7.0s | BLOCKED | v1.25.0; four speed levers; gate BLOCKED on G5-G8, pre-existing no local tsc |
| R-002 | Write a simple audit log file: action name, request type, start, end, total time taken | FRAMEWORK | scoped | 2026-09-08 10:15 | 2026-09-08 10:42 | 27m | - | 6.1s | BLOCKED | back-filled start; v1.24.0; this register; same pre-existing G5-G8 block |
| R-001 | Correction time is short, but verification takes significantly longer - often exceeding one hour | FRAMEWORK | scoped | 2026-09-08 09:37 | 2026-09-08 10:42 | 1h 05m | - | 6.1s | BLOCKED | back-filled start; v1.23.0; RC-008; gate BLOCKED on G5-G8, no local tsc |