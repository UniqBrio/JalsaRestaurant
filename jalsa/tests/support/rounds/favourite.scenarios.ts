/**
 * The guest's heart (03-Oct-2026) - bundled and run by tests/unit/favourites.unit.spec.ts.
 * Calls the REAL `setFavourite` and `getBill` against fake-supabase and reports every
 * read and write, so the spec can see which bill and which dish each one names.
 */
import { moveHeartsWithRounds, setFavourite } from '@/lib/db/mutations';
import { getBill } from '@/lib/db/queries';
import { fakeDb, type FakeQuery } from '../fake-supabase';

interface World {
  /** Rounds on bill b1 that are served. */
  servedKots: string[];
  /** Served rounds by bill, when a scenario needs more than b1 (the kot read filters by bill). */
  servedByBill?: Record<string, string[]>;
  /** Hearts with their dish, for the separation scenario. */
  hearts?: Array<{ menu_item_id: string; item_name: string }>;
  /** Which dishes each round carries, for the separation scenario. */
  dishesByKot?: Record<string, string[]>;
  /** Rounds still on the old bill after the separation. */
  stayingKots?: string[];
  /** Lines on those rounds: dish id and name. */
  lines: Array<{ menu_item_id: string; name: string }>;
  /** What guest_favourite holds for b1. */
  saved?: string[];
  /** Make the guest_favourite write fail the way the real client reports it. */
  writeFails?: boolean;
}

type Log = Array<{ table: string; op: string; body: unknown; filters: string[] }>;

function responder(world: World, log: Log) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    log.push({ table: q.table, op: q.op, body: q.body, filters: q.filters.map(([k, c, v]) => `${k}:${c}=${JSON.stringify(v)}`) });
    switch (q.table) {
      case 'kot': {
        const bill = q.filters.find(([k, c]) => k === 'eq' && c === 'bill_id')?.[2] as string;
        if (world.stayingKots && !q.filters.some(([, c]) => c === 'status')) return world.stayingKots.map((id) => ({ id }));
        const served = world.servedByBill ? (world.servedByBill[bill] ?? []) : bill === 'b1' ? world.servedKots : [];
        return served.map((id) => ({ id }));
      }
      case 'kot_item': {
        if (world.dishesByKot) {
          const kots = (q.filters.find(([k, c]) => k === 'in' && c === 'kot_id')?.[2] ?? []) as string[];
          return kots.flatMap((k) => (world.dishesByKot![k] ?? []).map((m) => ({ menu_item_id: m })));
        }
        const want = q.filters.find(([k, c]) => k === 'eq' && c === 'menu_item_id')?.[2];
        return world.lines.filter((l) => l.menu_item_id === want);
      }
      case 'bill':
        // A bill row as PostgREST returns it, with the hearts embedded by BILL_SELECT.
        return [{ id: 'b1', code: 'B-1', status: 'open', kot: [], bill_table: [], tip: [], guest_favourite: [...(world.saved ?? []).map((id): { menu_item_id: string | null } => ({ menu_item_id: id })), { menu_item_id: null }] }];
      case 'guest_favourite':
        if (q.op !== 'select' && world.writeFails) return { __error: 'insert or update on table "guest_favourite" violates foreign key' };
        if (q.op === 'select' && world.hearts) return world.hearts.map((h) => ({ restaurant_id: 'r1', guest_session_id: 's1', created_at: '2026-10-03T12:00:00Z', ...h }));
        return q.op === 'select' ? (world.saved ?? []).map((id) => ({ menu_item_id: id })) : [];
      default:
        return [];
    }
  };
}

async function run(name: string, world: World, call: () => Promise<unknown>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const log: Log = [];
  db.respond = responder(world, log);
  try {
    const out = await call();
    return { name, out, threw: null, log };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err), log };
  }
}

const SERVED = { servedKots: ['k1'], lines: [{ menu_item_id: 'm-biryani', name: 'Chicken Biryani' }] };

const results = [
  await run('heart a served dish', SERVED, () =>
    setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-biryani', loved: true })
  ),
  await run('heart a dish not served on this bill', SERVED, () =>
    setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-naan', loved: true })
  ),
  await run('heart with nothing served yet', { servedKots: [], lines: [] }, () =>
    setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-biryani', loved: true })
  ),
  await run('un-heart', SERVED, () => setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-biryani', loved: false })),
  await run('the write fails', { ...SERVED, writeFails: true }, () =>
    setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-biryani', loved: true })
  ),
  await run('the un-heart write fails', { ...SERVED, writeFails: true }, () =>
    setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-biryani', loved: false })
  ),
  // The dish was served - but on ANOTHER party's bill, not this phone's (permission review).
  await run('heart a dish served only on another bill', { servedKots: [], servedByBill: { b2: ['k9'] }, lines: [{ menu_item_id: 'm-biryani', name: 'Chicken Biryani' }] }, () =>
    setFavourite({ billId: 'b1', sessionId: 's1', menuItemId: 'm-biryani', loved: true })
  ),
  // A2 separates from A1 taking round k2 (paneer); k1 (biryani, and paneer too) stays on b1.
  await run('table separates: hearts follow the dishes', {
    servedKots: [],
    lines: [],
    hearts: [
      { menu_item_id: 'm-paneer', item_name: 'Paneer Tikka' },
      { menu_item_id: 'm-biryani', item_name: 'Chicken Biryani' },
      { menu_item_id: 'm-naan', item_name: 'Butter Naan' },
    ],
    dishesByKot: { k1: ['m-biryani', 'm-paneer'], k2: ['m-paneer', 'm-naan'] },
    stayingKots: ['k1'],
  }, () => moveHeartsWithRounds({ fromBill: 'b1', toBill: 'b2', movedKots: ['k2'] })),
  await run('read back after a reload', { ...SERVED, saved: ['m-biryani'] }, async () => (await getBill('b1'))?.lovedItemIds),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
