import { invoiceLines, invoiceTicketData, effectiveTemplate, type InvoiceBill, type InvoiceIdentity } from './invoice';
import {
  buildTicket,
  columnsFor,
  type PaperWidth,
  type TemplateConfig,
  type TicketData,
  type TicketKind,
  type TicketLine,
} from './print-template';
import { dateLabelIn, timeLabelIn } from './restaurant-time';
import type { FoodType } from './status';
import type { ComposeItem } from './ticket-compose';

/**
 * ticket-preview - what a machine WILL print, before it does (item 9, 25-Sep-2026).
 *
 * NOT A SECOND FORMATTER. Every line comes from the functions the printer's own path calls:
 *   - the template is `effectiveTemplate` - the saved template at the MACHINE's paper width,
 *     the same merge `composeTicket` makes;
 *   - a kitchen ticket is `buildTicket('kot', ...)`, with the date and time on the restaurant's
 *     clock exactly as `bridge-payload` stamps them;
 *   - a bill is `invoiceLines` - the one invoice (`invoice.ts`), from the latest real bill when
 *     there is one, so what the owner reads IS that bill as the counter would print it.
 * Only the kitchen sample's identifiers are invented, and they read PREVIEW, so nobody goes
 * looking for its table.
 */

export interface PreviewMenuItem {
  id: string;
  name: string;
  price: number;
  foodType: FoodType;
  category: string;
}

/**
 * A round from this restaurant's own menu, deliberately awkward: the longest name first, then
 * one of each food type, then whatever fills five lines. Moved here unchanged from the Templates
 * tab so the Printers screen previews the same round.
 */
export function previewRound(menu: readonly PreviewMenuItem[]): ComposeItem[] {
  if (menu.length === 0) return [];
  const longest = [...menu].sort((a, b) => b.name.length - a.name.length)[0]!;
  const picked = [longest];
  (['veg', 'non_veg', 'egg'] as const).forEach((t) => {
    const found = menu.find((m) => m.foodType === t && !picked.some((p) => p.id === m.id));
    if (found) picked.push(found);
  });
  menu.forEach((m) => {
    if (picked.length < 5 && !picked.some((p) => p.id === m.id)) picked.push(m);
  });
  return picked.map((m, i) => ({
    name: m.name,
    qty: i === 1 ? 12 : 1,
    foodType: m.foodType,
    rate: m.price,
    category: m.category,
    instruction: i === 0 ? 'less spicy, no onion' : '',
  }));
}

/** The kitchen sample, as `TicketData`. */
export function previewKotData(menu: readonly PreviewMenuItem[], who: InvoiceIdentity, now: Date = new Date()): TicketData {
  return {
    restaurant: (who.name || 'Jalsa').toUpperCase(),
    branch: who.address,
    phone: who.phone,
    gstin: who.gstin || '—',
    kotCode: 'KOT-0000',
    station: 'Main Kitchen',
    roundCode: 'R-0',
    billCode: 'B-0000',
    table: 'PREVIEW',
    customer: 'Preview',
    captain: 'Preview',
    date: dateLabelIn(now),
    time: timeLabelIn(now),
    source: 'Guest phone',
    note: 'Preview of the longest note this template can carry without clipping',
    items: previewRound(menu),
  };
}

/** A bill made of the sample round, for a restaurant with no bill yet. */
export function sampleInvoiceBill(menu: readonly PreviewMenuItem[], taxRate: number, now: Date = new Date()): InvoiceBill {
  return {
    code: 'B-0000',
    hostTable: 'PREVIEW',
    tables: ['PREVIEW'],
    captain: '',
    openedAt: now.toISOString(),
    closedAt: now.toISOString(),
    discountPct: 0,
    discountAmount: 0,
    taxRate,
    paymentMode: 'UPI',
    kots: [
      {
        status: 'served',
        items: previewRound(menu).map((i) => ({
          name: i.name,
          qty: i.qty,
          unitPrice: i.rate,
          foodType: i.foodType,
          category: i.category,
          cancelledAt: null,
        })),
      },
    ],
  };
}

export interface TicketPreview {
  lines: TicketLine[];
  cols: number;
  /** Where the content came from, said on screen. */
  source: string;
}

/**
 * The preview for one kind of ticket at one paper width.
 *
 * `bill` - the latest real bill if one is given, otherwise the sample round as a bill.
 * `template` - the saved (or in-progress) template for this kind; merged exactly as printing does.
 */
export function ticketPreview(input: {
  kind: TicketKind;
  width: PaperWidth;
  template: Partial<TemplateConfig> | undefined;
  menu: readonly PreviewMenuItem[];
  who: InvoiceIdentity;
  taxRate: number;
  bill?: InvoiceBill | null;
  now?: Date;
}): TicketPreview {
  const config = effectiveTemplate(input.kind, input.width, input.template);
  const cols = columnsFor(config);
  if (input.kind === 'kot') {
    return {
      lines: buildTicket('kot', previewKotData(input.menu, input.who, input.now), config),
      cols,
      source: 'A round made from your own menu',
    };
  }
  const bill = input.bill ?? sampleInvoiceBill(input.menu, input.taxRate, input.now);
  return {
    lines: invoiceLines(bill, input.who, input.width, input.template, input.now),
    cols,
    source: input.bill ? `Bill ${input.bill.code}, as the counter prints it` : 'A bill made from your own menu',
  };
}

/** The sample bill as `TicketData`, for the Templates tab's validation. */
export const previewBillData = (menu: readonly PreviewMenuItem[], who: InvoiceIdentity, taxRate: number, now?: Date): TicketData =>
  invoiceTicketData(sampleInvoiceBill(menu, taxRate, now), who, now);

/** Who the restaurant is, as every preview needs it, from the console payload. */
export function previewIdentity(
  restaurant: Record<string, unknown> | null | undefined,
  settings: Record<string, unknown>
): InvoiceIdentity {
  const r = restaurant ?? {};
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const tax = (settings.tax ?? {}) as { gstin?: unknown };
  const engagement = (settings.engagement ?? {}) as { upiId?: unknown };
  return {
    name: str(r.display_name) || str(r.legal_name),
    address: str(r.address),
    phone: str(r.phone),
    gstin: str(tax.gstin),
    upiId: str(engagement.upiId),
  };
}

export const previewTaxRate = (settings: Record<string, unknown>): number => {
  const rate = (settings.tax as { rate?: unknown } | undefined)?.rate;
  return typeof rate === 'number' ? rate : 5;
};
