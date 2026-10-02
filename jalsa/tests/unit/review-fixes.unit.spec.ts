import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { mainPrinter, resolvePrinter, type RoutablePrinter } from '../../src/lib/print-routing';
import { buildBill, defaultTemplate, type TicketData } from '../../src/lib/print-template';

/**
 * 02-Oct-2026 — the defects the five-phase review found, each held by a rung.
 *
 * Takeaway writes are the REAL code on the round rig (tests/support/rounds/takeaway.scenarios.ts);
 * the print redirect's database half is in print-redirect.db.unit.spec.ts, its server half in
 * print-reliability.unit.spec.ts.
 */

interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  writes: Array<{ table: string; op: string; body: Record<string, unknown> | null }>;
  reads?: string[];
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/takeaway.scenarios.ts', import.meta.url));
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

/* ── Routing: a main kitchen machine given Bills stays the main kitchen machine ───────────── */

const printer = (p: Partial<RoutablePrinter> & { id: string; machineId: string }): RoutablePrinter => ({
  name: p.id,
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: false,
  enabled: true,
  ...p,
});

test('B1: ticking Bills on the main kitchen printer does not send unrouted dishes to the Tandoor', () => {
  const main = printer({ id: 'main', machineId: 'KOT-1', roles: ['KOT', 'Invoice'] });
  const tandoor = printer({ id: 'tandoor', machineId: 'KOT-2', station: 'Tandoor', routes: ['Tandoor'] });
  expect(mainPrinter('KOT', [main, tandoor])?.id).toBe('main');
  expect(resolvePrinter({ purpose: 'KOT', category: 'Rice', printers: [main, tandoor] }).printer?.id).toBe('main');
  // The Tandoor still gets what it claims.
  expect(resolvePrinter({ purpose: 'KOT', category: 'Tandoor', printers: [main, tandoor] }).printer?.id).toBe('tandoor');
  // Before the fix the answer was the Tandoor: a single-kind machine outranked a machine with no
  // category of its own. A counter printer set to both, beside a dedicated free kitchen machine,
  // still loses to it - that half of the rule is kept.
  const counter = printer({ id: 'counter', machineId: 'A-POS', station: 'Billing', roles: ['KOT', 'Invoice'] });
  expect(mainPrinter('KOT', [counter, main, tandoor].map((p) => (p.id === 'main' ? { ...p, roles: ['KOT'] } : p)))?.id).toBe('main');
});

/* ── Paper: the TOTAL never includes a charge the paper does not show ─────────────────────── */

test('N4: the packaging charge still prints when the GST lines are switched off', () => {
  // Revised 02-Oct-2026 (final GST rule): this fixture was a TAXED packaging charge (GST 18 on
  // 340 + 25, payable 383) printing above the GST lines. Packaging is never taxed now: GST 17 on
  // the food, payable 382, and the charge prints once, after the GST lines.
  const data: TicketData = {
    restaurant: 'JALSA', branch: '', phone: '', gstin: '', kotCode: '', station: '', roundCode: '', billCode: 'TK-1',
    table: '', customer: '', captain: '', date: '02 Oct', time: '13:00', source: '', note: '', orderType: 'takeaway',
    items: [{ name: 'Chicken Fried Rice', qty: 2, foodType: 'non_veg', rate: 170, category: 'Rice', instruction: '' }],
    totals: { subtotal: 340, discount: 0, tax: 17, payable: 382, paymentMode: 'Cash', packaging: 25 },
  };
  const base = defaultTemplate('bill', '80');
  const noTax = { ...base, modes: { ...(base.modes ?? {}), tax: 'off' as const } };
  const lines = buildBill(data, noTax).map((l) => l.text.trim());
  expect(lines.some((l) => l.startsWith('CGST'))).toBe(false);
  expect(lines.filter((l) => l.startsWith('PACKAGING CHARGES'))).toHaveLength(1);
  // With the GST lines on, it prints once, after them.
  const withTax = buildBill(data, base).map((l) => l.text.trim());
  expect(withTax.filter((l) => l.startsWith('PACKAGING CHARGES'))).toHaveLength(1);
  expect(withTax.findIndex((l) => l.startsWith('PACKAGING CHARGES'))).toBeGreaterThan(withTax.findIndex((l) => l.startsWith('SGST')));
});

/* ── Takeaway ─────────────────────────────────────────────────────────────────────────────── */

test('S7: a packaging charge cannot change once the guest has asked to pay - and nothing is written', () => {
  const r = by('packaging, guest asked to pay');
  expect(r.threw).toMatch(/has asked to pay\. Its packaging charge can no longer change/);
  expect(r.writes).toEqual([]);
  const open = by('packaging, still open');
  expect(open.threw).toBeNull();
  expect(open.writes.find((w) => w.table === 'bill' && w.op === 'update')?.body).toMatchObject({ packaging_charge: 30 });
});

test('a more-items round asks for the grant before it reads the bill', () => {
  const r = by('more items, no grant');
  expect(r.threw).toMatch(/Not permitted/);
  expect(r.reads ?? ['not recorded']).toEqual([]);
  const route = readFileSync('src/app/api/owner/action/route.ts', 'utf8');
  expect(route).toContain('const bill = await openTakeawayFor({ billId: input.billId, actor });');
});

test('S2: a takeaway whose round failed part-way keeps its bill when a round reached the kitchen', () => {
  // Superseded 02-Oct-2026 (second review): this previously read the source of dropEmptyTakeaway
  // (a count of KOT rows, and a read error that returned silently). It keyed on the wrong row - an
  // EMPTY KOT kept the bill - so it now counts the round's LINES, and this rung runs the real code.
  const after = by('round fails after its lines');
  expect(after.threw).toMatch(/TK-1 may already be with the kitchen, but finishing it failed \(print_job insert failed\)\. Check Live orders before placing it again\./);
  expect(after.writes.some((w) => w.table === 'bill' && w.op === 'delete')).toBe(false);
  const before = by('round fails before its lines');
  expect(before.threw).not.toBeNull();
  expect(before.writes.some((w) => w.table === 'bill' && w.op === 'delete')).toBe(true);
  expect(by('everything sold out').writes.some((w) => w.table === 'bill' && w.op === 'delete')).toBe(true);
});

test('N1: the captain app offers no "Add items for this table" on a takeaway', () => {
  const s = readFileSync('src/features/staff/StaffTables.tsx', 'utf8');
  expect(s).toContain("{canAdd && bill.orderType !== 'takeaway' ? (");
});

test('N2: print history says TAKEAWAY for a takeaway ticket, not "table —"', () => {
  const q = readFileSync('src/lib/db/queries.ts', 'utf8');
  expect(q).toContain("bill(code,order_type)')");
  expect(q).toContain("table: bill?.order_type === 'takeaway' ? TAKEAWAY_LABEL :");
  const setup = readFileSync('src/features/owner/sections/PrintSetupSection.tsx', 'utf8');
  expect(setup).toContain('{j.table === TAKEAWAY_LABEL ? ` · ${TAKEAWAY_LABEL}` : ` · table ${j.table}`}');
});

/* ── Settings ─────────────────────────────────────────────────────────────────────────────── */

test('S3: Settings → Tax offers no GST-on-packaging choice - the rule is fixed, and saving writes none', () => {
  // Superseded 02-Oct-2026 (final GST rule): this previously asserted that choosing "Not decided"
  // saved `packagingTaxable: null` instead of keeping an earlier decision. The choice is gone:
  // packaging is never taxed, so there is nothing to decide, save or keep.
  const s = readFileSync('src/features/owner/sections/SettingsSection.tsx', 'utf8');
  expect(s).not.toContain('packagingTaxable');
  expect(s).not.toMatch(/owner-gst-packaging-(undecided|taxed|untaxed|\$\{key\})/);
  expect(s).not.toContain('Charge GST on packaging');
  expect(s).toContain('GST is charged on food only.');
});

test('S7: Live orders offers Change on the packaging charge only while the takeaway is open', () => {
  const s = readFileSync('src/features/owner/sections/LiveOrders.tsx', 'utf8');
  expect(s).toContain("{canTakeaway && selected.status === 'open' ? (");
  expect(s).not.toContain("selected.status === 'open' || selected.status === 'payment_requested'");
});

test('the packaging write itself is conditional on the takeaway being open - a guest asking to pay in between wins', () => {
  const open = by('packaging, still open');
  const write = open.writes.find((w) => w.table === 'bill' && w.op === 'update') as unknown as { filters?: string[] } | undefined;
  expect(write).toBeDefined();
  const m = readFileSync('src/lib/db/mutations.ts', 'utf8');
  const fn = m.slice(m.indexOf('export async function setPackagingCharge'));
  expect(fn.slice(0, fn.indexOf('\n}\n'))).toContain(".eq('status', 'open')");
  expect(fn.slice(0, fn.indexOf('\n}\n'))).not.toContain("'payment_requested'])");
});
