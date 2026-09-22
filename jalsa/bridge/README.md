# Jalsa Print Bridge — Windows runbook

A small Node process that runs on the PC the thermal printer is plugged into. It asks Jalsa what
is waiting, takes one ticket at a time, turns it into ESC/POS bytes and hands those bytes to the
Windows print queue.

**It decides nothing about printing.** Which printer a ticket goes to, which station it is stamped
for, which half of a round it carries and what happens when it fails were all decided by Jalsa
before this process saw the job. The bridge's whole vocabulary is three verbs — `list`, `claim`,
`report` — and none of them can name a printer.

---

## What it can and cannot tell you

A successful job means **the Windows spooler accepted the bytes**. It does not mean paper came
out: Windows queues happily for a printer that is switched off, out of paper, or asleep. Nothing
built on a spooler can promise more, and this one says `accepted by queue` rather than `printed`
so the log does not imply otherwise.

Confirming that a TVS RP3160 actually prints is hardware acceptance (Gate 7), not something any
test in this repository can do.

---

## Prerequisites

| | |
|---|---|
| Windows | 10 or 11, or Server 2019+ |
| Node.js | 20 LTS or newer — `node --version` |
| Printer | Installed in Windows, visible in **Settings → Bluetooth & devices → Printers** |
| Printer driver | The TVS driver, or the **Generic / Text Only** driver |
| Printer sharing | **Required.** See below. |
| Network | Outbound HTTPS to wherever Jalsa is hosted. Nothing inbound. |

No compiler, no native modules, no Python, no administrator rights at run time. The bridge is one
bundled `.js` file and the Node runtime.

### Why the printer must be shared

Raw ESC/POS bytes reach a Windows queue through `copy /b <file> <share>`, which is the documented
way to do it and ships with the operating system. The alternative is a native `winspool.drv`
binding, which means a compiler toolchain on a restaurant's PC, a rebuild on every Node upgrade,
and a binary nobody on the project can read. Sharing a printer is a one-time checkbox.

**To share it:** Printers → *your printer* → Printer properties → **Sharing** → tick *Share this
printer* → give it a short share name with no spaces, e.g. `RP3160`.

Then the destination for that machine is either `RP3160` or `\\localhost\RP3160`.

---

## Install

Copy these to the PC, anywhere (e.g. `C:\jalsa\bridge\`):

```
main.js          the bridge, one bundled file
bridge.cmd       the start script below
```

Build `main.js` from a checkout with:

```bash
npm run bridge:build        # produces jalsa/bridge/dist/main.js
```

---

## Configure

Every setting is an environment variable. Nothing is read from a file, and **no Supabase
credential exists on this machine** — the bridge holds one scoped bearer token and nothing else.
If `SUPABASE_SECRET_KEY` is present in the environment the bridge refuses to start, because its
presence means somebody has misunderstood the deployment.

| Variable | Required | What it is |
|---|---|---|
| `JALSA_BRIDGE_API` | yes | `https://<your-jalsa-host>/api/bridge` |
| `JALSA_BRIDGE_TOKEN` | yes | The bridge token issued by Jalsa. Never logged. |
| `JALSA_BRIDGE_LABEL` | yes | What this PC is called. Appears on the job history. |
| `JALSA_BRIDGE_DESTINATIONS` | yes | `machine_id=queue` pairs, `;` separated |
| `JALSA_BRIDGE_TRANSPORT` | no | `windows` in a restaurant · `file` for development · `null` to exercise failure. Default `file`. |
| `JALSA_BRIDGE_SPOOL_DIR` | yes* | Where `.prn` files are staged. *Not needed for `null`. |
| `JALSA_BRIDGE_POLL_MS` | no | Idle poll interval, default 3000, floor 250 |
| `JALSA_BRIDGE_MAX_BACKOFF_MS` | no | Ceiling an idle queue backs off to, default 60000 |
| `JALSA_BRIDGE_BATCH` | no | Jobs to ask for per poll, default 20 |
| `JALSA_BRIDGE_SPOOL_TIMEOUT_MS` | no | How long `copy /b` may take, default 30000 |
| `JALSA_BRIDGE_READABLE` | no | `file` transport only: also write a readable `.txt` |

`JALSA_BRIDGE_DESTINATIONS` maps Jalsa's `printer.machine_id` to a Windows queue name:

```
KOT-TANDOOR=RP3160;KOT-VEG-01=\\localhost\RP3160-VEG
```

The machine ids are the ones on the owner's **Print Setup** screen. A bridge only ever sees jobs
for the machines it names here, and a job for any other machine is **failed**, never re-pointed at
one of these.

---

## Start it

`C:\jalsa\bridge\bridge.cmd`:

```bat
@echo off
set JALSA_BRIDGE_API=https://your-jalsa-host/api/bridge
set JALSA_BRIDGE_TOKEN=paste-the-issued-token-here
set JALSA_BRIDGE_LABEL=Kitchen PC
set JALSA_BRIDGE_DESTINATIONS=KOT-TANDOOR=RP3160
set JALSA_BRIDGE_TRANSPORT=windows
set JALSA_BRIDGE_SPOOL_DIR=C:\jalsa\spool

node "C:\jalsa\bridge\main.js"
```

**The exact command is:**

```bat
node C:\jalsa\bridge\main.js
```

Run `bridge.cmd` from a console first and watch the log. Once it is behaving, register it as a
service (Task Scheduler *At startup*, or NSSM) so it comes back after a reboot.

---

## Reading the log

One line of JSON per event, so a line survives being pasted into a message.

```json
{"at":"2026-09-22T12:00:00.000Z","event":"bridge.starting","label":"Kitchen PC","transport":"windows","machines":["KOT-TANDOOR"],"token":"withheld"}
{"at":"2026-09-22T12:00:03.100Z","event":"bridge.cycle","line":"cycle=0 offered=1 eligible=1 job=… encoded=true transport=sent reported=printed …"}
```

| Event | Meaning |
|---|---|
| `bridge.starting` | Configuration accepted. Names the transport and the machines served. |
| `bridge.refused` | Startup rejected, one line per problem. Exit code **2**. |
| `bridge.cycle` | One poll. Says whether a job was claimed, encoded, sent and reported. |
| `bridge.stopping` | A signal arrived. The current ticket is finished first. |
| `bridge.stopped` | Clean exit, code 0. |

Stop it with **Ctrl+C**, `SIGTERM`, or `Ctrl+Break`. It finishes the ticket in flight before
exiting — a bridge killed between its transport call and its report leaves a job stuck in
`processing` until the server's sweeper expires it.

---

## When something is wrong

| Symptom | Cause |
|---|---|
| Exit 2 at startup, `bridge.refused` | A variable is missing or wrong. Each problem is named. |
| `this host is linux` / `darwin` | `JALSA_BRIDGE_TRANSPORT=windows` on a machine that is not Windows. |
| `not a printer share or a UNC path` | The queue name has a character that has no business in one. |
| `exit 1: The network name cannot be found.` | The printer is not shared, or the share name is wrong. |
| `did not answer within 30000 ms` | The spooler is wedged. The job is failed; nothing can be said about whether it printed. |
| `This bridge does not serve …` | A job arrived for a machine not in `JALSA_BRIDGE_DESTINATIONS`. It is failed, never re-pointed. |
| Nothing prints, no errors | Check the printer is shared and the share name matches. `copy /b file \\localhost\RP3160` by hand to confirm. |

Every failure ends up on the job in Jalsa, in the words above, on the owner's print history — the
bridge is never the only place a problem is recorded.

---

## What is deliberately absent

No Wi-Fi printing, no LAN/TCP-9100 transport, no Bluetooth, no WebUSB, no Web Serial, no cloud
print service, and no second ESC/POS encoder. A future wired-LAN transport is a new class behind
the same `PrintTransport` interface — bytes in, one verdict out, still unable to choose a printer.
