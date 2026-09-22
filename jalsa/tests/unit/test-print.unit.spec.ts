/**
 * Test print — one machine, one job, and no claim that paper came out.
 *
 * THE FINDING THAT DECIDED THIS FEATURE
 *   Nothing in this deployment can talk to a thermal printer. There is no ESC/POS, no port-9100
 *   socket, no WebUSB, no bridge and no agent; the only real printing anywhere is
 *   `window.print()` on the HR documents, which that file says outright "does not go to the
 *   thermal machines". `queuePrint` writes `status: 'printed'` when `printer.online` is true —
 *   and `online` is a stored boolean an owner ticks by hand, not a probe.
 *
 *   So a test print CAN queue a real job against the right machine and show it in History, and
 *   it CANNOT make paper appear. The cases below hold the code to exactly that claim and no
 *   larger one, because the failure mode here is not a crash — it is an owner who believes the
 *   printer works and finds out during service.
 *
 * SUPERSEDED IN PART, 22-Sep-2026 (merge of `main` into the printing branch), under the
 * contract-change exception in jalsa/CLAUDE.md.
 *   The finding above was true when this file was written and is no longer. `main` had no way to
 *   talk to a printer; this branch has an ESC/POS encoder, three transports and a Windows bridge,
 *   and a test print is an ordinary `print_job` that the bridge collects and prints.
 *
 *   REMOVED: the eight cases that exercised `buildTestTicket()`, which laid out a test ticket on
 *   its own grid. That function is gone - a test ticket is now composed by `buildTicket` through
 *   `test-ticket.ts`, on the same template a kitchen ticket uses, and two things laying out one
 *   ticket is the defect this repository's rule names. Those cases are not lost so much as
 *   relocated: `print-config.unit.spec.ts` composes and encodes the test ticket at both widths
 *   through the real path, and Gate 7 row 11 checks the width on paper.
 *
 *   REWRITTEN: the two cases pinning the owner-facing sentences, because the sentences changed.
 *   Each carries its own note at the assertion.
 *
 *   KEPT VERBATIM: everything about the JOB - one row, the right machine, no fake bill, never
 *   `printed`, routing not consulted, the grant, the audit, and the button's behaviour. None of
 *   that changed, and all of it still holds.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026, and 22-Sep-2026 for the merge) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { testPrintBlocker, TEST_PRINT_NOTE, TEST_PRINT_QUEUED } from '../../src/lib/test-print';

const PANEL = 'src/features/owner/sections/PrintSetupSection.tsx';
const MUTATIONS = 'src/lib/db/owner-mutations.ts';
const ROUTE = 'src/app/api/owner/action/route.ts';

const read = (p: string): string => readFileSync(p, 'utf8');

function codeOnly(path: string): string {
  const raw = read(path);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  expect(stripped, `stripping ${path} must leave its code behind`).toContain('export');
  expect(stripped.length).toBeGreaterThan(200);
  return stripped;
}

/** `testPrint`'s body, from its signature to the next top-level declaration. */
function testPrintBody(): string {
  const src = read(MUTATIONS);
  const start = src.indexOf('export async function testPrint');
  expect(start, 'testPrint must exist').toBeGreaterThan(-1);
  const end = src.indexOf('\nexport ', start + 1);
  const body = src.slice(start, end > -1 ? end : undefined);
  /* Comments stripped: the negative assertions below are about the CODE, and the comment
     explaining that routing is not consulted necessarily contains the word "routes". */
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* ── The ticket ────────────────────────────────────────────────────────────────────────────── */

/* ── 13. When a test cannot even be queued ─────────────────────────────────────────────────── */

test('13. a printer with no address is called unconfigured, not unreachable', () => {
  const why = testPrintBlocker({ enabled: true, connection: 'Ethernet', address: '  ' });
  expect(why).toContain('no address');
  // The sentence sends them to the setting rather than to the kitchen.
  expect(why).toContain('Configure');
});

test('13b. a USB printer needs no address, because USB has none', () => {
  expect(testPrintBlocker({ enabled: true, connection: 'USB', address: '' })).toBeNull();
});

test('13c. a switched-off printer says so', () => {
  expect(testPrintBlocker({ enabled: false, connection: 'USB', address: '' })).toContain('switched off');
});

test('a configured, switched-on printer is testable', () => {
  expect(testPrintBlocker({ enabled: true, connection: 'Wi-Fi', address: '192.168.1.9' })).toBeNull();
});

/* ── 11. The honesty of the result ─────────────────────────────────────────────────────────── */

test('11. nothing claims the ticket printed, or even that it was sent', () => {
  const said = TEST_PRINT_QUEUED('Kitchen 2');
  expect(said).toContain('queued');
  expect(said.toLowerCase()).not.toContain('printed');
  expect(said.toLowerCase()).not.toContain('successful');
  // SUPERSEDED 22-Sep-2026. This asserted `nothing has left the server`, which was true on
  // `main` and became false the moment Gates 2-6 built the encoder, the transport and the bridge.
  // What must still hold is the honesty: it says where the job IS, never that paper exists.
  expect(said).toContain('History');
  expect(said).toContain('bridge');
});

test('11b. the screen carries the limitation beside the button, not in a note to go and find', () => {
  // SUPERSEDED 22-Sep-2026, with the sentence it pinned. The note no longer says paper cannot
  // come out - it can. What it must say is the thing an owner cannot see from this screen: a
  // queued job WAITS when no bridge is collecting, so silence is not a broken printer.
  expect(TEST_PRINT_NOTE).toContain('waits in the queue');
  expect(read(PANEL)).toContain('data-testid="owner-print-test-note"');
  expect(read(PANEL)).toContain('{TEST_PRINT_NOTE}');
});

test('11c. the job is written as queued, never as printed', () => {
  const body = testPrintBody();
  expect(body).toContain("status: 'queued'");
  expect(body).not.toContain("status: 'printed'");
  // `queuePrint` still writes 'printed' from the stored `online` flag. That is existing
  // behaviour and out of scope — but this function must not copy it.
  expect(body).not.toContain('online');
});

/* ── 2+3+9. One machine, and the right one ─────────────────────────────────────────────────── */

test('2+3. the job is written against the printer that was asked for, and no other', () => {
  const body = testPrintBody();
  expect(body).toContain(".eq('id', input.printerId)");
  expect(body).toContain('printer_id: printer.id');
  // Scoped by restaurant too, so a crafted id cannot reach another restaurant's machine.
  expect(body).toContain(".eq('restaurant_id', restaurantId)");
});

test('3b. routing is never consulted, so it cannot redirect a diagnostic', () => {
  const body = testPrintBody();
  for (const routing of ['resolvePrinter', 'queuePrint', 'routes', 'categories']) {
    expect(body, `${routing} has no place in a test aimed at one machine`).not.toContain(routing);
  }
});

/* ── 4-8. What a test must never do ────────────────────────────────────────────────────────── */

test('4+5+6. no order, no bill and no KOT is created', () => {
  const body = testPrintBody();
  expect(body).toContain('kot_id: null');
  expect(body).toContain('bill_id: null');
  // Nothing is inserted anywhere but print_job.
  const inserts = body.match(/\.from\('([a-z_]+)'\)\s*\n?\s*\.insert/g) ?? [];
  expect(inserts.length, 'exactly one insert').toBe(1);
  expect(body).toContain(".from('print_job')");
  for (const table of ["from('bill')", "from('kot')", "from('guest_cart_line')"]) {
    expect(body, `${table} must not be written`).not.toContain(table);
  }
});

test('7+8. nothing about the printer or its routing is modified', () => {
  const body = testPrintBody();
  // The printer row is READ and never written.
  expect(body).toContain(".from('printer')");
  expect(body).not.toContain('.update(');
  expect(body).not.toContain('.upsert(');
  expect(body).not.toContain('.delete(');
});

test('the audit entry is administrative, not a business transaction', () => {
  const body = testPrintBody();
  expect(body).toContain("action: 'Printer'");
  // A bill or table id here would file a diagnostic among the night's trade.
  expect(body).not.toContain('billId:');
  expect(body).not.toContain('tableId:');
});

/* ── Permissions ───────────────────────────────────────────────────────────────────────────── */

test('the same grant that gates Configure gates the test — nothing was broadened', () => {
  const body = testPrintBody();
  expect(body).toContain("demand(input.actor, 'set.printer')");
  // Checked before the printer is even read.
  expect(body.indexOf('demand(')).toBeLessThan(body.indexOf("from('printer')"));
  // And the button is behind the same flag the Configure button is.
  expect(read(PANEL)).toContain("const canEdit = data.grants.includes('set.printer');");
});

/* ── 1+10+15. The buttons ──────────────────────────────────────────────────────────────────── */

test('1. every printer card renders its own Test print action', () => {
  const src = read(PANEL);
  // Inside the printers map, keyed by that printer's id — so four machines get four buttons.
  expect(src).toContain('data-testid={`owner-print-test-${p.id}`}');
  expect(src).toContain('onClick={() => runTest(p)}');
});

test('10. a second tap cannot queue a second job, and other printers stay testable', () => {
  const src = read(PANEL);
  expect(src).toContain('disabled={testing === p.id}');
  expect(src).toContain("{testing === p.id ? 'Queueing…' : 'Test print'}");
  // A boolean would have disabled every button on the tab; this holds WHICH printer is busy.
  expect(src).toContain('React.useState<string | null>(null)');
  expect(src).toContain('if (testing) return;');
});

test('10b. the flag is always released, so a failure does not strand the button', () => {
  const src = read(PANEL);
  const start = src.indexOf('const runTest =');
  const body = src.slice(start, src.indexOf('\n  const ', start + 10));
  expect(body).toContain('finally');
  expect(body).toContain('setTesting(null)');
  expect(body, 'and a failure is reported rather than swallowed').toContain('catch');
});

test('15+16. Configure and the routing screen are untouched', () => {
  const src = read(PANEL);
  expect(src).toContain('data-testid={`owner-print-configure-${p.id}`}');
  expect(src).toContain('onClick={() => setForm({ ...p })}');
  expect(src).toContain("action: 'upsert-printer'");
});

test('14. the Answering / Not answering pill is unchanged', () => {
  const src = read(PANEL);
  expect(src).toContain("{!p.enabled ? 'Switched off' : p.online ? 'Answering' : 'Not answering'}");
});

test('the route hands the printer id through without reinterpreting it', () => {
  const src = codeOnly(ROUTE);
  expect(src).toContain("case 'test-print'");
  expect(src).toContain('testPrint({ printerId: input.printerId, actor })');
});

/* ── The limitation itself ─────────────────────────────────────────────────────────────────── */

test('no second printer communication system was invented', () => {
  const src = codeOnly('src/lib/test-print.ts') + codeOnly(MUTATIONS);
  for (const banned of ['escpos', 'net.Socket', 'navigator.usb', '9100', 'ipp://', 'WebSocket']) {
    expect(src, `${banned} would be a second pipeline`).not.toContain(banned);
  }
});
