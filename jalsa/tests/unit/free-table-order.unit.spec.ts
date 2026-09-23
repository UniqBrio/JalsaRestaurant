import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Starting a round on a table nobody is sitting at yet.
 *
 * WHAT WAS MISSING, AND WHAT WAS NOT
 *   `add-round` has always opened a bill for a table that has none — `ensureOpenBill` on the
 *   server, reached whenever the request carries no `billId`. The verb, the permission and the
 *   bill lifecycle were all in place. What was missing was a way in: the tables under "Free
 *   right now" were rendered as `<span>`, so the floor's most common event, a walk-in sitting
 *   down, was the one thing the captain could not start from the screen that lists it.
 *
 *   So this is a wiring change, and these cases pin the wiring. There is no new rule about who
 *   may open a bill, and no new bill lifecycle — asserting one here would invent a contract the
 *   server does not have.
 */

const FLOOR = readFileSync('src/features/staff/StaffTables.tsx', 'utf8');
const SHELL = readFileSync('src/features/staff/StaffApp.tsx', 'utf8');
const ROUTE = readFileSync('src/app/api/staff/action/route.ts', 'utf8');

/** The free-table list, from its heading to the end of the block that renders it. */
function freeList(): string {
  const start = FLOOR.indexOf('<SectionLabel>Free right now</SectionLabel>');
  expect(start, 'the free-tables block must still exist').toBeGreaterThan(-1);
  const slice = FLOOR.slice(start, start + 1600);
  expect(slice.length).toBeGreaterThan(400);
  return slice;
}

test('a free table is a control, not a label', () => {
  const list = freeList();
  expect(list, 'rendered as a button').toContain('<button');
  expect(list, 'and not as inert text').not.toContain('<span\n');
  expect(list, 'tapping it starts a round on that table').toContain('goFreeTable(t.id)');
  expect(list, 'addressable from a test and from the floor').toContain('data-testid={`staff-free-${t.id}`}');
});

test('the control is reachable and says what it does', () => {
  const list = freeList();
  // A chip a thumb can hit, and a name a screen reader can read. Neither is optional on a
  // surface used one-handed while standing.
  expect(list, 'a real touch target').toContain('min-h-11');
  expect(list, 'a focus ring for the keyboard').toContain('focus-visible:outline');
  expect(list, 'an accessible name that is not just the table code').toContain('aria-label={`Start a round on table');
  expect(list, 'the type is stated so it never submits a form').toContain('type="button"');
});

test('the table being seated is held apart from a bill that already exists', () => {
  // One slot holding "either a bill or a table" is the bug this avoids: every screen downstream
  // would have to guess which kind it holds, and the guess is invisible in a type.
  expect(SHELL).toContain('selectedTableId: string | null;');
  expect(SHELL).toContain('goFreeTable: (tableId: string) => void;');
  expect(SHELL, 'choosing a free table clears any bill').toContain('setSelectedBillId(null);');
  expect(SHELL, 'and choosing a bill clears the free table').toContain('setSelectedTableId(null);');
});

test('the menu screen accepts a table that has no bill yet', () => {
  const start = FLOOR.indexOf('export function AddItemsScreen(');
  expect(start).toBeGreaterThan(-1);
  const screen = FLOOR.slice(start, FLOOR.indexOf('\n}\n', start));
  expect(screen, 'the free table is resolved').toContain('const freeTable = bill ? null :');
  expect(screen, 'and only while it is genuinely free').toContain('!t.billId');
  expect(screen, 'either one is enough to order').toContain('if (!bill && !freeTable)');
  expect(screen, 'the round is addressed to the table when there is no bill').toContain('freeTable?.id');
});

test('the request omits a bill it does not have, and never invents one', () => {
  const start = FLOOR.indexOf("action: 'add-round',");
  expect(start).toBeGreaterThan(-1);
  const call = FLOOR.slice(start - 600, start + 400);
  expect(call, 'billId only when a bill exists').toContain('...(bill ? { billId: bill.id } : {})');
  expect(call, 'the table is always named').toContain('tableId,');
  // A client-invented bill id would be a bill nobody opened; the server owns that decision.
  expect(call).not.toContain("billId: ''");
});

test('the screen opens the bill the server just created, rather than waiting for a poll', () => {
  expect(ROUTE, 'the server answers with the bill it used or made').toContain('billId: bill.id');
  const start = FLOOR.indexOf("action: 'add-round',");
  const after = FLOOR.slice(start, start + 900);
  expect(after, 'and the screen navigates to exactly that bill').toContain("go('table', res.billId)");
  expect(after, 'not to a bill the screen guessed').not.toContain("go('table', bill.id)");
});

test('the header tells the truth about which of the two is happening', () => {
  // "A new round on the same bill" is a lie on a table with no bill, and the difference matters:
  // one adds to a tab, the other opens one.
  expect(SHELL).toContain('the bill opens when this round is sent');
  expect(SHELL).toContain('`New round · ${freeTable.name}`');
  expect(SHELL, 'the existing promise is kept for the existing case').toContain('A new round on the same bill');
});

test('back from a walk-in menu goes to the floor, not to a table screen with no bill', () => {
  expect(SHELL).toContain("go(tab === 'menu' && selectedBillId ? 'table' : 'floor')");
});
