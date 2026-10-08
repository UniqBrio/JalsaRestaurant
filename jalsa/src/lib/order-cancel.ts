/**
 * order-cancel - cancelling an order the kitchen already has, and freeing its table (07-Oct-2026).
 *
 * WHY THIS IS NOT "MARK FREE"
 *   Mark free (`freeTable`) is for a table with nothing sent: it refuses the moment a round exists,
 *   because a tile on a floor grid must not write off a bill. This is the other case - a party
 *   that has to leave after ordering - and it is a different, louder action: it names a reason,
 *   needs `orders.cancel_after` as well as `tables.free`, and keeps the whole order as a
 *   cancelled bill. Nothing is deleted. See 20261007090000_jalsa_order_cancel_and_takeaway_photo.
 *
 * Pure and shared: the screens offer exactly what the server will accept.
 */

/** The grants it needs - both of them. The owner holds every grant. */
export const ORDER_CANCEL_GRANTS = ['tables.free', 'orders.cancel_after'] as const;

export const ORDER_CANCEL_REASONS = [
  'Customer emergency',
  'Customer changed mind',
  'Order mistake',
  'Kitchen issue',
  'Item unavailable',
  'Duplicate order',
  'Other',
] as const;
export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

/** Recorded when the person picks no reason - the database insists something is written. */
export const NO_REASON_GIVEN = 'No reason given';
export const OTHER_NOTE_MAX = 200;

export const ORDER_CANCEL_COPY = {
  action: 'Cancel order & free table',
  title: 'Cancel Order & Free Table?',
  body: 'This order is already being processed. Cancelling it will release the table and record the order as cancelled. Are you sure you want to continue?',
  confirm: 'Cancel Order & Free Table',
  keep: 'Cancel',
  otherPlaceholder: 'A few words on why',
} as const;

/** What the person is told. Never a database message. */
export const ORDER_CANCEL_MESSAGES = {
  gone: 'This order has already been cancelled or completed.',
  changed: 'Unable to cancel the order. The order may have already been completed or changed by another user.',
  notHere: 'Unable to cancel the order. This table now holds a different order — reload and check it again.',
  otherNeedsNote: 'Add a few words on why you chose "Other".',
} as const;

export function orderCancelledMessage(tables: readonly string[]): string {
  if (tables.length === 0) return 'Order cancelled successfully.';
  return tables.length === 1
    ? `Order cancelled successfully. Table ${tables[0]} is now free.`
    : `Order cancelled successfully. Tables ${tables.join(', ')} are now free.`;
}

/**
 * The reason to record, or a problem to show. An unknown reason is refused (the list is the
 * vocabulary the report groups by); none at all is allowed and recorded as "No reason given".
 */
export function orderCancelReason(
  reason: string | undefined | null,
  note: string | undefined | null
): { ok: true; reason: string; note: string } | { ok: false; problem: string } {
  const r = (reason ?? '').trim();
  const n = (note ?? '').trim().slice(0, OTHER_NOTE_MAX);
  if (!r) return { ok: true, reason: NO_REASON_GIVEN, note: '' };
  if (!(ORDER_CANCEL_REASONS as readonly string[]).includes(r)) return { ok: false, problem: 'Choose a reason from the list.' };
  if (r === 'Other' && !n) return { ok: false, problem: ORDER_CANCEL_MESSAGES.otherNeedsNote };
  return { ok: true, reason: r, note: r === 'Other' ? n : '' };
}

/**
 * Whether a floor tile offers it: an order is on the table AND has gone to the kitchen, and the
 * person holds both grants. The exact complement of `tableIsFreeable` on the rounds rule, so a
 * tile never offers both Mark free and this.
 */
export function tableIsCancellable(
  input: { roundCount: number; billId: string | null },
  grants: readonly string[]
): boolean {
  if (input.billId === null || input.roundCount === 0) return false;
  return ORDER_CANCEL_GRANTS.every((g) => grants.includes(g));
}
