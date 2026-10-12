/**
 * "Move to another table" on the captain's floor (12-Oct-2026): "From table A1, the customer wants
 * to sit at A2 - migrate all orders to A2."
 *
 * The REAL FloorScreen and the REAL MoveTableDialog are bundled (mounts/move-floor.entry.tsx) onto a
 * page carrying the app's stylesheet and driven with real taps, in both themes, at phone width.
 *
 * FAIL-FIRST (observed 12-Oct-2026, `src/` stashed to the tree before this change): 4 of 5 fail
 * waiting for `staff-move-table-A1` - there was no way to move an order. NOT OBSERVED FAILING, by
 * design: "without the grant there is no Move button" (there was no button for anybody).
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/move-floor.entry.tsx', import.meta.url));

const tile = (name: string, over: Record<string, unknown> = {}) => ({
  id: `t-${name}`,
  name,
  seats: 4,
  active: true,
  state: 'free',
  billId: null,
  groupCode: null,
  guests: 0,
  roundCount: 0,
  readyCount: 0,
  openRequests: 0,
  hasOccasion: false,
  clearing: null,
  phonesAttached: 0,
  stateLabel: 'Free',
  tone: 'neutral',
  totalLabel: '—',
  ...over,
});
const busy = (name: string) =>
  tile(name, { state: 'in_the_kitchen', billId: `b-${name}`, guests: 2, roundCount: 1, phonesAttached: 1, stateLabel: 'In the kitchen', tone: 'warning', totalLabel: '₹315' });
const TABLES = [
  busy('A1'),
  tile('A2'),
  busy('A3'),
  tile('A4', { state: 'clearing', clearing: { releasedAtIso: '2026-10-12T08:00:00Z', billCode: 'B-0400', guests: 2, waitedMinutes: 5 } }),
  tile('A5', { phonesAttached: 1 }),
  tile('A6', { active: false }),
  tile('A7'),
];

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, theme: 'light' | 'dark', grants = ['tables.transfer']) {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.evaluate(
    ({ tables, grants }) => {
      (window as unknown as { __tables: unknown[] }).__tables = tables;
      (window as unknown as { __grants: string[] }).__grants = grants;
    },
    { tables: TABLES, grants }
  );
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('staff-table-A1')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => window.__moveSent);

for (const theme of ['light', 'dark'] as const) {
  test(`Move sits under its own table, offers only free tables, and sends nothing until confirmed (${theme})`, async ({ page }) => {
    await mount(page, theme);
    const tileBox = (await page.getByTestId('staff-table-A1').boundingBox())!;
    const button = page.getByTestId('staff-move-table-A1');
    await expect(button).toHaveText('Move to another table');
    const buttonBox = (await button.boundingBox())!;
    expect(buttonBox.y).toBeGreaterThanOrEqual(tileBox.y + tileBox.height - 1);
    expect(Math.abs(buttonBox.x - tileBox.x)).toBeLessThan(2);

    await button.click();
    const dialog = page.getByTestId('staff-move-table');
    // SUPERSEDED 12-Oct-2026 (copy review, same day): asserted "Move table A1's order", the heading 'Move to'
    // and the toast 'B-0412 moved from A1 to A2. A1 needs clearing.'
    await expect(dialog).toContainText('Move the order on table A1?');
    await expect(dialog).toContainText('Free right now');
    // Free and cleared, no phone with an unsent order, on the floor, not itself: A2 and A7 only.
    const chips = await dialog.locator('[data-testid^="staff-move-table-reason-"]').allTextContents();
    expect(chips).toEqual(['A2', 'A7']);
    await expect(page.getByTestId('staff-move-table-confirm')).toHaveText('Choose a table');
    await expect(page.getByTestId('staff-move-table-confirm')).toBeDisabled();

    await page.getByTestId('staff-move-table-reason-a2').click();
    await expect(page.getByTestId('staff-move-table-confirm')).toHaveText('Move to A2');
    expect(await sent(page)).toEqual([]);
    await page.getByTestId('staff-move-table-confirm').click();
    await expect(page.getByText('B-0412 moved to table A2. Table A1 needs clearing.')).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await sent(page)).toEqual([{ action: 'move-table', billId: 'b-A1', fromTableId: 't-A1', toTableId: 't-A2' }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('"Cancel" closes it and sends nothing', async ({ page }) => {
  await mount(page, 'light');
  await page.getByTestId('staff-move-table-A1').click();
  await page.getByTestId('staff-move-table-reason-a7').click();
  await page.getByTestId('staff-move-table-keep').click();
  await expect(page.getByTestId('staff-move-table')).toHaveCount(0);
  expect(await sent(page)).toEqual([]);
});

test('a table taken in the meantime is refused in words', async ({ page }) => {
  await mount(page, 'light');
  await page.evaluate(() => (window.__moveAnswer = 'taken'));
  await page.getByTestId('staff-move-table-A1').click();
  await page.getByTestId('staff-move-table-reason-a2').click();
  await page.getByTestId('staff-move-table-confirm').click();
  await expect(page.getByText('That table is no longer free. Choose another.')).toBeVisible();
});

test('without "Move a bill to another table" there is no Move button', async ({ page }) => {
  await mount(page, 'light', ['tables.free', 'orders.cancel_after']);
  await expect(page.getByTestId('staff-move-table-A1')).toHaveCount(0);
});
