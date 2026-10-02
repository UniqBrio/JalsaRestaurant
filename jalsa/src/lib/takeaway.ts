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

/** The words for where an order is: its tables, or TAKEAWAY. */
export function placeLabel(bill: { orderType?: string | null; tables: readonly string[] }, joiner = ', '): string {
  return bill.orderType === 'takeaway' ? TAKEAWAY_LABEL : bill.tables.join(joiner);
}

