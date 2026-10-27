/**
 * Request-reduction scenarios (27-Oct-2026, P-1) — bundled and run by
 * tests/unit/request-reduction.unit.spec.ts. Calls the REAL state routes against fake-supabase, in
 * one process, so the catalog cache lives across requests exactly as it does on one server
 * instance: which tables each full read touches, and in how many rounds.
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
const GRANTS: Record<string, string[]> = { st1: ['orders.view', 'tables.view'], ow1: ['orders.view'] };

const world = { floor: 41, catalog: 3, migrated: true };

function respond(q: FakeQuery): unknown[] | Record<string, unknown> | null {
  const eq = (col: string) => q.filters.find(([k, c]) => k === 'eq' && c === col)?.[2];
  switch (q.table) {
    case 'change_version': {
      if (!world.migrated) throw new Error('relation "public.change_version" does not exist');
      const scopes = q.filters.find(([k, c]) => k === 'in' && c === 'scope')?.[2] as string[] | undefined;
      if (scopes)
        return scopes.map((scope) => ({ scope, version: scope === 'catalog' ? world.catalog : world.floor }));
      return [{ version: eq('scope') === 'catalog' ? world.catalog : world.floor }];
    }
    case 'staff':
      return eq('id') ? [{ id: eq('id'), active: true, removed_at: null, pin_provisional: false }] : [];
    case 'staff_permission':
      return (GRANTS[String(eq('staff_id'))] ?? []).map((perm_key) => ({ perm_key }));
    case 'dining_table':
      if (q.cols.includes('version')) {
        if (!world.migrated) throw new Error('column bill.version does not exist');
        return [{ id: 't1', active: true, bill_table: [], suggestion: [], guest_session: [] }];
      }
      return [{ id: 't1', name: 'A5', zone: 'AC', seats: 4, active: true }];
    case 'guest_session':
      if (q.op !== 'select') return [];
      return [{ id: 's1', table_id: 't1', bill_id: null, heard_about: '' }];
    case 'restaurant':
      return [{ id: 'r1', name: 'Jalsa', slug: 'jalsa-hosur', created_at: iso }];
    case 'bridge_token':
      // A paired computer that reported its printers - production's shape on 27-Oct-2026.
      return [
        {
          id: 'bt1',
          label: 'Kitchen PC',
          source: 'paired',
          hostname: 'KITCHEN-PC',
          bridge_version: '1.4.0',
          created_at: iso,
          last_seen_at: iso,
          revoked_at: null,
          bridge_discovered_printer: [
            {
              queue_name: 'EPSON TM-T82',
              driver_name: '',
              port_name: 'USB001',
              status: 'ready',
              is_virtual: false,
              reported_at: iso,
            },
          ],
        },
      ];
    case 'bridge_discovered_printer':
      return [{ bridge_token_id: 'bt1', queue_name: 'EPSON TM-T82', status: 'ready', reported_at: iso }];
    default:
      return [];
  }
}

const CATALOG = ['menu_category', 'menu_food_type', 'menu_item', 'restaurant', 'setting'];

async function read(name: string, who: unknown, get: (r: Request) => Promise<Response>, path: string) {
  const db = fakeDb();
  db.calls = [];
  // 100 ms, not 20: a busy test machine can stall a build for 20 ms and fake a round that is not there.
  db.latencyMs = 100;
  db.respond = respond;
  db.delayFor = () => 0;
  g.__fakeSession = { staff: who, guestToken: 'tok' };
  const res = await get(new Request(new URL(`http://localhost${path}`)));
  await new Promise((r) => setTimeout(r, db.latencyMs * 4));
  const body = (await res.json()) as Record<string, unknown>;
  const tables = [...new Set(db.calls.map((c) => c.table))].sort();
  return {
    name,
    status: res.status,
    calls: db.calls.length,
    rounds: sequentialRounds(db.calls),
    tables,
    catalogTables: tables.filter((t) => CATALOG.includes(t)),
    computers: (body.printComputers as Array<{ discovered: unknown[] }> | undefined)?.map((c) => c.discovered.length),
  };
}

const ctx = { params: Promise.resolve({}) };
const staff = (r: Request) => staffState(r, ctx);
const owner = (r: Request) => ownerState(r, ctx);
const guest = (r: Request) => guestState(r, ctx);

const out = [];
out.push(await read('owner, cold', OWNER, owner, '/api/owner/state'));
out.push(await read('owner, catalog unchanged', OWNER, owner, '/api/owner/state'));
out.push(await read('captain, catalog unchanged', CAPTAIN, staff, '/api/staff/state'));
out.push(await read('guest, catalog unchanged', null, guest, '/api/guest/state?table=A5'));
world.catalog += 1; // the owner changed a dish
out.push(await read('captain, catalog moved', CAPTAIN, staff, '/api/staff/state'));
out.push(await read('guest, after the captain re-read it', null, guest, '/api/guest/state?table=A5'));
world.floor += 1; // only the floor: the catalog is still good
out.push(await read('owner, only the floor moved', OWNER, owner, '/api/owner/state'));
world.migrated = false; // no counter to trust: read as before
out.push(await read('captain, no counter', CAPTAIN, staff, '/api/staff/state'));
out.push(await read('captain, no counter, again', CAPTAIN, staff, '/api/staff/state'));

process.stdout.write(`${JSON.stringify(out)}\n`);
