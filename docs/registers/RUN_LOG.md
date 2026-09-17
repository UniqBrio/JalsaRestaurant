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
| R-023 | Add image browse option to add an image in a menu item. Implement a Jalsa-wide standardized SEARCHABLE COMBOBOX pattern. | TRIAGE | full-scale | 2026-09-17 17:04 | 2026-09-17 17:07 | 3m | - | 3.4s | PASS | Two unrelated items, both NEW. Phase 1 audit complete: 13 <select> call sites (all one shared primitive, all owner console), 1 datalist, 1 filter popover system, 1 hand-rolled staff picker. Only 3 fields are real combobox candidates; 11 stay per the brief's own Phase 2C. KEY FINDING: the reference interaction the brief says already exists does NOT exist - no combobox anywhere in src/. Queue: (1) menu-item image, (2) searchable combobox. Nothing implemented; not committed. |
| R-022 | Add a button "See my orders" to see it quick and easy for them to reorder the paste orders quick(They can add favorite now) | NEW | scoped | 2026-09-17 16:48 | 2026-09-17 16:49 | 43s | - | 3.4s | BLOCKED | Intake only. requests/2026-09-17-see-my-orders.md written. BLOCKED at Gate 1 on four questions, two of them load-bearing: favourites are React.useState and are not stored anywhere (GuestProgress.tsx:79), and 'past orders' across visits needs an identity Jalsa deliberately does not have. Nothing built. |
| R-021 | Anything added from this screen(share the love), mark it as "Take away" in Staff screen. I clicked on "Need water" from customer screen and the same is not showing up correct in "Staff" screen(Table A5 No note · waiting). For all requests from "Ask for something" screen, the information is not passed to staff screen. | TRIAGE | micro | 2026-09-17 16:41 | 2026-09-17 16:42 | 1m | - | 3.4s | PASS | Two items, both NEW (nothing ships either). Queue: (1) BUG ask-details-not-on-staff-screen - no schema change, three provable drops, unblocks a floor surface tonight; (2) CHANGE share-the-love-takeaway - needs a migration, so it is the slower one. No dependency between them; ordered by cost, not by sequence. |
| R-020 | Remove "Pay Rs. 200" button and change to "Continue ordering" and add tip button in the place of "Continue ordering" button. Remove "No thanks, continue to payment" button. Ensure the page is responsive. | CHANGE | scoped | 2026-09-17 16:10 | 2026-09-17 16:41 | 31m | - | 3.4s | BLOCKED | Upsell action bar: Continue ordering (primary) + Add a tip (secondary), two stacked full-width buttons; the nested flex row is gone. ACTION_BAR_STACK extracted so the render spec measures what ships. 6 unit + 26 render cases; fail-first 5/6 and 20/26 observed failing. tsc clean, eslint clean, audit:all 10/10, unit+render tiers 524/524. BLOCKED: the functional tier did not run - the dev server points at the only copy of real data. Started it by mistake, killed after ~3min, verified by timestamp it wrote 0 rows. |
| R-019 | Sent to the kitchen never changes. Enable a button to mark it Order ready/received so it is clear the order is served. When Request payment is clicked, mark all items as served. | CHANGE | scoped | 2026-09-17 16:06 | 2026-09-17 16:10 | 4m | - | 3.4s | BLOCKED | KOT status dead end: intake complete, requests/2026-09-17-kot-status-dead-end.md written; reclassified CHANGE->BUG at intake (this row's type is the start-time classification, the request file is authoritative). Paused at the Track C gate on the open question of who attributes 'served'. Superseded mid-turn by the guest closure action-bar request. |
| R-018 | Captain/Waiter picker lists every active person and the server never checks the role; an unsettled tip can be moved to a cleaner | BUG | scoped | 2026-09-17 15:59 | 2026-09-17 15:59 | 0s | - | 3.4s | PASS | canHoldBillRole/eligibleForBillRole in status.ts; picker and reassignBillStaff both call it; search added. 9 cases, fail-first 6 failed/3 passed. |
| R-017 | Complete responsive design audit + remediation across the entire Jalsa application, 13 viewports, all current-release surfaces | CHANGE | full-scale | 2026-09-17 11:28 | 2026-09-17 11:34 | 6m | - | 3.4s | PASS | Reachable surface swept clean at 13 widths (79 checks). Component-first: all 4 hand-rolled chip scrollers eliminated. Signed-in screens unreachable - reported, not claimed. |
| R-016 | Settings submenu: after Customer engagement, Printers and machines is not visible because the submenu navigation is effectively a constrained/non-wrapping horizontal row | BUG | scoped | 2026-09-17 11:15 | 2026-09-17 11:23 | 8m | - | 3.4s | PASS | Settings submenu wraps. Root cause: flex with no flex-wrap inside overflow-x:auto with the scrollbar hidden. Fix is one container class, CHIP_NAV_WRAP. 19 render cases at 8 widths; fail-first 15 failed/4 passed. |
| R-015 | Why table 5 only showing as available? Make every table available as all of them free by default. Enable search option, show only captains and similarly, show only waiters with search bar. | TRIAGE | micro | 2026-09-17 11:09 | 2026-09-17 11:15 | 5m | - | 3.4s | PASS | Queue approved: (1) picker ignores role + server does not validate - BUG, (2) picker search, (3) all-tables landing page. Paused unbuilt - superseded mid-turn by the Settings submenu responsive defect. |
| R-014 | Show 'Discount % and Discount in Rs' in one row as two fields. Show after discount amount in the same screen before 'Paid by' options. Make similar corrections in captain's payment closure screen too. | CHANGE | scoped | 2026-09-12 17:32 | 2026-09-12 17:39 | 7m | - | 4.3s | FAIL | discount row layout + after-discount figure; gate 10/11, G8 the known no-egress limitation |
| R-013 | Update the Owner Menu screen to replace the current common/global filter with column-wise filtering. Filter icon in each column header opening a compact dropdown; filters independent and combinable; active-filter badge with Clear all; keep sorting separate. | CHANGE | scoped | 2026-09-12 16:51 | 2026-09-12 17:01 | 10m | - | 4.3s | FAIL | menu column filters; gate 10/11, G8 the known no-egress limitation |
| R-012 | Allow owner to modify the Captain or Waiter name in any bill while it is running or after it is closed. Add Discount in Rs below Discount %, always synchronized, on Owner Payment Closure and captain Close bill screens. | CHANGE | scoped | 2026-09-12 13:09 | 2026-09-12 13:22 | 14m | - | 4.3s | FAIL | discount both screens + reassign captain/waiter + cancel notice; gate 10/11, G8 the known no-egress limitation |
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