import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/*
 * 28-Sep-2026 — "Needs clearing" on the owner console had no way out.
 *
 * The captain's app has had "Mark it clear" (clear-table, behind `tables.clear`) since the
 * clearing state existed, in its To clear list. The owner console showed the same tables as
 * "Needs clearing" on the dashboard and offered nothing: Mark free is a different operation
 * (`tables.free`, for a table holding an empty bill or a phone's cart) and is not offered on a
 * released table, and the owner action route had no clear-table verb at all. The owner holds
 * `tables.clear` and had nowhere in the console to use it. Same verb, same grant, same string.
 */
const code = (p: string): string => readFileSync(p, 'utf8');

test('the owner action route carries clear-table, guarded in clearTable like the staff route', () => {
  const route = code('src/app/api/owner/action/route.ts');
  expect(route).toContain("| { action: 'clear-table'; tableId: string }");
  expect(route).toContain("case 'clear-table':");
  expect(route).toContain('await clearTable({ tableId: input.tableId, actor });');
});

test('a "Needs clearing" table on the dashboard offers "Mark it clear" to whoever holds tables.clear', () => {
  const dash = code('src/features/owner/sections/Dashboard.tsx');
  expect(dash).toContain("const canClear = data.grants.includes('tables.clear');");
  expect(dash).toContain('{canClear && t.clearing ? (');
  expect(dash).toContain('data-testid={`owner-clear-table-${t.name}`}');
  expect(dash).toContain("{ action: 'clear-table', tableId: t.id }");
  // The freeze rule: the captain's string, not a new one.
  expect(dash).toContain('Mark it clear');
  expect(code('src/features/staff/StaffLists.tsx')).toContain('Mark it clear');
});

/*
 * 28-Sep-2026 (later) — "the button is not appearing as a button": the ghost variant is bare
 * text under the card, with no border and nothing to tell it from the caption above it. The
 * two floor actions take the bordered `secondary` variant, so a control reads as a control.
 */
test('the floor actions under a card are bordered buttons, not bare text', () => {
  const dash = code('src/features/owner/sections/Dashboard.tsx');
  const clear = dash.slice(dash.indexOf('data-testid={`owner-clear-table-${t.name}`}'), dash.indexOf('Mark it clear'));
  const free = dash.slice(dash.indexOf('data-testid={`owner-free-table-${t.name}`}'), dash.indexOf('Mark free\n'));
  expect(clear).toContain('variant="secondary"');
  expect(free).toContain('variant="secondary"');
});
