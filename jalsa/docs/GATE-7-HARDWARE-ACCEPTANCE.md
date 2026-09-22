# Gate 7 — physical acceptance on the TVS RP3160

**Status: HARDWARE-PENDING. Nothing in this document has been run.**

Every gate before this one is software, and all of them are green. This one cannot be. It is the
only gate that requires a printer, and there is no printer. This file is the procedure, written
while the software is fresh, so that whoever has the machine in front of them runs a checklist
rather than inventing one.

> **The rule this file exists to protect.** A green software suite is not evidence that paper came
> out. The Windows transport reports that the *spooler accepted* the bytes — Windows queues
> happily for a printer that is switched off — and no test in this repository can see further than
> that. Do not record any row below as passed until somebody has looked at paper.

---

## Before you start

| | |
|---|---|
| Hardware | TVS RP3160 Gold, **USB**, 80 mm thermal roll |
| Host | Windows 10/11, Node 20+ |
| Setup | `bridge/README.md`, in full, including sharing the printer |
| Jalsa | Reachable from the PC; a bridge token issued from **Print Setup → Bridges** |

Record the result of each row as **PASS**, **FAIL** or **BLOCKED** with a note. A row nobody ran
is BLOCKED, never blank and never assumed — that is the same three-valued rule the gate runner
uses, and the reason it has no fourth value for "probably fine".

---

## A · The machine exists

| # | Check | How | Pass looks like |
|---|---|---|---|
| 1 | Windows detects the printer | Settings → Bluetooth & devices → Printers | The RP3160 is listed, not "Unspecified" |
| 2 | The spooler has a queue for it | `Get-Printer` in PowerShell | The queue appears with a driver bound |
| 3 | It is shared | Printer properties → Sharing | A share name with no spaces, e.g. `RP3160` |
| 4 | Raw bytes reach it at all | `echo hello > t.txt` then `copy /b t.txt \\localhost\RP3160` | `1 file(s) copied.` **and** paper moves |

**If 4 fails, stop.** Everything below depends on it, and no amount of application configuration
will fix a queue that does not accept raw data.

---

## B · The bridge

| # | Check | How | Pass looks like |
|---|---|---|---|
| 5 | The bridge starts | `node C:\jalsa\bridge\main.js` | `bridge.starting` names the transport `windows` and the machines served |
| 6 | A bad configuration is refused | Unset `JALSA_BRIDGE_TOKEN`, start again | `bridge.refused`, exit code **2**, the variable named |
| 7 | It authenticates | Watch the first poll | No 401 in the log; **Print Setup → Bridges** shows it as *Connected* |
| 8 | A revoked token stops it | Revoke from the console, restart the bridge | 401; the job stays queued; nothing prints |

---

## C · Test print

| # | Check | How | Pass looks like |
|---|---|---|---|
| 9 | Test Print prints | **Print Setup → Printers → Test print** | Paper, within one poll interval |
| 10 | It says what it is | Read the paper | `TEST PRINT`, *"Nothing here is an order"*, the machine id |
| 11 | 80 mm width is right | The width-check line on the test ticket | The line ends on the paper, not past it |
| 12 | The station prints | Read the paper | A bold `STATION` line naming the machine's station |
| 13 | Both food headings print | Read the paper | `VEG` and `NON-VEG` headings both appear |
| 14 | The job reports back | **Print Setup → History** | The job reads *printed*, with the bridge's label |

---

## D · A real round

| # | Check | How | Pass looks like |
|---|---|---|---|
| 15 | A KOT prints | Place a round from a guest phone | The kitchen ticket comes out at the routed machine |
| 16 | Bold and big render | Read the paper | The KOT number is double-size; headings are bold |
| 17 | Feed and cut | Watch the end of the ticket | It feeds clear of the head; it cuts if the machine cuts |
| 18 | **The codepage is what we declared** | Print a ticket with `-`, `.`, digits and capitals | Every character is the one that was sent. **See the note below.** |
| 19 | An unsupported character FAILS | Put `₹` in a round note and print | The job **fails** with a message naming the codepoint. **Never a `?` on paper.** |
| 20 | The station on a FALLBACK ticket | Switch the tandoor machine off in Print Setup, place a tandoor round | It prints at the main kitchen machine and says `STATION  Tandoor` |
| 21 | A split round | Turn the veg/non-veg split on, place a mixed round | **Two** tickets, disjoint, together the whole round — neither carries the other's dishes |
| 22 | Redirect | Fail a ticket, then **Print elsewhere** to another machine | The chosen machine prints the ORIGINAL round's dishes, not its own |
| 23 | Retry | Retry a failed ticket | The SAME machine, the same content |
| 24 | Reprint | Reprint a round | `*** REPRINT ***` at the top, at full size |

### Note on row 18 — the codepage is declared, not verified

`escpos.ts` emits `ESC t 0` (CP437) and **no device has ever confirmed it**. The encoder
deliberately sends no byte above `0x7F`: ASCII passes through and anything else must be named in
the charset map or the job fails loudly. So row 18 is really asking *"does the machine honour the
table we asked for, for the characters we actually send?"* If it does not, the fix is the charset
map, not the encoder, and a verified CP437 upper half becomes possible work — **after** hardware
says so, never before.

---

## E · Failure, which is the half that matters

| # | Check | How | Pass looks like |
|---|---|---|---|
| 25 | Printer switched off | Turn it off, place a round | The job **fails** with the spooler's own words on the history screen |
| 26 | USB unplugged mid-job | Unplug during a print | A failure, not a hang; the loop keeps polling |
| 27 | Paper out | Run the roll out | A failure or a queued job — **not** a job marked printed |
| 28 | Bridge killed mid-ticket | Ctrl+C during a job | It finishes the ticket first (`bridge.stopping` then `bridge.stopped`) |
| 29 | Bridge killed hard | End the process from Task Manager | The job stays `processing`; the server's sweeper later expires it to **failed**, never to queued |
| 30 | No duplicate on restart | Restart the bridge after 29 | The round does **not** print a second time |
| 31 | Two bridges, one job | Run two bridges on the same machine id | Exactly one ticket. Not two. |
| 32 | A job for another machine | Point a bridge at machine A, queue for B | Bridge A never claims it; it is **not** re-pointed |

**Row 27 is the one to be strict about.** A job marked printed with no paper is the exact defect
Phase 1 was spent removing, and it would arrive here wearing a different hat.

---

## What "Gate 7 passed" means

All 32 rows PASS, or a row is FAIL/BLOCKED with a written reason and a decision about it. Then,
and only then:

- append the run to `jalsa/TEST_SUMMARY.md` with the date, the firmware/driver versions and who ran it;
- resolve **KL-6** in `docs/registers/KNOWN_LIMITATIONS.md`;
- move **DC-012** (the station line) from AUTHORISED to VERIFIED — it becomes verified by somebody
  looking at paper, which is the only thing that verifies it.

Until that happens, every gate report must say Gate 7 is **hardware-pending**, and no document in
this repository may describe the printing system as validated end to end.
