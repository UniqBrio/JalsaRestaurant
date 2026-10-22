import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { INVOICE_ASK, KOT_ASK, neverPrinted, printsAutomatically, SWITCH_LABEL } from '../../src/lib/print-choice';

/**
 * 22-Oct-2026 — Enable KOT Printing and Enable Invoice Printing, on one shared printer
 * (requests/2026-10-22-kot-and-invoice-print-switches.md).
 *
 * The server code is the REAL code on the round rig (tests/support/rounds/print-switches.scenarios.ts),
 * against a fake database that keeps the round's print state, the bill's status and the print
 * jobs, and refuses a duplicate job id as Postgres does. Against real Postgres:
 * print-switches.db.unit.spec.ts. In a real browser: tests/render/print-ask.render.spec.ts.
 */

interface Write {
  table: string;
  op: string;
  body: unknown;
  filters: string[];
  refused?: string;
}
interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  writes: Write[];
  final: {
    print: Record<string, unknown> | null;
    kot: { print_status: string } | null;
    jobs: Array<Record<string, unknown>>;
    billStatus: string;
  };
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/print-switches.scenarios.ts', import.meta.url));
let results: Result[] = [];
let firstInvoiceId = '';
let otherInvoiceId = '';
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};
const jobs = (r: Result, kind?: 'KOT' | 'Invoice') => r.final.jobs.filter((j) => !kind || j.kind === kind);
const jobInserts = (r: Result) => r.writes.filter((w) => w.table === 'print_job' && w.op === 'insert' && !w.refused);
const settingWrites = (r: Result) => r.writes.filter((w) => w.table === 'setting');
const kotInsert = (r: Result) => r.writes.find((w) => w.table === 'kot' && w.op === 'insert')?.body as Record<string, unknown> | undefined;

test.beforeAll(async () => {
  const out = await runScenario<{ results: Result[]; firstInvoiceId: string; otherInvoiceId: string }>(SCENARIOS);
  results = out.results;
  firstInvoiceId = out.firstInvoiceId;
  otherInvoiceId = out.otherInvoiceId;
});

test('the scenarios ran - a rig that parsed nothing is not a passing rig', () => {
  expect(results.length).toBe(38);
});

/* ── 1. KOT on: prints by itself, no prompt ─────────────────────────────────────────────── */

test('KOT ON: a new round is queued for printing by itself, and the screen is not asked', () => {
  for (const name of ['kot: no setting saved', 'kot: on']) {
    const r = by(name);
    expect(r.threw, name).toBeNull();
    expect(r.out, name).toMatchObject({ print: 'queued' });
    expect(kotInsert(r)?.print_status, name).toBe('queued');
    // Exactly the new round, once, at the one printer.
    expect(jobs(r, 'KOT'), name).toHaveLength(1);
    expect(jobs(r, 'KOT')[0], name).toMatchObject({ kot_id: 'k1', printer_id: 'p-one', is_reprint: false, status: 'queued' });
  }
});

/* ── 2. KOT off: asks, for every new round ──────────────────────────────────────────────── */

test('KOT OFF: nothing is printed, the round is marked never printed, and the screen is told to ask', () => {
  const r = by('kot: off');
  expect(r.threw).toBeNull();
  expect(r.out).toMatchObject({ print: 'ask', kotCode: 'KOT-1' });
  expect(kotInsert(r)?.print_status).toBe('cancelled');
  expect(jobInserts(r)).toEqual([]);
});

test('KOT OFF: every new round asks - the second round as well as the first', () => {
  const r = by('kot: off, two rounds');
  const [first, second] = r.out as Array<{ print: string; kotId: string }>;
  expect(first?.print).toBe('ask');
  expect(second?.print).toBe('ask');
  expect(first?.kotId).not.toBe(second?.kotId);
  expect(jobInserts(r)).toEqual([]);
});

test('KOT OFF: after a one-time Print KOT, the NEXT round still asks', () => {
  const r = by('kot: off, print once, then the next round');
  expect(r.out).toMatchObject({ print: 'ask' });
  expect(r.final.print).toEqual({ kotEnabled: false });
  expect(jobs(r, 'KOT')).toHaveLength(1);
});

test('KOT OFF: a guest\'s round is not printed either - it waits on the round card for staff', () => {
  const r = by('kot: off, a guest round');
  expect(r.threw).toBeNull();
  expect(kotInsert(r)?.print_status).toBe('cancelled');
  expect(jobInserts(r)).toEqual([]);
  // The round card reads that state and offers Print KOT in place of Reprint.
  expect(neverPrinted({ printStatus: 'cancelled', printJobs: [] })).toBe(true);
  expect(neverPrinted({ printStatus: 'cancelled', printJobs: [{}] })).toBe(false);
  expect(neverPrinted({ printStatus: 'queued', printJobs: [] })).toBe(false);
});

test('Print KOT prints exactly that round, once, and is not marked a reprint', () => {
  const r = by('kot: off, print once');
  expect(r.threw).toBeNull();
  const out = r.out as { placed: { kotId: string }; printed: { outcome: string; printerName: string } };
  expect(out.printed).toEqual({ outcome: 'queued', printerName: 'Counter' });
  expect(jobs(r, 'KOT')).toHaveLength(1);
  expect(jobs(r, 'KOT')[0]).toMatchObject({ kot_id: out.placed.kotId, is_reprint: false, printer_id: 'p-one' });
  expect(r.final.kot?.print_status).toBe('queued');
});

/* ── 3. Invoice on: prints by itself after a confirmed payment ──────────────────────────── */

test('INVOICE ON: the invoice is queued after the payment is recorded, and the screen is not asked', () => {
  for (const name of ['invoice: no setting saved', 'invoice: on']) {
    const r = by(name);
    expect(r.threw, name).toBeNull();
    expect(r.out, name).toMatchObject({ print: 'queued' });
    expect(r.final.billStatus, name).toBe('closed');
    expect(jobs(r, 'Invoice'), name).toHaveLength(1);
    expect(jobs(r, 'Invoice')[0], name).toMatchObject({ id: firstInvoiceId, bill_id: 'b1', is_reprint: false, printer_id: 'p-one' });
    // The payment's own write comes first: the print is never queued for a bill not yet closed.
    const order = r.writes.map((w) => `${w.table}:${w.op}`);
    expect(order.indexOf('bill:update'), name).toBeLessThan(order.indexOf('print_job:insert'));
  }
});

/* ── 4. Invoice off: asks after every successful payment ────────────────────────────────── */

test('INVOICE OFF: the payment is recorded, nothing is printed, and the screen is told to ask', () => {
  const r = by('invoice: off');
  expect(r.threw).toBeNull();
  expect(r.out).toMatchObject({ payable: expect.any(Number), print: 'ask' });
  expect(r.final.billStatus).toBe('closed');
  expect(jobInserts(r)).toEqual([]);
});

test('Print Invoice prints the paid bill\'s invoice, once, and is not marked a reprint', () => {
  const r = by('invoice: off, print once');
  expect(r.threw).toBeNull();
  expect((r.out as { printed: unknown }).printed).toEqual({ outcome: 'queued', printerName: 'Counter' });
  expect(jobs(r, 'Invoice')).toHaveLength(1);
  expect(jobs(r, 'Invoice')[0]).toMatchObject({ id: firstInvoiceId, bill_id: 'b1', is_reprint: false });
  // Nothing on the bill moves: the one bill write is the payment itself.
  expect(r.writes.filter((w) => w.table === 'bill')).toHaveLength(1);
});

/* ── 5. One-time printing never changes either saved setting ────────────────────────────── */

test('one-time Print KOT and Print Invoice write no setting - both switches stay exactly as saved', () => {
  for (const name of ['kot: off, print once', 'invoice: off, print once', 'switches: both off, print both once', 'kot: off, print once, then the next round']) {
    const r = by(name);
    expect(r.threw, name).toBeNull();
    expect(settingWrites(r), name).toEqual([]);
  }
  expect(by('switches: both off, print both once').final.print).toEqual({ kotEnabled: false, invoiceEnabled: false });
  expect(jobs(by('switches: both off, print both once'))).toHaveLength(2);
});

/* ── 6. Skipping never prints ───────────────────────────────────────────────────────────── */

test('Skip sends nothing: with the switch off, a round or a payment and no Print writes no print job at all', () => {
  // Skip is the prompt closing without a request (print-ask.render.spec.ts proves no request is
  // sent); this is the server half - without that request, nothing is ever queued.
  for (const name of ['kot: off', 'kot: off, two rounds', 'invoice: off', 'kot: off, a guest round']) {
    expect(jobInserts(by(name)), name).toEqual([]);
    expect(by(name).final.jobs, name).toEqual([]);
  }
});

/* ── 7. The two switches are independent ────────────────────────────────────────────────── */

test('KOT off does not stop the invoice, and invoice off does not stop the KOT', () => {
  const a = by('switches: KOT off, invoice on').out as { round: { print: string }; paid: { print: string } };
  expect(a.round.print).toBe('ask');
  expect(a.paid.print).toBe('queued');
  expect(jobs(by('switches: KOT off, invoice on'), 'KOT')).toHaveLength(0);
  expect(jobs(by('switches: KOT off, invoice on'), 'Invoice')).toHaveLength(1);

  const b = by('switches: KOT on, invoice off').out as { round: { print: string }; paid: { print: string } };
  expect(b.round.print).toBe('queued');
  expect(b.paid.print).toBe('ask');
  expect(jobs(by('switches: KOT on, invoice off'), 'KOT')).toHaveLength(1);
  expect(jobs(by('switches: KOT on, invoice off'), 'Invoice')).toHaveLength(0);
});

test('saving one switch never moves the other, or anything else stored under print', () => {
  const kotOff = by('switches: save KOT off');
  expect(kotOff.threw).toBeNull();
  expect(kotOff.final.print).toEqual({ invoiceEnabled: false, splitByFoodType: true, kotEnabled: false });
  const invOn = by('switches: save invoice on');
  expect(invOn.final.print).toEqual({ kotEnabled: false, invoiceEnabled: true });
});

test('only the printer grant saves a switch - the existing permission, unchanged', () => {
  const r = by('switches: save without the printer grant');
  expect(r.threw).toMatch(/Not permitted/);
  expect(settingWrites(r)).toEqual([]);
  expect(r.final.print).toEqual({ kotEnabled: true });
});

test('a missing or odd value keeps printing automatic - only an explicit false turns it off', () => {
  expect(printsAutomatically(undefined, 'KOT')).toBe(true);
  expect(printsAutomatically({}, 'Invoice')).toBe(true);
  expect(printsAutomatically({ kotEnabled: 'no' }, 'KOT')).toBe(true);
  expect(printsAutomatically({ kotEnabled: false }, 'KOT')).toBe(false);
  expect(printsAutomatically({ kotEnabled: false }, 'Invoice')).toBe(true);
  expect(printsAutomatically({ invoiceEnabled: false }, 'KOT')).toBe(true);
});

/* ── 8. A payment that did not succeed never prints an invoice ──────────────────────────── */

test('Print Invoice is refused for an open bill, one waiting for payment, and a cancelled order - before any write', () => {
  for (const name of [
    'invoice: print once on an open bill',
    'invoice: print once on a bill waiting for payment',
    'invoice: print once on a cancelled order',
  ]) {
    const r = by(name);
    expect(r.threw, name).toMatch(/has not been paid, so there is no invoice to print/);
    expect(r.writes, name).toEqual([]);
  }
});

test('recording a payment on a cancelled order is refused, and prints nothing', () => {
  const r = by('invoice: a cancelled order is not paid, and prints nothing');
  expect(r.threw).toMatch(/cancelled/);
  expect(jobInserts(r)).toEqual([]);
});

/* ── 9. Duplicate events and repeated taps never make a second job ──────────────────────── */

test('Print KOT tapped twice, or twice at the same instant: one job, and the second is told it was already sent', () => {
  for (const name of ['kot: off, print once, tapped twice', 'kot: off, print once, two at the same instant']) {
    const r = by(name);
    expect(r.threw, name).toBeNull();
    const outcomes = (r.out as Array<{ outcome: string }>).map((o) => o.outcome).sort();
    expect(outcomes, name).toEqual(['already', 'queued']);
    expect(jobs(r, 'KOT'), name).toHaveLength(1);
  }
});

test('Print KOT on a round that already printed by itself is answered "already" - never a second first print', () => {
  const r = by('kot: on, print once on a round that printed by itself');
  expect(r.out).toEqual({ outcome: 'already', printerName: '' });
  expect(jobs(r, 'KOT')).toHaveLength(1);
});

test('Print Invoice tapped twice, or twice at the same instant: one job - the second meets the first on its id', () => {
  const twice = by('invoice: off, print once, tapped twice');
  expect((twice.out as Array<{ outcome: string }>).map((o) => o.outcome)).toEqual(['queued', 'already']);
  expect(jobs(twice, 'Invoice')).toHaveLength(1);

  const race = by('invoice: off, print once, two at the same instant');
  expect(race.threw).toBeNull();
  expect((race.out as Array<{ outcome: string }>).map((o) => o.outcome).sort()).toEqual(['already', 'queued']);
  expect(jobs(race, 'Invoice')).toHaveLength(1);
  // The second was stopped by the database's primary key, not by luck of timing.
  expect(race.writes.some((w) => w.table === 'print_job' && w.refused === '23505')).toBe(true);
});

test('Print Invoice after the invoice printed by itself is answered "already"', () => {
  const r = by('invoice: on, print once after it printed by itself');
  expect(r.out).toEqual({ outcome: 'already', printerName: '' });
  expect(jobs(r, 'Invoice')).toHaveLength(1);
});

test('a payment recorded twice (a retried callback) prints the invoice once, and does not ask a second time', () => {
  const on = by('invoice: the payment recorded twice');
  const [first, second] = on.out as Array<Record<string, unknown>>;
  expect(first?.print).toBe('queued');
  expect(second).not.toHaveProperty('print');
  expect(jobs(on, 'Invoice')).toHaveLength(1);

  const off = by('invoice: off, the payment recorded twice');
  const [a, b] = off.out as Array<Record<string, unknown>>;
  expect(a?.print).toBe('ask');
  expect(b).not.toHaveProperty('print');
  expect(jobInserts(off)).toEqual([]);
});

test('the first-invoice id is fixed per bill and different between bills', () => {
  expect(firstInvoiceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(otherInvoiceId).not.toBe(firstInvoiceId);
});

/* ── 10. Printer trouble never undoes an order or a payment ─────────────────────────────── */

test('a KOT whose print job cannot be written: the round is placed and the screen is told, not failed', () => {
  const r = by('kot: on, its print job cannot be written');
  expect(r.threw).toBeNull();
  expect(r.out).toMatchObject({ kotCode: 'KOT-1', print: 'failed', printProblem: expect.stringMatching(/could not be sent/) });
  expect(r.writes.some((w) => w.table === 'kot_item' && w.op === 'insert')).toBe(true);
  // Marked failed, so the round card's existing "Print failed" and Reprint apply.
  expect(r.final.kot?.print_status).toBe('failed');
});

test('an invoice whose print job cannot be written: the payment stands, the counter notice is resolved, the screen is told', () => {
  const r = by('invoice: on, its print job cannot be written');
  expect(r.threw).toBeNull();
  expect(r.out).toMatchObject({ payable: expect.any(Number), print: 'failed' });
  expect(r.final.billStatus).toBe('closed');
  expect(r.writes.some((w) => w.table === 'table_request' && w.op === 'update')).toBe(true);
  // Nothing tries to reopen the bill or reverse the payment.
  expect(r.writes.filter((w) => w.table === 'bill')).toHaveLength(1);
});

test('no printer for the kind: Print says so in words, writes nothing, and the round stays printable', () => {
  const kot = by('kot: print once with no kitchen printer');
  expect(kot.threw).toMatch(/No printer is set to print kitchen tickets/);
  expect(kot.writes).toEqual([]);
  expect(kot.final.kot?.print_status).toBe('cancelled');
  const inv = by('invoice: print once with no bill printer');
  expect(inv.threw).toMatch(/No printer is set to print bills/);
  expect(inv.writes).toEqual([]);
});

test('Print KOT on a round whose every line was cancelled is refused in words - no empty ticket, and the round stays as it was', () => {
  const r = by('kot: print once on a round whose every line was cancelled');
  expect(r.threw).toMatch(/Every item on KOT-0 was cancelled — there is nothing to print/);
  expect(r.writes).toEqual([]);
  expect(r.final.kot?.print_status).toBe('cancelled');
});

test('Print KOT needs the Reprint grant and Print Invoice the payment grant - and a refusal writes nothing', () => {
  expect(by('kot: print once without the grant').threw).toMatch(/Not permitted: Reprint a KOT/);
  expect(by('kot: print once without the grant').writes).toEqual([]);
  expect(by('invoice: print once without the grant').threw).toMatch(/Not permitted: Record payment/);
  expect(by('invoice: print once without the grant').writes).toEqual([]);
});

test('a never-printed round changed after the kitchen started is not reprinted; a printed one still is', () => {
  const never = by('kot: never printed, quantity changed after the kitchen started');
  expect(never.threw).toBeNull();
  expect(jobInserts(never)).toEqual([]);
  const printed = by('kot: printed, quantity changed after the kitchen started');
  expect(printed.threw).toBeNull();
  expect(jobs(printed, 'KOT')).toHaveLength(1);
  expect(jobs(printed, 'KOT')[0]).toMatchObject({ is_reprint: true });
});

/* ── The wiring the scenarios cannot reach ──────────────────────────────────────────────── */

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('the prompts and the switches carry the words the request gave', () => {
  expect(KOT_ASK).toEqual({ title: 'Do you want to print this KOT?', print: 'Print KOT', skip: 'Skip' });
  expect(INVOICE_ASK).toEqual({ title: 'Payment successful. Do you want to print the invoice?', print: 'Print Invoice', skip: 'Skip' });
  expect(SWITCH_LABEL).toEqual({ kot: 'Enable KOT Printing', invoice: 'Enable Invoice Printing' });
});

test('both app shells mount the print prompt, each speaking to its own route', () => {
  expect(code('src/features/staff/StaffApp.tsx')).toContain('<PrintAskProvider endpoint="/api/staff/action" send={send} grants={data.grants}>');
  expect(code('src/features/owner/OwnerConsole.tsx')).toContain('<PrintAskProvider endpoint="/api/owner/action" send={send} grants={data.grants}>');
});

test('every screen that places a round or records a payment hands the answer to the prompt', () => {
  const staff = code('src/features/staff/StaffTables.tsx');
  expect(staff).toContain("printAsk.after(res, { kind: 'Invoice', billId: bill.id, code: bill.code })");
  expect(staff).toMatch(/printAsk\.after\(res, \{\s*kind: 'KOT',\s*kotId: res\.kotId/);
  expect(code('src/features/owner/CloseBillSheet.tsx')).toContain("printAsk.after(res, { kind: 'Invoice', billId: bill.id, code: bill.code })");
  const dash = code('src/features/owner/sections/Dashboard.tsx');
  expect(dash.match(/printAsk\.after\(res, \{ kind: 'KOT'/g)).toHaveLength(2);
});

test('both routes carry the one-time Print actions and the round\'s print answer', () => {
  for (const path of ['src/app/api/staff/action/route.ts', 'src/app/api/owner/action/route.ts']) {
    const route = code(path);
    expect(route, path).toContain("case 'print-kot':");
    expect(route, path).toContain('printKotOnce({ kotId: String(input.kotId ?? \'\'), actor })');
    expect(route, path).toContain("case 'print-invoice':");
    expect(route, path).toContain('printInvoiceOnce({ billId: String(input.billId ?? \'\'), actor })');
    expect(route, path).toMatch(/print: (result|placed)\.print,/);
  }
});

test('the switches sit under Settings → Printers & machines, saved through the existing print setting', () => {
  const setup = code('src/features/owner/sections/PrintSetupSection.tsx');
  expect(setup).toContain("action: 'write-setting', key: 'print', value: { [key]: on }");
  expect(setup).toContain('testId="owner-print-kot-enabled"');
  expect(setup).toContain('testId="owner-print-invoice-enabled"');
  // The existing grant: no new permission, no second printer configuration.
  expect(code('src/lib/db/owner-mutations.ts')).toContain("print: 'set.printer',");
});

test('rounds never printed offer Print KOT in place of Reprint, on all three round lists', () => {
  for (const path of ['src/features/staff/StaffTables.tsx', 'src/features/staff/StaffLists.tsx', 'src/features/owner/sections/LiveOrders.tsx']) {
    const ui = code(path);
    expect(ui, path).toContain('neverPrinted(k)');
    expect(ui, path).toContain("printAsk.printNow({ kind: 'KOT', kotId: k.id, code: k.code })");
    expect(ui, path).toContain('<Pill tone="neutral">Not printed</Pill>');
  }
});
