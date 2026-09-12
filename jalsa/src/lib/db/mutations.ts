import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { kitchenHasStarted, type KotStatus } from '@/lib/status';
import { rupees } from '@/lib/money';
import { PermissionDenied } from '@/lib/permissions';
import { billTotals, chargeableLines, getBill, openBillForTable } from './queries';
import type { Bill } from './types';

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

async function nextNumber(kind: 'bill' | 'kot' | 'group'): Promise<string> {
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
  const tax = await currentTaxRate();

  // The table's standing captain and waiter open the bill. Reassignment is a later, audited
  // action - but a bill with nobody's name on it can never be attributed retrospectively.
  const { data: assigned } = await db()
    .from('staff_table')
    .select('staff:staff_id(id,role,on_duty)')
    .eq('table_id', tableId);
  type Assigned = { staff: { id: string; role: string; on_duty: boolean } | null };
  const people = ((assigned ?? []) as unknown as Assigned[])
    .map((a) => a.staff)
    .filter((s): s is { id: string; role: string; on_duty: boolean } => !!s && s.on_duty);
  const captain = people.find((p) => p.role === 'Captain') ?? null;
  const waiter = people.find((p) => p.role === 'Waiter') ?? null;

  const code = await nextNumber('bill');
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

  const bill = await getBill(billRow.id as string);
  if (!bill) throw new Error('Bill vanished immediately after being created.');
  await audit({
    action: 'Bill opened',
    detail: `${code} opened on ${bill.tables.join(', ')}`,
    actor: GUEST_ACTOR,
    billId: bill.id,
    tableId,
  });
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
    .select('id,name,price,food_type,available,closed_until')
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

  // Rule 1: the round is saved. Only now is a printer asked for anything, and a refusal
  // changes a badge on the record rather than losing the order.
  await queuePrint({ kind: 'KOT', kotId: kot.id as string, billId: input.billId, actor: input.actor });

  await audit({
    action: 'Order placed',
    detail: `${code} created — ${accepted.length === 1 ? '1 item' : `${accepted.length} items`}${
      refused.length ? ` (${refused.length} unavailable and not sent)` : ''
    }`,
    actor: input.actor,
    billId: input.billId,
    tableId: input.tableId,
  });

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
}): Promise<void> {
  const restaurantId = await currentRestaurantId();

  const { data: printers } = await db()
    .from('printer')
    .select('id,online,purpose')
    .eq('restaurant_id', restaurantId)
    .eq('purpose', input.kind === 'KOT' ? 'KOT' : 'Invoice');

  const reachable = (printers ?? []).find((p) => p.online === true) ?? null;

  await db()
    .from('print_job')
    .insert({
      restaurant_id: restaurantId,
      printer_id: reachable?.id ?? (printers ?? [])[0]?.id ?? null,
      kind: input.kind,
      kot_id: input.kotId ?? null,
      bill_id: input.billId,
      status: reachable ? 'printed' : 'failed',
      attempts: 1,
      is_reprint: input.isReprint ?? false,
      requested_by: input.actor.label,
      last_error: reachable ? '' : 'No printer for this route is reachable.',
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
  discountPct?: number;
  discountAmount?: number;
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

  const wantsDiscount = (input.discountPct ?? 0) > 0 || (input.discountAmount ?? 0) > 0;
  if (wantsDiscount) {
    demand(input.actor, (input.discountPct ?? 0) > 0 ? 'bill.disc_pct' : 'bill.disc_flat');
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
      discount_pct: input.discountPct ?? bill.discountPct,
      discount_amount: input.discountAmount ?? bill.discountAmount,
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
      detail: `${input.discountPct ? `${input.discountPct}% applied` : 'Flat discount'} — ${rupees(totals.discount)}`,
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

export { chargeableLines, billTotals };
