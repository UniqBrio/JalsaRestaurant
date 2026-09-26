/**
 * Write-path round scenarios — bundled and run by tests/unit/write-rounds.unit.spec.ts.
 * Calls the REAL guest round route and the REAL floor read against fake-supabase and reports how
 * many database rounds each waited for, and which reads it repeated.
 */
import { POST as placeRoundRoute } from '@/app/api/guest/round/route';
import { POST as ownerAction } from '@/app/api/owner/action/route';
import { listFloor } from '@/lib/db/queries';
import { buildOwnerPayload } from '@/lib/db/owner-view';
import { buildStaffPayload } from '@/lib/db/staff-view';
import { fakeDb, sequentialRounds, type FakeQuery, type FakeCall } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { guestToken?: string | null; staff?: unknown } };
const OWNER = {
  staffId: 'ow1',
  name: 'Meena',
  role: 'Owner / Admin',
  initials: 'ME',
  provisional: false,
  issuedAt: 0,
};
const OWNER_GRANTS = ['orders.view', 'set.copy', 'staff.view'];
const signedIn = { ...OWNER, grants: { list: () => OWNER_GRANTS, can: (k: string) => OWNER_GRANTS.includes(k) } };
const iso = new Date().toISOString();

const bill = (id: string) => ({
  id,
  code: 'JB-1041',
  status: 'open',
  group_code: null,
  guests: 2,
  occasion_type: null,
  occasion_name: null,
  occasion_source: null,
  discount_pct: 0,
  discount_amount: 0,
  tax_rate: 5,
  payment_mode: null,
  payment_reference: null,
  payment_requested_at: null,
  closed_at: null,
  opened_at: iso,
  host_table: { name: 'A5' },
  captain: null,
  waiter: null,
  closed_by: null,
  discount_by: null,
  bill_table: [{ released_at: null, dining_table: { id: 't1', name: 'A5' } }],
  tip: [],
  kot: [],
});

interface World {
  /** The table already has its bill (a second round) rather than needing one opened. */
  openBill: boolean;
  /** Reads and writes the database answers with `{ error }` (the client's way of failing). */
  fail?: { clearCart?: boolean; grants?: boolean; queue?: boolean };
  /** This phone has no session (its cookie matches nothing). */
  noSession?: boolean;
}

function responder(world: World) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    const has = (kind: string, col: string) => q.filters.some(([k, c]) => k === kind && c === col);
    if (q.op === 'rpc') return 'JB-1041' as unknown as Record<string, unknown>;
    const idFilter = q.filters.find(([k, c]) => k === 'eq' && c === 'id')?.[2];
    const staffFilter = q.filters.find(([k, c]) => k === 'eq' && c === 'staff_id')?.[2];
    switch (q.table) {
      case 'staff':
        return idFilter ? [{ id: idFilter, active: true, removed_at: null, pin_provisional: false }] : [];
      case 'staff_permission':
        if (!staffFilter && world.fail?.grants) return { __error: 'grants read failed' };
        return staffFilter
          ? OWNER_GRANTS.map((perm_key) => ({ perm_key }))
          : OWNER_GRANTS.map((perm_key) => ({ staff_id: 'ow1', perm_key, staff: { restaurant_id: 'r1' } }));
      case 'guest_session':
        if (q.op !== 'select') return [];
        if (world.noSession && q.cols.includes('guest_cart_line')) return [];
        return [
          {
            id: 's1',
            table_id: 't1',
            bill_id: world.openBill ? 'b1' : null,
            heard_about: '',
            guest_cart_line: [{ menu_item_id: 'm1', qty: 2 }],
            // The floor's "phones on an open bill" read embeds the bill it is filtered on.
            bill: { status: 'open' },
          },
        ];
      case 'guest_cart_line':
        if (q.op === 'delete' && world.fail?.clearCart) return { __error: 'cart clear failed' };
        if (q.op !== 'select') return [];
        return q.cols.includes('session')
          ? [{ session_id: 's1', session: { id: 's1', table_id: 't1', bill_id: 'b1', restaurant_id: 'r1' } }]
          : [{ menu_item_id: 'm1', qty: 2 }];
      case 'setting':
        if (world.fail?.queue && q.filters.some(([k, c, v]) => k === 'eq' && c === 'key' && v === 'queue'))
          return { __error: 'queue read failed' };
        return q.cols.includes('key') ? [{ key: 'tax', value: { rate: 5 } }] : [];
      case 'bill_table':
        if (q.op !== 'select') return [];
        if (has('is', 'released_at')) return world.openBill ? [{ bill: bill('b1') }] : [];
        return [];
      case 'bill':
        if (q.op === 'insert') return [{ id: 'b1' }];
        return [bill('b1')];
      case 'dining_table':
        return [{ id: 't1', name: 'A5', zone: 'AC Hall', seats: 4, active: true, sort: 1 }];
      case 'menu_item':
        return [
          {
            id: 'm1',
            name: 'Ghee Roast Dosa',
            description: '',
            price: 120,
            food_type: 'veg',
            image_url: null,
            available: true,
            closed_reason: null,
            closed_until: null,
            printer_id: null,
            station: null,
            sort: 1,
            menu_category: { id: 'c1', name: 'Tiffin', sort: 1, parent_id: null, parent: null },
          },
        ];
      case 'kot':
        return q.op === 'insert' ? [{ id: 'k1' }] : [];
      case 'print_job':
        return q.op === 'select'
          ? [
              {
                id: 'j1',
                kind: 'KOT',
                status: 'failed',
                attempts: 0,
                completed_at: null,
                created_at: iso,
                kot: { code: 'KOT-105', table_id: 't1', table: { name: 'A5' } },
                bill: { code: 'JB-1041' },
              },
            ]
          : [];
      default:
        return [];
    }
  };
}

async function run(name: string, world: World, go: () => Promise<unknown>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 20;
  db.delayFor = () => 0;
  db.respond = responder(world);
  g.__fakeSession = { guestToken: 'tok', staff: OWNER };
  let status: number | null = null;
  let cartCount: number | null = null;
  let threw: string | null = null;
  try {
    const out = await go();
    if (out instanceof Response) {
      status = out.status;
      const json = (await out.clone().json()) as { state?: { cartCount?: number } | null };
      cartCount = json.state?.cartCount ?? null;
    }
  } catch (err) {
    threw = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
  }
  await new Promise((r) => setTimeout(r, db.latencyMs * 4));
  const calls: FakeCall[] = db.calls;
  const reads = (table: string) => calls.filter((c) => c.op === 'select' && c.table === table);
  return {
    name,
    cartCount,
    status,
    threw,
    calls: calls.length,
    rounds: sequentialRounds(calls),
    /** The table's open-bill lookup (bill_table where released_at is null). */
    openBillReads: reads('bill_table').filter((c) => c.filters.includes('is:released_at')).length,
    printerReads: reads('printer').length,
    /** A cart read on its own, rather than riding in the session read. */
    separateCartReads: reads('guest_cart_line').length,
    categoryReads: reads('menu_category').filter((c) => c.filters.some((f) => f.startsWith('in:'))).length,
    wrote: calls.filter((c) => c.op !== 'select').map((c) => `${c.op} ${c.table}`),
    /** The open-bills list (bills in service, read restaurant-wide). */
    openBillListReads: reads('bill').filter((c) => c.filters.includes('in:status')).length,
    requestReads: reads('table_request').length,
    tableNameReads: reads('dining_table').filter((c) => c.filters.includes('in:id')).length,
  };
}

const post = () =>
  new Request('http://localhost/api/guest/round', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
const ctx = { params: Promise.resolve({}) };
type Route = (req: Request, c: typeof ctx) => Promise<Response>;

const results = [
  await run('guest places the first round (a bill is opened)', { openBill: false }, () =>
    (placeRoundRoute as unknown as Route)(post(), ctx)
  ),
  await run('guest places another round (the bill exists)', { openBill: true }, () =>
    (placeRoundRoute as unknown as Route)(post(), ctx)
  ),
  await run('the floor, with a phone on an open bill', { openBill: true }, () => listFloor()),
  await run('the cart clear fails after the round is placed', { openBill: true, fail: { clearCart: true } }, () =>
    (placeRoundRoute as unknown as Route)(post(), ctx)
  ),
  await run(
    'the queue read fails for a phone with no session',
    { openBill: true, noSession: true, fail: { queue: true } },
    () => (placeRoundRoute as unknown as Route)(post(), ctx)
  ),
  await run('the owner console, the grants read fails', { openBill: true, fail: { grants: true } }, () =>
    buildOwnerPayload(signedIn as never, 'https://x')
  ),
  await run('the staff screen', { openBill: true }, () => buildStaffPayload(signedIn as never)),
  await run('the owner console', { openBill: true }, () => buildOwnerPayload(signedIn as never, 'https://x')),
  await run('owner saves a setting (the console rides back)', { openBill: true }, () =>
    (ownerAction as unknown as Route)(
      new Request('http://localhost/api/owner/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'write-setting', key: 'copy', value: { name: 'Jalsa' } }),
      }),
      ctx
    )
  ),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
