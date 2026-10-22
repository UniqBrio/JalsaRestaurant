/**
 * Enable KOT Printing and Enable Invoice Printing, under Settings → Printers & machines → Overview
 * (22-Oct-2026). The REAL PrintSetupSection is bundled (the existing mount,
 * tests/render/mounts/icon-actions-screens.entry.tsx, whose data has no `print` setting saved)
 * onto a page carrying the app's stylesheet, in both themes, at a phone's width and a desk's.
 *
 * What is held: both switches are on for a restaurant that never saved one (today's behaviour),
 * each Save writes ONE key into the existing `print` setting - never the other switch - and the
 * card fits the phone without scrolling sideways.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/icon-actions-screens.entry.tsx', import.meta.url));

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, theme: 'light' | 'dark', width: number) {
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
    })} }; window.__iaScreen = "printsetup";`,
  });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('owner-print-switches')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => (window as unknown as { __iaScreenSent: unknown[] }).__iaScreenSent);

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1280]) {
    const at = `(${theme}, ${width}px)`;

    test(`both switches are on by default, labelled as asked, and fit the screen ${at}`, async ({ page }) => {
      await mount(page, theme, width);
      const card = page.getByTestId('owner-print-switches');
      await expect(card).toContainText('Enable KOT Printing');
      await expect(card).toContainText('Enable Invoice Printing');
      await expect(page.getByTestId('owner-print-kot-enabled')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('owner-print-invoice-enabled')).toHaveAttribute('aria-checked', 'true');
      // Each label is the switch's accessible name - a screen reader says which one it is.
      await expect(page.getByRole('switch', { name: 'Enable KOT Printing' })).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Enable Invoice Printing' })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await card.screenshot({ path: test.info().outputPath(`switches-${theme}-${width}.png`) });
    });

    test(`turning one switch off saves that switch alone, through the print setting ${at}`, async ({ page }) => {
      await mount(page, theme, width);
      await page.getByTestId('owner-print-kot-enabled').click();
      await expect.poll(() => sent(page)).toEqual([{ action: 'write-setting', key: 'print', value: { kotEnabled: false } }]);
      await expect(page.getByTestId('toast').first()).toContainText('Enable KOT Printing: off');
    });
  }
}

test('turning invoice printing off writes only invoiceEnabled - KOT printing is not sent at all', async ({ page }) => {
  await mount(page, 'light', 390);
  await page.getByTestId('owner-print-invoice-enabled').click();
  await expect.poll(() => sent(page)).toEqual([{ action: 'write-setting', key: 'print', value: { invoiceEnabled: false } }]);
});
