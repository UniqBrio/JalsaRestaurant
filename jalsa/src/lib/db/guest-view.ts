import 'server-only';
import { rupees, totalBill, totalsRows, type TotalsRow } from '@/lib/money';
import { KOT_STATUS, type FoodType, type KotStatus } from '@/lib/status';
import { billTotals, chargeableLines, listMenu, readAllSettings } from './queries';
import { readCart } from './mutations';
import { resolveGuest, type GuestContext } from './guest';
import { resolveFeatures, type GuestFeatures } from '@/lib/guest-features';
import type { Bill } from './types';

/* The feature flags and their defaults live outside the server boundary so the owner's
 * Settings panel can read the same defaults this payload fills gaps with. */
export type { GuestFeatures };

/**
 * guest-view - the single payload a guest's phone is given, assembled on the server.
 *
 * WHY ASSEMBLE IT HERE RATHER THAN LET THE PHONE JOIN THINGS UP
 *   The guest surface has eleven screens and seven sheets, and every one of them reads from the
 *   same handful of facts: the table, the menu, this bill's rounds, the running total, and which
 *   optional features the owner has switched on. Sent as one shape, a screen cannot invent a
 *   twelfth fact or compute a total a different way from the captain's phone.
 *
 *   It also means the phone holds NO pricing logic. Prices, availability, GST and the tip rule
 *   are all decided server-side, so a modified client can misdraw its own screen and still
 *   cannot change what it is charged.
 */

export interface GuestMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  foodType: FoodType;
  category: string;
  available: boolean;
  /** In this phone's cart, right now. Server-held, so it survives a reload. */
  inCart: number;
}

export interface GuestRound {
  code: string;
  placedAt: string;
  status: KotStatus;
  statusWord: string;
  tone: string;
  items: Array<{ id: string; name: string; qty: number; foodType: FoodType; servable: boolean }>;
}

export interface GuestPayload {
  phase: GuestContext['phase'];
  table: { name: string; zone: string };
  restaurantName: string;
  copy: Record<string, string>;
  features: GuestFeatures;
  captain: string;
  waiter: string;
  menu: GuestMenuItem[];
  categories: string[];
  cartCount: number;
  cartSubtotalLabel: string;
  rounds: GuestRound[];
  billCode: string | null;
  billStatus: Bill['status'] | null;
  runningTotalLabel: string;
  totals: TotalsRow[];
  payableLabel: string;
  tipOptions: number[];
  tipChosen: number;
  taxRate: number;
  paidAt: string | null;
  paymentMode: string | null;
  hoursRows: Array<{ day: string; hours: string; today: boolean }>;
  holidayNote: string;
  reviewUrl: string;
  callNumber: string;
  rescanMinutes: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const timeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export async function buildGuestPayload(tableName: string): Promise<GuestPayload | null> {
  const ctx = await resolveGuest(tableName);
  if (!ctx) return null;

  const [{ items, categories }, settings] = await Promise.all([listMenu(), readAllSettings()]);
  const cart = ctx.sessionId ? await readCart(ctx.sessionId) : [];
  const cartQty = new Map(cart.map((c) => [c.menuItemId, c.qty]));

  const copy = (settings.copy ?? {}) as Record<string, string>;
  const features = resolveFeatures(settings.customerFeatures);
  const tax = (settings.tax ?? {}) as { rate?: number };
  const taxRate = typeof tax.rate === 'number' ? tax.rate : 5;
  const tips = (settings.tips ?? {}) as { options?: number[] };
  const engagement = (settings.engagement ?? {}) as { reviewUrl?: string; callNumber?: string };
  const hours = (settings.hours ?? {}) as {
    days?: Array<{ day: string; open: string; close: string; shut: boolean }>;
    note?: string;
    holidays?: Array<{ date: string; label: string }>;
  };

  const menu: GuestMenuItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    price: i.price,
    priceLabel: rupees(i.price),
    foodType: i.foodType,
    category: i.category,
    available: i.available,
    inCart: cartQty.get(i.id) ?? 0,
  }));

  const cartLines = cart
    .map((c) => {
      const item = items.find((i) => i.id === c.menuItemId);
      return item ? { name: item.name, unitPrice: item.price, qty: c.qty } : null;
    })
    .filter((l): l is { name: string; unitPrice: number; qty: number } => l !== null);
  const cartSubtotal = totalBill({ lines: cartLines, taxRate: 0 }).subtotal;

  const bill = ctx.bill;
  const totals = bill ? billTotals(bill) : totalBill({ lines: [], taxRate });
  const running = bill ? totalBill({ lines: chargeableLines(bill), taxRate: 0 }).subtotal : 0;

  const rounds: GuestRound[] = (bill?.kots ?? []).map((k) => ({
    code: k.code,
    placedAt: timeLabel(k.createdAt),
    status: k.status,
    statusWord: KOT_STATUS[k.status].guest,
    tone: KOT_STATUS[k.status].tone,
    items: k.items
      .filter((i) => !i.cancelledAt)
      .map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        foodType: i.foodType,
        // The heart unlocks on SERVED and nothing earlier. That is the whole point of the
        // waiter's tap: it is the one moment somebody confirmed the food is on the table.
        servable: k.status === 'served',
      })),
  }));

  const todayName = DAYS[new Date().getDay()];

  return {
    phase: ctx.phase,
    table: { name: ctx.table.name, zone: ctx.table.zone },
    restaurantName: copy.name ?? 'Jalsa Restaurant',
    copy,
    features,
    captain: features.captainName ? (bill?.captain ?? '') : '',
    waiter: features.waiterName ? (bill?.waiter ?? '') : '',
    menu,
    categories: categories.filter((c) => c.count > 0).map((c) => c.name),
    cartCount: cart.reduce((a, c) => a + c.qty, 0),
    cartSubtotalLabel: `${rupees(cartSubtotal)} before tax`,
    rounds,
    billCode: bill?.code ?? null,
    billStatus: bill?.status ?? null,
    runningTotalLabel: `${rupees(running)} before tax`,
    totals: totalsRows(totals, { taxRate, ...(bill?.captain ? { tipTo: bill.captain } : {}) }),
    payableLabel: rupees(totals.payable),
    tipOptions: tips.options ?? [0, 10, 20, 30],
    tipChosen: totals.tip,
    taxRate,
    paidAt: bill?.closedAt ? timeLabel(bill.closedAt) : null,
    paymentMode: bill?.paymentMode ?? null,
    hoursRows: (hours.days ?? []).map((d) => ({
      day: d.day,
      hours: d.shut ? 'Closed' : `${d.open} – ${d.close}`,
      today: d.day === todayName,
    })),
    holidayNote: [hours.note, ...(hours.holidays ?? []).map((h) => `${h.date}: ${h.label}`)]
      .filter(Boolean)
      .join(' · '),
    reviewUrl: engagement.reviewUrl ?? '',
    callNumber: engagement.callNumber ?? '',
    rescanMinutes: ctx.rescanMinutes,
  };
}
