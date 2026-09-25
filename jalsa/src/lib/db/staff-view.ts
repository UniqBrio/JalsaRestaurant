import 'server-only';
import { timeLabelIn } from '@/lib/restaurant-time';
import { rupees, totalsRows, type TotalsRow } from '@/lib/money';
import {
  KOT_STATUS,
  TABLE_STATE,
  canHoldBillRole,
  captainMayAssignWaiter,
  type KotStatus,
  type Tone,
} from '@/lib/status';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { actorFor, type SignedInStaff } from './auth';
import { readWelcomeDrinks, type WelcomeDrinksConfig } from '@/lib/welcome-drinks';
import type { SpineFields } from '@/components/ui/bill';
import { billTotals, listFloor, listMenu, listOpenBills, listOpenRequests, readAllSettings } from './queries';
import type { Bill, FloorTable, KotPrintJob, PrintJobStatus } from './types';

/**
 * staff-view — what a captain's or waiter's phone is given.
 *
 * WHY THE PAYLOAD IS SHAPED BY ROLE ON THE SERVER
 *   A waiter's screen has no prices on it. The design says so in words on the screen itself
 *   ("Bill amounts are hidden for waiters"), and a promise like that is only worth anything if
 *   the figures are absent from the RESPONSE, not merely hidden by the component. Otherwise
 *   "hidden" means "one devtools tab away", which is not what anyone reading that sentence
 *   understands it to mean.
 *
 * THE FIVE IDENTIFIERS TRAVEL WITH EVERY BILL
 *   Assembled here, once, so the strip on the table screen, the strip on the KOT list and the
 *   strip on the printed ticket cannot fall out of step (Standard 6.3).
 */

export interface StaffKotView {
  id: string;
  code: string;
  status: KotStatus;
  statusWord: string;
  tone: Tone;
  fromTable: string;
  placedBy: string;
  source: 'guest' | 'captain' | 'owner';
  placedAt: string;
  ageMinutes: number;
  printStatus: PrintJobStatus;
  reprintCount: number;
  /** One per machine. A captain reading a failure needs to know which room it is in. */
  printJobs: KotPrintJob[];
  /** True once the kitchen has started: the gate for quantity changes and cancellations. */
  kitchenStarted: boolean;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    qtyBefore: number | null;
    foodType: 'veg' | 'non_veg' | 'egg';
    cancelled: boolean;
    cancelReason: string;
  }>;
}

export interface StaffBillView {
  id: string;
  code: string;
  status: Bill['status'];
  spine: SpineFields;
  tables: string[];
  groupCode: string | null;
  hostTable: string;
  guests: number;
  openedAt: string;
  occasion: string | null;
  kots: StaffKotView[];
  /** Absent for a waiter. The absence is the point. */
  totals: TotalsRow[] | null;
  payableLabel: string | null;
  /** Before any discount and before tax — the base a discount is actually taken from.
   *  Null where this person may not see money at all (a waiter). */
  subtotal: number | null;
  /** Enough for the Close sheet to call `totalBill` itself — same reason as the owner's view. */
  taxRate: number;
  tip: number;
  /** The waiter on this bill, for the picker's current choice. */
  waiterId: string | null;
  /** This person may change the waiter here: it is their own open bill (G1). */
  canAssignWaiter: boolean;
}

export interface StaffPayload {
  me: { id: string; name: string; role: string; initials: string };
  grants: string[];
  isWaiter: boolean;
  dayNote: string;
  tables: Array<
    FloorTable & {
      stateLabel: string;
      tone: Tone;
      totalLabel: string | null;
    }
  >;
  bills: StaffBillView[];
  /** The welcome drinks offered on a table's first order (D1). */
  welcomeDrinks: WelcomeDrinksConfig;
  /** Who can be the waiter on a bill: active staff whose role may hold it (G1). */
  waiters: Array<{ id: string; name: string; role: string }>;
  /** Rounds the kitchen has marked ready, oldest first — the run list. */
  ready: Array<{ billId: string; kot: StaffKotView; tableName: string; billCode: string; captain: string }>;
  requests: Array<{ id: string; kind: string; note: string; tableName: string; ageMinutes: number; urgent: boolean }>;
  menu: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    priceLabel: string;
    foodType: 'veg' | 'non_veg' | 'egg';
    available: boolean;
  }>;
  categories: string[];
  /** Every category with its id, for a dish added from the ordering screen (E1). */
  menuCategories: Array<{ id: string; name: string }>;
  /** What this person may do tonight, as the design's own list of sentences. */
  myTables: string[];
}

// The restaurant's wall clock, not the host's (RC-016): the server runs in UTC.
const timeLabel = (iso: string): string => timeLabelIn(iso);

const minutesSince = (iso: string): number => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

/** Five minutes is the design's own threshold: past it, a request also shows on the owner's board. */
const REQUEST_URGENT_MINUTES = 5;

function shapeKot(bill: Bill, k: Bill['kots'][number]): StaffKotView {
  return {
    id: k.id,
    code: k.code,
    status: k.status,
    statusWord: KOT_STATUS[k.status].staff,
    tone: KOT_STATUS[k.status].tone,
    fromTable: k.tableName,
    placedBy: k.placedBy,
    source: k.source,
    placedAt: timeLabel(k.createdAt),
    ageMinutes: minutesSince(k.createdAt),
    printStatus: k.printStatus,
    reprintCount: k.reprintCount,
    printJobs: k.printJobs,
    kitchenStarted: k.status !== 'new' && k.status !== 'cancelled',
    items: k.items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      qtyBefore: i.qtyBefore,
      foodType: i.foodType,
      cancelled: i.cancelledAt !== null,
      cancelReason: i.cancelReason,
    })),
  };
}

export async function buildStaffPayload(staff: SignedInStaff): Promise<StaffPayload> {
  const restaurantId = await currentRestaurantId();
  const [floor, bills, requests, { items, categories }, settings, peopleRes] = await Promise.all([
    listFloor(),
    listOpenBills(),
    listOpenRequests(),
    listMenu(),
    readAllSettings(),
    // Names and roles only, for the waiter picker - the same predicate the server checks (G1).
    db()
      .from('staff')
      .select('id,name,role,active')
      .eq('restaurant_id', restaurantId)
      .is('removed_at', null)
      .order('name', { ascending: true }),
  ]);
  if (peopleRes.error) throw peopleRes.error;
  const actor = actorFor(staff);

  const isWaiter = staff.role === 'Waiter';
  const canSeeMoney = staff.grants.can('bill.view');

  // A captain sees the tables on their own open bills, plus their standing assignment. Anything
  // wider would put a stranger's table on their floor; anything narrower would hide a table they
  // are actually running because the bill was opened by a guest before anyone was assigned.
  const mine = new Set<string>();
  for (const b of bills) {
    if (b.captainId === staff.staffId || b.waiterId === staff.staffId) for (const t of b.tables) mine.add(t);
  }

  const day = (settings.day ?? {}) as { note?: string };
  const tax = (settings.tax ?? {}) as { rate?: number };
  const taxRate = typeof tax.rate === 'number' ? tax.rate : 5;

  const shapedBills: StaffBillView[] = bills.map((b) => {
    const totals = billTotals(b);
    const lastKot = b.kots[b.kots.length - 1];
    return {
      id: b.id,
      code: b.code,
      status: b.status,
      spine: {
        captain: b.captain,
        table: b.tables.join(' · '),
        bill: b.code,
        waiter: b.waiter,
        kot: lastKot ? lastKot.code : '—',
      },
      tables: b.tables,
      groupCode: b.groupCode,
      hostTable: b.hostTable,
      guests: b.guests,
      openedAt: timeLabel(b.openedAt),
      occasion: b.occasion ? `${b.occasion.type}${b.occasion.name ? ` — ${b.occasion.name}` : ''}` : null,
      kots: b.kots.map((k) => shapeKot(b, k)),
      totals: canSeeMoney ? totalsRows(totals, { taxRate, tipTo: b.captain }) : null,
      payableLabel: canSeeMoney ? rupees(totals.payable) : null,
      subtotal: canSeeMoney ? totals.subtotal : null,
      taxRate,
      tip: totals.tip,
      waiterId: b.waiterId,
      canAssignWaiter: captainMayAssignWaiter({ role: 'waiter', actor, bill: b }),
    };
  });

  const ready = bills
    .flatMap((b) =>
      b.kots
        .filter((k) => k.status === 'ready' || k.status === 'picked_up')
        .map((k) => ({
          billId: b.id,
          kot: shapeKot(b, k),
          tableName: k.tableName,
          billCode: b.code,
          captain: b.captain,
        }))
    )
    // Oldest first. Food goes cold in the order it was plated, not the order the list was built.
    .sort((a, b) => b.kot.ageMinutes - a.kot.ageMinutes);

  return {
    me: { id: staff.staffId, name: staff.name, role: staff.role, initials: staff.initials },
    grants: staff.grants.list(),
    isWaiter,
    dayNote: day.note ?? '',
    tables: floor.map((t) => ({
      ...t,
      stateLabel: TABLE_STATE[t.state].label,
      tone: TABLE_STATE[t.state].tone,
      totalLabel: canSeeMoney && t.total > 0 ? rupees(t.total) : null,
      total: canSeeMoney ? t.total : 0,
    })),
    bills: shapedBills,
    welcomeDrinks: readWelcomeDrinks(settings.welcomeDrinks),
    waiters: (peopleRes.data ?? [])
      .filter((p) => p.active === true && canHoldBillRole('waiter', p.role as string))
      .map((p) => ({ id: p.id as string, name: p.name as string, role: p.role as string })),
    ready,
    requests: requests.map((r) => ({
      id: r.id,
      kind: r.kind,
      note: r.note,
      tableName: r.tableName,
      ageMinutes: r.ageMinutes,
      urgent: r.ageMinutes >= REQUEST_URGENT_MINUTES,
    })),
    menu: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      price: i.price,
      priceLabel: rupees(i.price),
      foodType: i.foodType,
      available: i.available,
    })),
    categories: categories.filter((c) => c.count > 0).map((c) => c.name),
    menuCategories: categories.map((c) => ({ id: c.id, name: c.name })),
    myTables: [...mine].sort(),
  };
}
