/**
 * pricing — one itemised money breakdown, for every module that quotes, bills or charges.
 *
 * WHY THIS IS ONE MODULE AND NOT ONE PER SCREEN
 *   Checkout, the invoice, the quote dialog and the printed receipt all show the same money.
 *   Built separately they compute it separately, and the day the tax base changes three of the
 *   four are updated. Two screens disagreeing about a total is the fastest way to lose a
 *   customer's trust in every number the product shows, including the ones that are right.
 *
 * FOUR RULES, EACH FROM A REAL FAILURE
 *
 *   1. NEVER A SINGLE OPAQUE TOTAL. Components, adjustments and tax are separate rows, in one
 *      order, everywhere — screen and print alike. An unexplained total is the most disputed
 *      element in any interface, and the dispute costs more than the line items.
 *
 *   2. THE ROWS MUST ADD UP TO THE TOTAL SHOWN. Round each row ONCE, then sum the rounded
 *      rows. Summing raw values and rounding the total produces a breakdown that is off by a
 *      penny — which reads as a bug in the arithmetic, because it is one.
 *
 *   3. PASS-THROUGH MONEY IS NOT INCOME. Amounts collected on someone else's behalf — tax,
 *      deposits, tips, agent collections — appear in what the payer owes and stay out of
 *      `revenue`. Folding them in overstates revenue and understates a liability: an
 *      accounting error, not a display choice.
 *
 *   4. AN IMPOSSIBLE TOTAL IS REPORTED, NEVER CLAMPED. A discount larger than the charge
 *      produces a negative payable. Silently flooring it at zero hides a data-entry mistake
 *      and quietly gives the money away; the breakdown says so and the caller decides.
 *
 * Formatting is NOT re-implemented here: `formatValue` (analytics/format) already owns
 * currency rendering including lakh/crore. A second money formatter is a second answer.
 */
import { formatValue, type FormatOptions } from './analytics/format';

export type LineKind = 'charge' | 'passThrough';

export interface PriceLine {
  id: string;
  label: string;
  /** Defaults to 1. Zero is legal and renders as a zero row — it is not the same as absent. */
  quantity?: number;
  unitAmount: number;
  /** 'passThrough' = collected for someone else. Owed by the payer, excluded from revenue. */
  kind?: LineKind;
  /** Shown under the label: "2 × ₹250", "per month". Never carries the amount. */
  detail?: string;
}

export interface PriceAdjustment {
  id: string;
  label: string;
  kind: 'discount' | 'surcharge';
  /** Exactly one of `percent` or `amount`. Percent applies to the charge subtotal only. */
  percent?: number;
  amount?: number;
}

export interface PriceTax {
  id: string;
  label: string;
  percent: number;
}

export interface PricingInput {
  lines: PriceLine[];
  adjustments?: PriceAdjustment[];
  /** Tax is computed on charges AFTER adjustments, and is pass-through by nature. */
  taxes?: PriceTax[];
  currency?: string;
  locale?: string;
}

export type RowRole = 'line' | 'passThrough' | 'subtotal' | 'adjustment' | 'tax' | 'total';

export interface PricingRow {
  id: string;
  label: string;
  detail?: string;
  amount: number;
  role: RowRole;
}

export interface PricingBreakdown {
  /** Every row the user sees, in the one canonical order. The total is the last row. */
  rows: PricingRow[];
  chargeSubtotal: number;
  adjustmentTotal: number;
  taxTotal: number;
  passThroughTotal: number;
  /** What the payer owes. Always equal to the sum of the rounded rows above it. */
  payable: number;
  /** What the business earned: charges after adjustments. Tax and pass-through excluded. */
  revenue: number;
  /** Facts the caller must act on, in the user's words. Empty when there is nothing to say. */
  warnings: string[];
}

/** Half-up to 2 decimals, symmetric about zero so a refund rounds like a charge. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + Number.EPSILON)) / 100;
}

const lineAmount = (l: PriceLine) => roundMoney((l.quantity ?? 1) * (l.unitAmount ?? 0));

export function computePricing(input: PricingInput): PricingBreakdown {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const warnings: string[] = [];
  const rows: PricingRow[] = [];

  const charges = lines.filter((l) => (l.kind ?? 'charge') === 'charge');
  const passThroughLines = lines.filter((l) => l.kind === 'passThrough');

  for (const l of charges) {
    rows.push({
      id: l.id,
      label: l.label,
      ...(l.detail !== undefined ? { detail: l.detail } : {}),
      amount: lineAmount(l),
      role: 'line',
    });
  }
  const chargeSubtotal = roundMoney(rows.reduce((s, r) => s + r.amount, 0));

  // The subtotal row appears only when there is something to subtotal FROM. A "Subtotal" line
  // identical to the single line above it is noise the user has to read past every time.
  const hasModifiers =
    (input.adjustments?.length ?? 0) > 0 || (input.taxes?.length ?? 0) > 0 || passThroughLines.length > 0;
  if (hasModifiers) {
    rows.push({ id: 'subtotal', label: 'Subtotal', amount: chargeSubtotal, role: 'subtotal' });
  }

  let adjustmentTotal = 0;
  for (const a of input.adjustments ?? []) {
    const raw = typeof a.percent === 'number' ? (chargeSubtotal * a.percent) / 100 : (a.amount ?? 0);
    const signed = roundMoney(a.kind === 'discount' ? -Math.abs(raw) : Math.abs(raw));
    adjustmentTotal = roundMoney(adjustmentTotal + signed);
    rows.push({
      id: a.id,
      label: a.label,
      ...(typeof a.percent === 'number' ? { detail: `${a.percent}%` } : {}),
      amount: signed,
      role: 'adjustment',
    });
  }

  const net = roundMoney(chargeSubtotal + adjustmentTotal);
  if (net < 0) {
    warnings.push('The discounts are larger than the amount charged. Check the figures before sending this.');
  }

  let taxTotal = 0;
  for (const t of input.taxes ?? []) {
    const amount = roundMoney((net * t.percent) / 100);
    taxTotal = roundMoney(taxTotal + amount);
    rows.push({
      id: t.id,
      label: t.label,
      detail: `${t.percent}% of ${formatMoney(net, input)}`,
      amount,
      role: 'tax',
    });
  }

  let passThroughTotal = 0;
  for (const l of passThroughLines) {
    const amount = lineAmount(l);
    passThroughTotal = roundMoney(passThroughTotal + amount);
    rows.push({
      id: l.id,
      label: l.label,
      ...(l.detail !== undefined ? { detail: l.detail } : {}),
      amount,
      role: 'passThrough',
    });
  }

  // Rule 2: the payable is the SUM OF THE ROWS SHOWN, never an independently computed figure.
  const payable = roundMoney(rows.filter((r) => r.role !== 'subtotal').reduce((s, r) => s + r.amount, 0));
  rows.push({ id: 'total', label: 'Total payable', amount: payable, role: 'total' });

  return {
    rows,
    chargeSubtotal,
    adjustmentTotal,
    taxTotal,
    passThroughTotal,
    payable,
    // Rule 3: tax and pass-through lines are collected, not earned.
    revenue: net,
    warnings,
  };
}

/**
 * One money renderer for the breakdown, delegating to the shared formatter.
 *
 * TWO DELIBERATE CHOICES
 *   Two decimals, always: the shared formatter defaults to none, which is right for a
 *   dashboard tile and wrong here — a breakdown whose rows are shown to the rupee while the
 *   total is computed to the paisa is the "these do not add up" complaint, on screen.
 *   No compaction: "₹1.2L" is unpayable. Scale belongs on a tile; an amount owed does not.
 */
export function formatMoney(amount: number, input: Pick<PricingInput, 'currency' | 'locale'> = {}): string {
  const opts: FormatOptions = { decimals: 2 };
  if (input.currency) opts.currency = input.currency;
  if (input.locale) opts.locale = input.locale;
  return formatValue(amount, 'currency', opts);
}
