import 'server-only';
import { rupees, totalBill, totalsRows, type TotalsRow } from '@/lib/money';
import { KOT_STATUS, type FoodType, type KotStatus } from '@/lib/status';
import {
  billTotals,
  chargeableLines,
  listGuestReplies,
  listHeardSources,
  listMenu,
  readAllSettings,
} from './queries';
import { readCart } from './mutations';
import { resolveGuest, type GuestContext } from './guest';
import { resolveFeatures, type GuestFeatures } from '@/lib/guest-features';
import type { Bill, GuestReply } from './types';

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
  /**
   * `lineLabel` is qty x unit price, already formatted.
   *
   * It exists for the invoice, which is the one screen a guest is asked to CHECK. The design
   * set's invoice row is name / qty / amount; this payload carried only name and qty, so the
   * bill could be read but not verified — a guest could see "Paneer Tikka x2" and the payable
   * at the bottom and had no way to connect them. Formatted here, beside every other money
   * string, rather than by the screen: `rupees()` is one idiom and the invoice is not the place
   * to grow a second.
   */
  items: Array<{
    id: string;
    name: string;
    qty: number;
    foodType: FoodType;
    servable: boolean;
    lineLabel: string;
  }>;
}

export interface GuestPayload {
  phase: GuestContext['phase'];
  table: { name: string; zone: string };
  restaurantName: string;
  /** How this party said they found Jalsa — '' until they answer. */
  heardAbout: string;
  /**
   * What the picker offers: the seeded answers, plus every distinct answer THIS restaurant has
   * recorded. Assembled the same way the expense-category list is, and scoped by restaurant_id
   * in the query, so one restaurant's answers can never appear in another's.
   */
  heardSources: string[];
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
  /** Asked for once, then withdrawn: the bill is open again and the phone says so. */
  paymentPaused: boolean;
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
  /** Answers the owner has written to this table's suggestions — pattern 4f. Newest first. */
  replies: GuestReply[];
  callNumber: string;
  rescanMinutes: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const timeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * The payload for a table, resolving the guest session from scratch.
 *
 * This is the entry point for the two callers that genuinely have nothing but a table name: the
 * first render of `/t/[table]`, and the poll at `/api/guest/state`. Both may need a session
 * CREATED, so both must go through `resolveGuest`.
 */
export async function buildGuestPayload(tableName: string): Promise<GuestPayload | null> {
  const ctx = await resolveGuest(tableName);
  if (!ctx) return null;
  return assembleGuestPayload(ctx);
}

/**
 * The payload, from a context that is already resolved.
 *
 * SPLIT OUT, NEVER COPIED. A write route answering with the new state (`db/guest-echo.ts`) knows
 * its session already — the route looked it up to authorise the write — and re-resolving it cost
 * eight round trips to a database in another region, of which six re-read rows the route was
 * holding. The fix is for that path to build the CONTEXT differently, not to assemble the payload
 * differently: a second assembler would be a second answer to "what does this guest see", and the
 * two would drift with the first field either one forgot.
 *
 * So there is exactly one body below, and both entry points end here.
 */
/**
 * The answers offered before anybody has given one.
 *
 * A starting point, not a closed set: the request is explicit that a guest may add their own,
 * and anything added joins the list for the next guest by being recorded on their session.
 * Not a database enum, for exactly that reason.
 */
export const SEEDED_HEARD_SOURCES = [
  'Google review',
  'Friend recommended',
  'Ordered earlier',
  'Regular customer',
] as const;

export async function assembleGuestPayload(ctx: GuestContext): Promise<GuestPayload> {
  /**
   * THE CART IS NOT DOWNSTREAM OF THE MENU.
   *
   * `readCart` needs `ctx.sessionId` and nothing else — it was serialised after the menu and the
   * settings only because it is written on the next line. Everything that joins them (`cartQty`,
   * `cartLines`) is in-memory work below. So all three are issued together, and a payload build
   * costs one wave rather than two.
   */
  const [{ items, categories }, settings, cart, replies, recordedSources] = await Promise.all([
    listMenu(),
    readAllSettings(),
    ctx.sessionId ? readCart(ctx.sessionId) : Promise.resolve([]),
    // Into the SAME wave, not after it. An answered suggestion is one more thing this screen
    // shows and nothing below depends on it, so it costs no extra round trip.
    listGuestReplies(ctx.table.id),
    /*
      ONLY ON THE SCREEN THAT ASKS. `/api/guest/state` is POLLED — this payload is rebuilt every
      few seconds for every phone at every table. `listHeardSources` reads every non-empty
      `heard_about` the restaurant has ever recorded, which is a set that only grows, and the
      field it feeds renders on the welcome screen alone. Issued unconditionally it was an
      unbounded scan on the hottest path in the application, for data nobody was looking at.
    */
    ctx.phase === 'welcome' ? listHeardSources() : Promise.resolve([]),
  ]);
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
        // The unit price is what the round was placed at, not today's menu price — a bill has
        // to reconcile to what was charged, and a dish repriced mid-evening would otherwise
        // make every earlier invoice wrong.
        lineLabel: rupees(i.unitPrice * i.qty),
      })),
  }));

  const todayName = DAYS[new Date().getDay()];

  return {
    phase: ctx.phase,
    table: { name: ctx.table.name, zone: ctx.table.zone },
    restaurantName: copy.name ?? 'Jalsa Restaurant',
    heardAbout: ctx.heardAbout ?? '',
    /* Seeds first, in the order the request fixes them, then what this restaurant has been
       told, with anything that duplicates a seed folded out case-insensitively. */
    heardSources: [
      ...SEEDED_HEARD_SOURCES,
      ...recordedSources.filter(
        (v) => !SEEDED_HEARD_SOURCES.some((seed) => seed.toLowerCase() === v.trim().toLowerCase())
      ),
    ],
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
    // Open, but asked for once already. The pair is the paused state — see withdrawPaymentRequest.
    paymentPaused: bill?.status === 'open' && bill.paymentRequestedAt !== null,
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
    replies,
    callNumber: engagement.callNumber ?? '',
    rescanMinutes: ctx.rescanMinutes,
  };
}
