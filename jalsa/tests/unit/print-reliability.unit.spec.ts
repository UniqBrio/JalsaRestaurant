import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { buildBill, defaultTemplate, type TicketData } from '../../src/lib/print-template';
import { PRINT_STATUS } from '../../src/components/ui/print';

/**
 * 02-Oct-2026 — printing that cannot print a round twice, cannot strand a ticket, and can give
 * the counter a second copy of a bill without selling it twice.
 *
 * The server code is the REAL code on the round rig (tests/support/rounds/print-reliability.scenarios.ts);
 * the transaction itself - the row lock, the cancel and the insert together - is exercised
 * against Postgres in print-redirect.db.unit.spec.ts.
 */

interface Write {
  table: string;
  op: string;
  body: Record<string, unknown> | null;
  filters: string[];
}
interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  writes: Write[];
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/print-reliability.scenarios.ts', import.meta.url));
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

test('the scenarios ran - a rig that parsed nothing is not a passing rig', () => {
  expect(results.length).toBe(13);
});

/* ── Print elsewhere ──────────────────────────────────────────────────────────────────────── */

test('Print elsewhere on a waiting ticket goes through the ONE transactional redirect, and writes nothing else to print_job', () => {
  const r = by('elsewhere, waiting');
  expect(r.threw).toBeNull();
  const rpc = r.writes.filter((w) => w.op === 'rpc');
  expect(rpc).toHaveLength(1);
  expect(rpc[0]).toMatchObject({
    table: 'redirect_print_job',
    body: { p_job_id: 'j1', p_restaurant_id: 'r1', p_printer_id: 'p-kot', p_printer_name: 'Kitchen', p_station: 'Main Kitchen', p_requested_by: 'Meena · Owner' },
  });
  // No separate insert or update of print_job from TypeScript: a two-step redirect is the window
  // in which both tickets print.
  expect(r.writes.filter((w) => w.table === 'print_job' && (w.op === 'insert' || w.op === 'update'))).toEqual([]);
  expect(r.writes.some((w) => w.table === 'audit_entry' && w.op === 'insert')).toBe(true);
});

test('a printed or failed ticket can still be sent elsewhere - the function decides what happens to the original', () => {
  for (const name of ['elsewhere, printed', 'elsewhere, failed']) {
    expect(by(name).threw, name).toBeNull();
    expect(by(name).writes.filter((w) => w.op === 'rpc'), name).toHaveLength(1);
  }
});

test('a ticket a machine is printing right now, or one already sent elsewhere, is refused before any write', () => {
  expect(by('elsewhere, printing now').threw).toMatch(/being printed at Tandoor right now/);
  expect(by('elsewhere, already sent elsewhere').threw).toMatch(/already sent to another machine/);
  for (const name of ['elsewhere, printing now', 'elsewhere, already sent elsewhere', 'elsewhere, no grant']) {
    expect(by(name).writes, name).toEqual([]);
  }
});

/* ── Retry ────────────────────────────────────────────────────────────────────────────────── */

test('Retry refuses a cancelled ticket - re-sending it would print the round twice', () => {
  const r = by('retry, a cancelled job');
  expect(r.threw).toMatch(/sent to another machine instead/);
  expect(r.writes).toEqual([]);
});

test('Retry of a failed ticket still works, and its write cannot revive a job cancelled meanwhile', () => {
  const r = by('retry, a failed job');
  expect(r.threw).toBeNull();
  const update = r.writes.find((w) => w.table === 'print_job' && w.op === 'update');
  expect(update?.body).toMatchObject({ status: 'queued' });
  expect(update?.filters).toContain('neq:status=cancelled');
});

/* ── Bill reprint ─────────────────────────────────────────────────────────────────────────── */

test('a bill reprint writes ONE print job marked a reprint and an audit row - nothing on the bill, no payment', () => {
  const r = by('reprint bill, settled');
  expect(r.threw).toBeNull();
  expect(r.out).toEqual({ printerName: 'Counter' });
  const tables = r.writes.map((w) => `${w.table}:${w.op}`);
  expect(tables.sort()).toEqual(['audit_entry:insert', 'print_job:insert']);
  const job = r.writes.find((w) => w.table === 'print_job')!.body as unknown as Array<Record<string, unknown>>;
  expect(job).toHaveLength(1);
  expect(job[0]).toMatchObject({ kind: 'Invoice', bill_id: 'b1', printer_id: 'p-inv', is_reprint: true, status: 'queued' });
  // Nothing that counts money is written: no bill, no tip, no payment.
  for (const t of ['bill', 'tip', 'payment']) expect(tables.some((x) => x.startsWith(`${t}:`)), t).toBe(false);
});

test('a bill reprint needs bill.reprint, a settled bill, and a printer that prints bills - and writes nothing otherwise', () => {
  expect(by('reprint bill, no grant').threw).toMatch(/Not permitted: Reprint a bill/);
  expect(by('reprint bill, still open').threw).toMatch(/Only a settled bill can be reprinted/);
  expect(by('reprint bill, nothing prints bills').threw).toMatch(/No printer prints bills/);
  for (const name of ['reprint bill, no grant', 'reprint bill, still open', 'reprint bill, nothing prints bills']) {
    expect(by(name).writes, name).toEqual([]);
  }
});

test('the reprinted bill says REPRINT above everything, and a first print does not', () => {
  const data: TicketData = {
    restaurant: 'JALSA', branch: '', phone: '', gstin: '', kotCode: '', station: '', roundCode: '', billCode: 'B-104',
    table: 'A5', customer: '', captain: '', date: '02 Oct', time: '21:10', source: '', note: '',
    items: [{ name: 'Paneer Tikka', qty: 1, foodType: 'veg', rate: 240, category: 'Starters', instruction: '' }],
    totals: { subtotal: 240, discount: 0, tax: 12, payable: 252, paymentMode: 'Cash' },
  };
  const reprint = buildBill(data, defaultTemplate('bill', '80'), { reprint: true }).map((l) => l.text.trim());
  const first = buildBill(data, defaultTemplate('bill', '80')).map((l) => l.text.trim());
  expect(reprint[0]).toContain('*** REPRINT ***');
  expect(first.join('\n')).not.toContain('REPRINT');
  // The same totals either way - a copy, not a second bill.
  expect(reprint.find((l) => l.startsWith('TOTAL'))).toBe(first.find((l) => l.startsWith('TOTAL')));
  // And the bridge hands the job's own flag to the bill template, as it always did for a KOT.
  expect(readFileSync('src/lib/print-template.ts', 'utf8')).toContain(
    "(kind === 'kot' ? buildKot(data, config, opts) : buildBill(data, config, opts))"
  );
});

test('the button is the owner console\'s, for holders of bill.reprint, on a settled bill only', () => {
  const pay = readFileSync('src/features/owner/sections/Payments.tsx', 'utf8');
  expect(pay).toContain("const canReprint = data.grants.includes('bill.reprint');");
  expect(pay).toContain("action: 'reprint-bill',");
  const sheet = readFileSync('src/features/owner/BillDetailSheet.tsx', 'utf8');
  expect(sheet).toContain("{reprint && bill.status === 'closed' ? (");
  const route = readFileSync('src/app/api/owner/action/route.ts', 'utf8');
  expect(route).toContain("return ok(await reprintBill({ billId: input.billId, actor }));");
});

/* ── The sweeper ──────────────────────────────────────────────────────────────────────────── */

test('stale claims are swept at most once a minute per restaurant - never once per poll', () => {
  const r = by('sweep throttle');
  expect(r.threw).toBeNull();
  const sweeps = r.writes.filter((w) => w.table === 'print_job' && w.op === 'update');
  // r1 at t0, r1 again at t0 + 60s, r2 once: three. The two polls inside r1's minute sweep nothing.
  expect(sweeps).toHaveLength(3);
  for (const s of sweeps) expect(s.filters).toContain('eq:status=processing');
});

test('the sweeper rides requests that already arrive on a schedule - no new loop', () => {
  const bridge = readFileSync('src/app/api/bridge/route.ts', 'utf8');
  const state = readFileSync('src/app/api/owner/state/route.ts', 'utf8');
  expect(bridge).toContain('await maybeSweepStaleClaims(bridge.restaurantId);');
  expect(state).toContain('await maybeSweepStaleClaims(await currentRestaurantId());');
  const sweeper = readFileSync('src/lib/db/bridge-mutations.ts', 'utf8');
  const body = sweeper.slice(sweeper.indexOf('export async function maybeSweepStaleClaims'));
  expect(body.slice(0, body.indexOf('\n}\n'))).not.toMatch(/setInterval|setTimeout/);
});

/* ── The word on the screen ───────────────────────────────────────────────────────────────── */

test('a cancelled job reads "Sent elsewhere", neutral - not a failure, and no Retry beside it', () => {
  expect(PRINT_STATUS.cancelled).toEqual({ word: 'Sent elsewhere', tone: 'neutral' });
  const print = readFileSync('src/components/ui/print.tsx', 'utf8');
  expect(print).toContain("job.status !== 'cancelled' && job.printerId ? (");
  const setup = readFileSync('src/features/owner/sections/PrintSetupSection.tsx', 'utf8');
  expect(setup.match(/j\.status !== 'cancelled'/g)?.length).toBe(2);
});
