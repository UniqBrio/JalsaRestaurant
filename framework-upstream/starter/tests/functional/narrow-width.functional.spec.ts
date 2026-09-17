/**
 * Narrow-width spec — DR-6's mechanical half, and screen checklist item 11.
 *
 * WHAT THIS PINS, AND WHY IT IS WORTH A SPEC OF ITS OWN
 *   "No horizontal scrolling" has been a checklist item for as long as the checklist has
 *   existed, and a checklist item is something a person remembers to look at. Whether a page
 *   overflows sideways at 360px is not a judgement — it is two numbers, and comparing two
 *   numbers is what a machine is for. So the half of DR-6 that CAN be executed is executed
 *   here, and the half that cannot — whether the replacement is a findable button opening a
 *   compact sheet, rather than something worse — stays with design review, declared.
 *
 *   The defect it catches is specific: a row of filters or categories that fits the designer's
 *   screen and not the user's. It does not announce itself. The page looks right, and the
 *   options past the fold are simply never used, by anyone, forever - which reads in the
 *   numbers as "nobody wants that filter" rather than "nobody can reach it".
 *
 * THIS SPEC RUNS ON EVERY PROJECT, and that is deliberate: the assertion is trivially true on
 * a desktop viewport and costs nothing there, while `mobile-short` (360x640) is the one that
 * can actually fail. A spec that only runs in one project is one config edit from running in
 * none.
 *
 * FAIL-FIRST EVIDENCE: observed failing on 12-Sep-2026 by injecting a 700px-wide
 * non-wrapping row into the reference screen at runtime — `mobile-short` reported a document
 * 700px wide in a 360px viewport, and every other project passed, which is exactly the
 * asymmetry the mobile-short project exists to expose.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const SESSION = { user: { id: 'u-1', email: 't@t.t' }, roles: ['admin'] };
const record = (over: Record<string, unknown> = {}) => ({
  id: 'r-1', name: 'Existing item', status: 'active', ...over,
});

async function boot(page: Page, rows: unknown[]) {
  await page.addInitScript((s) => localStorage.setItem('session', JSON.stringify(s)), SESSION);
  await page.route('**/api/**', (route: Route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { data: rows } });
    return route.fulfill({ json: { data: { id: 'r-new' } } });
  });
  await page.goto('/');
}

/**
 * The document is wider than the window <=> the page scrolls sideways.
 * A 1px tolerance absorbs sub-pixel layout rounding, which is a rendering artefact and not a
 * defect; anything a user could actually scroll to is far larger than that.
 */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

test.describe('DR-6 — nothing scrolls sideways at the narrowest supported width', () => {
  test('the list screen fits its viewport', async ({ page }) => {
    await boot(page, [record(), record({ id: 'r-2', name: 'Second item' })]);
    const { scrollWidth, clientWidth } = await overflow(page);
    expect(scrollWidth, `the page is ${scrollWidth}px wide in a ${clientWidth}px viewport`)
      .toBeLessThanOrEqual(clientWidth + 1);
  });

  test('the empty state fits too — an empty screen is still a screen', async ({ page }) => {
    await boot(page, []);
    const { scrollWidth, clientWidth } = await overflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('an open dialog does not push the page sideways', async ({ page }) => {
    // Dialogs are where overflow hides: the page behind fits, and the panel on top does not.
    await boot(page, [record()]);
    await page.getByTestId('item-edit-r-1').click();
    await expect(page.getByTestId('item-form-mode')).toBeVisible();
    const { scrollWidth, clientWidth } = await overflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('an open dropdown does not push the page sideways', async ({ page }) => {
    // The searchable select (DR-5) opens a list inside a dialog - two nested surfaces, which is
    // where a fixed min-width first shows up as a sideways scroll.
    await boot(page, [record()]);
    await page.getByTestId('item-edit-r-1').click();
    await page.getByTestId('item-category-trigger').click();
    await expect(page.getByTestId('item-category-list')).toBeVisible();
    const { scrollWidth, clientWidth } = await overflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
