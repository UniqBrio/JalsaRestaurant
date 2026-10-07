/**
 * The doors of cancel-and-free and the takeaway photo (07-Oct-2026, permission review) - bundled
 * and run by tests/unit/order-cancel.unit.spec.ts. Calls the REAL route handlers: the staff and
 * owner action routes, and the media route, with the caller set through fake-sessions.
 */
import { POST as staffAction } from '@/app/api/staff/action/route';
import { POST as ownerAction } from '@/app/api/owner/action/route';
import { GET as media } from '@/app/api/media/[...path]/route';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { staff?: unknown; guestToken?: string | null } };

const BILL = '11111111-1111-4111-8111-111111111111';
const PHOTO = `takeaway/${BILL}/33333333-3333-4333-8333-333333333333.jpg`;
const person = (staffId: string, provisional = false) => ({ staffId, name: 'Ravi', role: 'Captain', initials: 'RA', provisional, issuedAt: 0 });

interface World {
  grants: string[];
  /** The staff row's own provisional flag - what currentStaff re-reads. */
  provisional?: boolean;
  /** What the bill read returns for the photo check. */
  bill?: { photo_url: string } | null;
}

function responder(w: World, log: string[]) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    log.push(`${q.table}:${q.op}`);
    switch (q.table) {
      case 'staff':
        return [{ id: 'st1', active: true, removed_at: null, pin_provisional: w.provisional === true }];
      case 'staff_permission':
        return w.grants.map((perm_key) => ({ perm_key, staff_id: 'st1' }));
      case 'bill':
        return w.bill ? [w.bill] : [];
      case 'storage:media':
        return q.op === 'download' ? [{ ok: true }] : [];
      default:
        return [];
    }
  };
}

async function run(name: string, who: unknown, w: World, call: () => Promise<Response>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const log: string[] = [];
  db.respond = responder(w, log);
  g.__fakeSession = { staff: who };
  try {
    const res = await call();
    const text = res.headers.get('content-type')?.includes('json') ? await res.text() : '';
    return { name, status: res.status, cache: res.headers.get('cache-control'), body: text, log, threw: null };
  } catch (err) {
    return { name, status: 0, cache: null, body: '', log, threw: err instanceof Error ? err.message : String(err) };
  }
}

const post = (body: unknown) =>
  new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({}) };
const CANCEL = { action: 'cancel-free-table', billId: BILL, tableId: '22222222-2222-4222-8222-222222222222', reason: 'Kitchen issue' };
const getPhoto = (key = PHOTO) => () => media(new Request(`http://localhost/api/media/${key}`), { params: Promise.resolve({ path: key.split('/') }) });
const ALL = ['tables.free', 'orders.cancel_after', 'orders.create', 'orders.view'];
const CURRENT = { photo_url: `/api/media/${PHOTO}` };

const results = [
  await run('staff cancel, provisional PIN', person('st1', true), { grants: ALL, provisional: true }, () => staffAction(post(CANCEL), ctx)),
  await run('owner cancel, provisional PIN', person('st1', true), { grants: ALL, provisional: true }, () => ownerAction(post(CANCEL), ctx)),
  await run('owner photo, provisional PIN', person('st1', true), { grants: ALL, provisional: true }, () =>
    ownerAction(post({ action: 'takeaway-photo', billId: BILL, remove: true }), ctx)
  ),
  await run('staff cancel, signed out', null, { grants: ALL }, () => staffAction(post(CANCEL), ctx)),
  await run('staff cancel, no grants', person('st1'), { grants: ['orders.view'] }, () => staffAction(post(CANCEL), ctx)),

  await run('photo, signed out', null, { grants: ALL, bill: CURRENT }, getPhoto()),
  await run('photo, provisional PIN', person('st1', true), { grants: ALL, provisional: true, bill: CURRENT }, getPhoto()),
  await run('photo, no orders.view', person('st1'), { grants: ['orders.create'], bill: CURRENT }, getPhoto()),
  await run('photo, not this restaurant or not a takeaway', person('st1'), { grants: ALL, bill: null }, getPhoto()),
  await run('photo, an old (replaced) URL', person('st1'), { grants: ALL, bill: { photo_url: `/api/media/takeaway/${BILL}/44444444-4444-4444-8444-444444444444.jpg` } }, getPhoto()),
  await run('photo, signed in with orders.view', person('st1'), { grants: ALL, bill: CURRENT }, getPhoto()),
  await run('a dish photo stays public', null, { grants: [] }, getPhoto('menu/33333333-3333-4333-8333-333333333333.jpg')),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
