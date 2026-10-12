/**
 * Move a running order to another table (12-Oct-2026): "From table A1, the customer wants to sit at
 * A2 - migrate all orders to A2."
 *
 * The move itself is proven in the database (table-move.db.unit.spec.ts). Here: the REAL mutation,
 * the REAL staff and owner routes and the REAL guest context on the round rig
 * (table-move.scenarios.ts), and the pure rules the two floors share.
 *
 * FAIL-FIRST (observed 12-Oct-2026, `src/` stashed to the tree before this change): the file fails
 * before any case runs - `Cannot find module '.../src/lib/table-move'`.
 * The receipt case was also run on its own against the previous `lastClosedOnTable`: it returned
 * the moved-away bill (Received {"billId": ..., "closedAt": ...}, Expected null) - a stranger at A1
 * would have been shown the receipt of the party that moved to A2.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import {
  TABLE_MOVE_GRANT,
  TABLE_MOVE_MESSAGES,
  tableIsMovable,
  tableMoveTargets,
  tableMovedMessage,
} from '../../src/lib/table-move';
import { ROLE_PRESETS } from '../../src/lib/permissions';

interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  log: Array<{ table: string; op: string; body: Record<string, unknown> | null; cols: string; filters: string[] }>;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/table-move.scenarios.ts', import.meta.url));
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};
const rpcs = (r: Result) => r.log.filter((l) => l.op === 'rpc');
const writes = (r: Result) => r.log.filter((l) => l.op !== 'select' && l.op !== 'rpc');

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

/* ── The server ─────────────────────────────────────────────────────────────────────────────── */

test('moving needs "Move a bill to another table", and nothing is asked without it', () => {
  const r = by('move without tables.transfer');
  expect(r.threw).toMatch(/^PermissionDenied/);
  expect(r.log).toEqual([]);
});

test('ids that are not ids are refused in words before the database is asked', () => {
  const r = by('move with ids that are not ids');
  expect(r.threw).toBe(`OrderNotLive: ${TABLE_MOVE_MESSAGES.notHere}`);
  expect(r.log).toEqual([]);
});

test('a move is one database call, scoped to this restaurant, by a named person', () => {
  const r = by('move');
  expect(r.threw).toBeNull();
  expect(r.out).toEqual({ billCode: 'B-0412', from: 'A1', to: 'A2' });
  expect(rpcs(r)).toHaveLength(1);
  expect(rpcs(r)[0]).toMatchObject({ table: 'move_bill_to_table' });
  expect(rpcs(r)[0]!.body).toMatchObject({
    p_restaurant_id: 'r1',
    p_bill_id: '11111111-1111-4111-8111-111111111111',
    p_from_table_id: '22222222-2222-4222-8222-222222222222',
    p_to_table_id: '33333333-3333-4333-8333-333333333333',
    p_actor_staff_id: 'st1',
    p_actor_label: 'Ravi',
  });
  // Everything else happens inside that one transaction - no write of its own here.
  expect(writes(r)).toEqual([]);
});

test('every refusal from the database is said in words the person can act on', () => {
  expect(by('move onto a taken table').threw).toBe(`OrderNotLive: ${TABLE_MOVE_MESSAGES.taken}`);
  expect(by('move onto a table needing clearing').threw).toBe(`OrderNotLive: ${TABLE_MOVE_MESSAGES.needsClearing}`);
  expect(by('move a paid order').threw).toBe(`OrderNotLive: ${TABLE_MOVE_MESSAGES.gone}`);
  expect(by('move from a table that no longer holds it').threw).toBe(`OrderNotLive: ${TABLE_MOVE_MESSAGES.notHere}`);
});

test('captains and the owner move through their own routes: 200 moved, 409 in words, 403 without the grant', () => {
  const ok = by('captain route, moved').out as { status: number; body: string };
  expect(ok.status).toBe(200);
  expect(JSON.parse(ok.body)).toMatchObject({ done: true, billCode: 'B-0412', from: 'A1', to: 'A2' });
  const taken = by('captain route, taken').out as { status: number; body: string };
  expect(taken.status).toBe(409);
  expect(JSON.parse(taken.body)).toMatchObject({ code: 'conflict', message: TABLE_MOVE_MESSAGES.taken });
  const denied = by('captain route, no grant').out as { status: number; body: string };
  expect(denied.status).toBe(403);
  expect(JSON.parse(denied.body)).toMatchObject({ permission: 'tables.transfer' });
  expect(rpcs(by('captain route, no grant'))).toEqual([]);
  expect((by('owner route, moved').out as { status: number }).status).toBe(200);
});

/* ── The guests' phones ─────────────────────────────────────────────────────────────────────── */

test("a phone still on the old table's page is sent to its order's new table, and nothing is written", () => {
  const r = by('a moved phone on the old table page');
  expect(r.threw).toBeNull();
  expect(r.out).toMatchObject({ phase: 'moved', movedTo: 'A2' });
  // Not deleted, not re-created on A1: that is what would have opened a second bill on A1.
  expect(writes(r)).toEqual([]);
});

test('only while that order is running, and only for a phone staff moved', () => {
  expect(by('a moved phone whose order was since paid').out).toMatchObject({ phase: 'welcome' });
  // A phone a guest carried to another table themselves starts fresh, as it always has.
  expect(by('a phone that walked to another table itself').out).toMatchObject({ phase: 'welcome' });
});

test('arriving at the new table clears the marker, in the update it already makes', () => {
  const r = by('a moved phone arriving at its new table');
  const update = writes(r).find((l) => l.table === 'guest_session' && l.op === 'update');
  expect(update?.body).toMatchObject({ moved_from_table_id: null });
  expect(writes(r).filter((l) => l.table === 'guest_session')).toHaveLength(1);
});

test('a database without the migration yet still serves every guest page, as before', () => {
  const r = by('a phone on a database without the migration');
  expect(r.threw).toBeNull();
  expect(r.out).toMatchObject({ phase: 'welcome' });
  // Asked with the new column, refused as a schema fault, asked again as before.
  const reads = r.log.filter((l) => l.table === 'guest_session' && l.op === 'select');
  expect(reads.map((l) => l.cols.includes('moved_from_table_id'))).toEqual([true, false]);
});

test('a paid bill that was moved lists the table it was paid at, not a group of two', () => {
  // FAIL-FIRST (observed 12-Oct-2026, `queries.ts` at fcf5b8e): Received ['A1', 'A2'] - the paid
  // bill read as a group of two.
  const r = by('a paid bill that was moved');
  expect(r.threw).toBeNull();
  expect((r.out as { tables: string[] }).tables).toEqual(['A2']);
});

test("the next guest at the old table never sees the moved party's receipt", () => {
  expect(by('receipt of an order moved away and paid later').out).toBeNull();
  expect(by('receipt of an order paid here').out).toMatchObject({ billId: '11111111-1111-4111-8111-111111111111' });
});

/* ── What the floors offer ──────────────────────────────────────────────────────────────────── */

const tile = (name: string, over: Partial<{ active: boolean; billId: string | null; state: string; phonesAttached: number }> = {}) => ({
  id: `id-${name}`,
  name,
  active: true,
  billId: null,
  state: 'free',
  phonesAttached: 0,
  ...over,
});

test('Move is offered on a table holding an order, to a person with the grant', () => {
  expect(TABLE_MOVE_GRANT).toBe('tables.transfer');
  expect(tableIsMovable({ billId: 'b1' }, ['tables.transfer'])).toBe(true);
  expect(tableIsMovable({ billId: 'b1' }, ['tables.free', 'orders.cancel_after'])).toBe(false);
  expect(tableIsMovable({ billId: null }, ['tables.transfer'])).toBe(false);
});

test('only free tables are offered: no order, nothing to clear, no phone with an unsent order, on the floor, not itself', () => {
  const floor = [
    tile('A1', { billId: 'b1', state: 'in_the_kitchen' }),
    tile('A2'),
    tile('A3', { billId: 'b3', state: 'served' }),
    tile('A4', { state: 'clearing' }),
    tile('A5', { phonesAttached: 1 }),
    tile('A6', { active: false }),
    tile('A7'),
  ];
  expect(tableMoveTargets(floor, 'id-A1').map((t) => t.name)).toEqual(['A2', 'A7']);
  expect(tableMoveTargets(floor, 'id-A2').map((t) => t.name)).toEqual(['A7']);
});

test('captains may move a party by default; waiters, chefs and cashiers may not', () => {
  expect(ROLE_PRESETS.Captain).toContain('tables.transfer');
  for (const role of ['Waiter', 'Chef', 'Cashier'] as const) expect(ROLE_PRESETS[role], role).not.toContain('tables.transfer');
});

test('the confirmation says where the order went and that the old table needs clearing', () => {
  // SUPERSEDED 12-Oct-2026 (copy review, same day): asserted 'B-0412 moved from A1 to A2. A1 needs clearing.'
  expect(tableMovedMessage('B-0412', 'A1', 'A2')).toBe('B-0412 moved to table A2. Table A1 needs clearing.');
});
