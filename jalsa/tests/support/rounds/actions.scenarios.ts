/**
 * Staff/owner action scenarios — bundled and run by tests/unit/action-echo.unit.spec.ts.
 * Calls the REAL route handlers against fake-supabase and reports what came back, how many
 * database rounds the request waited for, and whether the screen state rode along.
 */
import { POST as staffAction } from '@/app/api/staff/action/route';
import { POST as ownerAction } from '@/app/api/owner/action/route';
import { currentStaff } from '@/lib/db/auth';
import { fakeDb, sequentialRounds, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { staff?: unknown } };
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
const GRANTS: Record<string, string[]> = {
  st1: ['orders.view', 'orders.status', 'tables.view'],
  ow1: ['orders.view', 'orders.status', 'set.copy', 'staff.view'],
  // May edit the guest-facing copy, may not open the console.
  cp1: ['set.copy'],
};

const COPY_ONLY = { staffId: 'cp1', name: 'Ravi', role: 'Cashier', initials: 'RA', provisional: false, issuedAt: 0 };
const REMOVED = { staffId: 'gone', name: 'Old', role: 'Captain', initials: 'OL', provisional: false, issuedAt: 0 };

function responder(opts: { failBuild?: boolean }) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    const idFilter = q.filters.find(([k, c]) => k === 'eq' && c === 'id')?.[2];
    const staffFilter = q.filters.find(([k, c]) => k === 'eq' && c === 'staff_id')?.[2];
    switch (q.table) {
      case 'staff':
        if (idFilter === 'gone') return [{ id: idFilter, active: true, removed_at: iso, pin_provisional: false }];
        if (idFilter) return [{ id: idFilter, active: true, removed_at: null, pin_provisional: false }];
        return [];
      case 'staff_permission':
        return (GRANTS[String(staffFilter)] ?? []).map((perm_key) => ({ perm_key, staff_id: staffFilter }));
      case 'kot':
        if (q.op === 'update') return [{ id: 'k1' }];
        return [
          {
            id: 'k1',
            code: 'KOT-105',
            status: 'new',
            bill_id: 'b1',
            table_id: 't1',
            started_at: null,
            ready_at: null,
            picked_up_at: null,
            served_at: null,
          },
        ];
      case 'dining_table':
        if (opts.failBuild && q.op === 'select') throw new Error('database went away mid-build');
        return [];
      case 'setting':
        return [];
      case 'restaurant':
        return [{ id: 'r1', name: 'Jalsa', slug: 'jalsa-hosur', created_at: iso }];
      default:
        return [];
    }
  };
}

async function run(
  name: string,
  who: unknown,
  opts: { failBuild?: boolean; stallBuildMs?: number },
  call: () => Promise<Response>
) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 20;
  db.respond = responder(opts);
  // The screen builders are the only readers of `dining_table` here; stalling it stalls the build.
  db.delayFor = (q) => (opts.stallBuildMs && q.table === 'dining_table' ? opts.stallBuildMs : 0);
  g.__fakeSession = { staff: who };
  const t0 = performance.now();
  const res = await call();
  const answeredMs = Math.round(performance.now() - t0);
  if (opts.stallBuildMs) await new Promise((r) => setTimeout(r, opts.stallBuildMs));
  await new Promise((r) => setTimeout(r, db.latencyMs * 4)); // stragglers land in this record
  const body = (await res.json()) as Record<string, unknown>;
  const state = body.state as Record<string, unknown> | undefined;
  return {
    name,
    status: res.status,
    keys: Object.keys(body).sort(),
    stateKeys: state && typeof state === 'object' ? Object.keys(state).sort() : null,
    calls: db.calls.length,
    rounds: sequentialRounds(db.calls),
    answeredMs,
  };
}

const post = (body: unknown) =>
  new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const ctx = { params: Promise.resolve({}) };

const results = [
  await run('staff advance-kot', CAPTAIN, {}, () =>
    staffAction(post({ action: 'advance-kot', kotId: 'k1', to: 'preparing' }), ctx)
  ),
  await run('staff advance-kot, screen build fails', CAPTAIN, { failBuild: true }, () =>
    staffAction(post({ action: 'advance-kot', kotId: 'k1', to: 'preparing' }), ctx)
  ),
  await run('staff unknown action', CAPTAIN, {}, () => staffAction(post({ action: 'no-such-thing' }), ctx)),
  await run('owner write-setting', OWNER, {}, () =>
    ownerAction(post({ action: 'write-setting', key: 'copy', value: { name: 'Jalsa' } }), ctx)
  ),
  await run('owner route, actor without the console grant', COPY_ONLY, {}, () =>
    ownerAction(post({ action: 'write-setting', key: 'copy', value: { name: 'Jalsa' } }), ctx)
  ),
  await run('removed captain', REMOVED, {}, () =>
    staffAction(post({ action: 'advance-kot', kotId: 'k1', to: 'preparing' }), ctx)
  ),
  await run('staff advance-kot, screen build hangs', CAPTAIN, { stallBuildMs: 6000 }, () =>
    staffAction(post({ action: 'advance-kot', kotId: 'k1', to: 'preparing' }), ctx)
  ),
];

// currentStaff on its own: the row and the grants need nothing from each other.
const db = fakeDb();
db.calls = [];
db.respond = responder({});
db.delayFor = () => 0;
g.__fakeSession = { staff: CAPTAIN };
const who = await currentStaff();
results.push({
  name: 'currentStaff alone',
  status: who ? 200 : 401,
  keys: who ? who.grants.list().sort() : [],
  stateKeys: null,
  calls: db.calls.length,
  rounds: sequentialRounds(db.calls),
  answeredMs: 0,
});

process.stdout.write(`${JSON.stringify(results)}\n`);
