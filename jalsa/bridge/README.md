# Jalsa Print Bridge

The small program on the Windows PC a thermal printer is plugged into. It asks Jalsa what is
waiting, takes one ticket at a time, turns it into ESC/POS bytes and hands them to the printer's
Windows queue. **It decides nothing about printing** — which printer, which station, what happens
on failure — all of that is Jalsa's, decided before this program sees the job.

There are two ways to run it. A restaurant uses the first and never sees the second.

---

## 1 · For the restaurant: Printers → Connect Printing Computer

Nobody at the restaurant reads this section; it is what the Printers screen walks them through.

1. In Jalsa, open **Printers** and press **Connect Printing Computer**.
2. **Download for Windows** → `Jalsa-Print-Bridge-Windows.zip`. Open it.
3. Double-click **Install Jalsa Print Bridge**. Windows asks for permission — Yes.
4. When the installer asks, type the **pairing code** the Jalsa screen shows. Once.
5. Back in Jalsa the computer appears, with the printers Windows found on it. **Select** the
   thermal printer, choose its **station**, **Save Printer**, press **Test Print**.

The bridge starts with Windows and restarts itself. There is nothing to run in the morning, no
file to edit, no Node.js to install (the runtime is inside the download), no printer sharing.
**Remove Jalsa Print Bridge.cmd** takes it off the PC again.

What the owner is told when something is wrong, and where it comes from:

| The screen says | Because |
|---|---|
| Jalsa Print Bridge is not installed on this computer. | a pairing code was issued and nothing has connected under that name |
| Jalsa Print Bridge is not running. | the computer's last contact is more than two minutes old |
| This computer is not connected to this Jalsa restaurant. | the bridge's credential was revoked (Disconnect) — shown on the PC and in its log |
| This printer has not been configured for this computer. | the Jalsa printer has no mapping to a computer |
| TVS RP3160 is not available on this computer. | Windows no longer lists that queue, or refused to open it |
| Printer is unavailable. Check that the printer is turned on and connected to this computer. | Windows reports it offline / out of paper / in error, or the spooler did not answer |

The full technical sentence stays in **Print setup → History** and in `logs\bridge.log` on the PC.

### What is on the PC after installing

```
%ProgramData%\Jalsa\PrintBridge\
  app\main.js            the bridge
  app\node\node.exe      Node.js 24 (from nodejs.org, SHA-256 verified at package time)
  app\jalsa.json         which Jalsa server this download belongs to
  config.json            the computer's credential — readable by SYSTEM and Administrators only
  state.json             connected / offline / unpaired, for the installer and for support
  spool\                 tickets staged for the spooler, deleted after each one
  logs\bridge.log        one JSON line per event, rolled at 1 MB
```

Scheduled Task **Jalsa Print Bridge**: `node.exe main.js run`, as SYSTEM, at startup, restarts
every minute if it stops, no time limit. `install.ps1 -RunAsCurrentUser` registers it at the
installing user's logon instead. `install.ps1 -Repair` re-copies files without pairing again.

### Publishing the download (the deployment's job, once per release)

```bash
npm run bridge:package -- --origin https://<the production origin>
# → jalsa/bridge/dist/jalsa-print-bridge-windows.zip  (+ .json manifest with its SHA-256)
```

Upload the zip to an https address and set `PRINT_BRIDGE_DOWNLOAD_URL` in the production
environment. A self-hosted `next start` can instead leave the file in `bridge/dist/` and the
download route streams it. Until one of those is true the Printers screen says the installer is
not published — it never shows a link that leads nowhere. See `docs/registers/ENVIRONMENTS.md`.

---

## 2 · For a developer: environment mode

Everything Gate 5 shipped still works unchanged: `node main.js` with no command reads the
environment variables below. This is what Gate 7 rows 5–8 use and what a laptop uses with the
`file` transport.

| Variable | Required | What it is |
|---|---|---|
| `JALSA_BRIDGE_API` | yes | `https://<your-jalsa-host>/api/bridge` |
| `JALSA_BRIDGE_TOKEN` | yes | A token from **Print setup → Bridges**. Never logged. |
| `JALSA_BRIDGE_LABEL` | yes | What this PC is called. Lands in `claimed_by`. |
| `JALSA_BRIDGE_DESTINATIONS` | yes | `machine_id=destination` pairs, `;` separated |
| `JALSA_BRIDGE_TRANSPORT` | no | `file` (default) · `null` · `windows` (`copy /b` to a **shared** printer) · `windows-queue` (raw to a queue **by name**, no sharing) |
| `JALSA_BRIDGE_SPOOL_DIR` | yes* | Where files are staged. *Not needed for `null`. |
| `JALSA_BRIDGE_POLL_MS` / `_MAX_BACKOFF_MS` / `_BATCH` / `_SPOOL_TIMEOUT_MS` / `_READABLE` | no | As before |

```bash
npm run bridge:build        # bridge/dist/main.js
node bridge/dist/main.js    # environment mode
```

### The paired service, off Windows

```bash
JALSA_BRIDGE_HOME=/tmp/jb JALSA_BRIDGE_TRANSPORT=file JALSA_BRIDGE_DEV_PRINTERS="KOT-DEV" \
  node bridge/dist/main.js pair --code ABCD-EFGH --origin http://localhost:3000
JALSA_BRIDGE_HOME=/tmp/jb JALSA_BRIDGE_TRANSPORT=file JALSA_BRIDGE_DEV_PRINTERS="KOT-DEV" \
  node bridge/dist/main.js run
node bridge/dist/main.js discover
```

`pair` exits 0 (connected), 3 (code refused — ask again), 4 (no network), 2 (usage). `run`
writes `state.json` and `logs/bridge.log` under the home. Off Windows there is no printer list,
so `JALSA_BRIDGE_DEV_PRINTERS` names pretend ones and the `file` transport writes their bytes
under `spool/<name>/`.

### Reading the log

One JSON object per line. `bridge.starting` · `bridge.connected` · `bridge.offline` (Jalsa
unreachable; retried with backoff) · `bridge.unpaired` (401) · `bridge.discovery-failed` ·
`bridge.cycle` (one ticket) · `bridge.error` · `bridge.stopping` / `bridge.stopped`. The token is
never in it.

### What it can and cannot tell you

A successful job means **the Windows spooler accepted the bytes**. The queue transport first asks
Windows whether the printer is offline, out of paper or jammed and refuses in those states; beyond
that, nothing built on a spooler can see paper. Confirming that a TVS RP3160 prints is Gate 7
(`docs/GATE-7-HARDWARE-ACCEPTANCE.md`), and nothing in this directory has run on Windows yet
(KL-7).

### What is deliberately absent

No Wi-Fi printing, no TCP-9100, no Bluetooth, no WebUSB, no cloud print service, no second
encoder, and no way for this program to choose a printer: the mapping is handed down keyed by
machine id, and a job whose machine is not in it fails by name.
