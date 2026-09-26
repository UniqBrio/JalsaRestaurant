# Printing — the module document

Written in the change that built it (19-Sep-2026, Phase 1); Phase 2 (21–22-Sep) and the
customer setup (23-Sep) are appended at the end rather than rewritten in — the Phase 1 sections
are still exactly what the **application** decides. Where a Phase 1 sentence says "does not
exist yet", the section **The bridge, as built** below says what now does.

---

## The one rule

> **A print job knows the exact physical printer it was assigned to, and that assignment never
> changes.**

Everything below is either that rule or a consequence of it.

---

## What each layer decides

| | Decides | Never decides |
|---|---|---|
| **Jalsa** (this repo) | WHAT prints · WHERE it is meant for (station) · WHICH machine (`printer_id`) · when a ticket is a reprint | how bytes reach a device |
| **Print Bridge** (`jalsa/bridge`, built) | how to hand a job to a local device, and what came back | which machine a ticket belongs to |
| **Transport** (`bridge/src/transport`) | bytes to one named destination | anything else — no list, no fallback, no order data |

A bridge that re-derives routing is a second implementation of the restaurant's rules, sitting on
one laptop, and the day it disagrees with this one is the day a station stops getting tickets for
a reason nobody can see from the console.

---

## The job contract

`print_job`, after `20260919090000_jalsa_print_job_assignment`:

| Column | What it is |
|---|---|
| `id` | the job |
| `kot_id` / `bill_id` | what is being printed |
| `kind` | `KOT` or `Invoice` |
| `printer_id` | **the physical machine. Immutable — enforced by trigger.** Null only when none could be assigned |
| `printer_name`, `station` | snapshots taken at assignment. Never re-joined |
| `routing_rule` | `routed` · `fallback` · `unrouted` · `none` · `chosen` |
| `status` | `queued` · `printed` · `failed` |
| `attempts`, `last_attempt_at` | how many times, and when last |
| `last_error` | why, when the decision was not the obvious one |
| `is_reprint` | the paper must carry `*** REPRINT ***` |
| `redirected_from_job_id` | this job replaces that one, because a person said so |
| `created_at`, `completed_at`, `requested_by` | the trail |

**Why the snapshots.** A print job is a record of a decision taken at a moment. Renaming a machine
at nine o'clock must not rewrite where the eight o'clock ticket went — that record is what a
kitchen argues over when a station insists it never got the round.

`kot_item.menu_category_name` is the same idea one table down: it is what a **reprint** routes on,
so a category renamed in between cannot send the reprint to a different station than the original.

---

## Status, and what each word is allowed to mean

Printer availability and print-job result are **different facts on different clocks**. They were
conflated — `reachable = printer.online && printer.enabled` decided a job's status — which meant
"printed" asserted that paper had moved on the evidence of a boolean on another table.

| Word | Means | Written by |
|---|---|---|
| `queued` | assigned to a machine, not yet delivered | Jalsa, on creation and on retry |
| `failed` | **Phase 1:** nothing could be assigned. **Phase 2:** the bridge reported a failure | Jalsa / the bridge |
| `printed` | a device acknowledged it | **Phase 2 only. Nothing in this repository writes it.** |

So in this build every assigned job settles at `queued` and stays there. That is not a gap being
hidden; it is the honest description of an application with no transport, and it is asserted by a
rung (`print-assignment.unit.spec.ts`) that fails if any print-path function becomes able to write
`printed` in any expression.

`printer.online` / `printer.last_seen_at` remain, are shown on the screens, and are **not read by
routing**. A machine that is merely quiet still gets its own tickets, because the assignment
outlives the fault and a retry can reach it later.

`kot.print_status` is a pessimistic aggregate over a round's live jobs — failed if any failed,
printed only when every one has. A round spanning two stations is two jobs and one badge.

---

## Routing

`src/lib/print-routing.ts`. Category → station → printer, exactly as the flowchart states it.

- Match is on **menu category name**, case- and space-insensitive.
- `enabled: false` (the owner took a machine out of use) → **fallback** to the main machine, with
  the ticket still stamped for the station it was meant for.
- `online: false` → **no effect**. See above.
- No machine claims the category → **unrouted**, to the main machine.
- No enabled machine of that purpose at all → **none**, and the job is created `failed`.
- The **main machine** is the enabled one claiming no category of its own.

**Determinism.** Every selection runs over the machines sorted by `machine_id`, which is unique per
restaurant. Queries on the order path order by it too, so the owner's Routing screen and the code
that actually routes can no longer disagree.

### A recorded ambiguity

Nothing in the design set says what **two machines claiming one category** means — primary and
backup, the same ticket on both, or alternating. The Routing screen avoids creating the state;
neither the schema nor `upsertPrinter` forbids it.

Until the product decides, the safe reading is *one ticket, one machine, the same machine every
time*: the lowest `machine_id` takes it, and the other claimant is **named in the job's reason**
rather than silently absorbed. **Duplicate printing has not been invented here.** If the answer
turns out to be primary/backup, this is where a priority column goes.

---

## Retry · Reprint · Print elsewhere

Three different acts. They were two, and one button silently switched between them.

| | When | Printer | Row | Paper |
|---|---|---|---|---|
| **Retry** | the ticket never came out | **the one already assigned** — never re-routed | same row, `attempts + 1` | unmarked |
| **Reprint** | it did come out, and another copy is wanted | routed afresh from the round's own items | new rows | `*** REPRINT ***` |
| **Print elsewhere** | an operator chooses a different machine | **the one the operator names** | new row, `redirected_from_job_id` set | marked if the original printed |

`retryPrintJob` does not import routing, does not read the `printer` table, and does not put
`printer_id` in its patch. The database enforces the same rule independently: the immutability
trigger rejects any update that changes it.

There is **no automatic fallback after assignment**. A ticket reaches a second machine only
because a person said so, because a redirect nobody asked for is indistinguishable, from the
kitchen, from routing that works.

---

## Printer profile — the paper contract

The ticket is a **character grid**, not a picture (`src/lib/print-template.ts`).

| | 80 mm | 58 mm |
|---|---|---|
| Roll | 80 mm | 58 mm |
| Target usable content width | **72 mm** | — |
| Total horizontal margin | **8 mm** (4 left, 4 right) | — |

**72 mm is not a character count and not a dot count.** The conversion from millimetres to the
RP3160's dots, and from dots to characters at each font size, is a property of the device and its
driver, and it belongs to Phase 2. `PAPER` in `print-template.ts` holds the character columns the
layout is validated against today; Phase 2 reconciles those with the device's real dot width and
either confirms them or changes them in one place.

What Phase 1 fixes is the *separation*: business routing (this module) knows nothing about dots,
and the transport will know nothing about categories.

---

## The Phase 2 bridge contract

> **Not built. Nothing in this repository opens a socket, and no code here should be read as
> though something does.**

Intended shape:

```
Jalsa  →  Supabase (print_job)  →  Jalsa Local Print Bridge  →  Windows  →  USB  →  TVS RP3160 Gold
```

**What the bridge reads.** Jobs for its restaurant with `status = 'queued'`, joined to `printer`
for `connection`, `address`, `port`. `print_job_open_idx` on `(restaurant_id, status)` already
exists for exactly this query and has had no consumer since it was created.

**What the bridge needs and already has on the row:** the machine (`printer_id`), the station to
stamp (`station`), whether the paper must be marked (`is_reprint`), and what to print
(`kot_id` / `bill_id`, rendered through `print-template.ts`, which is pure and runs identically on
either side).

**What the bridge must never do:** choose a printer, re-run routing, read `menu_category`, or
write `printer_id`. The trigger will reject the last one.

**What it writes back** — the acknowledgement contract, to be added in Phase 2:

1. **Claim** a job so two bridges cannot print it twice: `queued → processing`, with a
   `claimed_by` / `claimed_at`. Needs a new enum value and a claim that is atomic.
2. **Report** the outcome: `processing → printed` with `completed_at`, or `→ failed` with
   `last_error` and `attempts + 1`. **`printed` means the device acknowledged.** It must never
   mean "we sent bytes and nothing threw".
3. **Heartbeat** the machine: `printer.online` and `printer.last_seen_at` — the first code that
   will ever write either. That is also what makes the "Check connection" the design draws into
   something with something to check.

Only step 2 may write `printed`, and only from a device acknowledgement. Every rule above exists
so that when it does, the word is worth something.


---

## The bridge, as built (Phase 2, Gates 1–6, 21–22-Sep-2026)

Everything the Phase 2 contract above asked for exists, with two corrections to it:

- **Claim** — `queued → processing` by one conditional update (`claimPrintJob`), with
  `claimed_by`/`claimed_at`. A stale claim is expired by a server-side sweeper to **`failed`**,
  never back to `queued` (a re-queue could print a round twice).
- **Report** — `printed` or `failed`, on a job this bridge holds. `printed` means **the spooler
  accepted the bytes** — not that paper came out. No transport built on a spooler can say more.
- **No heartbeat to `printer.online`.** The bridge's own `last_seen_at` on `bridge_token` is
  the liveness fact; `printer.online` stays what it was.

The bridge's vocabulary is `list · claim · report`, plus `sync` (below). It composes nothing:
the server renders `TicketLine[]` on claim (`bridge-payload.ts`) and the bridge encodes with the
same `escpos.ts` the golden-byte tests pin. `bridge/README.md` is the runbook.

## The customer setup (23-Sep-2026)

> Step-by-step for the person at the computer: [`docs/PRINT-BRIDGE-WINDOWS-INSTALL.md`](../PRINT-BRIDGE-WINDOWS-INSTALL.md)
> (download, extract, Run as administrator, pairing code, select / change / stop using a printer,
> delete, troubleshooting, uninstall).

> The owner sets up a **printer**, not a bridge. Dashboard → **Printers** → Connect Printing
> Computer → Download for Windows → Install → type the pairing code once → the computer's printers
> appear → Select → Station → Save → Test Print.

| Piece | Where | What it decides |
|---|---|---|
| Pairing code | `bridge_pairing_code`, `bridge-pairing-code.ts`, `POST /api/bridge/pair` | 8 chars from a 31-symbol alphabet, 10 min, **single-use by one conditional update**, hashed. Redeeming creates an ordinary `bridge_token` (`source = 'paired'`) whose `restaurant_id` comes from the code's own row — the request cannot name one. |
| Discovery | `bridge/src/windows/discovery.ts` (`Get-Printer`), `bridge_discovered_printer` | What Windows shows the PC. Reported on every `sync`; a snapshot, never chosen from. |
| Mapping | `bridge_printer` (`bridge_token_id`, `printer_id`, `queue_name`), `savePrinterMapping` | The owner's choice. The queue must be one that computer reported. One printer → one computer. `printer` keeps its identity, station and routes. |
| `sync` | fourth bridge verb, `syncBridge` | Discovery in, mapping out. Touches no job. A **paired** token's `list` and `claim` are intersected with its mapping **server-side**. |
| Transport | `windows-queue` (`WindowsSpoolerTransport` + `windows-queue.ts`) | RAW bytes to a queue **by name** through `winspool.drv`, declared in C# and compiled by PowerShell's `Add-Type`. No printer sharing. Queue name travels as an environment variable, never on a command line. |
| Service | `bridge/src/service.ts`, `cli.ts` | `node main.js run`: sync every 30 s (every poll while unmapped), `runCycle` unchanged, outages logged and retried, a 401 becomes "not connected to this restaurant". Config in `%ProgramData%\Jalsa\PrintBridge\config.json`, log in `logs\bridge.log`. |
| Installer | `bridge/windows/install.ps1` + `.cmd` | ProgramData, one prompt (the code), Scheduled Task as SYSTEM at startup with restart-on-failure, waits for `state.json` to say connected. |
| Package | `npm run bridge:package -- --origin <origin>` → `bridge/dist/jalsa-print-bridge-windows.zip` | bridge + pinned Node 24 `node.exe` (SHA-256 verified from nodejs.org) + installer + `jalsa.json` (the origin, so no URL is ever typed). |
| Download | `GET /api/owner/print-bridge/download`, `PRINT_BRIDGE_DOWNLOAD_URL` | Redirects to the published artifact, streams the local one, or says it is not published. Never a fabricated link. |
| Owner's words | `src/lib/print-computer.ts` | not installed · not running · not connected · not configured for this computer · not available on this computer · unavailable (check it is on) · Sending test print… · Test print completed. Raw `last_error` stays in History. |

**What did not move.** `print_job`, its immutable `printer_id`, routing, retry, reprint, redirect,
`queuePrint`, `testPrint` (still an ordinary job), the three original verbs, the environment-
variable bridge and the `windows` (`copy /b`) transport. Environment mode is what Gate 7 rows
5–8 still use; the paired service is rows 33–42.

**Unvalidated:** KL-6 (paper) and KL-7 (Windows runtime). The unit tier exercises everything with
an injectable boundary; nothing here has run on Windows.
