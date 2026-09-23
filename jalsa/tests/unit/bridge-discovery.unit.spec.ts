/**
 * Discovery spec — what `Get-Printer` says, read off Windows.
 *
 * Every shape `ConvertTo-Json` produces is a fixture here: one printer as a bare object, several
 * as an array, none as nothing, a status as a name and as a number. The Windows runner is injected,
 * so the failure paths — a script that dies, one that hangs — are executed too.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import {
  DISCOVER_SCRIPT,
  interpretStatus,
  isVirtualPrinter,
  parseDiscovery,
  windowsDiscovery,
} from '../../bridge/src/windows/discovery';
import { MAX_ENCODED, encodeCommand, type ScriptRun } from '../../bridge/src/windows/powershell';
import { RAW_PRINT_SCRIPT, acceptsQueueName, rawPrintFits } from '../../bridge/src/transport/windows-queue';
import { discoveryFor, type CliDeps } from '../../bridge/src/cli';

const TVS = { Name: 'TVS RP3160 Gold', DriverName: 'TVS RP3160 Gold', PortName: 'USB001', Status: 'Normal' };
const PDF = { Name: 'Microsoft Print to PDF', DriverName: 'Microsoft Print To PDF', PortName: 'PORTPROMPT:', Status: 'Normal' };
const LAN = { Name: 'Counter Epson', DriverName: 'EPSON TM-T82', PortName: 'IP_192.168.1.50', Status: 'Offline' };

test('ONE printer comes back as a bare object, and is still a list of one', () => {
  const r = parseDiscovery(JSON.stringify(TVS));
  expect(r).toEqual({ ok: true, printers: [{ queueName: 'TVS RP3160 Gold', driverName: 'TVS RP3160 Gold', portName: 'USB001', status: 'ready', isVirtual: false }] });
});

test('several come back sorted: USB first, then network, software printers last', () => {
  const r = parseDiscovery(JSON.stringify([PDF, LAN, TVS]));
  expect(r.ok && r.printers.map((p) => p.queueName)).toEqual(['TVS RP3160 Gold', 'Counter Epson', 'Microsoft Print to PDF']);
  expect(r.ok && r.printers.map((p) => p.status)).toEqual(['ready', 'offline', 'ready']);
  expect(r.ok && r.printers[2]?.isVirtual).toBe(true);
});

test('NONE is an honest empty list — both the `[]` and the silent form', () => {
  expect(parseDiscovery('')).toEqual({ ok: true, printers: [] });
  expect(parseDiscovery('[]\r\n')).toEqual({ ok: true, printers: [] });
});

test('a list this bridge cannot read is a FAILURE, never an empty success', () => {
  expect(parseDiscovery('Get-Printer : Access denied').ok).toBe(false);
  // Rows arrived but none of them was a printer: also a failure (binding rule 5).
  expect(parseDiscovery(JSON.stringify([{ Foo: 1 }, { Name: '' }])).ok).toBe(false);
});

test('a status arrives as a word or a number, and means the same thing', () => {
  expect(interpretStatus('Normal')).toBe('ready');
  expect(interpretStatus('Offline')).toBe('offline');
  expect(interpretStatus('PaperOut')).toBe('error');
  expect(interpretStatus('Paper Out')).toBe('error');
  expect(interpretStatus(8)).toBe('offline');
  expect(interpretStatus('8')).toBe('offline');
  expect(interpretStatus(5)).toBe('error');
  expect(interpretStatus(0)).toBe('ready');
  expect(interpretStatus('Printing')).toBe('ready');
  expect(interpretStatus(undefined)).toBe('unknown');
  expect(interpretStatus('')).toBe('unknown');
});

test('software printers are recognised by port and by name, never hidden', () => {
  expect(isVirtualPrinter({ queueName: 'Microsoft XPS Document Writer', driverName: 'x', portName: 'PORTPROMPT:' })).toBe(true);
  expect(isVirtualPrinter({ queueName: 'OneNote (Desktop)', driverName: 'Send to Microsoft OneNote', portName: 'nul:' })).toBe(true);
  expect(isVirtualPrinter({ queueName: 'Fax', driverName: 'Microsoft Shared Fax Driver', portName: 'SHRFAX:' })).toBe(true);
  expect(isVirtualPrinter({ queueName: 'TVS RP3160 Gold', driverName: 'TVS', portName: 'USB001' })).toBe(false);
});

test('the discovery script asks Windows and nothing else; the parser handles what comes back', async () => {
  expect(DISCOVER_SCRIPT).toContain('Get-Printer');
  expect(DISCOVER_SCRIPT).toContain('ConvertTo-Json');
  expect(DISCOVER_SCRIPT).not.toMatch(/Set-Printer|Remove-Printer|Add-Printer|Start-Process|Invoke-/);
  expect(encodeCommand(DISCOVER_SCRIPT).length).toBeLessThan(MAX_ENCODED);

  const ok = windowsDiscovery(async () => ({ code: 0, stdout: JSON.stringify([TVS]), stderr: '', timedOut: false }));
  expect((await ok()).ok).toBe(true);
  const died = windowsDiscovery(async () => ({ code: 1, stdout: '', stderr: 'Get-Printer : The term is not recognized', timedOut: false }));
  const d = await died();
  expect(!d.ok && d.error).toContain('could not list its printers');
  const hung = windowsDiscovery(async (): Promise<ScriptRun> => ({ code: null, stdout: '', stderr: '', timedOut: true }), 500);
  const h = await hung();
  expect(!h.ok && h.error).toContain('within 500 ms');
});

test('off Windows, discovery is an honest failure unless a developer names pretend printers', async () => {
  const base: CliDeps = { env: {}, platform: 'linux', hostname: 'dev', fs: {} as CliDeps['fs'], installDir: '', out: () => undefined };
  const none = await discoveryFor(base)();
  expect(none.ok).toBe(false);
  const dev = await discoveryFor({ ...base, env: { JALSA_BRIDGE_DEV_PRINTERS: 'KOT-1; BILL-1' } })();
  expect(dev.ok && dev.printers.map((p) => p.queueName)).toEqual(['KOT-1', 'BILL-1']);
});

/* ── The queue transport's script and its name rule ────────────────────── */

test('the raw-print script writes RAW through winspool by the queue in $env, and fits a command line', () => {
  expect(rawPrintFits()).toBe(true);
  expect(RAW_PRINT_SCRIPT).toContain('$env:JALSA_QUEUE');
  expect(RAW_PRINT_SCRIPT).toContain('$env:JALSA_FILE');
  expect(RAW_PRINT_SCRIPT).toContain('pDataType = "RAW"');
  for (const call of ['OpenPrinterW', 'StartDocPrinterW', 'StartPagePrinter', 'WritePrinter', 'EndPagePrinter', 'EndDocPrinter', 'ClosePrinter']) {
    expect(RAW_PRINT_SCRIPT).toContain(call);
  }
  // A short write is a failure, not a success (Gate 3's rule, one layer down).
  expect(RAW_PRINT_SCRIPT).toContain('if (written != bytes.Length) return 4;');
  // The states Windows itself knows are refused before a byte is queued.
  expect(RAW_PRINT_SCRIPT).toContain("'Offline','PaperOut','PaperJam'");
  // Nothing variable is interpolated into the script text: it is a constant.
  expect(RAW_PRINT_SCRIPT).not.toMatch(/\$\{/);
});

test('a Windows printer name may have spaces and brackets; control characters and emptiness are refused', () => {
  expect(acceptsQueueName('TVS RP3160 Gold (Copy 1)')).toBe(true);
  expect(acceptsQueueName('\\\\server\\Kitchen')).toBe(true);
  expect(acceptsQueueName('x"; Remove-Item C:\\ -Recurse; "')).toBe(true); // just a name that does not exist
  expect(acceptsQueueName('')).toBe(false);
  expect(acceptsQueueName('bad\nname')).toBe(false);
  expect(acceptsQueueName('x'.repeat(201))).toBe(false);
});
