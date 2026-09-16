import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { kitchenHasStarted, type KotStatus } from '@/lib/status';
import { discountBothWays, rupees } from '@/lib/money';
import { PermissionDenied } from '@/lib/permissions';
import { resolvePrinter, type RoutablePrinter } from '@/lib/print-routing';
import { billTotals, chargeableLines, getBill, openBillForTable } from './queries';
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
export async function ensureOpenBill(tableId: string, opts: { guests?: number } = {}): Promise<Bill> {
  const existing = await openBillForTable(tableId);
  if (existing) return existing;

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
    db().from('dining_table').select('name').eq('id', tableId).maybeSingle(),
  ]);
  type Assigned = { staff: { id: string; role: string; on_duty: boolean } | null };
  const people = ((assigned ?? []) as unknown as Assigned[])
    .map((a) => a.staff)
    .filter((s): s is { id: string; role: string; on_duty: boolean } => !!s && s.on_duty);
  const captain = people.find((p) => p.role === 'Captain') ?? null;
  const waiter = people.find((p) => p.role === 'Waiter') ?? null;

  const { data: billRow, error: billErr } = await db()
    .from('bill')
    .insert({
      restaurant_id: restaurantId,
      code,
      host_table_id: tableId,
      guests: opts.guests ?? 2,
      tax_rate: tax,
      captain_staff_id: captain?.id ?? null,
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
      actor: GUEST_ACTOR,
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
    .select('id,name,price,food_type,available,closed_until,menu_category!inner(name)')
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
      accepted.map(({ line, item }) => ({
        kot_id: kot.id as string,
        menu_item_id: item.id as string,
        name: item.name as string,
        unit_price: item.price as number,
        food_type: item.food_type as string,
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
      categories: accepted.map(
        ({ item }) => (item.menu_category as unknown as { name: string } | null)?.name ?? ''
      ),
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
    await queuePrint({ kind: 'KOT', kotId: kot.id, billId: kot.bill_id, actor: input.actor, isReprint: true });
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
    .select('id,code,status,bill_id,table_id')
    .eq('id', input.kotId)
    .single();
  if (error) throw error;

  const patch: Record<string, unknown> = { status: input.to };
  const stamp = STAMP_FOR[input.to];
  // Stamped only on the FIRST transition into a state. A re-tap must not rewrite the minute
  // the kitchen actually finished, because that minute is what the timings report reads.
  if (stamp) patch[stamp] = new Date().toISOString();

  const { error: upErr } = await db().from('kot').update(patch).eq('id', input.kotId);
  if (upErr) throw upErr;

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

  await queuePrint({
    kind: 'KOT',
    kotId: input.kotId,
    billId: kot.bill_id as string,
    actor: input.actor,
    isReprint: true,
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
 * Queue a print job and try it.
 *
 * The TVS devices are an unvalidated dependency, so this deliberately does NOT pretend. With no
 * reachable printer the job lands as `failed` with a reason, the record shows a print-failed
 * badge, and a retry exists. That is the honest state, and it is the state the restaurant will
 * actually be in on day one.
 */
export async function queuePrint(input: {
  kind: 'KOT' | 'Invoice';
  kotId?: string;
  billId: string;
  actor: Actor;
  isReprint?: boolean;
  /**
   * The menu categories this round contains. The caller already holds them — `placeRound` has
   * just read the items — so routing costs no extra round trip on the hot path. Omitted, the
   * decision falls back to "any machine of this kind", which is what it was before routing
   * existed and is still the right answer for a bill.
   */
  categories?: readonly string[];
}): Promise<void> {
  const restaurantId = await currentRestaurantId();
  const purpose = input.kind === 'KOT' ? 'KOT' : 'Invoice';

  const { data: rows } = await db()
    .from('printer')
    .select('id,name,purpose,station,routes,online,enabled')
    .eq('restaurant_id', restaurantId)
    .eq('purpose', purpose);

  const printers: RoutablePrinter[] = (rows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    purpose: p.purpose as string,
    station: (p.station as string) ?? 'Main Kitchen',
    routes: (p.routes as string[]) ?? [],
    online: p.online as boolean,
    enabled: (p.enabled as boolean | null) ?? true,
  }));

  /**
   * ROUTING IS CONSULTED HERE OR IT IS DECORATION.
   *
   * The Routing section of Print Setup is a screen that says which machine prints which
   * category. If this function kept picking the first reachable machine, that screen would
   * configure nothing and the only symptom would be tandoor tickets appearing in the main
   * kitchen — which looks exactly like the fallback working. A settings screen whose value is
   * never read is worse than an absent one.
   *
   * A round can span two stations, so the DECISION is taken per category and the job is written
   * against the machine the FIRST category resolves to, with every other station named in the
   * reason. One job per round, not one per station: the print worker that fans a job out to
   * machines does not exist yet, and writing four jobs no worker will read would be a queue
   * that looks busier than the kitchen is.
   */
  const decisions = (input.categories?.length ? [...new Set(input.categories)] : ['']).map((category) =>
    resolvePrinter({ purpose, category, printers })
  );
  const first = decisions[0] ?? { printer: null, rule: 'none' as const, station: '', reason: '' };
  const chosen = first.printer;
  const reachable = chosen && chosen.online && chosen.enabled ? chosen : null;

  const failure = chosen
    ? decisions.map((d) => d.reason).filter(Boolean).join(' · ') || 'No printer for this route is reachable.'
    : 'No printer for this route is reachable.';

  await db()
    .from('print_job')
    .insert({
      restaurant_id: restaurantId,
      printer_id: chosen?.id ?? null,
      kind: input.kind,
      kot_id: input.kotId ?? null,
      bill_id: input.billId,
      status: reachable ? 'printed' : 'failed',
      attempts: 1,
      is_reprint: input.isReprint ?? false,
      requested_by: input.actor.label,
      // On success the reason is still recorded, because "it printed" does not say WHERE, and
      // where is the question somebody asks when a station insists it never got the ticket.
      last_error: reachable ? '' : failure,
      completed_at: reachable ? new Date().toISOString() : null,
    });

  if (input.kotId) {
    await db()
      .from('kot')
      .update({
        print_status: reachable ? 'printed' : 'failed',
        print_attempts: 1,
        printed_at: reachable ? new Date().toISOString() : null,
      })
      .eq('id', input.kotId);
  }
}

/**
 * Try a failed or retrying job again.
 *
 * WHY THIS IS A NEW ATTEMPT ON THE SAME ROW AND NOT A NEW ROW
 *   The print history is the record of what the system tried. Three attempts at KOT-0041 are one
 *   ticket that has not arrived, not three tickets — and the design's History table has a Tries
 *   column precisely so a person can tell those apart. A new row per retry would show a kitchen
 *   three outstanding tickets and send somebody looking for two that do not exist.
 *
 * A retry is NOT a reprint. It does not mark the ticket, because nothing came out of a machine
 * the first time. Reprinting a ticket that DID print is `reprintKot`, and that one marks it.
 */
export async function retryPrintJob(input: { jobId: string; actor: Actor }): Promise<{ printed: boolean }> {
  demand(input.actor, 'orders.reprint');
  const restaurantId = await currentRestaurantId();

  const { data: job, error } = await db()
    .from('print_job')
    .select('id,kind,kot_id,attempts,status')
    .eq('id', input.jobId)
    .single();
  if (error) throw error;

  if (job.status === 'printed') {
    // Not an error and not a silent success: the job is already done, and re-sending it would
    // put a second unmarked ticket in the kitchen — the one printing mistake that costs food.
    throw new Error('That ticket has already printed. Use Reprint, which marks the paper.');
  }

  const { data: rows } = await db()
    .from('printer')
    .select('id,name,purpose,station,routes,online,enabled')
    .eq('restaurant_id', restaurantId)
    .eq('purpose', job.kind === 'KOT' ? 'KOT' : 'Invoice');

  const target = (rows ?? []).find((p) => p.online === true && ((p.enabled as boolean | null) ?? true)) ?? null;
  const attempts = ((job.attempts as number) ?? 0) + 1;

  await db()
    .from('print_job')
    .update({
      status: target ? 'printed' : 'failed',
      attempts,
      printer_id: target?.id ?? null,
      last_error: target ? '' : `Attempt ${attempts}: no machine of this kind answered.`,
      completed_at: target ? new Date().toISOString() : null,
    })
    .eq('id', input.jobId);

  if (job.kot_id) {
    await db()
      .from('kot')
      .update({
        print_status: target ? 'printed' : 'failed',
        print_attempts: attempts,
        printed_at: target ? new Date().toISOString() : null,
      })
      .eq('id', job.kot_id as string);
  }

  await audit({
    action: 'Reprint',
    detail: `Print job retried — attempt ${attempts}, ${target ? `printed at ${target.name as string}` : 'still no machine answered'}`,
    actor: input.actor,
  });

  return { printed: !!target };
}

/* ── Closure ───────────────────────────────────────────────────────────── */

/** The guest's half of closure, and the ONLY half they have. */
export async function requestPayment(billId: string): Promise<void> {
  const bill = await getBill(billId);
  if (!bill) throw new Error('No such bill.');
  if (bill.status === 'closed') return; // already settled; asking again changes nothing

  await db()
    .from('bill')
    .update({ status: 'payment_requested', payment_requested_at: new Date().toISOString() })
    .eq('id', billId)
    .neq('status', 'closed');

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
  demand(input.actor, 'bill.reassign_staff');

  const bill = await getBill(input.billId);
  if (!bill) throw new Error('No such bill.');

  const wasName = input.role === 'captain' ? bill.captain : bill.waiter;
  const column = BILL_STAFF_COLUMN[input.role];

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
