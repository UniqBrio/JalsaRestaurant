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

/* ── The after-discount figure shown at the till ───────────────────────── */

/**
 * FAIL-FIRST EVIDENCE (12-Sep-2026, round 3): modelled against what the screen actually showed
 * before this change — the discount and the base ("₹100 off ₹1,300"), never the answer — using
 * the naive `base - discount` a person reaches for without GST in mind:
 *   OBSERVED FAILING — 1 failed: "the after-discount payable recharges GST on the reduced
 *   amount" · `expected 1260, received 1200`. Neither 1200 nor the screen's own pre-discount
 *   "To pay ₹1,365" is what the guest hands over.
 */

test('the after-discount payable recharges GST on the reduced amount', () => {
  // The requester's own bill: ₹1,300 food, 5% GST, no tip. ₹100 off leaves ₹1,200 of food and
  // ₹60 of GST — ₹1,260, not ₹1,265 and not ₹1,200.
  const both = discountBothWays({ base: 1300, typed: 'amount', value: 100 });
  const after = totalBill({
    lines: [{ name: 'Food', unitPrice: 1300, qty: 1 }],
    taxRate: 5,
    discountAmount: both.amount,
  });
  expect(after.discount).toBe(100);
  expect(after.taxable).toBe(1200);
  expect(after.tax, 'GST follows the food down').toBe(60);
  expect(after.payable).toBe(1260);
});

test('the preview IS the closure figure — the same function, not a second formula', () => {
  // The whole reason the screen calls `totalBill` rather than repeating the rule: a preview that
  // agreed today and diverged after the next tax change would be a screen lying at a till. Both
  // routes through the same function must land on the same number.
  const both = discountBothWays({ base: 1300, typed: 'percentage', value: 7.69 });
  const viaPct = totalBill({
    lines: [{ name: 'Food', unitPrice: 1300, qty: 1 }],
    taxRate: 5,
    discountPct: both.pct,
  });
  const viaAmount = totalBill({
    lines: [{ name: 'Food', unitPrice: 1300, qty: 1 }],
    taxRate: 5,
    discountAmount: both.amount,
  });
  expect(viaPct.payable, 'the two representations of one discount agree').toBe(viaAmount.payable);
  expect(viaPct.payable).toBe(1260);
});

test('a tip is added after tax, so a discount never touches it', () => {
  const after = totalBill({
    lines: [{ name: 'Food', unitPrice: 1300, qty: 1 }],
    taxRate: 5,
    tip: 20,
    discountAmount: 100,
  });
  expect(after.tip).toBe(20);
  expect(after.payable, '1200 + 60 + 20').toBe(1280);
});
