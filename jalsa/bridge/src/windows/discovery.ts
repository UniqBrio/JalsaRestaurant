import type { ScriptRunner } from './powershell';

/**
 * discovery — which printers Windows has, so the owner picks one instead of typing its name.
 *
 * WHAT THIS REPLACES
 *   `JALSA_BRIDGE_DESTINATIONS=KOT-TANDOOR=RP3160` — a restaurant owner typing the exact queue name
 *   Windows invented during a driver install. Now the bridge asks `Get-Printer`, reports the list
 *   to Jalsa, and the owner chooses from it on a screen.
 *
 * WHAT IT DOES NOT DO
 *   Choose. Discovery reports; it never maps, never selects a "best" printer and never falls back
 *   to one. The owner chooses, Jalsa stores the choice, and the bridge only ever prints to the
 *   queue Jalsa hands back for a job's own machine.
 *
 * THE PARSER IS THE TESTABLE HALF
 *   `ConvertTo-Json` has three shapes for one question — an object for one printer, an array for
 *   several, and NOTHING AT ALL for none — and `PrinterStatus` arrives as a name or a number
 *   depending on the PowerShell build. All of it is handled here, against fixtures, off Windows.
 *   A parse that recognises nothing is an error, never an empty success: a bridge that reported
 *   "no printers" because it could not read the answer would look exactly like a PC with none.
 */

export interface DiscoveredPrinter {
  queueName: string;
  driverName: string;
  portName: string;
  status: 'ready' | 'offline' | 'error' | 'unknown';
  isVirtual: boolean;
}

/**
 * The script. `[string]` on the status asks for the enum's NAME; the parser still accepts the
 * number in case a build hands that over instead. `@()` + `-InputObject` forces an array, so one
 * printer is not serialised as a bare object — belt and braces, the parser handles both.
 */
export const DISCOVER_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$list = @(Get-Printer | ForEach-Object {',
  '  [pscustomobject]@{',
  '    Name = [string]$_.Name',
  '    DriverName = [string]$_.DriverName',
  '    PortName = [string]$_.PortName',
  '    Status = [string]$_.PrinterStatus',
  '  }',
  '})',
  'ConvertTo-Json -InputObject $list -Compress',
].join('\n');

/** `MSFT_Printer.PrinterStatus`, by number, for builds that serialise the value. */
const STATUS_BY_NUMBER: Record<number, string> = {
  0: 'Normal', 1: 'Paused', 2: 'Error', 3: 'PendingDeletion', 4: 'PaperJam', 5: 'PaperOut',
  6: 'ManualFeed', 7: 'PaperProblem', 8: 'Offline', 9: 'IOActive', 10: 'Busy', 11: 'Printing',
  12: 'OutputBinFull', 13: 'NotAvailable', 14: 'Waiting', 15: 'Processing', 16: 'Initialization',
  17: 'WarmingUp', 18: 'TonerLow', 19: 'NoToner', 20: 'PagePunt', 21: 'UserIntervention',
  22: 'OutOfMemory', 23: 'DoorOpen', 24: 'ServerUnknown', 25: 'PowerSave',
};

const OFFLINE = new Set(['offline', 'notavailable', 'paused', 'serverunknown']);
const ERROR = new Set(['error', 'paperjam', 'paperout', 'paperproblem', 'dooropen', 'userintervention', 'outofmemory', 'notoner', 'pendingdeletion']);

/** Windows' word (or number) for a printer's state, reduced to the four Jalsa shows. */
export function interpretStatus(raw: unknown): DiscoveredPrinter['status'] {
  const name = typeof raw === 'number' ? (STATUS_BY_NUMBER[raw] ?? '') : String(raw ?? '');
  const key = /^\d+$/.test(name) ? (STATUS_BY_NUMBER[Number(name)] ?? '').toLowerCase() : name.toLowerCase().replace(/[\s_]/g, '');
  if (!key) return 'unknown';
  if (OFFLINE.has(key)) return 'offline';
  if (ERROR.has(key)) return 'error';
  return 'ready';
}

/** Software printers a kitchen will never want first. Listed last, never hidden. */
export function isVirtualPrinter(p: { queueName: string; driverName: string; portName: string }): boolean {
  const port = p.portName.toUpperCase();
  if (['PORTPROMPT:', 'FILE:', 'NUL:', 'SHRFAX:'].includes(port)) return true;
  return /microsoft print to pdf|microsoft xps|onenote|\bfax\b/i.test(`${p.queueName} ${p.driverName}`);
}

export type DiscoveryResult = { ok: true; printers: DiscoveredPrinter[] } | { ok: false; error: string };

export function parseDiscovery(stdout: string): DiscoveryResult {
  const text = stdout.trim();
  // `ConvertTo-Json` of an empty array prints `[]`; an older build prints nothing at all.
  if (text === '' || text === '[]') return { ok: true, printers: [] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Windows returned a printer list this bridge could not read.' };
  }
  const rows = Array.isArray(json) ? json : [json];
  const printers: DiscoveredPrinter[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const queueName = typeof o.Name === 'string' ? o.Name.trim() : '';
    if (!queueName) continue;
    const driverName = typeof o.DriverName === 'string' ? o.DriverName : '';
    const portName = typeof o.PortName === 'string' ? o.PortName : '';
    printers.push({
      queueName,
      driverName,
      portName,
      status: interpretStatus(o.Status),
      isVirtual: isVirtualPrinter({ queueName, driverName, portName }),
    });
  }
  // Binding rule 5: rows arrived and none of them was a printer — that is a parse failure.
  if (printers.length === 0) return { ok: false, error: 'Windows returned a printer list with no printer names in it.' };

  // Real printers first, USB before network, then by name — the order the owner reads them in.
  const rank = (p: DiscoveredPrinter): number => (p.isVirtual ? 2 : p.portName.toUpperCase().startsWith('USB') ? 0 : 1);
  printers.sort((a, b) => rank(a) - rank(b) || a.queueName.localeCompare(b.queueName));
  return { ok: true, printers };
}

export type PrinterDiscovery = () => Promise<DiscoveryResult>;

/** Discovery on this Windows PC, through the injected runner. */
export const windowsDiscovery =
  (run: ScriptRunner, timeoutMs = 20_000): PrinterDiscovery =>
  async () => {
    const result = await run({ script: DISCOVER_SCRIPT, env: {}, timeoutMs });
    if (result.timedOut) return { ok: false, error: `Windows did not list its printers within ${timeoutMs} ms.` };
    if (result.code !== 0) {
      const said = (result.stderr || result.stdout).trim().split('\n')[0] ?? '';
      return { ok: false, error: `Windows could not list its printers (exit ${result.code ?? 'killed'})${said ? `: ${said}` : '.'}` };
    }
    return parseDiscovery(result.stdout);
  };
