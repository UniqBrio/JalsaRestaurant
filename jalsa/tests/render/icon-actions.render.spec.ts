/**
 * The 13-Oct-2026 menu corrections, mounted for real: a dish OFF the customer menu is deleted from
 * the "Off the customer menu right now" strip without being put back first, and Edit and Delete
 * are icons only - with their words kept as the accessible name and the tooltip.
 *
 * The REAL owner Menu section is bundled (tests/render/mounts/icon-actions.entry.tsx) onto a page
 * carrying the app's stylesheet and driven with real taps, in both themes.
 *
 * FAIL-FIRST: recorded in the root TEST_SUMMARY.md (13-Oct-2026), run against `src/` before the change.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';
import { expectIconAction } from '../support/icon-action-probe';

const ENTRY = fileURLToPath(new URL('./mounts/icon-actions.entry.tsx', import.meta.url));

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, opts: { width?: number; theme?: 'light' | 'dark'; grants?: string[] } = {}) {
  await page.setViewportSize({ width: opts.width ?? 1280, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), opts.theme ?? 'light');
  // The Menu section reads the public configuration when it loads. The literals CI uses
  // (.github/workflows/ci.yml) - none a credential.
  await page.addScriptTag({
    content: `window.process = { env: ${JSON.stringify({
      APP_ENV: 'test',
      PUBLIC_APP_URL: 'http://localhost:3000',
      PUBLIC_API_URL: 'http://localhost:3000/api',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci_reaches_no_database',
    })} };`,
  });
  if (opts.grants) await page.addScriptTag({ content: `window.__iaGrants = ${JSON.stringify(opts.grants)};` });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('owner-menu')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => window.__iaSent);

/* ── 1. Delete straight from the off-menu strip ──────────────────────────────────────────────── */

for (const theme of ['light', 'dark'] as const) {
  test(`a dish off the customer menu is deleted from the strip, without putting it back (${theme})`, async ({ page }) => {
    await mount(page, { theme, width: 390 });
    const chip = page.getByTestId('owner-off-menu-m3');
    await expect(chip).toContainText('Mutton Biryani');
    const del = page.getByTestId('owner-off-delete-m3');
    await expect(del).toBeVisible();
    await expect(del).toHaveAccessibleName('Delete Mutton Biryani');

    await del.click();
    const dialog = page.getByTestId('owner-item-delete-confirm');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Delete Mutton Biryani?');
    await expect(dialog).toContainText('Orders and bills that already have it keep it as they were.');
    // Already off: the dialog does not tell the owner to switch it Off instead.
    await expect(dialog).not.toContainText('switch it Off');
    expect(await sent(page)).toEqual([]);

    await page.getByTestId('owner-item-delete-confirm-confirm').click();
    await expect(page.getByText('Mutton Biryani deleted')).toBeVisible();
    // One write: the delete. Never a "put back" first.
    expect(await sent(page)).toEqual([{ action: 'delete-item', id: 'm3' }]);
  });
}

test('Keep it on the strip delete sends nothing, and Put back still works beside it', async ({ page }) => {
  await mount(page);
  await page.getByTestId('owner-off-delete-m3').click();
  await page.getByTestId('owner-item-delete-confirm-keep').click();
  await expect(page.getByTestId('owner-item-delete-confirm')).toHaveCount(0);
  expect(await sent(page)).toEqual([]);

  await page.getByTestId('owner-reopen-m3').click();
  await expect(page.getByText("Mutton Biryani back on every customer's phone")).toBeVisible();
  expect(await sent(page)).toEqual([{ action: 'set-availability', itemId: 'm3', available: true }]);
});

test('without the grant to edit dishes the strip offers no Delete; with only that grant, no Put back', async ({ page }) => {
  await mount(page, { grants: ['menu.availability'] });
  await expect(page.getByTestId('owner-reopen-m3')).toBeVisible();
  await expect(page.getByTestId('owner-off-delete-m3')).toHaveCount(0);

  await mount(page, { grants: ['menu.item_edit'] });
  await expect(page.getByTestId('owner-off-delete-m3')).toBeVisible();
  await expect(page.getByTestId('owner-reopen-m3')).toHaveCount(0);
});

/* ── 2. Edit and Delete are icons, and keep their words where they matter ───────────────────── */

for (const theme of ['light', 'dark'] as const) {
  test(`Edit and Delete on a menu row are icons with their words as name and tooltip (${theme})`, async ({ page }) => {
    await mount(page, { theme });
    // The row's pencil in the muted ink, its bin in the error colour; the strip's bin in the off-menu
    // chip's own ink (red on that tint is not a pair the contrast policy checks) - in this theme.
    await expectIconAction(page, 'owner-edit-m1', 'Edit Paneer Tikka', '--text-muted');
    await expectIconAction(page, 'owner-delete-m1', 'Delete Paneer Tikka', '--error');
    await expectIconAction(page, 'owner-off-delete-m3', 'Delete Mutton Biryani', '--on-warning-surface');
    // Found by role and name, as a screen reader would.
    await expect(page.getByRole('button', { name: 'Edit Paneer Tikka' })).toBeVisible();
    // The confirmation keeps its words: a delete is carried out by a button that says so.
    await page.getByTestId('owner-delete-m1').click();
    await expect(page.getByTestId('owner-item-delete-confirm-confirm')).toHaveText('Delete the item');
    // A dish still on the menu is still told about the Off switch.
    await expect(page.getByTestId('owner-item-delete-confirm')).toContainText('switch it Off');
  });
}

test('the Edit icon opens the editor for that dish', async ({ page }) => {
  await mount(page);
  await page.getByTestId('owner-edit-m2').click();
  await expect(page.getByTestId('owner-item-sheet')).toBeVisible();
  await expect(page.getByTestId('owner-item-sheet')).toContainText('Edit item');
});
