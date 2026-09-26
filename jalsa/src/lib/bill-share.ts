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
import { billName, type RestaurantIdentity } from './restaurant-identity';

/* ── The template ──────────────────────────────────────────────────────── */

/**
 * The lines a WhatsApp bill can carry, in their default order.
 *
 * THE FIELDS ARE THE LINES, and that is deliberate. An earlier draft split "bill number" and
 * "table" into separate switches, which read well in a settings list and changed the message the
 * customer receives: today those two share one line — `Bill B-1046 · A5` — and so do the guest
 * count and the opening time. **The default template must produce exactly the message that ships
 * today**, byte for byte, or this change quietly rewords something every customer reads. So the
 * switches follow the message rather than the message following the switches.
 *
 * WHY THIS IS NOT THE PRINTER'S FIELD LIST
 *   A thermal ticket is a character grid: its template carries paper width, column count, font
 *   size, separator characters and item layouts, because on 48 columns an over-wide line does not
 *   wrap, it disappears. WhatsApp has none of those problems and none of those decisions. A
 *   template offering the owner a "paper width" for a phone message would be a control that does
 *   nothing, which is worse than a missing one.
 *
 *   The two templates share the IDEA — an ordered list of lines the owner may switch off — and
 *   share no configuration. They are stored under separate keys and cannot affect each other.
 */
export type WhatsAppField =
  | 'restaurant'
  | 'billAndTable'
  | 'guestsAndTime'
  | 'items'
  | 'totals'
  | 'payment'
  | 'thanks';

export interface WhatsAppFieldDef {
  key: WhatsAppField;
  label: string;
  /** What the owner is told this line is for. */
  hint: string;
  /** False for the lines a bill cannot be a bill without. */
  optional: boolean;
}

export const WA_FIELDS: WhatsAppFieldDef[] = [
  { key: 'restaurant', label: 'Restaurant name', hint: 'From Settings › Restaurant details', optional: true },
  { key: 'billAndTable', label: 'Bill number and table', hint: 'One line, as it sends today', optional: true },
  { key: 'guestsAndTime', label: 'Guests and opening time', hint: 'How many sat down, and when', optional: true },
  { key: 'items', label: 'Items', hint: 'What they ate. A cancelled line is never sent', optional: false },
  { key: 'totals', label: 'Totals', hint: 'The same rows the bill screen shows, tax and discount included', optional: false },
  { key: 'payment', label: 'How it was paid', hint: 'Only once a payment has been recorded', optional: true },
  { key: 'thanks', label: 'Closing line', hint: 'Off today — switch it on to end with your own sentence', optional: true },
];

export interface WhatsAppTemplate {
  /** Every field, in the order they are sent. */
  order: WhatsAppField[];
  /** The ones switched off. A locked field here is ignored. */
  off: WhatsAppField[];
  /** The closing line's wording, so it is the owner's sentence and not this file's. */
  thanks: string;
}

/**
 * The default, which is TODAY'S MESSAGE.
 *
 * `thanks` is off because no closing line is sent today. It carries suggested wording so that
 * switching it on does not present the owner with an empty box.
 */
export function defaultWhatsAppTemplate(): WhatsAppTemplate {
  return {
    order: WA_FIELDS.map((f) => f.key),
    off: ['thanks'],
    thanks: 'Thank you — we hope to see you again.',
  };
}

const LOCKED: WhatsAppField[] = WA_FIELDS.filter((f) => !f.optional).map((f) => f.key);

/** Whether a field is sent: locked fields always are, whatever a stored config claims. */
export function waFieldOn(config: WhatsAppTemplate, key: WhatsAppField): boolean {
  if (LOCKED.includes(key)) return true;
  return !config.off.includes(key);
}

/**
 * The fields in the order they will be sent, switched-off ones removed.
 *
 * A field missing from a stored `order` is appended rather than dropped: a template saved before
 * a new line existed must not silently lose that line for ever.
 */
export function waFieldOrder(config: WhatsAppTemplate): WhatsAppField[] {
  const known = WA_FIELDS.map((f) => f.key);
  const ordered = config.order.filter((k) => known.includes(k));
  const missing = known.filter((k) => !ordered.includes(k));
  return [...ordered, ...missing].filter((k) => waFieldOn(config, k));
}

/* ── The message ───────────────────────────────────────────────────────── */

/** A bill a guest could read, in the order the OWNER'S TEMPLATE puts it in. */
export function billShareText(
  bill: OwnerBillView,
  identity: RestaurantIdentity,
  config: WhatsAppTemplate = defaultWhatsAppTemplate()
): string {
  const lines: string[] = [];

  /* One builder per line, so the ORDER is data and this function has no opinion about it. */
  const build: Record<WhatsAppField, () => void> = {
    restaurant: () => {
      // No fallback to a restaurant's name. An unconfigured restaurant sends no header line
      // rather than somebody else's name — which is what shipped here until today.
      const name = billName(identity);
      if (name) lines.push(name);
    },
    billAndTable: () => lines.push(`Bill ${bill.code} · ${bill.tables.join(', ')}`),
    guestsAndTime: () =>
      lines.push(`${bill.guests} ${bill.guests === 1 ? 'guest' : 'guests'} · opened ${bill.openedAt}`),
    items: () => {
      lines.push('');
      for (const k of bill.kots) {
        for (const i of k.items) {
          // A cancelled line is NOT sent. On the screen it is struck through, because the screen
          // is a record of what happened; a message to a guest is a statement of what they are
          // paying for, and a dish they did not get does not belong in it.
          if (i.cancelled) continue;
          lines.push(`${i.name} ×${i.qty}  ${i.lineLabel}`);
        }
      }
      if (lines[lines.length - 1] !== '') lines.push('');
    },
    totals: () => {
      // The SAME rows the screen shows, not a second computation of them. `totals` already
      // carries Food, any discount, GST at the bill's own rate, the tip and To pay — so a
      // discrepancy between the message and the screen is impossible by construction.
      for (const row of bill.totals) lines.push(`${row.label}: ${row.value}`);
    },
    payment: () => {
      if (!bill.paymentMode) return;
      lines.push('');
      lines.push(
        `Paid by ${bill.paymentMode.toLowerCase()}${bill.paymentReference ? ` · ${bill.paymentReference}` : ''}`
      );
    },
    thanks: () => {
      const text = config.thanks.trim();
      if (!text) return;
      lines.push('');
      lines.push(text);
    },
  };

  for (const key of waFieldOrder(config)) build[key]();

  // A template with its header lines switched off must not open on a blank line.
  while (lines[0] === '') lines.shift();
  return lines.join('\n');
}

/**
 * The share link.
 *
 * `encodeURIComponent` and not a hand-rolled escape: a dish called "Chef's Special" or a
 * reference with a `#` in it would otherwise truncate the message at that character, and the
 * owner would send half a bill without noticing.
 */
export function whatsAppShareUrl(text: string, phoneDigits?: string | null): string {
  // With a number (item 38, 25-Sep-2026) the link opens THAT chat; without one, WhatsApp asks
  // which chat - the behaviour this link always had.
  return phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * A guest's WhatsApp number as wa.me wants it: country code and digits, nothing else (item 38).
 *
 * Empty is fine - the link then lets WhatsApp ask which chat. A ten-digit Indian mobile (6-9
 * first) gets 91 in front; +91 / 0 / spaces / dashes are tidied; anything else is refused in
 * words rather than turned into a link to a stranger.
 */
export function whatsAppNumber(input: string): { ok: true; digits: string | null } | { ok: false; reason: string } {
  const raw = input.trim();
  if (!raw) return { ok: true, digits: null };
  let d = raw.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (!/^\d+$/.test(d)) return { ok: false, reason: 'A phone number is digits only, with an optional + at the start.' };
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) {
    if (!/^[6-9]/.test(d)) return { ok: false, reason: 'An Indian mobile number starts with 6, 7, 8 or 9.' };
    return { ok: true, digits: `91${d}` };
  }
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return { ok: true, digits: d };
  if (d.length >= 8 && d.length <= 15 && !d.startsWith('0')) return { ok: true, digits: d };
  return { ok: false, reason: 'That does not look like a WhatsApp number. Enter the 10-digit mobile, or leave it empty.' };
}
