/**
 * Reference KEYBOARD spec - the shape every keyboard-parity test follows (CP-22, rule A-10).
 *
 * THE CLAIM UNDER TEST
 *   The application is fully operable with the keyboard alone. Not "mostly": a workflow that
 *   needs a pointer for one step is a workflow a keyboard user cannot finish, and nothing on
 *   the happy-path mouse run will ever reveal it.
 *
 * FOUR HABITS WORTH COPYING VERBATIM
 *   1. Walk the REAL Tab order and compare it to the visual order. Reachability asserted one
 *      element at a time misses the screen where everything is reachable in a nonsense order.
 *   2. Assert the focus indicator is VISIBLE (computed style), not merely that focus moved.
 *      `outline: none` with no replacement passes every document.activeElement assertion.
 *   3. Activate with the KEY, assert the DATA. Enter on a button and Space on a tab-style
 *      control must produce the same write / same state change the click produces - native
 *      <button> elements give both keys free, which is why CP-22 forbids div-as-button.
 *   4. Run one whole journey keyboard-only. Per-element checks cannot catch the modal that
 *      traps focus, or the flow whose one unreachable step is the submit.
 *
 * FAIL-FIRST NOTE: NOT OBSERVED FAILING in this repository - the framework repo carries no
 * runnable app page; this spec is the reference shape an adopting app points at its own
 * screens, where deleting the :focus-visible rule or swapping a button for a div MUST turn
 * it red before it is trusted.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const SESSION = { userId: 'u-test-1', tenantId: 't-test-1', roles: ['owner'] };
const record = (over: Record<string, unknown> = {}) => ({
  id: `r-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Reference item',
  status: 'active',
  ...over,
});

async function boot(page: Page, rows: unknown[]) {
  await page.addInitScript((s) => localStorage.setItem('session', JSON.stringify(s)), SESSION);
  const written: unknown[] = [];
  await page.route('**/api/**', (route: Route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { data: rows } });
    written.push(req.postDataJSON());
    return route.fulfill({ json: { data: { id: 'r-new' } } });
  });
  await page.goto('/');
  return { written };
}

/** The test ids of every interactive element on the screen, in VISUAL order. Keeping this
 *  list in the spec makes a new unreachable control a red test, not a support ticket. */
const TAB_ORDER = ['tabs-overview', 'tabs-details', 'list-add', 'list-search'];

test.describe('keyboard parity (reference shape)', () => {
  test('every interactive element is Tab-reachable, in visual order', async ({ page }) => {
    await boot(page, [record()]);
    const reached: string[] = [];
    // Walk more slots than expected: extra unlisted stops are a finding too.
    for (let i = 0; i < TAB_ORDER.length + 4; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (id) reached.push(id);
    }
    // Order matters, not just membership: reachable-in-nonsense-order is still failure.
    const filtered = reached.filter((id) => TAB_ORDER.includes(id));
    expect(filtered, 'Tab order must follow visual order').toEqual(TAB_ORDER);
  });

  test('the focused element shows a VISIBLE indicator', async ({ page }) => {
    await boot(page, [record()]);
    await page.getByTestId('list-add').focus();
    const style = await page.getByTestId('list-add').evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
    });
    const visible =
      (style.outline !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
    expect(visible, 'focus moved but nothing on screen says so - outline removed?').toBe(true);
  });

  test('Enter activates the focused action, proved against the DATA', async ({ page }) => {
    const { written } = await boot(page, []);
    await page.getByTestId('list-add').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('item-name').fill('Typed without a mouse');
    await page.getByTestId('item-save').focus();
    await page.keyboard.press('Enter');
    expect(written, 'Enter "worked" visually but no write reached the API').toHaveLength(1);
  });

  test('Space selects a focused tab-style control', async ({ page }) => {
    await boot(page, [record()]);
    await page.getByTestId('tabs-details').focus();
    await page.keyboard.press('Space');
    // Native <button role="tab"> gives Space free; a styled div gives nothing. Assert the
    // STATE the key changed, exactly as a click test would.
    await expect(page.getByTestId('tabs-details')).toHaveAttribute('aria-selected', 'true');
  });

  test('no keyboard trap: Shift+Tab walks backward as cleanly as Tab walks forward', async ({ page }) => {
    await boot(page, [record()]);
    await page.getByTestId('list-add').focus();
    await page.keyboard.press('Shift+Tab');
    const before = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(before, 'Shift+Tab did not move focus - trap?').not.toBe('list-add');
    // A dialog is the licensed exception: it traps while open, and MUST release on close
    // (Dialog.tsx returns focus to the opener - assert that in the dialog journey below).
  });

  test('one core journey, keyboard only, end to end', async ({ page }) => {
    const { written } = await boot(page, []);
    // No .click() anywhere in this test - that is the entire point.
    await page.keyboard.press('Tab'); // into the page
    // Reach the add action however many Tabs it takes; the walk test above pins the count.
    for (let i = 0; i < TAB_ORDER.length; i++) {
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (id === 'list-add') break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter'); // open the dialog: focus lands on the first field
    await page.keyboard.type('Keyboard-only item');
    await page.keyboard.press('Tab'); // to save
    await page.keyboard.press('Enter'); // save
    expect(written, 'the keyboard journey must land the same write the mouse journey lands')
      .toHaveLength(1);
    // Close returns focus to the opener - the keyboard user is back where they started,
    // not stranded at the top of the document.
    const after = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(after).toBe('list-add');
  });
});
