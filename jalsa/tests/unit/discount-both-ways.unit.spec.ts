/**
 * One discount, stated two ways — and the requester's own ten test cases.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree, modelled exactly: there was
 * no shared both-ways helper at all — the owner's dialog had a string-returning `mirrorDiscount`
 * and the captain's sheet had a single percentage box — and no `bill.reassign_staff` key):
 *   OBSERVED FAILING — 3 failed:
 *     · "a percentage becomes the rupees it comes to" — `expected {pct:10,amount:10}, received
 *       {pct:0,amount:0}`.
 *     · "an amount becomes the percentage it represents" — the same, the other way round.
 *     · "there is a permission for changing the captain on a bill" — `expected [..] to contain
 *       "bill.reassign_staff"`.
 *
 *   NOT OBSERVED FAILING — nothing in this file.
 */
import { test, expect } from '@playwright/test';
import { discountBothWays, totalBill } from '../../src/lib/money';
import { ALL_PERMISSION_KEYS, ROLE_PRESETS } from '../../src/lib/permissions';

/* ── The requester's cases, in their order ─────────────────────────────── */

test('case 1 — bill ₹100, enter 10% → ₹10', () => {
  expect(discountBothWays({ base: 100, typed: 'percentage', value: 10 })).toEqual({ pct: 10, amount: 10 });
});

test('case 2 — bill ₹100, enter ₹10 → 10%', () => {
  expect(discountBothWays({ base: 100, typed: 'amount', value: 10 })).toEqual({ pct: 10, amount: 10 });
});

test('case 3 — bill ₹1,030, enter 5% → ₹52, NOT ₹51.50, and that is deliberate', () => {
  // The requester asked for ₹51.50. This application holds money in integer rupees (JP-5,
  // CLAUDE.md), and ₹52 is what the bill is ACTUALLY discounted by, what GST is then charged on,
  // and what the ledger records. A box reading ₹51.50 beside a bill discounted by ₹52 would be
  // worse than no box. Flagged to the requester in the request file rather than fudged here.
  expect(discountBothWays({ base: 1030, typed: 'percentage', value: 5 })).toEqual({ pct: 5, amount: 52 });
});

test('cases 4 and 5 — changing either field moves the other, both directions', () => {
  expect(discountBothWays({ base: 1030, typed: 'percentage', value: 5 }).amount).toBe(52);
  expect(discountBothWays({ base: 1030, typed: 'percentage', value: 10 }).amount).toBe(103);
  expect(discountBothWays({ base: 1030, typed: 'amount', value: 103 }).pct).toBe(10);
  expect(discountBothWays({ base: 1030, typed: 'amount', value: 52 }).pct).toBe(5.05);
});

test('case 6 — 100% takes the food to nothing, and GST with it', () => {
  const both = discountBothWays({ base: 1000, typed: 'percentage', value: 100 });
  expect(both).toEqual({ pct: 100, amount: 1000 });
  const t = totalBill({ lines: [{ name: 'Dish', unitPrice: 1000, qty: 1 }], taxRate: 5, discountPct: both.pct });
  expect(t.taxable, 'nothing left to charge').toBe(0);
  expect(t.tax, 'and nothing to tax').toBe(0);
  expect(t.payable).toBe(0);
});

test('case 7 — more than the bill is capped at the bill, never negative', () => {
  expect(discountBothWays({ base: 1000, typed: 'amount', value: 5000 })).toEqual({ pct: 100, amount: 1000 });
  expect(discountBothWays({ base: 1000, typed: 'percentage', value: 150 })).toEqual({ pct: 100, amount: 1000 });
  expect(discountBothWays({ base: 1000, typed: 'amount', value: -5 })).toEqual({ pct: 0, amount: 0 });
});

test('case 8 — the discount is applied ONCE, whichever box was typed', () => {
  // THE requirement the requester underlined. `closeBill` stores the typed figure in its own
  // column and ZERO in the other, so totalBill — which would happily add both — only ever has one
  // to add. Modelled here exactly as the row is written.
  const both = discountBothWays({ base: 1000, typed: 'percentage', value: 10 });
  const asRowWritten = totalBill({
    lines: [{ name: 'Dish', unitPrice: 1000, qty: 1 }],
    taxRate: 5,
    discountPct: both.pct,
    discountAmount: 0,
  });
  expect(asRowWritten.discount, 'once, not twice').toBe(100);

  const amountRow = totalBill({
    lines: [{ name: 'Dish', unitPrice: 1000, qty: 1 }],
    taxRate: 5,
    discountPct: 0,
    discountAmount: discountBothWays({ base: 1000, typed: 'amount', value: 100 }).amount,
  });
  expect(amountRow.discount).toBe(100);
  expect(amountRow.discount, 'both routes reach the same single discount').toBe(asRowWritten.discount);
});

test('case 9 — the payable moves with the discount, and GST follows it down', () => {
  const plain = totalBill({ lines: [{ name: 'Dish', unitPrice: 1000, qty: 1 }], taxRate: 5 });
  const cut = totalBill({ lines: [{ name: 'Dish', unitPrice: 1000, qty: 1 }], taxRate: 5, discountPct: 10 });
  expect(plain.payable).toBe(1050);
  expect(cut.payable, '900 food + 45 GST').toBe(945);
});

test('an empty or impossible entry is simply no discount', () => {
  expect(discountBothWays({ base: 1000, typed: 'percentage', value: 0 })).toEqual({ pct: 0, amount: 0 });
  expect(discountBothWays({ base: 0, typed: 'percentage', value: 10 }), 'a bill of nothing').toEqual({
    pct: 0,
    amount: 0,
  });
  expect(discountBothWays({ base: 1000, typed: 'amount', value: Number.NaN })).toEqual({ pct: 0, amount: 0 });
});

/* ── Changing the captain or waiter on a bill ──────────────────────────── */

test('there is a permission for changing the captain on a bill', () => {
  expect(ALL_PERMISSION_KEYS).toContain('bill.reassign_staff');
});

test('the owner holds it and no other role gets it by default', () => {
  // A captain who could reassign a bill to themselves could reassign a TIP to themselves.
  expect(ROLE_PRESETS['Owner / Admin']).toContain('bill.reassign_staff');
  for (const role of ['Captain', 'Waiter', 'Chef', 'Cashier'] as const) {
    expect(ROLE_PRESETS[role], `${role} must be granted it by name, never by role`).not.toContain(
      'bill.reassign_staff'
    );
  }
});
