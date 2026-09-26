import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { cashChange, paiseFromInput, rupeesFromPaise, totalBill } from '../../src/lib/money';
import { cashProblem, payableAtClose } from '../../src/components/ui/cash-change';
import { NO_DISCOUNT } from '../../src/components/ui/discount-fields';

/**
 * Change for a cash payment (24-Sep correction list, H3).
 *
 * "Bill = ₹850, customer gives ₹1,000, change = ₹150." Integer paise throughout, the payable is
 * the one the server charges, tendered below it refuses the payment, and only Cash shows it.
 */

test('the example from the list: ₹850 bill, ₹1,000 handed over, ₹150 back', () => {
  const tendered = paiseFromInput('1000');
  expect(tendered).toBe(100000);
  expect(cashChange(850, tendered!)).toEqual({ changePaise: 15000, shortPaise: 0 });
  expect(rupeesFromPaise(15000)).toBe('₹150');
});

test('exact cash is no change; short cash is a shortfall, never negative change', () => {
  expect(cashChange(850, 85000)).toEqual({ changePaise: 0, shortPaise: 0 });
  expect(cashChange(850, 80000)).toEqual({ changePaise: 0, shortPaise: 5000 });
});

test('typed money is parsed from its text, not through a float', () => {
  // 850.10 as a float is 850.0999...; as text it is 85010 paise exactly.
  expect(paiseFromInput('850.10')).toBe(85010);
  expect(paiseFromInput('850.1')).toBe(85010);
  expect(paiseFromInput('₹1,000')).toBe(100000);
  expect(paiseFromInput(' 500 ')).toBe(50000);
  expect(cashChange(850, paiseFromInput('1000.50')!).changePaise).toBe(15050);
  expect(rupeesFromPaise(15050)).toBe('₹150.50');
  expect(rupeesFromPaise(1234500)).toBe('₹12,345');
});

test('what is not an amount is refused, not read as zero', () => {
  for (const bad of ['', 'abc', '10.123', '-50', '1e3', '12..5']) {
    expect(paiseFromInput(bad), bad).toBeNull();
  }
});

test('the payment cannot be recorded short, can be recorded exact or with nothing typed', () => {
  expect(cashProblem(850, '')).toBeNull();
  expect(cashProblem(850, '850')).toBeNull();
  expect(cashProblem(850, '1000')).toBeNull();
  expect(cashProblem(850, '800')).toBe('That is ₹50 short of ₹850.');
  expect(cashProblem(850, 'lots')).toBe('Type the cash received as an amount, like 1000.');
});

test('the payable is the one the server charges: after the discount typed at closing, with tax and tip', () => {
  const base = { subtotal: 1000, taxRate: 5, tip: 20 };
  // No discount: 1000 + 5% + 20 tip.
  expect(payableAtClose({ ...base, discount: NO_DISCOUNT })).toBe(1070);
  expect(payableAtClose({ ...base, discount: NO_DISCOUNT })).toBe(
    totalBill({ lines: [{ name: 'Food', unitPrice: 1000, qty: 1 }], taxRate: 5, tip: 20 }).payable
  );
  // 10% off is taken BEFORE tax: 900 + 45 + 20.
  expect(payableAtClose({ ...base, discount: { type: 'percentage', value: '10' } })).toBe(965);
});

test('both closure screens use the one component, and only for Cash', () => {
  const strip = (p: string) => readFileSync(p, 'utf8');
  const owner = strip('src/features/owner/CloseBillSheet.tsx');
  const staff = strip('src/features/staff/StaffTables.tsx');
  for (const [name, src] of [
    ['owner', owner],
    ['staff', staff],
  ] as const) {
    expect(src, name).toContain("from '@/components/ui/cash-change'");
    expect(src, name).toMatch(
      /mode === 'Cash'[\s\S]{0,80}<CashChangeField|mode === 'Cash' && bill\.subtotal !== null \? \(\s*<CashChangeField/
    );
    expect(src, `${name}: a short payment blocks the record button`).toMatch(/cashProblem\(/);
  }
});
