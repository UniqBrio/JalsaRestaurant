/**
 * The closure path after "Request payment": three upsell tabs that accumulate into one bill, and
 * a tip row that takes any amount. Requests 2026-09-12-guest-upsell-three-tabs,
 * -tip-latency and -tip-custom-amount.
 *
 * WHAT IT RUNS AGAINST
 *   The dedicated TEST project, reset before the suite by `scripts/reset-test-db.mjs`, which
 *   refuses the development/production project by ref. This file WRITES — a session, cart lines,
 *   rounds, a bill, a tip — on the table this spec is allocated in this browser project
 *   (tests/support/tables.ts) — and does not clean up: the reset before the next run is
 *   what makes the state known.
 *
 * WHY THE ASSERTIONS ARE ABOUT STAYING PUT
 *   The screen this replaced navigated away the instant one item was added, so the journey the
 *   request describes — a dessert, then a drink, then something for home — was not merely
 *   awkward, it was impossible. "Still on the upsell screen after adding" is the defect, stated.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026):
 *   OBSERVED FAILING — on the build container, where the database is unreachable (curl to the
 *   project's REST endpoint returns 000), the first assertion fails with `unreachable-guest`
 *   rendered instead of the welcome screen. The file goes RED rather than silent where it
 *   cannot run.
 *   NOT OBSERVED FAILING — every behavioural assertion below. They cannot be executed here at
 *   all; the first CI run against the test project is their first execution. The pure halves of
 *   the same changes ARE covered by recorded red-then-green runs in
 *   tests/unit/write-echo.unit.spec.ts.
 */
import { test, expect, type Page } from '@playwright/test';
import { tableFor } from '../support/tables';

/**
 * The table this spec owns. Allocated per (spec file x browser project) so the six projects that
 * run this file never write to one another's table - see tests/support/tables.ts. Called inside
 * each test rather than assigned at module scope, because the project name is only knowable once
 * a test is running.
 */
const table = () => tableFor('closure-upsell-tip');

async function orderAndAskForTheBill(page: Page) {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await expect(page.getByTestId('unreachable-guest')).toHaveCount(0);
  await page.getByTestId('guest-start-ordering').click();
  const adds = page.locator('[data-testid^="guest-add-"]');
  await expect(adds.first()).toBeVisible();
  await adds.nth(0).click();
  await page.getByTestId('guest-review-order').click();
  await page.getByTestId('guest-send-to-kitchen').click();
  await expect(page.getByTestId('guest-placed')).toBeVisible();
  await page.getByTestId('guest-see-my-order').click();
  await expect(page.getByTestId('guest-status')).toBeVisible();
  await page.getByTestId('guest-request-payment').click();
}

/**
 * Put THIS page on the upsell screen, from wherever the table already is.
 *
 * WHY A TEST NEEDS THIS AT ALL
 *   Playwright's `page` fixture is per-TEST. `describe.serial` orders the tests and keeps them in
 *   one worker, but it does not hand a page from one to the next — so a test that opens by
 *   clicking something is clicking on `about:blank`. That is what CI run 34936577339 found on
 *   four projects: `locator.click: Timeout 10000ms exceeded · waiting for
 *   getByTestId('guest-upsell-skip')`, with nothing on screen to wait for.
 *
 * WHY IT BRANCHES RATHER THAN ALWAYS ORDERING
 *   The table is shared by this file's tests by design (one table per spec per browser project,
 *   `tests/support/tables.ts`), so its bill persists between them. A test that assumed a fresh
 *   table would fail whenever it did not run first — the same ordering dependence in the other
 *   direction. So this reads what the table IS and takes the route the application provides:
 *     - no rounds yet        -> the welcome screen -> order and ask for the bill
 *     - a bill already asked -> the order list -> "Carry on to pay", which is
 *       `guest-continue-closure` in the payment_requested branch of the status action bar
 *     - rounds but no request -> the order list -> "Request payment"
 *   Every one of those is a control a guest has; none is a test-only path.
 *
 * WHY THE BRANCH IS NOT A RACE
 *   `expect(a.or(b)).toBeVisible()` waits for whichever screen this table actually opens on
 *   before anything is probed. Nothing here sleeps or retries on a guess.
 */
async function reachTheUpsell(page: Page) {
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('unreachable-guest')).toHaveCount(0);

  const welcome = page.getByTestId('guest-welcome');
  const status = page.getByTestId('guest-status');
  await expect(welcome.or(status), 'the table opens on the welcome screen or the order list').toBeVisible();

  if (await status.isVisible()) {
    const carryOn = page.getByTestId('guest-continue-closure');
    const ask = page.getByTestId('guest-request-payment');
    await expect(carryOn.or(ask), 'the order list offers a way on to the closure steps').toBeVisible();
    await ((await carryOn.isVisible()) ? carryOn : ask).click();
  } else {
    await orderAndAskForTheBill(page);
  }

  await expect(page.getByTestId('guest-upsell')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('all three upsell options are on screen at once, and adding never moves the guest', async ({ page }) => {
  await orderAndAskForTheBill(page);
  const upsell = page.getByTestId('guest-upsell');
  await expect(upsell).toBeVisible();

  // Three, visible together, in a grid — not a strip to swipe.
  const tabs = page.getByTestId('guest-upsell-tabs');
  await expect(tabs).toBeVisible();
  const buttons = tabs.locator('[role="tab"]');
  await expect(buttons).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(buttons.nth(i)).toBeInViewport();
  expect(await tabs.evaluate((el) => el.scrollWidth > el.clientWidth + 1), 'no sideways scroll').toBe(false);

  // Desserts by default.
  await expect(page.getByTestId('guest-upsell-tab-desserts')).toHaveAttribute('aria-selected', 'true');

  // Add from Desserts. THE assertion: still here.
  const before = await page.getByTestId('guest-upsell-pay').textContent();
  await page.locator('[data-testid^="guest-upsell-add-"]').first().click();
  await expect(page.getByTestId('guest-upsell'), 'the guest must not be moved on').toBeVisible();
  await expect
    .poll(async () => page.getByTestId('guest-upsell-pay').textContent(), {
      message: 'the payable in the button must move with the addition',
    })
    .not.toBe(before);

  // Move across the tabs and add again — same bill, same screen.
  await page.getByTestId('guest-upsell-tab-beverages').click();
  await expect(page.getByTestId('guest-upsell-tab-beverages')).toHaveAttribute('aria-selected', 'true');
  const second = await page.getByTestId('guest-upsell-pay').textContent();
  await page.locator('[data-testid^="guest-upsell-add-"]').first().click();
  await expect(page.getByTestId('guest-upsell')).toBeVisible();
  await expect.poll(async () => page.getByTestId('guest-upsell-pay').textContent()).not.toBe(second);

  await page.getByTestId('guest-upsell-tab-share').click();
  await expect(page.getByTestId('guest-upsell-tab-share')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('guest-upsell-list-share')).toBeVisible();
});

test('the tip row takes a preset in one tap and any other amount in one tap and a number', async ({ page }) => {
  // This test's own page, on this test's own terms — see `reachTheUpsell`. It used to open on
  // the line below, with no page and no navigation behind it.
  await reachTheUpsell(page);
  await page.getByTestId('guest-upsell-skip').click();
  await expect(page.getByTestId('guest-tip')).toBeVisible();

  // Five options: the presets plus Custom.
  await expect(page.getByTestId('guest-tip-0')).toBeVisible();
  await expect(page.getByTestId('guest-tip-custom')).toBeVisible();
  await expect(page.getByTestId('guest-tip-custom-panel'), 'no input until asked for').toHaveCount(0);

  // A preset, and the bill follows it without the screen locking up.
  const plain = await page.getByTestId('guest-pay').textContent();
  await page.getByTestId('guest-tip-20').click();
  await expect.poll(async () => page.getByTestId('guest-pay').textContent()).not.toBe(plain);

  // Custom: one tap opens it, focused, and refuses nonsense in words.
  await page.getByTestId('guest-tip-custom').click();
  const input = page.getByTestId('guest-tip-custom-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  await page.getByTestId('guest-tip-custom-apply').click();
  await expect(page.getByTestId('guest-tip-custom-problem')).toBeVisible();

  // Letters cannot even be typed into it.
  await input.fill('ab5c0');
  await expect(input).toHaveValue('50');
  await page.getByTestId('guest-tip-custom-apply').click();
  await expect(page.getByTestId('guest-tip-custom-panel')).toHaveCount(0);
  await expect(page.getByTestId('guest-tip-custom'), 'the option now names the amount').toContainText('50');
  await expect.poll(async () => page.getByTestId('guest-pay').textContent()).toContain('₹');

  // The payment button never left the screen.
  await expect(page.getByTestId('guest-pay')).toBeInViewport();
});

test('a table that decides on one more round never has to cancel anything first', async ({ page }) => {
  await orderAndAskForTheBill(page);
  await expect(page.getByTestId('guest-upsell')).toBeVisible();

  // Back to the order list, where the request is waiting.
  await page.goto(`/t/${table()}`);
  await expect(page.getByTestId('guest-status')).toBeVisible();
  const go = page.getByTestId('guest-continue-ordering');
  await expect(go, 'the way back to the menu is on the screen, not implied').toBeVisible();

  await go.click();
  await expect(page.getByTestId('guest-menu'), 'one tap lands on the menu').toBeVisible();

  // The state is stated rather than left to be inferred, and the bill is open again.
  await expect
    .poll(async () => (await page.request.get(`/api/guest/state?table=${table()}`)).json())
    .toMatchObject({ billStatus: 'open', paymentPaused: true });

  // Same bill, same table: another round joins what is already there.
  const adds = page.locator('[data-testid^="guest-add-"]');
  await adds.first().click();
  await page.getByTestId('guest-review-order').click();
  await page.getByTestId('guest-send-to-kitchen').click();
  await expect(page.getByTestId('guest-placed')).toBeVisible();

  const state = (await (await page.request.get(`/api/guest/state?table=${table()}`)).json()) as {
    rounds: unknown[];
    billStatus: string;
  };
  expect(state.rounds.length, 'the earlier rounds are still on this bill').toBeGreaterThan(1);
  expect(state.billStatus, 'and it is an ordinary open bill again').toBe('open');

  // And they can ask again when they are actually finished.
  await page.getByTestId('guest-see-my-order').click();
  await expect(page.getByTestId('guest-payment-paused')).toBeVisible();
  await expect(page.getByTestId('guest-request-payment')).toBeVisible();
});
