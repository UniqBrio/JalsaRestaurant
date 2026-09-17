/**
 * bill-share — the plain-text form of a closed bill, and the link that carries it.
 *
 * WHY THIS IS A PURE FUNCTION IN `lib/` AND NOT A TEMPLATE LITERAL IN THE COMPONENT
 *   It is the only thing on the share path that can be wrong in a way nobody sees until a guest
 *   has the message: a dropped line, a total that disagrees with the screen, an apostrophe in a
 *   dish name that breaks the URL. A component cannot be asked those questions without a
 *   browser. This can, and `tests/unit/bill-share.unit.spec.ts` does.
 *
 * WHY A wa.me LINK AND NOT THE WHATSAPP BUSINESS API
 *   This repository's safety floor includes OUTBOUND-SEND DENY-BY-DEFAULT. The Business API
 *   would be the application sending a customer's itemised bill to a third party from the
 *   server — an outbound send, which is approved explicitly or is not built.
 *
 *   `wa.me` is not that. It is a URL that opens WhatsApp ON THE OWNER'S OWN DEVICE with the
 *   text already typed; the owner still picks the recipient and still presses send. Nothing
 *   leaves this application, no number is stored, no credential exists, and there is nothing to
 *   revoke. It is the same act as the owner typing the bill out themselves, minus the typing.
 *
 *   The Business API variant remains un-built and needs its own decision. Ask before adding it.
 */
import type { OwnerBillView } from './db/owner-view';

/** A bill a guest could read, in the order the screen shows it. */
export function billShareText(bill: OwnerBillView, restaurantName: string): string {
  const lines: string[] = [];

  lines.push(restaurantName);
  lines.push(`Bill ${bill.code} · ${bill.tables.join(', ')}`);
  lines.push(`${bill.guests} ${bill.guests === 1 ? 'guest' : 'guests'} · opened ${bill.openedAt}`);
  lines.push('');

  for (const k of bill.kots) {
    for (const i of k.items) {
      // A cancelled line is NOT sent. On the screen it is struck through, because the screen is
      // a record of what happened; a message to a guest is a statement of what they are paying
      // for, and a dish they did not get does not belong in it.
      if (i.cancelled) continue;
      lines.push(`${i.name} ×${i.qty}  ${i.lineLabel}`);
    }
  }
  if (lines[lines.length - 1] !== '') lines.push('');

  // The SAME rows the screen shows, not a second computation of them. `totals` already carries
  // Food, any discount, GST at the bill's own rate, the tip and To pay — so a discrepancy
  // between the message and the screen is impossible by construction rather than by care.
  for (const row of bill.totals) lines.push(`${row.label}: ${row.value}`);

  if (bill.paymentMode) {
    lines.push('');
    lines.push(
      `Paid by ${bill.paymentMode.toLowerCase()}${bill.paymentReference ? ` · ${bill.paymentReference}` : ''}`
    );
  }

  return lines.join('\n');
}

/**
 * The share link.
 *
 * `encodeURIComponent` and not a hand-rolled escape: a dish called "Chef's Special" or a
 * reference with a `#` in it would otherwise truncate the message at that character, and the
 * owner would send half a bill without noticing.
 */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
