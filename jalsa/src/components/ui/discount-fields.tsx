'use client';

import * as React from 'react';
import { Field, Input } from './field';
import { discountBothWays, rupees } from '@/lib/money';

/**
 * The two discount boxes, as ONE control — used by both closure screens (Standard 10.4).
 *
 * WHY IT IS A COMPONENT AND NOT TWO COPIES
 *   Bills are closed from two places: the owner's Record payment dialog and the captain's Close
 *   sheet. They had drifted already — the owner's had two fields, the captain's had one — and
 *   the rule they share is the one that must never differ between them: **two views, one
 *   discount, taken once.** Two copies of that rule is two chances to take it twice.
 *
 * THE SHAPE OF THE RULE
 *   Exactly one box is an input at any moment — whichever was last typed in — and the other is a
 *   readout derived from it. There is no circular update because there is no second input: the
 *   typed box is never written to by the component, only read.
 *
 *   Rupees are WHOLE. Not a display convenience: whole rupees are what the bill is actually
 *   discounted by, what GST is then charged on, and what the ledger records. A box reading
 *   ₹51.50 beside a bill discounted by ₹52 would be worse than no box at all. The percentage
 *   keeps two decimals, because nothing downstream rounds it.
 */
export interface DiscountEntry {
  /** Which box the person typed in, or null while both are empty. */
  type: 'percentage' | 'amount' | null;
  /** Exactly what they typed, unrounded and unrewritten. */
  value: string;
}

export const NO_DISCOUNT: DiscountEntry = { type: null, value: '' };

/** What to send with the closure, or nothing at all. */
export function discountPayload(
  entry: DiscountEntry
): { discountType: 'percentage' | 'amount'; discountValue: number } | null {
  if (entry.type === null) return null;
  const n = Number(entry.value.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return { discountType: entry.type, discountValue: n };
}

/** The problem with what is currently typed, in a sentence, or null. */
export function discountProblem(entry: DiscountEntry, base: number): string | null {
  const text = entry.value.trim();
  if (entry.type === null || text === '') return null;
  if (!/^\d*\.?\d*$/.test(text)) return 'Digits only.';
  const n = Number(text);
  if (!Number.isFinite(n)) return 'That is not an amount we can read.';
  if (n < 0) return 'A discount cannot be negative.';
  if (entry.type === 'percentage' && n > 100) return 'A discount cannot be more than 100%.';
  if (entry.type === 'amount' && n > base)
    return `That is more than the bill. The most you can take off is ${rupees(base)}.`;
  return null;
}

export function DiscountFields({
  base,
  entry,
  onChange,
  disabled,
  testIdPrefix,
}: {
  /** The subtotal BEFORE discount and before tax — the base the bill is actually discounted against. */
  base: number;
  entry: DiscountEntry;
  onChange: (next: DiscountEntry) => void;
  disabled?: boolean;
  testIdPrefix: string;
}) {
  const problem = discountProblem(entry, base);
  const payload = discountPayload(entry);
  const both = payload
    ? discountBothWays({ base, typed: payload.discountType, value: payload.discountValue })
    : { pct: 0, amount: 0 };

  // The typed box shows the keystrokes; the other shows what they come to. Never both computed,
  // never both typed — that is the whole of "do not create a circular update loop".
  const pctShown = entry.type === 'percentage' ? entry.value : payload ? String(both.pct) : '';
  const amountShown = entry.type === 'amount' ? entry.value : payload ? String(both.amount) : '';

  const enter = (type: 'percentage' | 'amount', value: string) => {
    // Filtered at the keystroke: a character that can never be valid should never appear.
    const cleaned = value.replace(/[^\d.]/g, '');
    onChange(cleaned.trim() === '' ? NO_DISCOUNT : { type, value: cleaned });
  };

  return (
    <div className="flex flex-col gap-2">
      <Field label="Discount %" htmlFor={`${testIdPrefix}-pct`}>
        <Input
          id={`${testIdPrefix}-pct`}
          data-testid={`${testIdPrefix}-pct`}
          inputMode="decimal"
          type="text"
          value={pctShown}
          disabled={disabled}
          onChange={(e) => enter('percentage', e.target.value)}
        />
      </Field>

      <Field label="Discount in ₹" htmlFor={`${testIdPrefix}-amount`}>
        <Input
          id={`${testIdPrefix}-amount`}
          data-testid={`${testIdPrefix}-amount`}
          inputMode="numeric"
          type="text"
          value={amountShown}
          disabled={disabled}
          onChange={(e) => enter('amount', e.target.value)}
        />
      </Field>

      {problem ? (
        <p data-testid={`${testIdPrefix}-problem`} className="m-0 text-[11.5px] text-[var(--error)]" role="alert">
          {problem}
        </p>
      ) : (
        <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          Enter either percentage or amount. The other value updates automatically.
          {payload ? ` Taken once: ${rupees(both.amount)} off ${rupees(base)}.` : ''}
        </p>
      )}
    </div>
  );
}
