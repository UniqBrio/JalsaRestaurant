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
| R-011 | allow owner to mark the table free manually; owner can grant it to someone else in RBAC like captains. Sometimes 'something went wrong' error appears, fix it permanently. | CHANGE | scoped | 2026-09-12 09:56 | 2026-09-12 10:07 | 11m | - | 4.3s | FAIL | free-a-table + stale banner; gate 10/11, G8 the known no-egress limitation |
| R-010 | For adding an item, it is taking time. Find the root cause and fix it. The order should be added immediately. | BUG | scoped | 2026-09-12 09:45 | 2026-09-12 09:54 | 9m | - | 4.3s | FAIL | cart latency; gate 10/11, G8 the known no-egress limitation |
| R-009 | Enable a checkbox at the bottom left to show price(Total only). By default, disable it, let the customer click on it to see it. The default setting can be done in Settings screen by the owner to show/hide total order value(without GST). | CHANGE | scoped | 2026-09-12 08:24 | 2026-09-12 08:49 | 25m | - | 4.3s | - | - |
| R-008 | SDL post-generation quality review of the generated Jalsa application, and feed the learnings back into the framework | REVIEW | full-scale | 2026-09-11 07:18 | 2026-09-11 07:26 | 8m | - | 4.3s | PASS | - |
| R-007 | Do not create the design, start with 'Design planning documentation' designs already created. This a new app development request but with no design regeneration. Exclude design part just start implementing using these tech stack: Next.js + TypeScript + React + Supabase + shadcn/ui + PWA. Don't redesign for Next.js. Implement the existing design in Next.js. Add the missing technical states and responsive behavior during implementation. And do not add Apollo GraphQL or another backend language unless a future architectural requirement genuinely calls for it. | NEW-APP | full-scale | 2026-09-10 06:46 | 2026-09-10 14:34 | 7h 48m | - | 4.3s | PASS | - |
| R-006 | Audit log whenever RBAC is enabled: super admin creates an account, assigns a role, customizes features. Reusable component, table view with search, filter by date and module, and sorting | NEW | full-scale | 2026-09-08 13:45 | 2026-09-08 13:54 | 8m | ground 6m · verify 2m · gate 14s | 6.6s | BLOCKED | v1.28.0; CP-27 audit trail; 19/19 audit spec with 2 injected defects observed failing; gate BLOCKED on G5-G8 pre-existing |
| R-005 | Remove the request pre-sorter: it cannot classify reliably when one chat carries more than one request | FRAMEWORK | scoped | 2026-09-08 12:46 | 2026-09-08 12:48 | 2m | ground 9s · build 42s · verify 59s · gate 13s | 6.3s | BLOCKED | v1.27.0; pre-sorter withdrawn; gate BLOCKED on G5-G8 pre-existing |
| R-004 | Validation testing time is high and unmeasured (each correction tested individually); and Supabase soft-deletes where the frontend expects a hard delete | FRAMEWORK | scoped | 2026-09-08 12:22 | 2026-09-08 12:29 | 7m | ground 44s · plan 52s · build 3m · verify 2m · gate 7s | 6.2s | BLOCKED | v1.26.0; CP-26 delete contract, per-commit verification, request pre-sorter; gate BLOCKED on G5-G8 pre-existing |
| R-003 | Reduce execution time: instrument the four unmeasured stages, and make the review matrix executable | FRAMEWORK | scoped | 2026-09-08 10:57 | 2026-09-08 11:21 | 25m | ground 13m · plan 0s · build 7m · verify 3m · gate 14s | 7.0s | BLOCKED | v1.25.0; four speed levers; gate BLOCKED on G5-G8, pre-existing no local tsc |
| R-002 | Write a simple audit log file: action name, request type, start, end, total time taken | FRAMEWORK | scoped | 2026-09-08 10:15 | 2026-09-08 10:42 | 27m | - | 6.1s | BLOCKED | back-filled start; v1.24.0; this register; same pre-existing G5-G8 block |
| R-001 | Correction time is short, but verification takes significantly longer - often exceeding one hour | FRAMEWORK | scoped | 2026-09-08 09:37 | 2026-09-08 10:42 | 1h 05m | - | 6.1s | BLOCKED | back-filled start; v1.23.0; RC-008; gate BLOCKED on G5-G8, no local tsc |