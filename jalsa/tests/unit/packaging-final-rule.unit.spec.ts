import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { packagingProblem, parsePackaging, totalBill, totalsRows, rupees } from '../../src/lib/money';
import { invoiceTicketData, type InvoiceBill } from '../../src/lib/invoice';
import { buildBill, defaultTemplate } from '../../src/lib/print-template';
import { summarise, type RangeBill } from '../../src/lib/report-range';

/**
 * 02-Oct-2026 — the owner's final rule for a takeaway's packaging charge.
 *
 *   Takeaway
 *     ├── Food items              GST applies
 *     └── Custom packaging charge GST does NOT apply
 *
 *   Food subtotal + GST on the food + the packaging charge typed for THIS order = grand total.
 *
 * Every figure here comes from `totalBill`, the one function every bill is totalled with - the
 * screens, the close, the paper and the report all call it - so these are the rules of every
 * surface, not of a copy.
 */

const FOOD_1000 = [{ name: 'Thali', unitPrice: 500, qty: 2 }];

/* ── Packaging: any typed amount from 0, per order ───────────────────────────────────────── */

test('every packaging amount the counter types is accepted as typed: 0, 10, 25, 50, 100, 500', () => {
  for (const amount of [0, 10, 25, 50, 100, 500]) {
    expect(packagingProblem(String(amount)), `₹${amount}`).toBeNull();
    expect(parsePackaging(String(amount)), `₹${amount}`).toBe(amount);
    expect(totalBill({ lines: FOOD_1000, taxRate: 5, packaging: amount }).packaging, `₹${amount}`).toBe(amount);
  }
  // And refused: negative, letters, a decimal (Jalsa money is whole rupees).
  expect(packagingProblem('-10')).toMatch(/cannot be negative/);
  expect(packagingProblem('abc')).toMatch(/Whole rupees only/);
  expect(packagingProblem('12.50')).toMatch(/Whole rupees only/);
});

test('four takeaways, four packaging charges - each order totals with its own, independently', () => {
  const orders = { A: 20, B: 50, C: 100, D: 0 } as const;
  const totals = Object.fromEntries(
    Object.entries(orders).map(([k, p]) => [k, totalBill({ lines: FOOD_1000, taxRate: 5, packaging: p })])
  );
  expect(totals.A).toMatchObject({ packaging: 20, tax: 50, payable: 1070 });
  expect(totals.B).toMatchObject({ packaging: 50, tax: 50, payable: 1100 });
  expect(totals.C).toMatchObject({ packaging: 100, tax: 50, payable: 1150 });
  expect(totals.D).toMatchObject({ packaging: 0, tax: 50, payable: 1050 });
  // No global price: nothing in the money module or the takeaway module holds a packaging amount.
  const money = readFileSync('src/lib/money.ts', 'utf8');
  const takeaway = readFileSync('src/lib/takeaway.ts', 'utf8');
  expect(money.length).toBeGreaterThan(1000);
  expect(takeaway).not.toMatch(/PACKAGING_(CHARGE|PRICE|RATE|DEFAULT)\b/);
  expect(money).not.toMatch(/DEFAULT_PACKAGING|PACKAGING_RATE/);
});

/* ── GST: on the food only ───────────────────────────────────────────────────────────────── */

test('GST on ₹1,000 of food is ₹50 - with ₹0, ₹50 or ₹100 of packaging, never more', () => {
  for (const packaging of [0, 50, 100]) {
    const t = totalBill({ lines: FOOD_1000, taxRate: 5, packaging });
    expect(t.taxable, `packaging ₹${packaging}`).toBe(1000);
    expect(t.tax, `packaging ₹${packaging}`).toBe(50);
  }
});

test('the owner\'s worked example: ₹1,000 food + ₹50 GST + ₹75 packaging = ₹1,125', () => {
  const t = totalBill({ lines: FOOD_1000, taxRate: 5, packaging: 75 });
  expect(t).toMatchObject({ subtotal: 1000, taxable: 1000, tax: 50, packaging: 75, payable: 1125 });
  // GST on ₹1,075 would have been ₹54 - the figure this rule exists to prevent.
  expect(t.tax).not.toBe(Math.round(1075 * 0.05));
});

test('₹0 of food and ₹50 of packaging carries ₹0 GST and comes to ₹50', () => {
  const t = totalBill({ lines: [], taxRate: 5, packaging: 50 });
  expect(t).toMatchObject({ subtotal: 0, taxable: 0, tax: 0, packaging: 50, payable: 50 });
});

/* ── Total: Food + GST + Packaging, packaging once ───────────────────────────────────────── */

test('food + GST + packaging = grand total, and packaging is in it exactly once', () => {
  for (const packaging of [0, 10, 25, 50, 100, 500]) {
    for (const discountAmount of [0, 100]) {
      const t = totalBill({ lines: FOOD_1000, taxRate: 5, packaging, discountAmount });
      expect(t.payable, `₹${packaging}, discount ₹${discountAmount}`).toBe(t.subtotal - t.discount + t.tax + t.packaging);
      expect(t.restaurantIncome).toBe(t.payable); // no tip in these
    }
  }
  // The rows every screen shows: one packaging row, after GST, and the rows add up to "To pay".
  const t = totalBill({ lines: FOOD_1000, taxRate: 5, packaging: 75 });
  const rows = totalsRows(t, { taxRate: 5 });
  expect(rows.filter((r) => r.label === 'Packaging charges')).toEqual([{ label: 'Packaging charges', value: rupees(75) }]);
  const at = (label: string): number => rows.findIndex((r) => r.label.startsWith(label));
  expect(at('Food')).toBeLessThan(at('GST'));
  expect(at('GST')).toBeLessThan(at('Packaging charges'));
  expect(rows.find((r) => r.emphasis)?.value).toBe(rupees(1125));
});

/* ── Regression: dine-in totals are exactly what they were ───────────────────────────────── */

test('dine-in GST and totals are unchanged: no packaging, the same numbers as before this change', () => {
  // Hand-computed, independent of the code under test: GST is 5% of food less discount.
  expect(totalBill({ lines: FOOD_1000, taxRate: 5 })).toMatchObject({ taxable: 1000, tax: 50, payable: 1050, packaging: 0 });
  expect(totalBill({ lines: [{ name: 'x', unitPrice: 1300, qty: 1 }], taxRate: 5, discountAmount: 100 })).toMatchObject({
    taxable: 1200,
    tax: 60,
    payable: 1260,
  });
  expect(totalBill({ lines: FOOD_1000, taxRate: 5, discountPct: 10, tip: 30 })).toMatchObject({
    discount: 100,
    tax: 45,
    payable: 900 + 45 + 30,
    restaurantIncome: 945,
  });
  expect(totalsRows(totalBill({ lines: FOOD_1000, taxRate: 5 }), { taxRate: 5 }).map((r) => r.label)).not.toContain(
    'Packaging charges'
  );
});

/* ── The takeaway bill, on paper ─────────────────────────────────────────────────────────── */

test('the printed takeaway bill: TAKEAWAY, the food, subtotal, GST on the food, packaging, total', () => {
  const bill: InvoiceBill = {
    code: 'TK-9',
    hostTable: '',
    tables: [],
    captain: 'Unassigned',
    openedAt: '2026-10-02T07:00:00Z',
    closedAt: '2026-10-02T07:20:00Z',
    discountPct: 0,
    discountAmount: 0,
    taxRate: 5,
    paymentMode: 'Cash',
    tip: 0,
    orderType: 'takeaway',
    packagingCharge: 75,
    kots: [
      {
        status: 'served',
        items: [{ name: 'Veg Thali', qty: 2, unitPrice: 500, foodType: 'veg', category: 'Meals', cancelledAt: null }],
      },
    ],
  };
  const data = invoiceTicketData(bill, { name: 'Jalsa', address: 'Hosur', phone: '', gstin: '33ABCDE1234F1Z5', upiId: '' });
  expect(data.totals).toMatchObject({ subtotal: 1000, tax: 50, packaging: 75, payable: 1125 });
  const lines = buildBill(data, defaultTemplate('bill', '80')).map((l) => l.text.trim());
  const at = (start: string): number => lines.findIndex((l) => l.startsWith(start));
  expect(lines.slice(0, 3).join('\n')).toContain('TAKEAWAY');
  expect(at('Veg Thali')).toBeGreaterThan(-1);
  expect(at('SUBTOTAL')).toBeGreaterThan(at('Veg Thali'));
  // The printed GST is the food's: 2.5% + 2.5% of ₹1,000.
  expect(lines[at('CGST')]).toMatch(/25\.00$/);
  expect(lines[at('SGST')]).toMatch(/25\.00$/);
  expect(at('PACKAGING CHARGES')).toBeGreaterThan(at('SGST'));
  expect(lines.filter((l) => l.startsWith('PACKAGING CHARGES'))).toHaveLength(1);
  expect(lines[at('PACKAGING CHARGES')]).toMatch(/75$/);
  expect(at('TOTAL')).toBeGreaterThan(at('PACKAGING CHARGES'));
  expect(lines[at('TOTAL')]).toContain('1,125');
});

/* ── The GST report: food, GST and packaging apart, nothing twice ────────────────────────── */

const rangeBill = (o: Partial<RangeBill> & { restaurantIncome: number; tax: number }): RangeBill => ({
  closedOn: '2026-10-02',
  subtotal: o.restaurantIncome - o.tax - (o.packaging ?? 0),
  discount: 0,
  tip: 0,
  covers: 0,
  orderType: 'takeaway',
  packaging: 0,
  ...o,
});

test('the GST report\'s net is the food only - packaging is shown apart and never inflates the taxable base', () => {
  const s = summarise({
    bills: [
      // Dine-in: ₹1,000 food, ₹50 GST.
      rangeBill({ orderType: 'dine_in', restaurantIncome: 1050, tax: 50, covers: 2 }),
      // Takeaway: ₹1,000 food, ₹50 GST, ₹75 packaging.
      rangeBill({ restaurantIncome: 1125, tax: 50, packaging: 75 }),
      // Takeaway: ₹0 food, ₹0 GST, ₹50 packaging - on the non-GST side.
      rangeBill({ restaurantIncome: 50, tax: 0, packaging: 50 }),
    ],
    expenses: [],
  });
  const g = s.gstSplit.gst;
  expect(g).toMatchObject({ orders: 2, gross: 2175, net: 2000, tax: 100, packaging: 75 });
  expect(g.gross).toBe(g.net + g.tax + g.packaging);
  const n = s.gstSplit.nonGst;
  expect(n).toMatchObject({ orders: 1, gross: 50, net: 0, tax: 0, packaging: 50 });
  // Nothing counted twice: the two sides add back to sales, and packaging to the report's total.
  expect(g.gross + n.gross).toBe(s.sales);
  expect(g.packaging + n.packaging).toBe(s.packaging);
  expect(s.byOrderType.reduce((a, o) => a + o.sales, 0)).toBe(s.sales);
});

test('the GST report screen labels the packaging as not taxed, and the route sends its figure', () => {
  const route = readFileSync('src/app/api/owner/report/route.ts', 'utf8');
  expect(route).toContain('packagingLabel: rupees(side.packaging),');
  const screen = readFileSync('src/features/owner/sections/ReportsSection.tsx', 'utf8');
  expect(screen).toContain('Packaging charges (no GST):');
  expect(screen).toContain('so gross is net');
});

/* ── No trace of the removed packaging-tax column or decision ────────────────────────────── */

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else if (/\.(ts|tsx|sql)$/.test(name)) out.push(p);
  }
  return out;
}

test('nothing in the application or the migrations refers to a packaging tax column or decision', () => {
  const files = [...filesUnder('src'), ...filesUnder('supabase/migrations')];
  // The scan parsed something - a scan of zero files reports a clean codebase by accident.
  expect(files.length).toBeGreaterThan(100);
  const offenders = files.filter((f) =>
    /packaging_taxable|packagingTaxable|packagingTaxed|PACKAGING_TAX_UNDECIDED|bill_packaging_tax_decided/.test(readFileSync(f, 'utf8'))
  );
  expect(offenders).toEqual([]);
});
