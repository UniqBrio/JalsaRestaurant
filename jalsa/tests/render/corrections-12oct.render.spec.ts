/**
 * The 12-Oct-2026 corrections, mounted for real.
 *
 * The REAL Takeaway dialog (NewRoundSheet), the REAL owner Menu section, and the shared Select and
 * Combobox are bundled (tests/render/mounts/corrections-12oct.entry.tsx) onto a page carrying the
 * app's stylesheet, and driven with real taps, in both themes and at phone width.
 *
 * FAIL-FIRST (observed 12-Oct-2026, `src/` stashed back to the tree before this change): all 10
 * cases fail, each at its own correction - the takeaway cases at `owner-new-round-photo-take`
 * (no picker in the dialog), the chevron cases at the Select's chevron `toBeVisible` (nothing
 * drawn), the delete cases at `owner-delete-m1` (no Delete on the row).
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/corrections-12oct.entry.tsx', import.meta.url));

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, width = 390, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  // The Takeaway dialog lives in Dashboard.tsx, which imports the console, which reads the public
  // configuration when it loads. The literals CI uses (.github/workflows/ci.yml) - none a credential.
  await page.addScriptTag({
    content: `window.process = { env: ${JSON.stringify({
      APP_ENV: 'test',
      PUBLIC_APP_URL: 'http://localhost:3000',
      PUBLIC_API_URL: 'http://localhost:3000/api',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci_reaches_no_database',
    })} };`,
  });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('open-takeaway')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => window.__c12Sent);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/* ── 1. The takeaway's photo, in the Takeaway dialog ─────────────────────────────────────────── */

for (const theme of ['light', 'dark'] as const) {
  test(`a new takeaway's photo is chosen in the dialog and saved to the order it creates (${theme})`, async ({ page }) => {
    await mount(page, 390, theme);
    await page.getByTestId('open-takeaway').click();
    const sheet = page.getByTestId('owner-new-round');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('owner-new-round-photo-take')).toHaveText('Take photo');
    await expect(page.getByTestId('owner-new-round-photo-choose')).toHaveText('Choose photo');
    await expect(page.getByTestId('owner-new-round-photo-camera')).toHaveAttribute('capture', 'environment');

    // Chosen: shown at once, and nothing sent - there is no order to store it under yet.
    await page.getByTestId('owner-new-round-photo-file').setInputFiles({ name: 'parcel.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('owner-new-round-photo-preview')).toBeVisible();
    await expect(page.getByTestId('owner-new-round-photo-choose')).toHaveText('Replace');
    expect(await sent(page)).toEqual([]);

    await page.getByTestId('owner-new-round-add-m1').click();
    await page.getByTestId('owner-new-round-send').click();
    await expect(page.getByTestId('went')).toHaveText('orders:bill-new');
    const log = await sent(page);
    expect(log.map((p) => p.action)).toEqual(['takeaway', 'takeaway-photo']);
    expect(log[1]).toEqual({ action: 'takeaway-photo', billId: 'bill-new', base64: PNG.toString('base64') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('a photo removed before sending is not sent', async ({ page }) => {
  await mount(page);
  await page.getByTestId('open-takeaway').click();
  await page.getByTestId('owner-new-round-photo-file').setInputFiles({ name: 'parcel.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('owner-new-round-photo-remove').click();
  await expect(page.getByTestId('owner-new-round-photo-preview')).toHaveCount(0);
  await page.getByTestId('owner-new-round-add-m1').click();
  await page.getByTestId('owner-new-round-send').click();
  await expect(page.getByTestId('went')).toHaveText('orders:bill-new');
  expect((await sent(page)).map((p) => p.action)).toEqual(['takeaway']);
});

test('a photo the server refuses leaves the order placed, and says so', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window.__c12Answer = 'refuse-photo'));
  await page.getByTestId('open-takeaway').click();
  await page.getByTestId('owner-new-round-photo-file').setInputFiles({ name: 'parcel.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('owner-new-round-add-m1').click();
  await page.getByTestId('owner-new-round-send').click();
  await expect(page.getByTestId('went')).toHaveText('orders:bill-new');
  await expect(page.getByText(/The order was sent, but its photo was not saved/)).toBeVisible();
});

test('Add items on a running takeaway saves its photo straight away', async ({ page }) => {
  await mount(page);
  await page.getByTestId('open-takeaway-more').click();
  await expect(page.getByTestId('owner-new-round')).toContainText('More for takeaway TK-2');
  await page.getByTestId('owner-new-round-photo-file').setInputFiles({ name: 'parcel.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('owner-new-round-photo-preview')).toBeVisible();
  expect(await sent(page)).toEqual([{ action: 'takeaway-photo', billId: 'bill-more', base64: PNG.toString('base64') }]);
  await expect(page.getByText('TK-2: photo saved')).toBeVisible();
});

/* ── 2. Every dropdown wears a chevron ──────────────────────────────────────────────────────── */

for (const theme of ['light', 'dark'] as const) {
  test(`the Select and the Combobox both show a chevron inside the box (${theme})`, async ({ page }) => {
    await mount(page, 390, theme);
    for (const [control, icon] of [
      ['probe-select', page.getByTestId('probe-select').locator('xpath=..').locator('svg')],
      ['probe-combo', page.getByTestId('probe-combo-toggle').locator('svg')],
    ] as const) {
      await expect(icon, control).toBeVisible();
      const box = await page.getByTestId(control).boundingBox();
      const mark = await icon.boundingBox();
      expect(box && mark, control).toBeTruthy();
      // Inside the control, at its right-hand end.
      expect(mark!.x, control).toBeGreaterThan(box!.x + box!.width / 2);
      expect(mark!.x + mark!.width, control).toBeLessThanOrEqual(box!.x + box!.width + 1);
      expect(mark!.y, control).toBeGreaterThanOrEqual(box!.y - 1);
      expect(mark!.y + mark!.height, control).toBeLessThanOrEqual(box!.y + box!.height + 1);
      // Painted: not the transparent colour.
      const stroke = await icon.evaluate((el) => getComputedStyle(el).color);
      expect(stroke, control).not.toBe('rgba(0, 0, 0, 0)');
    }
    // The chevron does not swallow the tap: the select is still what opens.
    const hit = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="probe-select"]')!.parentElement!.querySelector('svg')!;
      const r = svg.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.getAttribute('data-testid');
    });
    expect(hit).toBe('probe-select');
  });
}

/* ── 3. Delete beside Edit, behind a confirmation ──────────────────────────────────────────── */

for (const theme of ['light', 'dark'] as const) {
  test(`Delete sits beside Edit and asks before anything is deleted (${theme})`, async ({ page }) => {
    await mount(page, 1280, theme);
    const edit = await page.getByTestId('owner-edit-m1').boundingBox();
    const del = await page.getByTestId('owner-delete-m1').boundingBox();
    expect(del!.x).toBeGreaterThan(edit!.x);
    expect(Math.abs(del!.y - edit!.y)).toBeLessThan(4);
    await expect(page.getByTestId('owner-delete-m1')).toHaveText('Delete');

    await page.getByTestId('owner-delete-m1').click();
    const dialog = page.getByTestId('owner-item-delete-confirm');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Delete Paneer Tikka?');
    await expect(dialog).toContainText('Orders and bills that already have it keep it as they were.');
    expect(await sent(page)).toEqual([]);

    // "Keep it" closes the dialog and sends nothing.
    await page.getByTestId('owner-item-delete-confirm-keep').click();
    await expect(dialog).toHaveCount(0);
    expect(await sent(page)).toEqual([]);

    await page.getByTestId('owner-delete-m1').click();
    await page.getByTestId('owner-item-delete-confirm-confirm').click();
    await expect(page.getByText('Paneer Tikka deleted')).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await sent(page)).toEqual([{ action: 'delete-item', id: 'm1' }]);
  });
}

test('a refused delete keeps the dialog open and says why', async ({ page }) => {
  await mount(page, 1280);
  await page.evaluate(() => (window.__c12Answer = 'refuse-delete'));
  await page.getByTestId('owner-delete-m1').click();
  await page.getByTestId('owner-item-delete-confirm-confirm').click();
  await expect(page.getByText('That item is no longer on the menu. Reload the page.')).toBeVisible();
  await expect(page.getByTestId('owner-item-delete-confirm')).toBeVisible();
});

/* ── Copy review, 12-Oct-2026 ──────────────────────────────────────────────────────────────── */

test('a refused photo reads as whole sentences: the reason, then one way to add it', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window.__c12Answer = 'refuse-photo'));
  await page.getByTestId('open-takeaway').click();
  await page.getByTestId('owner-new-round-photo-file').setInputFiles({ name: 'parcel.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('owner-new-round-add-m1').click();
  await page.getByTestId('owner-new-round-send').click();
  // Before the copy review the reason was spliced in after a dash: "... not saved - The photo could
  // not be saved. Try again.. Add it again from Add items." - a double full stop.
  await expect(
    page.getByText(
      'The order was sent, but its photo was not saved. The photo could not be saved. Try again. To add it, open the order and tap Add items.',
      { exact: true }
    )
  ).toBeVisible();
});

test('the delete confirmation names every effect: menus, unsent orders, and where the switch is', async ({ page }) => {
  await mount(page, 1280);
  await page.getByTestId('owner-delete-m1').click();
  const dialog = page.getByTestId('owner-item-delete-confirm');
  await expect(dialog).toContainText(
    "Paneer Tikka is removed from the menu on every guest and captain screen, and from any guest's order not yet sent."
  );
  await expect(dialog).toContainText('To take it off only for a while, switch it Off in the Available column instead.');
});
