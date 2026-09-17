/**
 * load-failed spec — docs/28 §9: LOAD FAILED is not EMPTY.
 *
 * WHAT THIS PINS
 *   When the read behind a list fails, the screen says the read failed and offers a retry. It
 *   does NOT say "No items yet" - that is a claim about the user's data, and the system has no
 *   data. The reference screen did exactly that until v5.0.0: `catch { setRows([]) }`, then the
 *   empty state with its "Add the first item" call to action, after a 500.
 *
 *   The same class of defect at scale is the one this standard exists for: a capped response
 *   rendered as "nobody attended". Both are the UI turning an absence of evidence into evidence
 *   of absence.
 *
 * FAIL-FIRST EVIDENCE: see TEST_SUMMARY.md.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const SESSION = { user: { id: 'u-1', email: 't@t.t' }, roles: ['admin'] };

async function boot(page: Page, mode: 'fail' | 'empty' | 'fail-then-ok') {
  let calls = 0;
  await page.addInitScript((s) => localStorage.setItem('session', JSON.stringify(s)), SESSION);
  await page.route('**/api/**', (route: Route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ json: { data: { id: 'r-new' } } });
    calls++;
    if (mode === 'empty') return route.fulfill({ json: { data: [] } });
    if (mode === 'fail' || calls === 1) return route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'boom' } } });
    return route.fulfill({ json: { data: [{ id: 'r-1', name: 'Existing item', status: 'active' }] } });
  });
  await page.goto('/');
}

test.describe('docs/28 §9 - a failed read is never presented as an empty dataset', () => {
  test('a failed load shows the FAILED state, not the empty state', async ({ page }) => {
    await boot(page, 'fail');
    await expect(page.getByTestId('list-failed')).toBeVisible();
    await expect(page.getByTestId('list-empty')).toHaveCount(0);
    // The words are about the read, not the data.
    await expect(page.getByTestId('list-failed')).toContainText(/could not be loaded/i);
    await expect(page.getByTestId('list-failed')).not.toContainText(/no items/i);
  });

  test('a genuinely empty dataset still shows the empty state with its call to action', async ({ page }) => {
    await boot(page, 'empty');
    await expect(page.getByTestId('list-empty')).toBeVisible();
    await expect(page.getByTestId('list-failed')).toHaveCount(0);
  });

  test('retry after a failure reaches the data', async ({ page }) => {
    await boot(page, 'fail-then-ok');
    await expect(page.getByTestId('list-failed')).toBeVisible();
    await page.getByTestId('list-failed-retry').click();
    await expect(page.getByTestId('item-row-r-1')).toBeVisible();
    await expect(page.getByTestId('list-failed')).toHaveCount(0);
  });
});
