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
 * FAIL-FIRST EVIDENCE (18-Sep-2026) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  buildTestTicket,
  testPrintBlocker,
  TEST_PRINT_NOTE,
  TEST_PRINT_QUEUED,
} from '../../src/lib/test-print';
import { PAPER } from '../../src/lib/print-template';

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

const AT = new Date('2026-09-18T08:32:00+05:30');

const target = (over: Partial<Parameters<typeof buildTestTicket>[0]['target']> = {}) => ({
  name: 'TVS RP 3160 Gold — Kitchen 2',
  station: 'Main Kitchen',
  paperMm: 80,
  connection: 'Ethernet',
  address: '192.168.1.42',
  ...over,
});

/* ── The ticket ────────────────────────────────────────────────────────────────────────────── */

test('the ticket identifies the restaurant, the test, and the machine', () => {
  const lines = buildTestTicket({ restaurantName: 'Jalsa', target: target(), at: AT });
  const text = lines.join('\n');
  expect(text).toContain('JALSA');
  expect(text).toContain('TEST PRINT');
  expect(text).toContain('TVS RP 3160 Gold — Kitchen 2');
  expect(text).toContain('Main Kitchen');
  expect(text).toContain('80 mm');
  expect(text).toContain('Ethernet');
  // Asserted by parts, not as one string: `toLocaleDateString('en-IN')` says "Sept" on this
  // runtime and "Sep" on others, and the ICU version is not what this case is about.
  expect(text).toMatch(/18 Sep\w* 2026/);
  // A time, not a particular one: this formatter renders in the RUNTIME's zone — the same
  // `toLocaleTimeString('en-IN', …)` call `staff-view.ts` already uses for every other time in
  // the app — and this container runs in UTC while the restaurant does not. Pinning a wall
  // clock here would test the container.
  expect(text).toMatch(/\d{1,2}:\d{2}/);
});

test('the restaurant name is whatever was configured — never a constant', () => {
  const text = buildTestTicket({ restaurantName: 'Spice Route', target: target(), at: AT }).join('\n');
  expect(text).toContain('SPICE ROUTE');
  expect(text).not.toContain('JALSA');
});

test('an unconfigured restaurant gets a ticket with no header, not somebody else\'s name', () => {
  const lines = buildTestTicket({ restaurantName: '', target: target(), at: AT });
  expect(lines.join('\n')).toContain('TEST PRINT');
  expect(lines.join('\n')).not.toContain('JALSA');
});

test('every line fits the paper it is printed on — including 58 mm', () => {
  // The whole reason this is built on the character grid. An over-width line does not wrap on a
  // thermal printer, it disappears — and the 58 mm tandoor machine is the one most likely to be
  // misconfigured, so it is the one the ticket must not silently truncate.
  for (const mm of [58, 80]) {
    const cols = PAPER[mm === 58 ? '58' : '80'].cols.normal;
    const lines = buildTestTicket({
      restaurantName: 'Jalsa Hospitality Private Limited',
      target: target({ paperMm: mm, name: 'TVS RP 3160 Gold — Tandoor station' }),
      at: AT,
    });
    const over = lines.filter((l) => l.length > cols);
    expect(over, `at ${mm} mm nothing may exceed ${cols} columns`).toEqual([]);
  }
});

test('a long printer name survives 58 mm because the label sits above the value', () => {
  // 'TVS RP 3160 Gold — Tandoor station' is 34 characters and a 58 mm roll has 32. A
  // `label … value` pair would have pushed it off the paper.
  const lines = buildTestTicket({
    restaurantName: 'Jalsa',
    target: target({ paperMm: 58, name: 'TVS RP 3160 Gold — Tandoor station' }),
    at: AT,
  });
  expect(lines).toContain('Printer:');
  // WRAPPED across lines at 32 columns, so the assertion is that nothing was LOST rather than
  // that it survived on one line — losing it is the failure that matters.
  for (const word of ['TVS', '3160', 'Tandoor', 'station']) {
    expect(lines.join('\n'), `${word} must still be on the ticket`).toContain(word);
  }
});

test('the ticket needs no bill, no round and no menu', () => {
  // A connectivity test that required an order is a printer that stays untested until a ticket
  // is lost. The signature is the proof: three inputs, none of them an order.
  const src = codeOnly('src/lib/test-print.ts');
  expect(src).not.toContain('bill');
  expect(src).not.toContain('kot');
  expect(src).not.toContain('menu');
});

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
  // And it tells the owner the thing they would otherwise learn by walking to the kitchen.
  expect(said).toContain('nothing has left the server');
});

test('11b. the screen carries the limitation beside the button, not in a note to go and find', () => {
  expect(TEST_PRINT_NOTE).toContain('No paper will come out');
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

test('9. the connection type travels to the ticket and is recorded', () => {
  const body = testPrintBody();
  expect(body).toContain('connection');
  expect(buildTestTicket({ restaurantName: 'J', target: target({ connection: 'Wi-Fi' }), at: AT }).join('\n')).toContain(
    'Wi-Fi'
  );
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

test('a long restaurant name is WRAPPED, never silently cut', () => {
  /*
    The case the width check could not see. `centre()` ends in `.slice(0, cols)`, so an
    over-long header does not overflow the paper — it is TRUNCATED, and the ticket comes out
    saying "JALSA HOSPITALITY PRIVATE LIMIT". Every line still fits, so a width assertion passes
    while the restaurant's own name is mutilated on the machine it is meant to identify.

    Found when defect C — removing the header wrap — was injected and the suite stayed green.
  */
  const name = 'Jalsa Hospitality Private Limited';
  const lines = buildTestTicket({ restaurantName: name, target: target({ paperMm: 58 }), at: AT });
  for (const word of name.toUpperCase().split(' ')) {
    expect(lines.join('\n'), `"${word}" must survive the 58 mm header`).toContain(word);
  }
});
