/**
 * Polling scenarios — bundled and run by tests/unit/change-stamp.unit.spec.ts. Calls the REAL
 * state routes against fake-supabase: what a tick costs when nothing changed, and that a change,
 * a stale stamp, a removed person and a database without the migration all still get the truth.
 */
import { GET as guestState } from '@/app/api/guest/state/route';
import { GET as staffState } from '@/app/api/staff/state/route';
import { GET as ownerState } from '@/app/api/owner/state/route';
import { fakeDb, sequentialRounds, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { staff?: unknown; guestToken?: string | null } };
const iso = new Date().toISOString();
const CAPTAIN = { staffId: 'st1', name: 'Arun', role: 'Captain', initials: 'AR', provisional: false, issuedAt: 0 };
const OWNER = {
  staffId: 'ow1',
  name: 'Meena',
  role: 'Owner / Admin',
  initials: 'ME',
  provisional: false,
  issuedAt: 0,
};
const REMOVED = { staffId: 'gone', name: 'Old', role: 'Captain', initials: 'OL', provisional: false, issuedAt: 0 };
const GRANTS: Record<string, string[]> = {
  st1: ['orders.view', 'tables.view'],
  st2: ['orders.view', 'tables.view'],
  ow1: ['orders.view'],
};
const OTHER_CAPTAIN = {
  staffId: 'st2',
  name: 'Bala',
  role: 'Captain',
  initials: 'BA',
  provisional: false,
  issuedAt: 0,
};

const world = { floor: 41, catalog: 3, billVersion: 7, migrated: true, sessionGone: false, cartQty: 1 };

function respond(q: FakeQuery): unknown[] | Record<string, unknown> | null {
  const eq = (col: string) => q.filters.find(([k, c]) => k === 'eq' && c === col)?.[2];
  switch (q.table) {
    case 'change_version':
      if (!world.migrated) throw new Error('relation "public.change_version" does not exist');
      return [{ version: eq('scope') === 'catalog' ? world.catalog : world.floor }];
    case 'staff':
      return eq('id')
        ? [{ id: eq('id'), active: true, removed_at: eq('id') === 'gone' ? iso : null, pin_provisional: false }]
        : [];
    case 'staff_permission':
      return (GRANTS[String(eq('staff_id'))] ?? []).map((perm_key) => ({ perm_key }));
    case 'dining_table':
      if (q.cols.includes('version')) {
        if (!world.migrated) throw new Error('column bill.version does not exist');
        return [
          {
            id: 't1',
            active: true,
            bill_table: [{ bill: { id: 'b1', version: world.billVersion } }],
            suggestion: [],
            // The stamp's view of this phone's own session and cart, embedded in the table read.
            guest_session: world.sessionGone
              ? []
              : [
                  {
                    id: 's1',
                    bill_id: null,
                    heard_about: '',
                    guest_cart_line: [{ menu_item_id: 'm1', qty: world.cartQty }],
                  },
                ],
          },
        ];
      }
      return [{ id: 't1', name: 'A5', zone: 'AC', seats: 4, active: true }];
    case 'guest_session':
      if (q.op !== 'select') return [];
      return [{ id: 's1', table_id: 't1', bill_id: null, heard_about: '' }];
    case 'setting':
      return [];
    case 'restaurant':
      return [{ id: 'r1', name: 'Jalsa', slug: 'jalsa-hosur', created_at: iso }];
    default:
      return [];
  }
}

async function tick(
  name: string,
  who: unknown,
  get: (r: Request) => Promise<Response>,
  path: string,
  since: string | null
) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 20;
  db.respond = respond;
  db.delayFor = () => 0;
  g.__fakeSession = { staff: who, guestToken: 'tok' };
  const url = new URL(`http://localhost${path}`);
  if (since !== null) url.searchParams.set('since', since);
  const res = await get(new Request(url));
  await new Promise((r) => setTimeout(r, db.latencyMs * 4));
  const body = (await res.json()) as Record<string, unknown>;
  return {
    name,
    status: res.status,
    stamp: res.headers.get('x-change-stamp'),
    unchanged: body.unchanged === true,
    fullScreen: !('unchanged' in body) && res.status === 200,
    calls: db.calls.length,
    rounds: sequentialRounds(db.calls),
    tables: [...new Set(db.calls.map((c) => c.table))].sort(),
  };
}

const ctx = { params: Promise.resolve({}) };
const staff = (r: Request) => staffState(r, ctx);
const owner = (r: Request) => ownerState(r, ctx);
const guest = (r: Request) => guestState(r, ctx);

const out = [];
// Staff: a full read hands out the stamp; sending it back is the cheap tick.
const sFull = await tick('staff full', CAPTAIN, staff, '/api/staff/state', null);
out.push(sFull);
out.push(await tick('staff tick, nothing moved', CAPTAIN, staff, '/api/staff/state', sFull.stamp));
world.floor += 1;
out.push(await tick('staff tick, floor moved', CAPTAIN, staff, '/api/staff/state', sFull.stamp));
out.push(await tick('removed captain tick', REMOVED, staff, '/api/staff/state', `f${world.floor}`));
// Same floor, different person, or the same person with a grant taken away: never "unchanged".
const sNow = await tick('staff full again', CAPTAIN, staff, '/api/staff/state', null);
out.push(await tick('staff tick, someone else signed in', OTHER_CAPTAIN, staff, '/api/staff/state', sNow.stamp));
GRANTS.st1 = ['orders.view'];
out.push(await tick('staff tick, a grant was revoked', CAPTAIN, staff, '/api/staff/state', sNow.stamp));
GRANTS.st1 = ['orders.view', 'tables.view'];
// Owner.
const oFull = await tick('owner full', OWNER, owner, '/api/owner/state', null);
out.push(oFull);
out.push(await tick('owner tick, nothing moved', OWNER, owner, '/api/owner/state', oFull.stamp));
// Guest.
const gFull = await tick('guest full', null, guest, '/api/guest/state?table=A5', null);
out.push(gFull);
out.push(await tick('guest tick, nothing moved', null, guest, '/api/guest/state?table=A5', gFull.stamp));
world.billVersion += 1;
out.push(await tick('guest tick, own bill moved', null, guest, '/api/guest/state?table=A5', gFull.stamp));
world.billVersion -= 1;
world.floor += 5; // another table's business: the guest's stamp must not care
out.push(await tick('guest tick, only the floor moved', null, guest, '/api/guest/state?table=A5', gFull.stamp));
world.catalog += 1;
out.push(await tick('guest tick, menu moved', null, guest, '/api/guest/state?table=A5', gFull.stamp));
world.catalog -= 1;
world.cartQty += 1; // changed from another tab of the same phone
out.push(await tick('guest tick, cart changed elsewhere', null, guest, '/api/guest/state?table=A5', gFull.stamp));
world.cartQty -= 1;
world.sessionGone = true; // staff freed the table: this phone's session was deleted
out.push(await tick('guest tick, session deleted by staff', null, guest, '/api/guest/state?table=A5', gFull.stamp));
world.sessionGone = false;
// A database the migration has not reached yet: no stamp, full screens, as before fix 4.
world.migrated = false;
out.push(await tick('staff, no migration', CAPTAIN, staff, '/api/staff/state', 'f41'));
out.push(await tick('guest, no migration', null, guest, '/api/guest/state?table=A5', 'anything'));

process.stdout.write(`${JSON.stringify(out)}\n`);
