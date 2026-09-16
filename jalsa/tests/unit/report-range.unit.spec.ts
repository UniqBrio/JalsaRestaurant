/**
 * report-range unit spec — one range, four panels, and a net that excludes the staff's money.
 *
 * FAIL-FIRST EVIDENCE: observed on 16-Sep-2026. The module is new, so against the pre-fix tree
 * the whole file failed to collect. Two deliberate defects were then introduced into the finished
 * module and the suite re-run:
 *
 *   1. `checkRange` swapping a reversed pair instead of refusing it — **2 failed, 19 passed**:
 *      "A REVERSED RANGE IS REFUSED, never quietly swapped" and "a refused range is still
 *      returned unchanged". Swapping hands back a correct-looking report for a question nobody
 *      asked, and nothing on the screen would say so.
 *   2. `summarise` computing `net` as `sales + tips - purchases` — **2 failed, 19 passed**:
 *      "THE NET EXCLUDES TIPS" and "tips are reported separately and never folded into sales".
 *      That overstates the business by the staff's own money, which is the exact conflation
 *      `money.ts` refuses to allow by having no field called "total".
 *
 * Both were reverted and the suite returned to 21 passed.
 */
import { test, expect } from '@playwright/test';
import {
  PRESET_LABEL,
  checkRange,
  rangeLabel,
  resolvePreset,
  summarise,
  type RangeBill,
  type RangeExpense,
} from '../../src/lib/report-range';

// A Thursday, mid-month, so no preset lands on a boundary by accident.
const TODAY = new Date(2026, 8, 16);

/* ── Presets ───────────────────────────────────────────────────────────── */

test('today is one day, inclusive at both ends', () => {
  expect(resolvePreset('today', TODAY)).toEqual({ from: '2026-09-16', to: '2026-09-16' });
});

test('yesterday is yesterday alone — it never includes today', () => {
  expect(resolvePreset('yesterday', TODAY)).toEqual({ from: '2026-09-15', to: '2026-09-15' });
});

test('LAST 7 DAYS INCLUDES TODAY — the week just worked, not the week before it', () => {
  const r = resolvePreset('last7', TODAY);
  expect(r).toEqual({ from: '2026-09-10', to: '2026-09-16' });
  expect(rangeLabel(r)).toContain('7 days');
});

test('last 30 days is thirty days counted the same way', () => {
  const r = resolvePreset('last30', TODAY);
  expect(r.to).toBe('2026-09-16');
  expect(rangeLabel(r)).toContain('30 days');
});

test('this month runs from the first to today, not to the end of the month', () => {
  expect(resolvePreset('thisMonth', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-16' });
});

test('a preset resolved across a month boundary does not produce a negative day', () => {
  expect(resolvePreset('last7', new Date(2026, 8, 2))).toEqual({ from: '2026-08-27', to: '2026-09-02' });
});

test('every preset has a label a person would recognise', () => {
  Object.values(PRESET_LABEL).forEach((l) => expect(l.length).toBeGreaterThan(3));
});

/* ── Validation ────────────────────────────────────────────────────────── */

test('A REVERSED RANGE IS REFUSED, never quietly swapped', () => {
  const v = checkRange({ from: '2026-09-16', to: '2026-09-01' }, TODAY);
  expect(v.problem).toContain('ends before it starts');
});

test('a refused range is still returned unchanged — the screen shows what was typed', () => {
  const typed = { from: '2026-09-16', to: '2026-09-01' };
  expect(checkRange(typed, TODAY).range).toEqual(typed);
});

test('a half-typed range is refused before it reads anything', () => {
  expect(checkRange({ from: '', to: '2026-09-16' }, TODAY).problem).toContain('Both dates');
  expect(checkRange({ from: '16/09/2026', to: '2026-09-16' }, TODAY).problem).toContain('Both dates');
});

test('a range starting in the FUTURE is allowed and says it will be empty', () => {
  // "This month" on the 3rd is exactly this, and the honest answer is "no rows yet".
  const v = checkRange({ from: '2026-10-01', to: '2026-10-31' }, TODAY);
  expect(v.problem).toContain('has not happened yet');
});

test('a range ending in the future but starting in the past is fine', () => {
  expect(checkRange({ from: '2026-09-01', to: '2026-09-30' }, TODAY).problem).toBeNull();
});

test('one day is one day in the label, with no day count to misread', () => {
  expect(rangeLabel({ from: '2026-09-16', to: '2026-09-16' })).toBe('2026-09-16');
});

/* ── The roll-up ───────────────────────────────────────────────────────── */

const BILLS: RangeBill[] = [
  { closedOn: '2026-09-15', subtotal: 1000, discount: 100, tax: 45, tip: 50, restaurantIncome: 945, covers: 4 },
  { closedOn: '2026-09-16', subtotal: 2000, discount: 0, tax: 100, tip: 200, restaurantIncome: 2100, covers: 6 },
];
const EXPENSES: RangeExpense[] = [
  { spentOn: '2026-09-15', category: 'Vegetables', amount: 400 },
  { spentOn: '2026-09-16', category: 'Gas cylinder', amount: 2100 },
  { spentOn: '2026-09-16', category: 'Vegetables', amount: 300 },
];

test('THE NET EXCLUDES TIPS — a tip is the staff’s money, not the business’s', () => {
  const s = summarise({ bills: BILLS, expenses: EXPENSES });
  expect(s.sales).toBe(3045);
  expect(s.purchases).toBe(2800);
  expect(s.net).toBe(245);
  expect(s.tips).toBe(250);
});

test('tips are reported separately and never folded into sales', () => {
  const s = summarise({ bills: BILLS, expenses: [] });
  expect(s.sales + s.tips).not.toBe(s.sales);
  expect(s.net).toBe(s.sales);
});

test('expenses roll up by category, largest first', () => {
  const s = summarise({ bills: BILLS, expenses: EXPENSES });
  expect(s.byCategory[0]).toEqual({ category: 'Gas cylinder', amount: 2100 });
  expect(s.byCategory[1]).toEqual({ category: 'Vegetables', amount: 700 });
});

test('an expense with no category is bucketed honestly rather than dropped', () => {
  const s = summarise({ bills: [], expenses: [{ spentOn: '2026-09-16', category: '', amount: 90 }] });
  expect(s.byCategory).toEqual([{ category: 'Uncategorised', amount: 90 }]);
  expect(s.purchases).toBe(90);
});

test('a range with purchases and no sales reports a NEGATIVE net, not a zero one', () => {
  const s = summarise({ bills: [], expenses: EXPENSES });
  expect(s.net).toBe(-2800);
});

test('an empty range totals zero everywhere and divides by nothing', () => {
  const s = summarise({ bills: [], expenses: [] });
  expect(s.sales).toBe(0);
  expect(s.net).toBe(0);
  expect(s.averageBill).toBe(0);
  expect(s.byCategory).toEqual([]);
});

test('the average bill is the ONE rounded figure, and it is rounded once', () => {
  const s = summarise({ bills: BILLS, expenses: [] });
  expect(s.averageBill).toBe(Math.round(3045 / 2));
  expect(Number.isInteger(s.averageBill)).toBe(true);
});

test('covers and discounts come from the same rows the sales did', () => {
  const s = summarise({ bills: BILLS, expenses: EXPENSES });
  expect(s.covers).toBe(10);
  expect(s.discounts).toBe(100);
  expect(s.bills).toBe(2);
});
