/**
 * Delete a menu item (12-Oct-2026) - bundled and run by tests/unit/corrections-12oct.unit.spec.ts.
 * Calls the REAL `deleteMenuItem` against fake-supabase and reports every read and write.
 */
import { deleteMenuItem } from '@/lib/db/owner-mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const ITEM = '44444444-4444-4444-8444-444444444444';

type Log = Array<{ table: string; op: string; body: unknown; filters: string[] }>;

/** `deleted`: how many menu_item rows the delete reports removing. */
function responder(deleted: number, log: Log) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    log.push({ table: q.table, op: q.op, body: q.body, filters: q.filters.map(([k, c, v]) => `${k}:${c}=${JSON.stringify(v)}`) });
    if (q.table === 'menu_item' && q.op === 'delete') return Array.from({ length: deleted }, () => ({ name: 'Paneer Tikka' }));
    return [];
  };
}

const actor = (grants: string[]) => ({ staffId: 'st1', label: 'Ravi', grants: { can: (k: string) => grants.includes(k) } });

async function run(name: string, deleted: number, grants: string[]) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const log: Log = [];
  db.respond = responder(deleted, log);
  try {
    return { name, out: (await deleteMenuItem({ id: ITEM, actor: actor(grants) })) ?? null, threw: null, log };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err), log };
  }
}

const results = [
  await run('delete without menu.item_edit', 1, ['menu.availability']),
  await run('delete', 1, ['menu.item_edit']),
  await run('delete, already gone', 0, ['menu.item_edit']),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
