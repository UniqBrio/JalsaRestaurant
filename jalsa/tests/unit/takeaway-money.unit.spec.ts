import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { packagingProblem, parsePackaging, totalBill, totalsRows } from '../../src/lib/money';
import { invoiceTicketData, type InvoiceBill } from '../../src/lib/invoice';
import { buildBill, buildKot, defaultTemplate, type TicketData } from '../../src/lib/print-template';
import { summarise, type RangeBill } from '../../src/lib/report-range';
import { placeLabel } from '../../src/lib/takeaway';

/**
 * 02-Oct-2026 — a takeaway's money, paper and report.
 *
 * The packaging charge is a separate line on the bill, typed by a person, never an item: it is not
 * discounted, it is taxed only when the owner decided GST applies to it, it is income but never
 * item sales, and GST is computed ONCE (`totalBill`) - never added twice.
 */

const food = [{ name: 'Chicken Fried Rice', unitPrice: 170, qty: 2 }]; // 340

/* ── Totals ───────────────────────────────────────────────────────────────────────────────── */

test('with no packaging charge every total is exactly what it was - dine-in is untouched', () => {
  const before = totalBill({ lines: food, taxRate: 5 });
  expect(before).toMatchObject({ subtotal: 340, taxable: 340, tax: 17, payable: 357, restaurantIncome: 357, packaging: 0 });
  expect(totalsRows(before, { taxRate: 5 }).map((r) => r.label)).not.toContain('Packaging charges');
});

test('packaging with no GST on it: added after tax, never discounted, inside income', () => {
  const t = totalBill({ lines: food, taxRate: 5, packaging: 25, packagingTaxable: false, discountAmount: 40 });
  // Discount comes off the FOOD only: 340 - 40 = 300; GST 15; +25 packaging = 340.
  expect(t).toMatchObject({ subtotal: 340, discount: 40, taxable: 300, tax: 15, packaging: 25, packagingTaxed: false });
  expect(t.payable).toBe(340);
  expect(t.restaurantIncome).toBe(340);
});

test('packaging with GST on it: taxed once, with the food - never a second tax line', () => {
  const t = totalBill({ lines: food, taxRate: 5, packaging: 25, packagingTaxable: true });
  expect(t).toMatchObject({ taxable: 365, tax: 18, packagingTaxed: true });
  expect(t.payable).toBe(340 + 25 + 18);
});

test('the screen totals place packaging where the paper does: above GST only when GST covers it', () => {
  const untaxed = totalsRows(totalBill({ lines: food, taxRate: 5, packaging: 25, packagingTaxable: false }), { taxRate: 5 });
  const taxed = totalsRows(totalBill({ lines: food, taxRate: 5, packaging: 25, packagingTaxable: true }), { taxRate: 5 });
  const at = (rows: typeof untaxed, label: string): number => rows.findIndex((r) => r.label.startsWith(label));
  expect(at(untaxed, 'Packaging')).toBeGreaterThan(at(untaxed, 'GST'));
  expect(at(taxed, 'Packaging')).toBeLessThan(at(taxed, 'GST'));
});

/* ── The typed amount ─────────────────────────────────────────────────────────────────────── */

test('a packaging charge is a non-negative whole-rupee amount, and anything else is refused', () => {
  for (const ok of ['', '0', '10', '25', '50', '100', ' 40 ']) expect(packagingProblem(ok), ok).toBeNull();
  expect(packagingProblem('abc')).toMatch(/Whole rupees only/);
  expect(packagingProblem('-50')).toMatch(/cannot be negative/);
  expect(packagingProblem('12.50')).toMatch(/Whole rupees only/);
  expect(packagingProblem('1e3')).toMatch(/Whole rupees only/);
  expect(packagingProblem('999999')).toMatch(/more than any packaging charge/);
  expect(parsePackaging('')).toBe(0);
  expect(parsePackaging(' 40 ')).toBe(40);
  expect(parsePackaging('abc')).toBeNull();
  expect(parsePackaging(-50)).toBeNull();
});

/* ── The paper ────────────────────────────────────────────────────────────────────────────── */

const takeawayBill: InvoiceBill = {
  code: 'TK-1',
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
  packagingCharge: 25,
  packagingTaxable: false,
  kots: [
    {
      status: 'served',
      items: [
        { name: 'Chicken Fried Rice', qty: 2, unitPrice: 170, foodType: 'non_veg', category: 'Rice', cancelledAt: null },
        { name: 'Pepsi', qty: 1, unitPrice: 40, foodType: 'veg', category: 'Drinks', cancelledAt: null },
      ],
    },
  ],
};
const who = { name: 'Jalsa', address: 'Hosur', phone: '', gstin: '33ABCDE1234F1Z5', upiId: '' };

test('the takeaway bill says TAKEAWAY, names no table, and totals with its packaging charge', () => {
  const data = invoiceTicketData(takeawayBill, who);
  expect(data.orderType).toBe('takeaway');
  // 380 food, GST 19, packaging 25 = 424.
  expect(data.totals).toMatchObject({ subtotal: 380, tax: 19, packaging: 25, packagingTaxable: false, payable: 424 });
  const text = buildBill(data, defaultTemplate('bill', '80')).map((l) => l.text.trim());
  expect(text.slice(0, 3).join('\n')).toContain('TAKEAWAY');
  expect(text.some((l) => /^TABLE\b/.test(l))).toBe(false);
  const packaging = text.findIndex((l) => l.startsWith('PACKAGING CHARGES'));
  const sgst = text.findIndex((l) => l.startsWith('SGST'));
  const total = text.findIndex((l) => l.startsWith('TOTAL'));
  expect(packaging).toBeGreaterThan(sgst);
  expect(packaging).toBeLessThan(total);
  expect(text[total]).toContain('424');
});

test('the takeaway KOT says TAKEAWAY at the top and prints no table number', () => {
  const kot: TicketData = {
    restaurant: 'JALSA',
    branch: '',
    phone: '',
    gstin: '',
    kotCode: 'KOT-1',
    station: 'Main Kitchen',
    roundCode: 'R1',
    billCode: 'TK-1',
    table: '',
    customer: '',
    captain: 'Meena',
    date: '02 Oct',
    time: '12:30',
    source: 'Owner',
    note: '',
    orderType: 'takeaway',
    items: [
      { name: 'Chicken Fried Rice', qty: 2, foodType: 'non_veg', rate: 170, category: 'Rice', instruction: '' },
      { name: 'Pepsi', qty: 1, foodType: 'veg', rate: 40, category: 'Drinks', instruction: '' },
    ],
  };
  const text = buildKot(kot, defaultTemplate('kot', '80')).map((l) => l.text.trim());
  expect(text.slice(0, 3).join('\n')).toContain('TAKEAWAY');
  expect(text.some((l) => /^TABLE\b/.test(l))).toBe(false);
  // A dine-in ticket from the same data still names its table - nothing else changed.
  const dine = buildKot({ ...kot, orderType: 'dine_in', table: 'A5' }, defaultTemplate('kot', '80')).map((l) => l.text.trim());
  expect(dine.some((l) => /^TABLE\b.*A5/.test(l))).toBe(true);
  expect(dine.join('\n')).not.toContain('TAKEAWAY');
});

test('every place that names where an order is says TAKEAWAY for one', () => {
  expect(placeLabel({ orderType: 'takeaway', tables: [] })).toBe('TAKEAWAY');
  expect(placeLabel({ orderType: 'dine_in', tables: ['A5', 'A6'] })).toBe('A5, A6');
  const bp = readFileSync('src/lib/db/bridge-payload.ts', 'utf8');
  expect(bp).toContain("const table = takeaway ? '' : await tableName(");
  expect(bp).toContain("...(takeaway ? { orderType: 'takeaway' as const } : {}),");
});

/* ── The report ───────────────────────────────────────────────────────────────────────────── */

test('the report splits dine-in from takeaway, adds back to sales, and keeps packaging out of item sales', () => {
  const bill = (orderType: 'dine_in' | 'takeaway', income: number, packaging = 0, covers = 2): RangeBill => ({
    closedOn: '2026-10-02',
    subtotal: income - packaging,
    discount: 0,
    tax: 0,
    tip: 0,
    restaurantIncome: income,
    covers,
    orderType,
    packaging,
  });
  const s = summarise({ bills: [bill('dine_in', 500), bill('takeaway', 382, 25, 0), bill('takeaway', 200, 0, 0)], expenses: [] });
  expect(s.byOrderType).toEqual([
    { orderType: 'dine_in', bills: 1, sales: 500, packaging: 0 },
    { orderType: 'takeaway', bills: 2, sales: 582, packaging: 25 },
  ]);
  expect(s.byOrderType.reduce((a, o) => a + o.sales, 0)).toBe(s.sales);
  expect(s.packaging).toBe(25);
  // A takeaway is not a cover.
  expect(s.covers).toBe(2);
  const route = readFileSync('src/app/api/owner/report/route.ts', 'utf8');
  expect(route).toContain("covers: b.orderType === 'takeaway' ? 0 : b.guests,");
  // Item sales are built from the dish lines, which never include the packaging charge.
  expect(route).toContain('seen.revenue += i.unitPrice * i.qty;');
});
