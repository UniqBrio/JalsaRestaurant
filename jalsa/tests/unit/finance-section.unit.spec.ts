import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dayInRange, expensesInRange } from '../../src/lib/report-range';

/**
 * Expenses becomes Income & expenses (24-Sep correction list, H1).
 *
 * Income is the closed bills' revenue, read from the same report the Reports section reads - never
 * entered by hand, so a bill cannot be counted twice. Expenses are the existing ledger, filtered
 * to the same range by the same predicate the report's SQL uses. Net is the report's own figure.
 */

const RANGE = { from: '2026-09-01', to: '2026-09-24' };
const ROWS = [
  { id: 'a', spentOn: '2026-08-31', amount: 500 },
  { id: 'b', spentOn: '2026-09-01', amount: 1200 },
  { id: 'c', spentOn: '2026-09-24', amount: 300 },
  { id: 'd', spentOn: '2026-09-25', amount: 999 },
];

test('both ends of the range are included, and nothing outside it', () => {
  expect(dayInRange('2026-09-01', RANGE)).toBe(true);
  expect(dayInRange('2026-09-24', RANGE)).toBe(true);
  expect(dayInRange('2026-08-31', RANGE)).toBe(false);
  expect(dayInRange('2026-09-25', RANGE)).toBe(false);
});

test('the ledger and its total are the range, not everything ever entered', () => {
  const { rows, total } = expensesInRange(ROWS, RANGE);
  expect(rows.map((r) => r.id)).toEqual(['b', 'c']);
  expect(total).toBe(1500);
  expect(expensesInRange(ROWS, { from: '2026-10-01', to: '2026-10-31' })).toEqual({ rows: [], total: 0 });
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('the same predicate as the report: spent_on between from and to, inclusive', () => {
  const q = code('src/lib/db/queries.ts');
  const fn = q.slice(q.indexOf('export async function listExpensesBetween'));
  expect(fn).toMatch(/\.gte\('spent_on', from\)\s*\.lte\('spent_on', to\)/);
});

test('income is READ from the closed-bill report, never entered, and gated like it', () => {
  const ui = code('src/features/owner/sections/LedgersSection.tsx');
  expect(ui).toContain('fetch(`/api/owner/report?from=${from}&to=${to}`)');
  expect(ui).toContain("const canSeeIncome = data.grants.includes('rep.sales');");
  expect(ui).toContain('figures.summary.salesLabel');
  expect(ui).toContain('figures.summary.netLabel');
  expect(ui).toContain('rows={inRange.rows}');
  // No income ledger: nothing on this screen writes an income row.
  expect(ui).not.toMatch(/action: 'upsert-income'|from\('income'\)/);
  expect(code('src/features/owner/OwnerConsole.tsx')).toContain("label: 'Income & expenses'");
});
