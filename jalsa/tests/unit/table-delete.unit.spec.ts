import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/*
 * 28-Sep-2026 — "There is no delete option for table, enable it."
 *
 * The owner chose: Delete on every table, behind a confirmation, and the SERVER refuses a table
 * that has ever carried a bill or a KOT, pointing at "switch it off" instead. `bill_table`
 * cascades on a table delete, so without the refusal a used table would take its bills' table
 * membership with it, and `kot.table_id` (RESTRICT) would fail the delete with a raw error.
 */
const code = (p: string): string => readFileSync(p, 'utf8');
const mutations = code('src/lib/db/owner-mutations.ts');
const start = mutations.indexOf('export async function deleteTable');
const deleteTable = mutations.slice(start, mutations.indexOf('\n}\n', start) + 2);

test('the owner route carries delete-table into deleteTable', () => {
  const route = code('src/app/api/owner/action/route.ts');
  expect(route).toContain("| { action: 'delete-table'; id: string }");
  expect(route).toContain("case 'delete-table':");
  expect(route).toContain('await deleteTable({ id: input.id, actor })');
});

test('deleteTable needs the tables grant and only touches this restaurant', () => {
  expect(deleteTable).toContain("demand(input.actor, 'set.tables');");
  expect(deleteTable.match(/\.eq\('restaurant_id', restaurantId\)/g)?.length).toBe(2);
});

test('a table that has carried a bill or a KOT is refused BEFORE anything is deleted', () => {
  const refuse = deleteTable.indexOf('cannot be deleted');
  const del = deleteTable.indexOf('.delete()');
  expect(deleteTable).toContain("from('bill_table')");
  expect(deleteTable).toContain("from('kot')");
  expect(refuse).toBeGreaterThan(-1);
  expect(del).toBeGreaterThan(refuse);
  expect(deleteTable).toContain('Switch it off instead');
});

test('the table sheet offers Delete for an existing table, behind a confirmation', () => {
  const ui = code('src/features/owner/sections/SettingsSection.tsx');
  expect(ui).toContain('data-testid="owner-table-delete"');
  expect(ui).toContain('testId="owner-table-delete-confirm"');
  expect(ui).toContain("{ action: 'delete-table', id: deleting.id }");
  // Only an existing table: a new one has nothing to delete.
  expect(ui).toContain('{editing?.id ? (');
});
