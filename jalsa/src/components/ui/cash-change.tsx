'use client';

import * as React from 'react';
import { Field, Input } from './field';
import { discountPayload, type DiscountEntry } from './discount-fields';
import { cashChange, discountBothWays, paiseFromInput, rupees, rupeesFromPaise, totalBill } from '@/lib/money';

/**
 * Cash received, and the change to hand back — used by BOTH closure screens (24-Sep list, H3).
 *
 * One component for the same reason `DiscountFields` is one: the owner's Record payment dialog
 * and the captain's Close sheet close the same bills, and two copies of "how much change" is how
 * the counter and the floor end up handing back different amounts.
 *
 * Money is integer paise throughout (`paiseFromInput`, `cashChange`): typed cash is parsed from
 * its text, never through a float.
 */

/**
 * What the guest pays at the moment this bill is closed.
 *
 * `closeBill` closes with the discount typed IN THE CLOSURE SCREEN (or none) - so this is
 * `totalBill` over the subtotal, tax, tip and that discount: the same function and the same
 * inputs the server charges with, not a second formula.
 */
export function payableAtClose(input: {
  subtotal: number;
  taxRate: number;
  tip: number;
  discount: DiscountEntry;
}): number {
  const payload = discountPayload(input.discount);
  const both = payload
    ? discountBothWays({ base: input.subtotal, typed: payload.discountType, value: payload.discountValue })
    : null;
  return totalBill({
    lines: [{ name: 'Food', unitPrice: input.subtotal, qty: 1 }],
    taxRate: input.taxRate,
    tip: input.tip,
    ...(payload && both
      ? payload.discountType === 'percentage'
        ? { discountPct: both.pct }
        : { discountAmount: both.amount }
      : {}),
  }).payable;
}

/**
 * The sentence that stops the payment being recorded, or null.
 *
 * Empty is allowed: exact cash needs nothing typed. Typed, it must be an amount and must cover
 * the bill - a payment recorded as cash that was short is a till that will not balance.
 */
export function cashProblem(payable: number, typed: string): string | null {
  if (!typed.trim()) return null;
  const paise = paiseFromInput(typed);
  if (paise === null) return 'Type the cash received as an amount, like 1000.';
  const { shortPaise } = cashChange(payable, paise);
  return shortPaise > 0 ? `That is ${rupeesFromPaise(shortPaise)} short of ${rupees(payable)}.` : null;
}

export function CashChangeField({
  payable,
  value,
  onChange,
  disabled,
  testIdPrefix,
}: {
  payable: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  testIdPrefix: string;
}) {
  const problem = cashProblem(payable, value);
  const paise = value.trim() ? paiseFromInput(value) : null;
  const change = paise !== null && !problem ? cashChange(payable, paise).changePaise : null;
  return (
    <Field
      label="Cash received"
      htmlFor={`${testIdPrefix}-tendered`}
      hint={`Optional. The bill is ${rupees(payable)} — type what the guest handed over to see the change.`}
    >
      <Input
        id={`${testIdPrefix}-tendered`}
        data-testid={`${testIdPrefix}-tendered`}
        inputMode="decimal"
        value={value}
        placeholder={String(payable)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {problem ? (
        <p className="m-0 mt-1 type-caption text-[var(--error)]" data-testid={`${testIdPrefix}-cash-problem`}>
          {problem}
        </p>
      ) : change !== null ? (
        <p className="m-0 mt-1 type-body font-semibold" data-testid={`${testIdPrefix}-change`}>
          Change to give: <span className="tabular-nums">{rupeesFromPaise(change)}</span>
        </p>
      ) : null}
    </Field>
  );
}
