import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

/**
 * 02-Oct-2026 — a takeaway is an order at NO table.
 *
 * The real `placeTakeaway` -> `placeRound` -> `queuePrint` runs against fake-supabase (see
 * tests/support/rounds/takeaway.scenarios.ts) and every write is reported. What this holds:
 *   - the bill is `order_type: 'takeaway'` with no host table, and no `bill_table` row is written
 *     (no dummy table);
 *   - the round's KOT has `table_id: null`;
 *   - the packaging charge is stored as entered, per order - and never taxed (revised 02-Oct-2026:
 *     this previously said "with the owner's GST decision snapshot beside it");
 *   - a refusal (no permission, a bad amount) writes NOTHING;
 *   - an order whose every dish is sold out leaves no empty takeaway behind;
 *   - the KOT routes through the ordinary printers - including one printer used for both kinds.
 */

interface Write {
  table: string;
  op: string;
  body: Record<string, unknown> | Array<Record<string, unknown>>;
}
interface Result {
  name: string;
  out: { billId: string; billCode: string; kotCode: string; refused: string[] } | null;
  threw: string | null;
  writes: Write[];
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/takeaway.scenarios.ts', import.meta.url));
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no scenario named ${name}`);
  return r;
};
const rows = (r: Result, table: string, op = 'insert'): Array<Record<string, unknown>> =>
  r.writes.filter((w) => w.table === table && w.op === op).flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body]));

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

test('a takeaway is a bill at no table, and its round is at no table - no dummy table anywhere', () => {
  const r = by('placed with no packaging');
  expect(r.threw).toBeNull();
  expect(r.out?.billId).toBe('b-take');
  const [bill] = rows(r, 'bill');
  // Revised 02-Oct-2026 (final GST rule): previously also `packaging_taxable: null`; the column is gone.
  expect(bill).toMatchObject({ order_type: 'takeaway', host_table_id: null, packaging_charge: 0 });
  expect(bill).not.toHaveProperty('packaging_taxable');
  expect(rows(r, 'bill_table')).toEqual([]);
  const [kot] = rows(r, 'kot');
  expect(kot).toMatchObject({ table_id: null, source: 'owner', bill_id: 'b-take' });
  expect(rows(r, 'kot_item')).toHaveLength(1);
});

test('the takeaway KOT is a print job like any round\'s', () => {
  const jobs = rows(by('placed with no packaging'), 'print_job');
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ kind: 'KOT', printer_id: 'p-kot', status: 'queued' });
});

test('one printer used for both kinds takes the takeaway KOT', () => {
  const jobs = rows(by('one printer for both'), 'print_job');
  expect(jobs[0]).toMatchObject({ kind: 'KOT', printer_id: 'p-both', status: 'queued' });
});

/* Superseded 02-Oct-2026 (the owner's final rule: GST on food only, packaging never taxed). The
   two tests here previously asserted that a packaging charge was REFUSED until the owner decided
   whether GST applied to it, and that the decision was snapshot as `packaging_taxable` beside the
   charge. There is no decision any more, and no column: every typed amount is stored as entered. */
test('any packaging charge is stored exactly as typed, per order - no decision is asked for', () => {
  for (const amount of [10, 20, 25, 40, 50, 100, 500]) {
    const r = by(`packaging ${amount}`);
    expect(r.threw, `₹${amount}`).toBeNull();
    const [bill] = rows(r, 'bill');
    expect(bill, `₹${amount}`).toMatchObject({ order_type: 'takeaway', packaging_charge: amount });
    expect(bill, `₹${amount}`).not.toHaveProperty('packaging_taxable');
  }
});

test('only someone who may place an order may place a takeaway - and a refusal writes nothing', () => {
  const r = by('no orders.create');
  expect(r.threw).toMatch(/Not permitted: Place an order/);
  expect(r.writes).toEqual([]);
});

test('a negative packaging charge is refused before anything is written', () => {
  const r = by('a negative packaging charge');
  expect(r.threw).toMatch(/cannot be negative/);
  expect(r.writes).toEqual([]);
});

test('an order whose every dish is sold out leaves no empty takeaway open', () => {
  const r = by('everything sold out');
  expect(r.out).toMatchObject({ billId: '', refused: ['Chicken Fried Rice'] });
  expect(rows(r, 'bill', 'delete')).toHaveLength(1);
  expect(rows(r, 'kot')).toEqual([]);
});

/* ── The doors into it ──────────────────────────────────────────────────────────────────────── */

const code = (p: string): string => readFileSync(p, 'utf8');

test('the owner route carries takeaway, takeaway-round and set-packaging into the operations', () => {
  const route = code('src/app/api/owner/action/route.ts');
  expect(route).toContain("case 'takeaway': {");
  expect(route).toContain('const placed = await placeTakeaway({');
  expect(route).toContain("case 'takeaway-round': {");
  // Superseded 02-Oct-2026 (permission review): this previously asserted the route read the bill
  // itself and checked `bill.orderType !== 'takeaway' || bill.status !== 'open'`. That read now
  // happens in `openTakeawayFor`, AFTER the grant (review-fixes.unit.spec.ts holds the order).
  expect(route).toContain('const bill = await openTakeawayFor({ billId: input.billId, actor });');
  expect(route).toContain('if (!bill) {');
  expect(route).toContain('placeRound({ billId: bill.id, tableId: null, lines: input.lines, source: \'owner\', actor })');
  expect(route).toContain("case 'set-packaging':");
});

test('Dashboard and Live Orders offer Takeaway only to someone holding both order grants', () => {
  for (const file of ['src/features/owner/sections/Dashboard.tsx', 'src/features/owner/sections/LiveOrders.tsx']) {
    const ui = code(file);
    expect(ui, file).toMatch(/orders\.add_items[\s\S]{0,80}orders\.create|canOrder && data\.grants\.includes\('orders\.create'\)/);
    expect(ui, file).toContain("{ kind: 'takeaway' }");
  }
  // ONE menu: Live Orders opens the Dashboard's sheet, never a second ordering screen.
  expect(code('src/features/owner/sections/LiveOrders.tsx')).toContain("import { NewRoundSheet, targetKey, taxFor, type RoundTarget } from './Dashboard';");
});

test('the takeaway review totals with totalBill - the one function every bill is totalled with', () => {
  const ui = code('src/features/owner/sections/Dashboard.tsx');
  expect(ui).toContain('const review = totalBill({');
  expect(ui).toContain('packaging: packagingIssue ? 0 : packaging,');
  expect(ui).toContain('data-testid="owner-takeaway-packaging"');
});

test('a takeaway is never joined to a table', () => {
  const mu = code('src/lib/db/mutations.ts');
  const fn = mu.slice(mu.indexOf('export async function joinTableToBill'));
  expect(fn.indexOf("if (bill.orderType === 'takeaway')")).toBeLessThan(fn.indexOf(".from('bill_table').insert"));
});

/* ── Phase 3: closing a takeaway - packaging, GST, the bill print ───────────────────────────── */

test('closing a takeaway charges the packaging once, after GST, and GST on the food only', () => {
  const r = by('close, packaging 25, one printer for both');
  expect(r.threw).toBeNull();
  // 340 food + 17 GST (5% of 340) + 25 packaging = 382. Packaging is not an item and not taxed.
  expect(r.out).toEqual({ payable: 382 });
});

test('the packaging charge never moves the GST - 0, 25 or 100, the GST is 5% of the food', () => {
  // Superseded 02-Oct-2026 (final GST rule): this previously asserted that a bill whose owner had
  // chosen "GST on packaging" closed at 383 - GST on (340 + 25). That choice no longer exists.
  // 340 + 17 = 357; + 25 = 382; + 100 = 457. The GST is 17 in all three.
  expect(by('close, packaging 0').out).toEqual({ payable: 357 });
  expect(by('close, packaging 100').out).toEqual({ payable: 457 });
  // Payable less food less the one GST figure leaves exactly the packaging - included once.
  for (const [name, packaging] of [['close, packaging 0', 0], ['close, packaging 25, one printer for both', 25], ['close, packaging 100', 100]] as const) {
    const payable = (by(name).out as unknown as { payable: number }).payable;
    expect(payable - 340 - 17, name).toBe(packaging);
  }
});

test('one printer used for both kinds prints the takeaway\'s bill too', () => {
  const jobs = rows(by('close, packaging 25, one printer for both'), 'print_job');
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ kind: 'Invoice', printer_id: 'p-both', status: 'queued' });
});

test('with only a kitchen printer the bill is never sent to it - it is recorded as having nowhere to go', () => {
  const jobs = rows(by('close, only a kitchen printer'), 'print_job');
  expect(jobs[0]).toMatchObject({ kind: 'Invoice', printer_id: null, status: 'failed' });
});
