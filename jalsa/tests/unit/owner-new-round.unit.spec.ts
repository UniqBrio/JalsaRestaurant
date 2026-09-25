import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * The owner seats a walk-in from their own floor.
 *
 * The captain's phone gained this first; this is the same operation reached from the dashboard,
 * for the table nobody is on the floor for. The cases below exist to hold two lines that are
 * easy to cross later:
 *
 *   1. ONE ordering operation, not two. The route calls `ensureOpenBill` then `placeRound`, the
 *      same pair the captain's route calls. A second implementation is how two surfaces end up
 *      disagreeing about what a round costs.
 *   2. The permission is checked where the rule lives — inside `placeRound` — and the control is
 *      merely OFFERED on the grant. A second check at the door is a second thing to forget.
 */

const ROUTE = readFileSync('src/app/api/owner/action/route.ts', 'utf8');
const DASH = readFileSync('src/features/owner/sections/Dashboard.tsx', 'utf8');

/** The owner route's add-round case. */
function verb(): string {
  const start = ROUTE.indexOf("    case 'add-round': {");
  expect(start, 'the owner route must carry the verb').toBeGreaterThan(-1);
  const slice = ROUTE.slice(start, ROUTE.indexOf("    case 'free-table'", start));
  expect(slice.length).toBeGreaterThan(300);
  return slice;
}

test('the owner route opens the bill and places the round, reusing the one operation', () => {
  const v = verb();
  /* SUPERSEDED 24-Sep-2026 (G2): previously asserted `ensureOpenBill(input.tableId)`. The helper
     now takes who is opening the bill, so "Bill opened" names the owner instead of the guest's
     phone. Same helper, one more argument. */
  expect(v, 'the bill is opened by the same helper the captain uses').toContain(
    'ensureOpenBill(input.tableId, { actor })'
  );
  expect(v, 'and the round placed by the same one').toContain('placeRound({');
  expect(v, 'stamped as the owner, which the bill and every report read').toContain("source: 'owner'");
});

test('the verb has no second mode nothing calls', () => {
  const v = verb();
  // This door exists for a table with NO bill. Adding to an existing bill is the captain's
  // screen; a branch here for it would never be walked and never be tested.
  expect(v).not.toContain('input.billId');
  expect(ROUTE, 'and the request shape says so').toContain(
    "| { action: 'add-round'; tableId: string; lines: Array<{ menuItemId: string; qty: number }> }"
  );
});

test('an empty round and an off-menu round are both refused with a reason', () => {
  const v = verb();
  expect(v, 'nothing sent is a conflict, not a success').toContain("code: 'conflict'");
  expect(v, 'and it names what was off the menu').toContain('placed.refused.join');
});

test('the response carries the bill it may have just created', () => {
  const v = verb();
  expect(v).toContain('billId: bill.id');
  expect(DASH, 'and the dashboard opens exactly that bill').toContain("go('orders', res.billId)");
});

test('a free table on the owner floor is a way in, and an off-duty one is not', () => {
  expect(DASH, 'seated opens its bill, free starts a round').toContain(
    "onClick={() => (t.billId ? go('orders', t.billId) : setSeating(t))}"
  );
  // `active` is the day-setup switch. A table that is off tonight stays inert even for someone
  // holding the grant, which is what turning it off meant.
  /* SUPERSEDED 24-Sep-2026 (C1): previously asserted `!(canOrder && t.active)`. A table waiting
     to be cleared is no longer offered as free - the rule the queue's Seat sheet already used. */
  expect(DASH).toContain('disabled={!t.billId && !(canOrder && t.active && t.clearing === null)}');
});

test('the control is offered on the grant, and the rule still lives in the operation', () => {
  expect(DASH, 'offered only where the grant is held').toContain("data.grants.includes('orders.add_items')");
  // Standard 5.6: offer only what can be done. But the route must NOT re-check — placeRound
  // demands it for every non-guest source, and two copies drift.
  expect(verb(), 'no second permission check at the door').not.toContain('demand(');
  expect(verb()).not.toContain("grants.can('orders.add_items')");
});

test('the round is one request, so an empty bill can never be left behind', () => {
  // No "open the bill" step of its own: a bill opened by a separate call is a tab on a table
  // nobody is sitting at, waiting for somebody to notice and free it.
  const start = DASH.indexOf("action: 'add-round',");
  expect(start).toBeGreaterThan(-1);
  const call = DASH.slice(start - 500, start + 300);
  expect(call).toContain("'/api/owner/action'");
  expect(call, 'the table is named and nothing else is invented').toContain('tableId: table.id');
  expect(DASH, 'there is no separate open-bill call').not.toContain("action: 'open-bill'");
});

test('the sheet cannot send a cart belonging to another table', () => {
  // Remounted per table rather than reset in an effect, which would be a render that fixes a
  // render — and the lint rule that forbids it is right.
  expect(DASH).toContain("key={seating?.id ?? 'none'}");
  expect(DASH, 'and nothing is sent until something is picked').toContain('disabled={busy || count === 0 || !table}');
});

test('sold-out dishes are shown as sold out, not hidden', () => {
  // A dish that silently vanishes from the menu reads as a bug; the captain's screen makes the
  // same choice, and the two surfaces should not teach different things.
  expect(DASH).toContain('Out of stock — off the menu tonight');
  expect(DASH).toContain('<Pill tone="neutral">Sold out</Pill>');
});
