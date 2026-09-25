/**
 * Guest-screen round budget scenarios — bundled and run by tests/unit/guest-rounds.unit.spec.ts.
 * Each scenario runs the REAL guest data layer against fake-supabase and reports the sequential
 * rounds it waited for, the calls it made, and what it wrote.
 */
import { buildGuestPayload } from '@/lib/db/guest-view';
import { freshState } from '@/lib/db/guest-echo';
import { fakeDb, sequentialRounds, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { guestToken?: string | null } };
const iso = new Date().toISOString();

const TABLE = { id: 't1', name: 'A5', zone: 'AC Hall', seats: 4, active: true };
const BILL = {
  id: 'b1',
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
};

interface World {
  session: { id: string; table_id: string; bill_id: string | null; heard_about: string } | null;
  openBill: boolean;
}

function responder(world: World) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    const has = (kind: string, col: string) => q.filters.some(([k, c]) => k === kind && c === col);
    switch (q.table) {
      case 'dining_table':
        return [TABLE];
      case 'setting':
        return q.cols.includes('key')
          ? [
              { key: 'rescan', value: { minutes: 15 } },
              { key: 'tax', value: { rate: 5 } },
            ]
          : [{ value: { minutes: 15 } }];
      case 'guest_session':
        if (q.op === 'insert') return [{ id: 's-new' }];
        if (q.op !== 'select') return [];
        if (q.cols.includes('heard_about') && !q.cols.includes('table_id')) return []; // heard sources
        return world.session ? [world.session] : [];
      case 'bill_table': {
        const open = has('is', 'released_at');
        if (!open || !world.openBill) return [];
        return q.cols.includes('bill:') ? [{ bill: BILL }] : [{ bill_id: 'b1' }];
      }
      case 'bill':
        return [BILL];
      default:
        return [];
    }
  };
}

async function scenario(name: string, world: World, token: string | null, run: () => Promise<unknown>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 20;
  db.respond = responder(world);
  g.__fakeSession = { guestToken: token };
  const payload = (await run()) as { phase?: string } | null;
  return {
    name,
    phase: payload?.phase ?? null,
    calls: db.calls.length,
    rounds: sequentialRounds(db.calls),
    writes: db.calls.filter((c) => c.op !== 'select').map((c) => `${c.op} ${c.table}`),
  };
}

const seated = { id: 's1', table_id: 't1', bill_id: 'b1', heard_about: '' };
const results = [
  await scenario('first scan (no session yet)', { session: null, openBill: false }, 'tok', () =>
    buildGuestPayload('A5')
  ),
  await scenario('welcome poll', { session: { ...seated, bill_id: null }, openBill: false }, 'tok', () =>
    buildGuestPayload('A5')
  ),
  await scenario('live poll', { session: seated, openBill: true }, 'tok', () => buildGuestPayload('A5')),
  await scenario(
    'live poll, bill pointer stale',
    { session: { ...seated, bill_id: null }, openBill: true },
    'tok',
    () => buildGuestPayload('A5')
  ),
  await scenario(
    'phone moved from another table',
    { session: { ...seated, table_id: 't9' }, openBill: true },
    'tok',
    () => buildGuestPayload('A5')
  ),
  await scenario('cart tap echo (live)', { session: seated, openBill: true }, 'tok', () =>
    freshState({ id: 's1', tableId: 't1', billId: 'b1', heardAbout: '' })
  ),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
