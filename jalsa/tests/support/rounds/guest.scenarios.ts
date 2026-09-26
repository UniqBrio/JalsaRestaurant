/**
 * Guest-screen round budget scenarios — bundled and run by tests/unit/guest-rounds.unit.spec.ts.
 * Each scenario runs the REAL guest data layer against fake-supabase and reports the sequential
 * rounds it waited for, the calls it made, what it wrote, and what the guest would be shown.
 */
import { buildGuestPayload } from '@/lib/db/guest-view';
import { freshState } from '@/lib/db/guest-echo';
import { fakeDb, sequentialRounds, type FakeQuery, type FakeCall } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { guestToken?: string | null }; __fakeWrittenToken?: string };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const TABLE = { id: 't1', name: 'A5', zone: 'AC Hall', seats: 4, active: true };
const bill = (id: string, code: string, closedAt: string | null) => ({
  id,
  code,
  status: closedAt ? 'closed' : 'open',
  group_code: null,
  guests: 2,
  occasion_type: null,
  occasion_name: null,
  occasion_source: null,
  discount_pct: 0,
  discount_amount: 0,
  tax_rate: 5,
  payment_mode: closedAt ? 'upi' : null,
  payment_reference: null,
  payment_requested_at: null,
  closed_at: closedAt,
  opened_at: minutesAgo(90),
  host_table: { name: 'A5' },
  captain: null,
  waiter: null,
  closed_by: null,
  discount_by: null,
  bill_table: [{ released_at: closedAt, dining_table: { id: 't1', name: 'A5' } }],
  tip: [],
  kot: [],
});

interface World {
  session: { id: string; table_id: string; bill_id: string | null; heard_about: string } | null;
  openBill: boolean;
  /** When the table's last bill closed; null = never. */
  closedAt: string | null;
  table?: { active: boolean } | null;
  fail?: { open?: boolean; closed?: boolean };
}

function responder(world: World) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    const has = (kind: string, col: string) => q.filters.some(([k, c]) => k === kind && c === col);
    switch (q.table) {
      case 'dining_table':
        if (world.table === null) return [];
        return [{ ...TABLE, active: world.table?.active ?? true }];
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
        if (q.cols.includes('heard_about') && !q.cols.includes('table_id')) return [{ heard_about: 'Walked past' }];
        return world.session ? [world.session] : [];
      case 'bill_table':
        if (has('is', 'released_at')) {
          if (world.fail?.open) throw new Error('open-bill read failed');
          return world.openBill ? [{ bill: bill('b1', 'JB-1041', null) }] : [];
        }
        if (has('not.is', 'released_at')) {
          if (world.fail?.closed) throw new Error('closed-bill read failed');
          if (!world.closedAt) return [];
          // Answer with exactly what was asked for, so a light select stays light.
          return [
            {
              released_at: world.closedAt,
              bill: q.cols.includes('kot')
                ? bill('b0', 'JB-1040', world.closedAt)
                : { id: 'b0', closed_at: world.closedAt },
            },
          ];
        }
        return [];
      case 'bill':
        return [bill('b0', 'JB-1040', world.closedAt)];
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
  delete g.__fakeWrittenToken;
  type Shown = { phase?: string; billCode?: string | null; heardSources?: string[] };
  let payload = null as Shown | null;
  let threw: string | null = null;
  try {
    payload = (await run()) as Shown | null;
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  // Let anything still on the wire land HERE, not in the next scenario's record. Code that bails
  // out of a Promise.all early leaves its siblings running.
  await new Promise((r) => setTimeout(r, db.latencyMs * 4));
  const calls: FakeCall[] = db.calls;
  const del = calls.find((c) => c.op === 'delete' && c.table === 'guest_session');
  const ins = calls.find((c) => c.op === 'insert' && c.table === 'guest_session');
  return {
    name,
    threw,
    phase: payload?.phase ?? null,
    billCode: payload?.billCode ?? null,
    heardSources: payload?.heardSources ?? [],
    calls: calls.length,
    rounds: sequentialRounds(calls),
    writes: calls
      .filter((c) => c.op !== 'select')
      .map((c) => `${c.op} ${c.table}${c.wrote.length ? ` ${[...c.wrote].sort().join('+')}` : ''}`),
    /** The heard-sources scan: a guest_session read of that one column, restaurant-wide. */
    heardScan: calls.some((c) => c.table === 'guest_session' && c.op === 'select' && !c.cols.includes('table_id')),
    /** Did any read fetch a closed bill's KOTs? */
    heavyClosedRead: calls.some((c) => c.filters.includes('not.is:released_at') && c.cols.includes('kot')),
    fullBillReads: calls.filter((c) => c.table === 'bill').length,
    deleteBeforeInsert: del && ins ? del.t1 <= ins.t0 : null,
    mintedTokenPersisted: g.__fakeWrittenToken ?? null,
  };
}

const seated = { id: 's1', table_id: 't1', bill_id: 'b1', heard_about: '' };
const A5 = () => buildGuestPayload('A5');
const results = [
  await scenario('first scan (no session yet)', { session: null, openBill: false, closedAt: null }, 'tok', A5),
  await scenario(
    'welcome poll',
    { session: { ...seated, bill_id: null }, openBill: false, closedAt: null },
    'tok',
    A5
  ),
  await scenario('live poll', { session: seated, openBill: true, closedAt: minutesAgo(200) }, 'tok', A5),
  await scenario(
    'live poll, bill pointer stale',
    { session: { ...seated, bill_id: null }, openBill: true, closedAt: null },
    'tok',
    A5
  ),
  await scenario(
    'phone moved from another table',
    { session: { ...seated, table_id: 't9' }, openBill: true, closedAt: null },
    'tok',
    A5
  ),
  await scenario(
    'recently paid',
    { session: { ...seated, bill_id: 'b0' }, openBill: false, closedAt: minutesAgo(5) },
    'tok',
    A5
  ),
  await scenario(
    'paid long ago',
    { session: { ...seated, bill_id: 'b0' }, openBill: false, closedAt: minutesAgo(120) },
    'tok',
    A5
  ),
  await scenario(
    'table switched off',
    { session: seated, openBill: false, closedAt: null, table: { active: false } },
    'tok',
    A5
  ),
  await scenario('no such table', { session: seated, openBill: false, closedAt: null, table: null }, 'tok', () =>
    buildGuestPayload('Z9')
  ),
  await scenario('no cookie (route handler mints one)', { session: null, openBill: false, closedAt: null }, null, A5),
  await scenario(
    'live poll, closed-bill read fails',
    { session: seated, openBill: true, closedAt: null, fail: { closed: true } },
    'tok',
    A5
  ),
  await scenario(
    'moved phone, open-bill read fails',
    { session: { ...seated, table_id: 't9' }, openBill: true, closedAt: null, fail: { open: true } },
    'tok',
    A5
  ),
  await scenario('cart tap echo (live)', { session: seated, openBill: true, closedAt: null }, 'tok', () =>
    freshState({ id: 's1', tableId: 't1', billId: 'b1', heardAbout: '' })
  ),
  await scenario(
    'cart tap echo (recently paid)',
    { session: seated, openBill: false, closedAt: minutesAgo(3) },
    'tok',
    () => freshState({ id: 's1', tableId: 't1', billId: 'b0', heardAbout: '' })
  ),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
