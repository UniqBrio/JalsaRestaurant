/**
 * The stale-claim sweep (26-Oct-2026, N-03) - bundled and run by tests/unit/navigation-latency.unit.spec.ts.
 * Calls the REAL `sweepStaleClaims` against fake-supabase and reports every statement it sent.
 */
import { sweepStaleClaims } from '@/lib/db/bridge-mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

async function run(name: string, staleIds: string[]) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const sent: Array<{ table: string; op: string; filters: string[] }> = [];
  db.respond = (q: FakeQuery) => {
    sent.push({ table: q.table, op: q.op, filters: q.filters.map(([k, c]) => `${k}:${c}`) });
    if (q.table !== 'print_job') return [];
    if (q.op === 'select' && q.cols === 'id') return staleIds.map((id) => ({ id }));
    if (q.op === 'update') return staleIds.map((id) => ({ id, kot_id: null }));
    return [];
  };
  const result = await sweepStaleClaims({ restaurantId: 'r1' });
  return { name, result, sent };
}

const results = [await run('nothing stale', []), await run('one stale claim', ['j1'])];
process.stdout.write(`${JSON.stringify(results)}\n`);
