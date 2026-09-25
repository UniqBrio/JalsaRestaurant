import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
/* MERGE 22-Sep-2026: the union of both sides. `FoodType` is the printing work's; `canAdvanceKot`
   and `KOT_STATUS` are the KOT status workflow's. Nothing here conflicts in meaning — the two
   branches simply imported different symbols from the same module. */
import {
  billSeparability,
  canAdvanceKot,
  canHoldBillRole,
  kitchenHasStarted,
  KOT_STATUS,
  type FoodType,
  type KotStatus,
} from '@/lib/status';
import { discountBothWays, rupees } from '@/lib/money';
import { PermissionDenied } from '@/lib/permissions';
import { captainMayAssignWaiter } from '@/lib/status';
import { QUEUE_CLOSED } from '@/lib/queue-closed';
import { PAYMENT_NOTICE, PAYMENT_NOTICE_KINDS, noticesToRaise, paymentNoticeNote } from '@/lib/payment-notice';
import {
  resolvePrinter,
  routeItem,
  splitRound,
  type ItemRoute,
  type RoundTicket,
  type RoutablePrinter,
  type RoutingDecision,
} from '@/lib/print-routing';
import { billTotals, chargeableLines, getBill, openBillForTable, readSettings } from './queries';
import { BILL_STAFF_COLUMN, type Bill } from './types';

/**
 * mutations - every WRITE the application makes, and the rules that guard them.
 *
 * THREE RULES HOLD EVERYWHERE BELOW, AND THEY ARE THE POINT OF THE MODULE
 *
 *   1. PERSIST FIRST, THEN ATTEMPT THE SIDE EFFECT (Standard 5.7). A round is saved before
 *      anything is asked of a printer. If the printer is unreachable the order still exists,
 *      the failure is a visible state on the record, and there is a retry. Coupling the two
 *      loses real work at exactly the moment a kitchen is busiest.
 *
 *   2. EVERY CONSEQUENTIAL WRITE LEAVES AN AUDIT ENTRY, in the same call, naming the actor
 *      (Standard 6.1). Not "most" - a write that logs conditionally is a write whose log is
 *      missing for the case someone eventually disputes.
 *
 *   3. THE SERVER RE-CHECKS WHAT THE UI ALREADY CHECKED. The captain's cancel sheet decides
 *      between "Cancel the item" and "Ask Javeed" by reading `kitchenHasStarted`; so does
 *      `cancelItem` below. A hidden button is a courtesy, never a boundary.
 */

export interface Actor {
  staffId: string | null;
  label: string;
  grants?: { can(key: string): boolean };
}

export const GUEST_ACTOR: Actor = { staffId: null, label: 'Guest · QR' };

function demand(actor: Actor, permission: string): void {
  // A guest has no grants object at all, and every permission-gated action below is a staff
  // action - so "no grants" means "not permitted", never "permit everything".
  if (!actor.grants || !actor.grants.can(permission)) throw new PermissionDenied(permission);
}

export async function audit(entry: {
  action: string;
  detail: string;
  actor: Actor;
  billId?: string | null;
  tableId?: string | null;
  confidential?: boolean;
}): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const { error } = await db()
    .from('audit_entry')
    .insert({
      restaurant_id: restaurantId,
      action: entry.action,
      detail: entry.detail,
      bill_id: entry.billId ?? null,
      table_id: entry.tableId ?? null,
      actor_staff_id: entry.actor.staffId,
      actor_label: entry.actor.label,
      confidential: entry.confidential ?? false,
    });
  // An audit write that fails must be loud. Swallowing it produces a system that looks
  // accountable and is not - the worst of the three possible outcomes.
  if (error) throw error;
}

async function nextNumber(kind: 'bill' | 'kot' | 'group' | 'waitlist'): Promise<string> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db().rpc('next_number', { p_restaurant: restaurantId, p_kind: kind });
  if (error) throw error;
  return data as string;
}

/* ── Opening and resolving a bill ──────────────────────────────────────── */

/**
 * The bill on this table, opening one if there is none.
 *
 * THE CONCURRENCY CASE THIS EXISTS FOR: two phones at one table both tap Start ordering in the
 * same second. Both find no bill, both insert. The `bill_table_one_open_per_table` unique index
 * rejects the second, and rather than surfacing a constraint violation to a guest we re-read -
 * because by then the first insert has produced exactly the bill the second caller wanted
 * (Standard 8.3).
 */
export async function ensureOpenBill(
  tableId: string,
  opts: {
    guests?: number;
    /** Who is opening it. Absent means a guest's phone. Recorded on the "Bill opened" entry. */
    actor?: Actor;
    /** A captain opening a table nobody is standing captain of becomes its captain (C1/G2). */
    openerCaptainId?: string;
    /**
     * Refuse rather than join an existing bill (seating from the queue). The default - return
     * the bill already on the table - is right for a round and wrong for a SEAT: two hosts
     * seating two parties at one table would otherwise both succeed onto one bill.
     */
    mustBeNew?: boolean;
  } = {}
): Promise<Bill> {
  const existing = await openBillForTable(tableId);
  if (existing) {
    if (opts.mustBeNew) throw new Error(`${existing.tables.join(', ')} already has a party on it. Choose another table.`);
    return existing;
  }

  const restaurantId = await currentRestaurantId();

  /**
   * THREE READS THAT DO NOT NEED EACH OTHER, ISSUED AT ONCE.
   *
   * The tax rate, the table's standing staff, and the next bill number are independent: none of
   * them reads a row another one writes, and the insert below is the first thing that needs any
   * of their results. Run serially they were three round trips to a database in another region —
   * measured at ~590ms each on the CI runner, which is most of a second and a half on the path
   * between a guest tapping Send and their confirmation appearing.
   *
   * `nextNumber` is in here rather than left behind because it already ran before the insert;
   * moving it earlier in wall-clock time changes nothing about when its number is allocated
   * relative to a failure, so it burns a bill number in exactly the cases it burnt one before.
   *
   * The table's standing captain and waiter open the bill. Reassignment is a later, audited
   * action - but a bill with nobody's name on it can never be attributed retrospectively.
   */
  const [tax, { data: assigned }, code, { data: tableRow }] = await Promise.all([
    currentTaxRate(),
    db().from('staff_table').select('staff:staff_id(id,role,on_duty)').eq('table_id', tableId),
    nextNumber('bill'),
    // The name this bill is being opened on. Read HERE, in a wave that was already being waited
    // for, so that the audit entry below no longer has to wait for `getBill` to learn it.
    db().from('dining_table').select('name, active').eq('id', tableId).maybeSingle(),
  ]);
  type Assigned = { staff: { id: string; role: string; on_duty: boolean } | null };
  const people = ((assigned ?? []) as unknown as Assigned[])
    .map((a) => a.staff)
    .filter((s): s is { id: string; role: string; on_duty: boolean } => !!s && s.on_duty);
  const captain = people.find((p) => p.role === 'Captain') ?? null;
  const waiter = people.find((p) => p.role === 'Waiter') ?? null;

  /* Staff can only open a bill on a table that is in service (C1). The floor offers only active
     tables; this is the same rule where it cannot be routed around. A guest's scan keeps its
     existing behaviour - the table page already refuses an unknown table. */
  if (opts.actor && tableRow && tableRow.active === false) {
    throw new Error(`${(tableRow.name as string) ?? 'That table'} is not in service, so no bill can be opened on it.`);
  }

  const { data: billRow, error: billErr } = await db()
    .from('bill')
    .insert({
      restaurant_id: restaurantId,
      code,
      host_table_id: tableId,
      guests: opts.guests ?? 2,
      tax_rate: tax,
      // The table's standing captain; failing that, the captain who opened it - a walk-in seated by
      // Imran on a table with no standing captain is Imran's, not "Unassigned" (G2).
      captain_staff_id: captain?.id ?? opts.openerCaptainId ?? null,
      waiter_staff_id: waiter?.id ?? null,
    })
    .select('id')
    .single();
  if (billErr) throw billErr;

  const { error: linkErr } = await db()
    .from('bill_table')
    .insert({ bill_id: billRow.id as string, table_id: tableId });

  if (linkErr) {
    // 23505: someone else won the race. Their bill is the right answer; ours is orphaned and
    // removed so it cannot show up as an empty bill on a report.
    await db()
      .from('bill')
      .delete()
      .eq('id', billRow.id as string);
    const won = await openBillForTable(tableId);
    if (won && opts.mustBeNew) {
      throw new Error(`${won.tables.join(', ')} was just taken by another party. Choose another table.`);
    }
    if (won) return won;
    throw linkErr;
  }

  /**
   * THE READ-BACK AND THE AUDIT ENTRY DO NOT NEED EACH OTHER.
   *
   * The entry only ever needed the bill for its table NAMES, and a bill one line old has exactly
   * one membership — the `bill_table` row inserted above. That name is read in the parallel wave
   * at the top of this function, so the entry can be written while the full bill is being read
   * back rather than after it. `bill.tables.join(', ')` and this are the same string here, and
   * `dining_table.name` is the very column `shapeBill` maps into `tables`.
   *
   * BOTH ARE STILL AWAITED BEFORE THIS FUNCTION RETURNS, so nothing downstream — and no response
   * built on it — can observe an open bill whose audit entry has not landed. Rule 2 of this
   * module is about the entry existing in the same call, not about the order of two writes
   * neither of which reads the other.
   */
  const tableName = (tableRow?.name as string | undefined) ?? '';
  const [bill] = await Promise.all([
    getBill(billRow.id as string),
    audit({
      action: 'Bill opened',
      detail: `${code} opened on ${tableName}`,
      // Whoever actually opened it (G2). This said "Guest · QR" for every bill, including the
      // ones a captain or the owner opened from their own screens.
      actor: opts.actor ?? GUEST_ACTOR,
      billId: billRow.id as string,
      tableId,
    }),
  ]);
  if (!bill) throw new Error('Bill vanished immediately after being created.');
  return bill;
}

async function currentTaxRate(): Promise<number> {
  const restaurantId = await currentRestaurantId();
  const { data } = await db()
    .from('setting')
    .select('value')
    .eq('restaurant_id', restaurantId)
    .eq('key', 'tax')
    .maybeSingle();
  const rate = (data?.value as { rate?: number } | undefined)?.rate;
  return typeof rate === 'number' ? rate : 5;
}

/* ── Rounds ────────────────────────────────────────────────────────────── */

export interface RoundLine {
  menuItemId: string;
  qty: number;
}

/**
 * Send a round to the kitchen.
 *
 * The prices and food-type marks are SNAPSHOT onto the ticket, not joined at read time. A bill
 * printed tonight must still read the same next month, at the price it charged, even after the
 * item has been renamed, repriced or deleted.
 *
 * The availability check happens HERE, at the moment of sending - not when the menu was drawn.
 * A dish can sell out while it sits in a cart, and the guest finds out at the one moment they
 * can do something about it (Product Plan §7).
 */
export async function placeRound(input: {
  billId: string;
  tableId: string;
  lines: readonly RoundLine[];
  source: 'guest' | 'captain' | 'owner';
  actor: Actor;
  note?: string;
}): Promise<{ kotCode: string; kotId: string; refused: string[] }> {
  if (input.source !== 'guest') demand(input.actor, 'orders.add_items');
  if (input.lines.length === 0) throw new Error('A round with no items is not a round.');

  const restaurantId = await currentRestaurantId();
  const ids = input.lines.map((l) => l.menuItemId);
  const { data: items, error: itemErr } = await db()
    .from('menu_item')
    // The category comes back in the SAME query the availability check already runs. Routing a
    // round to its station therefore costs nothing on the order path — which is the only reason
    // it is done here rather than by a worker reading the job back.
    .select('id,name,price,food_type,available,closed_until,printer_id,station,menu_category!inner(name)')
    .eq('restaurant_id', restaurantId)
    .in('id', ids);
  if (itemErr) throw itemErr;

  const now = Date.now();
  const byId = new Map((items ?? []).map((i) => [i.id as string, i]));
  const refused: string[] = [];
  const accepted: Array<{ line: RoundLine; item: NonNullable<ReturnType<typeof byId.get>> }> = [];

  for (const line of input.lines) {
    const item = byId.get(line.menuItemId);
    if (!item) {
      refused.push('An item that is no longer on the menu');
      continue;
    }
    const closedUntil = item.closed_until as string | null;
    const stillClosed = closedUntil ? new Date(closedUntil).getTime() > now : false;
    if (!item.available || stillClosed) {
      refused.push(item.name as string);
      continue;
    }
    accepted.push({ line, item });
  }

  if (accepted.length === 0) {
    return { kotCode: '', kotId: '', refused };
  }

  /* THE ROUTING DECISION FOR EACH LINE, taken now and snapshot on the line (items 25, 26, 30).
     A dish's own printer and station, and the default station for a dish nothing routes, are
     read at this moment only - the job below, the composed ticket and any reprint read the
     snapshot, so they route the line identically however the settings change afterwards. */
  const [kotPrinters, routing] = await Promise.all([
    routablePrinters(restaurantId, 'KOT'),
    readSettings('routing', { defaultStation: '' } as { defaultStation: string }),
  ]);
  const snapshotOf = (item: (typeof accepted)[number]['item']): ItemRoute => {
    const category = (item.menu_category as unknown as { name: string } | null)?.name ?? '';
    const chosenPrinter = (item.printer_id as string | null) ?? null;
    const chosenStation = ((item.station as string | null) ?? '').trim() || null;
    if (chosenPrinter || chosenStation) return { printerId: chosenPrinter, station: chosenStation };
    const d = routeItem({ category, route: null, printers: kotPrinters, defaultStation: routing.defaultStation });
    // Only the default station is snapshot for a dish that chose nothing: a category route is
    // already reproduced from the category name, exactly as before.
    return d.rule === 'unrouted' && routing.defaultStation.trim() && d.printer
      ? { printerId: d.printer.id, station: routing.defaultStation.trim() }
      : { printerId: null, station: null };
  };
  const routes = accepted.map(({ item }) => snapshotOf(item));

  const code = await nextNumber('kot');
  const { data: kot, error: kotErr } = await db()
    .from('kot')
    .insert({
      restaurant_id: restaurantId,
      bill_id: input.billId,
      table_id: input.tableId,
      code,
      source: input.source,
      placed_by_staff_id: input.actor.staffId,
      placed_by_label: input.actor.label,
      note: input.note ?? '',
      status: 'new',
      print_status: 'queued',
    })
    .select('id')
    .single();
  if (kotErr) throw kotErr;

  const { error: lineErr } = await db()
    .from('kot_item')
    .insert(
      accepted.map(({ line, item }, i) => ({
        kot_id: kot.id as string,
        route_printer_id: routes[i]?.printerId ?? null,
        route_station: routes[i]?.station ?? null,
        menu_item_id: item.id as string,
        name: item.name as string,
        unit_price: item.price as number,
        food_type: item.food_type as string,
        // Snapshot, for the same reason the name and the price are snapshots: this is what a
        // REPRINT routes on, hours later, after the category may have been renamed or the dish
        // taken off the menu. Joined instead, a reprint would resolve differently from the
        // original and land at the wrong station.
        menu_category_name: (item.menu_category as unknown as { name: string } | null)?.name ?? '',
        qty: line.qty,
      }))
    );
  if (lineErr) throw lineErr;

  /**
   * Rule 1: the round is saved. Only now is a printer asked for anything, and a refusal
   * changes a badge on the record rather than losing the order.
   *
   * The print job and the audit entry are two inserts into two different tables, neither of
   * which reads the other, and nothing below reads either. They were serial only because they
   * were written on consecutive lines. Both are still awaited, so the round is not reported
   * placed until both have landed.
   */
  await Promise.all([
    queuePrint({
      kind: 'KOT',
      kotId: kot.id as string,
      billId: input.billId,
      actor: input.actor,
      items: accepted.map(({ item }, i) => ({
        category: (item.menu_category as unknown as { name: string } | null)?.name ?? '',
        foodType: item.food_type as FoodType,
        route: routes[i] ?? null,
      })),
    }),
    audit({
      action: 'Order placed',
      detail: `${code} created — ${accepted.length === 1 ? '1 item' : `${accepted.length} items`}${
        refused.length ? ` (${refused.length} unavailable and not sent)` : ''
      }`,
      actor: input.actor,
      billId: input.billId,
      tableId: input.tableId,
    }),
  ]);

  return { kotCode: code, kotId: kot.id as string, refused };
}

export async function changeQty(input: { kotItemId: string; qty: number; actor: Actor }): Promise<void> {
  demand(input.actor, 'orders.qty_change');
  if (input.qty < 1) throw new Error('Use cancelItem to take a line off a ticket.');

  const { data: row, error } = await db()
    .from('kot_item')
    .select('id,name,qty,kot:kot_id(id,code,status,bill_id,table_id)')
    .eq('id', input.kotItemId)
    .single();
  if (error) throw error;
  const kot = row.kot as unknown as {
    id: string;
    code: string;
    status: KotStatus;
    bill_id: string;
    table_id: string;
  };

  const { error: upErr } = await db()
    .from('kot_item')
    .update({
      qty: input.qty,
      qty_before: row.qty as number,
      changed_at: new Date().toISOString(),
      changed_by_staff_id: input.actor.staffId,
    })
    .eq('id', input.kotItemId);
  if (upErr) throw upErr;

  // A ticket the kitchen already holds is now wrong on paper. Reprinting it - marked as a
  // reprint - is the only thing that makes the paper and the screen agree again.
  if (kitchenHasStarted(kot.status)) {
    await queuePrint({
      kind: 'KOT',
      kotId: kot.id,
      billId: kot.bill_id,
      actor: input.actor,
      isReprint: true,
      items: await kotPrintableItems(kot.id),
    });
  }

  await audit({
    action: 'Quantity',
    detail: `${row.name as string} ${row.qty} → ${input.qty} on ${kot.code}`,
    actor: input.actor,
    billId: kot.bill_id,
    tableId: kot.table_id,
  });
}

/**
 * Cancel one line.
 *
 * THE GATE IS THE KITCHEN, NOT THE PERSON. Before the kitchen starts, a captain cancels on
 * their own authority. After it starts, the same tap becomes a request to the owner - because
 * the food exists by then, and someone has to decide who wears the cost. The design says this
 * in words on screen; this function is what makes it true.
 */
export async function cancelItem(input: {
  kotItemId: string;
  reason: string;
  actor: Actor;
}): Promise<{ outcome: 'cancelled' | 'escalated' }> {
  const { data: row, error } = await db()
    .from('kot_item')
    .select('id,name,qty,kot:kot_id(id,code,status,bill_id,table_id)')
    .eq('id', input.kotItemId)
    .single();
  if (error) throw error;
  const kot = row.kot as unknown as {
    id: string;
    code: string;
    status: KotStatus;
    bill_id: string;
    table_id: string;
  };

  const started = kitchenHasStarted(kot.status);
  const permission = started ? 'orders.cancel_after' : 'orders.cancel_before';

  if (!input.actor.grants?.can(permission)) {
    // Not a failure - a designed outcome. The request is recorded so the owner sees it, and
    // the person who asked is named on it.
    await audit({
      action: 'Cancellation requested',
      detail: `${row.name as string} ×${row.qty} on ${kot.code} — ${input.reason.toLowerCase()} (awaiting owner)`,
      actor: input.actor,
      billId: kot.bill_id,
      tableId: kot.table_id,
    });
    return { outcome: 'escalated' };
  }

  const { error: upErr } = await db()
    .from('kot_item')
    .update({
      cancelled_at: new Date().toISOString(),
      cancel_reason: input.reason,
      cancelled_by_staff_id: input.actor.staffId,
    })
    .eq('id', input.kotItemId);
  if (upErr) throw upErr;

  await audit({
    action: 'Cancelled',
    detail: `${row.name as string} ×${row.qty} on ${kot.code} — ${input.reason.toLowerCase()}`,
    actor: input.actor,
    billId: kot.bill_id,
    tableId: kot.table_id,
  });
  return { outcome: 'cancelled' };
}

const STAMP_FOR: Partial<Record<KotStatus, string>> = {
  preparing: 'started_at',
  ready: 'ready_at',
  picked_up: 'picked_up_at',
  served: 'served_at',
};

export async function advanceKot(input: { kotId: string; to: KotStatus; actor: Actor }): Promise<void> {
  demand(input.actor, 'orders.status');
  const { data: kot, error } = await db()
    .from('kot')
    .select('id,code,status,bill_id,table_id,started_at,ready_at,picked_up_at,served_at')
    .eq('id', input.kotId)
    .single();
  if (error) throw error;

  const from = kot.status as KotStatus;

  /*
    THE SERVER DECIDES WHAT IS LEGAL, not the button that was tapped.

    This used to write whatever `to` it was handed. A served round could be sent back to
    preparing, and nothing but the UI's own conditionals stood in the way — which is no
    protection at all against a stale tab, a replayed request or a second captain.
  */
  if (!canAdvanceKot(from, input.to)) {
    throw new Error(
      `${kot.code as string} is ${KOT_STATUS[from].staff.toLowerCase()} — it cannot move to ${KOT_STATUS[input.to].staff.toLowerCase()}.`
    );
  }

  const patch: Record<string, unknown> = { status: input.to };
  const stamp = STAMP_FOR[input.to];
  // Stamped only on the FIRST transition into a state. A re-tap must not rewrite the minute
  // the kitchen actually finished, because that minute is what the timings report reads.
  //
  // That sentence has been here since the column was added and the code did not honour it: the
  // stamp was written unconditionally. Transitions are one-way now, so a re-entry cannot happen
  // through this function — and the guard stays anyway, because the comment is a promise about
  // the DATA and the timings report is the thing that would quietly drift.
  if (stamp && !kot[stamp as keyof typeof kot]) patch[stamp] = new Date().toISOString();

  /*
    AND THE WRITE ITSELF CARRIES THE STATE IT READ (§14.8).

    Checking the status and then writing is two statements with a gap between them. Two captains
    tapping the same round at the same moment both read `ready`, both judge their move legal, and
    both write — last one wins, whatever it was. Pinning `status` in the WHERE clause closes the
    gap: the second update matches no row, and the round keeps the first outcome rather than
    taking an arbitrary one.
  */
  const { data: updated, error: upErr } = await db()
    .from('kot')
    .update(patch)
    .eq('id', input.kotId)
    .eq('status', from)
    .select('id');
  if (upErr) throw upErr;
  if (!updated?.length) {
    throw new Error(`${kot.code as string} was just updated by somebody else. Open it again to see where it is.`);
  }

  await audit({
    action: 'Status',
    detail: `${kot.code as string} → ${input.to.replace('_', ' ')}`,
    actor: input.actor,
    billId: kot.bill_id as string,
    tableId: kot.table_id as string,
  });
}

export async function reprintKot(input: { kotId: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'orders.reprint');
  const { data: kot, error } = await db()
    .from('kot')
    .select('id,code,bill_id,table_id,reprint_count')
    .eq('id', input.kotId)
    .single();
  if (error) throw error;

  await db()
    .from('kot')
    .update({ reprint_count: ((kot.reprint_count as number) ?? 0) + 1 })
    .eq('id', input.kotId);

  // WITHOUT THESE ITEMS A REPRINT ALWAYS FELL BACK. `queuePrint` with no items resolves the
  // empty category, which no machine claims, so every reprint took the "nobody claims this"
  // branch to the main kitchen — the tandoor's ticket reprinted in the wrong room, by
  // construction, every single time. A reprint routes on exactly what the original routed on.
  await queuePrint({
    kind: 'KOT',
    kotId: input.kotId,
    billId: kot.bill_id as string,
    actor: input.actor,
    isReprint: true,
    items: await kotPrintableItems(input.kotId),
  });

  await audit({
    action: 'Reprint',
    detail: `${kot.code as string} reprinted — marked as a reprint`,
    actor: input.actor,
    billId: kot.bill_id as string,
    tableId: kot.table_id as string,
  });
}

/* ── Printing ──────────────────────────────────────────────────────────── */

/**
 * What one item contributes to a routing decision.
 *
 * Both facts are SNAPSHOTS on `kot_item`, not joins through `menu_item`. That is what lets a
 * reprint three hours later route exactly where the original went, after the category has been
 * renamed or the dish taken off the menu.
 */
export interface PrintableItem {
  category: string;
  foodType: FoodType;
  /** The line's routing snapshot (`kot_item.route_*`, item 25/26). Null routes by category. */
  route?: ItemRoute | null;
}

/**
 * Every machine of one purpose, ORDERED.
 *
 * The order is the point. `resolvePrinter` breaks a tie on `machine_id`, and it can only do that
 * if it is handed the machines in that order — a query with no ORDER BY returns whatever
 * PostgREST feels like, which is how the owner's Routing screen (which orders by `machine_id`)
 * and the order path came to disagree about which machine claims a category.
 */
async function routablePrinters(restaurantId: string, purpose: string): Promise<RoutablePrinter[]> {
  const { data: rows } = await db()
    .from('printer')
    .select('id,machine_id,name,purpose,station,routes,online,enabled')
    .eq('restaurant_id', restaurantId)
    .eq('purpose', purpose)
    .order('machine_id', { ascending: true });

  return (rows ?? []).map((p) => ({
    id: p.id as string,
    machineId: p.machine_id as string,
    name: p.name as string,
    purpose: p.purpose as string,
    station: (p.station as string) ?? 'Main Kitchen',
    routes: (p.routes as string[]) ?? [],
    online: p.online as boolean,
    enabled: (p.enabled as boolean | null) ?? true,
  }));
}

/**
 * What a round still has on it, as routing sees it.
 *
 * Cancelled lines are left out: a ticket reprinted after a cancellation must not send the
 * kitchen back to a station for a dish nobody is cooking any more.
 */
export async function kotPrintableItems(kotId: string): Promise<PrintableItem[]> {
  const { data: lines } = await db()
    .from('kot_item')
    .select('menu_category_name,food_type,cancelled_at,route_printer_id,route_station')
    .eq('kot_id', kotId);

  return (lines ?? [])
    .filter((l) => l.cancelled_at === null)
    .map((l) => ({
      category: (l.menu_category_name as string) ?? '',
      foodType: l.food_type as FoodType,
      route: { printerId: (l.route_printer_id as string | null) ?? null, station: (l.route_station as string | null) ?? null },
    }));
}

/**
 * `kot.print_status` recomputed from the jobs that actually exist.
 *
 * WHY THE KOT MIRRORS A SET AND NOT A JOB
 *   A round spanning the tandoor and the main kitchen is TWO print jobs, and the badge on the
 *   captain's screen is one badge. It answers "is this round's paper where it needs to be", so
 *   it is the pessimistic aggregate: failed if any live job failed, printed only once every one
 *   of them has printed, queued otherwise.
 *
 *   A job that has been superseded by a "Print elsewhere" is excluded — it is evidence of a
 *   decision, not an outstanding ticket, and leaving it in would pin a round red forever after
 *   the operator had already fixed it.
 */
async function syncKotPrintState(kotId: string): Promise<void> {
  const { data: jobs } = await db()
    .from('print_job')
    .select('id,status,attempts,completed_at,redirected_from_job_id')
    .eq('kot_id', kotId);

  const all = jobs ?? [];
  if (all.length === 0) return;

  const superseded = new Set(all.map((j) => j.redirected_from_job_id as string | null).filter(Boolean));
  const live = all.filter((j) => !superseded.has(j.id as string));
  if (live.length === 0) return;

  // Phase 2 added `processing`. A round with one ticket in flight is not "queued" — somebody is
  // carrying it — and it is certainly not "printed". The order of the tests is the pessimism:
  // any failure outranks everything, and `printed` requires ALL of them.
  const status = live.some((j) => j.status === 'failed')
    ? 'failed'
    : live.every((j) => j.status === 'printed')
      ? 'printed'
      : live.some((j) => j.status === 'processing')
        ? 'processing'
        : 'queued';

  await db()
    .from('kot')
    .update({
      print_status: status,
      print_attempts: live.reduce((most, j) => Math.max(most, (j.attempts as number) ?? 0), 0),
      printed_at:
        status === 'printed'
          ? ((live.map((j) => j.completed_at as string | null).filter(Boolean).sort().pop() as string) ?? null)
          : null,
    })
    .eq('id', kotId);
}

/**
 * A bill's one ticket.
 *
 * A bill has no menu categories, so `resolvePrinter` answers it through the "nobody claims this"
 * branch — which is the right MACHINE and the wrong WORD. Reported as `unrouted` it would put
 * "  is not routed to a station" (with the empty category in front of it) on the history row of
 * every bill the restaurant ever prints, describing a misconfiguration that does not exist. One
 * invoice machine taking every invoice IS the routed outcome, and it is recorded as one.
 */
function billTicket(d: RoutingDecision): RoundTicket {
  const found = d.printer !== null;
  return {
    printerId: d.printer?.id ?? null,
    printerName: d.printer?.name ?? '',
    station: found ? (d.printer?.station ?? d.station) : d.station,
    rule: found ? 'routed' : 'none',
    reason: found ? '' : d.reason,
    foodTypes: [],
    // A bill is never split. One side, carrying the whole thing — the same value every row
    // written before 22-Sep-2026 carries, so nothing about a bill's identity changes.
    side: 'all',
    count: 0,
  };
}

/**
 * Turn a round or a bill into the print jobs that will deliver it.
 *
 * ONE JOB PER MACHINE, AND THE MACHINE IS DECIDED HERE, ONCE, FOREVER.
 *   This function used to take the decision for the FIRST category in a round and write a single
 *   job against it, naming the other stations in a sentence nothing reads. A round of chicken
 *   tikka and butter chicken produced one ticket at one station, and the other station was told
 *   nothing — which is not a routing bug that shows up as a wrong ticket, it is a round that is
 *   half-cooked with nobody aware. `splitRound` produces one bucket per machine-and-heading and
 *   each bucket is a row, so the tandoor's half and the kitchen's half are two tickets with two
 *   assignments and two independent retries.
 *
 * WHY NOTHING HERE WRITES `printed`.
 *   It used to: `reachable = chosen.online && chosen.enabled` decided the status, so "printed"
 *   meant "a boolean column on another table was true". No socket was opened, no device
 *   acknowledged anything, and no paper necessarily moved. A print job that claims success it
 *   cannot possibly know is worse than one that claims nothing, because the kitchen stops
 *   looking. Until the Phase 2 bridge reports back, an assigned job is `queued` and says so.
 *   `failed` is reserved for the one failure this layer CAN see: nothing to assign it to.
 */
export async function queuePrint(input: {
  kind: 'KOT' | 'Invoice';
  kotId?: string;
  billId: string;
  actor: Actor;
  isReprint?: boolean;
  /**
   * The round's items. Every KOT caller passes them — that is what makes routing route. A bill
   * has no categories and takes the single-decision path below, which is the right answer for
   * it rather than a shortfall.
   */
  items?: readonly PrintableItem[];
}): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const purpose = input.kind === 'KOT' ? 'KOT' : 'Invoice';
  const printers = await routablePrinters(restaurantId, purpose);

  // The design puts the veg/non-veg split on the Routing screen as a switch, separate from the
  // routing itself. Reading it here is what connects that switch to paper.
  const splitByFoodType =
    purpose === 'KOT' && (await readSettings('print', { splitByFoodType: false })).splitByFoodType === true;

  const tickets: RoundTicket[] = input.items?.length
    ? splitRound({ items: input.items, printers, splitByFoodType })
    : [billTicket(resolvePrinter({ purpose, category: '', printers }))];

  const rows = tickets.map((t) => ({
    restaurant_id: restaurantId,
    printer_id: t.printerId,
    // Snapshots. The job must still say where it was sent after the machine is renamed, moved to
    // another station, or removed — see the migration that added them.
    printer_name: t.printerName,
    station: t.station,
    routing_rule: t.rule,
    // WHICH HALF OF THE ROUND THIS IS (22-Sep-2026). The third segment of `splitRound`'s bucket
    // key, which used to be discarded here — leaving two rows for one machine and station that
    // nothing could tell apart. Taken from the ticket, never re-derived: a second calculation of
    // the side is a second answer to it.
    food_side: t.side,
    kind: input.kind,
    kot_id: input.kotId ?? null,
    bill_id: input.billId,
    // Assigned, and waiting for something that can actually deliver it. Not a claim about paper.
    status: t.printerId ? 'queued' : 'failed',
    attempts: 0,
    is_reprint: input.isReprint ?? false,
    requested_by: input.actor.label,
    // Only when the decision was not the obvious one: nothing to assign to, or a fallback that
    // put the ticket somewhere other than the station it is stamped for. A `routed` job needs no
    // sentence — its three columns already say category, station and machine.
    last_error: t.rule === 'routed' ? '' : t.reason,
    completed_at: null,
  }));

  const { error: jobErr } = await db().from('print_job').insert(rows);
  if (jobErr) throw jobErr;

  if (input.kotId) await syncKotPrintState(input.kotId);
}

/**
 * Try a job again — on the machine it was assigned to, and on no other.
 *
 * WHY THIS IS A NEW ATTEMPT ON THE SAME ROW AND NOT A NEW ROW
 *   The print history is the record of what the system tried. Three attempts at KOT-0041 are one
 *   ticket that has not arrived, not three tickets — and the design's History table has a Tries
 *   column precisely so a person can tell those apart. A new row per retry would show a kitchen
 *   three outstanding tickets and send somebody looking for two that do not exist.
 *
 * WHY IT DOES NOT ROUTE
 *   It used to. It re-read the printers, took the first one of the right purpose that answered,
 *   and wrote that into `printer_id` — so a tandoor ticket that failed came back assigned to the
 *   main kitchen, and the station it was meant for, which lived only in `last_error`, was cleared
 *   on the way past. Routing is a decision taken once, when the round is placed, from the
 *   categories the round contains; a retry has none of that context and must not pretend to. It
 *   re-sends what was already decided. The database enforces this independently: `printer_id` is
 *   immutable by trigger, so this function could not reassign the job even if it tried to.
 *
 * A retry is NOT a reprint. It does not mark the ticket, because nothing came out of a machine
 * the first time. Reprinting a ticket that DID print is `reprintKot`, and that one marks it.
 * Sending a ticket to a DIFFERENT machine on purpose is `printElsewhere`, and that one is a new
 * job with its own assignment.
 */
export async function retryPrintJob(input: { jobId: string; actor: Actor }): Promise<{
  retried: boolean;
  printerName: string;
  station: string;
}> {
  demand(input.actor, 'orders.reprint');
  const restaurantId = await currentRestaurantId();

  const { data: job, error } = await db()
    .from('print_job')
    .select('id,kind,kot_id,attempts,status,printer_id,printer_name,station')
    .eq('id', input.jobId)
    .eq('restaurant_id', restaurantId)
    .single();
  if (error) throw error;

  if (job.status === 'printed') {
    // Not an error and not a silent success: the job is already done, and re-sending it would
    // put a second unmarked ticket in the kitchen — the one printing mistake that costs food.
    throw new Error('That ticket has already printed. Use Reprint, which marks the paper.');
  }

  if (!job.printer_id) {
    // The one case a retry cannot help, and the honest answer is to say so rather than to pick a
    // machine on the operator's behalf — picking one is exactly the defect this phase removed.
    throw new Error(
      'This ticket was never assigned to a machine, so there is nothing to retry. Use Print elsewhere and choose one.'
    );
  }

  const attempts = ((job.attempts as number) ?? 0) + 1;

  // `printer_id` is deliberately absent from this patch. So are `printer_name` and `station`.
  await db()
    .from('print_job')
    .update({
      status: 'queued',
      attempts,
      last_attempt_at: new Date().toISOString(),
      last_error: '',
      completed_at: null,
    })
    .eq('id', input.jobId);

  if (job.kot_id) await syncKotPrintState(job.kot_id as string);

  await audit({
    action: 'Reprint',
    detail: `Print job re-sent to ${job.printer_name as string} (${job.station as string}) — attempt ${attempts}`,
    actor: input.actor,
  });

  return { retried: true, printerName: job.printer_name as string, station: job.station as string };
}

/**
 * Send a ticket to a DIFFERENT machine, because a person decided to.
 *
 * WHY THIS IS A NEW JOB AND NOT AN EDIT
 *   The original job is the evidence of where the ticket was supposed to go, and nothing about
 *   an operator's decision to work around a dead machine makes that untrue. Editing it would
 *   destroy the only record that the tandoor was meant to get this round — the same loss the
 *   old retry caused, arrived at deliberately instead of accidentally. So the redirect is its
 *   own row, pointing back at the one it replaces, and the history shows both.
 *
 * WHY IT TAKES A PRINTER AND NEVER PICKS ONE
 *   This is the ONLY way a ticket reaches a machine other than the one routing chose, and it
 *   exists precisely so that no automatic path has to. A fallback that happens without anybody
 *   asking for it is indistinguishable, from the kitchen, from routing that works.
 */
export async function printElsewhere(input: {
  jobId: string;
  printerId: string;
  actor: Actor;
}): Promise<{ printerName: string; station: string }> {
  demand(input.actor, 'orders.reprint');
  const restaurantId = await currentRestaurantId();

  const { data: job, error } = await db()
    .from('print_job')
    .select('id,kind,kot_id,bill_id,status,printer_id,printer_name,station,food_side')
    .eq('id', input.jobId)
    .eq('restaurant_id', restaurantId)
    .single();
  if (error) throw error;

  const { data: printer, error: printerErr } = await db()
    .from('printer')
    .select('id,name,purpose,station,enabled')
    .eq('id', input.printerId)
    .eq('restaurant_id', restaurantId)
    .single();
  if (printerErr) throw printerErr;

  if (printer.purpose !== job.kind) {
    // A bill on a kitchen machine is the guest's total in the kitchen, and a KOT at the counter
    // is a round nobody is cooking. The purposes are not interchangeable.
    throw new Error(
      `${printer.name as string} prints ${printer.purpose as string} tickets, and this is a ${job.kind as string}.`
    );
  }
  if (((printer.enabled as boolean | null) ?? true) === false) {
    throw new Error(`${printer.name as string} is switched off. Switch it on first, or choose another machine.`);
  }
  if (printer.id === job.printer_id) {
    throw new Error(`This ticket is already assigned to ${printer.name as string}. Use Retry to send it again.`);
  }

  const { error: insertErr } = await db()
    .from('print_job')
    .insert({
      restaurant_id: restaurantId,
      printer_id: printer.id as string,
      printer_name: printer.name as string,
      station: printer.station as string,
      // Not a routing rule — a person's decision. The column records WHO decided, not only what.
      routing_rule: 'chosen',
      // THE HALF IS THE ORIGINAL'S, NEVER THE DESTINATION'S (22-Sep-2026).
      //   Redirecting a ticket changes WHERE it prints. It does not change WHAT is on it. Taking
      //   the side from the chosen machine would be inventing a new ticket, and matching the
      //   round by machine-and-station alone — which is what happened before this line existed —
      //   composed whichever half the destination happened to claim. A tandoor round redirected
      //   to the main kitchen printed the main kitchen's dishes a second time and the tandoor's
      //   round never arrived at all.
      food_side: (job.food_side as string | null) ?? 'all',
      kind: job.kind as string,
      kot_id: (job.kot_id as string | null) ?? null,
      bill_id: job.bill_id as string,
      status: 'queued',
      attempts: 0,
      // Paper that already came out of one machine must be marked before it comes out of another,
      // or a cook reads the same round twice.
      is_reprint: job.status === 'printed',
      requested_by: input.actor.label,
      last_error: '',
      completed_at: null,
      redirected_from_job_id: job.id as string,
    });
  if (insertErr) throw insertErr;

  if (job.kot_id) await syncKotPrintState(job.kot_id as string);

  await audit({
    action: 'Reprint',
    detail: `Ticket redirected from ${
      (job.printer_name as string) || 'no machine'
    } to ${printer.name as string} (${printer.station as string}) — chosen by ${input.actor.label}`,
    actor: input.actor,
  });

  return { printerName: printer.name as string, station: printer.station as string };
}

/* ── Closure ───────────────────────────────────────────────────────────── */

/** The guest's half of closure, and the ONLY half they have. */
export async function requestPayment(billId: string): Promise<void> {
  const bill = await getBill(billId);
  if (!bill) throw new Error('No such bill.');
  if (bill.status === 'closed') return; // already settled; asking again changes nothing
  // Already waiting: a second tap raises no second pair of notifications (item 37).
  if (bill.status === 'payment_requested') return;

  await db()
    .from('bill')
    .update({ status: 'payment_requested', payment_requested_at: new Date().toISOString() })
    .eq('id', billId)
    .neq('status', 'closed');

  await raisePaymentNotices(bill);

  await audit({
    action: 'Payment requested',
    detail: `${bill.code} entered the closure queue`,
    actor: GUEST_ACTOR,
    billId,
  });
}

/**
 * The guest changes their mind and orders more.
 *
 * WHY THIS IS NOT "CANCEL" IN THE DATABASE
 *   The bill returns to `open`, which is exactly the state it was in a minute ago, and
 *   `payment_requested_at` is DELIBERATELY LEFT SET. That pair — open, but asked for once — is
 *   how the phone knows to say "Payment request paused" rather than nothing, and how the next
 *   request knows it is not the first. Clearing the timestamp would erase the only evidence the
 *   request ever happened, and a request that appeared on a captain's screen and then vanished
 *   without a trace is the kind of thing that gets blamed on the software.
 *
 *   The architecture rule is untouched: a guest may withdraw their OWN request; only a named
 *   member of staff can record a closure, and the database still refuses anything else.
 */
export async function withdrawPaymentRequest(billId: string): Promise<void> {
  const bill = await getBill(billId);
  if (!bill) throw new Error('No such bill.');
  if (bill.status !== 'payment_requested') return; // nothing to withdraw; asking again changes nothing

  await db().from('bill').update({ status: 'open' }).eq('id', billId).eq('status', 'payment_requested');
  // The request is off, so both notifications it raised are resolved (item 37).
  await resolvePaymentNotices(billId, PAYMENT_NOTICE_KINDS);

  await audit({
    action: 'Payment request paused',
    detail: `${bill.code} left the closure queue — the table is ordering again`,
    actor: GUEST_ACTOR,
    billId,
  });
}

export async function addTip(input: { billId: string; amount: number; staffId: string | null }): Promise<void> {
  if (input.amount <= 0) return;
  const restaurantId = await currentRestaurantId();

  // One tip row per bill. A guest who changes their mind on the tip screen must not leave two.
  await db().from('tip').delete().eq('bill_id', input.billId).is('settled_at', null);
  const { error } = await db().from('tip').insert({
    restaurant_id: restaurantId,
    bill_id: input.billId,
    amount: input.amount,
    staff_id: input.staffId,
  });
  if (error) throw error;

  await audit({
    action: 'Tip',
    detail: `${rupees(input.amount)} added — staff money, excluded from income`,
    actor: GUEST_ACTOR,
    billId: input.billId,
  });
}

/**
 * Record the payment and close the bill.
 *
 * THE RULE THIS FUNCTION EXISTS TO ENFORCE: the guest never gets here. Closure names a member
 * of staff, and the database check constraint refuses a closed bill without one - so there is
 * no code path, and no future code path, that can close a bill anonymously.
 *
 * Closing frees every table on the bill at once, including all four of a group of four. That
 * happens in the same transaction, in a trigger, so there is no window where a table is both
 * closed and still occupied.
 */
export async function closeBill(input: {
  billId: string;
  mode: string;
  reference?: string;
  /** Which box the person typed in. The other figure is derived from it, never sent. */
  discountType?: 'percentage' | 'amount';
  discountValue?: number;
  actor: Actor;
}): Promise<{ payable: number }> {
  demand(input.actor, 'bill.record_payment');
  if (!input.actor.staffId) throw new PermissionDenied('bill.record_payment');

  const bill = await getBill(input.billId);
  if (!bill) throw new Error('No such bill.');
  if (bill.status === 'closed') {
    // Standard 8.3 again: two people closing the same bill. The second is told it is done,
    // not allowed to close it twice.
    return { payable: billTotals(bill).payable };
  }

  /* ONE discount, stored both ways plus the way it was entered.
     The two boxes on the closure screens are two views of the same figure, so exactly one of
     them arrives here and the other is derived from the SUBTOTAL — the base `totalBill` itself
     discounts against. Sending both would take it off twice, which is the one thing the
     requester underlined. */
  const wantsDiscount = (input.discountValue ?? 0) > 0 && input.discountType !== undefined;
  const both = wantsDiscount
    ? discountBothWays({
        base: billTotals(bill).subtotal,
        typed: input.discountType ?? 'percentage',
        value: input.discountValue ?? 0,
      })
    : { pct: bill.discountPct, amount: bill.discountAmount };

  if (wantsDiscount) {
    // The grant follows what the person TYPED, not what was derived from it. Someone who may
    // give a percentage has not thereby been given the flat-amount grant, and vice versa.
    demand(input.actor, input.discountType === 'percentage' ? 'bill.disc_pct' : 'bill.disc_flat');
  }

  const now = new Date().toISOString();
  const { error } = await db()
    .from('bill')
    .update({
      status: 'closed',
      closed_at: now,
      closed_by_staff_id: input.actor.staffId,
      payment_mode: input.mode,
      payment_reference: input.reference ?? '',
      /* Both representations are stored so no reader has to recompute either, and
         `discount_type` says which one a person actually chose. Only ONE of them was entered;
         `totalBill` is given the pair and takes the discount once, from the pct when that is
         what was typed and from the amount otherwise. */
      discount_pct: wantsDiscount && input.discountType === 'percentage' ? both.pct : 0,
      discount_amount: wantsDiscount && input.discountType === 'amount' ? both.amount : 0,
      discount_type: wantsDiscount ? input.discountType : null,
      discount_by_staff_id: wantsDiscount ? input.actor.staffId : null,
      discount_at: wantsDiscount ? now : null,
    })
    .eq('id', input.billId)
    .neq('status', 'closed');
  if (error) throw error;

  const closed = await getBill(input.billId);
  const totals = closed ? billTotals(closed) : billTotals(bill);

  if (wantsDiscount) {
    await audit({
      action: 'Discount',
      // Both figures in the line, and which one was typed, so the ledger never leaves anyone
      // recomputing a discount from a percentage that was not the thing entered.
      detail: `${both.pct}% = ${rupees(both.amount)} — entered as ${input.discountType === 'percentage' ? 'a percentage' : 'an amount'}, taken once (${rupees(totals.discount)} off)`,
      actor: input.actor,
      billId: input.billId,
    });
  }

  await audit({
    action: 'Payment',
    detail: `Closed as ${input.mode.toLowerCase()} — ${rupees(totals.payable)}${
      totals.tip > 0 ? ` (${rupees(totals.tip)} of it tip, paid to the team)` : ''
    }`,
    actor: input.actor,
    billId: input.billId,
  });

  await queuePrint({ kind: 'Invoice', billId: input.billId, actor: input.actor });
  // Paid: the counter's "Bill requested" is done. The captain's stays until the table is seen to.
  await resolvePaymentNotices(input.billId, [PAYMENT_NOTICE.counter.kind]);
  return { payable: totals.payable };
}

/* ── Groups ────────────────────────────────────────────────────────────── */

/**
 * Join another table to this bill.
 *
 * A single-table bill is a group of one, so joining is the SAME operation as opening - it adds
 * a row to bill_table and, on the second table, names the group. Nothing about the bill, the
 * rounds or the totals special-cases the single case, which is why nothing about them breaks.
 */
export async function joinTableToBill(input: { billId: string; tableId: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'tables.assign');
  const bill = await getBill(input.billId);
  if (!bill) throw new Error('No such bill.');

  const occupied = await openBillForTable(input.tableId);
  if (occupied && occupied.id !== input.billId) {
    throw new Error(
      `That table already has ${occupied.code} open. Close or move it first — merging two live bills is a separate, logged action.`
    );
  }

  const groupCode = bill.groupCode ?? (await nextNumber('group'));
  const { error } = await db().from('bill_table').insert({ bill_id: input.billId, table_id: input.tableId });
  if (error) throw error;
  if (!bill.groupCode) {
    await db().from('bill').update({ group_code: groupCode }).eq('id', input.billId);
  }

  await audit({
    action: 'Group',
    detail: `A table joined ${bill.code} — one bill across ${bill.tables.length + 1} tables (${groupCode})`,
    actor: input.actor,
    billId: input.billId,
    tableId: input.tableId,
  });
}

/**
 * Let go of a table nobody is sitting at.
 *
 * WHY THIS EXISTS AT ALL
 *   Occupancy here is derived, not stored: a table is taken while an open bill holds an
 *   unreleased `bill_table` row on it, and a partial unique index enforces one open bill per
 *   table. That rule is right, and it is also why a party that left with a bill open and nothing
 *   ordered leaves a table the next party's first round CANNOT be created on, with no screen
 *   anywhere able to release it. Reported 12-Sep-2026: "there is no way we can free the table."
 *
 * WHY IT REFUSES THE MOMENT FOOD EXISTS
 *   A tile on a floor grid must never be able to write off a bill. Once a round has gone to the
 *   kitchen the table is held by something real, and the honest routes are a payment or a void —
 *   both of which name a person and leave a figure. This one names a person too, but it is only
 *   ever allowed to discard NOTHING.
 *
 *   Closing the bill instead was the alternative, and it is worse: a closure carries a payment
 *   mode and an amount, and there was no payment. It would be a lie in the ledger to save a tap.
 */
export async function freeTable(input: { tableId: string; actor: Actor }): Promise<{ freed: boolean }> {
  demand(input.actor, 'tables.free');

  const bill = await openBillForTable(input.tableId);
  if (bill && bill.kots.length > 0) {
    throw new Error(
      `${bill.code} has ${bill.kots.length === 1 ? 'a round' : `${bill.kots.length} rounds`} with the kitchen. Record the payment or void the bill — a table cannot be freed out from under food.`
    );
  }

  if (bill) {
    // An empty bill is a bill that never happened. Voided rather than deleted: the code was
    // issued, it may be on a docket, and a number that vanishes is a number someone hunts for.
    await db().from('bill_table').update({ released_at: new Date().toISOString() }).eq('bill_id', bill.id);
    await db().from('bill').update({ status: 'void', closed_at: new Date().toISOString() }).eq('id', bill.id);
  }

  // The departed party's phone, and the cart they never sent. Dropping the session is what makes
  // the next scan of this table a fresh welcome rather than someone else's order.
  await db().from('guest_session').delete().eq('table_id', input.tableId);

  // Marked free by a person, so it IS free - not "needs clearing" (items 35/36, 25-Sep-2026). The
  // release above used to leave the table waiting to be cleared, still showing Mark free.
  const { error: clearErr } = await db()
    .from('bill_table')
    .update({ cleared_at: new Date().toISOString(), cleared_by: input.actor.label })
    .eq('table_id', input.tableId)
    .not('released_at', 'is', null)
    .is('cleared_at', null);
  if (clearErr) throw clearErr;

  await audit({
    action: 'Table freed by hand',
    detail: bill
      ? `${bill.code} had nothing with the kitchen — voided and the table released`
      : 'No open bill; the table was cleared of any phone still attached to it',
    actor: input.actor,
    ...(bill ? { billId: bill.id } : {}),
    tableId: input.tableId,
  });

  return { freed: true };
}

/**
 * Correct the captain or the waiter named on a bill — running or already closed.
 *
 * WHY THE CLOSED CASE IS THE WHOLE OF THE DIFFICULTY
 *   The captain on a bill is not a label. `addTip` attributes the tip to `bill.captain_staff_id`, and
 *   the tips ledger and the settle-up screen read from that attribution. So changing the captain
 *   on a closed bill moves money that has already been counted.
 *
 *   Three options were on the table, and the request named none of them:
 *     1. Change the name, leave the tip where it posted — the bill then names one person and
 *        pays another, which is worse than the wrong name.
 *     2. Change the name and move the tip with it.
 *     3. Refuse on a closed bill — which the request explicitly asks for.
 *
 *   Built as (2), and the reason it is safe is the audit line rather than any rule about when:
 *   the old name, the new name, the amount that moved and who moved it all go into the log. An
 *   UNSETTLED tip follows the name. A SETTLED one does not — that money has left the building,
 *   and silently re-crediting a payout nobody can reverse would be the one genuinely dangerous
 *   version of this feature. The audit line says which happened.
 */
export async function reassignBillStaff(input: {
  billId: string;
  role: 'captain' | 'waiter';
  staffId: string | null;
  actor: Actor;
}): Promise<{ tipMoved: number }> {
  const bill = await getBill(input.billId);
  if (!bill) throw new Error('No such bill.');

  /* WHO MAY DO THIS (24-Sep list, G1). The owner's grant covers either position on any bill.
     A captain may set the WAITER on their OWN open bill, under the grant they already hold for
     running tables (`tables.assign`) - the waiter moves no money, the tip follows the captain,
     so the captain's own position stays behind the owner's grant. */
  if (!(input.actor.grants?.can('bill.reassign_staff') ?? false)) {
    if (!captainMayAssignWaiter({ role: input.role, actor: input.actor, bill })) {
      throw new PermissionDenied('bill.reassign_staff');
    }
  }

  const wasName = input.role === 'captain' ? bill.captain : bill.waiter;
  const column = BILL_STAFF_COLUMN[input.role];

  /**
   * THE SAME PREDICATE THE PICKER FILTERS BY. Rule 3: a hidden option is a courtesy, never a
   * boundary — and this boundary guards money, because an unsettled tip follows the captain.
   * `null` is allowed through: clearing the position is a different act from assigning it to
   * somebody who cannot hold it.
   */
  if (input.staffId !== null) {
    const { data: candidate } = await db()
      .from('staff')
      .select('name,role,active,restaurant_id')
      .eq('id', input.staffId)
      .maybeSingle();
    if (!candidate) throw new Error('No such member of staff.');
    if (candidate.restaurant_id !== (await currentRestaurantId())) {
      throw new Error('That person does not work here.');
    }
    if (!candidate.active) {
      throw new Error(`${candidate.name as string} has been removed from the staff list.`);
    }
    if (!canHoldBillRole(input.role, candidate.role as string)) {
      throw new Error(
        `${candidate.name as string} is ${candidate.role as string} — only a ${
          input.role === 'captain' ? 'Captain' : 'Waiter'
        } can be the ${input.role} on a bill. The tip follows the captain, so this is checked here as well as on the screen.`
      );
    }
  }

  const { error } = await db()
    .from('bill')
    .update({ [column]: input.staffId })
    .eq('id', input.billId);
  if (error) throw error;

  let tipMoved = 0;
  if (input.role === 'captain') {
    // Only an unsettled tip. A settled one has been paid out, and re-crediting a payout nobody
    // can reverse would be worse than the wrong name it is correcting.
    const { data: moved } = await db()
      .from('tip')
      .update({ staff_id: input.staffId })
      .eq('bill_id', input.billId)
      .is('settled_at', null)
      .select('amount');
    tipMoved = (moved ?? []).reduce((n, t) => n + Number(t.amount ?? 0), 0);
  }

  const { data: now } = await db()
    .from('staff')
    .select('name')
    .eq('id', input.staffId ?? '')
    .maybeSingle();
  const isName = (now?.name as string | undefined) ?? 'nobody';

  await audit({
    action: input.role === 'captain' ? 'Captain changed' : 'Waiter changed',
    detail:
      `${bill.code}: ${wasName || 'nobody'} → ${isName}` +
      (bill.status === 'closed' ? ' (on a CLOSED bill)' : '') +
      (tipMoved > 0 ? ` — ${rupees(tipMoved)} of unsettled tip moved with it` : '') +
      (input.role === 'captain' && tipMoved === 0 ? ' — no unsettled tip to move' : ''),
    actor: input.actor,
    billId: input.billId,
  });

  return { tipMoved };
}

/**
 * Record how this party found Jalsa, on their own session.
 *
 * Scoped by `sessionId`, which the caller reads from the cookie rather than the request body,
 * so a guest can only ever write their own visit. Empty clears it, which is what "actually, I
 * would rather not say" looks like.
 */
export async function recordHeardAbout(input: { sessionId: string; source: string }): Promise<void> {
  const { error } = await db()
    .from('guest_session')
    .update({ heard_about: input.source.trim().slice(0, 60) })
    .eq('id', input.sessionId);
  // Loud, not swallowed: a picker that reported success on a write that failed would tell the
  // owner's report something the database never agreed to.
  if (error) throw error;
}

/* ── Requests and suggestions ──────────────────────────────────────────── */

export async function raiseRequest(input: {
  tableId: string;
  billId: string | null;
  kind: string;
  note?: string;
}): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const { error } = await db()
    .from('table_request')
    .insert({
      restaurant_id: restaurantId,
      table_id: input.tableId,
      bill_id: input.billId,
      kind: input.kind,
      note: input.note ?? '',
    });
  if (error) throw error;
}

export async function completeRequest(input: { requestId: string; actor: Actor }): Promise<void> {
  const { data: row, error } = await db()
    .from('table_request')
    .select('id,kind,table_id,bill_id')
    .eq('id', input.requestId)
    .single();
  if (error) throw error;

  await db()
    .from('table_request')
    .update({ done_at: new Date().toISOString(), done_by_staff_id: input.actor.staffId })
    .eq('id', input.requestId)
    .is('done_at', null);

  await audit({
    action: 'Request',
    detail: `${row.kind as string} marked done`,
    actor: input.actor,
    billId: (row.bill_id as string) ?? null,
    tableId: row.table_id as string,
  });
}

export async function leaveSuggestion(input: {
  tableId: string | null;
  billId: string | null;
  body: string;
}): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const { error } = await db()
    .from('suggestion')
    .insert({
      restaurant_id: restaurantId,
      table_id: input.tableId,
      bill_id: input.billId,
      body: input.body.trim().slice(0, 2000),
    });
  if (error) throw error;
}

export async function replyToSuggestion(input: { suggestionId: string; reply: string; actor: Actor }): Promise<void> {
  const { error } = await db()
    .from('suggestion')
    .update({ reply: input.reply, replied_at: new Date().toISOString(), replied_by: input.actor.label })
    .eq('id', input.suggestionId);
  if (error) throw error;
  await audit({ action: 'Suggestion', detail: 'Acknowledged with a reply', actor: input.actor });
}

/* ── Menu availability ─────────────────────────────────────────────────── */

/**
 * Switch a dish off, or back on.
 *
 * This is the one write a captain makes that changes what every guest in the building sees, so
 * it says so in the audit detail. `closedUntil` is what makes "off for three days" expire by
 * itself rather than needing someone to remember.
 */
export async function setItemAvailability(input: {
  itemId: string;
  available: boolean;
  reason?: string;
  closedUntil?: string | null;
  actor: Actor;
}): Promise<void> {
  demand(input.actor, 'menu.availability');
  const { data: item, error } = await db().from('menu_item').select('id,name').eq('id', input.itemId).single();
  if (error) throw error;

  const { error: upErr } = await db()
    .from('menu_item')
    .update({
      available: input.available,
      closed_reason: input.available ? '' : (input.reason ?? ''),
      closed_until: input.available ? null : (input.closedUntil ?? null),
    })
    .eq('id', input.itemId);
  if (upErr) throw upErr;

  await audit({
    action: 'Availability',
    detail: input.available
      ? `${item.name as string} back on every customer's phone`
      : `${item.name as string} off every customer's phone${input.reason ? ` — ${input.reason}` : ''}`,
    actor: input.actor,
  });
}

/* ── Guest cart ────────────────────────────────────────────────────────── */

/**
 * The cart lives on the SERVER, keyed by the guest session.
 *
 * A cart in localStorage is lost by the one guest who most needs it kept: the one whose signal
 * dropped, or who switched to WhatsApp mid-order and came back to a reloaded tab (Standard 6.5).
 */
export async function setCartLine(input: { sessionId: string; menuItemId: string; qty: number }): Promise<void> {
  if (input.qty <= 0) {
    await db()
      .from('guest_cart_line')
      .delete()
      .eq('session_id', input.sessionId)
      .eq('menu_item_id', input.menuItemId);
    return;
  }
  const { error } = await db().from('guest_cart_line').upsert(
    {
      session_id: input.sessionId,
      menu_item_id: input.menuItemId,
      qty: input.qty,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,menu_item_id' }
  );
  if (error) throw error;
}

export async function clearCart(sessionId: string): Promise<void> {
  await db().from('guest_cart_line').delete().eq('session_id', sessionId);
}

export async function readCart(sessionId: string): Promise<Array<{ menuItemId: string; qty: number }>> {
  const { data, error } = await db().from('guest_cart_line').select('menu_item_id,qty').eq('session_id', sessionId);
  if (error) throw error;
  return (data ?? []).map((r) => ({ menuItemId: r.menu_item_id as string, qty: r.qty as number }));
}

export { chargeableLines, billTotals, nextNumber };

/**
 * The table has been wiped down and is ready for the next party.
 *
 * WHAT IT DOES AND WHAT IT CANNOT
 *   It stamps `cleared_at` on the released `bill_table` rows for this table and nothing else.
 *   It closes no bill, releases nothing that is still held, and cannot touch a table whose
 *   party has not left — `released_at is not null` is in the predicate, so a table still in
 *   service simply matches no rows. That is why `tables.clear` is an ordinary grant rather than
 *   an approval one, and why a waiter has it by role: the worst case is a table marked clean
 *   that is not, which the next person to walk past corrects.
 */
export async function clearTable(input: { tableId: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'tables.clear');

  const { data: table } = await db().from('dining_table').select('name').eq('id', input.tableId).maybeSingle();

  const { error } = await db()
    .from('bill_table')
    .update({ cleared_at: new Date().toISOString(), cleared_by: input.actor.label })
    .eq('table_id', input.tableId)
    .not('released_at', 'is', null)
    .is('cleared_at', null);
  if (error) throw error;

  await audit({
    action: 'Table cleared',
    detail: `${(table?.name as string) ?? 'A table'} reset for the next party`,
    actor: input.actor,
    tableId: input.tableId,
  });
}

/* ── The entrance queue, guest side ────────────────────────────────────── */

/**
 * A party joins by scanning the door code. NO PERMISSION IS DEMANDED, and that is the point.
 *
 * Every other write in this application is made by a named member of staff holding a grant. A
 * party standing at the door has no PIN and never will, so this write is narrowed instead of
 * granted: it may create one row, with a party size, marked `scanned`. It cannot choose its
 * token or its code — both come from the server — and it cannot notify, seat, or read anybody
 * else's row.
 *
 * No name and no number are taken. The design's own copy is the specification: "No name or
 * number needed. Your time is locked the moment you tap." A queue is the one place a restaurant
 * is tempted to collect a phone number it has no use for, and the design declined.
 */
export async function guestJoinQueue(input: { partySize: number }): Promise<{ id: string; token: string }> {
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 50) {
    throw new Error('Tell us how many of you there are.');
  }

  /*
    THE CLOSE IS ENFORCED HERE, NOT ONLY ON THE SCREEN.

    Until 18-Sep-2026 this function never read the switch. `/q` rendered the closed screen and
    that was the whole of the enforcement — which means it held only for a phone that loaded the
    page AFTER the owner closed the queue. It did not hold for:

      · a tab opened at 8:40 and tapped at 9:10, twenty minutes after closing
      · a POST sent directly, which needs no page at all
      · the party who tapped Join in the same second the owner closed

    All three inserted a row, took a token out of the shared series, and appeared on the host's
    screen as a party nobody agreed to take. Closing the queue is an operational decision about
    how much the kitchen can finish; a decision that a stale tab can overrule is not a decision.

    Read on the WRITE path rather than cached, because the value changes exactly when it matters.
    The default is OPEN — `queue.open !== false`, matching `/q/page.tsx` — so a restaurant that
    has never touched the switch behaves as it always has, and a missing settings row can never
    silently lock the door.
  */
  const { open } = await readSettings('queue', { open: true });
  if (open === false) throw new Error(QUEUE_CLOSED);

  const restaurantId = await currentRestaurantId();
  const token = await nextNumber('waitlist');
  const code = String(Math.floor(1000 + Math.random() * 9000));

  const { data, error } = await db()
    .from('waitlist_entry')
    .insert({
      restaurant_id: restaurantId,
      token,
      code,
      pair: '',
      party_size: input.partySize,
      phone: '',
      source: 'scanned',
      actor_label: 'Guest',
    })
    .select('id')
    .single();
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${token} joined from the door code — ${input.partySize} ${input.partySize === 1 ? 'guest' : 'guests'}`,
    actor: GUEST_ACTOR,
  });
  return { id: data.id as string, token };
}

/**
 * "Leave the queue" — the guest's own row, and only while they are still in it.
 *
 * The predicate is the authorisation: an id that is already seated or already removed matches
 * nothing, so a stale cookie cannot resurrect or re-remove anything. The row is kept and marked,
 * never deleted, so tonight's waiting times stay true.
 */
export async function guestLeaveQueue(input: { entryId: string }): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const { data: row } = await db()
    .from('waitlist_entry')
    .select('token')
    .eq('id', input.entryId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  const { error } = await db()
    .from('waitlist_entry')
    .update({ removed_at: new Date().toISOString(), removed_reason: 'Left from their own phone' })
    .eq('id', input.entryId)
    .eq('restaurant_id', restaurantId)
    .is('seated_at', null)
    .is('removed_at', null);
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${(row?.token as string) ?? 'A party'} left the queue from their own phone`,
    actor: GUEST_ACTOR,
  });
}

/**
 * Take one table out of a group mid-service, its rounds moving to a bill of its own.
 *
 * THE CASE THE PRODUCT PLAN SAID WOULD NOT BE DISCOVERED
 *   `Jalsa Product Plan.dc.html` names four group cases that "have to be designed, not
 *   discovered", and this is the second: *"removing a table mid-service (its lines move to a
 *   fresh bill)"*. Three of the four were built. This one was not, and the hole it left is a
 *   party of four who joined a table of eight, ate, and want to pay separately — for whom the
 *   only route was closing one bill for everybody and settling it by hand at the counter.
 *
 * WHY THE ROUNDS MOVE RATHER THAN BEING COPIED OR SPLIT BY AMOUNT
 *   Every KOT already carries `table_id` — the column exists so the kitchen and the runner know
 *   where the food goes on a group bill. That means "what did this table eat" is not a guess or
 *   a division, it is a `where` clause, and the two bills afterwards add up to what the one bill
 *   was, line for line, with no rounding and nothing apportioned.
 *
 *   That is also why this is not a "split the bill by amount" feature and never will be. A
 *   guest's phone shows its own table's rounds; a bill split by amount would show a figure that
 *   corresponds to nothing anybody ordered, and the first argument at the counter would be about
 *   arithmetic nobody can check.
 *
 * WHY IT REFUSES ONCE CLOSURE HAS STARTED
 *   Payment requested is a guest waiting at a total they have read. Moving lines out from under
 *   that total changes what they were told to pay, after they were told it. The honest answer is
 *   to withdraw the request first, which is already a verb this application has.
 *
 * WHY THE HOST TABLE CANNOT BE THE ONE THAT LEAVES
 *   `bill.host_table_id` is the table the bill was opened on and is what the code `B-1048` is
 *   anchored to. Detaching it would leave a bill whose host table belongs to a different bill —
 *   the same table pointed at twice, which the partial unique index is there to prevent.
 */
export async function detachTableFromBill(input: {
  billId: string;
  tableId: string;
  actor: Actor;
}): Promise<{ newBillCode: string; movedRounds: number }> {
  demand(input.actor, 'tables.assign');
  const restaurantId = await currentRestaurantId();

  const bill = await getBill(input.billId);
  if (!bill) throw new Error('No such bill.');

  const { data: leaving } = await db()
    .from('dining_table')
    .select('id,name')
    .eq('id', input.tableId)
    .maybeSingle();
  if (!leaving) throw new Error('No such table.');

  const { data: hostRow, error: hostErr } = await db()
    .from('bill')
    .select('host_table_id,tax_rate,captain_staff_id,waiter_staff_id')
    .eq('id', input.billId)
    .single();
  if (hostErr || !hostRow) throw hostErr ?? new Error('No such bill.');

  // The SAME predicate the screen decides whether to offer the button by. Rule 3 of this module:
  // a hidden button is a courtesy, never a boundary.
  const verdict = billSeparability({
    status: bill.status,
    tableCount: bill.tables.length,
    isHostTable: (hostRow.host_table_id as string) === input.tableId,
  });
  if (!verdict.can) throw new Error(verdict.reason);

  const { data: membership } = await db()
    .from('bill_table')
    .select('bill_id')
    .eq('bill_id', input.billId)
    .eq('table_id', input.tableId)
    .is('released_at', null)
    .maybeSingle();
  if (!membership) throw new Error(`${leaving.name as string} is not on this bill.`);

  /**
   * ORDER MATTERS AND IT IS NOT NEGOTIABLE.
   *
   * The membership row is removed BEFORE the new bill claims the table, because the partial
   * unique index enforces one unreleased membership per table and would — correctly — refuse the
   * insert otherwise. A failure between the two leaves the table on NO bill, which the floor
   * screen shows as free and a captain can re-seat; the reverse order would leave it on two,
   * which nothing can show and nobody can undo.
   */
  const { error: dropErr } = await db()
    .from('bill_table')
    .delete()
    .eq('bill_id', input.billId)
    .eq('table_id', input.tableId);
  if (dropErr) throw dropErr;

  const code = await nextNumber('bill');
  const { data: fresh, error: newErr } = await db()
    .from('bill')
    .insert({
      restaurant_id: restaurantId,
      code,
      host_table_id: input.tableId,
      // The new bill inherits the staff and the rate, not the guest count: the covers on the
      // old bill were counted for a party that is now two parties, and a number carried across
      // would be wrong on both sides. Two is the same default an ordinary table opens with.
      guests: 2,
      tax_rate: hostRow.tax_rate as number,
      captain_staff_id: hostRow.captain_staff_id as string | null,
      waiter_staff_id: hostRow.waiter_staff_id as string | null,
    })
    .select('id')
    .single();
  if (newErr) throw newErr;

  const { error: linkErr } = await db()
    .from('bill_table')
    .insert({ bill_id: fresh.id as string, table_id: input.tableId });
  if (linkErr) throw linkErr;

  // The rounds this table sent, and only those. `table_id` is on every KOT already.
  const { data: moved, error: moveErr } = await db()
    .from('kot')
    .update({ bill_id: fresh.id as string })
    .eq('bill_id', input.billId)
    .eq('table_id', input.tableId)
    .select('id');
  if (moveErr) throw moveErr;

  /**
   * A TIP FOLLOWS ITS BILL, AND THERE IS NO SPLIT OF ONE.
   *
   * A tip is one guest's decision about one total. When the table leaving is the one that tipped
   * there is no honest way to divide it, so tips stay with the bill they were left on and the
   * audit entry says so — the alternative is apportioning somebody's gratuity by a ratio they
   * never agreed to.
   */
  const movedCount = (moved ?? []).length;

  await audit({
    action: 'Group',
    detail: `${leaving.name as string} separated from ${bill.code} onto ${code} — ${
      movedCount === 1 ? '1 round' : `${movedCount} rounds`
    } moved. Tips stay with ${bill.code}.`,
    actor: input.actor,
    billId: input.billId,
    tableId: input.tableId,
  });

  return { newBillCode: code, movedRounds: movedCount };
}

/**
 * Raise the captain's and the bill counter's notification for a payment request (item 37) -
 * each only if one of its kind is not already open for this bill.
 */
async function raisePaymentNotices(bill: Bill): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const { data: row } = await db().from('bill').select('host_table_id').eq('id', bill.id).maybeSingle();
  const tableId = (row?.host_table_id as string | null) ?? null;
  if (!tableId) return;
  const { data: open, error } = await db()
    .from('table_request')
    .select('kind')
    .eq('bill_id', bill.id)
    .is('done_at', null)
    .in('kind', PAYMENT_NOTICE_KINDS as string[]);
  if (error) throw error;
  const toRaise = noticesToRaise((open ?? []).map((r) => r.kind as string));
  if (toRaise.length === 0) return;
  const payable = rupees(billTotals(bill).payable);
  const { error: insErr } = await db()
    .from('table_request')
    .insert(
      toRaise.map((a) => ({
        restaurant_id: restaurantId,
        table_id: tableId,
        bill_id: bill.id,
        kind: PAYMENT_NOTICE[a].kind,
        note: paymentNoticeNote(a, bill.code, payable),
      }))
    );
  if (insErr) throw insErr;
}

async function resolvePaymentNotices(billId: string, kinds: readonly string[]): Promise<void> {
  const { error } = await db()
    .from('table_request')
    .update({ done_at: new Date().toISOString() })
    .eq('bill_id', billId)
    .is('done_at', null)
    .in('kind', kinds as string[]);
  if (error) throw error;
}
