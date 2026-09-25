import { totalBill } from './money';
import { buildTicket, defaultTemplate, type PaperWidth, type TemplateConfig, type TicketData, type TicketKind, type TicketLine } from './print-template';
import { dateLabelIn, timeLabelIn } from './restaurant-time';
import type { ComposeItem } from './ticket-compose';

/**
 * invoice - the ONE invoice, whoever asks for it (25-Sep correction list, item 8).
 *
 * THREE FORMATS BECAME ONE
 *   Until today a bill existed in three shapes that had drifted apart:
 *     - the thermal invoice (`bridge-payload.ts`) - which also counted the lines of CANCELLED
 *       rounds, so its total could differ from the one on the owner's screen;
 *     - the Templates preview - its own sample, its own tax rounding, the browser's clock, and a
 *       restaurant name read from a column that does not exist;
 *     - the browser "Print" on a bill - the on-screen detail sheet, printed as it was.
 *   All three now call this module: the same chargeable lines, the same `totalBill`, the same
 *   header, the same restaurant clock, laid out by the same `buildBill`.
 *
 * PURE. No database, no React, no `server-only`: the server composes the paper with it and the
 * console composes the preview and the browser copy with it, and they cannot disagree.
 */

/** The bill as the invoice needs it - satisfied by `Bill` (server) and `OwnerBillView.invoice` (console). */
export interface InvoiceBill {
  code: string;
  hostTable: string;
  tables: readonly string[];
  captain: string;
  openedAt: string;
  closedAt: string | null;
  discountPct: number;
  discountAmount: number;
  taxRate: number;
  paymentMode: string | null;
  kots: ReadonlyArray<{
    status: string;
    items: ReadonlyArray<{
      name: string;
      qty: number;
      unitPrice: number;
      foodType: ComposeItem['foodType'];
      category: string;
      cancelledAt: string | null;
    }>;
  }>;
}

export interface InvoiceIdentity {
  /** What the guest reads at the top: the display name, falling back to the registered one. */
  name: string;
  address: string;
  phone: string;
  gstin: string;
  upiId: string;
}

/**
 * What a guest is charged for, in the order it was ordered: rounds oldest first (the bill's
 * `kots` are already in time order), lines in cart order (`line_seq`, item 3). A cancelled round
 * and a cancelled line are not on the invoice - the same rule `chargeableLines` applies to the
 * total on the owner's screen.
 */
export function invoiceItems(bill: InvoiceBill): ComposeItem[] {
  return bill.kots
    .filter((k) => k.status !== 'cancelled')
    .flatMap((k) => k.items.filter((i) => !i.cancelledAt))
    .map((i) => ({
      name: i.name,
      qty: i.qty,
      foodType: i.foodType,
      rate: Number(i.unitPrice),
      category: i.category,
      instruction: '',
    }));
}

/**
 * The invoice's content. Dated when the bill was CLOSED - an invoice is issued at settlement;
 * an open bill printed early is dated now.
 */
export function invoiceTicketData(bill: InvoiceBill, who: InvoiceIdentity, now: Date = new Date()): TicketData {
  const items = invoiceItems(bill);
  const t = totalBill({
    lines: items.map((i) => ({ name: i.name, unitPrice: i.rate, qty: i.qty })),
    discountPct: bill.discountPct,
    discountAmount: bill.discountAmount,
    taxRate: bill.taxRate,
  });
  const at = bill.closedAt ?? now.toISOString();
  return {
    restaurant: (who.name || 'Jalsa').toUpperCase(),
    branch: who.address,
    phone: who.phone,
    gstin: who.gstin || '—',
    kotCode: '',
    station: '',
    roundCode: '',
    billCode: bill.code,
    table: bill.tables.length ? bill.tables.join(', ') : bill.hostTable,
    customer: '',
    captain: bill.captain === 'Unassigned' ? '' : bill.captain,
    date: dateLabelIn(at),
    time: timeLabelIn(at),
    source: '',
    note: '',
    items,
    totals: {
      subtotal: t.subtotal,
      discount: t.discount,
      tax: t.tax,
      payable: t.payable,
      paymentMode: bill.paymentMode ?? '',
      taxRate: bill.taxRate,
    },
    ...(who.upiId ? { upiId: who.upiId } : {}),
  };
}

/**
 * The template a ticket is ACTUALLY laid out with: the saved template over the defaults, at the
 * width of the machine it prints on. The one merge, shared by printing (`composeTicket`) and every
 * preview, so a preview can never be drawn at a width the paper does not have.
 */
export function effectiveTemplate(kind: TicketKind, width: PaperWidth, saved: Partial<TemplateConfig> | undefined): TemplateConfig {
  return { ...defaultTemplate(kind, width), ...(saved ?? {}), width };
}

/** The invoice as lines - exactly what the counter printer is handed for this bill. */
export function invoiceLines(
  bill: InvoiceBill,
  who: InvoiceIdentity,
  width: PaperWidth,
  saved: Partial<TemplateConfig> | undefined,
  now?: Date
): TicketLine[] {
  return buildTicket('bill', invoiceTicketData(bill, who, now), effectiveTemplate('bill', width, saved));
}
