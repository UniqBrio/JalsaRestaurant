/**
 * The guest journey — scan → order → kitchen → add more → request payment → tip — against real
 * data, in the application's own words. Issue #3, row 1.
 *
 * WHAT IT RUNS AGAINST, AND WHY THAT IS THE FIRST THING SAID
 *   A dedicated TEST project, reset to its seed before the suite by `scripts/reset-test-db.mjs`.
 *   Never the development/production project: that script refuses it by ref. This file WRITES —
 *   a guest_session, cart lines, a bill on table A5, a KOT with its items, a tip — and it does
 *   not clean up after itself, because a failed run that left evidence behind is worth more than
 *   a tidy one, and the reset before the NEXT run is what makes the state known.
 *
 * WHERE THE JOURNEY STOPS, AND WHY
 *   At "payment requested, tip chosen". The guest never marks a bill paid — a named member of
 *   staff records the closure on the staff surface, and the database refuses anything else
 *   (bill_closure_is_attributed). So "pay → invoice → review" is the captain's half, issue #3
 *   row 2, and a spec that closed the bill from here would be asserting a path the product
 *   forbids.
 *
 * WHAT IS ASSERTED
 *   The DATA, read back through `/api/guest/state` — the same path the screen uses — never the
 *   toast. A round that "sent" but is absent from the state is the defect; a confirmation screen
 *   is what the app CLAIMS happened.
 *
 * FAIL-FIRST EVIDENCE (11-Sep-2026):
 *   OBSERVED FAILING — on the build container, where the database is unreachable: the first
 *   assertion (`guest-welcome` visible) fails with `unreachable-guest` rendered instead. That is
 *   the same pre-fix state the reachability rung records; it proves the file goes red, not
 *   silent, where it cannot run.
 *   NOT OBSERVED FAILING — every data assertion below (round present in state, status
 *   `payment_requested`, tip recorded). They cannot be executed here at all; the first CI run
 *   against the test project is their first execution, and its log is the evidence to record in
 *   TEST_SUMMARY.md in the same change that proves it green.
 */
import { test, expect, type Page } from '@playwright/test';

const TABLE = 'A5';

interface GuestState {
  phase: string;
  billStatus: string | null;
  tipChosen: number;
  rounds: Array<{ code: string; status: string; items: Array<{ name: string; qty: number }> }>;
}

/** The truth, read through the same route the screen polls. */
async function state(page: Page): Promise<GuestState> {
  const res = await page.request.get(`/api/guest/state?table=${TABLE}`);
  expect(res.ok(), `/api/guest/state answered ${res.status()}`).toBe(true);
  return (await res.json()) as GuestState;
}

test.describe.configure({ mode: 'serial' });

test('a guest orders, watches the kitchen, adds more, asks for the bill and tips — and the data agrees', async ({
  page,
}) => {
  // 1. Scan. A fresh phone at a reset table lands on the welcome screen, not on someone's bill.
  await page.goto(`/t/${TABLE}`);
  await expect(page.getByTestId('guest-welcome')).toBeVisible();
  await expect(page.getByTestId('unreachable-guest')).toHaveCount(0);
  expect((await state(page)).rounds, 'the reset must have left no rounds on this table').toHaveLength(0);

  // 2. Order. The menu is real: the first two available items, whatever the seed says they are.
  await page.getByTestId('guest-start-ordering').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();
  const adds = page.locator('[data-testid^="guest-add-"]');
  await expect(adds.first()).toBeVisible();
  await adds.nth(0).click();
  await adds.nth(1).click();

  await page.getByTestId('guest-review-order').click();
  await expect(page.getByTestId('guest-cart')).toBeVisible();
  await page.getByTestId('guest-send-to-kitchen').click();
  await expect(page.getByTestId('guest-placed')).toBeVisible();

  // The assertion that matters: the round exists, with two lines, in the state the screen reads.
  let s = await state(page);
  expect(s.rounds, 'one round after the first send').toHaveLength(1);
  expect(
    s.rounds[0]?.items.reduce((n, i) => n + i.qty, 0),
    'two items on it'
  ).toBe(2);
  expect(s.billStatus).toBe('open');

  // 3. Kitchen. The order list shows the round the kitchen sees.
  await page.getByTestId('guest-see-my-order').click();
  await expect(page.getByTestId('guest-status')).toBeVisible();
  await expect(page.getByTestId('guest-status')).toContainText(s.rounds[0]!.code);

  // 4. Add more. A second round joins the SAME bill — never a second bill on the table.
  await page.getByTestId('guest-order-more').click();
  await expect(page.getByTestId('guest-menu')).toBeVisible();
  await adds.nth(0).click();
  await page.getByTestId('guest-review-order').click();
  await page.getByTestId('guest-send-to-kitchen').click();
  await expect(page.getByTestId('guest-placed')).toBeVisible();
  s = await state(page);
  expect(s.rounds, 'two rounds, one bill').toHaveLength(2);
  expect(s.billStatus).toBe('open');

  // 5. Request payment. The guest asks; the status changes; nobody has closed anything.
  await page.getByTestId('guest-see-my-order').click();
  await page.getByTestId('guest-request-payment').click();
  s = await state(page);
  expect(s.billStatus, 'asking for the bill is a request, not a closure').toBe('payment_requested');

  // 6. Tip. Skip the upsell if it appears, then choose ₹20 — the seed's tip options are
  //    [0, 10, 20, 30] and the seed IS the fixture, so the value is deterministic. Not "the first
  //    chip": that is 0, addTip returns early on a zero, and the read-back would prove nothing.
  const skip = page.getByTestId('guest-upsell-skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByTestId('guest-tip')).toBeVisible();
  await page.getByTestId('guest-tip-20').click();
  s = await state(page);
  expect(s.tipChosen, 'the ₹20 tip is on the bill, read back through the state route').toBe(20);
  expect(s.billStatus, 'a tip does not close a bill').toBe('payment_requested');

  // 7. "Pay at the table" hands the closure to a person. The guest's half ends here.
  await page.getByTestId('guest-pay-at-table').click();
  await expect(page.getByTestId('guest-status')).toBeVisible();
});

test('a second phone at the same table joins the same bill — never a rival one', async ({ browser }) => {
  // Two contexts, two cookies, one table. The partial unique index is the rule; this is the
  // application path to it.
  const other = await browser.newContext();
  const page = await other.newPage();
  await page.goto(`/t/${TABLE}`);
  const res = await page.request.get(`/api/guest/state?table=${TABLE}`);
  const s = (await res.json()) as GuestState;
  expect(s.rounds.length, 'the second phone sees the rounds the first one placed').toBeGreaterThanOrEqual(2);
  expect(s.billStatus).toBe('payment_requested');
  await other.close();
});
