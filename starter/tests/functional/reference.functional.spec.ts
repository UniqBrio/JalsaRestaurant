/**
 * Reference FUNCTIONAL spec - the shape every journey test follows.
 *
 * FOUR HABITS WORTH COPYING VERBATIM
 *   1. Mock the network at ONE boundary. Then no test can reach a real datastore by accident,
 *      and there is exactly one place to change when the contract moves.
 *   2. Seed session state via addInitScript, before the app boots. Logging in through the UI
 *      in every test makes the auth screen the most-tested and slowest part of your suite.
 *   3. Assert the DATA, not the toast. A success message is what the app CLAIMS happened.
 *      Several classic data-loss bugs are the app cheerfully reporting a save that never
 *      landed - the test must read the effect back.
 *   4. Geometry is a bounding-box assertion, and a click is never forced. `{ force: true }`
 *      succeeds on an element covered by a sticky bar; the unforced failure IS the assertion.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const SESSION = { userId: 'u-test-1', tenantId: 't-test-1', roles: ['owner'] };
const record = (over: Record<string, unknown> = {}) => ({
  id: `r-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Reference item',
  status: 'active',
  ...over,
});

async function boot(page: Page, rows: unknown[], opts: { failWrites?: boolean } = {}) {
  await page.addInitScript((s) => localStorage.setItem('session', JSON.stringify(s)), SESSION);

  const written: unknown[] = [];
  await page.route('**/api/**', (route: Route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { data: rows } });
    if (opts.failWrites) {
      return route.fulfill({ status: 500, json: { error: { code: 'server', message: 'Something went wrong on our side. Please try again shortly.' } } });
    }
    written.push(req.postDataJSON());
    return route.fulfill({ json: { data: { id: 'r-new' } } });
  });

  await page.goto('/');
  return { written };
}

test.describe('reference journey', () => {
  test('empty state is reachable and actionable', async ({ page }) => {
    await boot(page, []);
    // An empty state that only says "nothing here" leaves the user with no next step.
    await expect(page.getByTestId('list-empty')).toBeVisible();
    await expect(page.getByTestId('list-empty-action')).toBeVisible();
  });

  test('a save is proved against the DATA, never the toast', async ({ page }) => {
    const { written } = await boot(page, []);
    await page.getByTestId('list-add').click();
    await page.getByTestId('item-name').fill('New item');
    await page.getByTestId('item-save').click();

    await expect(page.getByTestId('toast-success')).toBeVisible();
    // The assertion that actually matters:
    expect(written, 'the toast appeared but no write reached the API').toHaveLength(1);
    expect(written[0]).toMatchObject({ name: 'New item' });
  });

  test('a failed save says so honestly and does not claim success', async ({ page }) => {
    await boot(page, [], { failWrites: true });
    await page.getByTestId('list-add').click();
    await page.getByTestId('item-name').fill('Doomed');
    await page.getByTestId('item-save').click();

    await expect(page.getByTestId('toast-error')).toBeVisible();
    await expect(page.getByTestId('toast-success')).toHaveCount(0);
    // No raw machine text ever reaches a customer.
    await expect(page.getByTestId('toast-error')).not.toContainText(/constraint|null|undefined|stack/i);
  });

  test('a dialog does not discard typed input on a stray backdrop tap', async ({ page }) => {
    await boot(page, []);
    await page.getByTestId('list-add').click();
    await page.getByTestId('item-name').fill('Half-typed');
    await page.mouse.click(5, 5); // the stray tap
    await expect(page.getByTestId('item-name')).toHaveValue('Half-typed');
  });

  test('focus lands on the first field when a dialog opens', async ({ page }) => {
    await boot(page, []);
    await page.getByTestId('list-add').click();
    // Focus is computable, so it is automated by definition - never an eyeball check.
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('item-name');
  });

  test('the last control is reachable at a SHORT viewport', async ({ page }) => {
    // 360x640, not 360x800: the taller frame does not overflow, so it cannot expose occlusion.
    await page.setViewportSize({ width: 360, height: 640 });
    await boot(page, Array.from({ length: 30 }, () => record()));

    const last = page.getByTestId('list-footer-action');
    await last.scrollIntoViewIfNeeded();
    // No { force: true }. If fixed chrome covers it, Playwright fails with
    // "intercepts pointer events" - and that failure IS the assertion.
    await last.click();
  });

  /* ---------------------------------------------------------------------------------------
   * EDIT PARITY (CP-25). Three assertions that a create-flow test structurally cannot make,
   * and that together are the difference between an edit screen and a create screen wearing
   * an edit label.
   * ------------------------------------------------------------------------------------- */

  test('EDIT opens POPULATED - not the create form with a different title', async ({ page }) => {
    const existing = record({ id: 'r-77', name: 'Existing item', status: 'archived' });
    await boot(page, [existing]);

    await page.getByTestId('item-edit-r-77').click();

    // Every field arrives carrying the stored value. An empty edit form is the single most
    // common shape of this defect, and it passes every "the form renders" assertion.
    await expect(page.getByTestId('item-name')).toHaveValue('Existing item');
    // Multi-value controls arrive SELECTED. A checkbox group that renders but shows nothing
    // ticked reads to the user as "I had nothing set", and their next save proves it.
    await expect(page.getByTestId('item-status-archived')).toBeChecked();
    // The surface is in edit mode, addressed by the record's DATABASE id.
    await expect(page.getByTestId('item-form-mode')).toHaveText('edit');
  });

  test('saving an UNCHANGED edit is a no-op - it never clears what it did not load', async ({ page }) => {
    const existing = record({ id: 'r-77', name: 'Existing item', schedule: ['mon', 'thu'] });
    const { written } = await boot(page, [existing]);

    await page.getByTestId('item-edit-r-77').click();
    await page.getByTestId('item-save').click();

    // The dangerous case: a field the form never loaded is sent back as empty and the stored
    // value is destroyed. Silent, irreversible, and invisible to a test that only checks the
    // fields it typed into. Assert the whole payload, not the field you were thinking about.
    expect(written, 'an unchanged save must still round-trip every field').toHaveLength(1);
    expect(written[0]).toMatchObject({ name: 'Existing item', schedule: ['mon', 'thu'] });
  });

  test('two records with the SAME NAME stay distinguishable', async ({ page }) => {
    // Selection keyed by a display label breaks the moment two rows share one. The key is the
    // database id, always - the same rule the test-id convention encodes.
    await boot(page, [record({ id: 'r-1', name: 'Asha Rao' }), record({ id: 'r-2', name: 'Asha Rao' })]);

    await page.getByTestId('item-edit-r-2').click();
    await expect(page.getByTestId('item-form-id')).toHaveText('r-2');
  });
});
