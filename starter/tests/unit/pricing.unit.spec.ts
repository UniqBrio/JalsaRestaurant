/**
 * pricing unit spec — the arithmetic every money screen shows, pinned once.
 *
 * FAIL-FIRST EVIDENCE: executed against the tsc-compiled actual module on 10-Sep-2026 — 11
 * passed. OBSERVED FAILING first: with `payable` summed from the RAW line values instead of the
 * rounded rows, "THE ROWS SHOWN ADD UP TO THE TOTAL SHOWN" failed — three rows of 33.34 under a
 * total of 100.01. An off-by-a-paisa breakdown reads to a customer as an arithmetic bug,
 * because it is one.
 */
import { test, expect } from '@playwright/test';
import { computePricing, formatMoney, roundMoney } from '../../src/lib/pricing';

const sumOf = (rows: { amount: number; role: string }[]) =>
  roundMoney(rows.filter((r) => r.role !== 'subtotal' && r.role !== 'total')
    .reduce((s, r) => s + r.amount, 0));

test('nothing priced yet is a breakdown with a zero total, not an error', () => {
  const b = computePricing({ lines: [] });
  expect(b.payable).toBe(0);
  expect(b.rows).toHaveLength(1);
  expect(b.rows[0]!.role).toBe('total');
  expect(b.warnings).toEqual([]);
});

test('a single line needs no Subtotal row repeating it', () => {
  const b = computePricing({ lines: [{ id: 'a', label: 'Term fee', unitAmount: 1200 }] });
  expect(b.rows.map((r) => r.role)).toEqual(['line', 'total']);
  expect(b.payable).toBe(1200);
});

test('THE ROWS SHOWN ADD UP TO THE TOTAL SHOWN, to the last paisa', () => {
  // Three lines that each round UP on their own. Summing the raw values and rounding once at
  // the end gives 100.01; the rows on screen say 33.34 three times, which is 100.02. The
  // customer reads the rows, adds them, and finds the total wrong by a paisa.
  const b = computePricing({
    lines: [
      { id: 'a', label: 'Session 1', unitAmount: 33.335 },
      { id: 'b', label: 'Session 2', unitAmount: 33.335 },
      { id: 'c', label: 'Session 3', unitAmount: 33.335 },
    ],
  });
  expect(b.rows.filter((r) => r.role === 'line').map((r) => r.amount)).toEqual([33.34, 33.34, 33.34]);
  expect(b.payable).toBe(100.02);
  expect(b.payable).toBe(sumOf(b.rows));
});

test('a percentage discount applies to the charge subtotal and is signed negative', () => {
  const b = computePricing({
    lines: [{ id: 'a', label: 'Course', unitAmount: 1000 }],
    adjustments: [{ id: 'd', label: 'Early-bird discount', kind: 'discount', percent: 10 }],
  });
  expect(b.adjustmentTotal).toBe(-100);
  expect(b.payable).toBe(900);
  expect(b.rows.find((r) => r.id === 'd')!.detail).toBe('10%');
});

test('a discount given as an absolute amount is signed by its KIND, not by the sign passed in', () => {
  const b = computePricing({
    lines: [{ id: 'a', label: 'Course', unitAmount: 1000 }],
    adjustments: [{ id: 'd', label: 'Goodwill', kind: 'discount', amount: 150 }],
  });
  expect(b.payable).toBe(850);
  const surcharge = computePricing({
    lines: [{ id: 'a', label: 'Course', unitAmount: 1000 }],
    adjustments: [{ id: 's', label: 'Late fee', kind: 'surcharge', amount: -150 }],
  });
  expect(surcharge.payable).toBe(1150);
});

test('tax is computed on charges AFTER adjustments, never on the gross', () => {
  const b = computePricing({
    lines: [{ id: 'a', label: 'Course', unitAmount: 1000 }],
    adjustments: [{ id: 'd', label: 'Discount', kind: 'discount', percent: 10 }],
    taxes: [{ id: 't', label: 'GST', percent: 18 }],
  });
  expect(b.taxTotal).toBe(162); // 18% of 900, not of 1000
  expect(b.payable).toBe(1062);
});

test('PASS-THROUGH MONEY is owed by the payer and excluded from revenue', () => {
  const b = computePricing({
    lines: [
      { id: 'a', label: 'Coaching', unitAmount: 2000 },
      { id: 'dep', label: 'Refundable deposit', unitAmount: 500, kind: 'passThrough' },
    ],
  });
  expect(b.payable).toBe(2500);
  expect(b.passThroughTotal).toBe(500);
  expect(b.revenue).toBe(2000);
  // It must not quietly inflate the base a percentage discount is taken from either.
  const discounted = computePricing({
    lines: [
      { id: 'a', label: 'Coaching', unitAmount: 2000 },
      { id: 'dep', label: 'Deposit', unitAmount: 500, kind: 'passThrough' },
    ],
    adjustments: [{ id: 'd', label: 'Discount', kind: 'discount', percent: 10 }],
  });
  expect(discounted.adjustmentTotal).toBe(-200);
});

test('an over-discount is REPORTED, never clamped to zero behind the user', () => {
  const b = computePricing({
    lines: [{ id: 'a', label: 'Course', unitAmount: 100 }],
    adjustments: [{ id: 'd', label: 'Discount', kind: 'discount', amount: 250 }],
  });
  expect(b.payable).toBe(-150);
  expect(b.warnings).toHaveLength(1);
  expect(b.warnings[0]).toContain('larger than the amount charged');
});

test('a zero-quantity line is a zero row, which is not the same as an absent one', () => {
  const b = computePricing({ lines: [{ id: 'a', label: 'Extra session', quantity: 0, unitAmount: 400 }] });
  expect(b.rows.find((r) => r.id === 'a')!.amount).toBe(0);
  expect(b.payable).toBe(0);
});

test('money renders to the paisa and is never compacted — an amount owed is not a scale', () => {
  expect(formatMoney(1234.5, { currency: 'INR', locale: 'en-IN' })).toContain('1,234.50');
  expect(formatMoney(250000, { currency: 'INR', locale: 'en-IN' })).not.toContain('L');
});

test('roundMoney is symmetric about zero, so a refund rounds like a charge', () => {
  expect(roundMoney(2.005)).toBe(2.01);
  expect(roundMoney(-2.005)).toBe(-2.01);
  expect(roundMoney(Number.NaN)).toBe(0);
});
