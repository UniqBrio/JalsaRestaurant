/**
 * money - every rupee figure in the application is produced here.
 *
 * WHY ONE MODULE
 *   Reusable Design Standard 7.4: a figure that appears on the guest's phone, the captain's
 *   bill detail, the owner's closure dialog, the printed invoice and the day's report is ONE
 *   computed value read five times - never five independent computations that agree today.
 *   The moment two of them disagree, users stop trusting both.
 *
 * WHY MONEY IS AN INTEGER OF RUPEES
 *   Jalsa prices whole rupees and rounds the payable to the nearest rupee (the invoice setting
 *   says so). Carrying floats through discount → tax → tip and rounding only at the end is how
 *   a bill shows ₹1,247 in one place and ₹1,246.99 in another. Everything below is integer
 *   arithmetic, and the ONE rounding decision is named and applied once per component.
 *
 * WHY THE TIP IS INSIDE THE PAYABLE AND OUTSIDE THE INCOME
 *   Standard 7.3. The guest owes it, so it is part of `payable`. The restaurant does not earn
 *   it, so `restaurantIncome` excludes it. Both facts are true at once and the type makes that
 *   impossible to conflate: there is no single field called "total".
 */

export interface BillLine {
  name: string;
  unitPrice: number;
  qty: number;
}

export interface BillInput {
  lines: readonly BillLine[];
  /** Percentage discount, 0-100. Applied before tax, as the closure dialog shows it. */
  discountPct?: number;
  /** Flat discount in rupees. Applied after the percentage, never instead of it. */
  discountAmount?: number;
  /** GST rate as a percentage. Configurable; never a constant (Standard 2.3). */
  taxRate: number;
  /** Sum of the tip ledger rows against this bill. */
  tip?: number;
}

export interface BillTotals {
  /** What the food came to, before anything was taken off or added on. */
  subtotal: number;
  /** What the discount actually removed, in rupees - not the percentage that was typed. */
  discount: number;
  /** Subtotal minus discount. The figure tax is charged on. */
  taxable: number;
  tax: number;
  tip: number;
  /** What the guest owes. Includes the tip. */
  payable: number;
  /** What the restaurant earned. Excludes the tip, and says so wherever it is shown. */
  restaurantIncome: number;
}

const asInt = (n: number): number => Math.round(n);

/**
 * The one place a bill is totalled.
 *
 * Discounts compose in a stated order - percentage first, then flat - because "10% off and
 * ₹50 off" has two different answers and only one of them is the one the owner meant. The
 * flat amount can never take the bill below zero.
 */
export function totalBill(input: BillInput): BillTotals {
  const subtotal = input.lines.reduce((sum, l) => sum + asInt(l.unitPrice) * l.qty, 0);

  const pct = clamp(input.discountPct ?? 0, 0, 100);
  const fromPct = asInt((subtotal * pct) / 100);
  const flat = Math.max(0, asInt(input.discountAmount ?? 0));
  const discount = Math.min(subtotal, fromPct + flat);

  const taxable = subtotal - discount;
  const tax = asInt((taxable * clamp(input.taxRate, 0, 100)) / 100);
  const tip = Math.max(0, asInt(input.tip ?? 0));

  return {
    subtotal,
    discount,
    taxable,
    tax,
    tip,
    payable: taxable + tax + tip,
    restaurantIncome: taxable + tax,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

/**
 * ₹ with Indian digit grouping (1,24,750 - not 124,750).
 *
 * Hard-coding 'en-IN' is deliberate: this is a Hosur restaurant's bill, and the grouping is a
 * property of the currency's home convention, not of whatever locale the guest's phone happens
 * to be set to. A visitor with an en-US phone should still read the same bill the paper one
 * shows.
 */
export function rupees(amount: number): string {
  return `₹${asInt(amount).toLocaleString('en-IN')}`;
}

/**
 * The itemised totals block, in the ONE order it appears everywhere: components, adjustments,
 * tax, then the payable emphasised (Standard 7.2).
 *
 * Returning rows rather than a rendered string is what lets the guest sheet, the captain's
 * bill, the owner's closure dialog and the printed invoice all show the same block in their
 * own type sizes without any of them re-deciding what is in it or what order it goes in.
 */
export interface TotalsRow {
  label: string;
  value: string;
  /** True for the payable line, which every surface renders heavier. */
  emphasis?: boolean;
  /** Shown under the row - the sentence that stops a tip being mistaken for revenue. */
  note?: string;
}

export function totalsRows(t: BillTotals, opts: { taxRate: number; tipTo?: string }): TotalsRow[] {
  const rows: TotalsRow[] = [{ label: 'Food', value: rupees(t.subtotal) }];
  if (t.discount > 0) rows.push({ label: 'Discount', value: `− ${rupees(t.discount)}` });
  rows.push({ label: `GST ${opts.taxRate}%`, value: rupees(t.tax) });
  rows.push({
    label: opts.tipTo ? `Tip for ${opts.tipTo}` : 'Tip for the team',
    value: t.tip > 0 ? rupees(t.tip) : '—',
    // The sentence appears only when there IS a tip. An explanatory note under a dash reads
    // as a disclaimer about money nobody paid.
    ...(t.tip > 0 ? { note: 'Paid to the floor team in full. Not restaurant income.' } : {}),
  });
  rows.push({ label: 'To pay', value: rupees(t.payable), emphasis: true });
  return rows;
}

/**
 * Pluralisation that reads the real count, so a count of one never says "1 items".
 * Standard 7.4 again: the LABEL is derived from the figure, not written beside it.
 */
export function countOf(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/**
 * The two discount boxes, kept as two views of ONE number.
 *
 * WHY THIS IS NOT SIMPLY "FILL IN THE OTHER FIELD"
 *   The boxes used to be alternatives — the label said "or flat ₹" — and `discountOf` applies a
 *   percentage FIRST and then a flat amount on top. Make them mirror each other and leave both
 *   as inputs, and the moment both boxes have a figure in them the guest is discounted twice.
 *   So exactly one of them is the input: the one the cashier typed in. The other is a readout
 *   of what that comes to, and only the typed one is ever sent.
 *
 *   The typed box is NEVER rewritten. A cashier who types 10 sees 10, even where the rupee
 *   round trip would come back as 9.9 — a figure that changes under someone's fingers at a till
 *   is a figure they stop trusting.
 *
 * Clearing the typed box clears both: a stale computed figure beside an empty field is the most
 * misleading state either box can show.
 */
export function mirrorDiscount(input: { payable: number; typed: 'pct' | 'flat'; value: string }): {
  pct: string;
  flat: string;
} {
  const text = input.value.trim();
  if (text === '') return { pct: '', flat: '' };

  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) {
    // Keep what they typed — deleting a character mid-entry is how a "0." becomes unfixable —
    // but show nothing opposite it, because there is nothing yet to show.
    return input.typed === 'pct' ? { pct: input.value, flat: '' } : { pct: '', flat: input.value };
  }

  if (input.typed === 'pct') {
    const capped = Math.min(n, 100);
    // Whole rupees, because that is what the bill is actually discounted by.
    return { pct: input.value, flat: String(Math.round((input.payable * capped) / 100)) };
  }

  const capped = Math.min(n, input.payable);
  if (input.payable <= 0) return { pct: '', flat: input.value };
  // One decimal place: enough that nobody is told 10% and charged 9.7%, few enough that the
  // box does not fill with digits nobody reads.
  const pct = Math.round((capped / input.payable) * 1000) / 10;
  return { pct: String(pct), flat: input.value };
}
