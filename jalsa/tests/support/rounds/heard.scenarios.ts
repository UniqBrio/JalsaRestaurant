/**
 * "How did you hear about us?" write scenarios (02-Oct-2026) - bundled and run by
 * tests/unit/heard-attribution.unit.spec.ts. Calls the REAL `recordHeardAbout` and
 * `dismissHeardAbout` against fake-supabase and reports every write.
 */
import { dismissHeardAbout, recordHeardAbout } from '@/lib/db/mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

interface World {
  /** This phone already answered within the correction window (its attribution row id). */
  recent?: string;
}

function responder(world: World, writes: Array<{ table: string; op: string; body: unknown; filters: string[] }>) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    if (q.op !== 'select') {
      writes.push({ table: q.table, op: q.op, body: q.body, filters: q.filters.map(([k, c, v]) => `${k}:${c}=${String(v)}`) });
    }
    switch (q.table) {
      case 'guest_session':
        return q.op === 'update'
          ? [{ id: 's1', restaurant_id: 'r1', token: 'phone-a', table_id: 't1', bill_id: 'b1' }]
          : [];
      case 'guest_attribution':
        if (q.op === 'select') return world.recent ? [{ id: world.recent }] : [];
        return [];
      default:
        return [];
    }
  };
}

async function run(name: string, world: World, call: () => Promise<void>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const writes: Array<{ table: string; op: string; body: unknown; filters: string[] }> = [];
  db.respond = responder(world, writes);
  try {
    await call();
    return { name, threw: null, writes };
  } catch (err) {
    return { name, threw: err instanceof Error ? err.message : String(err), writes };
  }
}

const results = [
  await run('first answer', {}, () => recordHeardAbout({ sessionId: 's1', source: '  Google review ' })),
  await run('re-picked in the same sitting', { recent: 'a1' }, () => recordHeardAbout({ sessionId: 's1', source: 'Instagram' })),
  await run('cleared in the same sitting', { recent: 'a1' }, () => recordHeardAbout({ sessionId: 's1', source: '' })),
  await run('not now', {}, () => dismissHeardAbout({ sessionId: 's1' })),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
