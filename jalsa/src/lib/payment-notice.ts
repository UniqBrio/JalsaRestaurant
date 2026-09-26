/**
 * payment-notice - the two notifications ONE guest payment request raises (item 37, 25-Sep-2026).
 *
 * WHO IS TOLD WHAT
 *   The captain: the table asked to pay - go and see to it, and clear it once they leave.
 *   The bill counter (the owner console, where closures are recorded): the guest has asked for
 *   the bill - have it ready. Two rows on the existing request list (`table_request`), one per
 *   audience, from the same request. The captain's phone does not list the counter's; the console
 *   lists both, because the counter is also who oversees the floor.
 *
 * ONE REQUEST, ONE PAIR. A second tap while the bill already waits raises nothing more; a row of
 * either kind still open for the bill is never written twice. Withdrawing the request clears
 * both; recording the payment clears the counter's (the captain's stays until the table is seen
 * to).
 */

export const PAYMENT_NOTICE = {
  captain: { kind: 'Clear the table' },
  counter: { kind: 'Bill requested' },
} as const;

export type NoticeAudience = 'captain' | 'counter';

export const PAYMENT_NOTICE_KINDS: readonly string[] = [PAYMENT_NOTICE.captain.kind, PAYMENT_NOTICE.counter.kind];

/** The note on each row: the bill, and for the counter the amount. */
export function paymentNoticeNote(audience: NoticeAudience, billCode: string, payableLabel: string): string {
  return audience === 'captain'
    ? `${billCode} - the guest asked to pay. See to the table, and clear it once they leave.`
    : `${billCode} - ${payableLabel}. The guest asked for the bill.`;
}

/** Whether a request row is for the bill counter only (so a captain's phone leaves it out). */
export const isCounterNotice = (kind: string): boolean => kind === PAYMENT_NOTICE.counter.kind;

/** Which kinds still need writing for this bill, given the kinds already open for it. */
export function noticesToRaise(openKindsForBill: readonly string[]): NoticeAudience[] {
  return (['captain', 'counter'] as const).filter((a) => !openKindsForBill.includes(PAYMENT_NOTICE[a].kind));
}
