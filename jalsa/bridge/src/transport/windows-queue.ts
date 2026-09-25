import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { WindowsSpoolerTransport, type SpoolerCommand } from './windows';
import type { PrintTransport } from './types';
import { MAX_ENCODED, encodeCommand, powershellRunner, type ScriptRunner } from '../windows/powershell';

/**
 * windows-queue — raw bytes to a Windows printer BY ITS NAME, with no printer sharing.
 *
 * WHY A SECOND WINDOWS COMMAND
 *   Gate 5's `copy /b` needs the printer SHARED, and a share name typed into configuration. That
 *   is exactly the setup an owner must never do. The pairing flow gives the bridge the queue name
 *   Windows itself reported (`Get-Printer`), and this command writes RAW bytes to that queue
 *   through the spooler API (`OpenPrinter` → `StartDocPrinter` "RAW" → `WritePrinter`), the
 *   documented way to send ESC/POS to a Windows printer without a driver re-rendering it.
 *
 * IT IS STILL `WindowsSpoolerTransport`
 *   Same class, same staging, same timeout, same verdicts — only the command differs, which is
 *   the seam Gate 5 built for exactly this. And it still cannot choose a printer: it is handed one
 *   destination, the queue Jalsa mapped for THIS job's machine, and it answers for that one.
 *
 * WHY NO COMPILER IS INVOLVED ON THE PC
 *   The `winspool.drv` calls are declared in C# inside the script and compiled by PowerShell's own
 *   `Add-Type`, which ships with Windows 10/11. No toolchain, no native module, no rebuild on a Node
 *   upgrade — the objection Gate 5 raised against a native binding does not apply.
 *
 * THE QUEUE NAME NEVER TOUCHES A COMMAND LINE. It is `$env:JALSA_QUEUE` inside a constant script
 * (see `windows/powershell.ts`), so a printer named with quotes and semicolons is just a name.
 *
 * WHAT A SUCCESS MEANS: the spooler accepted the job. Same honest limit as Gate 5 — Windows queues
 * for a printer that is off. The pre-check below catches the states Windows itself already knows
 * (offline, paper out, jammed); anything it does not know, it cannot tell us. Paper is Gate 7.
 */

export const RAW_PRINT_SCRIPT = String.raw`$ErrorActionPreference = 'Stop'
$queue = $env:JALSA_QUEUE
$file = $env:JALSA_FILE
$doc = $env:JALSA_DOC
$p = Get-Printer -Name $queue -ErrorAction SilentlyContinue
if (-not $p) { [Console]::Error.WriteLine("No printer named '$queue' on this computer."); exit 2 }
$st = [string]$p.PrinterStatus
if (@('Offline','PaperOut','PaperJam','Error','DoorOpen','NotAvailable','Paused','UserIntervention') -contains $st) {
  [Console]::Error.WriteLine("Windows reports the printer '$queue' as $st."); exit 5
}
$src = @'
using System;
using System.Runtime.InteropServices;
public static class JalsaRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  static extern bool StartDocPrinter(IntPtr handle, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW info);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  public static int LastError;
  public static int Send(string printer, string doc, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) { LastError = Marshal.GetLastWin32Error(); return 2; }
    try {
      DOCINFOW info = new DOCINFOW();
      info.pDocName = doc;
      info.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, info)) { LastError = Marshal.GetLastWin32Error(); return 3; }
      try {
        if (!StartPagePrinter(h)) { LastError = Marshal.GetLastWin32Error(); return 3; }
        int written;
        bool ok = WritePrinter(h, bytes, bytes.Length, out written);
        if (!ok) LastError = Marshal.GetLastWin32Error();
        EndPagePrinter(h);
        if (!ok) return 3;
        if (written != bytes.Length) return 4;
        return 0;
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
'@
# Compiled ONCE and kept beside the spool (item 6, 25-Sep-2026). Compiling this class with
# Add-Type took seconds on every ticket. The file name carries a hash of the source, so a new
# bridge compiles its own; a file that will not load is left alone and the class is compiled in
# memory as before - this script deletes nothing.
$loaded = $false
$dll = $env:JALSA_DLL
if ($dll) {
  try {
    if (-not (Test-Path -LiteralPath $dll)) { Add-Type -TypeDefinition $src -OutputAssembly $dll -OutputType Library -ErrorAction Stop }
    Add-Type -LiteralPath $dll -ErrorAction Stop
    $loaded = $true
  } catch {
    $loaded = $false
  }
}
if (-not $loaded) { Add-Type -TypeDefinition $src }
$bytes = [System.IO.File]::ReadAllBytes($file)
$rc = [JalsaRawPrint]::Send($queue, $doc, $bytes)
if ($rc -eq 2) { [Console]::Error.WriteLine("No printer named '$queue' could be opened on this computer (Windows error $([JalsaRawPrint]::LastError))."); exit 2 }
if ($rc -eq 3) { [Console]::Error.WriteLine("Windows would not accept the ticket for '$queue' (Windows error $([JalsaRawPrint]::LastError))."); exit 3 }
if ($rc -eq 4) { [Console]::Error.WriteLine("Windows accepted only part of the ticket for '$queue'."); exit 4 }
exit 0
`;

/**
 * A real Windows printer name, as far as this command needs one: present, not absurdly long, and
 * no control characters. Parentheses, spaces and punctuation are ordinary in printer names
 * ("TVS RP3160 Gold (Copy 1)") and are safe here because the name travels as an environment
 * variable, never on a command line.
 */
export const acceptsQueueName = (name: string): boolean =>
  name.length > 0 && name.length <= 200 && !/[\u0000-\u001f\u007f]/.test(name);

export const QUEUE_REFUSAL = 'it is not a Windows printer name.';

/** The encoded script must fit a Windows command line. Asserted by a spec, checked here too. */
export const rawPrintFits = (): boolean => encodeCommand(RAW_PRINT_SCRIPT).length < MAX_ENCODED;

/** `SpoolerCommand`, spoken through PowerShell. The runner is injected; Windows supplies the real one. */
/**
 * Where the compiled printing class is cached: in the spool directory, named for a hash of the
 * script, so a bridge upgrade that changes the class never loads the old one (item 6).
 */
export const rawPrintDll = (spoolDir: string): string =>
  join(spoolDir, `jalsa-raw-print-${createHash('sha256').update(RAW_PRINT_SCRIPT).digest('hex').slice(0, 12)}.dll`);

export const windowsQueueCommand =
  (run: ScriptRunner, spoolDir?: string): SpoolerCommand =>
  async ({ file, destination, timeoutMs }) => {
    const r = await run({
      script: RAW_PRINT_SCRIPT,
      env: {
        JALSA_QUEUE: destination,
        JALSA_FILE: file,
        JALSA_DOC: 'Jalsa ticket',
        ...(spoolDir ? { JALSA_DLL: rawPrintDll(spoolDir) } : {}),
      },
      timeoutMs,
    });
    return { code: r.code, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut };
  };

/** A paired computer's transport: Gate 5's spooler transport, speaking to a queue by its name. */
export const windowsQueueTransport = (
  spoolDir: string,
  timeoutMs: number,
  run: ScriptRunner = powershellRunner
): PrintTransport =>
  new WindowsSpoolerTransport({
    command: windowsQueueCommand(run, spoolDir),
    tempDir: spoolDir,
    timeoutMs,
    destination: { accepts: acceptsQueueName, refusal: QUEUE_REFUSAL },
  });
