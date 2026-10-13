/**
 * Edit and Delete as icons on every other owner screen that carries them (13-Oct-2026; code review:
 * "five of the six changed screens are never rendered"). The REAL sections are bundled
 * (tests/render/mounts/icon-actions-screens.entry.tsx) onto a page carrying the app's stylesheet and
 * checked in both themes, at a phone's width and a desk's: Settings → Tables & QR (row Edit, the table
 * sheet's Delete), Staff (Edit), Expenses (Edit, Delete), Printers (Delete), Print setup (row Delete,
 * the Configure sheet's Delete). The Menu is icon-actions.render.spec.ts.
 *
 * FAIL-FIRST: recorded in the root TEST_SUMMARY.md (13-Oct-2026), run against `src/` at origin/main.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';
import { expectIconAction } from '../support/icon-action-probe';

const ENTRY = fileURLToPath(new URL('./mounts/icon-actions-screens.entry.tsx', import.meta.url));

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

type Screen = 'tables' | 'staff' | 'expenses' | 'printers' | 'printsetup';

async function mount(page: Page, screen: Screen, theme: 'light' | 'dark', width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  // The literals CI uses (.github/workflows/ci.yml) - none a credential.
  await page.addScriptTag({
    content: `window.process = { env: ${JSON.stringify({
      APP_ENV: 'test',
      PUBLIC_APP_URL: 'http://localhost:3000',
      PUBLIC_API_URL: 'http://localhost:3000/api',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci_reaches_no_database',
    })} }; window.__iaScreen = ${JSON.stringify(screen)};`,
  });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('ia-screen')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => window.__iaScreenSent);

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1280]) {
    const at = `(${theme}, ${width}px)`;

    test(`Tables & QR: Edit on the row and Delete in the table's sheet are icons ${at}`, async ({ page }) => {
      await mount(page, 'tables', theme, width);
      await expectIconAction(page, 'owner-edit-table-A5', 'Edit table A5', '--text-muted');
      await page.getByTestId('owner-edit-table-A5').click();
      await expect(page.getByTestId('owner-table-sheet')).toBeVisible();
      await expectIconAction(page, 'owner-table-delete', 'Delete table A5', '--error');
      // The saved name, not the field being typed in.
      await page.getByTestId('owner-table-sheet').locator('input').first().fill('');
      await expect(page.getByTestId('owner-table-delete')).toHaveAccessibleName('Delete table A5');
      // It still only opens the confirmation.
      await page.getByTestId('owner-table-delete').click();
      expect(await sent(page)).toEqual([]);
    });

    test(`Staff: Edit is an icon ${at}`, async ({ page }) => {
      await mount(page, 'staff', theme, width);
      await expectIconAction(page, 'owner-edit-staff-s1', 'Edit Ravi Kumar', '--text-muted');
      // "Remove" is another verb and stays a word.
      await expect(page.getByTestId('owner-remove-s1')).toHaveText('Remove');
    });

    test(`Expenses: Edit and Delete are icons, named like the expense's own dialog ${at}`, async ({ page }) => {
      await mount(page, 'expenses', theme, width);
      await expectIconAction(page, 'owner-edit-expense-e1', 'Edit Gas ₹450 from 2026-10-12', '--text-muted');
      await expectIconAction(page, 'owner-delete-expense-e1', 'Delete Gas ₹450 from 2026-10-12', '--error');
      await page.getByTestId('owner-delete-expense-e1').click();
      await expect(page.getByTestId('owner-expense-delete')).toContainText('from 2026-10-12');
      expect(await sent(page)).toEqual([]);
    });

    test(`Printers: Delete is an icon ${at}`, async ({ page }) => {
      await mount(page, 'printers', theme, width);
      await expectIconAction(page, 'owner-printers-delete-p1', 'Delete Tandoor printer', '--error');
    });

    test(`Print setup: Delete on the row and in the Configure sheet are icons ${at}`, async ({ page }) => {
      await mount(page, 'printsetup', theme, width);
      await page.getByTestId('owner-print-printers').click();
      await expectIconAction(page, 'owner-print-row-delete-p1', 'Delete Tandoor printer', '--error');
      await page.getByTestId('owner-print-configure-p1').click();
      await expect(page.getByTestId('owner-print-form')).toBeVisible();
      await expectIconAction(page, 'owner-print-delete', 'Delete Tandoor printer', '--error');
      expect(await sent(page)).toEqual([]);
    });
  }
}
