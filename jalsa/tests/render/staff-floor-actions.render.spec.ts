/**
 * The captain's floor: a table's action buttons sit UNDER their own tile, never over another
 * (08-Oct-2026, seen in production on the first day of "Cancel order & free table").
 *
 * WHAT WENT WRONG: each tile was `h-full` inside its grid cell, so the cell's whole height went to
 * the tile and a button placed after it spilled out of the cell - over the tile below (A1's button
 * hidden under A5), into an empty slot (A2's), and across the legend text (A5's). "Mark free" has
 * always had the same structure; it was only rarely on screen.
 *
 * The REAL FloorScreen is bundled (tests/render/mounts/staff-floor.entry.tsx) onto a page carrying
 * the app's stylesheet, with the floor from the screenshot: A1 and A2 with one round each, A5 with
 * six, plus a table with nothing ordered (Mark free).
 *
 * FAIL-FIRST: run against main at 1a0e229 (before the fix) - observed failing 08-Oct-2026 in all
 * three viewports with "staff-cancel-order-A1 overlaps tile A5", the overlap in the screenshot.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/staff-floor.entry.tsx', import.meta.url));

const table = (name: string, roundCount: number, total: string) => ({
  id: `t-${name}`,
  name,
  seats: 4,
  active: true,
  billId: `b-${name}`,
  groupCode: null,
  guests: 2,
  roundCount,
  readyCount: 0,
  openRequests: 0,
  hasOccasion: false,
  clearing: null,
  phonesAttached: 1,
  stateLabel: roundCount ? 'In the kitchen' : 'Ordering',
  tone: roundCount ? 'warning' : 'neutral',
  totalLabel: total,
});
const TABLES = [table('A1', 1, '₹315'), table('A2', 1, '₹462'), table('A5', 6, '₹1,811'), table('A7', 0, '—')];
const GRANTS = ['tables.free', 'orders.cancel_after'];

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, width: number, theme: 'light' | 'dark') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.evaluate(
    ({ tables, grants }) => {
      (window as unknown as { __tables: unknown[] }).__tables = tables;
      (window as unknown as { __grants: string[] }).__grants = grants;
    },
    { tables: TABLES, grants: GRANTS }
  );
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('staff-floor')).toBeVisible();
}

const box = async (page: Page, testId: string) => {
  const b = await page.getByTestId(testId).boundingBox();
  expect(b, testId).not.toBeNull();
  return b!;
};
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

for (const [width, theme] of [
  [390, 'light'],
  [390, 'dark'],
  [608, 'light'],
] as const) {
  test(`each table's button sits under its own tile and over nothing else (${width}px, ${theme})`, async ({ page }) => {
    await mount(page, width, theme);
    const buttons = [
      ['A1', 'staff-cancel-order-A1'],
      ['A2', 'staff-cancel-order-A2'],
      ['A5', 'staff-cancel-order-A5'],
      ['A7', 'staff-free-table-A7'],
    ] as const;
    const tiles = await Promise.all(TABLES.map(async (t) => [t.name, await box(page, `staff-table-${t.name}`)] as const));
    for (const [name, id] of buttons) {
      const btn = await box(page, id);
      const own = tiles.find(([n]) => n === name)![1];
      // Directly under its own tile, in the same column.
      expect(btn.y, `${id} starts below its tile`).toBeGreaterThanOrEqual(own.y + own.height - 0.5);
      expect(Math.abs(btn.x - own.x), `${id} is in its tile's column`).toBeLessThan(1);
      expect(btn.y - (own.y + own.height), `${id} is right under its tile`).toBeLessThan(16);
      // Over no other tile, and over no other button.
      for (const [other, b] of tiles) if (other !== name) expect(overlaps(btn, b), `${id} overlaps tile ${other}`).toBe(false);
      for (const [, otherId] of buttons) if (otherId !== id) expect(overlaps(btn, await box(page, otherId)), `${id} overlaps ${otherId}`).toBe(false);
    }
    // And the legend under the grid is not covered by any button.
    const legend = page.getByText('Amber means the kitchen has work');
    const lb = (await legend.boundingBox())!;
    for (const [, id] of buttons) expect(overlaps(await box(page, id), lb), `${id} covers the legend`).toBe(false);
    // The button the screenshot lost under A5 is actually clickable.
    await page.getByTestId('staff-cancel-order-A1').click({ trial: true });
  });
}
