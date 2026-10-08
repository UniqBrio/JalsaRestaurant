/**
 * "Cancel order & free table" and the takeaway photo, mounted for real (07-Oct-2026).
 *
 * The REAL CancelOrderDialog (on the existing ConfirmDialog) and the REAL ImagePicker in photo
 * mode are bundled (tests/render/mounts/order-cancel.entry.tsx) onto a page carrying the app's
 * stylesheet, and driven with real taps, in both themes and at phone width.
 *
 * FAIL-FIRST: without `src/components/ui/cancel-order.tsx` the run fails before any case passes -
 * the module is not found (observed 07-Oct-2026: the degraded server's build stops at
 * "Module not found", so the gate's webServer never comes up).
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/order-cancel.entry.tsx', import.meta.url));

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, width = 390, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('open-cancel')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => window.__sent);

for (const theme of ['light', 'dark'] as const) {
  test(`the dialog says what was asked, in the ${theme} theme, and fits a phone`, async ({ page }) => {
    await mount(page, 390, theme);
    await page.getByTestId('open-cancel').click();
    const dialog = page.getByTestId('staff-cancel-order');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Cancel Order & Free Table?');
    await expect(dialog).toContainText(
      'This order is already being processed. Cancelling it will release the table and record the order as cancelled. Are you sure you want to continue?'
    );
    await expect(page.getByTestId('staff-cancel-order-table')).toHaveText('Table 12');
    await expect(page.getByTestId('staff-cancel-order-keep')).toHaveText('Cancel');
    await expect(page.getByTestId('staff-cancel-order-confirm')).toHaveText('Cancel Order & Free Table');
    for (const r of ['customer-emergency', 'customer-changed-mind', 'order-mistake', 'kitchen-issue', 'item-unavailable', 'duplicate-order', 'other']) {
      await expect(page.getByTestId(`staff-cancel-order-reason-${r}`)).toBeVisible();
    }
    // No sideways scroll at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('"Cancel" closes it and sends nothing', async ({ page }) => {
  await mount(page);
  await page.getByTestId('open-cancel').click();
  await page.getByTestId('staff-cancel-order-keep').click();
  await expect(page.getByTestId('staff-cancel-order')).toHaveCount(0);
  expect(await sent(page)).toEqual([]);
});

test('"Other" asks for its few words before anything is sent, then sends the reason and the words', async ({ page }) => {
  await mount(page);
  await page.getByTestId('open-cancel').click();
  await page.getByTestId('staff-cancel-order-reason-other').click();
  await page.getByTestId('staff-cancel-order-confirm').click();
  await expect(page.getByTestId('staff-cancel-order')).toContainText('Add a few words on why you chose "Other".');
  expect(await sent(page)).toEqual([]);
  await page.getByTestId('staff-cancel-order-note').fill('Guest felt unwell');
  await page.getByTestId('staff-cancel-order-confirm').click();
  await expect(page.getByText('Order cancelled successfully. Table 12 is now free.')).toBeVisible();
  expect(await sent(page)).toEqual([
    { action: 'cancel-free-table', billId: 'b1', tableId: 't1', reason: 'Other', note: 'Guest felt unwell', rounds: 2 },
  ]);
  await expect(page.getByTestId('staff-cancel-order')).toHaveCount(0);
});

test('a double tap sends once', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window.__delay = 600));
  await page.getByTestId('open-cancel').click();
  await page.getByTestId('staff-cancel-order-reason-kitchen-issue').click();
  await page.getByTestId('staff-cancel-order-confirm').dblclick();
  await expect(page.getByText('Order cancelled successfully. Table 12 is now free.')).toBeVisible();
  expect((await sent(page)).length).toBe(1);
});

test('when someone else got there first, the person is told in words and the dialog closes', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window.__answer = 'gone'));
  await page.getByTestId('open-cancel').click();
  await page.getByTestId('staff-cancel-order-confirm').click();
  await expect(page.getByText('This order has already been cancelled or completed.')).toBeVisible();
  await expect(page.getByTestId('staff-cancel-order')).toHaveCount(0);
});

/* ── The takeaway photo ────────────────────────────────────────────────────────────────────── */

test('photo: camera and gallery are both offered, and a big phone photo is sent as a JPEG of 1 MB or less', async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId('owner-takeaway-photo-take')).toHaveText('Take photo');
  await expect(page.getByTestId('owner-takeaway-photo-choose')).toHaveText('Choose photo');
  await expect(page.getByTestId('owner-takeaway-photo-camera')).toHaveAttribute('capture', 'environment');
  await expect(page.getByTestId('owner-takeaway-photo-file')).toHaveAttribute('accept', 'image/*');
  // A 3000 x 2250 noisy PNG - several MB, like a camera's - handed to the gallery input.
  const size = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 3000;
    c.height = 2250;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 1) img.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'IMG_0001.png', { type: 'image/png' }));
    const input = document.querySelector('[data-testid="owner-takeaway-photo-file"]') as HTMLInputElement;
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return blob.size;
  });
  expect(size).toBeGreaterThan(1024 * 1024);
  await expect(page.getByTestId('owner-takeaway-photo-preview')).toBeVisible();
  await expect(page.getByText('TK-1: photo saved')).toBeVisible();
  const uploads = await page.evaluate(() => window.__uploads);
  expect(uploads.length).toBe(1);
  const bytes = Buffer.from(uploads[0]!, 'base64');
  expect(bytes.length).toBeLessThanOrEqual(1024 * 1024);
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  await expect(page.getByTestId('owner-takeaway-photo-choose')).toHaveText('Replace');
});

test('photo: a file that is not a picture is refused with the reason, and nothing is sent', async ({ page }) => {
  await mount(page);
  await page.getByTestId('owner-takeaway-photo-file').setInputFiles({
    name: 'order.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 not a picture'),
  });
  // SUPERSEDED 07-Oct-2026 (copy review, same day): this expected the file-type message "Only PNG
  // or JPEG images can be used." A PHOTO that cannot be redrawn now says what to do with a camera.
  await expect(page.getByTestId('owner-takeaway-photo-problem')).toContainText(
    'That photo could not be read. Take it again, or choose a JPEG from the gallery.'
  );
  expect(await page.evaluate(() => window.__uploads)).toEqual([]);
});

test('photo: Remove goes to the server, then the preview goes', async ({ page }) => {
  await mount(page);
  await page.getByTestId('owner-takeaway-photo-file').setInputFiles({
    name: 'slip.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
  });
  await expect(page.getByTestId('owner-takeaway-photo-preview')).toBeVisible();
  await page.getByTestId('owner-takeaway-photo-remove').click();
  await expect(page.getByTestId('owner-takeaway-photo-preview')).toHaveCount(0);
  expect(await page.evaluate(() => window.__removed)).toBe(1);
  await expect(page.getByText('TK-1: photo removed')).toBeVisible();
});
