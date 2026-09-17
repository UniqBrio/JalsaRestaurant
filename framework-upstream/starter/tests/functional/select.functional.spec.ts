/**
 * SearchableSelect functional spec — DR-5, proved in a real browser.
 *
 * WHY THESE ARE FUNCTIONAL AND NOT UNIT TESTS
 *   The pure half — filtering, duplicate refusal, arrow bounds — is pinned in
 *   `tests/unit/select-options.unit.spec.ts` with no browser at all. What CANNOT be proved
 *   there is everything DR-5 is actually about: whether the cursor is really live when the list
 *   opens, whether the first keystroke filters or is swallowed, whether the options are on
 *   screen before anyone types, and whether an added option is still there after a reload.
 *   Those are properties of a running page, so they are tested on one.
 *
 * FAIL-FIRST EVIDENCE: run 12-Sep-2026 against the component with `autoFocus` and the
 * `requestAnimationFrame` focus call removed — "the list opens with the cursor already live"
 * failed, and "the FIRST keystroke filters" failed with all three options still showing,
 * because the keystroke went to the document instead of the input. That is the exact defect
 * DR-5's first clause exists to prevent, and it is invisible to every unit test.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { measure, parse, ratio } from '../render/contrast-util';

const SESSION = { user: { id: 'u-1', email: 't@t.t' }, roles: ['admin'] };

const record = (over: Record<string, unknown> = {}) => ({
  id: 'r-1', name: 'Existing item', status: 'active', ...over,
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
  // Cleared HERE, not in an init script: an init script re-runs on every navigation, so the
  // reload test would wipe the very store it exists to prove survives one. The select reads the
  // store when the dialog mounts, which is after this line.
  await page.evaluate(() => localStorage.removeItem('reference.categories'));
  return { written };
}

/** The select lives in EDIT mode only — create mode keeps name-then-Save (ItemForm's header). */
async function openEditor(page: Page) {
  await page.getByTestId('item-edit-r-1').click();
  await expect(page.getByTestId('item-category')).toBeVisible();
}

test.describe('DR-5 — a dropdown that searches and grows', () => {
  test('the list opens with the cursor already live, and the options already showing', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();

    // DR-5 clause 1: focused, so the next keystroke filters instead of being swallowed.
    await expect(page.getByTestId('item-category-input')).toBeFocused();
    // DR-5 clause 2: what it already holds is on screen BEFORE any keystroke.
    await expect(page.getByTestId('item-category-list')).toBeVisible();
  });

  test('the FIRST keystroke filters — it is not swallowed by the click that opened the list', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('zzz');           // typed, never filled — fill() would set focus itself
    await expect(page.getByTestId('item-category-input')).toHaveValue('zzz');
  });

  test('a value with no match offers + Add, and adding it selects it', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('Renewals');
    await expect(page.getByTestId('item-category-add')).toBeVisible();

    await page.getByTestId('item-category-add').click();
    await expect(page.getByTestId('item-category-trigger')).toContainText('Renewals');
  });

  test('what was added SURVIVES A RELOAD — an option that vanishes teaches distrust', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('Renewals');
    await page.getByTestId('item-category-add').click();
    await expect(page.getByTestId('item-category-trigger')).toContainText('Renewals');

    await page.reload();
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    // The assertion that matters: it is offered again, without being retyped.
    await expect(page.getByTestId('item-category-list')).toContainText('Renewals');
  });

  test('+ Add is NOT offered for a value that already exists in another case', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('Renewals');
    await page.getByTestId('item-category-add').click();

    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('renewals');
    // Offering + Add here is how one list ends up holding "Renewals" and "renewals".
    await expect(page.getByTestId('item-category-add')).toHaveCount(0);
    await expect(page.getByTestId('item-category-list')).toContainText('Renewals');
  });

  test('keyboard only: arrow to an option and Enter chooses it', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('Renewals');
    await page.keyboard.press('Enter');           // Enter on + Add commits the addition
    await expect(page.getByTestId('item-category-trigger')).toContainText('Renewals');

    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('item-category-trigger')).toContainText('Renewals');
  });

  test('Enter inside the select does not submit the surrounding form', async ({ page }) => {
    const { written } = await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.type('Renewals');
    await page.keyboard.press('Enter');
    // The user was choosing an option, not saving the record. A select that submits the dialog
    // on Enter saves a half-filled form, and the user never asked it to.
    await expect.poll(() => written.length).toBe(0);
  });

  test('Escape closes the list and keeps the dialog open', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('item-category-trigger')).toBeVisible();
    await expect(page.getByTestId('item-form-mode')).toBeVisible(); // the dialog did not close too
  });

  /* DR-5's contrast clause, asserted HERE rather than in tests/render/ for a reason worth
   * knowing: the gate runs test:unit (G7) and test:functional (G8) and never runs test:render,
   * so an assertion placed in the render tier is a rung nothing executes - which is the exact
   * thing CLAUDE.md's first idea forbids. Recorded as RC-016; until the tier is gated, the
   * assertions that must not rot live where they run. The active row is the one element whose
   * background CHANGES, and a filtered list is where pale-on-pale first appears. */
  for (const theme of ['light', 'dark'] as const) {
    test(`the active row stays readable in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('app.theme', t), theme);
      await boot(page, [record()]);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await openEditor(page);
      await page.getByTestId('item-category-trigger').click();
      await page.keyboard.type('Renewals');
      await page.getByTestId('item-category-add').click();

      await page.getByTestId('item-category-trigger').click();
      await page.keyboard.press('ArrowDown'); // put a row into the active (highlighted) state
      const { fg, bg } = await measure(page, '.sselect__opt.is-active');
      expect(ratio(parse(fg), parse(bg)), `active row in ${theme}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('the combobox announces itself correctly', async ({ page }) => {
    await boot(page, [record()]);
    await openEditor(page);
    await page.getByTestId('item-category-trigger').click();
    const input = page.getByTestId('item-category-input');
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('item-category-list')).toHaveAttribute('role', 'listbox');
  });
});
