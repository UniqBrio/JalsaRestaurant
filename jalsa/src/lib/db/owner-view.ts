import 'server-only';
import { timeLabelIn, todayWindow } from '@/lib/restaurant-time';
import { rupees, totalsRows, type TotalsRow } from '@/lib/money';
import { KOT_SOURCE_LABEL, KOT_STATUS, TABLE_STATE, type Tone, tableIsFreeable } from '@/lib/status';
import type { SpineFields } from '@/components/ui/bill';
import {
  billTotals,
  listAudit,
  listClosedBillsToday,
  listExpenses,
  listFloor,
  listMenu,
  listOpenBills,
  listOpenRequests,
  listPrinters,
  listBridgeTokens,
  listPrintComputers,
  listPrinterMappings,
  pendingPairing,
  listPrintJobs,
  listStaff,
  listSuggestions,
  listTips,
  listWaitlist,
  readAllSettings,
  readRestaurant,
} from './queries';
import type { SignedInStaff } from './auth';
import { db } from '@/lib/supabase/server';
import { currentBridgeDownload } from '@/lib/print-bridge-artifact';
import type {
  AuditRow, Bill, BridgeTokenRow, ExpenseRow, PrintComputerRow, PrinterMappingRow, KotPrintJob, PrinterRow, PrintJobRow, PrintJobStatus, StaffMember, Suggestion, TipRow, WaitlistRow,
} from './types';

/**
 * owner-view — the whole console, assembled once per read.
 *
 * WHY ONE PAYLOAD FOR THIRTEEN SECTIONS
 *   Every figure on the dashboard links to the section that itemises it, and the design is
 *   explicit that navigating there must RECONCILE — the detail has to add up to the number that
 *   was clicked (Standard 1.4). Assembled in one pass from one set of reads, it always does.
 *   Assembled per section, the dashboard and the report are two independent computations of the
 *   same figure, and the day they disagree is the day both stop being believed (7.4).
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   The entrance waitlist, the uplift report and the print-template designer. They are named
 *   slices of their own in the request file, and a half-built waitlist on the dashboard would
 *   read as a finished one.
 */

export interface OwnerBillView {
  id: string;
  code: string;
  status: Bill['status'];
  statusLabel: string;
  tone: Tone;
  spine: SpineFields;
  tables: string[];
  groupCode: string | null;
  guests: number;
  openedAt: string;
  /**
   * How the closure ended, for the bill-detail screen.
   *
   * All four were already being SELECTED (`BILL_SELECT` carries payment_mode,
   * payment_reference, closed_at and closed_by) and already shaped onto `Bill` — this view
   * simply never projected them, so the console could list a closed bill and not say how it
   * was settled. No query changed to add them.
   *
   * Null on a bill that is still open, which is the honest value: "not closed yet" is not the
   * same fact as "closed, mode unrecorded", and the database's `bill_closure_is_attributed`
   * constraint means the second cannot happen.
   */
  paymentMode: string | null;
  paymentReference: string;
  closedAt: string | null;
  closedBy: string | null;
  occasion: string | null;
  payable: number;
  payableLabel: string;
  /** Before any discount and before tax — the base a discount is actually taken from. */
  subtotal: number;
  /** Enough for the closure screen to call `totalBill` itself, so its preview of the payable
   *  after a discount IS the figure the server will charge rather than a second formula. */
  taxRate: number;
  tip: number;
  totals: TotalsRow[];
  /**
   * Per-table breakdown: what each table's own rounds came to, before tax and tip.
   *
   * It answers "who ate what" without apportioning anything — and it is the same `where` clause
   * `detachTableFromBill` uses, so the figure a host reads beside Separate is exactly what moves
   * onto the new bill.
   */
  perTable: Array<{ table: string; amountLabel: string; isHost: boolean }>;
  kots: Array<{
    id: string;
    code: string;
    statusLabel: string;
    tone: Tone;
    fromTable: string;
    source: 'guest' | 'captain' | 'owner';
    sourceLabel: string;
    placedAt: string;
    printStatus: PrintJobStatus;
    reprintCount: number;
    /** One per machine. What lets the board say WHERE a ticket went without opening Settings. */
    printJobs: KotPrintJob[];
    items: Array<{
      id: string;
      name: string;
      qty: number;
      foodType: 'veg' | 'non_veg' | 'egg';
      lineLabel: string;
      cancelled: boolean;
    }>;
  }>;
}

export interface OwnerPayload {
  me: { id: string; name: string; role: string; initials: string };
  grants: string[];
  restaurant: Record<string, unknown>;
  settings: Record<string, Record<string, unknown>>;

  /** Dashboard figures. Each one is the SAME value its section itemises. */
  today: {
    salesLabel: string;
    sales: number;
    orders: number;
    coversLabel: string;
    tipsLabel: string;
    tips: number;
    discountsLabel: string;
    openBills: number;
    awaitingClosure: number;
    openRequests: number;
    printFailures: number;
    /**
     * Rounds whose paper has not arrived. Distinct from `printFailures`, and the reason the
     * dashboard can no longer read "Every ticket printed" off a zero failure count.
     */
    printWaiting: number;
    paymentMix: Array<{ mode: string; amountLabel: string; count: number }>;
  };

  floor: Array<{
    id: string;
    name: string;
    zone: string;
    seats: number;
    active: boolean;
    stateLabel: string;
    tone: Tone;
    billId: string | null;
    line: string;
    totalLabel: string;
    /** Whether this table is holding something that a hand-made release could let go of.
     *  Decided HERE, from the same rule freeTable enforces, so the screen never offers an
     *  action the server is about to refuse (Standard 5.6). */
    freeable: boolean;
    /** Released by a closure and not yet reset. The waitlist must not seat onto one. */
    clearing: { releasedAtIso: string; billCode: string; guests: number; waitedMinutes: number } | null;
  }>;
  openBills: OwnerBillView[];
  closedToday: OwnerBillView[];
  requests: Array<{
    id: string;
    kind: string;
    note: string;
    tableName: string;
    captain: string;
    ageMinutes: number;
    urgent: boolean;
  }>;
  suggestions: Suggestion[];
  menu: Array<{
    id: string;
    name: string;
    category: string;
    categoryId: string;
    price: number;
    priceLabel: string;
    foodType: 'veg' | 'non_veg' | 'egg';
    available: boolean;
    closedReason: string;
    description: string;
  }>;
  /** `parentId`: the top-level category this one is a sub-menu of, or null (I3). */
  categories: Array<{ id: string; name: string; count: number; parentId: string | null }>;
  staff: StaffMember[];
  /** Each person's ACTUAL grants, so the access panel edits what is true rather than a preset. */
  staffGrants: Record<string, string[]>;
  tips: TipRow[];
  /** The entrance queue: everyone still waiting, oldest first. */
  waitlist: Array<WaitlistRow & { joinedAt: string; position: number }>;
  tipsTotalLabel: string;
  expenses: ExpenseRow[];
  expensesTotalLabel: string;
  printers: PrinterRow[];
  /** The PCs holding a bridge token. Never the token, and never its hash. */
  bridges: BridgeTokenRow[];
  /** The Printers screen (23-Sep-2026): live computers, what each one found, and the mappings. */
  printComputers: PrintComputerRow[];
  printerMappings: PrinterMappingRow[];
  /** A pairing code still waiting to be typed — its name and deadline, never the code. */
  pairing: { label: string; expiresAt: string } | null;
  /** Whether "Download for Windows" leads anywhere real on this server. */
  printBridgeDownload: { available: boolean };
  /** Tonight's print trail — the History section of Print Setup. Newest first. */
  printJobs: PrintJobRow[];
  audit: AuditRow[];
  qrOrigin: string;
}

// The restaurant's wall clock, not the host's (RC-016): the server runs in UTC.
const timeLabel = (iso: string): string => timeLabelIn(iso);

const minutesSince = (iso: string): number => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));


function shapeBill(b: Bill, taxRate: number): OwnerBillView {
  const totals = billTotals(b);
  const lastKot = b.kots[b.kots.length - 1];

  // Per table: what each table's own rounds came to, before tax and tip. It is shown so the
  // host can see who ate what — it never splits the bill, and the design says so on the screen.
  const perTable = b.tables.map((t) => {
    const amount = b.kots
      .filter((k) => k.tableName === t && k.status !== 'cancelled')
      .flatMap((k) => k.items.filter((i) => !i.cancelledAt))
      .reduce((a, i) => a + i.unitPrice * i.qty, 0);
    // The host table is the one the bill was opened on and cannot be separated off it — its
    // row says so rather than offering a button that refuses.
    return { table: t, amountLabel: rupees(amount), isHost: t === b.hostTable };
  });

  return {
    id: b.id,
    code: b.code,
    status: b.status,
    statusLabel: b.status === 'payment_requested' ? 'Payment requested' : b.status === 'closed' ? 'Closed' : 'Open',
    tone: b.status === 'payment_requested' ? 'primary' : b.status === 'closed' ? 'success' : 'neutral',
    spine: {
      captain: b.captain,
      table: b.tables.join(' · '),
      bill: b.code,
      waiter: b.waiter,
      kot: lastKot ? lastKot.code : '—',
    },
    tables: b.tables,
    groupCode: b.groupCode,
    guests: b.guests,
    openedAt: timeLabel(b.openedAt),
    paymentMode: b.paymentMode,
    paymentReference: b.paymentReference,
    closedAt: b.closedAt ? timeLabel(b.closedAt) : null,
    closedBy: b.closedBy,
    occasion: b.occasion
      ? `${b.occasion.type}${b.occasion.name ? ` — ${b.occasion.name}` : ''} (${b.occasion.source})`
      : null,
    payable: totals.payable,
    payableLabel: rupees(totals.payable),
    subtotal: totals.subtotal,
    taxRate,
    tip: totals.tip,
    totals: totalsRows(totals, { taxRate, tipTo: b.captain }),
    perTable: b.tables.length > 1 ? perTable : [],
    kots: b.kots.map((k) => ({
      id: k.id,
      code: k.code,
      statusLabel: KOT_STATUS[k.status].staff,
      tone: KOT_STATUS[k.status].tone,
      fromTable: k.tableName,
      source: k.source,
      sourceLabel: KOT_SOURCE_LABEL[k.source],
      placedAt: timeLabel(k.createdAt),
      printStatus: k.printStatus,
      reprintCount: k.reprintCount,
      printJobs: k.printJobs,
      items: k.items.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        foodType: i.foodType,
        lineLabel: rupees(i.unitPrice * i.qty),
        cancelled: i.cancelledAt !== null,
      })),
    })),
  };
}

export async function buildOwnerPayload(staff: SignedInStaff, qrOrigin: string): Promise<OwnerPayload> {
  const [
    restaurant,
    settings,
    floor,
    open,
    closed,
    requests,
    suggestions,
    { items, categories },
    people,
    tips,
    expenses,
    printers,
    bridges,
    printJobs,
    audit,
    waitlist,
    printComputers,
    printerMappings,
    pairing,
  ] = await Promise.all([
    readRestaurant(),
    readAllSettings(),
    listFloor(),
    listOpenBills(),
    listClosedBillsToday(),
    listOpenRequests(),
    listSuggestions(),
    listMenu(),
    listStaff(),
    listTips(),
    listExpenses(),
    listPrinters(),
    listBridgeTokens(),
    listPrintJobs(),
    listAudit(),
    listWaitlist(),
    listPrintComputers(),
    listPrinterMappings(),
    pendingPairing(),
  ]);

  const tax = (settings.tax ?? {}) as { rate?: number };
  const taxRate = typeof tax.rate === 'number' ? tax.rate : 5;

  // One query for every grant in the building, rather than one per person opened. Twenty-seven
  // people and forty permissions is a few hundred rows - trivial - and it means the access panel
  // opens showing what is TRUE, never a preset standing in for it.
  const { data: grantRows } = await db()
    .from('staff_permission')
    .select('staff_id,perm_key')
    .eq('granted', true)
    .in(
      'staff_id',
      people.map((p) => p.id)
    );
  const staffGrants: Record<string, string[]> = {};
  for (const row of grantRows ?? []) {
    const id = row.staff_id as string;
    staffGrants[id] = [...(staffGrants[id] ?? []), row.perm_key as string];
  }

  const openViews = open.map((b) => shapeBill(b, taxRate));
  const closedViews = closed.map((b) => shapeBill(b, taxRate));

  const closedTotals = closed.map((b) => billTotals(b));
  const sales = closedTotals.reduce((a, t) => a + t.restaurantIncome, 0);
  const discounts = closedTotals.reduce((a, t) => a + t.discount, 0);

  // Today's tips are the ledger's own rows, not a column on a bill — so the figure on the
  // dashboard and the figure on the Tips tab are the same rows counted once.
  // The restaurant's day (RC-016), bounded at both ends like every other "today".
  const { start: dayStart, end: dayEnd } = todayWindow();
  const tipsToday = tips.filter((t) => {
    const at = new Date(t.createdAt);
    return at >= dayStart && at < dayEnd;
  });
  const tipsTotal = tipsToday.reduce((a, t) => a + t.amount, 0);

  const mix = new Map<string, { amount: number; count: number }>();
  for (const b of closed) {
    const mode = b.paymentMode ?? 'Unrecorded';
    const seen = mix.get(mode) ?? { amount: 0, count: 0 };
    seen.amount += billTotals(b).payable;
    seen.count += 1;
    mix.set(mode, seen);
  }

  const allKots = [...open, ...closed].flatMap((b) => b.kots);
  const printFailures = allKots.filter((k) => k.printStatus === 'failed').length;
  /**
   * A zero failure count stopped meaning "everything printed" the moment a job could settle at
   * `queued`. With no transport that is now the NORMAL resting state, so a tile reading only
   * failures would say "Every ticket printed" over a kitchen that has had no paper all night —
   * the same false claim `status: 'printed'` used to make, arriving through the note instead.
   */
  const printWaiting = allKots.filter((k) => k.printStatus === 'queued').length;

  return {
    me: { id: staff.staffId, name: staff.name, role: staff.role, initials: staff.initials },
    grants: staff.grants.list(),
    restaurant: restaurant as Record<string, unknown>,
    settings,

    today: {
      sales,
      salesLabel: rupees(sales),
      orders: closed.length + open.length,
      coversLabel: `${[...open, ...closed].reduce((a, b) => a + b.guests, 0)} covers`,
      tips: tipsTotal,
      tipsLabel: rupees(tipsTotal),
      discountsLabel: rupees(discounts),
      openBills: open.length,
      awaitingClosure: open.filter((b) => b.status === 'payment_requested').length,
      openRequests: requests.length,
      printFailures,
      printWaiting,
      paymentMix: [...mix.entries()].map(([mode, v]) => ({
        mode,
        amountLabel: rupees(v.amount),
        count: v.count,
      })),
    },

    floor: floor.map((t) => ({
      id: t.id,
      name: t.name,
      zone: t.zone,
      seats: t.seats,
      active: t.active,
      stateLabel: TABLE_STATE[t.state].label,
      tone: TABLE_STATE[t.state].tone,
      billId: t.billId,
      line: t.billId
        ? `${t.groupCode ? `${t.groupCode} · ` : ''}${t.guests} guests · ${t.roundCount === 1 ? '1 round' : `${t.roundCount} rounds`}`
        : t.active
          ? `Seats ${t.seats} · ready for the next party`
          : 'Off the floor',
      totalLabel: t.total > 0 ? rupees(t.total) : '—',
      freeable: tableIsFreeable(t),
      clearing: t.clearing,
    })),

    openBills: openViews,
    closedToday: closedViews,

    requests: requests.map((r) => ({
      id: r.id,
      kind: r.kind,
      note: r.note,
      tableName: r.tableName,
      captain: r.captain,
      ageMinutes: r.ageMinutes,
      urgent: r.ageMinutes >= 5,
    })),

    suggestions,

    menu: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      categoryId: i.categoryId,
      price: i.price,
      priceLabel: rupees(i.price),
      foodType: i.foodType,
      available: i.available,
      closedReason: i.closedReason,
      description: i.description,
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, count: c.count, parentId: c.parentId })),

    staff: people,
    staffGrants,
    tips,
    tipsTotalLabel: rupees(tipsTotal),
    expenses,
    expensesTotalLabel: rupees(expenses.reduce((a, e) => a + e.amount, 0)),
    printers,
    bridges,
    printComputers,
    printerMappings,
    pairing,
    printBridgeDownload: { available: currentBridgeDownload().kind !== 'none' },
    printJobs,
    audit,
    // Position is 1-based and computed HERE, from the order the query already guarantees
    // (oldest first). A screen that numbered its own rows would renumber them every time one
    // was seated, and two screens doing it would eventually disagree about who is next.
    waitlist: waitlist.map((w, i) => ({ ...w, joinedAt: timeLabel(w.joinedAtIso), position: i + 1 })),
    qrOrigin,
  };
}

export { minutesSince };
