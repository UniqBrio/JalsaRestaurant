/**
 * Delete and edit a menu item through the REAL owner action route (12-Oct-2026, code review) -
 * bundled and run by tests/unit/corrections-12oct.unit.spec.ts. What the owner's screen is told
 * when the dish is already gone: the route's status and message, not only what the mutation threw.
 */
import { POST as ownerAction } from '@/app/api/owner/action/route';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { staff?: unknown; guestToken?: string | null } };

const ITEM = '44444444-4444-4444-8444-444444444444';
const owner = { staffId: 'st1', name: 'Ravi', role: 'Owner', initials: 'RA', provisional: false, issuedAt: 0 };
const GRANTS = ['menu.item_edit', 'menu.price_edit', 'orders.view'];

/** `rows`: how many menu_item rows a delete, read or update finds. */
function responder(rows: number, log: string[]) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    log.push(`${q.table}:${q.op}`);
    switch (q.table) {
      case 'staff':
        return [{ id: 'st1', active: true, removed_at: null, pin_provisional: false }];
      case 'staff_permission':
        return GRANTS.map((perm_key) => ({ perm_key, staff_id: 'st1' }));
      case 'menu_food_type':
        return [{ id: 'f1', restaurant_id: 'r1', kot_class: 'veg' }];
      case 'menu_item':
        return Array.from({ length: rows }, () => ({ id: ITEM, name: 'Paneer Tikka', price: 240, image_url: '' }));
      default:
        return [];
    }
  };
}

async function run(name: string, rows: number, body: unknown) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const log: string[] = [];
  db.respond = responder(rows, log);
  g.__fakeSession = { staff: owner };
  try {
    const res = await ownerAction(
      new Request('http://localhost/api/owner/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({}) }
    );
    return { name, status: res.status, body: await res.text(), log, threw: null };
  } catch (err) {
    return { name, status: 0, body: '', log, threw: err instanceof Error ? err.message : String(err) };
  }
}

const EDIT = { action: 'upsert-item', id: ITEM, name: 'Paneer Tikka', price: 240, categoryId: 'c1', foodTypeId: 'f1' };

const results = [
  await run('delete, already gone', 0, { action: 'delete-item', id: ITEM }),
  await run('delete, not an id', 1, { action: 'delete-item', id: "1' or '1'='1" }),
  await run('edit, deleted from another screen', 0, EDIT),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
