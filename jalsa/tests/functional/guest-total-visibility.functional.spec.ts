/**
 * The order total is the guest's to reveal, and nothing on this screen is hidden behind the
 * bottom bar. Requests 2026-09-12-guest-total-visibility, -guest-cart-footer-occlusion and
 * -guest-menu-sticky-filters.
 *
 * WHAT IT RUNS AGAINST
 *   The same dedicated TEST project the guest journey uses, reset before the suite by
 *   `scripts/reset-test-db.mjs` — never the development/production project, which that script
 *   refuses by ref. This file WRITES: a guest_session and cart lines, on the table this spec is
 *   allocated in this browser project (tests/support/tables.ts). It does not
 *   clean up, for the reason the journey spec gives — the reset before the next run is what
 *   makes the state known, and a failed run that left its evidence is worth more than a tidy one.
 *
 * WHY THE OCCLUSION ASSERTION IS GEOMETRY AND NOT A SCREENSHOT
 *   The reported defect was "these details are hidden behind the Send to the kitchen button" —
 *   the totals card was ON the page, visible to every `toBeVisible()` Playwright has, and
 *   underneath a fixed bar. Visibility could not have caught it and never would have. Comparing
 *   the bottom of the scrolled content against the top of the bar can.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026):
 *   OBSERVED FAILING — on the build container, where the database is unreachable: the first
 *   assertion fails with `unreachable-guest` rendered instead of the welcome screen. That proves
 *   the file goes RED rather than silent where it cannot run, which is the property that matters
 *   for a spec whose real execution is in CI.
 *   NOT OBSERVED FAILING — the four behavioural assertions below (default hidden, tick reveals,
 *   choice survives navigation, nothing under the bar). They cannot be executed here at all; the
 *   first CI run against the test project is their first execution. The pre-change tree is
 *   nonetheless known red for two of them by inspection of the diff — it had no
 *   `guest-menu-total-toggle` element to find, and its bar overlapped its own totals card — and
 *   that is a weaker claim than a recorded run, which is why it is written here as one.
 */
import { test, expect, type Page } from '@playwright/test';
import { tableFor } from '../support/tables';

/**
 * The table this spec owns. Allocated per (spec file x browser project) so the six projects that
 * run this file never write to one another's table - see tests/support/tables.ts. Called inside
 * each test rather than assigned at module scope, because the project name is only knowable once
 * a test is running.
 */
const table = () => tableFor('guest-total-visibility');

/** The gap between the bottom of the page's own content and the top of the fixed bar. */
async function clearance(page: Page, barTestId: string): Promise<number> {
  return page.evaluate((id) => {
    const bar = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const main = document.querySelector<HTMLElement>('main');
    if (!bar || !main) return Number.NaN;
    return bar.getBoundingClientRect().top - main.getBoundingClientRect().bottom;
  }, barTestId);
}

test.describe.configure({ mode: 'serial' });

test('the total is hidden until the guest asks for it, and stays asked for', async ({ page }) => {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await expect(page.getByTestId('unreachable-guest')).toHaveCount(0);

  await page.getByTestId('guest-start-ordering').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();
  const adds = page.locator('[data-testid^="guest-add-"]');
  await expect(adds.first()).toBeVisible();
  await adds.nth(0).click();

  // 1. The default. The bar appears with the cart; the amount does not.
  await expect(page.getByTestId('guest-cart-bar')).toBeVisible();
  const toggle = page.getByTestId('guest-menu-total-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle, 'off before anyone touches it').not.toBeChecked();
  await expect(page.getByTestId('guest-menu-total-toggle-amount')).toHaveCount(0);
  await expect(page.getByTestId('guest-review-order'), 'and no amount in the button').not.toContainText('₹');

  // 2. The guest asks. One tap, and the figure is there.
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByTestId('guest-menu-total-toggle-amount')).toContainText('₹');

  // 3. It stays asked for. Walking to the order and back must not re-hide it — a preference that
  //    resets on navigation is a preference the guest has to keep re-stating.
  await page.getByTestId('guest-review-order').click();
  await expect(page.getByTestId('guest-cart')).toBeVisible();
  await expect(page.getByTestId('guest-cart-total-toggle')).toBeChecked();
  await expect(page.getByTestId('guest-cart-total-toggle-amount')).toContainText('₹');
});

test('nothing on the order screen sits underneath the bottom bar', async ({ page }) => {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await page.getByTestId('guest-start-ordering').click();
  const adds = page.locator('[data-testid^="guest-add-"]');
  await expect(adds.first()).toBeVisible();
  await adds.nth(0).click();
  await page.getByTestId('guest-review-order').click();
  await expect(page.getByTestId('guest-cart')).toBeVisible();

  // Scroll to the very bottom: that is where the defect was visible on a real phone.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByTestId('guest-cart-actions')).toBeVisible();

  const gap = await clearance(page, 'guest-cart-actions');
  expect(Number.isNaN(gap), 'the bar and the page content must both be on the page').toBe(false);
  expect(gap, 'the fixed bar must start at or below the end of the content').toBeGreaterThanOrEqual(-1);

  // And with the total revealed — the state that made the bar tallest and caused the report.
  await page.getByTestId('guest-cart-total-toggle').click();
  await expect(page.getByTestId('guest-cart-total-toggle-amount')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await clearance(page, 'guest-cart-actions'), 'still clear with the total shown').toBeGreaterThanOrEqual(-1);
});

test('search and the filters stay reachable however far down the menu the guest is', async ({ page }) => {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await page.getByTestId('guest-start-ordering').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();

  const filters = page.getByTestId('guest-menu-filters');
  const topBefore = (await filters.boundingBox())?.y ?? Number.NaN;

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(filters, 'still on screen at the bottom of 57 dishes').toBeInViewport();

  const box = await filters.boundingBox();
  expect(box, 'the block must still have a box after scrolling').not.toBeNull();
  // Stuck, not scrolled: it has not moved up off the screen with the list.
  expect(box?.y ?? -1, 'frozen under the header').toBeGreaterThanOrEqual(0);
  expect(box?.y ?? -1).toBeLessThanOrEqual(Math.max(topBefore, 0) + 1);

  // And it still WORKS from down here, which is the whole point of freezing it.
  await page.getByTestId('guest-menu-search').fill('zzzz-no-such-dish');
  await expect(page.getByTestId('guest-menu-nomatch')).toBeVisible();
});

test('every category is reachable in one tap, with no sideways scrolling', async ({ page }) => {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await page.getByTestId('guest-start-ordering').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();

  // The row of chips is gone; a button stands where it was.
  const open = page.getByTestId('guest-open-categories');
  await expect(open).toBeVisible();
  await expect(open).toContainText('Categories');

  await open.click();
  const sheet = page.getByTestId('guest-categories-sheet');
  await expect(sheet).toBeVisible();

  // ALL of them at once — that is the ask, and a count is the only way to assert "all".
  const options = sheet.locator('[data-testid^="guest-cat-"]');
  const n = await options.count();
  expect(n, 'Everything plus every category the menu has').toBeGreaterThanOrEqual(8);

  // And every one of them is on screen without scrolling the sheet sideways or down.
  for (let i = 0; i < n; i++) await expect(options.nth(i)).toBeInViewport();
  const overflowsSideways = await sheet.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(overflowsSideways, 'the sheet must not scroll horizontally').toBe(false);

  // Pick one: the menu filters immediately and the sheet gets out of the way.
  await page.getByTestId('guest-cat-biryani').click();
  await expect(sheet).toHaveCount(0);
  await expect(open, 'the button now names the choice').toContainText('Biryani');
  const rows = page.locator('[data-testid^="guest-item-"]');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toContainText('Biryani');

  // Switching is reopen, tap — no scrolling anywhere in between.
  await open.click();
  await expect(page.getByTestId('guest-categories-sheet')).toBeVisible();
  await page.getByTestId('guest-cat-all').click();
  await expect(open).toContainText('Categories');

  // The Review order bar is still where it was, at the bottom, throughout.
  const adds = page.locator('[data-testid^="guest-add-"]');
  await adds.first().click();
  await expect(page.getByTestId('guest-review-order')).toBeVisible();
});

test('every dish row holds the space a photograph will occupy', async ({ page }) => {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await page.getByTestId('guest-start-ordering').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();

  const rows = page.locator('[data-testid^="guest-item-"]:not([data-testid^="guest-item-image-"])');
  await expect(rows.first()).toBeVisible();
  const tiles = page.locator('[data-testid^="guest-item-image-"]');
  expect(await tiles.count(), 'one per dish row, not a decoration on the first').toBe(await rows.count());

  // It is a SPACE, so the assertion is that it has one — a 0x0 placeholder reserves nothing and
  // the re-flow it exists to prevent happens anyway.
  const box = await tiles.first().boundingBox();
  expect(box?.width ?? 0, 'wide enough to be a thumbnail').toBeGreaterThanOrEqual(40);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

  // And it is on the LEFT of the name, which is the whole of the request.
  const name = rows.first().locator('span', { hasText: /./ }).first();
  const nameBox = await name.boundingBox();
  expect(box?.x ?? 1, 'left of the name').toBeLessThan(nameBox?.x ?? 0);

  // Decorative: it must not reach the accessibility tree between the mark and the name.
  await expect(tiles.first()).toHaveAttribute('aria-hidden', 'true');
});

test('a tap lands on the row at once, and a run of taps all count', async ({ page }) => {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await page.getByTestId('guest-start-ordering').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();

  const firstAdd = page.locator('[data-testid^="guest-add-"]').first();
  const id = (await firstAdd.getAttribute('data-testid'))!.replace('guest-add-', '');

  // IMMEDIATELY: no waiting on the network. The stepper replaces the + on the same frame, so a
  // tight timeout is the assertion — a generous one would pass on the old behaviour too.
  await firstAdd.click();
  await expect(page.getByTestId(`guest-qty-${id}-qty`), 'the row shows the tap at once').toHaveText('1', {
    timeout: 400,
  });
  await expect(page.getByTestId('guest-cart-bar'), 'and so does the bar').toBeVisible({ timeout: 400 });

  // A run of taps: every one counts. Under the old code the second and third were dropped
  // outright, because every control was disabled until the first write came back.
  const plus = page.getByTestId(`guest-qty-${id}-increase`);
  await plus.click();
  await plus.click();
  await expect(page.getByTestId(`guest-qty-${id}-qty`)).toHaveText('3', { timeout: 600 });

  // And the server agrees once the collapse window closes — the screen was ahead, not wrong.
  await expect
    .poll(
      async () => {
        const s = (await (await page.request.get(`/api/guest/state?table=${table()}`)).json()) as {
          menu: Array<{ id: string; inCart: number }>;
        };
        return s.menu.find((m) => m.id === id)?.inCart;
      },
      { message: 'the stored cart catches up with the screen' }
    )
    .toBe(3);

  // Send must not lose a tap made a moment before it: the round is placed from the STORED cart.
  await page.getByTestId('guest-review-order').click();
  await expect(page.getByTestId('guest-cart')).toBeVisible();
  await page.getByTestId(`guest-cart-qty-${id}-increase`).click();
  await page.getByTestId('guest-send-to-kitchen').click();
  await expect(page.getByTestId('guest-placed')).toBeVisible();

  const state = (await (await page.request.get(`/api/guest/state?table=${table()}`)).json()) as {
    rounds: Array<{ items: Array<{ qty: number }> }>;
  };
  const sent = state.rounds.at(-1)?.items.reduce((n, i) => n + i.qty, 0) ?? 0;
  expect(sent, 'the tap just before Send is in the round, not lost to the debounce').toBe(4);
});
