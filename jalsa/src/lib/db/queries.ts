import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { tableStateFrom, type KotStatus } from '@/lib/status';
import { totalBill } from '@/lib/money';
import type {
  AuditRow,
  Bill,
  ExpenseRow,
  FloorTable,
  Kot,
  MenuCategory,
  GuestReply,
  MenuItem,
  QueueSelfView,
  WaitlistRow,
  PrinterRow,
  PrintJobRow,
  StaffMember,
  Suggestion,
  TableRequest,
  TipRow,
} from './types';

/**
 * queries - every READ the application makes.
 *
 * WHY THE JOINS ARE SPELLED OUT HERE AND NOWHERE ELSE
 *   A bill is a row, its tables are a join table, its rounds are two more, and its tip is a
 *   fifth. Assembled at the call site, that shape gets assembled four slightly different ways
 *   by four screens, and the fourth one forgets that a cancelled line still exists but must
 *   not be charged. Assembled once, here, every surface is looking at the same bill.
 *
 * WHY totals ARE NOT STORED ON THE ROW
 *   They are computed by `totalBill` from the lines, on every read. A stored total is a second
 *   source of truth that is correct until the first quantity change that forgets to update it -
 *   and a wrong total is the single most disputed thing an interface can show (Standard 7.2).
 */

const minutesSince = (iso: string): number => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

/* ── Menu ──────────────────────────────────────────────────────────────── */

export async function listMenu(): Promise<{ items: MenuItem[]; categories: MenuCategory[] }> {
  const restaurantId = await currentRestaurantId();

  /**
   * TWO READS THAT DO NOT NEED EACH OTHER, ISSUED AT ONCE.
   *
   * The category list is keyed by `restaurant_id` alone — it never reads a menu item, and the
   * counting below is in-memory arithmetic over `items` done after both have landed. They were
   * serial only because the counting sits between them in the source. That put a second
   * cross-region round trip on the guest's critical path, and `listMenu` is on EVERY guest
   * payload build: the first page render, the six-second poll, and the write-echo that decides
   * when `guest-placed` appears.
   */
  const [
    { data, error },
    { data: cats },
  ] = await Promise.all([
    db()
      .from('menu_item')
      .select(
        'id,name,description,price,food_type,image_url,available,closed_reason,closed_until,sort,menu_category!inner(id,name,sort)'
      )
      .eq('restaurant_id', restaurantId)
      .order('sort', { ascending: true }),
    db().from('menu_category').select('id,name,sort').eq('restaurant_id', restaurantId).order('sort', { ascending: true }),
  ]);
  if (error) throw error;

  const now = Date.now();
  const items: MenuItem[] = (data ?? []).map((row) => {
    const cat = row.menu_category as unknown as { id: string; name: string; sort: number };
    // A dated closure that has run out is not a closure any more. Expiring it on READ rather
    // than by a scheduled job means the dish comes back on its own, at the minute it should,
    // without anything having to be running.
    const closedUntil = row.closed_until as string | null;
    const stillClosed = closedUntil ? new Date(closedUntil).getTime() > now : false;
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) ?? '',
      price: Number(row.price),
      foodType: row.food_type as MenuItem['foodType'],
      category: cat.name,
      categoryId: cat.id,
      imageUrl: (row.image_url as string) ?? '',
      available: (row.available as boolean) && !stillClosed,
      closedReason: (row.closed_reason as string) ?? '',
      closedUntil: stillClosed ? closedUntil : null,
      sort: (row.sort as number) ?? 0,
    };
  });

  const byCat = new Map<string, MenuCategory>();
  for (const it of items) {
    const seen = byCat.get(it.categoryId);
    if (seen) seen.count += 1;
    else byCat.set(it.categoryId, { id: it.categoryId, name: it.category, sort: 0, count: 1 });
  }
  const categories: MenuCategory[] = (cats ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    sort: (c.sort as number) ?? 0,
    count: byCat.get(c.id as string)?.count ?? 0,
  }));

  return { items, categories };
}

/* ── Bills ─────────────────────────────────────────────────────────────── */

const BILL_SELECT = `
  id, code, status, group_code, guests, occasion_type, occasion_name, occasion_source,
  discount_pct, discount_amount, tax_rate, payment_mode, payment_reference,
  payment_requested_at, closed_at, opened_at,
  host_table:host_table_id (name),
  captain:captain_staff_id (id, name),
  waiter:waiter_staff_id (id, name),
  closed_by:closed_by_staff_id (name),
  discount_by:discount_by_staff_id (name),
  bill_table ( released_at, dining_table:table_id (id, name) ),
  tip ( amount ),
  kot (
    id, code, status, source, placed_by_label, note, print_status, print_attempts,
    reprint_count, created_at, started_at, ready_at, picked_up_at, served_at,
    dining_table:table_id (name),
    kot_item ( id, name, unit_price, qty, food_type, qty_before, cancelled_at, cancel_reason )
  )
`;

interface RawRef {
  name?: string;
  id?: string;
}

function shapeBill(row: Record<string, unknown>): Bill {
  const captain = (row.captain ?? null) as RawRef | null;
  const waiter = (row.waiter ?? null) as RawRef | null;
  const closedBy = (row.closed_by ?? null) as RawRef | null;
  const discountBy = (row.discount_by ?? null) as RawRef | null;
  const hostTable = (row.host_table ?? null) as RawRef | null;

  const memberships = (row.bill_table ?? []) as Array<{ dining_table: RawRef }>;
  const tables = memberships
    .map((m) => m.dining_table?.name ?? '')
    .filter(Boolean)
    .sort();

  const tips = (row.tip ?? []) as Array<{ amount: number }>;
  const tip = tips.reduce((a, t) => a + Number(t.amount), 0);

  const kots: Kot[] = ((row.kot ?? []) as Array<Record<string, unknown>>)
    .map((k) => {
      const t = (k.dining_table ?? null) as RawRef | null;
      return {
        id: k.id as string,
        code: k.code as string,
        status: k.status as KotStatus,
        source: k.source as Kot['source'],
        placedBy: (k.placed_by_label as string) ?? '',
        tableName: t?.name ?? '',
        note: (k.note as string) ?? '',
        printStatus: k.print_status as Kot['printStatus'],
        printAttempts: (k.print_attempts as number) ?? 0,
        reprintCount: (k.reprint_count as number) ?? 0,
        createdAt: k.created_at as string,
        startedAt: (k.started_at as string) ?? null,
        readyAt: (k.ready_at as string) ?? null,
        pickedUpAt: (k.picked_up_at as string) ?? null,
        servedAt: (k.served_at as string) ?? null,
        items: ((k.kot_item ?? []) as Array<Record<string, unknown>>).map((i) => ({
          id: i.id as string,
          name: i.name as string,
          unitPrice: Number(i.unit_price),
          qty: i.qty as number,
          foodType: i.food_type as KotItemFoodType,
          qtyBefore: (i.qty_before as number) ?? null,
          cancelledAt: (i.cancelled_at as string) ?? null,
          cancelReason: (i.cancel_reason as string) ?? '',
        })),
      };
    })
    // Oldest first. Rounds are read as a history, and a history that starts at the end is
    // read wrongly by everyone at least once.
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    id: row.id as string,
    code: row.code as string,
    status: row.status as Bill['status'],
    tables,
    hostTable: hostTable?.name ?? tables[0] ?? '',
    groupCode: (row.group_code as string) ?? null,
    guests: (row.guests as number) ?? 0,
    captain: captain?.name ?? 'Unassigned',
    captainId: captain?.id ?? null,
    waiter: waiter?.name ?? 'Unassigned',
    waiterId: waiter?.id ?? null,
    occasion: row.occasion_type
      ? {
          type: row.occasion_type as string,
          name: (row.occasion_name as string) ?? '',
          source: (row.occasion_source as string) ?? '',
        }
      : null,
    discountPct: Number(row.discount_pct ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    discountBy: discountBy?.name ?? null,
    taxRate: Number(row.tax_rate ?? 5),
    tip,
    paymentMode: (row.payment_mode as string) ?? null,
    paymentReference: (row.payment_reference as string) ?? '',
    paymentRequestedAt: (row.payment_requested_at as string) ?? null,
    closedAt: (row.closed_at as string) ?? null,
    closedBy: closedBy?.name ?? null,
    openedAt: row.opened_at as string,
    kots,
  };
}

type KotItemFoodType = MenuItem['foodType'];

/** Every line that is actually chargeable: cancelled ones stay visible but are never billed. */
export function chargeableLines(bill: Bill) {
  return bill.kots
    .filter((k) => k.status !== 'cancelled')
    .flatMap((k) => k.items.filter((i) => !i.cancelledAt))
    .map((i) => ({ name: i.name, unitPrice: i.unitPrice, qty: i.qty }));
}

export function billTotals(bill: Bill) {
  return totalBill({
    lines: chargeableLines(bill),
    discountPct: bill.discountPct,
    discountAmount: bill.discountAmount,
    taxRate: bill.taxRate,
    tip: bill.tip,
  });
}

export async function getBill(billId: string): Promise<Bill | null> {
  const { data, error } = await db().from('bill').select(BILL_SELECT).eq('id', billId).maybeSingle();
  if (error) throw error;
  return data ? shapeBill(data as Record<string, unknown>) : null;
}

/**
 * The open bill on a table, if there is one.
 *
 * Resolved through bill_table.released_at rather than a status filter, because that column is
 * what the "one open bill per table" unique index is built on - so this query and that
 * constraint can never disagree about which bill is live.
 */
export async function openBillForTable(tableId: string): Promise<Bill | null> {
  const { data, error } = await db()
    .from('bill_table')
    .select('bill_id')
    .eq('table_id', tableId)
    .is('released_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getBill(data.bill_id as string);
}

/** The most recently closed bill on a table, for the rescan window ("scan again, bill closed"). */
export async function lastClosedBillForTable(tableId: string): Promise<Bill | null> {
  const { data, error } = await db()
    .from('bill_table')
    .select('bill_id, released_at')
    .eq('table_id', tableId)
    .not('released_at', 'is', null)
    .order('released_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getBill(data.bill_id as string);
}

export async function listOpenBills(): Promise<Bill[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('bill')
    .select(BILL_SELECT)
    .eq('restaurant_id', restaurantId)
    .neq('status', 'closed')
    .order('opened_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => shapeBill(r as Record<string, unknown>));
}

export async function listClosedBillsToday(): Promise<Bill[]> {
  const restaurantId = await currentRestaurantId();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from('bill')
    .select(BILL_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'closed')
    .gte('closed_at', since.toISOString())
    .order('closed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => shapeBill(r as Record<string, unknown>));
}

/**
 * Closed bills over a range, for the Reports section's one date range.
 *
 * WHY A BILL BELONGS TO THE DAY IT WAS CLOSED
 *   A table that opens at 11:40 pm and settles at 12:20 am is one bill on two dates. `closed_at`
 *   is the moment the money was recorded, which is the moment the books care about, and it is
 *   the same column `listClosedBillsToday` already filters on — so today's figures and a
 *   one-day range agree by construction rather than by coincidence.
 *
 * The range is inclusive at both ends: `to` is pushed to the end of its day here rather than in
 * the caller, so every caller cannot get it wrong differently.
 */
export async function listClosedBillsBetween(from: string, to: string): Promise<Bill[]> {
  const restaurantId = await currentRestaurantId();
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);

  const { data, error } = await db()
    .from('bill')
    .select(BILL_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'closed')
    .gte('closed_at', start.toISOString())
    .lt('closed_at', end.toISOString())
    .order('closed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => shapeBill(r as Record<string, unknown>));
}

/** Expenses over the same range, filtered on the day they were SPENT, not entered. */
export async function listExpensesBetween(from: string, to: string): Promise<ExpenseRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('expense')
    .select('id,spent_on,category,note,amount,entered_by')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .gte('spent_on', from)
    .lte('spent_on', to)
    .order('spent_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    spentOn: e.spent_on as string,
    category: e.category as string,
    note: (e.note as string) ?? '',
    amount: Number(e.amount),
    enteredBy: e.entered_by as string,
  }));
}

/* ── Floor ─────────────────────────────────────────────────────────────── */

/**
 * The floor, with each table's state DERIVED from its bill and rounds.
 *
 * One query for tables, one for open bills, one for open requests - then joined in memory.
 * Twenty tables and a handful of open bills is a trivial amount of data, and doing it this way
 * means `tableStateFrom` is the single definition of what "ready" means, shared with the unit
 * tests, instead of a CASE expression in SQL that no test can reach.
 */
export async function listFloor(): Promise<FloorTable[]> {
  const restaurantId = await currentRestaurantId();
  const [tablesRes, bills, requests, phonesRes, clearingRes] = await Promise.all([
    db()
      .from('dining_table')
      .select('id,name,zone,seats,active,sort')
      .eq('restaurant_id', restaurantId)
      .order('sort', { ascending: true }),
    listOpenBills(),
    listOpenRequests(),
    /* Phones still attached to a table. Not occupancy in the billing sense — a party that
       scanned, filled a cart and walked out leaves one of these and no bill — but it IS stale
       data sitting on a table the restaurant considers free, and the only thing that can see it
       is this query. It is what `tables.free` clears. */
    db().from('guest_session').select('table_id').eq('restaurant_id', restaurantId),
    /* Tables a closure has released and nobody has reset yet. `released_at` is stamped by
       release_tables_on_close the instant a bill closes — that stamp is "the guests have gone"
       — and `cleared_at` is the other end. Until this read existed, tableStateFrom's
       `awaitingClearing` was never passed by anything and the `clearing` state was dead. */
    db()
      .from('bill_table')
      .select('table_id,released_at,bill:bill_id(code,guests)')
      .not('released_at', 'is', null)
      .is('cleared_at', null),
  ]);
  if (tablesRes.error) throw tablesRes.error;

  const phones = new Map<string, number>();
  for (const row of phonesRes.data ?? []) {
    const id = row.table_id as string;
    phones.set(id, (phones.get(id) ?? 0) + 1);
  }

  const billByTable = new Map<string, Bill>();
  for (const b of bills) for (const t of b.tables) billByTable.set(t, b);

  const nowMs = Date.now();
  const awaitingClearing = new Map<
    string,
    { releasedAtIso: string; billCode: string; guests: number; waitedMinutes: number }
  >();
  for (const row of clearingRes.data ?? []) {
    const linked = row.bill as unknown as { code?: string; guests?: number } | null;
    const releasedAtIso = row.released_at as string;
    awaitingClearing.set(row.table_id as string, {
      releasedAtIso,
      billCode: linked?.code ?? '',
      guests: linked?.guests ?? 0,
      // Aged on the SERVER, like the waitlist's wait. Computed in render it is both impure —
      // the React compiler rejects it outright — and different on every device whose clock
      // drifts, which is how two waiters disagree about which table has been cold longest.
      waitedMinutes: Math.max(0, Math.round((nowMs - new Date(releasedAtIso).getTime()) / 60000)),
    });
  }

  const requestsByTable = new Map<string, number>();
  for (const r of requests) requestsByTable.set(r.tableName, (requestsByTable.get(r.tableName) ?? 0) + 1);

  return (tablesRes.data ?? []).map((t) => {
    const name = t.name as string;
    const bill = billByTable.get(name) ?? null;
    const statuses = bill ? bill.kots.map((k) => k.status) : [];
    const totals = bill ? billTotals(bill) : null;
    return {
      id: t.id as string,
      name,
      zone: t.zone as string,
      seats: t.seats as number,
      active: t.active as boolean,
      state: tableStateFrom({
        hasBill: !!bill,
        ...(bill ? { billStatus: bill.status } : {}),
        kotStatuses: statuses,
        // First in tableStateFrom's own order of urgency: a table the party has left but
        // nobody has wiped is not free, however empty the bill list says it is.
        awaitingClearing: awaitingClearing.has(t.id as string),
      }),
      billId: bill?.id ?? null,
      billCode: bill?.code ?? null,
      groupCode: bill?.groupCode ?? null,
      guests: bill?.guests ?? 0,
      captain: bill?.captain ?? '',
      waiter: bill?.waiter ?? '',
      roundCount: bill?.kots.length ?? 0,
      readyCount: statuses.filter((s) => s === 'ready' || s === 'picked_up').length,
      openRequests: requestsByTable.get(name) ?? 0,
      hasOccasion: !!bill?.occasion,
      total: totals?.payable ?? 0,
      phonesAttached: phones.get(t.id as string) ?? 0,
      clearing: awaitingClearing.get(t.id as string) ?? null,
    };
  });
}

export async function findTableByName(
  name: string
): Promise<{ id: string; name: string; zone: string; seats: number; active: boolean } | null> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('dining_table')
    .select('id,name,zone,seats,active')
    .eq('restaurant_id', restaurantId)
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id as string,
        name: data.name as string,
        zone: data.zone as string,
        seats: data.seats as number,
        active: data.active as boolean,
      }
    : null;
}

/* ── Requests and suggestions ──────────────────────────────────────────── */

export async function listOpenRequests(): Promise<TableRequest[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('table_request')
    .select(
      'id,kind,note,created_at,dining_table:table_id (id,name),bill:bill_id (code,captain:captain_staff_id(name))'
    )
    .eq('restaurant_id', restaurantId)
    .is('done_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const t = r.dining_table as unknown as RawRef;
    const b = r.bill as unknown as { code?: string; captain?: RawRef } | null;
    return {
      id: r.id as string,
      kind: r.kind as string,
      note: (r.note as string) ?? '',
      tableName: t?.name ?? '',
      tableId: t?.id ?? '',
      billCode: b?.code ?? null,
      captain: b?.captain?.name ?? '',
      createdAt: r.created_at as string,
      ageMinutes: minutesSince(r.created_at as string),
    };
  });
}

export async function listSuggestions(limit = 20): Promise<Suggestion[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('suggestion')
    .select('id,body,created_at,reply,replied_at,replied_by,dining_table:table_id (name)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id as string,
    body: s.body as string,
    tableName: (s.dining_table as unknown as RawRef)?.name ?? null,
    createdAt: s.created_at as string,
    reply: (s.reply as string) ?? '',
    repliedAt: (s.replied_at as string) ?? null,
    repliedBy: (s.replied_by as string) ?? '',
  }));
}

/* ── People ────────────────────────────────────────────────────────────── */

export async function listStaff(): Promise<StaffMember[]> {
  const restaurantId = await currentRestaurantId();
  const [staffRes, bills] = await Promise.all([
    db()
      .from('staff')
      .select('id,name,role,initials,mobile,email,active,on_duty,pin_hash,employee_code,designation,department,joined_on,last_working_day,gender,employment_type,monthly_salary,reports_to,shift,home_address,pan,uan,bank_last4,staff_table(dining_table:table_id(name))')
      .eq('restaurant_id', restaurantId)
      .is('removed_at', null)
      .order('name', { ascending: true }),
    listOpenBills(),
  ]);
  if (staffRes.error) throw staffRes.error;

  // Live tables are DERIVED from the open bills, never hand-typed, so the Staff screen and
  // Live orders can never disagree about who is on what.
  const live = new Map<string, Set<string>>();
  for (const b of bills) {
    for (const person of [b.captainId, b.waiterId]) {
      if (!person) continue;
      const set = live.get(person) ?? new Set<string>();
      for (const t of b.tables) set.add(t);
      live.set(person, set);
    }
  }

  return (staffRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    role: s.role as string,
    initials: (s.initials as string) ?? '',
    mobile: (s.mobile as string) ?? '',
    active: s.active as boolean,
    onDuty: s.on_duty as boolean,
    hasPin: !!s.pin_hash,
    standingTables: ((s.staff_table ?? []) as Array<{ dining_table: RawRef }>)
      .map((r) => r.dining_table?.name ?? '')
      .filter(Boolean)
      .sort(),
    liveTables: [...(live.get(s.id as string) ?? [])].sort(),
    employment: {
      employeeCode: (s.employee_code as string) ?? '',
      designation: (s.designation as string) ?? '',
      department: (s.department as string) ?? '',
      joinedOn: (s.joined_on as string | null) ?? '',
      lastWorkingDay: (s.last_working_day as string | null) ?? '',
      gender: (s.gender as string) ?? '',
      employmentType: (s.employment_type as string) ?? '',
      // Null and zero are different answers. Null is "nobody has recorded a salary"; zero would
      // be "this person is paid nothing", and the documents refuse both — but only one of them
      // is a fact somebody typed.
      monthlySalary: s.monthly_salary === null || s.monthly_salary === undefined ? null : Number(s.monthly_salary),
      reportsTo: (s.reports_to as string) ?? '',
      shift: (s.shift as string) ?? '',
      email: (s.email as string) ?? '',
      homeAddress: (s.home_address as string) ?? '',
      pan: (s.pan as string) ?? '',
      uan: (s.uan as string) ?? '',
      bankLast4: (s.bank_last4 as string) ?? '',
    },
  }));
}

export async function grantsFor(staffId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('staff_permission')
    .select('perm_key')
    .eq('staff_id', staffId)
    .eq('granted', true);
  if (error) throw error;
  return (data ?? []).map((r) => r.perm_key as string);
}

/* ── Ledgers ───────────────────────────────────────────────────────────── */

export async function listTips(): Promise<TipRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('tip')
    .select(
      'id,amount,settled_at,created_at,staff:staff_id(id,name),bill:bill_id(code,bill_table(dining_table:table_id(name)))'
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => {
    const bill = t.bill as unknown as { code?: string; bill_table?: Array<{ dining_table: RawRef }> } | null;
    const staff = t.staff as unknown as RawRef | null;
    return {
      id: t.id as string,
      billCode: bill?.code ?? '',
      tableName: bill?.bill_table?.[0]?.dining_table?.name ?? '',
      amount: Number(t.amount),
      staffId: staff?.id ?? null,
      staffName: staff?.name ?? 'Unattributed',
      settledAt: (t.settled_at as string) ?? null,
      createdAt: t.created_at as string,
    };
  });
}

export async function listExpenses(): Promise<ExpenseRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('expense')
    .select('id,spent_on,category,note,amount,entered_by')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('spent_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    spentOn: e.spent_on as string,
    category: e.category as string,
    note: (e.note as string) ?? '',
    amount: Number(e.amount),
    enteredBy: e.entered_by as string,
  }));
}

export async function listAudit(limit = 200): Promise<AuditRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('audit_entry')
    .select('id,at,action,detail,actor_label,confidential,bill:bill_id(code),dining_table:table_id(name)')
    .eq('restaurant_id', restaurantId)
    .order('at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((a) => {
    const bill = a.bill as unknown as { code?: string } | null;
    const table = a.dining_table as unknown as RawRef | null;
    const where = [bill?.code, table?.name].filter(Boolean).join(' · ');
    return {
      id: a.id as number,
      at: a.at as string,
      action: a.action as string,
      detail: (a.detail as string) ?? '',
      where: where || '—',
      by: a.actor_label as string,
      confidential: a.confidential as boolean,
    };
  });
}

export async function listPrinters(): Promise<PrinterRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('printer')
    .select('id,machine_id,name,purpose,station,paper_mm,routes,chefs,connection,address,port,online,enabled,last_seen_at')
    .eq('restaurant_id', restaurantId)
    .order('machine_id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    machineId: p.machine_id as string,
    name: p.name as string,
    purpose: p.purpose as string,
    station: (p.station as string) ?? 'Main Kitchen',
    paperMm: p.paper_mm as number,
    routes: (p.routes as string[]) ?? [],
    chefs: (p.chefs as string[]) ?? [],
    connection: (p.connection as string) ?? 'Ethernet',
    address: (p.address as string) ?? '',
    port: (p.port as number) ?? 9100,
    online: p.online as boolean,
    // A machine from before the print-setup migration has no opinion, and the safe reading of
    // no opinion is "the owner has not switched it off".
    enabled: (p.enabled as boolean | null) ?? true,
    lastSeenAt: (p.last_seen_at as string | null) ?? null,
  }));
}

/**
 * Tonight's print trail — every ticket the system tried, newest first.
 *
 * WHY IT IS CAPPED AND WHY THE CAP IS HERE
 *   The design's History section is a list somebody scans mid-service for the one ticket that
 *   did not come out. That is tonight's work, not the year's, and an uncapped read of a table
 *   that grows by one row per round would be the slowest query in the console by a wide margin.
 *   Capped in the query, not in the component: a component that fetches everything and renders
 *   the first eighty has already paid the cost.
 */
export async function listPrintJobs(limit = 80): Promise<PrintJobRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('print_job')
    .select('id,kind,status,attempts,is_reprint,requested_by,last_error,created_at,printer(name),kot(code,table_id),bill(code)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const tableIds = [
    ...new Set(
      (data ?? [])
        .map((j) => (j.kot as unknown as { table_id: string | null } | null)?.table_id)
        .filter((t): t is string => !!t)
    ),
  ];
  const names = new Map<string, string>();
  if (tableIds.length) {
    const { data: tables } = await db().from('dining_table').select('id,name').in('id', tableIds);
    (tables ?? []).forEach((t) => names.set(t.id as string, t.name as string));
  }

  return (data ?? []).map((j) => {
    const kot = j.kot as unknown as { code: string; table_id: string | null } | null;
    const bill = j.bill as unknown as { code: string } | null;
    return {
      id: j.id as string,
      kind: j.kind as string,
      // The reference a person would look for. A print job's own uuid appears on no ticket and
      // in no conversation anybody has ever had in a kitchen.
      reference: kot?.code ?? bill?.code ?? '—',
      table: kot?.table_id ? (names.get(kot.table_id) ?? '—') : '—',
      printerName: (j.printer as unknown as { name: string } | null)?.name ?? 'No machine',
      status: j.status as PrintJobRow['status'],
      attempts: (j.attempts as number) ?? 0,
      isReprint: (j.is_reprint as boolean) ?? false,
      requestedBy: (j.requested_by as string) ?? 'system',
      lastError: (j.last_error as string) ?? '',
      createdAt: j.created_at as string,
    };
  });
}

/* ── Settings ──────────────────────────────────────────────────────────── */

export async function readSettings<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('setting')
    .select('value')
    .eq('restaurant_id', restaurantId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  // A missing setting falls back to the shipped default rather than to undefined. A cleared
  // field must fall back, never blank the screen (Standard 2.1).
  return { ...fallback, ...((data?.value as T) ?? {}) };
}

export async function readAllSettings(): Promise<Record<string, Record<string, unknown>>> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db().from('setting').select('key,value').eq('restaurant_id', restaurantId);
  if (error) throw error;
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of data ?? []) out[row.key as string] = (row.value as Record<string, unknown>) ?? {};
  return out;
}

export async function readRestaurant() {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db().from('restaurant').select('*').eq('id', restaurantId).single();
  if (error) throw error;
  return data;
}

/**
 * The entrance queue — everyone still waiting, oldest first.
 *
 * WAITING means all three lifecycle stamps are null. Seated and removed rows are left behind
 * deliberately: they are what "how long did parties actually wait tonight" is computed from,
 * and a queue that deletes its finished rows can only ever answer about the present.
 */
export async function listWaitlist(): Promise<WaitlistRow[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('waitlist_entry')
    .select('id,token,pair,code,party_size,phone,source,joined_at,notified_at')
    .eq('restaurant_id', restaurantId)
    .is('seated_at', null)
    .is('removed_at', null)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  const now = Date.now();
  return (data ?? []).map((w) => ({
    id: w.id as string,
    token: w.token as string,
    pair: (w.pair as string) ?? '',
    code: w.code as string,
    partySize: w.party_size as number,
    phone: (w.phone as string) ?? '',
    source: w.source as 'scanned' | 'walk_in',
    // The raw stamp. Formatting belongs to the view that renders it — owner-view, staff-view
    // and guest-view each hold their own timeLabel, and a fourth copy here would be the one
    // that drifts.
    joinedAtIso: w.joined_at as string,
    // Minutes, computed on the server so every surface agrees about how long this party has
    // been standing there — a client clock that is four minutes fast turns a calm queue into
    // an angry one.
    waitedMinutes: Math.max(0, Math.round((now - new Date(w.joined_at as string).getTime()) / 60000)),
    notified: w.notified_at !== null,
  }));
}

/**
 * One waiting party's own view of the queue, by the row id its phone holds in a cookie.
 *
 * WHY POSITION AND THE ESTIMATE ARE COMPUTED HERE
 *   "2nd in line · ~12 minutes" is the whole of pattern 6b, and both numbers have to agree with
 *   what the host sees or the party at the door is arguing with a screen. Counting ahead of this
 *   row on the server is one answer from one clock; counting in the browser is one answer per
 *   device.
 *
 * THE ESTIMATE IS DELIBERATELY COARSE AND DELIBERATELY NOT A PROMISE
 *   Parties ahead x a per-party turn, rounded to five minutes. The design writes it as "~12
 *   minutes" with a tilde for the same reason: a precise-looking wait is a promise the kitchen
 *   never made, and a party told "12" at 8:31 is angry at 8:44 in a way a party told "about ten
 *   or fifteen" is not.
 */
export async function readQueueEntry(entryId: string): Promise<QueueSelfView | null> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('waitlist_entry')
    .select('id,token,code,party_size,joined_at,notified_at,seated_at,removed_at,dining_table:seated_table_id(name)')
    .eq('id', entryId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const joinedAtIso = data.joined_at as string;
  const seated = data.seated_at !== null;
  const removed = data.removed_at !== null;

  // Everyone still waiting who joined before this party. Seated and removed rows are excluded,
  // so the number falls as the room turns over rather than counting people already at a table.
  let ahead = 0;
  if (!seated && !removed) {
    const { count } = await db()
      .from('waitlist_entry')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .is('seated_at', null)
      .is('removed_at', null)
      .lt('joined_at', joinedAtIso);
    ahead = count ?? 0;
  }

  const table = data.dining_table as unknown as { name?: string } | null;
  return {
    id: data.id as string,
    token: data.token as string,
    code: data.code as string,
    partySize: data.party_size as number,
    joinedAtIso,
    ahead,
    position: ahead + 1,
    estimateMinutes: Math.max(5, Math.round((ahead * MINUTES_PER_PARTY) / 5) * 5),
    state: removed ? 'left' : seated ? 'seated' : data.notified_at !== null ? 'ready' : 'waiting',
    tableName: table?.name ?? '',
  };
}

/**
 * The turn estimate, in minutes per party ahead. A constant because the honest alternative —
 * measuring tonight's actual seat-to-seat times — needs a night of finished rows to average and
 * would read as authoritative long before it was. Named here so the day it becomes a measurement
 * there is exactly one thing to replace.
 */
const MINUTES_PER_PARTY = 6;

/**
 * Replies the owner has written to THIS table's suggestions.
 *
 * WHY THE GUEST SEES THEM AT ALL
 *   `suggestion` has carried `reply`, `replied_at` and `replied_by` since the schema was
 *   written, and the owner's Dashboard has been writing into them. Nothing ever read them back
 *   to the phone that asked. So the loop the design draws — 4f, "The owner replies, and the
 *   guest sees they were heard" — ended in a column. A reply nobody receives is a note the
 *   restaurant wrote to itself.
 *
 * SCOPED TO THE TABLE, NEWEST FIRST, AND ONLY WHAT HAS BEEN ANSWERED. An unanswered suggestion
 * is not shown back to the guest: they wrote it, they know.
 */
export async function listGuestReplies(tableId: string): Promise<GuestReply[]> {
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('suggestion')
    .select('id,body,reply,replied_at,replied_by')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .not('replied_at', 'is', null)
    .order('replied_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    body: r.body as string,
    reply: r.reply as string,
    repliedBy: (r.replied_by as string) ?? '',
    repliedAtIso: r.replied_at as string,
  }));
}
