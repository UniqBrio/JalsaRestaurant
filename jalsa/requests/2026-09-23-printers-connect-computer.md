# Request — Printers: connect the printing computer (23-Sep-2026)

**TYPE** feature · **RUN MODE** confirm (four decisions asked; answers below are binding) · **SCALE** full

## FIELDS
- **Objective** — the restaurant owner sets up the thermal printer from Dashboard → Printers without
  tokens, environment variables, Windows queue names, Node commands or GitHub.
- **Journey (verbatim)** — Printers → Connect Printing Computer → Download for Windows → Install →
  Pair → Discover printer → Select printer → Assign station → Test Print → Ready.
- **Boundary (verbatim, must not weaken)** — Jalsa decides what/which/routing/retry/redirect and owns
  printer identity; the bridge authenticates, discovers, lists/claims, encodes, transports, reports;
  the transport only carries bytes. A bridge with no mapping fails clearly; it never reroutes.
- **Reuse** — print_jobs, bridge tokens (hashed, revocable), claim/report, ESC/POS, transports, Test Print.
- **Not fabricated** — no fake download URL; production hosting documented if not configured.
- **Delivery** — commit only after complete; do not push; no PR.

## DECISIONS (asked, answered by the requester)
| Question | Answer |
|---|---|
| Where the Printers entry lives | Top-level **Printers** section (DC-013); Settings → Printers & machines stays |
| Node runtime on the PC | Bundle a portable `node.exe` in the download |
| Pairing direction | Code shown in Jalsa, typed into the installer once |
| Scheduled Task identity | SYSTEM at startup (`-RunAsCurrentUser` as the fallback) |

## VISIBLE STRINGS (from the request, adopted verbatim)
Connect your printing computer · Install Jalsa Print Bridge on the Windows computer connected to your
thermal printer. · Connect Printing Computer · Download for Windows · Test Print · Sending test print… ·
Test print completed · Printer is unavailable. Check that the printer is turned on and connected to this
computer. · Jalsa Print Bridge is not installed on this computer. · Jalsa Print Bridge is not running. ·
This computer is not connected to this Jalsa restaurant. · {printer} is not available on this computer. ·
This printer has not been configured for this computer.

## USAGE PROFILE
Once per computer, then never (setup); Test Print occasionally; the connected view read at a glance.
Automated: discovery, the mapping hand-down, restart-on-failure, the download's origin.
