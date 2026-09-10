/**
 * money unit spec — the arithmetic every screen in the restaurant reads from.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, executed against the actual module):
 *   OBSERVED FAILING — "the tip is inside what the guest pays and outside what the restaurant
 *   earns" was run first against a `totalBill` whose `restaurantIncome` was written as
 *   `payable`, the shape a single "total" field naturally produces. It failed with income of
 *   ₹1,070 against food+tax of ₹1,050, which is exactly the accounting error Standard 7.3
 *   describes: a liability booked as revenue. The field was split; the assertion is what keeps
 *   it split.
 *
 *   OBSERVED FAILING — "a flat discount can never take a bill below zero" was run against a
 *   version without the `Math.min(subtotal, …)` clamp. A ₹500 discount on a ₹300 bill produced
 *   a NEGATIVE taxable amount and a negative GST line, i.e. the restaurant paying the guest tax.
 *
 *   NOT OBSERVED FAILING: the Indian digit-grouping assertions. They pin `toLocaleString('en-IN')`,
 *   which is the platform's behaviour rather than ours — the test exists to catch a future edit
 *   that swaps the locale for the viewer's, not to prove our own arithmetic.
 */
import { test, expect } from '@playwright/test';
import { countOf, rupees, totalBill, totalsRows } from '../../src/lib/money';

const line = (unitPrice: number, qty = 1, name = 'Dish') => ({ name, unitPrice, qty });

/* ── The rule the whole ledger rests on ────────────────────────────────── */

test('the tip is inside what the guest pays and outside what the restaurant earns', () => {
  const t = totalBill({ lines: [line(1000)], taxRate: 5, tip: 20 });

  expect(t.subtotal).toBe(1000);
  expect(t.tax).toBe(50);
  expect(t.tip).toBe(20);

  // The guest owes it…
  expect(t.payable).toBe(1070);
  // …and the restaurant does not earn it. Both true at once, and neither derived from the other.
  expect(t.restaurantIncome).toBe(1050);
  expect(t.payable - t.restaurantIncome).toBe(t.tip);
});

test('a bill with no tip has an income equal to its payable, and says nothing about tips', () => {
  const t = totalBill({ lines: [line(240, 2)], taxRate: 5 });
  expect(t.tip).toBe(0);
  expect(t.payable).toBe(t.restaurantIncome);

  const rows = totalsRows(t, { taxRate: 5 });
  const tipRow = rows.find((r) => r.label.startsWith('Tip'));
  expect(tipRow?.value).toBe('—');
  // No explanatory note under a dash: it would read as a disclaimer about money nobody paid.
  expect(tipRow?.note).toBeUndefined();
});

/* ── Discounts ─────────────────────────────────────────────────────────── */

test('discounts compose in a stated order: percentage first, then flat', () => {
  // "10% off and ₹50 off" has two answers. This pins the one the closure dialog means.
  const t = totalBill({ lines: [line(1000)], discountPct: 10, discountAmount: 50, taxRate: 5 });
  expect(t.discount).toBe(150);
  expect(t.taxable).toBe(850);
  // Tax is charged on what is left after the discount, never on the pre-discount figure.
  expect(t.tax).toBe(43);
  expect(t.payable).toBe(893);
});

test('a flat discount can never take a bill below zero', () => {
  const t = totalBill({ lines: [line(300)], discountAmount: 500, taxRate: 5 });
  expect(t.discount).toBe(300);
  expect(t.taxable).toBe(0);
  expect(t.tax).toBe(0);
  expect(t.payable).toBe(0);
  expect(t.restaurantIncome).toBe(0);
});

test('a nonsense discount percentage is clamped rather than trusted', () => {
  const wild = totalBill({ lines: [line(500)], discountPct: 900, taxRate: 5 });
  expect(wild.discount).toBe(500);

  const negative = totalBill({ lines: [line(500)], discountPct: -50, taxRate: 5 });
  expect(negative.discount).toBe(0);
});

/* ── Tax ───────────────────────────────────────────────────────────────── */

test('the tax rate is read from the bill, never assumed to be five per cent', () => {
  // The 5% in the reference design is explicitly unconfirmed. A hard-coded rate here would be
  // the exact defect Standard 2.3 names.
  expect(totalBill({ lines: [line(1000)], taxRate: 0 }).tax).toBe(0);
  expect(totalBill({ lines: [line(1000)], taxRate: 12 }).tax).toBe(120);
  expect(totalBill({ lines: [line(1000)], taxRate: 18 }).tax).toBe(180);
});

/* ── The totals block ──────────────────────────────────────────────────── */

test('the totals block itemises in ONE order, and the payable is the emphasised last line', () => {
  const t = totalBill({ lines: [line(400, 2)], discountPct: 10, taxRate: 5, tip: 30 });
  const rows = totalsRows(t, { taxRate: 5, tipTo: 'Imran' });

  expect(rows.map((r) => r.label)).toEqual(['Food', 'Discount', 'GST 5%', 'Tip for Imran', 'To pay']);
  expect(rows[rows.length - 1]?.emphasis).toBe(true);
  expect(rows.filter((r) => r.emphasis).length).toBe(1);
});

test('a tip line carries the sentence that stops it being read as revenue', () => {
  const rows = totalsRows(totalBill({ lines: [line(500)], taxRate: 5, tip: 20 }), { taxRate: 5 });
  const tipRow = rows.find((r) => r.label.startsWith('Tip'));
  expect(tipRow?.note).toContain('Not restaurant income');
});

test('a discount line only appears when there IS a discount', () => {
  const rows = totalsRows(totalBill({ lines: [line(500)], taxRate: 5 }), { taxRate: 5 });
  expect(rows.some((r) => r.label === 'Discount')).toBe(false);
});

test('every row in the block reconciles: food − discount + tax + tip equals the payable', () => {
  const t = totalBill({ lines: [line(191, 2), line(120), line(45, 3)], discountPct: 7, taxRate: 5, tip: 10 });
  expect(t.subtotal - t.discount + t.tax + t.tip).toBe(t.payable);
});

/* ── Presentation ──────────────────────────────────────────────────────── */

test('rupees group the Indian way, so the printed bill and the screen read alike', () => {
  expect(rupees(1000)).toBe('₹1,000');
  expect(rupees(124750)).toBe('₹1,24,750');
  expect(rupees(0)).toBe('₹0');
});

test('rupees are whole: a fraction is rounded once, at the edge, not carried through', () => {
  expect(rupees(1246.99)).toBe('₹1,247');
  expect(rupees(1246.4)).toBe('₹1,246');
});

test('a count of one never reads as a plural', () => {
  expect(countOf(1, 'item')).toBe('1 item');
  expect(countOf(2, 'item')).toBe('2 items');
  expect(countOf(1, 'round')).toBe('1 round');
  expect(countOf(0, 'round')).toBe('0 rounds');
});

test('an empty bill is a zero, not an error', () => {
  const t = totalBill({ lines: [], taxRate: 5 });
  expect(t.payable).toBe(0);
  expect(t.subtotal).toBe(0);
  expect(t.restaurantIncome).toBe(0);
});
