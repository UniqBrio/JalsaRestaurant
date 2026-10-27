/**
 * A long table opens with its first screen of rows, and has every row a moment later
 * (27-Oct-2026, requests/2026-10-27-performance-security-delivery.md, P-7).
 *
 * WHY: the owner's Menu (57 rows, 1,523 of the page's 1,780 elements) built every row inside the
 * click that opened it. On a 4x slower CPU the click took 472 ms p50 / 576 p95 to its next paint;
 * with the first 24 rows in that commit and the rest in a background pass, 360 / 440 (n=10 each,
 * docs/audit/PERFORMANCE_OPTIMIZATION_REPORT.md). The REAL DataTable is mounted here.
 *
 * FAIL-FIRST: against the pre-change DataTable the first rung fails — the first commit held all 57.
 * The rest held before and must hold after (the table that results is the same table).
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/data-table.entry.tsx', import.meta.url));
let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page) {
  await page.goto('/');
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('probe-table')).toBeVisible();
}
const rowCount = (page: Page) => page.locator('[data-testid="probe-table"] tbody tr').count();

test('the first commit holds the first screen of rows, not all 57', async ({ page }) => {
  await mount(page);
  const first = await page.evaluate(() => window.__firstCommitRows);
  expect(first).toBe(24);
});

test('every row arrives straight after, in order, and nothing on the toolbar ever counted fewer', async ({
  page,
}) => {
  await mount(page);
  await expect.poll(() => rowCount(page)).toBe(57);
  const names = await page.locator('[data-testid="probe-table"] tbody tr td:first-child').allTextContents();
  expect(names).toEqual(Array.from({ length: 57 }, (_, i) => `Dish ${String(i).padStart(2, '0')}`));
  await expect(page.getByTestId('probe-table-export')).toHaveText('Export 57 rows');
});

test('once complete, a search cleared shows every row at once — never the first screen again', async ({ page }) => {
  await mount(page);
  await expect.poll(() => rowCount(page)).toBe(57);
  const box = page.getByTestId('probe-table-search');
  await box.fill('Dish 5');
  await expect.poll(() => rowCount(page)).toBe(7);
  await box.fill('');
  expect(await rowCount(page), 'counted in the same task as the clear').toBe(57);
});
