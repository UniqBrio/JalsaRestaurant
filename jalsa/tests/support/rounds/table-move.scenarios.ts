/**
 * Move an order to another table (12-Oct-2026) - bundled and run by tests/unit/table-move.unit.spec.ts.
 * Calls the REAL `moveOrderToTable`, the REAL staff and owner action routes, the REAL guest context
 * (`buildGuestPayload`) and `lastClosedOnTable`, against fake-supabase, and reports what each did.
 */
import { moveOrderToTable } from '@/lib/db/mutations';
import { getBill, lastClosedOnTable } from '@/lib/db/queries';
import { buildGuestPayload } from '@/lib/db/guest-view';
import { POST as staffAction } from '@/app/api/staff/action/route';
import { POST as ownerAction } from '@/app/api/owner/action/route';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { staff?: unknown; guestToken?: string | null } };

const BILL = '11111111-1111-4111-8111-111111111111';
const A1 = '22222222-2222-4222-8222-222222222222';
const A2 = '33333333-3333-4333-8333-333333333333';
const TABLES: Record<string, { id: string; name: string }> = { A1: { id: A1, name: 'A1' }, A2: { id: A2, name: 'A2' } };

type Log = Array<{ table: string; op: string; body: unknown; cols: string; filters: string[] }>;

interface World {
  /** What move_bill_to_table answers. */
  outcome?: string;
  grants?: string[];
  /** The guest's session row, as round 1 reads it. */
  session?: Record<string, unknown> | null;
  /** The database before 20261012090000: no `moved_from_table_id` column. */
  unmigrated?: boolean;
  /** The whole bill row `getBill` reads, when a scenario needs one. */
  billRow?: Record<string, unknown>;
  /** lastClosedOnTable's row. */
  lastReleased?: { released_at: string; bill: { id: string; closed_at: string | null } } | null;
}

function responder(w: World, log: Log) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    log.push({ table: q.table, op: q.op, body: q.body, cols: q.cols, filters: q.filters.map(([k, c, v]) => `${k}:${c}=${JSON.stringify(v)}`) });
    if (q.op === 'rpc') return (w.outcome ?? 'moved') as unknown as Record<string, unknown>;
    switch (q.table) {
      case 'staff':
        return [{ id: 'st1', active: true, removed_at: null, pin_provisional: false }];
      case 'staff_permission':
        return (w.grants ?? ['tables.transfer', 'orders.view']).map((perm_key) => ({ perm_key, staff_id: 'st1' }));
      case 'bill':
        return w.billRow ? [w.billRow] : [{ code: 'B-0412' }];
      case 'dining_table': {
        const byName = q.filters.find(([k, c]) => k === 'ilike' && c === 'name');
        if (byName) {
          const t = TABLES[String(byName[2]).toUpperCase()];
          return t ? [{ ...t, zone: 'AC Hall', seats: 4, active: true }] : [];
        }
        return Object.values(TABLES);
      }
      case 'setting':
        return q.cols.includes('key') ? [{ key: 'rescan', value: { minutes: 15 } }] : [{ value: { minutes: 15 } }];
      case 'guest_session':
        if (q.op === 'insert') return [{ id: 's-new' }];
        if (q.op !== 'select') return [];
        if (w.unmigrated && q.cols.includes('moved_from_table_id')) {
          return { __error: 'column guest_session.moved_from_table_id does not exist', __code: '42703' };
        }
        return w.session ? [w.session] : [];
      case 'bill_table':
        if (q.filters.some(([k, c]) => k === 'not.is' && c === 'released_at')) return w.lastReleased ? [w.lastReleased] : [];
        return [];
      default:
        return [];
    }
  };
}

async function run(name: string, w: World, call: () => Promise<unknown>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const log: Log = [];
  db.respond = responder(w, log);
  try {
    const out = await call();
    if (out instanceof Response) {
      return { name, out: { status: out.status, body: await out.text() }, threw: null, log };
    }
    return { name, out: out ?? null, threw: null, log };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err), log };
  }
}

const actor = (grants: string[]) => ({ staffId: 'st1', label: 'Ravi', grants: { can: (k: string) => grants.includes(k) } });
const move = (grants: string[], ids: { billId?: string; from?: string; to?: string } = {}) => () =>
  moveOrderToTable({ billId: ids.billId ?? BILL, fromTableId: ids.from ?? A1, toTableId: ids.to ?? A2, actor: actor(grants) });

const person = { staffId: 'st1', name: 'Ravi', role: 'Captain', initials: 'RA', provisional: false, issuedAt: 0 };
const post = (body: unknown) =>
  new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({}) };
const MOVE = { action: 'move-table', billId: BILL, fromTableId: A1, toTableId: A2 };
const asStaff = () => {
  g.__fakeSession = { staff: person };
  return staffAction(post(MOVE), ctx);
};
const asOwner = () => {
  g.__fakeSession = { staff: { ...person, role: 'Owner / Admin' } };
  return ownerAction(post(MOVE), ctx);
};
const guestAt = (table: string) => () => {
  g.__fakeSession = { guestToken: 'tok-phone' };
  return buildGuestPayload(table);
};
const movedSession = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  table_id: A2,
  bill_id: BILL,
  heard_about: '',
  heard_dismissed_at: null,
  moved_from_table_id: A1,
  bill: { status },
  now_at: { name: 'A2' },
  ...overrides,
});

/** A paid bill that was moved: on A1 until 12:00, paid on A2 at 13:00. */
const movedThenPaid = {
  id: BILL,
  code: 'B-0412',
  status: 'closed',
  group_code: null,
  guests: 2,
  occasion_type: null,
  occasion_name: null,
  occasion_source: null,
  discount_pct: 0,
  discount_amount: 0,
  tax_rate: 5,
  payment_mode: 'Cash',
  payment_reference: '',
  payment_requested_at: null,
  closed_at: '2026-10-12T13:00:00.000Z',
  opened_at: '2026-10-12T11:00:00.000Z',
  order_type: 'dine_in',
  packaging_charge: 0,
  photo_url: '',
  host_table: { name: 'A2' },
  captain: null,
  waiter: null,
  closed_by: null,
  discount_by: null,
  bill_table: [
    { released_at: '2026-10-12T12:00:00.000Z', dining_table: { id: A1, name: 'A1' } },
    { released_at: '2026-10-12T13:00:00.000Z', dining_table: { id: A2, name: 'A2' } },
  ],
  tip: [],
  guest_favourite: [],
  version: 3,
  kot: [],
};

const results = [
  await run('move without tables.transfer', {}, move(['orders.view'])),
  await run('move with ids that are not ids', {}, move(['tables.transfer'], { to: "1' or '1'='1" })),
  await run('move', {}, move(['tables.transfer'])),
  await run('move onto a taken table', { outcome: 'taken' }, move(['tables.transfer'])),
  await run('move onto a table needing clearing', { outcome: 'needs_clearing' }, move(['tables.transfer'])),
  await run('move a paid order', { outcome: 'gone' }, move(['tables.transfer'])),
  await run('move from a table that no longer holds it', { outcome: 'not_here' }, move(['tables.transfer'])),

  await run('captain route, moved', {}, asStaff),
  await run('captain route, taken', { outcome: 'taken' }, asStaff),
  await run('captain route, no grant', { grants: ['orders.view'] }, asStaff),
  await run('owner route, moved', {}, asOwner),

  await run('a moved phone on the old table page', { session: movedSession('open') }, guestAt('A1')),
  await run('a moved phone whose order was since paid', { session: movedSession('closed') }, guestAt('A1')),
  await run('a phone that walked to another table itself', { session: movedSession('open', { moved_from_table_id: null }) }, guestAt('A1')),
  await run('a moved phone arriving at its new table', { session: movedSession('open') }, guestAt('A2')),
  await run(
    'a phone on a database without the migration',
    { unmigrated: true, session: { id: 's1', table_id: A1, bill_id: null, heard_about: '', heard_dismissed_at: null } },
    guestAt('A1')
  ),

  await run(
    'receipt of an order moved away and paid later',
    { lastReleased: { released_at: '2026-10-12T12:00:00.000Z', bill: { id: BILL, closed_at: '2026-10-12T13:00:00.000Z' } } },
    () => lastClosedOnTable(A1)
  ),
  await run(
    'receipt of an order paid here',
    { lastReleased: { released_at: '2026-10-12T13:00:00.000Z', bill: { id: BILL, closed_at: '2026-10-12T13:00:00.000Z' } } },
    () => lastClosedOnTable(A1)
  ),
  await run('a paid bill that was moved', { billRow: movedThenPaid }, () => getBill(BILL)),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
