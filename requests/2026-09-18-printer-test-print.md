# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: `Every printer card gets its own Test print action that targets that machine alone, through the real print path, and tells the owner exactly what did and did not happen.`
- MUST-HAVE:
  - `A Test print action on EVERY printer card, carrying that printer's id explicitly.`
  - `It must not go through order/KOT routing, and must never reach another machine.`
  - `It must create no order, no bill, no KOT, no customer data, and must not touch reports, revenue, routing, stations, templates or printer configuration.`
  - `The ticket carries the restaurant name from Settings → Restaurant details — never a hardcoded one — plus the printer, station, paper width, connection and a timestamp, laid out at that printer's own width.`
  - `Per-printer busy state; testing one printer never blocks another.`
  - `HONEST FEEDBACK. No "successful" unless something actually confirmed it.`
  - `If the architecture cannot physically send a print job, say so plainly rather than simulate one.`
- EXPLICITLY OUT:
  - `A second printer communication system. New dependencies. E2E.`
  - `Broadening any permission. Redesigning the printer screen.`
  - `Changing routing, KOT routing, physical printer configuration, or the existing Configure action.`
  - `Framework-sync and root framework files.`
- WHY: `Four machines all read "Not answering" and the owner has no way to tell a broken printer from a wrong setting without walking to the kitchen.`
- CORRECTION ROUND: `1`

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `Owner → Settings → Printers & machines → Printers only. New states: idle, sending, and the honest result. The existing Answering / Not answering / Switched off pill is untouched.`
- STRINGS ADDED OR ALTERED: `"Test print", the sending state, and one standing sentence about what a queued job does and does not mean. Everything already on the card is frozen.`
- PERMISSIONS: `no new permission. `set.printer` already gates Configure and Add a printer on this tab, and is the same authority.`
- USAGE: `When a machine is installed, moved, or stops working mid-service. Rare, and urgent when it happens.`
- RUN MODE: `auto`
- SCALE: `scoped`

## A1 — WHAT THE INVESTIGATION FOUND, AND IT DECIDES THE WHOLE BUILD

**Nothing in this application can talk to a printer.** Searched for every mechanism that could:
ESC/POS, a port-9100 socket, IPP, WebUSB, `navigator.usb`, a bridge, an agent, any outbound
`fetch` on the print path. There is none. The only real printing anywhere is `window.print()` on
the HR documents and the bill sheet, and that file says in its own comment that it *"does not go
to the thermal machines"*.

`queuePrint()` — the function a real round calls — does not send anything either. It reads the
printer rows, resolves routing, and then:

```ts
const reachable = chosen && chosen.online && chosen.enabled ? chosen : null;
…
status: reachable ? 'printed' : 'failed',
```

`printer.online` is a **stored boolean column defaulting to false**, not a probe. So a job is
recorded as `printed` because a column says the machine is up — and all four machines in the
screenshot read "Not answering" because that column is still at its default. Its own comment is
candid about the rest: *"the print worker that fans a job out to machines does not exist yet."*

### The documentation already describes this feature. The code never had it.

`PrintSetupSection.tsx:56-60`, in the file header:

> *"The TVS machines remain an unvalidated dependency. **"Check connection" records an attempt and
> its result**; it does not open a socket, because there is nothing in this deployment that can.
> **Test print queues a job exactly as a round does and shows what came back.** Both say so where
> they are used rather than in a note somebody has to go and find."*

Neither action exists. A grep for "Check connection" and for any test-print handler finds only
that paragraph. This is the third documentation-ahead-of-code divergence found in this repository
today, after the `advanceKot` stamp comment and the `restaurant.name` reads.

### What that makes buildable, honestly

| The request asked for | What is actually possible |
|---|---|
| Send a test job to that printer | Write ONE `print_job` row against that `printer_id`. `bill_id` and `kot_id` are **nullable**, so no fake bill or KOT is needed — the schema already allows a job that belongs to neither |
| Use the existing pipeline | `print_job` IS the pipeline. A test job enters it exactly as a round's job does, and appears in the existing History tab |
| Respect the connection type | Recorded on the ticket and in the job. It cannot be *exercised*, because nothing opens a connection of any type |
| Refresh printer status afterwards | **Not possible.** There is no health check to re-run; `online` is a stored flag an owner edits in Configure |
| Don't claim success without evidence | The strongest true statement is **"queued"**. Not "sent", not "printed" |

**Consequence, stated up front because it is the deliverable's honesty:** this will queue a real
job against the right machine and show it in History, and **no paper will come out**, because no
component exists that could make paper come out. The screen must say so where the button is.

## STANDING INSTRUCTIONS (do not edit)
- Track A runs its four gates. Auto mode logs each checkpoint rather than waiting.
- Stated fields are binding. EXPLICITLY OUT seeds the "deliberately not building" list.
- If VISUAL?=yes, the design pass covers states, both themes in semantic tokens, the string
  table and the permission answer.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.
