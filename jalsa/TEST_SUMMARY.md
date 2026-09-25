# Test summary

_Newest run first. Append-only: never overwrite a prior run._

---

## Fix 3 review follow-ups - 2026-09-24 - a late poll cannot undo an echoed write; the echo has a deadline

A fresh-context review of fix 3 found: (D1) a scheduled poll that left before a write could land after the write's echoed answer and put the screen back to its pre-tap state - the double-send refresh-gate.ts exists to prevent; (D2) a HUNG screen build had no deadline, so a committed write could reach the phone as a 504 and be repeated. Fixed: the gate counts writes that answered with their screen and the hook discards a read that began before one; `withState` answers without the screen after 2.5 s.
FAIL-FIRST: tests/unit/refresh-gate.unit.spec.ts (appended rung) - against the pre-fix tree: "SyntaxError: The requested module '../../src/hooks/refresh-gate' does not provide an export named 'superseded'" - the old gate had no notion of a write, so a late poll was always applied.
FAIL-FIRST: tests/unit/action-echo.unit.spec.ts "a screen that will not build in time..." - against the pre-fix withState: keys "Received + 1" (state arrived, after the 6 s stall).
NOT OBSERVED FAILING: action-echo rungs "the owner console is echoed only to someone who may open it" and "a removed person is signed out" - they guard behaviour fix 3 already had (the reviewer found them untested, not broken).
Superseded in place (contract change, dated notes): refresh-gate "no residue" now includes `writes: 0`; action-echo owner keys now `toEqual(['done','state'])`.
Unit: 963 passed. Typecheck and lint clean.

---

## Fix 2 review follow-ups - 2026-09-24 - the closed bill, a moved phone, the cold restaurant lookup

A fresh-context review of fix 2 found three real regressions or gaps. Fixed:
- every live poll downloaded the table's last CLOSED bill in full (KOTs, print jobs) and a failure there broke the live screen - now a light id+closed_at read, the full bill only for `recently_paid`, and its failure is ignored when a bill is open;
- a phone that moved tables could be left with no session if a bill read failed after the old row was deleted - the new session is now written before any bill error propagates;
- `currentRestaurantId` cached only the answer, so a cold instance sent one duplicate lookup per parallel read - it now caches the lookup.
FAIL-FIRST: tests/unit/guest-rounds.unit.spec.ts (appended rungs) - against the fix-2 tree: "a closed bill is downloaded whole only for the screen that shows it" Expected false Received true; "a failed closed-bill read cannot take down a live guest screen" threw "closed-bill read failed"; "a failed bill read never leaves a moved phone without a session" Expected true Received false. 3 of 13 failed.
NOT OBSERVED FAILING: guest-rounds rungs for the recently_paid / table_inactive / not-found / no-cookie phases and the delete-before-insert order - new coverage of behaviour that was already correct; they guard it, they did not detect a defect.
NOT OBSERVED FAILING: the currentRestaurantId change - the fake database answers that lookup instantly, so the rig cannot see a cold instance; justified by code reading and the 952 ms first call in the 24-Sep log.
Rig hardening: each scenario now waits for in-flight calls before collecting, so a Promise.all that bails early cannot leak its siblings into the next scenario's record. The fake still records filters without applying them; the embed syntax was checked against real PostgREST 12.2 locally, not in CI.
Unit: 959 passed. Typecheck and lint clean. Local PostgREST: rounds unchanged, payloads identical.

---

## Fix 3 of the latency run - 2026-09-24 - staff/owner actions answer with the screen

FAIL-FIRST: tests/unit/action-echo.unit.spec.ts - against the pre-fix tree: staff action keys "Expected [done, state] Received [done]"; owner action "Expected value: state Received array: [done]"; currentStaff "Expected: 1 Received: 2" rounds. 3 of 6 failed; the two guard scenarios (build failure keeps the write's success, refusal carries no state) passed before and after, as they should.
Local PostgREST (100 ms per call): staff tap 2 requests (545 + 340 ms) -> 1 (552 ms); staff poll 3 -> 2 rounds; owner poll 5 -> 4 rounds. The screen returned with the action is identical to the old follow-up re-read.
Unit: 952 passed. Typecheck and lint clean.

---

## Fix 2 of the latency run - 2026-09-24 - guest screen: 8 sequential rounds to 2

FAIL-FIRST: tests/unit/guest-rounds.unit.spec.ts - against the pre-fix tree: "first scan (no session yet) Expected: <= 3 Received: 7"; "live poll Expected: <= 2 Received: 8"; "cart tap echo Expected: <= 2 Received: 4"; bill pointer test "Received + 1" (bill_id rewritten on every poll). 4 of 6 failed; after the fix 6 passed.
Rig: tests/support/round-rig.ts runs the real data layer with only the database client, the cookie reader and `server-only` swapped. Real PostgREST check (local, 100 ms per call): live poll 8 → 2 rounds, 867 → 233 ms; payloads identical before/after.
Unit: 946 passed. Typecheck and lint clean. tests/unit/combobox-migration.unit.spec.ts pins the heard-sources gate as source text; the gate is unchanged and the line keeps that text.

---

## Fix 1 of the latency run - 2026-09-24 - functions next to the database

FAIL-FIRST: tests/unit/function-region.unit.spec.ts - "ENOENT: no such file or directory, open '.../jalsa/vercel.json'" against the pre-fix tree (functions on the iad1 default). After `vercel.json` `regions: ["syd1"]`: 2 passed.
NOT OBSERVED FAILING: tests/unit/function-region.unit.spec.ts "no route overrides the pinned region" - no route has ever set `preferredRegion`; it guards the fix, it did not detect the cause.

---

## Gate run - 2026-09-23 - VERDICT: FAIL

Steps: 11 pass, 1 fail, 0 blocked.
Time: 4m 44s total - slowest G8 Functional / integration (4m 09s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (54ms)
- **G2 Contrast (all tokens, both themes)** - PASS (50ms)
- **G3 Theme assets present per theme** - PASS (53ms)
- **G4 No hard-coded colours** - PASS (68ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (11.7s)
- **G7 Unit + pure specs** - PASS (17.3s)
- **G8 Functional / integration** - FAIL (4m 09s)

```
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/test-failed-1.png
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop/test-failed-1.png
    Error Context: test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop/error-context.md
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/guest-total-visibility.fun-72182--for-it-and-stays-asked-for-desktop/test-failed-1.png
    Error Context: test-results/guest-total-visibility.fun-72182--for-it-and-stays-asked-for-desktop/error-context.md
```

- **G9 Automation addressability** - PASS (57ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.2s)
- **G11 Wide tables are configurable** - PASS (62ms)
- **G12 Installable as an application** - PASS (69ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Application run - jalsa - 2026-09-23 - Bug: the Windows installer would not parse (bridge 2.0.1)

**First real Windows run of the production download: the installer FAILED to parse.** Reported:
install.ps1 125:97 "The string is missing the terminator: '", then missing '}' at 124, 77, 73.

ROOT CAUSE (encoding, not syntax; not generated - install.ps1 ships verbatim from bridge/windows/)
  The script held `->` written as `→` (UTF-8 E2 86 92) and `—`. With no byte-order mark, Windows
  PowerShell 5.1 decodes a .ps1 in the ANSI code page (Windows-1252), where byte 0x92 is `’` -
  which PowerShell accepts as a single-quote delimiter. The string on line 125 closed at the
  arrow, its real `'` opened an unterminated one, and every enclosing `{` was reported unclosed.
  REPRODUCED here with PowerShell 7.4.6 (downloaded for this): the shipped bytes decoded as
  Windows-1252 -> exactly the customer's four errors (125:97 TerminatorExpectedAtEndOfString,
  124:8 / 77:17 / 73:8 MissingEndCurlyBrace); the same bytes decoded as UTF-8 -> OK.
  `--format=esm--target=node20` in the earlier transcript was display wrapping: package.json line
  36 has the space; the bundle it built is the one every unit spec imports.

THE FIX (source + packager, not the zip)
  bridge/windows/* are ASCII-only (`→` -> `->`, `—` -> `-`, box-drawing rules -> `-`).
  bridge/package/powershell-lint.ts: the ASCII rule with line:column; a tokenizer for PowerShell
  strings ('' and `" escapes, here-strings, line and block comments, brace/paren balance) that
  treats typographic quotes as PowerShell does; `ansiView` (the Windows-1252 reading of the bytes);
  `prepareForWindows` (CRLF everywhere; UTF-8 BOM on .ps1 ONLY - cmd.exe cannot read a BOM and
  would refuse `@echo off`).
  bridge/package/build.ts: `validateWindowsScripts` runs before anything is assembled - ASCII +
  tokenizer on each script as written AND as Windows PowerShell 5.1 would read it without a BOM,
  and PowerShell's own parser when `pwsh`/`powershell`/`JALSA_PWSH` is on the packaging machine.
  Any failure: exit 3, no artifact. BRIDGE_VERSION 2.0.1.

FAIL-FIRST: 5 defects injected, all 5 observed failing (tests/unit/bridge-package.unit.spec.ts,
appended rungs; no new spec file):
  N1 the arrow put back into install.ps1                      1 failed | 15 passed
  N2 the packager stops writing the BOM                       1 failed | 15 passed
  N3 tokenizer stops treating typographic quotes as quotes    2 failed | 15 passed (the regression rung)
  N4 the packager skips validation                            1 failed | 16 passed
  N5 (cmd.exe rule) BOM on a .cmd                             covered by the rewritten BOM rung, observed
     failing on the first package build (all five entries carried a BOM) before the fix
  The regression fixture is `git show 1504bb9:jalsa/bridge/windows/install.ps1` - the exact file
  that shipped - decoded as Windows-1252; the real-parser rung asserts the customer's error ids.

WHAT WAS RUN
  unit 938 passed (932 + 6 new rungs, real PowerShell parser present via JALSA_PWSH; the rung says
  SKIPPED loudly on a machine without one) · typecheck clean · lint clean · bridge:package clean:
  "Windows scripts validated (real PowerShell parser + tokenizer)"; the packaged install.ps1
  extracted and parsed OK by PowerShell 7; every .ps1 BOM+CRLF+ASCII, every .cmd ASCII+CRLF, no
  BOM, starting `@echo off`. Package 34.3 MB for https://jalsa-restaurant-phi.vercel.app,
  sha256 1533f5a38da7fa8c1e33f767abd662ef2fe6f31f165cb25ba017af01ad4e0079.

NOT VALIDATED, stated plainly
  PowerShell 7 on Linux parses the file; it is not Windows PowerShell 5.1 on the customer's PC, and
  parsing is not running. The corrected package has NOT been run on Windows. Gate 7 row 33a is the
  re-run: Download -> Extract -> "Install Jalsa Print Bridge" -> completes. Rows 34-42 stay BLOCKED
  behind it. The Blob upload must be repeated with the 2.0.1 zip.

---

## Application run - jalsa - 2026-09-23 - Printers: connect the printing computer (pairing, discovery, mapping, installer)

**Software-tested · Windows-runtime PENDING (KL-7) · physical printer PENDING (KL-6).** Nothing
below is evidence that install.ps1 ran, that a Scheduled Task started, or that paper came out.

WHAT WAS BUILT (additive; no existing print contract rewritten)
  Dashboard → Printers (14th section, DC-013) → Connect Printing Computer → Download for Windows →
  Install → pairing code typed once → discovered printers → Select → Station → Save → Test Print.
  Server: migration 20260923090000 (bridge_pairing_code, bridge_discovered_printer, bridge_printer,
  bridge_token.source/hostname/bridge_version/last_sync_at); POST /api/bridge/pair (the one
  unauthenticated door, spends a code by one conditional update, restaurant from the code's row);
  /api/bridge gains `sync` (fourth verb, touches no job; a PAIRED token's list and claim are
  intersected with its mapping server-side); owner actions issue-pairing-code /
  save-printer-mapping / remove-printer-mapping; GET /api/owner/print-bridge/download
  (hosted redirect · local stream · honest 404). Bridge: paired-config, pairing, windows/discovery
  (Get-Printer parser), transport/windows-queue (RAW via winspool through Add-Type, queue name as
  an env var), service (sync → runCycle unchanged, outage/401 handling), cli (pair/run/discover),
  log-file; environment mode untouched. Package: bridge/package (zip writer/reader, pinned Node
  v24.21.0 win-x64 from nodejs.org, SHA-256 verified) → bridge/dist/jalsa-print-bridge-windows.zip
  (34.3 MB; read back by Python zipfile: testzip None, node.exe SHA-256 = nodejs.org's
  win-x64/node.exe ba4e6d11…). Installer: bridge/windows (install.ps1, uninstall.ps1, two .cmd).

SPEC SUPERSEDED (contract-change exception, dated note in the file)
  bridge-contract.unit.spec.ts — "three verbs and no others" → "four verbs and no others", plus two
  new rungs: sync cannot touch a job; a paired claim carries `.in('printer_id', mapped)`.

FAIL-FIRST: 17 defects injected into the finished tree, all 17 observed failing, each on the rung
written for it (script: one mutation, one spec file, restored after each).
  M1  redeem loses `used_at IS NULL`                     1 failed | 17 passed  bridge-pairing
  M2  pair route reads a restaurant from the request     1 failed | 17 passed  bridge-pairing
  M3  bridge sends the code untidied                     1 failed | 17 passed  bridge-pairing
  M4  config written in place, no rename                 1 failed |  6 passed  bridge-paired-config
  M5  unreadable printer list → empty success            1 failed |  9 passed  bridge-discovery
  M6  duplicate machine id takes the LAST queue          1 failed | 10 passed  bridge-service
  M7  401 treated as an outage, not revocation           1 failed | 10 passed  bridge-service
  M8  outage rethrown — service dies on first fault      1 failed | 10 passed  bridge-service
  M9  queue name dropped from the script's environment   1 failed | 10 passed  bridge-service
  M10 printer Windows no longer lists reads as Ready     1 failed |  5 passed  print-computer
  M11 raw last_error shown to the owner                  1 failed |  5 passed  print-computer
  M12 the screen grows a queue-name input                1 failed | 11 passed  printers-screen
  M13 paired claim no longer limited to its mapping      1 failed | 24 passed  bridge-contract
  M14 task registered as the user, not SYSTEM            1 failed | 10 passed  bridge-package
  M15 README dropped from the package                    1 failed | 10 passed  bridge-package
  M16 a bridge token committed in a tracked file         1 failed | 10 passed  bridge-package
  M17 mapping save accepts any queue string              1 failed | 11 passed  printers-screen
FAIL-FIRST: tests/unit/bridge-pairing.unit.spec.ts - M1, M2, M3 above.
FAIL-FIRST: tests/unit/bridge-paired-config.unit.spec.ts - M4 above.
FAIL-FIRST: tests/unit/bridge-discovery.unit.spec.ts - M5 above.
FAIL-FIRST: tests/unit/bridge-service.unit.spec.ts - M6, M7, M8, M9 above.
FAIL-FIRST: tests/unit/print-computer.unit.spec.ts - M10, M11 above.
FAIL-FIRST: tests/unit/printers-screen.unit.spec.ts - M12, M17 above.
FAIL-FIRST: tests/unit/bridge-package.unit.spec.ts - M14, M15, M16 above.

THE BRIEF'S FIFTEEN, WHERE EACH IS EXECUTED
  1 pairing success · 2 expired code · 3 single-use · 4 wrong restaurant cannot pair —
  bridge-pairing (executed over an injected fetch; the spend and the scoping pinned from source);
  5 config persistence · 6 restart/reconnect — bridge-paired-config, bridge-service (real HTTP
  server, outage → recovery, 401 → unpaired); 7 discovery parsing — bridge-discovery; 8 printer
  selection · 9 mapping · 10 missing mapping — printers-screen (server rules pinned) and
  bridge-service (unmapped job never claimed; nothing mapped → nothing claimed, says so);
  11 owner-readable errors — print-computer; 12 bridge authentication — bridge-service (bearer on
  every verb, token never logged); 13 print-job lifecycle intact — every Gate 1–6 spec still
  passes unchanged (855 → 932 unit); 14 transport cannot select/reroute — bridge-service +
  bridge-transport (unchanged); 15 no secrets committed — bridge-package (tracked tree scanned).

WHAT WAS RUN (this tree, 23-Sep-2026)
  unit 932 passed (855 before) · render + degraded 266 passed (PLAYWRIGHT_CHROMIUM_PATH: the two
  WebKit projects SKIPPED, said so on stderr) · typecheck clean · lint clean (react-hooks/purity
  fixed: the clock is state) · jalsa audit:all 10/10 · framework audit:all 11/11 · guard:test 15/15
  · next build clean · bridge:build clean · bridge:package clean (34.3 MB, verified) · CLI smoke:
  discover / pair (no network → exit 4) / run (unpaired → exit 2), all in words.

NOT EXECUTED, stated rather than claimed
  The functional tier beyond degraded (needs a database this runner does not have); the migration
  against either Supabase project (not applied — ENVIRONMENTS.md says so); anything on Windows
  (KL-7, Gate 7 rows 33–42); anything on paper (KL-6); the Printers screen observed in a browser
  with real data (the console needs a PIN and a database) — its strings and boundaries are pinned
  by printers-screen.unit.spec.ts, and both themes are token-driven (colours audit clean), but
  "looked at" is not claimed.

DATABASE EVIDENCE (TEST project uxmyomxtosjlkvjxnvpy, 23-Sep-2026, via MCP, every check inside one
transaction that was ROLLED BACK — the project holds 0 codes, 0 mappings, 0 tokens afterwards)
  Migration 20260923090000 applied. Found first: an UNRECORDED draft migration `20260923075759
  jalsa_bridge_pairing` on TEST only (bridge_pairing, bridge_printer with an `id` PK and a
  `windows_queue` column, bridge_token.windows_printers/printers_seen_at/agent_version) — in no
  repository file, 0 rows, absent from yxgxmbyilpivbmeemqkp. The repository migration now
  converges it (rename windows_queue → queue_name, add the missing index) rather than leaving a
  silent `create table if not exists` no-op; the draft's `bridge_pairing` table is left, unused.
  After apply: bridge_pairing_code, bridge_discovered_printer, bridge_printer — RLS on, 0
  policies; bridge_printer indexes bridge_printer_one_computer (printer_id) + (token, printer).
    first spend of a live code (used_at is null and expires_at > now)   1 row
    second spend of the same code                                       0 rows
    spend of an expired code                                            0 rows
    printer mapped on PC A, then upserted on conflict (printer_id) to PC B: 1 mapping, on PC B

  Also applied to yxgxmbyilpivbmeemqkp (development, the project that becomes production) on
  23-Sep-2026 at the owner's request: clean shape (no draft there), bridge_pairing_code /
  bridge_discovered_printer / bridge_printer RLS on with 0 policies, bridge_printer_one_computer
  and bridge_printer_unique present, bridge_token.source/hostname/bridge_version/last_sync_at added.

GATE 7 IS UNAFFECTED AND STILL BLOCKED. Ten new rows (33–42) wait with the original 32.

---

## Application run - jalsa - 2026-09-22 - MERGE: main into the printing branch

`main` had moved on by four commits while Gates 1-7 were built. One of them, `c35f64f`, adds a
Test Print feature - the same thing Gate 6 built, written independently. Three files conflicted
and one more collided semantically without conflicting at all.

"KEEP BOTH" WAS ACHIEVABLE FOR ONE OF THREE CONFLICTS, AND THE OTHER TWO SAY WHY
  `mutations.ts` - an import line. A pure union: this branch's `FoodType`, main's `canAdvanceKot`
  and `KOT_STATUS`. Both kept, verbatim.

  `owner-mutations.ts` - two `export async function testPrint`. Keeping both is a duplicate
  declaration; it does not compile.

  `PrintSetupSection.tsx` - two Test print buttons carrying the SAME `data-testid` and different
  handlers. Keeping both is a duplicate test id and two behaviours on one control.

  And `src/lib/test-print.ts` merged CLEANLY, which was the more dangerous one: a second
  test-ticket builder, conflicting with nothing, silently doubling the thing the repository's own
  rule forbids.

WHY THIS BRANCH'S `testPrint` HAD TO WIN, AND IT IS NOT A PREFERENCE
  Main's version writes `kind: 'Test'`, `kot_id: null`, `bill_id: null`, `status: 'queued'` - all
  compatible. It does NOT write `station`, because on main nothing read one. On this branch
  `bridge-payload` matches a test job to its machine BY the station, so a row without one composes
  to nothing: the button would queue jobs the bridge then fails to render. A naive "take main's"
  merge would have shipped a Test Print that cannot print, green.

WHAT MAIN'S SIDE CONTRIBUTED, AND IT IS MOST OF IT
  `testPrintBlocker()` - ONE definition of "is this machine testable", shared by the button and
  the server. Main's own comment gives the reason and it is right: two copies would eventually
  disagree, and the disagreement would be a button that does nothing. Gate 6 had an inline
  `enabled` check; the blocker replaced it.

  The non-throwing return shape - `{ queued, printerName, reason }`, so the screen can say WHICH
  machine and WHY without parsing an error message. Extended with `jobId` and `station`.

  `runTest` and the per-printer `testing` flag - better than what Gate 6 wrote. Testing the
  tandoor must not disable the counter's button, and `runBusy` would have done exactly that.

  `action: 'Printer'` on the audit entry rather than Gate 6's `'Reprint'`. Main is right: a
  diagnostic filed among the night's reprints reads as trade that never happened.

WHAT WAS REMOVED, AND WHERE IT WENT
  `buildTestTicket()` - main's bespoke test-ticket layout, and its eight cases. On the merged tree
  nothing called it but its own spec: a test ticket is composed by `buildTicket` through
  `test-ticket.ts`, on the same template a kitchen ticket uses. Its careful thinking is not lost -
  it wrapped rather than centred because a 33-character printer name on a 32-column roll does not
  wrap on a thermal head, it disappears, and that is exactly what the width-check line in
  `TEST_TICKET_ITEMS` exposes and what Gate 7 row 11 checks on paper.

TWO USER-VISIBLE SENTENCES REWRITTEN, BECAUSE THEY STOPPED BEING TRUE
  `TEST_PRINT_QUEUED` said *"Jalsa has no print service connected yet, so nothing has left the
  server"*. `TEST_PRINT_NOTE` said *"No paper will come out until a print service is connected"*.
  Both were accurate on main and false the moment Gates 2-6 landed an encoder, three transports
  and a bridge. Leaving them would have been the more dangerous kind of stale copy - one that
  tells an owner not to go and look for paper that is, in fact, coming.

  Neither now says "printed". A queued job prints when a bridge collects it, and whether one is
  running on that PC is not something the server can see. They say where the job is and that it
  WAITS rather than fails when no bridge is collecting, which is the thing an owner cannot see
  from that screen.

SPECS SUPERSEDED (contract-change exception, dated notes in each file)
  `test-print.unit.spec.ts` - eight `buildTestTicket` cases removed; the two copy cases rewritten
  with their reasons at the assertion. Everything about the JOB kept verbatim: one row, the right
  machine, no fake bill, never `printed`, routing not consulted, the grant, the audit, the
  button. None of that changed and all of it still holds.
  `print-config.unit.spec.ts` - the switched-off rung pinned Gate 6's inline guard EXPRESSION
  (itself strengthened once already, after it stayed green under `if (false)`). The rule moved to
  `testPrintBlocker`, so the rung now pins the call and the blocker's own guard.

FAIL-FIRST for the merge: 3 defects injected, all 3 observed failing.
  M1 the shared blocker no longer refuses            1 failed | 39 passed
  M2 a test print is filed as trade (`Reprint`)      1 failed - main's own rung
  M3 the blocker stops refusing a switched-off machine  2 failed - both branches' rungs

Merged tree: 778 unit, 220 render + degraded, 998 total passing, 0 failing, 10/10 audits,
typecheck and lint pass, bridge build clean.

GATE 7 IS UNAFFECTED AND STILL BLOCKED. Nothing in this merge is evidence that a printer printed.

---

## Application run - jalsa - 2026-09-22 - Phase 2 Gate 7: BLOCKED (hardware-pending)

**Gate 7 is BLOCKED. No physical printer has printed a Jalsa ticket, and nothing below claims
otherwise.**

Binding rule 4: PASS, FAIL, BLOCKED, and there is no fourth value for "the software all works so
it will probably be fine". The TVS RP3160 is not on a desk. Gate 7 is the only gate that needs
one, so it is BLOCKED, and it says why.

WHAT IS AND IS NOT PROVEN, EXACTLY
  Proven: the claim, the composition, the ESC/POS bytes (golden, to the byte), FileTransport,
  NullTransport, the Windows spooler transport behind an injected command, every failure branch,
  the report, the lifecycle against a real Postgres.

  NOT proven: that paper came out. `WindowsSpoolerTransport` reports that the SPOOLER ACCEPTED the
  bytes. Windows queues happily for a printer that is switched off, out of paper or asleep, and no
  spooler-based transport anywhere can promise more. `bridge-windows.unit.spec.ts` carries a rung
  whose only job is to say so, and the transport's success sentence says `accepted by queue` and
  never `printed`.

  Also unverified: whether the RP3160 honours the `ESC t 0` codepage the encoder DECLARES (Gate 2
  said this at the time and it is still true - no device has confirmed which table it holds);
  whether bold, double-size, feed and cut render as intended; whether 80 mm output fits; whether a
  disconnected printer fails the way the tests assume.

THE PROCEDURE, WRITTEN NOW RATHER THAN LATER
  `docs/GATE-7-HARDWARE-ACCEPTANCE.md` - 32 rows in five groups: the machine exists, the bridge
  runs, test print, a real round, and failure. Written while the software is fresh so that whoever
  has the machine runs a checklist rather than inventing one. Each row says how to run it and what
  pass looks like, and a row nobody ran is BLOCKED rather than blank.

  Two rows are called out as the ones to be strict about:
    - row 19, an unsupported character must FAIL and never print a '?';
    - row 27, paper out must never produce a job marked printed. That is the exact defect Phase 1
      was spent removing, and it would arrive here wearing a different hat.

Recorded as KL-6. Every gate report must say Gate 7 is hardware-pending, and no document in this
repository may describe the printing system as validated end to end until those rows have been run.
DC-012 (the station line) stays AUTHORISED and does NOT become VERIFIED: it is verified by somebody
looking at paper, which is the only thing that verifies it.

Finished tree at the point Gate 7 was reached: 715 unit, 181 render, 20 degraded, 10/10 audits,
typecheck and lint pass, bridge build clean.

---

## Application run - jalsa - 2026-09-22 - Phase 2 Gate 6 (configuration, test print, bridge credentials)

The operational half: a Test Print that goes out through the real path, bridge tokens issued and
revoked from the console, and the screens that show which PC is collecting tickets.

A TEST PRINT IS AN ORDINARY PRINT JOB, AND THAT IS THE WHOLE DESIGN
  The tempting shape is a small function that opens the printer and writes "Hello". It would work,
  and it would prove almost nothing: not the claim, not the composition, not the encoder, not the
  transport, not the report. Then a real ticket would fail later and the successful test would be
  evidence for the wrong thing.

  So `testPrint()` inserts a row into `print_job` and stops. Everything after it - the bridge
  listing it, claiming it, composing it through `buildTicket`, encoding it through `escpos.ts`,
  carrying it through whichever transport that PC has, and reporting the outcome - is the path a
  kitchen ticket takes, unchanged. `test-ticket.ts` is the only difference, and it is a payload.

  A rung pins that no second print path exists: `encodeTicket` has exactly one caller in the whole
  system (`bridge/src/loop.ts`), and no application module holds a transport or sends anything.

WHAT IS ON A TEST TICKET
  Enough to diagnose the machine from the paper alone: which machine Jalsa thinks it is, which
  station it is stamped for, who pressed it, when. Both food types, so the VEG/NON-VEG headings are
  exercised. One line longer than a 58 mm roll holds, so a wrong width is visible without measuring.
  Every identifier field carries a word rather than a plausible code - `TEST PRINT`, not
  `KOT-0000`, because somebody WILL pick this paper up off a pass and a fake KOT number sends a
  cook looking for table zero. Every item is unrouted (`category: ''`), so a test print needs no
  routing configuration to exist and cannot be misdirected by one that does.

  It is refused for a switched-off machine. Honouring `enabled` for real tickets and ignoring it
  for a test would make the test prove something about a machine that is not in service.

THE BRIDGE CREDENTIAL
  `issueBridgeToken` generates 32 bytes of CSPRNG with a `jbt_` prefix, stores ONLY the SHA-256,
  and returns the raw token exactly once. It is never logged, never audited (the audit line carries
  the label and `confidential: true`), and cannot be read back: `listBridgeTokens` selects five
  columns by name and `token_hash` is not among them - it is not replayable, but it is
  offline-attackable, and a console payload ends up in browser memory, screenshots and support
  threads. Revoking is a timestamp, never a delete: the job history says which PC carried which
  ticket, and a deleted label makes last Tuesday unreadable.

  The console shows the token in the sheet that issued it, says plainly that it is shown once, and
  has no field, state or request that carries a token back INTO the application. A rung walks every
  `send()` payload in the panel and asserts none of them has a `token` key.

DATABASE EVIDENCE (TEST project, 22-Sep-2026; evidence rows deleted afterwards)
  a Test job inserts with kot_id and bill_id NULL      -> accepted
  kind 'Test', routing_rule 'chosen', food_side 'all'  -> as written
  the bridge's own list predicate finds it             -> 1 row, the same query a KOT is found by
  bridge_token stores a 64-char hex hash               -> and has no token/secret/raw_token column

FAIL-FIRST: 11 defects injected into the finished tree. NINE fired first time; TWO did not, and
both were rungs of mine that checked for the presence of a STRING rather than for the behaviour:

  C1  a test print ignores a switched-off machine     GREEN at first - the rung asserted that the
      words "is switched off" and "enabled" appeared in the body, and both survive `if (false)`
      because they are in the message the dead branch would have thrown. Rewritten to pin the
      GUARD EXPRESSION; it fires. Third time this class has appeared (Gate 1's ternary, Gate 4's
      side rule), and the lesson is the same one: a rung blind to the exact form of the defect it
      is named after is decoration.
  C4  the token reaches the audit trail               GREEN at first - the rung looked for the
      literal `token)` and the injection wrote `${token}`. Rewritten, then WRONG TWICE MORE: a
      bare /\btoken\b/ goes red on the clean tree, because the detail legitimately reads "Bridge
      token issued for …" and because slicing to the end of the body sweeps in the `return { …,
      token }` that hands it to the caller. The rung now reads the audit CALL only, checks every
      `${…}` interpolation and checks the call with string literals removed. It distinguishes the
      identifier from the English word, which was the whole difficulty.

  The other nine: a test print recorded as a routing outcome, the raw token stored, revoking by
  delete, the hash exposed to the console, a test-ticket line gaining a category, the ticket losing
  its TEST PRINT marking, the payload encoding for itself, the console sending a token back, and
  the test print reaching for the encoder (2 failed).

A GATE 4 RUNG NARROWED, AND WHY THAT IS NOT WEAKENING IT
  `bridge-contract.unit.spec.ts` asserted that `bridge-payload.ts` composes from the ORIGIN and
  never from the redirect - read across the whole FILE. Gate 6 added `testPayload`, a second
  `composeTicket` call site that composes from the job's own station, correctly, because a test
  print has no origin to inherit one from. The file-scoped regex could not tell the branches apart
  and went red on correct code. The claim was always about the ordinary path, so the rung now reads
  `ticketPayloadFor` only - and it was re-injected with the original defect afterwards to confirm
  it still fires.

Added: `src/lib/test-ticket.ts`, `testPrint` / `issueBridgeToken` / `revokeBridgeToken`,
`listBridgeTokens`, `BridgeTokenRow`, three owner actions, a Bridges tab on Print Setup, a Test
print control per machine, and `tests/unit/print-config.unit.spec.ts` (20 cases).

Finished tree: 715 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass, bridge
build clean.

---

## Application run - jalsa - 2026-09-22 - Phase 2 Gate 5 (the Windows print bridge)

The bridge becomes a program a restaurant can run: a Windows spooler transport, a startup that
refuses a broken configuration, structured logs, signal handling and a graceful shutdown.

WHAT A SUCCESS MEANS HERE, STATED BEFORE ANYTHING ELSE
  `WindowsSpoolerTransport` reporting success means THE SPOOLER ACCEPTED THE BYTES. It does not
  mean paper came out. Windows queues perfectly happily for a printer that is switched off, out of
  paper or asleep, and no spooler-based transport anywhere can promise more than acceptance. The
  success sentence says `accepted by queue`, never `printed`, and a rung asserts it keeps saying
  so. Whether a TVS RP3160 prints is Gate 7, on hardware, and nothing green in this gate moves it.

WHY `copy /b` AND NOT A NATIVE BINDING
  The obvious alternative is `winspool.drv` through a native addon: a compiler toolchain on a
  restaurant's PC, a rebuild on every Node upgrade, and a binary nobody on this project can read.
  `copy /b <file> <share>` is the documented way to put RAW bytes into a Windows queue, ships with
  the operating system, and returns an exit code. The cost is one prerequisite - the printer must
  be shared - and it is written down in `bridge/README.md` rather than discovered on a Friday.

  `/b` is load-bearing. Without it `copy` runs in text mode, stops at the first 0x1A and translates
  line endings, which on an ESC/POS stream is a truncated ticket that still prints something.

WHY THE COMMAND IS INJECTED
  Every interesting thing about this transport - a non-zero exit, a timeout, a queue that does not
  exist - only happens on Windows. Wired directly to `spawn`, every failure path would be testable
  nowhere, which is the same as not existing. The rule lives in the transport; the spawn is
  `windowsCopyCommand` and the spec swaps it. `windowsCopyCommand` itself is still exercised here:
  on a non-Windows host it returns a run naming the platform rather than dying on a missing
  `cmd.exe`, so the transport's own error handling sees it.

WHAT IT REFUSES BEFORE STARTING A PROCESS
  A queue name is matched against a whitelist - a share name or a UNC path, nothing else. The
  arguments are passed as an array rather than a string, but `cmd.exe` still parses them, so a
  name carrying `&`, `|`, `>`, a quote or a newline is refused and no process is spawned. Same for
  a job id that is not a filename: sanitising would collapse two jobs onto one name and the second
  would overwrite the first with no error anywhere.

STARTUP REFUSES RATHER THAN LIMPS
  A bridge that comes up on a broken configuration, polls forever and prints nothing looks exactly
  like a bridge working in a restaurant with no orders - and is discovered during service, by paper
  that never arrives. `startup()` returns EVERY problem at once, by name, and the process exits 2.
  `JALSA_BRIDGE_TRANSPORT=windows` on a host that is not Windows is refused at startup, with the
  remedy named. A `SUPABASE_SECRET_KEY` in the environment stops the bridge: its presence means
  somebody has misunderstood the deployment, and starting anyway would hide that.

  The token is NEVER logged - not the value, and not a prefix of it. A prefix pasted into a support
  thread is still a prefix of a live credential, and a rung checks every prefix from 8 characters up.

SHUTDOWN IS GRACEFUL BECAUSE THE ALTERNATIVE PRINTS TWICE
  A bridge killed between its transport call and its report leaves a job in `processing` that
  nobody can adjudicate; the server's sweeper expires it to `failed`, in front of a person, which
  is correct but expensive. SIGINT, SIGTERM and SIGBREAK finish the ticket in flight and exit 0.
  A second signal is not a second shutdown.

A REGRESSION THIS GATE CAUSED AND THE HARNESS CAUGHT
  Making `JALSA_BRIDGE_SPOOL_DIR` required broke two fixtures in `bridge-loop.unit.spec.ts`, which
  built configurations without one - 20 Gate 4 rungs went red. Found by the fail-first harness
  reporting 21 failures for a defect injected into a file `bridge-loop` does not even import, which
  is the kind of number worth stopping on. FIXED IN THE FIXTURES, not by relaxing the requirement:
  the rungs pass their transport in directly so the value is unused, but configuration is
  configuration and `loadConfig` refusing an incomplete one is the whole point of it.

Files added: `bridge/src/transport/windows.ts`, `bridge/src/main.ts`, `bridge/README.md`,
`tests/unit/bridge-windows.unit.spec.ts` (26 cases), `tests/unit/bridge-startup.unit.spec.ts`
(14 cases). `bridge/src/config.ts` gains the transport selection. `FileTransport` and
`NullTransport` are untouched and still shipped - development and the failure path need them.
`bridge:build` now bundles ONE file, `bridge/dist/main.js`, whose only imports are
`node:fs/promises`, `node:path` and `node:child_process`.

FAIL-FIRST: 12 defects injected into the finished tree, all 12 observed failing.
  W1  `copy` loses `/b` and runs in text mode              1 failed | 79 passed
  W2  a non-zero exit is reported as success               1 failed
  W3  a hung spooler is not noticed                        1 failed
  W4  the queue-name whitelist removed                     7 failed (the empty name is still
      caught by the length test, correctly - that half of the guard was not the injected one)
  W5  the stream is staged through a text path             1 failed - "all 256 byte values survive"
  W6  success claims the ticket printed                    2 failed
  W7  the Windows transport allowed on any platform        1 failed
  W8  the token is logged                                  2 failed
  W9  startup reports only the first problem               1 failed
  W10 a second signal is a second shutdown                 1 failed
  W11 the staged file is left behind                       1 failed
  W12 a throwing command escapes the transport             1 failed

NOT DONE, deliberately: no Wi-Fi, no LAN/TCP-9100, no Bluetooth, no WebUSB, no Web Serial, no
cloud print, no second ESC/POS encoder, no native module. A future wired-LAN transport is a new
class behind the same `PrintTransport` interface - bytes in, one verdict out, still unable to
choose a printer. Token issuance UI is Gate 6; hardware is Gate 7.

Finished tree: 695 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass.

---

## Application run - jalsa - 2026-09-22 - Gate 4 remediation (R4-1 food side, R4-2 station)

The two correctness defects the Gate 4 investigation found, fixed. Both cross Phase 1 contracts
and both were approved as controlled amendments before any file was touched.

### R4-1 - A PRINT JOB MUST KNOW WHICH HALF OF A ROUND IT IS

ROOT CAUSE. `splitRound` keys buckets on `printer | station | side`. `queuePrint` persisted the
first two and discarded the third, which existed only as a local variable and never left the
function - `RoundTicket` carried `foodTypes` (which types LANDED in a bucket) but not the side
the bucket IS, and those are not the same fact. With the split on, one round therefore wrote two
rows identical in every stored field.

Three consequences, in severity order:
  1. Neither row could be composed, so a restaurant with the split on could not print a KOT.
  2. WORSE, AND INDEPENDENT OF THE SPLIT: `printElsewhere` writes the DESTINATION machine's
     station, so a redirect to a machine the round also touches matched the wrong bucket by
     machine-and-station alone and composed the OTHER HALF. Not a refusal - a perfectly ordinary
     ticket for food that had already printed somewhere else, while the intended round was never
     delivered at all. This is the defect that made the remediation urgent.
  3. Any renderer that guessed between two siblings prints the whole round twice at one machine.

THE FIX, additive throughout:
  - `RoundTicket.side: 'all' | 'veg_side' | 'non_veg'`, assigned in `splitRound` from ONE
    expression now used for both the key and the ticket. Required, not optional: a construction
    site that forgets it is a job whose identity cannot be recovered, and the compiler is the
    cheapest place to catch that. `billTicket` states `side: 'all'` explicitly.
  - Migration `20260922090000_jalsa_print_job_food_side` - `food_side text not null default 'all'`,
    a check constraint over the three values routing can emit, and a SEPARATE immutability trigger
    (`print_job_food_side_immutable`). Separate because widening `print_job_printer_is_immutable`
    would leave a function named for what it protects and protecting something else.
  - `queuePrint` writes `food_side: t.side`. Never a literal - `print-assignment.unit.spec.ts`
    pins that exactly one expression is written and that it is the ticket's.
  - `printElsewhere` copies the ORIGIN's `food_side`. Redirecting changes where a ticket prints,
    never what is on it.
  - `retryPrintJob` is UNCHANGED. Its patch was already a closed set, so the new column survives
    a retry by construction; a rung now names it so a future edit argues with a test.
  - `ticket-compose.ts` matches the FULL triple. A full key identifies one bucket, so a match is
    unique by construction and there is no longer a "which of these two did they mean" case.
  - `redirect-lineage.ts` (new, pure) walks `redirected_from_job_id` to its root, capped at 8.
    Extracted from `bridge-payload.ts` because that file imports `server-only` and nothing here
    could execute it - a depth cap nothing runs is a comment about a depth cap. Exceeding the cap,
    a cycle, or an unreadable origin are all BLOCKED, never a stop at the eighth: a partial walk
    composes from whichever job it halted on, which is the same defect by another road.
  - `bridge-payload.ts` composes from the ORIGIN's identity and prints at THIS job's machine, at
    THIS job's paper width, with THIS job's reprint mark.

THE REFUSAL IS NOT DELETED. The backfill default `'all'` says nothing about a row written while
the split was on and BEFORE the migration. Those still collide and are still refused, with a
message that now names what it actually is - an old row, not a design gap. Recorded as KL-5.
A backfill that guessed would be the duplicate-printing defect arriving as a migration.

### R4-2 - THE STATION REACHES THE PAPER

ROOT CAUSE. `print-routing.ts` carries `station` on every decision for one stated reason: *"A
tandoor ticket on the main kitchen machine has to say TANDOOR or the wrong cook picks it up."*
`print_job.station` snapshots it, `bridge-payload` reads it, `ComposeJob` receives it - and
`TicketData` had no station member, `KOT_FIELDS` no station key, `buildKot` no case. The value
was carried the whole way and dropped at the last step. The screens showed it
(`print.tsx` renders `station -> machine`), which is why the gap survived: it looked present
everywhere except on the only surface a cook reads.

THE FIX: `TicketData.station`, one `KOT_FIELDS` entry in the Order band, one `buildKot` case
(`leftRight('STATION', ...)`, bold, skipped when empty in the idiom `note` already uses), and
`composeTicket` passing `job.station` through. `ComposeInput.header` DELIBERATELY OMITS `station`
so a caller cannot pass the printing machine's station by mistake - the one wrong value that looks
entirely plausible. Bills are untouched: `BILL_FIELDS` and `buildBill` have no station and should
not.

IT PRINTS BY DEFAULT, and that is a deliberate visible product change, recorded as DC-012. Shipping
it switched off would leave the divergence recorded and the defect shipped.

### BYTE EVIDENCE

Golden bytes were captured from the PRE-remediation tree at both widths before any file changed -
they cannot be captured afterwards. `tests/unit/ticket-golden.unit.spec.ts` pins four streams:

  GOLDEN A 58mm / 80mm   the ticket as it was, reproduced with the station field off
  GOLDEN B 58mm / 80mm   the ticket as it prints today

  R4-1 byte identity:  58mm IDENTICAL (572 bytes) - 80mm IDENTICAL (804 bytes)
  R4-2 intended change: 58mm 572 -> 611 bytes - 80mm 804 -> 859 bytes

and a rung asserting the ONLY difference between A and B is one bold STATION line, with nothing
removed. That rung was first written to diff DECODED bytes and was wrong: keeping printable bytes
leaks the `E` out of `ESC E 01`, the bold-on the station line introduced, and it reported two
added lines. Decoding properly would mean an ESC/POS parser inside a test - the second
implementation `file.ts` refuses to grow for the same reason. It diffs the composer's own
`TicketLine[]` instead; the bytes are pinned exactly four rungs above.

### DATABASE EVIDENCE (TEST project uxmyomxtosjlkvjxnvpy, 22-Sep-2026, each assertion its own
statement; evidence rows deleted afterwards)

  a row that does not mention the column       -> food_side = 'all'
  insert food_side = 'sideways'                -> violates check constraint print_job_food_side_check
  update food_side = 'sideways'                -> the immutability trigger fires FIRST
  update food_side = 'veg_side' (valid value)  -> "print_job.food_side is immutable (job ..., non_veg)"
  retryPrintJob's exact patch applied          -> food_side still 'non_veg'
  a redirect row inserted as printElsewhere does -> food_side 'non_veg', the ORIGIN's, rule 'chosen'

Note honestly: an invalid UPDATE is caught by the trigger rather than by the constraint, because
the trigger runs first. The constraint is what guards INSERT.

### FAIL-FIRST: 13 defects injected into the finished tree, all 13 observed failing

  R1  splitRound hard-codes the un-split side          5 failed | 181 passed
  R2  queuePrint hard-codes food_side                  2 failed
  R3  printElsewhere takes the half from the DESTINATION 1 failed
  R4  retryPrintJob starts patching food_side          2 failed (incl. the Phase 1 patch-shape rung)
  R5  ticket-compose matches on machine+station only   4 failed
  R6  the legacy ambiguous-row guard removed           1 failed
  R7  the redirect cap stops halfway instead of refusing 3 failed
  R8  the walk never follows the lineage at all        8 failed
  R9  buildKot loses the station case                  7 failed
  R10 the station ships switched OFF                   7 failed
  R11 composeTicket drops the job station              7 failed
  R12 the ticket field order changes                   4 failed (both goldens, both widths)
  R13 bridge-payload composes from the redirect itself 1 failed

### SUPERSEDED SPECS (contract-change exception, jalsa/CLAUDE.md, dated notes in each file)

  ticket-compose.unit.spec.ts - "BLOCKED: two tickets ... cannot be told apart" replaced by the
    positive rung (union = round, intersection = empty) PLUS the legacy refusal, which is kept.
  ticket-compose.unit.spec.ts - "KNOWN GAP: the station never reaches the paper" replaced by its
    positive form, which is what that rung was holding the place for.

Every other Gate 4 scenario was re-run UNCHANGED and passes.

Finished tree: 655 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass,
bridge build clean (`node:fs/promises` and `node:path` only).

---

## Application run - jalsa - 2026-09-21 - Phase 2 Gate 4 (the end-to-end software bridge)

The whole path, proved without a printer in the room:

  queued -> discovered -> claimed -> TicketLine[] -> ESC/POS -> FileTransport -> report -> printed

and the failure path beside it, ending at `failed` with the transport's own sentence, the
`printer_id` untouched, no reroute and no second job.

THE GAP GATE 4 WAS ASKED TO CLOSE, AND WHAT CLOSING IT REVEALED
  `buildTicket` had exactly ONE caller in this repository: the owner's Print Setup preview, over a
  hand-written `sample: TicketData`. Nothing composed a real ticket from a real round - the
  template was a thing the restaurant could configure and could not print. `src/lib/ticket-compose.ts`
  is the missing half, and `src/lib/db/bridge-payload.ts` feeds it from the job's own rows.

  Composing a job's ticket means knowing which ITEMS of a round belong to it, and that turned out
  not to be answerable from the row in one configuration. See BLOCKER below.

THE PAYLOAD DECISION: `TicketLine[]`, rendered on claim
  Not bytes - that would move the encoder onto a kitchen PC and make Gate 2's golden-byte tests a
  claim about a machine nobody can inspect. Not order data - that hands a bridge the bill, the
  guest and the menu in order to render one ticket. Lines are exactly what the template contract
  already produces and exactly what `escpos.ts` already consumes.
  Rendered on `claim`, not in `list`: `list` is polled by every bridge in the building every few
  seconds, and rendering every waiting ticket on every poll composes most of them repeatedly and
  prints none of them. Still three verbs - the ticket is part of the answer to "I am taking this
  job", not a fourth capability.

BLOCKER FOUND, NOT WORKED AROUND
  `splitRound` buckets a round by `printerId | station | side`, where side is veg/non-veg when the
  owner has the food-type split on. One bucket becomes one `print_job` - but the ROW stores only
  `printer_id` and `station`. The side is stored nowhere. So with the split ON, one round can
  produce two jobs that are, as rows, identical, and nothing can say which half belongs to which
  ticket. Guessing prints the whole round twice at one machine.
  `composeTicket` therefore REFUSES that case and the job fails visibly in front of a person.
  The fix is one additive column written at queue time (`print_job.food_types`, or a `split_side`),
  which means changing `queuePrint` - a Phase 1 contract this gate may not touch. NOT DONE HERE,
  reported instead. With the split OFF - the shipped default - the mapping is unambiguous and the
  whole path works.

SECOND FINDING: THE STATION NEVER REACHES THE PAPER
  `print-routing.ts` says, in its own words, *"A tandoor ticket on the main kitchen machine has to
  say TANDOOR or the wrong cook picks it up"*, and carries `station` on every decision and every
  job for that purpose. `TicketData` has no station member and `buildKot` has no case for one, so
  the fallback ticket the whole mechanism exists to stamp comes out unstamped. Recorded as a rung
  that goes RED the day a station field is added (`ticket-compose.unit.spec.ts`, "KNOWN GAP"), at
  which point the composer must pass `job.station` through. Fixing it means editing
  `print-template.ts`, which this gate may not do.

WHAT IS REAL IN THE TESTS AND WHAT IS NOT
  REAL: the loop, the configuration, `composeTicket`, `buildTicket`, `encodeTicket`,
  `FileTransport`, `NullTransport`. Bytes are genuinely encoded and genuinely written to genuine
  files, compared byte for byte against the encoder's output.
  NOT REAL: the HTTP hop and Postgres. `Store` in `bridge-loop.unit.spec.ts` stands in for
  `bridge-mutations.ts`. The trade is made honest twice: a fidelity rung asserts the stand-in's
  conditions against the REAL module's source, and every lifecycle claim was ALSO proved against
  the TEST database through MCP - below - rather than asserted only in memory.

DATABASE EVIDENCE (TEST project uxmyomxtosjlkvjxnvpy, 21-Sep-2026, each transition its own
statement so nothing shares a snapshot; evidence rows deleted afterwards):
  claim A = 1 row, claim B = 0 rows                  - exactly one bridge takes a queued job
  loser report = 0 rows                              - the loser cannot report on it
  holder report = 1 row                              - the holder can
  reclaim after printed = 0 rows                     - a printed job is never claimed again
  second report = 0 rows                             - and never reported twice
  still queued = 0                                   - it is not offered again either
  reassign printer_id -> "print_job.printer_id is immutable (job ..., assigned to ...)"
  after the whole lifecycle: printer_id, station and routing_rule all unchanged
  RESTART: a job left `processing` was offered 0 times, claimed 0 times, reported 0 times, and
  remained `processing` - the bridge has no vocabulary that moves it back to `queued`.
  (A first attempt at this used one multi-CTE statement. Postgres evaluates every CTE against one
  snapshot, so the counts were not evidence of sequential behaviour and were discarded and re-run.)

Three specs added, one superseded:
  tests/unit/bridge-loop.unit.spec.ts      25 cases - the twelve scenarios plus the bounded loop
  tests/unit/ticket-compose.unit.spec.ts   16 cases - composition and, mostly, its refusals
  tests/unit/bridge-import-hygiene.unit.spec.ts     - SUPERSEDED under the contract-change
    exception: the closure was "bridge files only" and is now "bridge files plus three NAMED pure
    modules" (`escpos.ts`, `print-template.ts`, `status.ts`). The bridge imports the Gate 2
    encoder rather than growing a second one; the node-only external allow-list is unchanged,
    which is what makes the new membership safe rather than a widening.
The unit tier goes 573 -> 615.

FAIL-FIRST: 16 defects injected into the finished tree, each re-run against all four bridge specs.
  L1 the losing bridge carries on past the claim: 1 failed, 80 passed - CONCURRENCY.
  L2 the local machine filter removed: 1 failed - MACHINE ISOLATION (the local half).
  L3 an unrenderable ticket encoded anyway: 1 failed - the job would have sat in `processing`.
  L4 a transport failure not reported: 2 failed - FAILURE and FAILURE REPORT.
  L5 the backoff never grows: 1 failed - a kitchen PC is somebody's working computer.
  L6 the loop learns the word "queued": 1 failed - RESTART.
  L7 a machine this bridge cannot serve is not refused: 1 failed - NO REROUTING.
  C1 the veg/non-veg ambiguity guard removed: 2 failed - the BLOCKER above would print twice.
  C2 the routing-changed guard removed: 2 failed.
  C3 the job takes the whole round instead of its own items: 2 failed.
  C4 the saved template decides the paper instead of the machine: 1 failed.
  C5 the food-type side rule diverged from splitRound: SEE BELOW.
  G1 a Supabase credential no longer stops the bridge: 1 failed.
  G2 a bridge serving nothing allowed to start: 1 failed.
  G3 a nonsense poll interval becomes a tight loop: 1 failed.
  H1 the bridge reaches a FOURTH application file: 1 failed - the new membership rung.

C5, AND THE RUNG THAT COULD NOT SEE IT (the most useful thing this gate found)
  `composeTicket` restates `splitRound`'s bucket key, because `splitRound` returns aggregates
  rather than item lists and is a Phase 1 contract. The equivalence rung was written to guard that
  duplication - and when the side rule was inverted (`non_veg` for `veg`), it STAYED GREEN. It
  compared machines and bucket counts, and stripped the side off the key before comparing: the one
  thing it was named after was the one thing it could not see. Same class as the Gate 1 defect
  where a "must not write printed" rung passed over the exact ternary that wrote it.
  Replaced with a rung that asserts the rule's MEANING - every item on the non-veg side is
  non-veg, every item on the veg side is not - which fires on the inversion (1 failed, 15 passed).
  A first attempt also compared `splitRound`'s `foodTypes` aggregate; that half was WRONG and
  failed on the clean tree, because the ambiguous case is two buckets sharing one machine and the
  aggregate cannot tell them apart. It was removed rather than weakened, with the reason recorded
  in the spec: an aggregate that cannot see this defect must not be the thing that claims to.

NOT DONE IN THIS GATE, deliberately: no WindowsSpoolerTransport, no Win32, no token issuance UI,
no CI change, no deployment change. The stale-claim sweeper stays server-side and the bridge never
calls it. `print-routing.ts`, `print-template.ts`, `queuePrint`, `retryPrintJob` and
`printElsewhere` are untouched.

Finished tree: 615 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint pass,
`npm run bridge:build` bundles five entry points whose only imports are `node:fs/promises` and
`node:path`.

---

## Application run - jalsa - 2026-09-21 - Phase 2 Gate 3 (PrintTransport abstraction)

Gate 3 adds the seam between Jalsa's decisions and a physical device, and nothing else. Three
source files under `jalsa/bridge/src/transport/` - `types.ts` (the interface), `file.ts`
(FileTransport, the development sink) and `null.ts` (NullTransport, the failure path). No Windows
API, no spooler, no polling loop, no claim loop. The transport receives BYTES; it does not encode
`TicketLine[]`, and `src/lib/escpos.ts` remains the only encoder.

WHAT THE INTERFACE MAKES IMPOSSIBLE. `send(bytes, target)` takes the target it is given. There is
no list to choose from, no fallback argument, and no field anywhere in `TransportResult` that
could name a printer. The Phase 1 defect - a transport-layer decision about WHICH printer - is not
forbidden by a convention here, it is unrepresentable. `bridge-transport.unit.spec.ts` pins the
result key set for both implementations so it stays that way.

WHERE IT WRITES. The root directory is bridge configuration and nothing else;
`target.destination` names only a folder WITHIN that root, on a character whitelist, with a second
`startsWith(root + sep)` check behind it. A print job arriving over the network is never allowed
to decide where bytes land on a restaurant's PC.

Two specs added: `tests/unit/bridge-transport.unit.spec.ts` (26 cases) and
`tests/unit/bridge-import-hygiene.unit.spec.ts` (14 cases). The unit tier goes 533 -> 573.

THE HYGIENE SPEC IS AN ALLOW-LIST, NOT A DENY-LIST. It walks every relative import from
`bridge/src` to a fixed point and asserts that the only specifiers leaving the closure start with
`node:`. A deny-list forbids only the dependencies somebody already thought of, and the one that
eventually gets in is by definition the one nobody listed. The named `next` / `react` /
`server-only` / `@supabase` / `@/lib/db` rungs are kept as well, deliberately redundant: they are
the rungs whose NAME appears in a failure report.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - the payload written as text
(`Buffer.from(bytes).toString('latin1')` with a `utf8` encoding argument): 2 failed, 38 passed -
"what lands on disk is byte-for-byte what was handed over, for all 256 byte values" and "bytesSent
is measured from the file, not echoed from the input". The encoded-ticket round-trip rung did NOT
fail, correctly: that ticket is pure ASCII and survives the mangle. That is the whole reason the
256-value case exists alongside it.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - a short write (`bytes.slice(0, 10)`):
4 failed, 36 passed - both byte-identity rungs, the measured-size rung and the `.txt` rung. This
is also the evidence that `bytesSent` is read back from `stat`: an echoed `bytes.length` would
have reported 256 bytes sent for a ten-byte file.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - the destination containment guard disabled:
7 failed, 33 passed - the escape case and six of the seven malformed-destination cases. The `..`
case stayed GREEN and honestly so: the belt-and-braces `startsWith(root + sep)` check still
refused the write. The removed layer is the one that names the fault; the one behind it still
stopped the escape.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - the job-id guard disabled: 1 failed,
39 passed - "a job id that is not a safe filename is refused rather than sanitised".

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - the `.txt` rendering written
unconditionally: 1 failed, 39 passed - "the .txt rendering is written only when configuration asks
for it".

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - the readable rendering made to DROP control
bytes rather than show them as hex: 1 failed, 39 passed - "the rendering shows control bytes as
hex and never pretends to parse them". A renderer that interpreted the stream could disagree with
the encoder, and then the readable file would be quietly lying about the file next to it.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - a caught write failure returned as
`ok: true`: 1 failed, 39 passed - "an unwritable directory is a returned failure, not a thrown
exception". Phase 1's exact defect, re-injected one layer down.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - NullTransport made to report success
because nothing went wrong: 4 failed, 36 passed - "NullTransport always fails", "never throws",
"never reports a success, over many attempts", and the result-shape rung.

FAIL-FIRST: tests/unit/bridge-transport.unit.spec.ts - NullTransport's failure marked
`retryable: true`: 1 failed, 39 passed. Sending the same bytes to the same nothing produces the
same nothing; a loop would spin on a configuration fault and report it as a flaky printer.

FAIL-FIRST: tests/unit/bridge-import-hygiene.unit.spec.ts - `import 'react'` added to a transport:
2 failed, 38 passed - the node-builtins allow-list and the named `react` rung.

FAIL-FIRST: tests/unit/bridge-import-hygiene.unit.spec.ts - a TYPE-ONLY
`import type { TicketLine } from '@/lib/print-template'` added: 2 failed, 12 passed (hygiene spec
alone) - the allow-list and "the app alias is unreachable from the bridge". Type-only imports are
included in the walk deliberately: they are erased at build time, cost nothing at runtime, and
still couple the bridge to the application's module graph.

FAIL-FIRST: tests/unit/bridge-import-hygiene.unit.spec.ts - `typeof document` added to a
transport: 1 failed, 39 passed - "no browser-only global is referenced anywhere in the closure".
The tsconfig's lib includes DOM for the application's sake, so a `document` reference does not
fail to compile here; it fails at three in the morning on a PC behind the counter.

FAIL-FIRST: tests/unit/bridge-import-hygiene.unit.spec.ts - the walk pointed at a directory
holding no `.ts` sources: 2 failed, 38 passed - the parse guard and "Node builtins ARE allowed,
and the bridge does use them". Binding rule 5: a scan matching zero files looks exactly like a
clean codebase, so the closure asserts its own contents before asserting anything about them.

FINDING, not a rung: the first attempt at the `@/lib/db` defect imported
`@/lib/db/bridge-mutations` at RUNTIME. It did not fail a test - it killed the whole spec file at
load with "This module cannot be imported from a Client Component module", because that module
pulls in `server-only`. An application data-layer import into the bridge is not a subtle coupling;
it is an immediate hard failure. The rung was re-run with the type-only form, which is the one
that would realistically get committed.

BUILD: `npm run bridge:build` bundles `file.ts` and `null.ts` with esbuild for node20, ESM. The
bundle's only imports are `node:fs/promises` and `node:path` - the same claim the hygiene spec
makes statically, made again by a real bundler. `bridge/dist` is gitignored and excluded from the
tsconfig; `bridge/**/*` is INCLUDED, so the bridge typechecks under the application's own
strictness rather than a second, looser config.

NOT DONE IN THIS GATE, deliberately: no Windows spooler transport, no winspool calls, no polling
or claim loop, no change to the Gate 1 API, no token issuance UI. `FileTransport` and
`NullTransport` have no caller yet - the loop that will use them is Gate 4.

Finished tree: 573 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint all pass.

---

## Application run - jalsa - 2026-09-21 - Phase 2 Gate 2 (ESC/POS encoder)

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

## Fail-first evidence - 2026-09-20/21 - Phase 1 print job assignment

Two specs were added in this change. Each was observed failing before it was trusted.

`tests/unit/print-assignment.unit.spec.ts` does not collect against the true pre-fix tree at
ef930ea - it imports `src/components/ui/print.tsx`, which did not exist, so Playwright reports
"No tests found". That is evidence the file is new, not evidence any rung can fail. Each of the
three shipped defects was therefore put back into the finished tree, one at a time:

NOT OBSERVED FAILING: tests/unit/print-assignment.unit.spec.ts (whole file, pre-fix tree) - the file
  cannot collect at ef930ea because src/components/ui/print.tsx did not exist. Per-rung evidence
  was obtained by re-injecting each shipped defect instead; the three runs are below.
FAIL-FIRST: tests/unit/print-assignment.unit.spec.ts - `retryPrintJob` restored to re-select a printer
  and patch printer_id, as it shipped: 3 failed, 23 passed - "RETRY MUST NOT REASSIGN THE PRINTER",
  "RETRY MUST NOT RE-RUN ROUTING", and "a failed Tandoor ticket can never be retried onto the Main
  Kitchen machine".
FAIL-FIRST: tests/unit/print-assignment.unit.spec.ts - `queuePrint` restored to one job per round with
  `status: reachable ? 'printed' : 'failed'`: 2 failed, 24 passed - "a printer answering is not a job
  succeeding" and "NOTHING IN THE PRINT PATH MAY WRITE printed". The second went red only after the
  rung was rewritten: the first version matched `status: 'printed'` literally and the real defect is a
  TERNARY, so it passed over the exact thing it is named after. That near-miss is why `statusWrites`
  matches the field and takes whatever expression follows.
FAIL-FIRST: tests/unit/print-assignment.unit.spec.ts - `reprintKot` restored to pass no items: 1 failed,
  25 passed - "A REPRINT ROUTES ON WHAT THE ROUND CONTAINS".
FAIL-FIRST: tests/unit/print-assignment.unit.spec.ts - "the split is what the order path actually calls"
  re-run with the production call behind a dead `false &&` guard: 1 failed - Expected
  "input.items?.length", Received "false && input.items?.length". This rung had stayed GREEN under that
  same injection before the guard expression was pinned; static analysis cannot prove reachability in
  general, and this closes the one way it was faked here.
FAIL-FIRST: tests/unit/spec-supersession.unit.spec.ts - `jalsa/CLAUDE.md` reverted to its pre-amendment
  wording: 2 failed, 4 passed - "the exception exists and is narrowly scoped to a CONTRACT change" and
  "the exception names its pattern".

Finished tree: 488 unit, 181 render, 20 degraded, 10/10 audits, typecheck and lint all pass.

---

## Gate run - 2026-09-19 - VERDICT: FAIL

Steps: 11 pass, 1 fail, 0 blocked.
Time: 4m 42s total - slowest G8 Functional / integration (4m 16s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (57ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (49ms)
- **G4 No hard-coded colours** - PASS (73ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (9.9s)
- **G7 Unit + pure specs** - PASS (9.8s)
- **G8 Functional / integration** - FAIL (4m 16s)

```
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/test-failed-1.png
    Error Context: test-results/closure-upsell-tip.functio-1a8e3-dding-never-moves-the-guest-desktop/error-context.md
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop/test-failed-1.png
    Error Context: test-results/guest-journey.functional-a-301a9--tips-—-and-the-data-agrees-desktop/error-context.md
    Error: expect(locator).toBeVisible() failed
    Expected: visible
    Error: element(s) not found
    test-results/guest-total-visibility.fun-72182--for-it-and-stays-asked-for-desktop/test-failed-1.png
    Error Context: test-results/guest-total-visibility.fun-72182--for-it-and-stays-asked-for-desktop/error-context.md
```

- **G9 Automation addressability** - PASS (59ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.5s)
- **G11 Wide tables are configurable** - PASS (59ms)
- **G12 Installable as an application** - PASS (72ms)

_Merge blocked. Every FAIL above must resolve. No partial merges._

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

Steps: 11 pass, 0 fail, 1 blocked.
Time: 28.1s total - slowest G6 Lint (9.9s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (50ms)
- **G2 Contrast (all tokens, both themes)** - PASS (53ms)
- **G3 Theme assets present per theme** - PASS (51ms)
- **G4 No hard-coded colours** - PASS (74ms)
- **G5 Types** - PASS (7.6s)
- **G6 Lint** - PASS (9.9s)
- **G7 Unit + pure specs** - PASS (7.2s)
- **G8 Functional / integration** - BLOCKED (-) - E2E/functional tier requires a seeded database; this change is a client-side filter over a payload the screen already holds and is covered at the unit and render tiers.
- **G9 Automation addressability** - PASS (56ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.0s)
- **G11 Wide tables are configurable** - PASS (63ms)
- **G12 Installable as an application** - PASS (72ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Change - 18-Sep-2026 - Owner > Staff organised by application access, then by availability

### What changed, and what deliberately did not

The Staff list was one flat roster grouped only by role, so "who still needs the app?" meant
reading 26 rows for a pill. It now opens on two chips — **Has access · N** / **No access · N** —
and each tab splits into **Available today** / **Unavailable today**, with the existing role
grouping preserved *inside* each section rather than applied to the whole list.

**Nothing below the tabs changed.** The row, its pill, its toggle, and all five actions — Module
access, Give them the app, Paperwork, Edit, Remove — keep their markup and their behaviour. The
change is a client-side filter over a payload the screen already receives; no query, no schema,
no permission and no route was touched.

### The source of truth, found rather than invented

The requester warned against inferring access from role, and against inferring it from the PIN
**unless the application explicitly defines the PIN as the access criterion**. It does:

| Question | Existing field | How the app already words it |
|---|---|---|
| Has access? | `StaffMember.hasPin` — `queries.ts:576`, `hasPin: !!s.pin_hash` | the row's pill reads **"Can sign in" / "No PIN yet"**; the action reads **"Give them the app" / "Reissue PIN"** |
| Available today? | `StaffMember.onDuty` — `queries.ts:575`, `onDuty: s.on_duty` | the row's toggle reads **"In today" / "Out today"** |
| Role | the existing `byRole` map, now built per section | `{role} · {n}` heading, unchanged |

`staff_permission` is deliberately **not** the criterion. The app calls that **Module** access —
what a person may do once inside — and names it differently on the same row. Using it here would
answer a different question and would put every seeded chef under HAS ACCESS while their own row
says "No PIN yet".

### Fail-first evidence

| # | Defect injected | Observed |
|---|---|---|
| A | `hasAccess` narrowed to `people.filter((p) => p.hasPin && p.onDuty)` — availability folded into access | **3 failed**, including case 6 *"access must be decided by the PIN alone"* |
| B | the section list reduced to `['Unavailable today', [] as StaffMember[]]` — Available dropped | **1 failed** — *"tabs sit above the list, and Available comes before Unavailable"* |
| C | role grouping replaced with `[['All staff', members]]` — the list flattened | **2 failed**, including case 8 *"role grouping is preserved INSIDE each section"* |
| D | `CHIP_NAV_WRAP` set back to the pre-fix scrolling value | **1 failed** at the unit tier — *"the tab row is the existing chip NAVIGATION"* (18 passed) |

**NOT OBSERVED FAILING — the eight render cases, under defect D: 8 passed.** Two chips this
short occupy about 270px of the 328px content box at 360px, so they fit whether the row wraps or
scrolls; the defect is real but cannot express itself through *these* labels. It is caught at the
unit tier instead (row D above), and the container's own observed-failing evidence is the
ten-label block at the top of the same render file (17-Sep: 15 failed, 4 passed). The eight are
kept as a **forward** guarantee — a third tab, a longer label, or a three-digit count would be
caught there and nowhere else. Recorded verbatim in the spec's header.

### What was run

| Rung | Result |
|---|---|
| `tests/unit/staff-access-tabs.unit.spec.ts` (new, 19 cases) | **19 passed** |
| Full unit tier | **591 passed** |
| Full render tier (incl. 8 new Staff-tab cases at every width) | **316 passed** |
| `npx tsc --noEmit` | clean |
| `npm run lint` (`--max-warnings 0`) | clean |
| `DIST_DIR=.next-X npm run build` | exit 0 |
| `npm run audit:all` | **10/10 passed**, every ratchet a clean gate |
| `npm run guard:test` | **15/15 passed** |
| `node scripts/gate-runner.mjs --cwd jalsa --skip G8` | **BLOCKED** — 11 pass, 0 fail, 1 blocked |

**G8 is BLOCKED, not passed, and that is the honest verdict.** The functional tier needs a seeded
database this container has no sanctioned target for; production is never an automated target. The
change is covered at the unit and render tiers, but that is a statement about coverage, not a
substitute for the rung that did not run.

### Not verified

The new organisation has not been seen in the running owner console — that needs a PIN and a
database. Every assertion here is on the source and on the real stylesheet, not on the live
screen.

---

## Bug - 18-Sep-2026 - Owner > Staff > Module access: "Something on our side failed"

### Root cause, in two layers

**LAYER 1 — the environment, proven against the live production schema.**
`20260917120000_jalsa_drop_ambiguous_set_staff_pin.sql` exists in this repository and has
**never been applied to production**. `set_staff_pin` still carries BOTH signatures there —
`(p_staff uuid, p_pin text)` and `(p_staff uuid, p_pin text, p_provisional boolean)` — so
PostgREST cannot choose and every call fails. Production's migration ledger stops at
`20260916105856`; seven repo migrations are unapplied.

**LAYER 2 — the message, which is the code defect and what this run fixed.**
`db-errors.ts` was written on 17-Sep for exactly this fault and **still did not fire**. It listed
the DATABASE's SQLSTATEs (`42725` and friends), but the application never speaks to Postgres
directly: PostgREST resolves the overload itself and answers with its own `PGRST203`. That
matched nothing, fell through to *"Nothing you did was lost — try again"*, and sent the owner to
retry an action that can never succeed. **The one message written to say "retrying cannot help"
could not fire for the one error it was written about.**

### Evidence gathered before any code was changed

| Checked | Finding |
|---|---|
| `staff_permission` / `audit_entry` schema vs the code | **exact match**, production |
| The exact `setPermissions` statement sequence, replayed on the TEST project | **all three succeeded** (delete, 3-row insert, confidential audit) — then cleaned up |
| RLS / FORCE / policies / triggers on `staff_permission` | identical posture to `setting`, which works. No drift |
| Owner's own grants | 59 of 59, including `staff.perms` — so `demand` passes (and would be 403, not 500) |
| Permission catalogue vs production keys | 59 vs 59 distinct. No unknown key |
| `refreshNow` | catches everything, never throws — so the toast is the POST's own 500 |
| `setPermissions` at HEAD vs working tree | byte-identical (md5) |
| **Has this ever worked?** | **No.** Every `staff_permission` row still reads `granted_by = 'setup'`; **zero** `Permission` audit rows exist, while 72 other audit rows do — and every chef reads "No PIN yet" |
| Other owner writes | working today — Settings 05:32, Staff 04:27 |

Hypotheses eliminated with evidence: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S.
T was the right family — a post-write step making a success look like a failure — but the culprit
was the error CLASSIFIER, not the audit.

### The fix

Three PostgREST codes added to `SCHEMA_FAULTS` in `src/lib/db-errors.ts`: `PGRST202` (function
absent from the schema cache), **`PGRST203`** (cannot choose between overloads — the 17-Sep fault
as it actually arrives), `PGRST204` (column absent). Nothing else changed.

Minimal because the predicate, the message and the handler were all already correct and already
wired; the set they consult was simply written in the wrong vocabulary. **Nothing was hidden,
swallowed, retried, delayed, or reported as success.**

### Fail-first evidence

The three `PGRST*` cases were run against the pre-fix `SCHEMA_FAULTS` set:
**1 failed** — `PostgREST's own schema codes are recognised, not just the database's`
("ambiguous function, as PostgREST reports it"). Restored; 12/12 green, and 28/28 alongside
`errors.taxonomy` and `function-overloads`.

### Tests

`tests/unit/module-access.unit.spec.ts` — **12 cases**, covering the request's list: the panel
opens on actual grants, one save carries the whole set, delete-then-insert creates missing rows
and cannot duplicate, the write is scoped to one staff member, an empty set is a legitimate save,
`staff.perms` is demanded server-side, identity is settled before the switch, the audit diffs
before the delete, and the queue keys are ordinary catalogue entries.

### Gates

`audit:all` 10/10 · `guard:test` 15/15 · tsc · eslint · build · **572 unit** · **308 render** ·
5 degraded functional — all PASS. Gate verdict **BLOCKED on G8 only**.

### NOT VERIFIED, and what would settle it

The Module access SAVE was not driven end to end, because that needs the app pointed at a
non-production Supabase project and the only service-role key here is production's. Its exact
statements succeed against a real database, so **no failure mechanism was found in
`setPermissions` itself** — the proven failure is on the same Staff row's "Give them the app".
Whether the reported click was that action, or whether Module access fails for a further reason,
needs either the Vercel function log for the failing request or a test-project key.

**No migration was written.** The one that is needed already exists and is unapplied — an
environment action on a target this session must never write to.

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

Steps: 11 pass, 0 fail, 1 blocked.
Time: 23.4s total - slowest G6 Lint (10.5s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (52ms)
- **G2 Contrast (all tokens, both themes)** - PASS (48ms)
- **G3 Theme assets present per theme** - PASS (50ms)
- **G4 No hard-coded colours** - PASS (72ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (10.5s)
- **G7 Unit + pure specs** - PASS (7.3s)
- **G8 Functional / integration** - BLOCKED (-) - The functional tier needs a reachable non-production Supabase project; the only service-role key here is production's, which is never an automated target. Degraded functional ran separately: 5/5 PASS.
- **G9 Automation addressability** - PASS (62ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.1s)
- **G11 Wide tables are configurable** - PASS (61ms)
- **G12 Installable as an application** - PASS (69ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Feature - 18-Sep-2026 - Indoor Queue QR + waitlist management

**Asked for:** a dedicated entrance QR, owner/captain open-close control, join → token → live
position → welcomed to a table → ordinary ordering, a queue-closed screen that cancels nobody, and
an operator view showing requests AND guests.

### PHASE 1 found that most of it already existed

Fourteen pieces were reused untouched: the `waitlist_entry` table, the shared `W-` number series,
the entrance page with all four states, the cookie-isolated guest API, `readQueueEntry`'s position
and estimate, **six granular queue permissions** (`queue.view/walkin/notify/seat/close/clear` —
finer than the request assumed), the owner waitlist screen, `settings.queue.open`, the audit trail,
`useLiveData`, the QR generator, party sizes `[1,2,3,4,5,6,8,10]` shown as `10+`, and the render
order that already keeps a waiting party's token when the queue closes.

**No migration.** Every column needed already exists and `queue.open` is a settings row.

### The four gaps, and what closed them

| Gap | Was | Now |
|---|---|---|
| **G1** | `guestJoinQueue` never read `queue.open`. Closure was enforced only by what `/q` rendered — so a tab opened before closing, a direct POST, or a tap in the same second all joined a closed queue | The mutation reads the switch and throws **before a token is taken**, so a refused join leaves no hole in the night's numbering. The route answers 409. A stale tab moves to the closed screen rather than toasting over a dead form |
| **G2** | No entrance QR existed; `/api/owner/qr` refused without `?table=` | One generator, two codes: no table name means `/q`. An **Indoor queue code** card in Tables & QR with status, open/close, the image and print instructions |
| **G3** | The headline read "N parties waiting" with the head count as a sub-note | "Waiting outside · 3 requests · 10 guests", and the tile agrees rather than saying something else |
| **G4** | The queue screen ran its own `setInterval` — a second live-data idiom that polled with the phone in a pocket and blanked a party's token on one failed read | `useLiveData`, plus a local override so a poll already in flight cannot undo what this phone just did |

### What was added

`tests/unit/indoor-queue.unit.spec.ts` — **22 cases**, numbered against the request's list of 20.
They split deliberately into the four gaps and the regressions that pin what was already correct
(cookie isolation, the single token series, the party sizes, the ordering handoff).

### Fail-first evidence

| # | Defect injected | Observed |
|---|---|---|
| A | the closed check moved to AFTER `nextNumber('waitlist')` | **1 failed** - `2. a CLOSED queue refuses a new party` ("and runs before a token is taken") |
| B | the entry branch gated on `queueOpen`, so closing hides a waiting party's own token | **1 failed** - `3+17. closing the queue touches no existing row` |
| C | the entrance code started carrying `?token=` | **1 failed** - `19. the entrance code identifies a PLACE and nothing else` |
| D | the headline reduced to the head count alone | **1 failed** - `7b. the operator sees REQUESTS and GUESTS` |

All reverted; 22/22 green.

**Two probe defects the spec found in itself first.** `codeOnly` refused `queue-closed.ts` —
one exported line under a long note leaves less than the third it insists on, a guard right for a
component and wrong for a constant; that case now reads raw with exact assertions. And the
"carries no token" check was matching `@/theme/tokens.generated`, the colour import: it now reads
the target expression rather than scanning the file.

**One real defect the gates found.** `check-testid-coverage` BLOCKED on the new print anchor —
`asChild` means the anchor handles the click, and the table-code sheet beside it has carried both
ids since it was written. Fixed, not baselined.

### Gates

| Gate | Verdict |
|---|---|
| `npm run audit:all` | **PASS** - 10/10 (after the testid fix) |
| `npm run guard:test` | **PASS** - 15/15 |
| `tsc --noEmit` · `eslint src tests` | **PASS** |
| build | **PASS** - `/q` and `/api/owner/qr` both emitted |
| unit tier | **PASS** - 565 |
| render tier | **PASS** - 308 |
| degraded functional | **PASS** - 5 |
| gate-runner `--skip G8` | **BLOCKED** - G8 only |

### NOT EXECUTED

No party was joined, welcomed or seated against a live database: that needs a non-production
service-role key this container does not have. The state transitions are asserted from source and
from the schema's own constraints. **No migration was required, so there was nothing to apply to
the test project and production was not touched at all this run.**

### Workstream isolation

Eight files were modified, all of them queue: the guest queue route, the QR route, `GuestQueue`,
the Settings entrance card, `WaitlistSection`, `guestJoinQueue`, the new shared sentence, and the
new spec. No logo, combobox, `heard_about`, promotions, Uplift, payment, WhatsApp or staff-ordering
file was touched this run.

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

Steps: 11 pass, 0 fail, 1 blocked.
Time: 23.4s total - slowest G6 Lint (10.0s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (55ms)
- **G2 Contrast (all tokens, both themes)** - PASS (59ms)
- **G3 Theme assets present per theme** - PASS (48ms)
- **G4 No hard-coded colours** - PASS (74ms)
- **G5 Types** - PASS (2.6s)
- **G6 Lint** - PASS (10.0s)
- **G7 Unit + pure specs** - PASS (7.2s)
- **G8 Functional / integration** - BLOCKED (-) - The full functional tier needs the app pointed at a reachable Supabase project; the only service-role key here belongs to production, which is never an automated target (ENVIRONMENTS.md). Degraded fun
- **G9 Automation addressability** - PASS (59ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.1s)
- **G11 Wide tables are configurable** - PASS (58ms)
- **G12 Installable as an application** - PASS (68ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Feature - 18-Sep-2026 - Customer promotions / specials

**Asked for:** owner-defined reusable promotional sections, activated for the day from Day setup,
shown to the guest above the menu, ordered through the existing flow, and attributed to Uplift
only when the ORDER came from the promotion.

### Four questions answered before any code (recorded in the request file)

| | Finding | Answer |
|---|---|---|
| Max active | The design's artboard shows four strips but defines no maximum in prose | **5**, the stated default; the refusal sentence ships verbatim |
| Where it lives | There is no section called "Administration" | **A panel inside Settings**, so Day setup's button reads **Open settings** rather than the request's illustrative "Open administration" |
| Attribution | `item_source` (`menu`/`quick_add`) was added one day earlier and answers exactly this question | **Extend it** with `promotion` plus a nullable FK; value shortened to `promotion` the way `customer_quick_add` became `quick_add` |
| Item picker | The shared combobox is single-select and five call sites old | **Composed, not forked** — it is the "add one more" control, chips beside it, chosen items filtered out of its options |

### What was added

| Rung | Tier | Cases |
|---|---|---|
| `tests/unit/promotions.unit.spec.ts` | unit | 29 |
| `tests/render/promotions.render.spec.ts` | render | 35 |

The 29 unit cases are numbered against the request's own list of 25.

### Four assertions in `quick-add.unit.spec.ts` were RE-EXPRESSED, not weakened

The quick-add spec (written the previous day) correctly noticed that promotions generalised the
code it pinned. Each was rewritten to assert the SAME guarantee against the generalised code, with
the reason written in beside it:

- `let source: 'menu' | 'quick_add' = 'menu'` → a regex on the initialiser. The union gained a
  third member; what is asserted — the default is `menu` — is unchanged.
- `.eq('source','quick_add')` → `.neq('source','menu')`. The attribution floor generalised from
  one affordance to every affordance. Same floor, stated once.
- the `itemSource` mention count → one accumulation per figure, named by its own accumulator.
  Counting mentions was never the point and the promotion breakdown added legitimate ones.
- `commit(itemId, next, wasQuick)` → a regex admitting the fourth argument. The case is about the
  flag surviving the tap-collapse, which it still does.

### Fail-first evidence

| # | Defect injected | Observed |
|---|---|---|
| A | the promotion claim is accepted without checking the promotion is live | **1 failed** - `19. a promotion claim is verified in full before it is recorded` |
| B | every promotion is sent to the phone, active or not | **1 failed** - `11+12. only live promotions reach a phone at all` |
| C | uplift groups all promotions into one bucket instead of by name | **1 failed** - `20. uplift groups promotion revenue by promotion` |
| D | activation demands `menu.item_edit`, collapsing the Administration/Day-setup split | **1 failed** - `8+9. activation is its own verb, on its own permission` |
| E | the ordinary menu list starts passing a promotion id | **1 failed** - `18. ordering the same dish from the MENU carries no promotion attribution` |
| F | the heading row loses `flex-wrap` | **1 failed at 320px** - `the supporting text sits beside the heading where there is room, and below where there is not` |

All reverted; both rungs re-run green (29 unit, 35 render).

**Two defects the render spec found in itself, before it could find any in the code.**
1. It measured the menu's ABSOLUTE y and read 1135px for a block that is 330px tall — the probe
   is appended to whatever `/` already rendered. Now measured relative to the promotion area.
2. It asserted the heading and its supporting text share a line at 1024px. They do not, and
   should not: the guest surface is capped by `--layout-guest-max-width`, so a desktop viewport
   gives this block no more room than a large phone. The assertion was false, not the code.
   It now uses a short promotion name for that case and says why.

### Database verification, on the TEST project only

`supabase/migrations/20260918070000_jalsa_promotions.sql` applied to `uxmyomxtosjlkvjxnvpy`:

| Check | Before | After |
|---|---|---|
| `menu_item` / `kot_item` / `guest_cart_line` rows | 57 / 37 / 19 | **57 / 37 / 19** |
| `promotion`, `promotion_item` | absent | **present, RLS on, no policy** |
| `item_source` enum | `menu,quick_add` | **`menu,quick_add,promotion`** |
| lines attributed to anything but `menu` | - | **0** |

Then every guarantee was exercised in SQL and cleaned up:

| Probe | Outcome |
|---|---|
| five promotions activated | accepted |
| **the sixth** | **refused by the trigger** |
| switch one off, another on | accepted |
| **the same item added twice to one promotion** | **refused by the primary key** |
| delete a promotion → its membership | **0 rows left** |
| delete a promotion → the menu | **57 of 57 items intact** |
| cleaned up | 0 promotions left, 0 memberships |

**Production (`yxgxmbyilpivbmeemqkp`) re-checked afterwards:** no promotion tables, no
`kot_item.source`/`promotion_id`/`promotion_name`, no `quick_add`, no `item_source` type,
57 menu items, 41 kot items. Untouched.

### Gates

| Gate | Verdict |
|---|---|
| `npm run audit:all` (Jalsa) | **PASS** - 10/10 |
| `npm run guard:test` (framework) | **PASS** - 15/15 |
| `tsc --noEmit` · `eslint src tests` | **PASS** |
| `DIST_DIR=.next-promo npm run build` | **PASS** |
| unit tier, all specs | **PASS** - 543 |
| render tier, all specs | **PASS** - 308 |
| degraded functional (no database) | **PASS** - 5 |
| `node scripts/gate-runner.mjs --cwd jalsa --skip G8` | **BLOCKED** - G8 only |

### NOT EXECUTED, stated rather than claimed

The full journey — owner creates a special, Day setup switches it on, a guest taps Add inside it,
the line reaches a KOT and a bill, Uplift names it — was **not driven against a running database**.
It needs the app pointed at a non-production Supabase project and this container holds only
production's service-role key. The schema guarantees WERE exercised (above); the application
logic is asserted from source. `G8` is **BLOCKED** and the gate verdict is BLOCKED.

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

Steps: 11 pass, 0 fail, 1 blocked.
Time: 23.4s total - slowest G6 Lint (11.1s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (53ms)
- **G2 Contrast (all tokens, both themes)** - PASS (50ms)
- **G3 Theme assets present per theme** - PASS (47ms)
- **G4 No hard-coded colours** - PASS (67ms)
- **G5 Types** - PASS (2.3s)
- **G6 Lint** - PASS (11.1s)
- **G7 Unit + pure specs** - PASS (6.6s)
- **G8 Functional / integration** - BLOCKED (-) - The full functional tier needs the app pointed at a reachable Supabase project; the only service-role key in this container belongs to production, which is never an automated target (ENVIRONMENTS.md).
- **G9 Automation addressability** - PASS (55ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.0s)
- **G11 Wide tables are configurable** - PASS (56ms)
- **G12 Installable as an application** - PASS (68ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Feature - 18-Sep-2026 - The one-tap quick-add (requested as "+ Water bottle")

**Asked for:** a one-tap water bottle on the guest home screen, as a real ORDER, resolved from
the persisted menu item, reaching the same round, KOT, bill and GST, with only quick-add sales
attributed to Uplift.

### The finding that changed the shape of it

`menu_item` holds **57 rows and not one is a water bottle** — 0 matches for water / bottle /
mineral / aqua, in the production project AND the test project. Drinks holds three items: Badam
Milk 25, Horlicks 25, Lime Tea 12. So the request's central instruction ("resolve the existing
menu item by its persisted identity") had nothing to resolve, and its two prohibitions (no
hardcoded price, no duplicate item) ruled out inventing one. Put to the requester with three
options; they chose **the owner nominates the item from the Menu section**.

Two more findings were put with it and answered:

- **Uplift computes no revenue at all today.** It shows counts behind "Uplift is a comparison,
  not a sum". Answer: stamp the item, add ONE tile, leave the unbuilt range comparison alone.
- **Attribution today is per-ROUND** (`kot.source` = guest|captain|owner); `kot_item` had no
  source column. Answer: add the smallest per-item field.

All three answers are recorded verbatim in `requests/2026-09-18-water-bottle-quick-add.md`.

### What was added

| Rung | Tier | Cases |
|---|---|---|
| `tests/unit/quick-add.unit.spec.ts` | unit | 20 |
| `tests/render/quick-add.render.spec.ts` | render | 40 |

The 20 unit cases are numbered against the request's own list of 15.

### Fail-first evidence

| # | Defect injected | Observed |
|---|---|---|
| A | `setCartLine` trusts the browser's `quickAdd` claim without checking the nomination | **1 failed** - `11. a quick-add is attributed only after the server checks the nomination` |
| B | the corrective update drops `.eq('source','quick_add')`, so attribution can climb back | **1 failed** - `11b. attribution can fall from quick_add to menu, never climb` |
| C | the Uplift figure stops excluding cancelled lines | **1 failed** - `12. a cancelled quick-add line is not counted as revenue` ("cancelled lines are skipped") |
| D | the affordance flag is dropped by the tap-collapse | **1 failed** - `13b. the affordance survives the collapse, and the last tap owns the row` |
| E | the card's row loses `flex-wrap` (injected into the card AND the spec's pin, so it is the MEASUREMENT that fails) | **1 failed at 320px** - `the row wraps instead of squeezing the control when the name is long` |

All reverted; the two rungs re-run green (20 unit, 40 render).

**A defect the spec found in itself.** The first `fn()` body-extractor stopped at the first
`\n}`, which in this codebase closes a multi-line PARAMETER block, not a body — it returned 54
characters of signature and made 8 of 20 cases fail for a reason unrelated to the code they
meant to read. Fixed to count braces, and then fixed again because a return annotation like
`: Promise<{ kotCode: string }>` supplies a brace between the parameters and the body. Both
corrections are written into the helper, because the next spec that reads a function body here
will hit exactly the same two things.

### Database verification, on the TEST project only

`supabase/migrations/20260918060000_jalsa_quick_add.sql` applied to `uxmyomxtosjlkvjxnvpy`:

| Check | Before | After |
|---|---|---|
| `menu_item` rows | 57 | **57** |
| `kot_item` rows | 37 | **37** |
| `guest_cart_line` rows | 19 | **19** |
| `menu_item` columns | 17 | **18** |
| `kot_item` columns | 14 | **15** |
| `item_source` enum | absent | **`menu,quick_add`** |
| rows stamped anything but `menu` | - | **0** (37 of 37 kot_item rows defaulted to `menu`) |

Then the guarantee itself was exercised in SQL and cleaned up:

| Probe | Outcome |
|---|---|
| first nomination | accepted |
| **second nomination** | **refused, 23505 unique_violation** |
| moving the nomination (clear, then set — what `setQuickAddItem` does) | accepted |
| cleaned up | 0 still nominated |

**Production (`yxgxmbyilpivbmeemqkp`) re-checked afterwards:** `quick_add` column absent,
`kot_item.source` absent, `item_source` type absent, 57 menu items, 41 kot items. Untouched.

### Gates

| Gate | Verdict |
|---|---|
| `npm run audit:all` (Jalsa) | **PASS** - 10/10 |
| `npm run guard:test` (framework) | **PASS** - 15/15 suites |
| `tsc --noEmit` | **PASS** |
| `eslint src tests` | **PASS** |
| `DIST_DIR=.next-qa npm run build` | **PASS** |
| unit tier, all specs | **PASS** - 514 |
| render tier, all specs | **PASS** - 273 |
| degraded functional (no database) | **PASS** - 5 |
| `node scripts/gate-runner.mjs --cwd jalsa --skip G8` | **BLOCKED** - G8 only |

### NOT EXECUTED, stated rather than claimed

The full functional tier needs the app pointed at a reachable Supabase project, and the only
service-role key in this container belongs to production, which is never an automated target.
So the following were verified **from the source and from SQL**, not by driving the running app:

- the round actually reaching the kitchen with a `quick_add` line on it
- the Uplift tile rendering a figure from real closed bills
- the owner's One tap column round-tripping through the console

`G8` is therefore **BLOCKED** and the gate's verdict is BLOCKED. No flag here produces green.

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

Steps: 11 pass, 0 fail, 1 blocked.
Time: 21.7s total - slowest G6 Lint (10.1s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (52ms)
- **G2 Contrast (all tokens, both themes)** - PASS (48ms)
- **G3 Theme assets present per theme** - PASS (47ms)
- **G4 No hard-coded colours** - PASS (65ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (10.1s)
- **G7 Unit + pure specs** - PASS (6.2s)
- **G8 Functional / integration** - BLOCKED (-) - The full functional tier needs the app pointed at a reachable Supabase project. The only service-role key in this container belongs to the production project, which is never an automated target (ENVIR
- **G9 Automation addressability** - PASS (53ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.0s)
- **G11 Wide tables are configurable** - PASS (53ms)
- **G12 Installable as an application** - PASS (62ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Change - 18-Sep-2026 - Owner > Settings > Restaurant details: replace the logo

**Asked for:** show the stored logo, Browse to replace it, SVG/PNG/JPEG only, at most 15 MB,
preview before saving, and never destroy the working logo when an upload fails.

### What was added

| Rung | Tier | Cases |
|---|---|---|
| `tests/unit/logo-upload.unit.spec.ts` | unit | 17 |
| `tests/unit/logo-upload-wiring.unit.spec.ts` | unit | 17 |
| `tests/render/logo-control.render.spec.ts` | render | 41 |

Two assertions in `tests/unit/restaurant-details.unit.spec.ts` were amended, not removed, and
the reason is written into the spec beside each:

- the frozen sentence `Replacing the artwork is a file change` was a stated LIMITATION that this
  change removes, not a shipped string being rewritten. Everything else that test froze is still
  frozen, including `The badge printed on the QR stands, the bill and every HR document.`
- `not.toMatch(/disabled={(?!busy})/)` now also admits `saving` and `saving || busy` - the logo
  card's own save flag. What it asserts is absent is unchanged: a control disabled for any reason
  OTHER than a save in flight.

### Fail-first evidence

Each rung was run against a tree carrying a deliberate defect, and the failures observed:

| # | Defect injected | Observed |
|---|---|---|
| A | `inspectLogo` falls back to trusting the filename when the bytes match nothing | **3 failed** - `5. an unsupported file type is rejected` ("a PDF must be refused"), `5c. a name is never enough`, `5g. a truncated head is not mistaken for the format it is the start of` |
| B | `LOGO_MAX_BYTES` raised to 50 MB | **2 failed** - `4. a file over 15 MB is rejected`, `the size label is readable at every scale the ceiling allows` |
| C | the tidy-up loses its `startsWith(restaurantId + '/')` scope | **1 failed** - `9. the storage path is derived on the server and cannot be supplied by the caller` ("the old path must be checked against this restaurant before deletion") |
| D | the old object is removed BEFORE `setRestaurantLogo` | **1 failed** - `6b. the old asset is removed only AFTER the repoint succeeded` ("deleting first is how a restaurant ends up with no logo at all") |
| E | the text column loses `min-w-0` (injected into the card and into the spec's pin together, so it is the MEASUREMENT that fails, not the pin) | **2 failed at 768px** - `768px, a file picked: nothing crosses the card` ("caption must end inside the card at 768px"), `a long filename truncates rather than widening the card` |

All defects were reverted and the three rungs re-run green (34 unit, 41 render).

**Defect E is the reason `FILENAME` in the render spec is 100 characters.** At the 68-character
name first written, dropping `min-w-0` changed nothing at any of the nine widths - the row is
`flex-col` below `sm`, where `min-width: auto` does not apply to the cross axis, and above `sm`
a 68-character name still fits. The rung was strengthened until it could actually fail, rather
than recorded as covering something it did not.

### Gates

| Gate | Verdict |
|---|---|
| `npm run audit:all` (Jalsa) | **PASS** - 10/10 |
| `npm run guard:test` (framework) | **PASS** - 15/15 suites, every guard executed |
| `tsc --noEmit` | **PASS** |
| `eslint src tests` | **PASS** |
| `DIST_DIR=.next-logo npm run build` | **PASS** - `/api/owner/logo` in the route table |
| unit tier, all specs | **PASS** - 494 |
| render tier, all specs | **PASS** - 233 |
| degraded functional (`tests/functional/degraded.functional.spec.ts`, no database) | **PASS** - 5 |
| `node scripts/gate-runner.mjs --cwd jalsa --skip G8` | **BLOCKED** - see below |

### NOT EXECUTED, and why - stated rather than claimed

The end-to-end upload was **not run against any Supabase project**, so five of the twelve cases
the request lists are recorded here as NOT EXECUTED, not as passing:

- 6. existing logo remains unchanged after a failed upload *(order asserted from source; not run)*
- 7. a successful upload updates the active logo *(wiring asserted from source; not run)*
- 9. restaurant A cannot modify restaurant B's logo *(path derivation and the delete scope
  asserted from source; not run)*
- 11. the new logo persists after a reload *(not run)*
- and the storage bucket itself: `supabase/migrations/20260918050000_jalsa_restaurant_branding_bucket.sql`
  is **applied to no environment**.

Two facts make this unrunnable here rather than merely skipped:

1. The application needs `SUPABASE_SECRET_KEY` (service role) to reach storage at all - every
   table has RLS on with no permissive policy, so a publishable key authorises nothing
   (guardrail 3).
2. This container holds exactly one such key and it belongs to the **production** project, which
   `docs/registers/ENVIRONMENTS.md` names as never an automated target. There is no `.env.test`.

`G8 Functional / integration` is therefore **BLOCKED**, and the gate's verdict is BLOCKED. That
is the honest value, and no flag here can produce green.

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

Steps: 11 pass, 0 fail, 1 blocked.
Time: 21.6s total - slowest G6 Lint (9.6s).
Application steps ran in .

- **G1 Theme artifacts in sync** - PASS (57ms)
- **G2 Contrast (all tokens, both themes)** - PASS (51ms)
- **G3 Theme assets present per theme** - PASS (51ms)
- **G4 No hard-coded colours** - PASS (72ms)
- **G5 Types** - PASS (2.1s)
- **G6 Lint** - PASS (9.6s)
- **G7 Unit + pure specs** - PASS (6.3s)
- **G8 Functional / integration** - BLOCKED (-) - the functional tier needs a reachable Supabase project; the only service-role key in this container belongs to the production project, which is never an automated target (ENVIRONMENTS.md). The degrade
- **G9 Automation addressability** - PASS (59ms)
- **G10 Backward compatibility (fixtures)** - PASS (3.1s)
- **G11 Wide tables are configurable** - PASS (61ms)
- **G12 Installable as an application** - PASS (72ms)

_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._

---

## Gate run - 2026-09-18 (fifth) - VERDICT: BLOCKED

Restaurant details, recomposed. Presentation only.

- **Static + audits** 10/10 · **Types** PASS · **Lint** PASS · **Build** PASS ·
  **Unit + render** **652/652** (+29).
- **G8 Database-backed functional** - **BLOCKED**, unchanged: no test-project service-role key
  exists in this container.

WHAT THE RISK ACTUALLY WAS
  `writeIdentity` does `update(input.patch)` with the form object, so every key in `form` IS a
  database column. A key dropped while moving markup does not error, does not warn, and does not
  save — the owner types, presses Save, reads a success toast, and the value is gone. All ten
  are asserted by name, read AND bound AND settable, and the COUNT is asserted too so an
  eleventh key would be caught as a column nobody migrated.

AN HONEST CORRECTION TO WHAT THIS CHANGE FIXES
  The render spec's fail-first came back **1 failed, 18 passed** against the shipped
  `flex flex-wrap` + `min-w-[14rem]` shape — and the one failure was the class-drift check, not
  a layout assertion. Measured rather than assumed: at 320px a card's inner width is about
  256px, two 14rem (224px) children cannot both fit, and the row wrapped correctly. **The old
  layout was not overflowing at these widths.** What it lacked was grouping and hierarchy —
  eleven controls in one card, three abreast, with nothing saying that PAN and Who signs answer
  different questions. That is what changed. The render spec is kept as a regression guard on
  the new grid, and it is recorded here as a guard rather than as a fix.

FAIL-FIRST: tests/unit/restaurant-details.unit.spec.ts - three injected losses, each reverted,
10 passed each time afterwards: `hr_email` dropped from the patch (**1 failed, 9 passed**), a
test id renamed (**1 failed, 9 passed**), and the wrapping flex row with its 14rem floor
restored (**1 failed, 9 passed**).
FAIL-FIRST: tests/render/restaurant-details.render.spec.ts - **1 failed, 18 passed**; see the
correction above for why only one.

_Merge blocked: database-backed functional validation._

---

## Gate run - 2026-09-18 (fourth) - VERDICT: BLOCKED

Migration applied to TEST. Degraded functional tier run for real. Browser validation of the
combobox still not possible, and NOT faked.

- **Static + audits** 10/10 · **Types** PASS · **Lint** PASS · **Build** PASS ·
  **Unit + render** **623/623**.
- **G8 Degraded functional** - **PASS, 5/5, for real.** The degraded instance needs no database
  (it boots against an address that refuses), so it runs here. Its stack trace shows the changed
  path executing: `resolveGuest` -> `findTableByName` -> `currentRestaurantId` throwing, caught
  by `attempt()`, designed outage screen rendered. The guest page still fails gracefully.
- **G8 Database-backed functional** - **BLOCKED**, and the reason is now precise rather than
  general (see below).

MIGRATION, APPLIED TO TEST ONLY (uxmyomxtosjlkvjxnvpy, JalsaRestaurant-test)
  Before: 70 sessions, 7 columns, 3 indexes, 5 constraints, no `heard_about`.
  After:  70 sessions, 8 columns, 4 indexes, 6 constraints. 0 nulls, 70 defaulted to ''.
  `heard_about text NOT NULL DEFAULT ''::text`;
  `CHECK ((length(btrim(heard_about)) <= 60))`;
  `CREATE INDEX ... (restaurant_id, heard_about) WHERE (heard_about <> ''::text)`.
  Enforcement proven, not assumed: a 61-character write was REFUSED by the database with 23514,
  and a 60-character write accepted. Both test values removed afterwards; 0 rows left dirty.
  PRODUCTION (yxgxmbyilpivbmeemqkp) re-checked after the apply: `heard_about` does not exist
  there. Untouched.

WHY THE BROWSER VALIDATION STILL CANNOT RUN — the specific missing thing
  The application reaches Supabase with `SUPABASE_SECRET_KEY` (service role), because RLS is on
  with NO permissive policy: a publishable key authorises nothing, so the app cannot run on one.
  This container holds exactly one such key, in `.env.local`, and it belongs to the project with
  the only copy of real data. There is no `.env.test`, no test-project key in the environment,
  and the Supabase tooling here exposes publishable keys only.

  So pointing the running app at JalsaRestaurant-test is not possible, and pointing it at the
  other project is what every standing instruction forbids. The seventeen combobox interaction
  checks, the five field journeys and the seven-width dropdown check are therefore NOT DONE.
  They are not partially done and they are not inferred. To unblock: the test project's
  service-role key in `jalsa/.env.test`, or `SUPABASE_SECRET_KEY` overridden for one run.

_Merge blocked: database-backed functional validation, for the reason above._

---

## Gate run - 2026-09-18 (third) - VERDICT: BLOCKED

Single QR, sequential customers. The bill now belongs to the SESSION, not the table.

- **Static + audits** 10/10 · **Types** PASS · **Lint** PASS · **Build** PASS (`/api/guest/visit`
  registered) · **Unit + render** **623/623** (+27).
- **G8 Functional / integration** - **BLOCKED**, unchanged.

THE DEFECT, WHICH WAS A LIVE CROSS-CUSTOMER LEAK
  Both resolvers picked the bill by TABLE and then WROTE it onto whichever session was asking:
  `openBillForTable(table.id)` -> `session.bill_id = open.id` -> `phase: 'live'`. So after a
  table turned over, customer 1's phone re-rendered onto customer 2's live bill - a stranger's
  order list and total, with the ability to add rounds to it and request payment on it.
  The receipt branch was the same assumption one level down: `lastClosedBillForTable` is the
  right bill only while nobody else has eaten and paid at that table since.

  The decision is now `src/lib/guest-phase.ts` - pure, no database, no clock - and both
  resolvers call it through one `settle()`. The table is consulted in exactly one case, a
  session with no bill at all, which is how a second phone joins the party already sitting there.
  `lastClosedBillForTable` was deleted rather than left exported.

FAIL-FIRST: tests/unit/guest-phase.unit.spec.ts - **9 failed, 10 passed** with
`decideGuestPhase` rewritten to the shipped table-first rule, including both headline journeys
(customer 1 keeping their receipt while customer 2 is live, and a phone staying on its own open
bill).
FAIL-FIRST: tests/unit/guest-session-wiring.unit.spec.ts - **5 failed, 3 passed** with `src/`
stashed.
NOT OBSERVED FAILING: 3 wiring cases passed pre-change because `git stash push -- src/` does not
stash untracked files, so the new visit route survived into the "pre-change" tree. Recorded
rather than counted as coverage.

RUNTIME, AND WHAT IS STILL NOT PROVEN HERE
  Every journey is asserted against the pure decision. NONE of it is asserted against a running
  browser with two real sessions and a real database: that is the functional tier, which needs a
  database this session must not point at. Two phones, one table, one closure has NOT been
  observed end to end.

_Merge blocked: G8 BLOCKED, and the 18-Sep heard_about migration is still unapplied._

---

## Gate run - 2026-09-18 (second) - VERDICT: BLOCKED

Pre-commit review of the combobox work. Three defects found and corrected; one deploy-ordering
blocker recorded and deliberately NOT corrected in code.

- **Static + audits** - PASS. `audit:all` 10/10. **Types** PASS. **Lint** PASS. **Build** PASS.
- **Unit + render** - PASS. **608/608** (+4 review cases).
- **G8 Functional / integration** - **BLOCKED**, unchanged.

WHAT THE REVIEW FOUND
  1. `listHeardSources()` ran on EVERY `assembleGuestPayload`. That payload is the polled
     `/api/guest/state`: an unbounded scan of every answer the restaurant has recorded, rebuilt
     every few seconds for every phone, feeding a field that renders on one screen. Now gated on
     `ctx.phase === 'welcome'`.
  2. Focus was LOST after picking an option with a pointer. Radix restores focus to a popover's
     trigger; this component has an Anchor and no trigger, by design, so there was nothing to
     restore to and focus fell to `document.body`. `close()` now returns it to the input.
  3. Focus-to-open had to go with it — it would have re-opened the list the instant an option
     was chosen, and on a phone the software keyboard can cover a list that opens with it. The
     list now opens on click, on typing, or on ArrowDown, which is also what the ARIA authoring
     practices describe.
  4. `role="listbox"` owned `<li>` elements rather than options, so the options were not
     announced as one of N. The list items are `role="presentation"`.

NOT CORRECTED IN CODE, ON PURPOSE — THE MIGRATION MUST LAND FIRST
  `resolveGuest` and `currentGuestSession` both select `heard_about`. Against a database without
  `20260918030000_jalsa_guest_heard_about.sql` applied, PostgREST answers 42703 and the WHOLE
  guest surface fails — `/t/<table>` degrades to the unreachable screen. This is a deploy
  ordering constraint, not a code defect, and the honest fix is to apply the migration before
  the code ships rather than to soften the reads into a fallback that hides a missing column.

FAIL-FIRST: the four review cases in tests/unit/combobox-migration.unit.spec.ts - each fix
reverted in turn, each time **1 failed, 16 passed**, and 17 passed with all four in place.

_Merge blocked: G8 BLOCKED, and the migration is unapplied._

---

## Gate run - 2026-09-18 - VERDICT: BLOCKED

The shared combobox, and five fields migrated onto it.

- **Static + audits** - PASS. `npm run audit:all` 10/10.
- **Types** - PASS. **Lint** - PASS over `src/` and `tests/`.
- **Production build** - PASS. Compiled; `/api/guest/heard` registered. `.next-cbx` removed and
  `tsconfig.json` restored afterwards.
- **Unit + render tiers** - PASS. **604/604** (up from 579; +25 unit).
- **G8 Functional / integration** - **BLOCKED**, unchanged: the only app instance here points at
  the project holding the only copy of real data.

WHAT THIS TIER CANNOT TEST, STATED RATHER THAN FAKED
  Arrow-key navigation, Enter-to-select, Escape-to-close, outside-click dismissal, the loading
  and disabled states, and the dropdown's behaviour at the 13 widths all need the component
  MOUNTED. The tier that mounts React is the functional one, and it needs a database this
  session must not point at. A render probe could have rebuilt the markup by hand, but the list
  is sized by `--radix-popover-trigger-width`, a value Radix computes at runtime — a hand-built
  probe would have measured a lookalike and reported a pass about markup that does not ship.
  Those cases are NOT covered. The matching rules they sit on top of are, as pure functions.

  The migration `20260918030000_jalsa_guest_heard_about.sql` is **written and applied nowhere**.

THE SAME COMMENT-VS-CODE TRAP, THREE TIMES, NOW FIXED PROPERLY
  The testid audit flagged a paragraph in `combobox.tsx` for naming two element tags in prose,
  and `combobox-migration.unit.spec.ts` first failed on the two files whose comments explain that
  they deliberately do NOT allow creation. Matching raw text made deleting the explanation the
  cheapest way to go green — the wrong thing to make cheap. The spec now strips comments before
  asking, and asserts the strip left the code behind.

FAIL-FIRST: tests/unit/combobox.unit.spec.ts - three deliberate defects, each reverted; 12
passed each time afterwards.
  - search made case-SENSITIVE: **6 failed, 6 passed**
  - the duplicate guard made case- and space-sensitive: **2 failed, 10 passed**
  - matching only at the START of a label: **2 failed, 10 passed**
FAIL-FIRST: tests/unit/combobox-migration.unit.spec.ts - **7 failed, 6 passed** with `src/`
stashed.
NOT OBSERVED FAILING: the 6 that passed there did so for a reason worth recording rather than
smoothing over — `git stash push -- src/` does not stash UNTRACKED files, so the new
`combobox.tsx` survived into the "pre-change" tree. The cases about the component's own ARIA,
its portal and its refusal to select on a failed create were therefore asked of a file that
existed in both trees. They guard regressions; they are not evidence of the defect.

_Merge blocked: G8 BLOCKED._

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

