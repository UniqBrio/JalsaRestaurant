import 'server-only';
import { dateLabelIn, timeLabelIn } from '@/lib/restaurant-time';
import { KOT_SOURCE_LABEL } from '@/lib/status';
import { db } from '@/lib/supabase/server';
import type { Bridge } from '@/lib/bridge-auth';
import { invoiceTicketData } from '@/lib/invoice';
import { getBill } from './queries';
import type { RoutablePrinter, TicketSide } from '@/lib/print-routing';
import type { FontSize, PaperWidth, TemplateConfig, TicketKind, TicketLine } from '@/lib/print-template';
import { originOf, type LineageJob } from '@/lib/redirect-lineage';
import { TEST_TICKET_ITEMS, testBill, testTicketHeader } from '@/lib/test-ticket';
import { composeTicket, type ComposeItem, type ComposeResult } from '@/lib/ticket-compose';

/**
 * bridge-payload — the ticket a claimed job is asking for, rendered server-side.
 *
 * THE DECISION THIS FILE IMPLEMENTS
 *   The bridge receives `TicketLine[]`, not bytes and not order data. Bytes would move the
 *   encoder onto a kitchen PC and make the golden-byte tests a statement about a machine nobody
 *   can see; order data would hand a bridge the bill, the guest and the menu to render a ticket
 *   from, which is a far larger grant than the job it is carrying. Lines are exactly what the
 *   template contract already produces and exactly what `escpos.ts` already consumes.
 *
 * WHY THE RENDER HAPPENS ON CLAIM AND NOT IN `list`
 *   `list` is polled every few seconds by every bridge in the building. Composing every waiting
 *   ticket on every poll would render most of them repeatedly and never print them. A claim
 *   happens once per job, by the one bridge that is going to print it.
 *
 * WHEN IT CANNOT RENDER
 *   It returns the reason instead of throwing, and the ROUTE hands that reason back with the
 *   claimed job. The bridge then reports the job failed, with that sentence, through the ordinary
 *   report path — so an unrenderable ticket ends up in front of a person on the history screen
 *   rather than as a job stuck in `processing` until the sweeper notices.
 */

export interface TicketPayload {
  lines: TicketLine[];
  width: PaperWidth;
  itemCount: number;
  /** The font the lines were laid out in, so the bridge can select it (item 7, 25-Sep-2026). */
  font: FontSize;
}

export type PayloadResult = { ok: true; payload: TicketPayload } | { ok: false; blocked: string };

/**
 * `print_job.kind` is 'KOT' | 'Invoice' | 'Test'; the template speaks 'kot' | 'bill'.
 *
 * A test print is composed with the KOT template on purpose: it is the template a kitchen machine
 * is configured with, and a test that exercised a different one would prove the wrong thing.
 */
const kindOf = (kind: string): TicketKind => (kind === 'Invoice' ? 'bill' : 'kot');

const TEST_KIND = 'Test';
/** A test print of the BILL (item 9, 25-Sep-2026): the sample invoice, laid out as a real one. */
const TEST_BILL_KIND = 'TestBill';

/**
 * Every machine of one purpose, ordered by `machine_id`.
 *
 * RESTATED, NOT IMPORTED — the same decision `bridge-mutations.ts` records for
 * `syncKotFromJobs`. The bridge path must not be able to reach into `mutations.ts`, because one
 * refactor later it would find `queuePrint` there. The ORDER BY is the load-bearing part
 * (`print-routing.ts` breaks ties on `machineId` and can only do that if handed them in that
 * order) and a rung asserts both copies still carry it.
 */
async function routableFor(restaurantId: string, purpose: string): Promise<RoutablePrinter[]> {
  const { data } = await db()
    .from('printer')
    .select('id,machine_id,name,purpose,station,routes,online,enabled')
    .eq('restaurant_id', restaurantId)
    .eq('purpose', purpose)
    .order('machine_id', { ascending: true });

  return (data ?? []).map((p) => ({
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

/** One settings key, scoped to the BRIDGE's restaurant rather than to the process-wide slug. */
async function settingsFor<T extends Record<string, unknown>>(
  restaurantId: string,
  key: string,
  fallback: T
): Promise<T> {
  const { data } = await db()
    .from('setting')
    .select('value')
    .eq('restaurant_id', restaurantId)
    .eq('key', key)
    .maybeSingle();
  return { ...fallback, ...((data?.value as T) ?? {}) };
}

// Printed on paper in the restaurant, so read on the restaurant's clock (RC-016): the server's
// host is UTC, which printed a 00:20 ticket as 6:50 pm the previous day.
const dateOf = (iso: string): string => dateLabelIn(iso);
const timeOf = (iso: string): string => timeLabelIn(iso);

/**
 * The lines for one job.
 *
 * Restaurant-scoped at every read: a bridge token carries one `restaurantId` and nothing here
 * widens it.
 */
export async function ticketPayloadFor(input: { bridge: Bridge; jobId: string }): Promise<PayloadResult> {
  const restaurantId = input.bridge.restaurantId;

  const { data: job } = await db()
    .from('print_job')
    .select(JOB_FIELDS)
    .eq('id', input.jobId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (!job) return { ok: false, blocked: 'That job does not exist for this restaurant.' };

  const kind = kindOf(job.kind as string);

  // WHERE IT PRINTS IS THIS JOB. WHAT IS ON IT IS THE ORIGIN'S.
  //   "Print elsewhere" inserts a NEW job against a chosen machine, carrying that machine's
  //   station. Composed from its own identity it matched whichever half of the round the chosen
  //   machine happens to claim — so a tandoor round redirected to the main kitchen composed the
  //   main kitchen's dishes, printed them a second time, and never delivered the tandoor's.
  //   The lineage is followed to its root and the root's identity decides the contents.
  const origin = await originOf(asLineage(job as unknown as JobRow), readJob(restaurantId));
  if (!origin.ok) return { ok: false, blocked: origin.blocked };

  // The paper is a property of the ASSIGNED machine. A shared template cannot know it.
  const { data: printer } = await db()
    .from('printer')
    .select('paper_mm')
    .eq('id', job.printer_id as string)
    .maybeSingle();
  const width: PaperWidth = (printer?.paper_mm as number) === 58 ? '58' : '80';

  if ((job.kind as string) === TEST_KIND) return testPayload(job as unknown as JobRow, restaurantId, width);
  if ((job.kind as string) === TEST_BILL_KIND) return testBillPayload(job as unknown as JobRow, restaurantId, width);

  const [restaurant, print, tax, engagement, printers] = await Promise.all([
    db().from('restaurant').select('display_name,legal_name,address,phone').eq('id', restaurantId).maybeSingle(),
    settingsFor(restaurantId, 'print', { splitByFoodType: false } as Record<string, unknown>),
    settingsFor(restaurantId, 'tax', { gstin: '', rate: 5 } as { gstin: string; rate: number }),
    settingsFor(restaurantId, 'engagement', { upiId: '' } as { upiId: string }),
    routableFor(restaurantId, job.kind as string),
  ]);

  // THE INVOICE IS THE SHARED ONE (item 8, 25-Sep-2026). Composed from the same `Bill` the owner's
  // screen reads and by the same `invoiceTicketData` the preview and the browser copy use - which
  // also stops the paper counting the lines of a CANCELLED round that the screen's total leaves
  // out, and dates it at settlement rather than when the table sat down.
  if (kind === 'bill') {
    const bill = await getBill(job.bill_id as string);
    if (!bill) return { ok: false, blocked: 'The bill this ticket belongs to no longer exists.' };
    const { items, totals, upiId, station: _station, ...header } = invoiceTicketData(bill, {
      name: (restaurant.data?.display_name as string) || (restaurant.data?.legal_name as string) || '',
      address: (restaurant.data?.address as string) ?? '',
      phone: (restaurant.data?.phone as string) ?? '',
      gstin: tax.gstin,
      upiId: engagement.upiId,
    });
    void _station;
    const invoice = composeTicket({
      job: {
        id: job.id as string,
        kind,
        printerId: origin.origin.printerId,
        station: origin.origin.station,
        foodSide: origin.origin.foodSide,
        isReprint: (job.is_reprint as boolean) ?? false,
      },
      width,
      template: ((print.bill as Partial<TemplateConfig> | undefined) ?? {}) as Partial<TemplateConfig>,
      printers,
      splitByFoodType: false,
      header,
      items,
      ...(totals ? { totals } : {}),
      ...(upiId ? { upiId } : {}),
    });
    if (!invoice.ok) return { ok: false, blocked: invoice.blocked };
    return { ok: true, payload: { lines: invoice.lines, width: invoice.width, itemCount: invoice.itemCount, font: invoice.font } };
  }

  const { data: bill } = await db()
    .from('bill')
    .select('code,created_at,host_table_id')
    .eq('id', job.bill_id as string)
    .maybeSingle();

  const rows = await lineRows({ kind, kotId: job.kot_id as string | null, billId: job.bill_id as string });
  if ('blocked' in rows) return { ok: false, blocked: rows.blocked };

  const table = await tableName(rows.tableId ?? (bill?.host_table_id as string | null));
  const kotRow = rows.kot;
  const at = (kotRow?.created_at as string | undefined) ?? (bill?.created_at as string) ?? new Date(0).toISOString();

  const result: ComposeResult = composeTicket({
    job: {
      id: job.id as string,
      kind,
      // The origin's, for a redirect; this job's own otherwise (the walk returns it unchanged
      // when there is no lineage to follow).
      printerId: origin.origin.printerId,
      station: origin.origin.station,
      foodSide: origin.origin.foodSide,
      // NOT the origin's. Whether THIS piece of paper is a reprint is a fact about this job.
      isReprint: (job.is_reprint as boolean) ?? false,
    },
    width,
    template: ((print[kind] as Partial<TemplateConfig> | undefined) ?? {}) as Partial<TemplateConfig>,
    printers,
    splitByFoodType: print.splitByFoodType === true,
    header: {
      restaurant: ((restaurant.data?.display_name as string) ?? 'Jalsa').toUpperCase(),
      branch: (restaurant.data?.address as string) ?? '',
      phone: (restaurant.data?.phone as string) ?? '',
      gstin: tax.gstin || '—',
      kotCode: (kotRow?.code as string | undefined) ?? '',
      roundCode: rows.roundCode,
      billCode: (bill?.code as string) ?? '',
      table,
      customer: '',
      captain: (kotRow?.placed_by_label as string | undefined) ?? '',
      date: dateOf(at),
      time: timeOf(at),
      // In words, from the stored column (C3): "Captain", "Owner", "Guest phone" - not the enum.
      source: kotRow?.source ? (KOT_SOURCE_LABEL[kotRow.source as keyof typeof KOT_SOURCE_LABEL] ?? '') : '',
      note: (kotRow?.note as string | undefined) ?? '',
    },
    items: rows.items,
  });

  if (!result.ok) return { ok: false, blocked: result.blocked };
  return { ok: true, payload: { lines: result.lines, width: result.width, itemCount: result.itemCount, font: result.font } };
}

/** Every field composition needs off a job row, named once so the walk and the read agree. */
const JOB_FIELDS =
  'id,kind,printer_id,station,is_reprint,kot_id,bill_id,food_side,redirected_from_job_id,requested_by';

interface JobRow {
  id: string;
  kind: string;
  printer_id: string | null;
  station: string | null;
  is_reprint: boolean | null;
  kot_id: string | null;
  bill_id: string;
  food_side: string | null;
  redirected_from_job_id: string | null;
  requested_by?: string;
}

/** `print_job.food_side`, narrowed. An unrecognised value is treated as the un-split reading. */
const sideOf = (raw: string | null): TicketSide =>
  raw === 'veg_side' || raw === 'non_veg' ? raw : 'all';

const asLineage = (row: JobRow): LineageJob => ({
  id: row.id,
  redirectedFromJobId: row.redirected_from_job_id,
  printerId: row.printer_id,
  station: row.station ?? '',
  foodSide: sideOf(row.food_side),
});

/** The database half of the lineage walk. The rule itself is in `redirect-lineage.ts`. */
const readJob = (restaurantId: string) => async (id: string): Promise<LineageJob | null> => {
  const { data } = await db()
    .from('print_job')
    .select(JOB_FIELDS)
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  return data ? asLineage(data as unknown as JobRow) : null;
};

interface KotRow {
  code: string;
  note: string;
  source: string;
  placed_by_label: string;
  created_at: string;
  table_id: string;
}

/**
 * The round's lines, and the round's own facts.
 *
 * A KOT reads its own items. A bill reads every uncancelled line on the bill, across every round,
 * because that is what a guest is being asked to pay for.
 */
async function lineRows(input: {
  kind: TicketKind;
  kotId: string | null;
  billId: string;
}): Promise<
  | { items: ComposeItem[]; kot: KotRow | null; tableId: string | null; roundCode: string }
  | { blocked: string }
> {
  if (input.kind === 'kot') {
    if (!input.kotId) return { blocked: 'This KOT job is not linked to a round, so it has no items.' };

    const { data: kot } = await db()
      .from('kot')
      .select('id,code,note,source,placed_by_label,created_at,table_id')
      .eq('id', input.kotId)
      .maybeSingle();
    if (!kot) return { blocked: 'The round this ticket belongs to no longer exists.' };

    // Which round of the evening this is. Ordinal, not an identifier - the kitchen says
    // "round two", and nothing downstream parses it.
    const { data: siblings } = await db()
      .from('kot')
      .select('id,created_at')
      .eq('bill_id', input.billId)
      .order('created_at', { ascending: true });
    const index = (siblings ?? []).findIndex((k) => k.id === input.kotId);

    return {
      items: await itemsOf([input.kotId]),
      kot: kot as unknown as KotRow,
      tableId: kot.table_id as string,
      roundCode: `R-${index >= 0 ? index + 1 : 1}`,
    };
  }

  const { data: kots } = await db().from('kot').select('id').eq('bill_id', input.billId);
  const ids = (kots ?? []).map((k) => k.id as string);
  return { items: ids.length ? await itemsOf(ids) : [], kot: null, tableId: null, roundCode: '' };
}

/**
 * Uncancelled lines, as snapshots.
 *
 * Cancelled lines are left out for the same reason `kotPrintableItems` leaves them out: a ticket
 * must not send the kitchen back to a station for a dish nobody is cooking.
 */
async function itemsOf(kotIds: readonly string[]): Promise<ComposeItem[]> {
  const { data } = await db()
    .from('kot_item')
    .select('name,qty,unit_price,food_type,menu_category_name,cancelled_at,created_at,line_seq')
    .in('kot_id', kotIds as string[])
    // Deterministic, so the same round always composes the same lines and therefore the same
    // bytes. Without it the paper's item order is whatever PostgREST returned this time.
    // `created_at` alone TIES for every line of a round (one insert, one now()), so the cart
    // order is `line_seq` (item 3, 25-Sep-2026, migration 20260925090000).
    .order('created_at', { ascending: true })
    .order('line_seq', { ascending: true });

  return (data ?? [])
    .filter((l) => l.cancelled_at === null)
    .map((l) => ({
      name: l.name as string,
      qty: (l.qty as number) ?? 1,
      foodType: l.food_type as ComposeItem['foodType'],
      rate: Number(l.unit_price ?? 0),
      category: (l.menu_category_name as string) ?? '',
      instruction: '',
    }));
}

async function tableName(tableId: string | null): Promise<string> {
  if (!tableId) return '';
  const { data } = await db().from('dining_table').select('name').eq('id', tableId).maybeSingle();
  return (data?.name as string) ?? '';
}


/**
 * A test print, composed through exactly the path a real ticket takes.
 *
 * NOT A SECOND IMPLEMENTATION. It calls the same `composeTicket`, which calls the same
 * `buildTicket`, and the bridge encodes it with the same `escpos.ts` and carries it with the same
 * transport. What differs is the payload and nothing else — see `test-ticket.ts`.
 *
 * The printers list holds ONLY the assigned machine, with no routes. Every item then falls to it
 * through the ordinary "nobody claims this" branch, so a test print needs no routing configuration
 * to exist and cannot be sent astray by one that does.
 */
async function testPayload(job: JobRow, restaurantId: string, width: PaperWidth): Promise<PayloadResult> {
  const { data: printer } = await db()
    .from('printer')
    .select('id,machine_id,name,purpose,station,enabled')
    .eq('id', job.printer_id as string)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (!printer) {
    return { ok: false, blocked: 'The machine this test print was sent to no longer exists.' };
  }

  const { data: restaurant } = await db()
    .from('restaurant')
    .select('display_name,address,phone')
    .eq('id', restaurantId)
    .maybeSingle();

  const print = await settingsFor(restaurantId, 'print', {} as Record<string, unknown>);
  const at = new Date().toISOString();

  const result = composeTicket({
    job: {
      id: job.id,
      kind: 'kot',
      printerId: job.printer_id,
      station: job.station ?? '',
      foodSide: 'all',
      isReprint: false,
    },
    width,
    template: ((print.kot as Partial<TemplateConfig> | undefined) ?? {}) as Partial<TemplateConfig>,
    printers: [
      {
        id: printer.id as string,
        machineId: printer.machine_id as string,
        name: printer.name as string,
        purpose: printer.purpose as string,
        station: (printer.station as string) ?? '',
        routes: [],
        online: false,
        enabled: true,
      },
    ],
    splitByFoodType: false,
    header: testTicketHeader({
      restaurant: ((restaurant?.display_name as string) ?? 'Jalsa').toUpperCase(),
      branch: (restaurant?.address as string) ?? '',
      phone: (restaurant?.phone as string) ?? '',
      machineName: printer.name as string,
      machineId: printer.machine_id as string,
      date: dateOf(at),
      time: timeOf(at),
      actor: (job.requested_by as string | undefined) ?? 'the owner console',
    }),
    items: TEST_TICKET_ITEMS,
  });

  if (!result.ok) return { ok: false, blocked: result.blocked };
  return { ok: true, payload: { lines: result.lines, width: result.width, itemCount: result.itemCount, font: result.font } };
}

/**
 * A test print of the bill: `testBill()` through the shared invoice, on the bill template, at the
 * width of the machine it was sent to. The same `composeTicket` → `buildBill` → `escpos.ts` path
 * as a guest's invoice; only the content is a sample.
 */
async function testBillPayload(job: JobRow, restaurantId: string, width: PaperWidth): Promise<PayloadResult> {
  const { data: printer } = await db()
    .from('printer')
    .select('id')
    .eq('id', job.printer_id as string)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (!printer) return { ok: false, blocked: 'The machine this test print was sent to no longer exists.' };

  const [restaurant, print, tax, engagement] = await Promise.all([
    db().from('restaurant').select('display_name,legal_name,address,phone').eq('id', restaurantId).maybeSingle(),
    settingsFor(restaurantId, 'print', {} as Record<string, unknown>),
    settingsFor(restaurantId, 'tax', { gstin: '', rate: 5 } as { gstin: string; rate: number }),
    settingsFor(restaurantId, 'engagement', { upiId: '' } as { upiId: string }),
  ]);
  const { items, totals, upiId, station: _station, ...header } = invoiceTicketData(testBill(Number(tax.rate) || 5), {
    name: (restaurant.data?.display_name as string) || (restaurant.data?.legal_name as string) || '',
    address: (restaurant.data?.address as string) ?? '',
    phone: (restaurant.data?.phone as string) ?? '',
    gstin: tax.gstin,
    upiId: engagement.upiId,
  });
  void _station;
  const result = composeTicket({
    job: { id: job.id, kind: 'bill', printerId: job.printer_id, station: job.station ?? '', foodSide: 'all', isReprint: false },
    width,
    template: ((print.bill as Partial<TemplateConfig> | undefined) ?? {}) as Partial<TemplateConfig>,
    printers: [],
    splitByFoodType: false,
    header,
    items,
    ...(totals ? { totals } : {}),
    ...(upiId ? { upiId } : {}),
  });
  if (!result.ok) return { ok: false, blocked: result.blocked };
  return { ok: true, payload: { lines: result.lines, width: result.width, itemCount: result.itemCount, font: result.font } };
}
