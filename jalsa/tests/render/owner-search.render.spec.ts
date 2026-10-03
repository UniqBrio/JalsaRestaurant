/**
 * The owner's console search, mounted for real and driven by keyboard and touch (03-Oct-2026).
 *
 * The REAL OwnerSearch (tests/render/mounts/owner-search.entry.tsx) is bundled and mounted on a
 * page carrying the application's stylesheet. The screens it searches are read from the
 * console's own source - SECTIONS, REPORT_TABS and PANELS - so a result here is a screen the
 * console really has.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/owner-search.entry.tsx', import.meta.url));

/** `{ key: 'x', label: 'Y', permission: 'z' }` rows of one exported list, from source. */
function rows(file: string, list: string): Array<{ key: string; label: string; permission: string }> {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf(`export const ${list}`);
  const body = src.slice(start, src.indexOf('\n];', start));
  const out = [...body.matchAll(/\{ key: '([^']+)', label: '([^']+)'(?:, permission: '([^']+)')? \}/g)].map((m) => ({
    key: m[1]!,
    label: m[2]!,
    permission: m[3] ?? '',
  }));
  expect(out.length, `${list} parsed from ${file}`).toBeGreaterThan(3);
  return out;
}

const SOURCES = {
  sections: rows('src/features/owner/OwnerConsole.tsx', 'SECTIONS'),
  reportTabs: rows('src/features/owner/sections/ReportsSection.tsx', 'REPORT_TABS'),
  settingsPanels: rows('src/features/owner/sections/SettingsSection.tsx', 'PANELS'),
};
const ALL_GRANTS = [...new Set([...SOURCES.sections, ...SOURCES.settingsPanels].map((r) => r.permission))];

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, width: number, grants: string[] = ALL_GRANTS) {
  await page.setViewportSize({ width, height: 760 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    ({ sources, grants }) => {
      (window as unknown as { __navSources: unknown }).__navSources = sources;
      (window as unknown as { __grants: string[] }).__grants = grants;
    },
    { sources: SOURCES, grants }
  );
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('owner-search-input')).toBeVisible();
}

const opened = (page: Page) => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

test('typing "gst" lists the GST screens; Down + Enter opens the first one', async ({ page }) => {
  await mount(page, 1280);
  const input = page.getByTestId('owner-search-input');
  await input.fill('gst');
  const list = page.getByTestId('owner-search-results');
  await expect(list).toBeVisible();
  await expect(page.getByTestId('owner-search-result-reports-sales')).toContainText('Reports › Sales & products');
  await expect(page.getByTestId('owner-search-result-settings-tax')).toContainText('Settings › Tax & GST');
  await input.press('ArrowDown');
  await expect(page.getByTestId('owner-search-result-reports-sales')).toHaveAttribute('aria-selected', 'true');
  await input.press('Enter');
  expect(await opened(page)).toEqual(['reports/sales']);
  await expect(list).toHaveCount(0);
  await expect(input).toHaveValue('');
});

test('Up from the top wraps to the last result, and Escape closes the list', async ({ page }) => {
  await mount(page, 1280);
  const input = page.getByTestId('owner-search-input');
  await input.fill('print');
  const options = page.getByRole('option');
  const n = await options.count();
  expect(n).toBeGreaterThan(1);
  await input.press('ArrowUp');
  await expect(options.nth(n - 1)).toHaveAttribute('aria-selected', 'true');
  await input.press('Escape');
  await expect(page.getByTestId('owner-search-results')).toHaveCount(0);
  expect(await opened(page)).toEqual([]);
});

test('an exact title outranks a starts-with, which outranks a keyword', async ({ page }) => {
  await mount(page, 1280);
  const input = page.getByTestId('owner-search-input');
  await input.fill('Payments');
  await expect(page.getByRole('option').first()).toHaveAttribute('data-testid', 'owner-search-result-payments');
  await input.fill('blob');
  await expect(page.getByRole('option').first()).toHaveAttribute('data-testid', 'owner-search-result-menu');
  await input.fill('favourites');
  await expect(page.getByRole('option').first()).toHaveAttribute('data-testid', 'owner-search-result-reports-guests');
});

test('nothing that matches no screen is offered, and says so', async ({ page }) => {
  await mount(page, 1280);
  await page.getByTestId('owner-search-input').fill('zzzz');
  await expect(page.getByTestId('owner-search-none')).toContainText('No screen matches');
});

test('a screen this person may not open is never listed', async ({ page }) => {
  // A captain-like set: the floor and the menu, no reports, no settings.
  await mount(page, 1280, ['orders.view', 'menu.view']);
  const input = page.getByTestId('owner-search-input');
  await input.fill('gst');
  await expect(page.getByTestId('owner-search-none')).toBeVisible();
  await input.fill('settings');
  await expect(page.getByTestId('owner-search-none')).toBeVisible();
  await input.fill('menu');
  await expect(page.getByTestId('owner-search-result-menu')).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const width of [320, 390] as const) {
    test(`results fit below the field and a tap opens one at ${width}px`, async ({ page }) => {
      await mount(page, width);
      const input = page.getByTestId('owner-search-input');
      await input.tap();
      await input.fill('qr');
      const list = page.getByTestId('owner-search-results');
      await expect(list).toBeVisible();
      const geo = await page.evaluate(() => {
        const l = document.querySelector('[data-testid="owner-search-results"]')!.getBoundingClientRect();
        const i = document.querySelector('[data-testid="owner-search-input"]')!.getBoundingClientRect();
        return {
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          listLeft: l.left,
          listRight: l.right,
          listTop: l.top,
          inputBottom: i.bottom,
        };
      });
      expect(geo.scroll, 'no sideways scroll').toBeLessThanOrEqual(geo.client + 1);
      expect(geo.listLeft).toBeGreaterThanOrEqual(0);
      expect(geo.listRight).toBeLessThanOrEqual(geo.client + 1);
      expect(geo.listTop, 'below the field').toBeGreaterThanOrEqual(geo.inputBottom - 1);
      // Every option is a real touch target.
      for (const h of await page.getByRole('option').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
        expect(h).toBeGreaterThanOrEqual(44);
      }
      await page.getByTestId('owner-search-result-settings-tables').tap();
      expect(await opened(page)).toEqual(['settings/tables']);
    });
  }
});
