# RUN — Printers: connect the printing computer (23-Sep-2026)

**Scale** full · **Mode** confirm (four decisions asked and answered — see `requests/2026-09-23-printers-connect-computer.md`)
**Status** software-tested · **Windows-runtime pending (KL-7)** · **physical printer pending (KL-6)** · not pushed, no PR.

## A · Architecture found

`print_job` lifecycle `queued → processing → printed/failed` with an atomic claim and a server-side sweeper; immutable `printer_id`; `bridge_token` (SHA-256, revocable, restaurant-scoped); `/api/bridge` pinned to `list · claim · report`; `ticketPayloadFor` renders `TicketLine[]` on claim; `testPrint()` is an ordinary job; `queuePrint / retryPrintJob / printElsewhere`; `bridge/src` (env-only config, loop, `windows` `copy /b` transport to a *shared* printer, `file`, `null`); Print setup under Settings with a Bridges tab that hands the owner a raw token; Gate 7 BLOCKED; `printing.md` stale; no installer, no download, no packaging; no hosting config (production not provisioned).

## B · Reused, untouched

`print-routing.ts`, `print-template.ts`, `ticket-compose.ts`, `escpos.ts`, `queuePrint`, `retryPrintJob`, `printElsewhere`, `reprintKot`, `runCycle`/`runLoop`, `PrintTransport`, `FileTransport`, `NullTransport`, `WindowsSpoolerTransport` (one optional field added), `authenticateBridge`, the three verbs, `testPrint` (one optional flag), `PrintSetupSection` (reached via *Manage*), environment-variable bridge mode.

## C · New files

| Area | Files |
|---|---|
| Migration | `supabase/migrations/20260923090000_jalsa_print_bridge_pairing.sql` |
| Server | `src/lib/bridge-pairing-code.ts` · `src/lib/db/bridge-pairing.ts` · `src/app/api/bridge/pair/route.ts` · `src/app/api/owner/print-bridge/download/route.ts` · `src/lib/print-bridge-download.ts` · `src/lib/print-bridge-artifact.ts` · `src/lib/print-computer.ts` |
| UI | `src/features/owner/sections/PrintersSection.tsx` |
| Bridge | `bridge/src/{paired-config,pairing,service,cli,log-file,version}.ts` · `bridge/src/windows/{powershell,discovery}.ts` · `bridge/src/transport/windows-queue.ts` |
| Windows | `bridge/windows/{install.ps1,uninstall.ps1,README.txt}` · `Install Jalsa Print Bridge.cmd` · `Remove Jalsa Print Bridge.cmd` |
| Package | `bridge/package/{zip,build}.ts` |
| Tests | `tests/unit/{bridge-pairing,bridge-paired-config,bridge-discovery,bridge-service,print-computer,printers-screen,bridge-package}.unit.spec.ts` |
| Docs | `requests/2026-09-23-printers-connect-computer.md` · this file |

## D · Modified files

`bridge/src/{api,config,main,transport/windows}.ts` · `src/app/api/bridge/route.ts` · `src/app/api/owner/action/route.ts` · `src/lib/{bridge-auth,test-print}.ts` · `src/lib/db/{bridge-mutations,owner-mutations,owner-view,queries,types}.ts` · `src/features/owner/OwnerConsole.tsx` · `src/features/owner/sections/Dashboard.tsx` · `package.json` (`bridge:package`) · `.env.example` · `.github/workflows/ci.yml` (bridge:build step) · `tests/unit/bridge-contract.unit.spec.ts` (superseded, dated) · `bridge/README.md` · `docs/modules/{printing,README}.md` · `docs/GATE-7-HARDWARE-ACCEPTANCE.md` (rows 33–42) · `docs/registers/{KNOWN_LIMITATIONS (KL-7),DESIGN_CONTRACT (DC-013),ENVIRONMENTS}.md` · `CHANGELOG.md` · `TEST_SUMMARY.md`.

## E · Migration (additive, RLS on, no policy) — applied to TEST and to the development project (23-Sep)

Applied to TEST (uxmyomxtosjlkvjxnvpy) on 23-Sep over an unrecorded draft that the file now converges (see the migration's RECONCILIATION note and TEST_SUMMARY.md); applied to yxgxmbyilpivbmeemqkp the same day — clean shape, verified (RLS on, no policy, both indexes). `bridge_token` + `source ('manual'|'paired')`, `hostname`, `bridge_version`, `last_sync_at` · `bridge_pairing_code` (hash only, `expires_at`, `used_at`, `used_by_token_id`) · `bridge_discovered_printer` (snapshot per token, PK `(bridge_token_id, queue_name)`) · `bridge_printer` (PK `(bridge_token_id, printer_id)`, **unique `printer_id`** — one computer per printer).

## F · API

- `POST /api/bridge/pair` — unauthenticated by token; the code is the credential. `{code, hostname, bridgeVersion}` → `{apiUrl, token, label, restaurantName}` once. 400 unknown · 410 used/expired. No restaurant field exists.
- `POST /api/bridge` — `sync` added: `{printers?, hostname, bridgeVersion}` → `{label, assignments[{printerId, machineId, printerName, queueName}]}`. Touches no job. For a **paired** token, `list` and `claim` are intersected with `bridge_printer` server-side.
- `POST /api/owner/action` — `issue-pairing-code {label}` → `{code, label, expiresAt}` once; `save-printer-mapping {computerId, queueName, printerId? | name, station, paperMm, purpose}`; `remove-printer-mapping {printerId}`. All `set.printer`, all restaurant-scoped, queue must be one that computer reported.
- `GET /api/owner/print-bridge/download` — sign-in + `set.printer`; 302 to `PRINT_BRIDGE_DOWNLOAD_URL` · streams `bridge/dist/…zip` · 404 with the honest sentence.
- Owner payload: `printComputers`, `printerMappings`, `pairing {label, expiresAt} | null`, `printBridgeDownload {available}`.

## G · UI

Top-level **Printers** (grant `set.printer`, DC-013). Empty state → *Connect Printing Computer* → one sheet: Download for Windows (or the not-published sentence) · Install · Show pairing code (name the computer; code shown big, ten-minute countdown, single-use; "Waiting for Kitchen PC…" flips to "connected" from live data) · Choose the printer. Connected view: **Printers** cards (station · name · On Kitchen PC · Ready/Not running/Unavailable/Not set up with the sentence · **Test Print** with *Sending test print… / Test print completed / owner-readable failure* following that one job · Remove) and **Printing computer** cards (Connected/Not running/Waiting · Available printers with status · **Select** → Use it as (new / existing Jalsa printer, searchable) · name · Station (searchable, type-to-add) · Kitchen tickets/Bills · 80/58 mm · **Save Printer** · Disconnect with a consequence dialog). *Manage* opens the existing Print setup. Dashboard shows a one-line nudge until a computer is connected. Every string from `print-computer.ts`; no "bridge", "token", "queue", "env" on the screen.

## H · Bridge

`node main.js pair --code X` (reads the baked origin from `jalsa.json`, writes `config.json` atomically, prints a sentence, exits 0/2/3/4) · `run` (paired service: discover → `sync` → rebuild the `machine_id → queue` lookup → `runCycle` unchanged; sync every 30 s, every poll while unmapped; outage → log + backoff + resync; 401 → `bridge.unpaired`, keeps checking, prints nothing; `state.json`; `logs\bridge.log` rolled at 1 MB) · `discover`. No command → Gate 5 environment mode, unchanged. New transport kind `windows-queue`: RAW bytes by queue *name* through `winspool.drv` declared in C# and compiled by PowerShell `Add-Type`; the name travels as `$env:JALSA_QUEUE`, never on a command line; refuses Offline/PaperOut/PaperJam/Error before queueing. Import hygiene unchanged (node:* + the three pure app files).

## I · Windows installer

`Install Jalsa Print Bridge.cmd` elevates and runs `install.ps1`: copies to `%ProgramData%\Jalsa\PrintBridge\app` (main.js, node\node.exe, jalsa.json); creates `spool`, `logs`; `icacls` the home to SYSTEM + Administrators; the **one prompt** — the pairing code — retried on exit 3/4 (five tries); registers Scheduled Task *Jalsa Print Bridge* (`node.exe main.js run`, SYSTEM, AtStartup, RestartCount 999 / 1 min, no time limit, IgnoreNew) and starts it; waits ≤30 s for `state.json = connected`. `-Repair`, `-RunAsCurrentUser`, `-Code`. `uninstall.ps1` removes task and folder. **Never run on Windows here** (KL-7).

## J · Pairing flow

Owner names the computer → `issue-pairing-code` spends any earlier unused code, stores `hashPairingCode(code)` with a 10-minute expiry, returns `ABCD-EFGH` once (31-symbol alphabet, no 0/O/1/I/L; 31^8 ≈ 8.5×10¹¹) → installer `pair` posts it → `redeemPairingCode` spends the row by **one conditional update** (`used_at IS NULL AND expires_at > now`), mints `jbt_…`, stores its SHA-256 as an ordinary `bridge_token` (`source='paired'`, `restaurant_id` **from the code's row**), re-pairing under the same name revokes the old paired token and moves its mappings (the reinstall case), audits the label never the code → the bridge writes `config.json`. Restaurant A can never obtain B's credential: nothing the PC sends names a restaurant, and every mapping/sync read is scoped to the token's restaurant.

## K · Discovery flow

Every sync the bridge runs `Get-Printer` (`ConvertTo-Json`, status as the enum name; the parser also accepts numbers, a bare object, an empty answer, and refuses an unreadable one) and reports `{queueName, driverName, portName, status: ready|offline|error|unknown, isVirtual}`; the server replaces that computer's snapshot; the screen lists USB first, software printers last. Discovery never chooses.

## L · Download flow

`npm run bridge:package -- --origin <origin>`: esbuild bundle → download `node-v24.21.0-win-x64.zip` from nodejs.org (SHA-256 pinned in `build.ts`, verified; `--node-zip` for offline) → extract `node.exe` + `LICENSE` with the in-repo zip reader → assemble with `bridge/windows/*` and `jalsa.json {origin, bridgeVersion, builtAt}` → write `bridge/dist/jalsa-print-bridge-windows.zip` (34.3 MB) + manifest → read back and check every required entry. Verified here: Python `zipfile.testzip()` = None; extracted `node.exe` SHA-256 = nodejs.org's published `win-x64/node.exe` hash. The button → `/api/owner/print-bridge/download`.

## M · Test results (this Linux tree)

unit **932 passed** (855 before; +77) · render + degraded **266 passed** (WebKit projects SKIPPED under the supplied Chromium, said so) · typecheck clean · lint clean · jalsa `audit:all` 10/10 · framework `audit:all` 11/11 · `guard:test` 15/15 · `next build` clean · `bridge:build` clean · `bridge:package` clean · CLI smoke (discover / pair without network → exit 4 / run unpaired → exit 2) · **fail-first: 17/17 defects observed failing** (TEST_SUMMARY.md). The ordered gate: G8 (functional) BLOCKED — no database on this runner, as every prior run here.

## N · Windows-specific, physically unvalidated (Gate 7 rows 33–42, KL-7)

UAC elevation via the `.cmd`; `icacls`; `Register-ScheduledTask` as SYSTEM and whether SYSTEM may open a USB queue; PowerShell 5.1 `Add-Type` compiling the `winspool.drv` declarations and `WritePrinter` RAW reaching the RP3160; `[string]$_.PrinterStatus` yielding names on the installed build; the bundled Node 24 running the ESM bundle; `state.json` timing; re-pairing after a reinstall; and everything in KL-6.

## O · Production download — the one remaining deployment step

`ENVIRONMENTS.md` → *Publishing the Windows installer*: build the package with the production origin, upload the zip to an **https** location, set `PRINT_BRIDGE_DOWNLOAD_URL`. Migration `20260923090000` is applied to both projects. Until then the Printers screen says the installer is not published — no fake URL was invented, and a serverless function cannot stream a 35 MB file (Vercel's 4.5 MB response limit), which is why the hosted redirect is the production shape.

## P · Risks

1. `config.json` holds the bearer token in plaintext on the PC (as env mode always did); mitigated by the folder ACL, revocation from Jalsa, and single-restaurant scope. DPAPI would be the next step.
2. `Add-Type` compiles per ticket (~1 s on first use per process; cached after) — acceptable for a kitchen, unmeasured.
3. Status pre-check refuses `Offline` etc.; a driver that misreports would block printing — visible as an owner-readable failure, resolved by Gate 7 evidence.
4. The pair endpoint has no per-IP rate limit (serverless); protection is code entropy + 10-minute life + one live code per restaurant.
5. Re-pairing under the same name is two statements (revoke old, move mappings), not one transaction — a crash between them leaves an old token live for one poll.
6. Design deviation: a fourteenth top-level section (DC-013, owner-authorised).

## Definition of done

| item | |
|---|---|
| Plan / every line traces to the request | done — request file; four decisions answered |
| Canonical patterns · tokens · both themes | done — Combobox/Chip/Sheet/FirstRunState/Pill; colours audit PASS; tokens only; visual look N/A: no database here (stated) |
| Dead weight | done — none added; `printing.md` un-staled |
| Dependencies | done — none added (Node runtime is a build-time download, pinned by hash) |
| Every state | done in code: empty, waiting, connected, not running, unavailable, not configured, expired code, download not published; "looked at": N/A — needs a database |
| Failure paths exercised | done — outage, 401, unreadable discovery, refused queue, expired/used/wrong code, corrupt zip |
| Idempotent writes · tenant scoping | done — conditional spend; upsert on `printer_id`; every read scoped; pair route names no restaurant |
| Permission questions | done — `set.printer` for every new action and the download; no new grant (RBAC matrix unchanged, stated) |
| No secret in client/log/repo | done — token never logged (spec); no-secrets scan (spec) |
| Cases · fail-first · gate | done — 7 spec files, 17/17 fail-first; gate G8 BLOCKED (no DB), named |
| Module doc · registers · changelog | done — printing.md, KL-7, DC-013, ENVIRONMENTS, CHANGELOG |
| Limitations entry | done — KL-7 with Gate 7 rows |
| Business readiness | T1 — usable once the migration is applied and the download published; physical acceptance outstanding |
