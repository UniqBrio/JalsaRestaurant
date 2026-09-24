# Test summary

_Newest run first. **Append-only: never overwrite a prior run.**_

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, code-review fixes

Review (REQUEST CHANGES) found, and this run fixed: seating race could join a second party onto the first party's bill (ensureOpenBill `mustBeNew`, 23505 refused); add-round accepted a VOID bill or a table moved off the bill (only open/payment_requested, table must be on the bill; same status rule for the waiter picker); issuePin could pass a PIN held by both the person and another; Net went stale beside a live Expenses tile (now income - live expenses); entries outside the range could not be edited (Show every entry); the Disconnect dialog promised tickets would wait; sign-in audit could fail a successful sign-in; an unchecked write in savePrinterMapping; "No guest has answered" overclaimed; ticket month spelling depended on ICU.
FAIL-FIRST: finance-section, pin-and-attribution, queue-seat-and-closed, assign-waiter (appended) - with the review fixes reverted: **5 failed**, 20 passed; after: all pass. Unit tier: 1017 passed. Specs updated in place with dated SUPERSEDED notes (they were added in this same unmerged branch).
NOT CHANGED, raised with the owner: set_own_pin has no uniqueness check (a refusal would reveal a colleague's PIN); provisional PINs are gated by the pages, not the API routes, and "Skip for now" deliberately lets a provisional session proceed (KL-4) - an API-level block would contradict that design.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, final validation

Typecheck: PASS. Lint (whole app, --max-warnings 0): PASS. Unit tier: 1016 passed, 0 failed (also under TZ=UTC). Production build (`next build`, placeholder non-secret config): PASS, 19 static pages. audit:all 10/10. Gate: BLOCKED - G1-G7, G9-G12 PASS; G8 functional BLOCKED (no database reachable from this container; CONNECT to *.supabase.co refused, 403).
Sweeps: host-clock day boundaries - two left, both inert (`dates.ts` dayRange unused; `analytics/format.ts` Intl-failure fallback). Server toLocale* without a zone - none. Printer mapping writes - only savePrinterMapping, removePrinterMapping, revokeBridgeToken and the re-pair move. Source label maps - one (KOT_SOURCE_LABEL). Staff identity fallbacks - `opts.actor ?? GUEST_ACTOR` only, whose sole actor-less caller is the guest round; no fallback from one staff member to another.
K "Catch Your Craving": no code on any remote branch; mentioned only in TEST_SUMMARY notes on origin/claude/jalsa-restaurant-app-dev-j6k218 (quick-add, promotions, craving lost to a checkout, recovered only in a local tree). Nothing to integrate from this repository; left untouched.
Not built: E1 (no "favorite menu" flow exists to add a "+" to), I3 sub-menu categories (needs a menu_category level + migration applied to live first). Live migration outstanding: 20260917120000_jalsa_drop_ambiguous_set_staff_pin (in the repo since 17-Sep, never applied to yxgxmbyilpivbmeemqkp).

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, D1 welcome drinks

FAIL-FIRST: jalsa/tests/unit/welcome-drinks.unit.spec.ts - isFirstOrder injected to always true and reverted: **1 failed**; against HEAD's wiring: **1 failed**; after: 7 passed. Unit tier: 1016 passed. The rule cases for offer/add/added are new surface (functions did not exist): NOT OBSERVED FAILING for those beyond the injection above.
Stored in the existing `setting` table under key welcomeDrinks ({enabled, itemIds}); permission set.features. No migration.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, H1 income & expenses

FAIL-FIRST: jalsa/tests/unit/finance-section.unit.spec.ts - range end made exclusive (injected, reverted): **2 failed**; against HEAD's screen: **1 failed**; after: 4 passed. Unit tier: 1009 passed.
Decision (owner delegated to engineering, 24-Sep): Income = closed-bill revenue (tips excluded), read from the report route over the chosen IST range; no manual income ledger and no new table, so nothing can be counted twice. A manual "other income" ledger would be a new table + migration - not built.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, H2 heard-about in Uplift

FAIL-FIRST: jalsa/tests/unit/heard-about-uplift.unit.spec.ts - case folding injected away and reverted: **1 failed**; against HEAD's wiring (no query, route or card): **2 failed**; after: 5 passed. Unit tier: 1005 passed.
Live evidence (read-only): guest_session.heard_about holds 2 answers ("Friend recommended" x2). Caveat recorded: a session row is deleted when a phone moves to another table or a table with no kitchen rounds is freed by hand, and its answer goes with it - that is the existing store, unchanged.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, G1 captain assigns waiter

FAIL-FIRST: jalsa/tests/unit/assign-waiter.unit.spec.ts - rule injected to ignore the position (captain allowed too) and reverted: **1 failed** (the captain position); against HEAD's wiring: **2 failed** (server door, captain phone); after: 5 passed. Unit tier: 1000 passed. RBAC_MATRIX: one row added.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, C3 KOT source

FAIL-FIRST: jalsa/tests/unit/kot-source.unit.spec.ts - against HEAD's sources (shared map kept): **2 failed** (one map; printed words + locked field), 2 passed - those two verify EXISTING correct behaviour (each route already stamps captain/owner/guest), so they are verification, not fail-first.
FAIL-FIRST: jalsa/tests/unit/ticket-golden.unit.spec.ts - the four golden byte rungs failed when source became locked (every KOT gains one SOURCE line). SUPERSEDED IN PLACE with dated notes: goldens A and B are kept byte for byte and compared with today's ticket minus exactly the SOURCE line; a new rung pins the SOURCE line (Guest phone, after CAPTAIN, full width) even with a template that stored source off. Unit tier: 995 passed.
Live evidence (read-only): setting 'print'.kot.on has "source": false stored - why a default change alone would not have reached the paper.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, H3 cash change

FAIL-FIRST: jalsa/tests/unit/cash-change.unit.spec.ts - defect injected into cashChange (a shortfall returned as negative change) and reverted: **2 failed**, 5 passed; after: 7 passed. Unit tier: 990 passed. The UI (CashChangeField on both closure screens) is new surface: NOT OBSERVED FAILING beyond the source pin that both screens use it.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, batch 3 (B1-B4 printers)

FAIL-FIRST: jalsa/tests/unit/printer-management.unit.spec.ts - against HEAD's sources: **8 failed** of 8; after: 8 passed. Unit tier: 983 passed.
SUPERSEDED IN PLACE: jalsa/tests/unit/print-config.unit.spec.ts "revoking is a timestamp, never a delete" - previously "no .delete( at all"; now "the bridge_token row is never deleted, its bridge_printer mappings are" (dated note).

Live evidence (read-only): all five printers are USB, three already saved enabled=false; the paired
computer "Bill counter PC" (last seen 24-Sep) has NO printer mapped - consistent with B3 (no way to
change a mapping, chooser hiding mapped printers, revoked computers keeping theirs).
NOT VERIFIED: the save / delete / change paths against a running app and database (G8 not run
here). B1's confirmed cause is the address rule on computer-reached printers; if the tester's
failing save was on a USB printer, that path was not reproduced from here.
B4: jalsa/docs/PRINT-BRIDGE-WINDOWS-INSTALL.md, written from install.ps1, uninstall.ps1, the package
builder and the on-screen labels; no screenshots exist in the repository (KL-7).

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, batch 2 (F2, F3)

FAIL-FIRST: jalsa/tests/unit/queue-seat-and-closed.unit.spec.ts - against HEAD's sources (new shared sentence kept): **7 failed**, 1 passed (the sentence-shape case, which is new surface: NOT OBSERVED FAILING for that one); after: 8 passed. Unit tier: 975 passed.

F2 evidence (read-only, live): W-1 seated 19-Sep 17:59 IST with seated_table_id = A2; no bill was
opened on A2 that evening. Seating now opens the bill (owner decision 24-Sep: "Open a bill").
F3: the queue's own switch (settings.queue.open) now stops NEW tables on the table code, screen and
server; a table with a bill keeps ordering. Chosen over a new switch because the correction list
says to use the existing queue state.

---

## Application run - jalsa - 2026-09-24 - 24-Sep correction list, batch 1 (A2/I5, A1, F1, G2, C1)

FAIL-FIRST: jalsa/tests/unit/restaurant-day.unit.spec.ts - with the call sites reverted (new helpers kept): **2 failed** (source pins: a server "today" from the host clock; screens naming today with the UTC date), 6 passed; after, under TZ=UTC as on Vercel: 8 passed. The six helper cases cover functions that did not exist before: NOT OBSERVED FAILING for those six - new surface, no prior behaviour.
FAIL-FIRST: jalsa/tests/unit/report-empty-today.unit.spec.ts - emptyRangeCopy stubbed to the old screen's generic sentence: **2 failed** (both Today cases), 4 passed; after: 6 passed. Live read for Today = 24-Sep returns B-1044, closed 23-Sep IST.
FAIL-FIRST: jalsa/tests/unit/pin-and-attribution.unit.spec.ts - against HEAD's sources: **7 failed** of 7; after: 7 passed.
SUPERSEDED IN PLACE: jalsa/tests/unit/owner-new-round.unit.spec.ts - two assertions, with dated notes (ensureOpenBill now takes the actor; tables awaiting clearing are not free).

Evidence (read-only, live project yxgxmbyilpivbmeemqkp): pg_proc has set_staff_pin(uuid,text) AND
(uuid,text,boolean) - migration 20260917120000 not applied; the test project has only the
3-argument one. KOT-129 (24-Sep 08:33 IST, B-1052, captain Imran) is source=captain,
placed_by = Javeed Ahmed (Owner/Admin); its "Bill opened" entry reads Guest - QR. No two staff
share a PIN hash today. Unit tier: 967 passed. G8 functional not run (no database from here).

---

## Application run - jalsa - 2026-09-24 - Bug RC-015, review follow-up

Code review (REQUEST CHANGES; the fix itself judged correct) raised: the changelog claimed a
screen nobody had seen (now carries a "Not yet" line and the check to run); the new spec's claim
that server drift would fail it was untrue (now pinned: a case reads route.ts's ok()/fail()
lines); a 200 with a null body still read as an empty range (now a problem); and an empty range
had lost the designed "Nothing in this range" state (now `rangeIsEmpty`: no bill and no expense).

FAIL-FIRST: jalsa/tests/unit/report-answer.unit.spec.ts (appended cases) - null-body and empty-range cases: **2 failed** against the pre-follow-up code (rangeIsEmpty stubbed to the screen's old behaviour). Server-contract pin: **1 failed** with route.ts ok() re-wrapped as `{ data }`, injected and reverted (route.ts unchanged in this commit). After: 71 passed across the report and queue specs.

CORRECTION TO RC-015 (the register is append-only, so recorded here): its Files list omits
jalsa/tests/unit/indoor-queue.unit.spec.ts (rung 2e), which is part of the fix. Where this run's
gate line says the fix is "proven by" unit specs, read "the parser is proven by"; the SCREEN was
not observed. Rung 2e is a source assertion in that file's own idiom and would not catch every
spelling of the old read; a behavioural reader for queue refusals was not built here.
RC-015 also collides by number with an unrelated RC-015 in framework-upstream/'s own register;
the two registers are separate files and are not merged.

---

## Application run - jalsa - 2026-09-24 - Bug: Reports showed nothing for any range (RC-015, R-025 second report)

ROOT CAUSE: the Reports screen read `body.data` / `body.error.message`, an envelope nothing on the
server sends; `ok()` returns the report as the bare body and `fail()` returns `{ code, message }`.
Every report reached the screen and was discarded into "Nothing in this range". Proven from
Supabase edge logs: after B-1044 closed (23-Sep 08:00:05Z), eight report reads for 23-Sep returned
one row each. Sibling: GuestQueue read refusals the same way, so its "queue closed" screen could
never appear. Sweep: 6 `res.json()` sites in src; 2 wrong, both fixed.

FAIL-FIRST: jalsa/tests/unit/report-answer.unit.spec.ts - against the screen's pre-fix parsing (moved verbatim into `readReportAnswer` before the fix): **3 failed, 1 passed** - "expected report, received null" (twice) and "expected the 403 sentence, received 'The report could not be read.'". After the fix: 4 passed.
FAIL-FIRST: jalsa/tests/unit/indoor-queue.unit.spec.ts (appended rung 2e) - against HEAD's GuestQueue.tsx: **1 failed, 22 passed**; with the fix: 23 passed.

Gate (jalsa): G1-G7 and G9-G12 PASS, unit 942 then 943 after rung 2e; G8 functional BLOCKED, as
recorded with --skip G8: `*.supabase.co` CONNECT is refused from this container (403), so the
corrected screen was NOT opened against live rows. The first gate run of the day is also recorded
as FAIL: G7/G8 timed out because the dev servers had no environment; the rerun supplied
placeholder, non-secret values. Verify on the deployment: open Reports, pick 23-Sep, expect
1 bill (B-1044, UPI).

---

## Application run - jalsa - 2026-09-23 - Bug: the Windows installer would not parse (bridge 2.0.1)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** First real Windows run: install.ps1 failed
at 125:97 (a `→`, read as the quote `’` by Windows PowerShell 5.1 in the ANSI code page, no BOM).
Reproduced with PowerShell 7; sources made ASCII-only; the packager now validates every script
(tokenizer, Windows-1252 view, real parser when present) and ships .ps1 with a BOM, .cmd without.

FAIL-FIRST: jalsa/tests/unit/bridge-package.unit.spec.ts (appended rungs) - the arrow put back: 1 failed; BOM dropped: 1 failed; typographic quotes ignored by the tokenizer: 2 failed; validation skipped in the packager: 1 failed.

Gate run (jalsa): unit 938 passed, typecheck and lint clean, bridge:package clean with the real
PowerShell parser; G8 functional BLOCKED on this runner (no database), as before. The corrected
package has NOT been run on Windows yet.

---

## Application run - jalsa - 2026-09-23 - Printers: connect the printing computer

**The full record lives in `jalsa/TEST_SUMMARY.md`** (the mutation table, the fifteen cases of the
brief and where each executes, what was run, what was not, and the database evidence). This block
exists because guard G3 reads only the root file.

Software-tested; Windows runtime pending (KL-7); physical printer pending (KL-6). 17 defects
injected into the finished tree, all 17 observed failing on the rung written for each:

FAIL-FIRST: jalsa/tests/unit/bridge-pairing.unit.spec.ts - redeem without `used_at IS NULL`: 1 failed (SINGLE-USE); the pair route reading a restaurant from the request: 1 failed (RESTAURANT-SCOPED); the code sent untidied: 1 failed (PAIRING SUCCESS).
FAIL-FIRST: jalsa/tests/unit/bridge-paired-config.unit.spec.ts - config written in place with no rename: 1 failed (a write that fails midway leaves the previous config intact).
FAIL-FIRST: jalsa/tests/unit/bridge-discovery.unit.spec.ts - an unreadable printer list returned as an empty success: 1 failed (a list this bridge cannot read is a FAILURE).
FAIL-FIRST: jalsa/tests/unit/bridge-service.unit.spec.ts - duplicate machine id taking the LAST queue: 1 failed; a 401 treated as an outage: 1 failed (REVOKED); the outage rethrown: 1 failed (RESTART / RECONNECT); the queue name dropped from the script environment: 1 failed.
FAIL-FIRST: jalsa/tests/unit/print-computer.unit.spec.ts - a printer Windows no longer lists reading as Ready: 1 failed (READINESS); a raw last_error shown to the owner: 1 failed (ERROR MAPPING).
FAIL-FIRST: jalsa/tests/unit/printers-screen.unit.spec.ts - the screen given a queue-name input: 1 failed (THE OWNER NEVER TYPES); the mapping save accepting any queue string: 1 failed (PRINTER MAPPING).
FAIL-FIRST: jalsa/tests/unit/bridge-package.unit.spec.ts - the task registered as the installing user: 1 failed; the README dropped from the package: 1 failed; a bridge token committed in a tracked file: 1 failed (NO SECRETS COMMITTED).
FAIL-FIRST: jalsa/tests/unit/bridge-contract.unit.spec.ts (superseded, four verbs) - a paired claim no longer limited to its mapping: 1 failed | 24 passed.

Gate run (jalsa): G8 functional FAIL/BLOCKED on this runner - no database, as every prior run
here; every other step PASS. unit 932, render + degraded 266, framework audits 11/11, guards 15/15.

---

## Application run - jalsa - 2026-09-22 - MERGE: main into the printing branch

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

`main` had moved on by four commits, one of which (`c35f64f`) adds a Test Print feature - the same
thing Gate 6 built, independently. "Keep both" was achievable for ONE of three conflicts (an import
line, a true union) and impossible for the other two: two `export async function testPrint` do not
compile, and two buttons with the same `data-testid` are one broken control. A fourth collision
merged CLEANLY and was the more dangerous one - `src/lib/test-print.ts`, a second test-ticket
builder, conflicting with nothing.

THIS BRANCH'S `testPrint` HAD TO WIN, AND NOT AS A PREFERENCE: main's writes no `station`, and
`bridge-payload` matches a test job to its machine BY the station. A naive "take main's" merge
would have shipped, green, a Test Print button that queues jobs the bridge then fails to render.

MAIN'S SIDE CONTRIBUTED MOST OF THE REST: `testPrintBlocker()` (one definition of "is this machine
testable", shared by button and server - its own comment gives the reason and it is right), the
non-throwing `{queued, printerName, reason}` shape, the per-printer `testing` flag, and
`action: 'Printer'` on the audit rather than Gate 6's `'Reprint'` - a diagnostic filed among the
night's reprints reads as trade that never happened.

REMOVED: `buildTestTicket()` and its eight cases. Nothing called it but its own spec; a test ticket
is composed by `buildTicket` through `test-ticket.ts`, on the template a kitchen ticket uses.

TWO USER-VISIBLE SENTENCES REWRITTEN because they stopped being true - they said no print service
was connected and no paper would come out, which was accurate on main and false the moment Gates
2-6 landed an encoder, three transports and a bridge. Neither now says "printed".

FAIL-FIRST for the merge: 3 defects injected, all 3 observed failing - the shared blocker no longer
refusing, a test print filed as trade (main's own rung), and the blocker not refusing a switched-off
machine (both branches' rungs).

Merged tree: 998 passing, 0 failing, 10/10 audits, typecheck and lint pass, bridge build clean.
GATE 7 IS UNAFFECTED AND STILL BLOCKED - nothing here is evidence that a printer printed.

---

## Application run - jalsa - 2026-09-22 - Phase 2 Gate 7: BLOCKED (hardware-pending)

**The full record lives in `jalsa/TEST_SUMMARY.md`.**

Gate 7 is BLOCKED. No physical printer has printed a Jalsa ticket, and nothing claims otherwise.
Binding rule 4: PASS, FAIL, BLOCKED, and no fourth value for "the software all works so it will
probably be fine".

Proven by Gates 1-6: the claim, the composition, the ESC/POS bytes (golden, to the byte), both
development transports, the Windows spooler transport behind an injected command, every failure
branch, the report, the lifecycle against a real Postgres. NOT proven: that paper came out - the
Windows transport reports that the SPOOLER ACCEPTED the bytes, and Windows queues happily for a
printer that is switched off. Also unverified: whether the RP3160 honours the `ESC t 0` codepage
the encoder DECLARES, and whether bold, double-size, feed, cut and 80 mm width render as intended.

`jalsa/docs/GATE-7-HARDWARE-ACCEPTANCE.md` carries the 32-row procedure, written now so whoever has
the machine runs a checklist rather than inventing one. Recorded as KL-6. DC-012 stays AUTHORISED
and does not become VERIFIED - paper verifies it, nothing else does.

---

## Application run - jalsa - 2026-09-22 - Phase 2 Gate 6 (configuration, test print, bridge credentials)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

A TEST PRINT IS AN ORDINARY PRINT JOB. `testPrint()` inserts a row into `print_job` and stops;
everything after it is the path a kitchen ticket takes, unchanged. A button that opened the printer
directly would prove the one part of the path that never fails. A rung pins that no second print
path exists: `encodeTicket` has exactly one caller in the system, and no application module holds a
transport.

THE BRIDGE CREDENTIAL: 32 bytes of CSPRNG, only the SHA-256 stored, returned exactly once, never
logged or audited, and not readable back - `listBridgeTokens` does not even expose the hash.
Revoking is a timestamp, never a delete. The console has no field, state or request that carries a
token back in, and a rung walks every `send()` payload to prove it.

DATABASE EVIDENCE (TEST project; rows deleted afterwards): a Test job inserts with kot_id and
bill_id NULL; the bridge's own list predicate finds it, by the same query a KOT is found by;
`bridge_token` stores a 64-char hex hash and has no token/secret/raw_token column.

FAIL-FIRST: 11 defects injected. NINE fired first time. TWO did not, and both were rungs of mine
that checked for a STRING rather than a behaviour: the switched-off guard (the words survive
`if (false)`, so the GUARD EXPRESSION is pinned instead) and the token-in-audit rung (looked for
`token)` while the injection wrote `${token}`; then went red on the clean tree twice more, because
"token" is also an English word in the detail and because the slice swept in the legitimate
`return { …, token }`). It now reads the audit call only and checks interpolations separately.
Third appearance of this class after Gate 1's ternary and Gate 4's side rule.

A GATE 4 RUNG NARROWED: `bridge-contract` asserted across the whole FILE that the payload composes
from the origin. Gate 6 added a second `composeTicket` call site (the test print, which has no
origin) and the file-scoped regex went red on correct code. Narrowed to `ticketPayloadFor`, then
re-injected with the original defect to confirm it still fires.

Finished tree: 715 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass.

---

## Application run - jalsa - 2026-09-22 - Phase 2 Gate 5 (the Windows print bridge)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

The bridge becomes a program a restaurant can run: `WindowsSpoolerTransport`, a startup that
refuses a broken configuration, one-line-JSON logs, signal handling and graceful shutdown.

WHAT A SUCCESS MEANS, STATED FIRST: the spooler ACCEPTED the bytes. It does not mean paper came
out - Windows queues happily for a printer that is switched off - and no spooler-based transport
anywhere can promise more. The success sentence says `accepted by queue`, never `printed`, and a
rung asserts it keeps saying so. Hardware is Gate 7 and nothing green here moves it.

`copy /b` rather than a native `winspool.drv` binding: no compiler on a restaurant's PC, no
rebuild per Node upgrade, no unreadable binary. `/b` is load-bearing - without it `copy` runs in
text mode, stops at the first 0x1A and translates line endings. The command is INJECTED so that
every failure path (non-zero exit, timeout, missing queue) is executable off Windows; wired
directly to `spawn` they would be testable nowhere.

A REGRESSION THIS GATE CAUSED AND THE HARNESS CAUGHT: making `JALSA_BRIDGE_SPOOL_DIR` required
broke two fixtures in `bridge-loop.unit.spec.ts` and took 20 Gate 4 rungs red. Surfaced by the
fail-first harness reporting 21 failures for a defect injected into a file `bridge-loop` does not
import. Fixed in the FIXTURES, not by relaxing the requirement.

FAIL-FIRST: 12 defects injected into the finished tree, all 12 observed failing - `copy` losing
`/b` (1 failed, 79 passed), a non-zero exit reported as success, a hung spooler unnoticed, the
queue-name whitelist removed (7 failed; the empty name is still caught by the length test, which
was not the injected half), the stream staged through a text path, success claiming the ticket
printed (2), the Windows transport allowed on any platform, the token logged (2), startup
reporting only the first problem, a second signal being a second shutdown, the staged file left
behind, and a throwing command escaping the transport.

Added: `bridge/src/transport/windows.ts`, `bridge/src/main.ts`, `bridge/README.md` (the Windows
runbook), `bridge-windows.unit.spec.ts` (26 cases), `bridge-startup.unit.spec.ts` (14 cases).
FileTransport and NullTransport are untouched and still shipped. `bridge:build` now produces one
file whose only imports are `node:fs/promises`, `node:path` and `node:child_process`.

Finished tree: 695 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass.

---

## Application run - jalsa - 2026-09-22 - Gate 4 remediation (R4-1 food side, R4-2 station)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

Two correctness defects the Gate 4 investigation found, both crossing Phase 1 contracts, both
approved as controlled amendments before any file was touched.

R4-1: `splitRound` keys buckets on `printer | station | side` and `queuePrint` persisted only the
first two, so a split round wrote two rows identical in every stored field. The severe consequence
was NOT the split: `printElsewhere` writes the destination machine's station, so a redirect to a
machine the round also touches composed the WRONG HALF and printed it - an ordinary-looking ticket
for food that had already printed elsewhere, while the intended round was never delivered. Fixed
with `RoundTicket.side`, migration `20260922090000` (`food_side`, a check constraint and a separate
immutability trigger), `queuePrint` persisting it, `printElsewhere` copying the ORIGIN's, and a new
pure `redirect-lineage.ts` that walks `redirected_from_job_id` to its root capped at 8. The legacy
refusal is KEPT for pre-migration rows, which the `'all'` default cannot rescue - recorded as KL-5.

R4-2: routing carried `station` the whole way and `TicketData`/`buildKot` dropped it at the last
step, so a fallback ticket was byte-identical to a main-kitchen ticket. Fixed as data-contract
propagation; it prints by default, recorded as DC-012.

BYTE EVIDENCE: goldens captured from the PRE-remediation tree at both widths before any file
changed. R4-1 byte identity - 58mm IDENTICAL (572 bytes), 80mm IDENTICAL (804 bytes). R4-2 change -
58mm 572 to 611, 80mm 804 to 859, one bold STATION line each, with a rung asserting nothing else
moved.

DATABASE EVIDENCE (TEST project, each assertion its own statement; rows deleted afterwards):
default 'all'; an invalid insert violates `print_job_food_side_check`; a valid-but-different update
raises "print_job.food_side is immutable"; retryPrintJob's exact patch leaves it 'non_veg'; a
redirect row carries the origin's 'non_veg'.

FAIL-FIRST: 13 defects injected into the finished tree, all 13 observed failing - splitRound
hard-coding the un-split side (5 failed, 181 passed), queuePrint hard-coding food_side (2),
printElsewhere taking the half from the destination (1), retryPrintJob patching food_side (2),
ticket-compose matching on machine+station only (4), the legacy guard removed (1), the redirect cap
stopping halfway (3), the walk never following the lineage (8), buildKot losing the station case
(7), the station shipping switched off (7), composeTicket dropping the job station (7), the ticket
field order changing (4, both goldens both widths), and bridge-payload composing from the redirect
itself (1).

A RUNG THAT WAS WRONG, RECORDED: the "only difference is the station line" rung first diffed
DECODED bytes and reported two added lines - keeping printable bytes leaks the `E` out of
`ESC E 01`, the bold-on the station line introduced. Decoding properly would mean an ESC/POS parser
inside a test. It diffs the composer's `TicketLine[]` instead; the bytes are pinned exactly by four
rungs above it.

Two Gate 4 specs superseded under the contract-change exception with dated notes; every other Gate
4 scenario re-run UNCHANGED and passing.

Finished tree: 655 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass, bridge
build clean.

---

## Application run - jalsa - 2026-09-21 - Phase 2 Gate 4 (the end-to-end software bridge)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

The whole path proved without a printer: queued -> claim -> TicketLine[] -> ESC/POS ->
FileTransport -> report -> printed, and the failure path beside it ending at `failed` with the
`printer_id` untouched and no second job. Three specs added (`bridge-loop` 25 cases,
`ticket-compose` 16 cases, `bridge-import-hygiene` superseded under the contract-change
exception). The unit tier goes 573 -> 615.

BLOCKER FOUND AND REPORTED RATHER THAN WORKED AROUND: `splitRound` buckets a round by
`printerId | station | side`, but the `print_job` row stores only the first two. With the
food-type split ON, one round produces two jobs that are identical as rows, and nothing can say
which half belongs to which ticket. `composeTicket` REFUSES that case instead of guessing, because
guessing prints the whole round twice at one machine. The fix is one additive column written at
queue time, which means changing `queuePrint` - a Phase 1 contract this gate may not touch.

DATABASE EVIDENCE (TEST project, each transition its own statement; rows deleted afterwards):
claim A = 1 row / claim B = 0 rows; loser report = 0; holder report = 1; reclaim after printed = 0;
second report = 0; reassigning printer_id raised "print_job.printer_id is immutable"; a job left
`processing` was offered 0 times, claimed 0 times and stayed `processing`.

FAIL-FIRST: 16 defects injected into the finished tree, each observed failing - the losing bridge
carrying on past the claim (1 failed, 80 passed), the local machine filter removed, an
unrenderable ticket encoded anyway, a transport failure not reported (2 failed), the backoff never
growing, the loop learning the word "queued", a machine it cannot serve not refused, the
veg/non-veg ambiguity guard removed (2 failed), the routing-changed guard removed (2 failed), a
job taking the whole round (2 failed), the template deciding the paper, a Supabase credential no
longer stopping the bridge, a bridge serving nothing allowed to start, a nonsense poll interval
becoming a tight loop, and the bridge reaching a fourth application file.

THE RUNG THAT COULD NOT SEE ITS OWN DEFECT: injecting an inverted food-type side rule left the
equivalence rung GREEN - it compared machines and bucket counts and stripped the side off the key
before comparing, so the one thing it was named after was the one thing it could not see. Same
class as the Gate 1 "must not write printed" rung that passed over the exact ternary that wrote
it. Replaced with a rung asserting the rule's meaning, which fires. A first replacement also
compared `splitRound`'s aggregate; that half was wrong and went red on the clean tree, because the
ambiguous case is two buckets sharing one machine and the aggregate cannot tell them apart - so it
was removed rather than weakened.

SECOND FINDING: the station never reaches the paper. `print-routing.ts` carries `station` so a
fallback ticket can be stamped TANDOOR, and `TicketData`/`buildKot` have no field for it. Recorded
as a rung that goes red the day one is added.

Finished tree: 615 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass,
`npm run bridge:build` clean with only `node:fs/promises` and `node:path` imported.

---

## Application run - jalsa - 2026-09-21 - Phase 2 Gate 3 (PrintTransport abstraction)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

Two specs added: `jalsa/tests/unit/bridge-transport.unit.spec.ts` (26 cases) and
`jalsa/tests/unit/bridge-import-hygiene.unit.spec.ts` (14 cases). The unit tier goes 533 -> 573.

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - the payload written as text
(`Buffer.from(bytes).toString('latin1')` with a `utf8` encoding argument, the single most likely
accident in this file): 2 failed, 38 passed - "what lands on disk is byte-for-byte what was handed
over, for all 256 byte values" and "bytesSent is measured from the file, not echoed from the
input". Note which rung did NOT fail: the encoded-ticket round-trip, because that ticket is pure
ASCII and survives the mangle intact. That is exactly why the 256-value case exists.

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - a short write (`bytes.slice(0, 10)`):
4 failed, 36 passed - the two byte-identity rungs, the measured-size rung, and the `.txt` rung.
A transport that reported success on a truncated stream would print half a ticket and record it
as printed.

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - the destination containment guard
disabled: 7 failed, 33 passed - the escape case and six of the seven malformed-destination cases.
The `..` case stayed GREEN, and honestly so: the second, belt-and-braces `startsWith(root + sep)`
check still refused the write. The layer that was removed is the one that names the fault.

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - the job-id guard disabled: 1 failed,
39 passed - "a job id that is not a safe filename is refused rather than sanitised". Sanitising
would collapse two jobs onto one filename and the second would overwrite the first silently.

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - the `.txt` rendering written
unconditionally: 1 failed, 39 passed. FAIL-FIRST: the hex rendering made to DROP control bytes
rather than show them: 1 failed, 39 passed - "the rendering shows control bytes as hex and never
pretends to parse them".

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - a caught write failure returned as
`ok: true`: 1 failed, 39 passed - "an unwritable directory is a returned failure, not a thrown
exception". This is Phase 1's exact defect re-injected one layer down.

FAIL-FIRST: jalsa/tests/unit/bridge-transport.unit.spec.ts - NullTransport made to report success
because nothing went wrong: 4 failed, 36 passed, including "NullTransport never reports a success,
over many attempts" and the result-shape rung. FAIL-FIRST: its failure marked `retryable: true`:
1 failed, 39 passed - a bridge loop would spin on a configuration fault and call it a flaky
printer.

FAIL-FIRST: jalsa/tests/unit/bridge-import-hygiene.unit.spec.ts - `import 'react'` added to a
transport: 2 failed, 38 passed - the node-builtins allow-list and the named `react` rung.

FAIL-FIRST: jalsa/tests/unit/bridge-import-hygiene.unit.spec.ts - a TYPE-ONLY
`import type { TicketLine } from '@/lib/print-template'` added: 2 failed, 12 passed - the
allow-list and "the app alias is unreachable from the bridge". A type-only import is erased at
build time and still couples the bridge to the application's module graph; it is how the first
honest-looking `@/lib/db` reference gets in.

FAIL-FIRST: jalsa/tests/unit/bridge-import-hygiene.unit.spec.ts - a browser-only global
(`typeof document`) added to a transport: 1 failed, 39 passed. FAIL-FIRST: the walk pointed at a
directory holding no `.ts` sources: 2 failed, 38 passed - the parse guard and "Node builtins ARE
allowed, and the bridge does use them". Binding rule 5: a scan matching zero files must not look
like a clean codebase.

FINDING, not a rung: the first attempt at the `@/lib/db` defect imported `@/lib/db/bridge-mutations`
at RUNTIME. It did not fail a test - it killed the whole spec file at load with "This module cannot
be imported from a Client Component module", because that module pulls in `server-only`. Worth
recording: an application data-layer import into the bridge is not a subtle coupling, it is an
immediate hard failure. The rung was re-run with the type-only form, which is the one that would
actually get committed.

Finished tree: 573 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint all pass.
`npm run bridge:build` bundles both transports for node20; the bundle's only imports are
`node:fs/promises` and `node:path`.

---
_`## Application run - jalsa - 2026-09-21 - Phase 2 Gate 2 (ESC/POS encoder)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

One spec added: `jalsa/tests/unit/escpos.unit.spec.ts` - 26 cases, golden bytes throughout. The
encoder is pure, so every assertion is an exact byte string; nothing downstream can check this,
because a spooler accepts whatever it is handed and a printer that receives `1B 45 00` where
`1B 45 01` was meant prints a line that is merely not bold - legible, plausible and wrong.

FAIL-FIRST: jalsa/tests/unit/escpos.unit.spec.ts - unmapped character made to fall through as
`0x3F` instead of throwing: 4 failed, 22 passed - "AN UNMAPPED CHARACTER FAILS - it is never
silently replaced", "THE ERROR NAMES THE CODEPOINT, THE LINE AND THE COLUMN", "THE RUPEE SIGN IS
DELIBERATELY UNMAPPED", and the code-point column case. A '?' on a bill is a character nobody can
trace back to its cause.

FAIL-FIRST: jalsa/tests/unit/escpos.unit.spec.ts - `encodeTicket` made to slice each line to the
configured column count: 1 failed, 25 passed - "THE ENCODER NEVER TRUNCATES AND NEVER WRAPS".
Deciding a line is too long is the template's job; an encoder that trimmed would turn a caught
layout fault into a quietly clipped figure on a bill.

FAIL-FIRST: jalsa/tests/unit/escpos.unit.spec.ts - the end-of-stream emphasis reset removed:
3 failed, 23 passed - including "THE STREAM NEVER ENDS MID-EMPHASIS - the next job starts clean".
A job that ends bold makes the NEXT job wrong, and that one prints in a different room from the
person who could connect the two.

FAIL-FIRST: jalsa/tests/unit/escpos.unit.spec.ts - the `line`/`column` clause removed from the
`EncodeError` message: 1 failed, 25 passed - "THE ERROR NAMES THE CODEPOINT, THE LINE AND THE
COLUMN". "Cannot encode U+20B9" sends somebody reading the whole ticket.

FAIL-FIRST: jalsa/tests/unit/escpos.unit.spec.ts - `GS !` changed from `0x11` to `0x01`, double
height without double width: 3 failed, 23 passed - "BIG IS GS ! 11", the whole-ticket golden, and
the big-to-bold transition. The defect prints a heading that is subtly the wrong shape, which is
exactly the class golden bytes exist to catch.

NOTE ON THE CODEPAGE: `ESC t 0` (CP437) is DECLARED, not verified. No device has confirmed which
table it holds or that it honours the selection. The encoder therefore emits no high bytes on the
strength of it - ASCII passes through and anything else must be named in the charset map or the
job fails. A verified CP437 upper half is Gate 7 work, after hardware says so.

Finished tree: 533 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint all pass.

---

## Application run - jalsa - 2026-09-21 - Phase 2 Gate 1 (print bridge contract)

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file.

One spec added: `jalsa/tests/unit/bridge-contract.unit.spec.ts`. Its guarantees are properties of
writes and type shapes, so each was checked by injecting its own defect into the finished tree.

The claim's ATOMICITY is not a source property and is not asserted by that file. It was proved
against the TEST Supabase project through MCP: one queued job, two identical conditional updates,
`A updated 1 row(s), B updated 0 row(s)` - exactly one winner, assignment intact through the
claim, and `printed` reachable only from `processing`.

FAIL-FIRST: jalsa/tests/unit/bridge-contract.unit.spec.ts - `reportPrintJob`'s patch given a
`printer_id` key: 1 failed, 18 passed - "THE REPORT CANNOT NAME A PRINTER - rerouting is not
expressible". That is the boundary between Jalsa and the bridge, asserted as a closed key set.

FAIL-FIRST: jalsa/tests/unit/bridge-contract.unit.spec.ts - `sweepStaleClaims` changed to write
`status: 'queued'` instead of `'failed'`: 1 failed, 18 passed - "A STALE CLAIM EXPIRES TO failed
AND NEVER TO queued". Re-queueing asserts no paper came out, and a wrong assertion prints the
round twice.

FAIL-FIRST: jalsa/tests/unit/bridge-contract.unit.spec.ts - `claimPrintJob` with its
`.eq('status', 'queued')` predicate removed: 1 failed, 18 passed - "THE CLAIM IS ONE CONDITIONAL
UPDATE - the property atomicity rests on".

FAIL-FIRST: jalsa/tests/unit/bridge-contract.unit.spec.ts - `authenticateBridge` changed to ignore
a lookup error (`if (!data)` instead of `if (error || !data)`): 1 failed, 18 passed - "AUTH FAILS
CLOSED - an unreachable lookup is \"no\", never \"yes\"". Failing open there turns a database
outage into an authorisation bypass.

Two rungs in this file first went red on the code's own COMMENTS - `bridge-auth.ts` carries a
heading "WHY NOT `SUPABASE_SECRET_KEY`" and the route mentions the sweeper while explaining late
reports. Both now strip comments before asserting absence: a rung that punishes a file for
explaining itself teaches people to stop explaining.

Finished tree: 507 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint all pass.

---

## Gate run` blocks are written by `scripts/gate-runner.mjs`; guard G2 greps for them._

---

FAIL-FIRST: jalsa/tests/unit/qr-stand.unit.spec.ts - run against the tree as it stood before
this change (the three modified sources restored from the index and the three new sources moved
aside, nothing else touched): the file could not load at all - `Cannot find module
'src/lib/qr-svg'` - because the generator it exercises did not exist. That is the honest
result for a spec whose first import is the thing being built, and Playwright reports it as the
whole file failing. Restored from saved copies, every file verified byte-identical by `cmp`:
**12 passed**, including the real generator producing a real SVG.
FAIL-FIRST: jalsa/tests/render/table-stand.render.spec.ts - same pre-change tree, run alone:
**1 failed, 18 passed**. The one that failed is the pin - `ENOENT` on TableStandSheet.tsx,
which did not exist - and it is the ONLY case that can fail there: the eighteen width cases
build their own DOM from the pinned strings and measure that, so they are green on either tree.
The pin is what binds the measurement to the component, and it is the one that fired. Restored:
**19 passed**.
Full suite: **1101 passed** (unit + render), 0 failed - main's 1070 plus exactly these 31.
Chromium only; the WebKit-backed tablet and mobile-ios projects cannot run in this container.

WHAT THIS IS: the three QR items from the 23-Sep request. (6) The table and entrance codes now
carry the Jalsa badge in their centre. (7) A Google review code for the back of the stand. (8)
The scan instructions, in the owner's own words, printed on the front. Plus the thing that makes
7 and 8 a single object: a printable two-faced stand, opened from Tables & QR beside the existing
QR button, previewed side by side and printed as two pages to fold.

WHY THE CODE BECAME A VECTOR, AND WHAT DID NOT CHANGE: the badge needs compositing, and a PNG is
pixels with no compositor installed. The QR library emits SVG as a path, and a second shape can
be written into a path with string arithmetic. What the table code ENCODES is untouched -
`indoor-queue.unit.spec.ts` pins that target expression byte for byte and still passes. The
badge is 22% of the width, about 5% of the area, inside level H's 30% recovery margin - the
level the code already used because it lives under a water jug.

WHY THE MARK IS DRAWN AND NOT LOADED: an SVG served as an image may not reference another file,
and a runtime read of `public/brand/mark-light.svg` from a serverless function is a file the
bundle may not carry. The glyph's path data lives in `lib/qr-svg.ts`, byte for byte the shape in
the asset, and EVERY colour comes from the token map - the hardcoded-colour audit scans that file
and ratchets on a literal. A case asserts the source carries none and that the output carries no
external reference.

WHY THE REVIEW CODE IS ITS OWN ROUTE AND TAKES NO INPUT: a `?url=` would let any signed-in staff
member print a code pointing anywhere and hand it to a guest as the restaurant's. The link is
read from `settings.engagement.reviewUrl` - the SAME setting the guest's phone offers after the
meal, already set in production - so the card and the phone can never disagree. No link set is a
404 that names the setting to fill; a link that is not `https://` is a 422. Both are pinned.

ONE FINDING THE RENDER PROBE MADE BEFORE IT SHIPPED: an address has no spaces to wrap at, and at
320px it set the face's floor width and pushed it out of the dialog. `break-all` on that element
was added before the first green run, and the pin now asserts it - the measurement exists for
exactly this class of defect.

NO DATABASE CHANGE: no migration, no new column, no new setting. The review link was already a
setting; the stand only reads it.

NOT BUILT: submenu category, from the same request, which needs a second level on a flat
`menu_category` table plus menu-editing changes and is reported rather than half-built.

Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so the stand was not opened against a live table
row and no code was scanned by a phone. The generator is exercised for real in the unit spec; the
routes and the sheet are pinned at the source level; the layout is measured at nine widths.

---

FAIL-FIRST: jalsa/tests/unit/report-gst-split.unit.spec.ts - run against the five source files
as they stood before this change, restored from the index with nothing else touched:
**11 failed, 0 passed**. Every case failed, which is the honest result for a split, a category
breakdown and a payment panel that did not exist: `summarise` returned no `gstSplit` and no
`byPaymentMode`, a line carried no category, and the screen had neither panel. Restored from
saved copies and re-run: **11 passed**.
Full suite: **1070 passed** (unit + render), 0 failed - main's 1059 plus exactly these 11.
Chromium only; the WebKit-backed tablet and mobile-ios projects cannot run in this container.

WHAT MARKS A BILL AS GST, STATED BECAUSE IT IS A JUDGEMENT AND NOT A LOOKUP: nothing in the
database says "this bill was billed under GST". What it records is the tax actually charged, so
a bill that carried tax is counted as a GST bill and one that carried none is not. That is the
honest reading of what was stored. A flag invented now could not be backfilled onto bills already
closed and would disagree with their printed copies, and adding a column would have meant a
migration deployed ahead of code - the exact ordering that took the application down on
22-Sep-2026. The screen states the rule out loud, because a reconciliation done against a number
whose rule is unstated is one nobody can check. If GST status ever needs to differ from "tax was
charged" - a zero-rated item under GST, say - that is a column plus a control at closure, applied
to production BEFORE the code that reads it ships.

GROSS, NET, AND THE TAX BETWEEN THEM: gross is `restaurantIncome`, what the customer paid less
any tip, which was never the restaurant's. Net is the base before GST, DERIVED as gross minus
tax rather than carried as a third number that could be passed in disagreeing with the other two.
A case asserts `gross - net === tax` for exactly that reason, and another asserts a tip never
reaches either side.

SALES BY CATEGORY: built in the SAME walk over the lines that the dish list already made - a case
counts the loops and fails at two, because two walks over one set of lines is how a category
total ends up disagreeing with the dishes listed inside it. The category is the one `placeRound`
snapshots into `kot_item.menu_category_name`, so a category renamed or deleted next month cannot
rewrite what last month sold. Rounds placed before that column existed are shown as Uncategorised
rather than dropped: a sale that happened is not a sale that can be hidden. The column is in
production already - it arrived with the print-bridge migration applied on 22-Sep - so reading it
needs no migration of its own, which was checked before the select was widened.

PAYMENT DISTRIBUTION: cash, card, UPI, ordered by amount, each with its share and bill count. A
bill closed before the mode was captured gets its own Unrecorded row rather than being folded
into Cash, because overstating the one figure a cash reconciliation is done against is worse than
an honest gap. The share is guarded against an empty range so the panel cannot print NaN%.

NO DATABASE CHANGE: no migration, no new column, no new permission. The one query change widens
an existing select by a column production already has.

NOT BUILT, AND NOT STARTED: submenu category. `menu_category` is a flat table with no second
level, so a breakdown below category needs a schema change plus menu-editing changes, and it is
reported rather than half-built. The Jalsa QR with the logo, the Google review QR and the menu
card scan instructions are separate items from the same request and are not in this change.

Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so the panels were not rendered against live
bills. The arithmetic is exercised against the real `summarise` with constructed bills; the
screen is pinned at the source level only.

---

FAIL-FIRST: jalsa/tests/unit/owner-new-round.unit.spec.ts - run against the owner route and the
dashboard as they stood before this change, restored from the index with nothing else touched:
**9 failed, 0 passed**. Every case failed, which is the honest result for a verb and a control
that did not exist: the route had no `add-round`, and the floor tile was `disabled={!t.billId}`,
so a free table was inert by construction. Restored from saved copies and re-run: **9 passed**.
Full suite: **1059 passed** (unit + render), 0 failed - main's 1050 plus exactly these 9.
Chromium only; the WebKit-backed tablet and mobile-ios projects cannot run in this container.

WHAT THIS IS: the owner half of the free-table ordering the captain's floor gained in 56075f3.
A free, active table on "Floor right now" opens a sheet with the menu; the round sent from it
opens the table's bill and goes to the kitchen, and the dashboard then opens that bill.

ONE OPERATION, NOT TWO: the route calls `ensureOpenBill` then `placeRound` - the same pair the
captain's route calls - with `source: 'owner'`, which the bill and every report already read to
say where an order came from. The verb has no `billId` mode: adding to a bill that exists is the
captain's screen, and a branch here for it would never be walked. A case pins the absence.

WHERE THE PERMISSION LIVES: `placeRound` already demands `orders.add_items` for every non-guest
source, so the route does NOT check again. The dashboard checks the grant only to decide whether
to OFFER the control (Standard 5.6, the argument `free-table` makes in the same file). Two cases
hold both halves of that: the control is offered on the grant, and the door does not re-check.

ONE REQUEST, SO NO EMPTY TAB: there is deliberately no "open the bill" step. A bill opened by its
own call is a tab on a table nobody is sitting at, waiting for somebody to notice and free it.
Nothing exists until food is ordered.

A LINT RULE CHANGED THE DESIGN, CORRECTLY: the sheet first cleared its cart in an effect, which
`react-hooks/set-state-in-effect` refused - a render that fixes a render. It is keyed by the
table instead, so choosing a different one remounts it and the cart starts empty. The case pins
the key rather than the effect.

NO DATABASE CHANGE: no migration, no new column, no new permission. One additive field on the
response (`billId`), because the call may have created that bill.

Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no walk-in was seated from the owner console
and no bill was opened. Pinned at the source level only; nobody has opened the sheet.

---

FAIL-FIRST: jalsa/tests/unit/free-table-order.unit.spec.ts - run against the three source files
as they stood before this change, restored from the index with nothing else touched:
**8 failed, 0 passed**. Every case failed, which is the honest result for a control that did not
exist: the chip was a `<span>`, the shell had no second selection, the menu screen refused a
table without a bill, the request always carried a `billId`, the route never answered with one,
and the header promised "a new round on the same bill" for a table that had none. Restored from
saved copies and re-run: **8 passed**.
Full suite: **1050 passed** (unit + render), 0 failed - main's 1042 plus exactly these 8.
Chromium only; the WebKit-backed tablet and mobile-ios projects cannot run in this container.

WHAT THIS IS: the tables listed under "Free right now" on the captain's floor are now the way a
walk-in starts. Tapping one opens the menu for that table and the first round sent opens its
bill. WHAT IT IS NOT: a new rule about who may open a bill, and no new bill lifecycle.
`add-round` has opened a bill for a table that has none since it was written - `ensureOpenBill`,
reached whenever the request carries no `billId` - so the verb, the permission and the lifecycle
were already there and are unchanged. Only the way in was missing. The one server change is
additive: the response now also carries `billId`, because the call may have CREATED that bill and
the screen otherwise has to wait for the next poll to learn its id.

DESIGN NOTE, RECORDED BECAUSE THE ALTERNATIVE LOOKED CHEAPER: the table being seated is held in
its own `selectedTableId` rather than reusing `selectedBillId`. One slot meaning "either a bill
or a table" needs no signature change and is a trap afterwards - every screen receiving it has to
guess which kind it holds, and the guess is invisible in the type. Choosing a bill clears the
table and choosing a table clears the bill, so the two are never both live.

NO DATABASE CHANGE: no migration, no new column, no new verb, no permission change.

NOT DONE, AND NOT STARTED: the request also asked for this under the owner console. The owner
console has no "Free right now" list and no ordering surface at all - `api/owner/action` has no
`add-round` and `features/owner/` contains no menu screen. That is a new section plus a server
verb, not a wiring change, so it is reported rather than half-built.

Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no walk-in was seated against a live table and
no bill was opened. The flow is pinned at the source level only; nobody has tapped the chip.

---

FAIL-FIRST: jalsa/tests/unit/report-timezone.unit.spec.ts - the original defect restored inside
the new helper (`startOfDay` back to ``new Date(`${day}T00:00:00`)`` and `dayIn` back to
`toISOString().slice(0, 10)`), nothing else touched: **7 failed, 2 passed**. The two that stayed
green are the ones that should: the zone constant, and the half-open window's arithmetic, which
is correct in any zone. The seven that failed are every case that depends on WHICH zone a
calendar day belongs to - the local-midnight boundary, the month-end range, the after-midnight
sitting, the day stamp, the server's idea of "today", and the two source pins. Reverted from a
saved copy and re-run: **9 passed**.
Full suite: **1042 passed** (unit + render), 0 failed - main's 1033 plus exactly these 9.
Chromium only; the WebKit-backed tablet and mobile-ios projects cannot run in this container.
THE DEFECT, AND WHY IT IS NOT THE ONE THAT WAS REPORTED: R-025 said "nothing is showing up" in
Reports and was never built - the intake of 17-Sep read the screenshot as a permanent loading
state and recorded, correctly, that it had not reproduced it. With database access this run, the
cause is provable and is a WRONG WINDOW rather than a hung request: `listClosedBillsBetween`
parsed `YYYY-MM-DD` with no offset, which JavaScript reads in the host's zone, and the host is
UTC. A Hosur day was covered from 05:30 to 05:30. Live bill B-1048 is stamped
`2026-09-21T18:46:01.597Z` - 00:16 on the 22nd in the restaurant - and was therefore missing from
the 22nd and counted on the 21st. Two more instances of the same mistake sat on the same path:
the range was validated against the server clock, so between midnight and 05:30 local the server
refused the shift in progress as "not happened yet", and each bill's day came from slicing the
stored UTC string. All three now read src/lib/restaurant-time.ts. Recorded as RC-014.
I did not observe the permanent loading state and do not claim to have fixed it. If it returns,
it is a separate fault and the evidence to collect is the Vercel runtime log line tagged
`guest.page` or `api`, which carries the real message, code and status.
NO DATABASE CHANGE: no migration, no new column, no query shape change - only the two timestamps
the window is built from. The zone is a code constant because `restaurant` has no timezone column
and inventing one would be a schema change smuggled in behind a bug fix; the helpers take the
zone as an argument so that becoming a per-restaurant setting later moves only the default.
SIBLINGS FOUND AND NOT CHANGED, DELIBERATELY: four `toISOString().slice(0, 10)` sites take the
UTC date where a local one is meant - the CSV export filename, StaffPaperwork's `today()`,
LedgersSection's default `spentOn`, and an Intl fallback in analytics/format.ts. None is on the
report path. They are named in RC-014 rather than swept into a bug fix for another screen.
Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so the corrected report was not opened against the
live rows; the bill that proves the defect was read through the Supabase management connector,
which is evidence of the DATA, not of the screen.

---

FAIL-FIRST: jalsa/tests/unit/bill-share.unit.spec.ts - four deliberate defects, one per run,
each reverted; recorded when the WhatsApp bill text was built (jalsa/TEST_SUMMARY.md, run of
17-Sep-2026). Carried forward rather than re-injected: the spec promoted here is that same file,
byte for byte, and the source it pins is the same source.
FAIL-FIRST: jalsa/tests/unit/bill-detail-wiring.unit.spec.ts - **8 failed, 1 passed** with the
bill-detail sheet's wiring removed, from the same run. Its ninth case, the print-block scoping,
was recorded then as NOT OBSERVED FAILING and remains so: it asserts the ABSENCE of a blanket
`* { display: none }` inside `@media print`, and no injection makes an absence assertion fail
without writing the very rule it forbids.
FAIL-FIRST: jalsa/tests/unit/close-bill-order-pane.unit.spec.ts - **5 failed, 3 passed** against
the pre-change close-bill sheet, and jalsa/tests/render/close-bill-panes.render.spec.ts -
**9 failed, 18 passed** with the two-pane layout absent. Both from the record-payment run.
NEW EVIDENCE THIS RUN: run against main BEFORE the sources were copied in, the three
source-pinning specs could not resolve their subjects at all, and bill-detail-wiring's print case
failed on `body:has(.j-print-root)` because main's `@media print` block held only the
`.j-no-print` rule. With the sources in place: **1033 passed** (unit + render), 0 failed.
Chromium only; the WebKit-backed tablet and mobile-ios projects cannot run in this container.
WHAT THIS PROMOTION IS: the owner-side bill detail screen with Print and Share to WhatsApp, the
record-payment order pane, and src/lib/restaurant-identity.ts, which both import. NO DATABASE
CHANGE OF ANY KIND: no migration, no new column, no new table, no query change. The four bill
closure fields added to `OwnerBillView` (paymentMode, paymentReference, closedAt, closedBy) were
already being selected by `BILL_SELECT` and already shaped onto `Bill` - the view simply never
projected them, which `tsc` passing with no change to queries.ts proves.
WHAT IT DELIBERATELY IS NOT: the promotions, quick-add and logo-upload workstreams share these
files on the development branch and are NOT here - each needs a migration production has not had,
and the candidate was scanned line by line for their symbols with zero hits. The printer template
preview and its WhatsApp template are also held back: they rewrite the same PrintSetupSection
panel the print-bridge work just rebuilt, and combining the two is its own change with its own
evidence rather than a copy over the top.
REBASED WITHOUT REBASING: this candidate was first built on 760a983 and validated there. The
print-bridge merge landed on main first, so it was rebuilt file by file on c627f62 and every
check re-run against that base, rather than merged over it.
Gate for this change: **BLOCKED** - G8 functional did not run. This container's egress policy
refuses the CONNECT tunnel to `*.supabase.co`, so no bill was opened, printed or shared against
a real row. The deployed application is additionally unable to reach its own database at the time
of writing, which is an environment fault outside this change.

---

## Application run - jalsa - 2026-09-21 - Phase 1 print job assignment

**The full record lives in `jalsa/TEST_SUMMARY.md`.** This block exists because guard G3 reads
only the root file — the same subdirectory-layout gap noted in the 10-Sep block below, still
recorded as a candidate rather than escaped with a token.

488 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint all pass. The four
DB-dependent functional specs are environment-blocked, not failing: this runtime cannot reach
`*.supabase.co`.

Two specs were added. `print-assignment.unit.spec.ts` does not collect against the pre-fix tree at
ef930ea — it imports `src/components/ui/print.tsx`, which did not exist — so per-rung evidence was
obtained by re-injecting each shipped defect into the finished tree instead.

NOT OBSERVED FAILING: jalsa/tests/unit/print-assignment.unit.spec.ts (whole file, pre-fix tree) - it
cannot collect at ef930ea because `src/components/ui/print.tsx` did not exist; Playwright reports "No
tests found". The three injection runs below are the per-rung evidence.

FAIL-FIRST: jalsa/tests/unit/print-assignment.unit.spec.ts - `retryPrintJob` restored to re-select a
printer and patch `printer_id`, as it shipped: 3 failed, 23 passed - "RETRY MUST NOT REASSIGN THE
PRINTER", "RETRY MUST NOT RE-RUN ROUTING", and "a failed Tandoor ticket can never be retried onto the
Main Kitchen machine".

FAIL-FIRST: jalsa/tests/unit/print-assignment.unit.spec.ts - `queuePrint` restored to one job per round
with `status: reachable ? 'printed' : 'failed'`: 2 failed, 24 passed - "a printer answering is not a job
succeeding" and "NOTHING IN THE PRINT PATH MAY WRITE printed". The second went red only after the rung
was rewritten: the first version matched `status: 'printed'` literally and the real defect is a TERNARY,
so it passed over the exact thing it is named after.

FAIL-FIRST: jalsa/tests/unit/print-assignment.unit.spec.ts - `reprintKot` restored to pass no items: 1
failed, 25 passed - "A REPRINT ROUTES ON WHAT THE ROUND CONTAINS".

FAIL-FIRST: jalsa/tests/unit/print-assignment.unit.spec.ts - "the split is what the order path actually
calls" re-run with the production call behind a dead `false &&` guard: 1 failed - Expected
"input.items?.length", Received "false && input.items?.length". This rung had stayed GREEN under that
same injection before the guard expression was pinned.

FAIL-FIRST: jalsa/tests/unit/spec-supersession.unit.spec.ts - `jalsa/CLAUDE.md` reverted to its
pre-amendment wording: 2 failed, 4 passed - "the exception exists and is narrowly scoped to a CONTRACT
change" and "the exception names its pattern".

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

