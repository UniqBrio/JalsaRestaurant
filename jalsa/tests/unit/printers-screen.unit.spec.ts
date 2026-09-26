/**
 * Printers screen spec — the owner's journey, pinned from source, and the boundaries it keeps.
 *
 * WHY SOURCE: the owner console needs a PIN and a database, neither of which this tier has. What
 * this file can hold the screen to is what it SAYS, what it SENDS, and what it never asks for —
 * the same shape `test-print.unit.spec.ts` uses for the panel it fronts.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (p: string): string => readFileSync(p, 'utf8');
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const SCREEN = read('src/features/owner/sections/PrintersSection.tsx');
const CONSOLE = read('src/features/owner/OwnerConsole.tsx');
const DASH = read('src/features/owner/sections/Dashboard.tsx');
const ROUTE = read('src/app/api/owner/action/route.ts');
const OWNER = read('src/lib/db/owner-mutations.ts');
const DOWNLOAD = read('src/app/api/owner/print-bridge/download/route.ts');
const VIEW = read('src/lib/db/owner-view.ts');

function bodyOf(source: string, name: string): string {
  const start = source.search(new RegExp(`(export )?async function ${name}\\(`));
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('\n}\n', start));
}

test('the sources this rung reasons about were actually read', () => {
  expect(SCREEN.length).toBeGreaterThan(5000);
  expect(CONSOLE).toContain('SECTIONS');
});

test('DASHBOARD → PRINTERS: a top-level section, on the printer grant, and the dashboard points at it', () => {
  expect(CONSOLE).toContain("{ key: 'printers', label: 'Printers', permission: 'set.printer' }");
  expect(CONSOLE).toContain("{section === 'printers' ? <PrintersSection {...shared} /> : null}");
  expect(DASH).toContain("onClick={() => go('printers')}");
  expect(DASH).toContain('data.printComputers.length === 0');
  expect(DASH).toContain('Connect your printing computer');
});

test('the empty state says what the brief says, and its one action starts the setup', () => {
  expect(SCREEN).toContain('title="Connect your printing computer"');
  expect(SCREEN).toContain('Install Jalsa Print Bridge on the Windows computer connected to your thermal printer.');
  expect(SCREEN).toContain("label: 'Connect Printing Computer'");
  expect(SCREEN).toContain("testId: 'owner-printers-connect'");
});

test('the journey is on one sheet in order: download, install, pair, choose', () => {
  const s = code(SCREEN);
  const steps = ['1 · Download Jalsa Print Bridge', '2 · Install it', '3 · Pair this computer', '4 · Choose the printer'];
  let last = -1;
  for (const step of steps) {
    const at = s.indexOf(step);
    expect(at, step).toBeGreaterThan(last);
    last = at;
  }
  expect(s).toContain('Download for Windows');
  expect(s).toContain('Show pairing code');
  expect(s).toContain('Test Print');
  expect(s).toContain('Save Printer');
});

test('the download is the owner route — never GitHub, never a raw bundle, never a fabricated link', () => {
  const s = code(SCREEN);
  expect(s).toContain('href={BRIDGE_DOWNLOAD_ROUTE}');
  expect(s).not.toMatch(/github\.com|\.js"|dist\/main/);
  // No link at all when the server has nothing to serve — the sentence instead.
  expect(s).toContain('data.printBridgeDownload.available');
  expect(s).toContain('{DOWNLOAD_UNAVAILABLE}');
  // And the route itself: behind sign-in and the grant; redirect, stream, or an honest 404.
  expect(DOWNLOAD).toContain("staff.grants.can('set.printer')");
  expect(DOWNLOAD).toContain('NextResponse.redirect(source.url, 302)');
  expect(DOWNLOAD).toContain("code: 'download_unavailable'");
  expect(VIEW).toContain("printBridgeDownload: { available: currentBridgeDownload().kind !== 'none' }");
});

test('THE OWNER NEVER TYPES a token, a URL, a queue name or a machine id', () => {
  const s = code(SCREEN);
  // The only text inputs are: the computer's name, a new printer's name. Nothing else.
  const inputs = [...s.matchAll(/<Input\b[\s\S]*?data-testid="([^"]+)"/g)].map((m) => m[1]);
  expect(inputs.sort()).toEqual(['owner-printers-label', 'owner-printers-name']);
  for (const word of ['JALSA_BRIDGE', 'Copy this token', 'token_hash', 'machineId', 'queue name', 'apiUrl']) {
    expect(s, `${word} has no business on this screen`).not.toContain(word);
  }
  // The queue name a mapping sends is the one the computer REPORTED, taken from the row selected.
  expect(s).toContain('queueName: choosing.printer.queueName');
});

test('the pairing code lives in component state for as long as the sheet is open, and is never sent back', () => {
  const s = code(SCREEN);
  expect(s).toContain("action: 'issue-pairing-code'");
  const sends = [...s.matchAll(/send(?:<[^>]*>)?\('\/api\/owner\/action',\s*\{([\s\S]*?)\}\s*\)/g)].map((m) => m[1] ?? '');
  expect(sends.length).toBeGreaterThan(3);
  // `tokenId` names a row to revoke; `code:` or `token:` would be a credential travelling back.
  for (const payload of sends) expect(payload, payload).not.toMatch(/\bcode\s*:|\btoken\s*:/);
  expect(s).toContain('data-testid="owner-printers-pairing-code"');
  expect(s).toContain('That code has expired. Get a new one.');
});

test('TEST PRINT is the existing action, follows its own job, and is refused only when the screen already knows why', () => {
  const s = code(SCREEN);
  // SUPERSEDED 25-Sep-2026 (item 9): previously `{ action: 'test-print', printerId: p.id }`. The
  // same action, now saying which ticket - kitchen or bill - the owner chose beside Preview.
  expect(s).toContain("{ action: 'test-print', printerId: p.id, ticket }");
  expect(s).toContain('testPrintProgress(job, p.name)');
  expect(s).toContain('data.printJobs.find((j) => j.id === jobId)');
  // No second print path: nothing here encodes, spools or opens a socket.
  for (const banned of ['escpos', 'encodeTicket', 'Transport', 'WebSocket', 'navigator.usb', '9100']) {
    expect(s, banned).not.toContain(banned);
  }
});

test('the screen uses the owner’s sentences from one module, not its own copies', () => {
  const s = code(SCREEN);
  expect(s).toContain('printerReadiness({');
  expect(s).toContain('OWNER_PRINT_MESSAGES.notInstalled');
  expect(s).toContain('OWNER_PRINT_MESSAGES.notRunning');
  expect(s).toContain('computerState(c.lastSeenAt, now)');
  // Manage reaches the existing Print setup, unchanged.
  expect(s).toContain('<PrintSetupSection {...props} />');
});

/* ── The server side of the journey ────────────────────────────────────── */

test('the three new owner actions are routed and typed, and each demands the printer grant', () => {
  for (const action of ['issue-pairing-code', 'save-printer-mapping', 'remove-printer-mapping']) {
    expect(ROUTE).toContain(`case '${action}':`);
    expect(ROUTE).toContain(`action: '${action}'`);
  }
  for (const fn of ['issuePairingCode', 'savePrinterMapping', 'removePrinterMapping']) {
    expect(code(bodyOf(OWNER, fn)), fn).toContain("demand(input.actor, 'set.printer')");
    expect(code(bodyOf(OWNER, fn)), fn).toContain('currentRestaurantId()');
  }
});

test('PRINTER MAPPING: the queue must be one this computer reported, both rows are this restaurant’s, and Jalsa keeps the routing', () => {
  const m = code(bodyOf(OWNER, 'savePrinterMapping'));
  // The computer: this restaurant's, and live.
  expect(m).toContain(".eq('id', input.computerId)");
  expect(m).toContain(".is('revoked_at', null)");
  // The queue: reported by that computer's own discovery, never a free string.
  expect(m).toContain(".from('bridge_discovered_printer')");
  expect(m).toContain(".eq('queue_name', input.queueName)");
  expect(m).toContain('That printer is no longer on this computer');
  // The mapping row: keyed by computer + printer, one computer per printer.
  expect(m).toContain("{ onConflict: 'printer_id' }");
  expect(m).toContain('queue_name: input.queueName');
  // An existing Jalsa printer keeps its routes and station: only `connection` may change.
  const existing = m.slice(m.indexOf("'printerId' in input.target"), m.indexOf('} else {'));
  expect(existing).not.toContain('routes');
  expect(existing).not.toContain('station');
  // A new printer routes nothing until the owner says so on the Routing screen.
  expect(m).toContain('routes: [],');
  // Nothing here touches a job or its assignment.
  expect(m).not.toContain('print_job');
});

test('the owner payload carries computers, mappings and the pending code’s NAME — never a code, never a hash', () => {
  const q = code(read('src/lib/db/queries.ts'));
  const computers = q.slice(q.indexOf('export async function listPrintComputers'), q.indexOf('export async function listPrinterMappings'));
  expect(computers).toContain(".is('revoked_at', null)");
  expect(computers).not.toContain('token_hash');
  const pending = q.slice(q.indexOf('export async function pendingPairing'));
  expect(pending).toContain(".select('label,expires_at')");
  expect(pending).not.toContain('code_hash');
  expect(VIEW).toContain('printComputers,');
  expect(VIEW).toContain('printerMappings,');
});
