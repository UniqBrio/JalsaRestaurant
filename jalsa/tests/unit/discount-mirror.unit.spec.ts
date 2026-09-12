/**
 * The two discount boxes in the Record payment dialog, as two views of one number.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree's own rules, modelled
 * exactly: two independent boxes, neither computing the other, and a preview that was the SUM
 * of both):
 *   OBSERVED FAILING — 3 failed:
 *     · "typing a percentage fills in what it comes to in rupees" — `expected {pct:"10",
 *       flat:"166"}, received {pct:"",flat:""}`. Nothing filled anything in; 10% of ₹1,659 lived
 *       only in a sentence underneath.
 *     · "typing an amount fills in the percentage it represents" — same, the other way round.
 *     · "one discount is taken, not two" — `expected 166, received 332`. THE reason the boxes
 *       could not simply mirror each other: the old preview added them, and so does
 *       `discountOf`. Mirroring without making one of them a readout would have discounted
 *       every bill twice.
 *
 *   NOT OBSERVED FAILING — nothing in this file.
 */
import { test, expect } from '@playwright/test';
import { mirrorDiscount } from '../../src/lib/money';

test('typing a percentage fills in what it comes to in rupees', () => {
  expect(mirrorDiscount({ payable: 1659, typed: 'pct', value: '10' })).toEqual({ pct: '10', flat: '166' });
  expect(mirrorDiscount({ payable: 1000, typed: 'pct', value: '25' })).toEqual({ pct: '25', flat: '250' });
});

test('typing an amount fills in the percentage it represents', () => {
  expect(mirrorDiscount({ payable: 1000, typed: 'flat', value: '250' })).toEqual({ pct: '25', flat: '250' });
  // One decimal place: enough that nobody is told 10% and charged 9.7%.
  expect(mirrorDiscount({ payable: 1659, typed: 'flat', value: '166' })).toEqual({ pct: '10', flat: '166' });
});

test('the box being typed in is never rewritten under the cashier’s fingers', () => {
  // 10% of 1659 rounds to 166, and 166 of 1659 comes back as 10.0 — but even where it would not,
  // the typed box keeps exactly what was typed.
  const r = mirrorDiscount({ payable: 333, typed: 'pct', value: '10' });
  expect(r.pct, 'what they typed').toBe('10');
  expect(r.flat, 'and what it comes to, rounded to whole rupees').toBe('33');
});

test('clearing one box clears both — a stale figure beside an empty field is the worst state', () => {
  expect(mirrorDiscount({ payable: 1659, typed: 'pct', value: '' })).toEqual({ pct: '', flat: '' });
  expect(mirrorDiscount({ payable: 1659, typed: 'flat', value: '   ' })).toEqual({ pct: '', flat: '' });
});

test('a half-typed or impossible entry keeps the keystrokes and shows nothing opposite', () => {
  expect(mirrorDiscount({ payable: 1659, typed: 'pct', value: '0' })).toEqual({ pct: '0', flat: '' });
  expect(mirrorDiscount({ payable: 1659, typed: 'flat', value: '-5' })).toEqual({ pct: '', flat: '-5' });
  expect(mirrorDiscount({ payable: 1659, typed: 'pct', value: 'abc' })).toEqual({ pct: 'abc', flat: '' });
});

test('neither box can promise more than the whole bill', () => {
  expect(mirrorDiscount({ payable: 1000, typed: 'pct', value: '150' }).flat, 'capped at 100%').toBe('1000');
  expect(mirrorDiscount({ payable: 1000, typed: 'flat', value: '5000' }).pct, 'capped at the bill').toBe('100');
});

test('a bill of nothing cannot be expressed as a percentage, and does not crash trying', () => {
  expect(mirrorDiscount({ payable: 0, typed: 'flat', value: '50' })).toEqual({ pct: '', flat: '50' });
  expect(mirrorDiscount({ payable: 0, typed: 'pct', value: '10' })).toEqual({ pct: '10', flat: '0' });
});
