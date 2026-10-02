/**
 * Takeaway - an order at no table (02-Oct-2026).
 *
 * Pure and shared: the owner console, the captain's phone, the printed KOT and bill and the
 * reports all say where an order is with the same words, so no screen invents its own. A
 * takeaway bill has no tables (`bill.order_type = 'takeaway'`), and every place that used to
 * print a table name prints TAKEAWAY instead - never an empty string, never a fake table.
 */

/** What a ticket, a card or a report says in place of a table for a takeaway. */
export const TAKEAWAY_LABEL = 'TAKEAWAY';

/** Said wherever a packaging charge is refused because GST on it has not been decided. */
export const PACKAGING_TAX_UNDECIDED =
  'Packaging charges need a decision first: whether GST applies to them. The owner sets it in Settings → Tax & GST. Until then, place the takeaway with no packaging charge.';

/** The words for where an order is: its tables, or TAKEAWAY. */
export function placeLabel(bill: { orderType?: string | null; tables: readonly string[] }, joiner = ', '): string {
  return bill.orderType === 'takeaway' ? TAKEAWAY_LABEL : bill.tables.join(joiner);
}

/**
 * The owner's answer to "is GST charged on packaging?", read from the `tax` setting. Null means
 * nobody has answered - and a non-zero packaging charge is refused until somebody does.
 */
export function packagingTaxableFrom(tax: Record<string, unknown> | undefined | null): boolean | null {
  const v = tax?.packagingTaxable;
  return typeof v === 'boolean' ? v : null;
}
