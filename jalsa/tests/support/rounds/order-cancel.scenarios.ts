/**
 * Cancel an order and free its table, and a takeaway's photo (07-Oct-2026) - bundled and run by
 * tests/unit/order-cancel.unit.spec.ts. Calls the REAL `cancelOrderAndFreeTable`, `closeBill`,
 * `requestPayment` and `setTakeawayPhoto` against fake-supabase and reports every read and write.
 */
import { cancelOrderAndFreeTable, closeBill, requestPayment } from '@/lib/db/mutations';
import { setTakeawayPhoto } from '@/lib/db/owner-mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const iso = '2026-10-07T13:00:00.000Z';
const BILL = '11111111-1111-4111-8111-111111111111';
const TABLE = '22222222-2222-4222-8222-222222222222';
const OLD_PHOTO = `/api/media/takeaway/${BILL}/33333333-3333-4333-8333-333333333333.jpg`;

interface World {
  status?: string;
  orderType?: 'dine_in' | 'takeaway';
  /** What cancel_bill_and_free answers. */
  outcome?: string;
  /** Rows the closing / photo update reports changing. */
  updated?: number;
  /** The status a re-read finds after a write changed nothing. */
  reread?: string;
  photo?: string;
  uploadFails?: boolean;
  /** The bill row is missing (another restaurant's, or none). */
  noBill?: boolean;
}

type Log = Array<{ table: string; op: string; body: unknown; cols: string; filters: string[] }>;

const billRow = (w: World, status = w.status ?? 'open') => ({
  id: BILL,
  code: 'B-0412',
  status,
  group_code: null,
  guests: 3,
  occasion_type: null,
  occasion_name: null,
  occasion_source: null,
  discount_pct: 10,
  discount_amount: 0,
  tax_rate: 5,
  payment_mode: null,
  payment_reference: '',
  payment_requested_at: null,
  closed_at: null,
  opened_at: iso,
  order_type: w.orderType ?? 'dine_in',
  packaging_charge: 0,
  photo_url: w.photo ?? '',
  host_table: { name: 'T12' },
  captain: null,
  waiter: null,
  closed_by: null,
  discount_by: null,
  bill_table: w.orderType === 'takeaway' ? [] : [{ released_at: null, dining_table: { id: TABLE, name: 'T12' } }],
  tip: [{ amount: 50 }],
  guest_favourite: [],
  version: 7,
  kot: [
    {
      id: 'k1',
      code: 'KOT-1',
      status: 'preparing',
      source: 'captain',
      placed_by_label: 'Ravi',
      note: '',
      print_status: 'printed',
      print_attempts: 1,
      reprint_count: 0,
      created_at: iso,
      started_at: iso,
      ready_at: null,
      picked_up_at: null,
      served_at: null,
      dining_table: { name: 'T12' },
      kot_item: [
        { id: 'i1', name: 'Chicken 65', unit_price: 240, qty: 2, food_type: 'non_veg', food_type_name: '', qty_before: null, cancelled_at: null, cancel_reason: '', menu_category_name: '', menu_parent_category_name: '', line_seq: 1 },
      ],
      print_job: [],
    },
  ],
});

function responder(w: World, log: Log) {
  let reads = 0;
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    log.push({ table: q.table, op: q.op, body: q.body, cols: q.cols, filters: q.filters.map(([k, c, v]) => `${k}:${c}=${JSON.stringify(v)}`) });
    if (q.op === 'rpc') return (w.outcome ?? 'cancelled') as unknown as Record<string, unknown>;
    if (q.op === 'upload') return w.uploadFails ? { __error: 'storage unavailable' } : [{ path: q.cols }];
    if (q.op === 'remove') return [];
    if (q.table === 'bill') {
      if (w.noBill) return [];
      if (q.op === 'update') return Array.from({ length: w.updated ?? 1 }, () => ({ id: BILL }));
      reads += 1;
      return [billRow(w, reads > 1 && w.reread ? w.reread : w.status)];
    }
    return [];
  };
}

const actor = (grants: string[]) => ({ staffId: 'st1', label: 'Ravi', grants: { can: (k: string) => grants.includes(k) } });
const BOTH = ['tables.free', 'orders.cancel_after'];

async function run(name: string, w: World, call: () => Promise<unknown>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const log: Log = [];
  db.respond = responder(w, log);
  try {
    return { name, out: (await call()) ?? null, threw: null, log };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err), log };
  }
}

const cancel = (grants: string[], extra: { reason?: string; note?: string; billId?: string; rounds?: number } = {}) => () =>
  cancelOrderAndFreeTable({
    billId: extra.billId ?? BILL,
    tableId: TABLE,
    reason: extra.reason ?? 'Customer emergency',
    note: extra.note ?? '',
    ...(extra.rounds !== undefined ? { expectedRounds: extra.rounds } : {}),
    actor: actor(grants),
  });

const B64_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
const B64_PDF = Buffer.from('%PDF-1.4 not an image').toString('base64');
const photo = (grants: string[], base64: string | null) => () => setTakeawayPhoto({ billId: BILL, base64, actor: actor(grants) });

const results = [
  await run('cancel without tables.free', {}, cancel(['orders.cancel_after'])),
  await run('cancel without orders.cancel_after', {}, cancel(['tables.free'])),
  await run('cancel', {}, cancel(BOTH)),
  await run('cancel, no reason', {}, cancel(BOTH, { reason: '' })),
  await run('cancel, Other with a note', {}, cancel(BOTH, { reason: 'Other', note: '  Guest felt unwell  ' })),
  await run('cancel, Other without a note', {}, cancel(BOTH, { reason: 'Other' })),
  await run('cancel, a reason not on the list', {}, cancel(BOTH, { reason: 'DROP TABLE bill' })),
  await run('cancel, not a uuid', {}, cancel(BOTH, { billId: "1' or '1'='1" })),
  await run('cancel, another restaurant', { noBill: true }, cancel(BOTH)),
  await run('cancel, already void when read', { status: 'void' }, cancel(BOTH)),
  await run('cancel, already closed when read', { status: 'closed' }, cancel(BOTH)),
  await run('cancel, a takeaway', { orderType: 'takeaway' }, cancel(BOTH)),
  await run('cancel, the database says gone', { outcome: 'gone' }, cancel(BOTH)),
  await run('cancel, the database says changed', { outcome: 'changed' }, cancel(BOTH)),
  await run('cancel, the database says not_here', { outcome: 'not_here' }, cancel(BOTH)),
  await run('close a cancelled order', { status: 'void' }, () => closeBill({ billId: BILL, mode: 'Cash', actor: actor(['bill.record_payment']) })),
  await run('close, cancelled in between', { updated: 0, reread: 'void' }, () =>
    closeBill({ billId: BILL, mode: 'Cash', actor: actor(['bill.record_payment']) })
  ),
  await run('close, closed by someone else in between', { updated: 0, reread: 'closed' }, () =>
    closeBill({ billId: BILL, mode: 'Cash', actor: actor(['bill.record_payment']) })
  ),
  await run('guest asks to pay on a cancelled order', { status: 'void' }, () => requestPayment(BILL)),
  await run('guest asks to pay on an open order', {}, () => requestPayment(BILL)),
  await run('cancel, with the rounds the person saw', {}, cancel(BOTH, { rounds: 1 })),
  await run('guest asks to pay, cancelled in between', { updated: 0 }, () => requestPayment(BILL)),

  await run('photo without orders.create', { orderType: 'takeaway' }, photo([], B64_JPEG)),
  await run('photo on a dine-in order', {}, photo(['orders.create'], B64_JPEG)),
  await run('photo on a settled takeaway', { orderType: 'takeaway', status: 'closed' }, photo(['orders.create'], B64_JPEG)),
  await run('photo on another restaurant', { orderType: 'takeaway', noBill: true }, photo(['orders.create'], B64_JPEG)),
  await run('photo that is a pdf', { orderType: 'takeaway' }, photo(['orders.create'], B64_PDF)),
  await run('photo over 1 MB', { orderType: 'takeaway' }, photo(['orders.create'], 'A'.repeat(1_500_000))),
  await run('photo added', { orderType: 'takeaway' }, photo(['orders.create'], B64_JPEG)),
  await run('photo added after asking to pay', { orderType: 'takeaway', status: 'payment_requested' }, photo(['orders.create'], B64_JPEG)),
  await run('photo replaced', { orderType: 'takeaway', photo: OLD_PHOTO }, photo(['orders.create'], B64_JPEG)),
  await run('photo removed', { orderType: 'takeaway', photo: OLD_PHOTO }, photo(['orders.create'], null)),
  await run('photo storage fails', { orderType: 'takeaway', uploadFails: true }, photo(['orders.create'], B64_JPEG)),
  await run('photo changed by someone else in between', { orderType: 'takeaway', updated: 0 }, photo(['orders.create'], B64_JPEG)),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
