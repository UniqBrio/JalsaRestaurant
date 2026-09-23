import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { summarise, type RangeBill } from '../../src/lib/report-range';

/**
 * The owner's GST view, the sales breakdown by category, and where the money came in.
 *
 * WHAT MARKS A BILL AS GST, AND WHY IT IS DERIVED
 *   Nothing in the database says "this bill was billed under GST". What it records is the tax
 *   actually charged, so a bill that carried tax IS a GST bill. A flag invented now could not be
 *   backfilled onto bills already closed and would disagree with their printed copies. These
 *   cases pin the derivation so that the day it stops being the rule, it fails loudly rather
 *   than quietly reporting a different number to the person reconciling the books.
 */

/** A closed bill, with only the fields the roll-up reads. */
function bill(over: Partial<RangeBill> = {}): RangeBill {
  return {
    closedOn: '2026-09-22',
    subtotal: 1000,
    discount: 0,
    tax: 50,
    tip: 0,
    restaurantIncome: 1050,
    covers: 2,
    ...over,
  };
}

test('a bill that carried tax is GST, and one that carried none is not', () => {
  const s = summarise({
    bills: [bill(), bill({ tax: 0, restaurantIncome: 1000 })],
    expenses: [],
  });
  expect(s.gstSplit.gst.orders, 'one order carried tax').toBe(1);
  expect(s.gstSplit.nonGst.orders, 'and one did not').toBe(1);
  expect(s.gstSplit.nonGst.tax, 'the non-GST side collects no GST, by definition').toBe(0);
});

test('gross minus net IS the GST, by construction and not by a third sum', () => {
  const s = summarise({ bills: [bill(), bill()], expenses: [] });
  const g = s.gstSplit.gst;
  expect(g.gross, 'what the customer paid, less any tip').toBe(2100);
  expect(g.net, 'the base before GST').toBe(2000);
  expect(g.tax).toBe(100);
  expect(g.gross - g.net, 'the two must never be able to drift apart').toBe(g.tax);
});

test('a tip is never on either side of the split', () => {
  // The guest owed it; the restaurant did not earn it. `restaurantIncome` already excludes it,
  // and a tip appearing in gross would overstate what is owed to the tax authority.
  const s = summarise({ bills: [bill({ tip: 500 })], expenses: [] });
  expect(s.gstSplit.gst.gross).toBe(1050);
});

test('a discount is taken before GST, so it lowers both sides together', () => {
  const s = summarise({
    bills: [bill({ subtotal: 1000, discount: 200, tax: 40, restaurantIncome: 840 })],
    expenses: [],
  });
  expect(s.gstSplit.gst.net, 'the discounted base').toBe(800);
  expect(s.gstSplit.gst.tax).toBe(40);
});

test('an empty range answers zero on both sides, not NaN', () => {
  const s = summarise({ bills: [], expenses: [] });
  expect(s.gstSplit.gst.orders).toBe(0);
  expect(s.gstSplit.gst.gross).toBe(0);
  expect(s.gstSplit.nonGst.net).toBe(0);
});

test('every bill lands on exactly one side', () => {
  const bills = [bill(), bill({ tax: 0, restaurantIncome: 1000 }), bill({ tax: 1, restaurantIncome: 1001 })];
  const s = summarise({ bills, expenses: [] });
  expect(s.gstSplit.gst.orders + s.gstSplit.nonGst.orders, 'no bill counted twice or dropped').toBe(bills.length);
  expect(s.gstSplit.gst.gross + s.gstSplit.nonGst.gross, 'and the two grosses are the whole').toBe(s.sales);
});

test('payment modes are grouped, ordered by amount, and an unrecorded one says so', () => {
  const s = summarise({
    bills: [
      bill({ paymentMode: 'Cash' }),
      bill({ paymentMode: 'UPI', restaurantIncome: 3000, tax: 100 }),
      bill({ paymentMode: 'Cash' }),
      bill({}),
    ],
    expenses: [],
  });
  expect(s.byPaymentMode[0]?.mode, 'the biggest share first, because that is what is asked about').toBe('UPI');
  const cash = s.byPaymentMode.find((m) => m.mode === 'Cash');
  expect(cash?.bills).toBe(2);
  expect(cash?.amount).toBe(2100);
  // Folding an unknown mode into Cash would overstate the one figure this panel reconciles.
  expect(s.byPaymentMode.some((m) => m.mode === 'Unrecorded'), 'never guessed as Cash').toBe(true);
});

test('the route sends sales by category, built in the same walk as the dishes', () => {
  const src = readFileSync('src/app/api/owner/report/route.ts', 'utf8');
  expect(src, 'categories are projected').toContain('categories: [...categories.values()]');
  expect(src, 'from the line the round snapshotted').toContain("const catKey = i.category || 'Uncategorised'");
  // Two walks over the same lines is how a category total ends up disagreeing with the dishes
  // listed inside it; there must be exactly one loop over kot items.
  expect((src.match(/for \(const i of k\.items\)/g) ?? []).length, 'one walk, not two').toBe(1);
});

test('a line placed before the category was snapshotted is counted, not dropped', () => {
  const src = readFileSync('src/app/api/owner/report/route.ts', 'utf8');
  expect(src).toContain("i.category || 'Uncategorised'");
  const types = readFileSync('src/lib/db/types.ts', 'utf8');
  expect(types, 'the line carries its category as a snapshot').toContain('category: string;');
  const queries = readFileSync('src/lib/db/queries.ts', 'utf8');
  expect(queries, 'and it is read from the round, not joined live').toContain('menu_category_name');
});

test('the screen states the rule it is splitting on', () => {
  // A reconciliation done against a number whose rule is unstated is one nobody can check.
  const ui = readFileSync('src/features/owner/sections/ReportsSection.tsx', 'utf8');
  expect(ui).toContain('A bill counts as GST when tax was charged on it');
  expect(ui, 'both sides are on screen').toContain("['With GST', gst,");
  expect(ui).toContain("['Without GST', nonGst,");
  expect(ui, 'and the order count the request asked for').toContain("side.orders === 1 ? '1 order'");
});

test('the payment bars are decorative, and the figures are the text beside them', () => {
  const ui = readFileSync('src/features/owner/sections/ReportsSection.tsx', 'utf8');
  // A screen reader that read the bar as well would say the same number twice.
  expect(ui).toContain('<div aria-hidden className="mt-1 h-2 w-full rounded-full');
  expect(ui, 'colour is a token, never a literal').not.toMatch(/style=\{\{\s*background(Color)?:\s*'#/);
});
