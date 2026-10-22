/**
 * The print prompts shown while Enable KOT Printing or Enable Invoice Printing is off (22-Oct-2026).
 *
 * The REAL PrintAskProvider and the REAL ConfirmDialog are bundled (mounts/print-ask.entry.tsx)
 * onto a page carrying the app's stylesheet and driven with real taps, at phone width, in both
 * themes. `send` is recorded, so "Skip prints nothing" and "a double tap sends one request" are
 * counted, not assumed.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/print-ask.entry.tsx', import.meta.url));
const CAPTAIN = ['orders.reprint', 'bill.record_payment'];

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, opts: { theme?: 'light' | 'dark'; grants?: string[]; answer?: Record<string, unknown> } = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), opts.theme ?? 'light');
  await page.evaluate((g) => ((window as unknown as { __grants: string[] }).__grants = g), opts.grants ?? CAPTAIN);
  await page.addScriptTag({ content: bundle });
  if (opts.answer) await page.evaluate((a) => ((window as unknown as { __printAnswer: unknown }).__printAnswer = a), opts.answer);
  await expect(page.getByTestId('harness-round')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => (window as unknown as { __sent: unknown[] }).__sent);
const reply = (page: Page, r: 'queued' | 'already' | 'no-printer') =>
  page.evaluate((v) => ((window as unknown as { __printReply: string }).__printReply = v), r);

for (const theme of ['light', 'dark'] as const) {
  test(`KOT off, ${theme}: a new round asks in the request's words, and Skip sends nothing`, async ({ page }) => {
    await mount(page, { theme });
    await page.getByTestId('harness-round').click();
    const dialog = page.getByTestId('print-ask-kot');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Do you want to print this KOT?');
    await expect(dialog).toContainText('KOT-001 · Table A5. Only this KOT prints — Enable KOT Printing stays off.');
    await expect(page.getByTestId('print-ask-kot-confirm')).toHaveText('Print KOT');
    await expect(page.getByTestId('print-ask-kot-keep')).toHaveText('Skip');
    await page.screenshot({ path: test.info().outputPath(`print-ask-kot-${theme}.png`) });
    await page.getByTestId('print-ask-kot-keep').click();
    await expect(dialog).toBeHidden();
    expect(await sent(page)).toEqual([]);
  });
}

test('Print KOT tapped twice sends ONE request, for that round only, and says where it went', async ({ page }) => {
  await mount(page);
  await page.getByTestId('harness-round').click();
  const print = page.getByTestId('print-ask-kot-confirm');
  await print.click();
  // The second tap lands while the first is on its way (the reply takes 150 ms).
  await print.click({ force: true }).catch(() => undefined);
  await expect(page.getByTestId('print-ask-kot')).toBeHidden();
  expect(await sent(page)).toEqual([{ action: 'print-kot', kotId: 'k1' }]);
  await expect(page.getByTestId('toast').first()).toContainText('KOT-001 sent to Counter');
});

test('every new round asks - two rounds are two questions, oldest first', async ({ page }) => {
  await mount(page);
  await page.getByTestId('harness-two-rounds').click();
  await expect(page.getByTestId('print-ask-kot')).toContainText('KOT-001');
  await page.getByTestId('print-ask-kot-keep').click();
  await expect(page.getByTestId('print-ask-kot')).toContainText('KOT-002');
  await page.getByTestId('print-ask-kot-confirm').click();
  await expect(page.getByTestId('print-ask-kot')).toBeHidden();
  expect(await sent(page)).toEqual([{ action: 'print-kot', kotId: 'k2' }]);
});

test('invoice off: after the payment it asks in the request\'s words, and Print Invoice prints that bill once', async ({ page }) => {
  await mount(page);
  await page.getByTestId('harness-pay').click();
  const dialog = page.getByTestId('print-ask-invoice');
  await expect(dialog).toContainText('Payment successful. Do you want to print the invoice?');
  await expect(dialog).toContainText('B-104. Only this invoice prints — Enable Invoice Printing stays off.');
  await expect(page.getByTestId('print-ask-invoice-confirm')).toHaveText('Print Invoice');
  await page.getByTestId('print-ask-invoice-confirm').click();
  await expect(dialog).toBeHidden();
  expect(await sent(page)).toEqual([{ action: 'print-invoice', billId: 'b1' }]);
  await expect(page.getByTestId('toast').first()).toContainText('B-104 invoice sent to Counter');
});

test('the same payment answered again (a re-render, a repeated callback) does not ask a second time', async ({ page }) => {
  await mount(page);
  await page.getByTestId('harness-pay').click();
  await page.getByTestId('print-ask-invoice-keep').click();
  await expect(page.getByTestId('print-ask-invoice')).toBeHidden();
  await page.getByTestId('harness-pay-again').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('print-ask-invoice')).toBeHidden();
  expect(await sent(page)).toEqual([]);
});

test('printing ON: nothing is asked - the ticket already printed by itself', async ({ page }) => {
  await mount(page, { answer: { print: 'queued' } });
  await page.getByTestId('harness-round').click();
  await page.getByTestId('harness-pay').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('print-ask-kot')).toBeHidden();
  await expect(page.getByTestId('print-ask-invoice')).toBeHidden();
  expect(await sent(page)).toEqual([]);
});

test('a print that could not be sent is said in words, nothing is asked, and nothing is sent', async ({ page }) => {
  await mount(page, { answer: { print: 'failed', printProblem: 'It could not be sent to the printer just now.' } });
  await page.getByTestId('harness-pay').click();
  await expect(page.getByTestId('toast').first()).toContainText('Payment recorded, but the B-104 invoice did not print.');
  await expect(page.getByTestId('print-ask-invoice')).toBeHidden();
  expect(await sent(page)).toEqual([]);
});

test('no printer: the error is shown, the prompt stays so the person can try again or skip and continue', async ({ page }) => {
  await mount(page);
  await reply(page, 'no-printer');
  await page.getByTestId('harness-pay').click();
  await page.getByTestId('print-ask-invoice-confirm').click();
  await expect(page.getByTestId('toast').first()).toContainText('No printer is set to print bills');
  await expect(page.getByTestId('print-ask-invoice')).toBeVisible();
  await page.getByTestId('print-ask-invoice-keep').click();
  await expect(page.getByTestId('print-ask-invoice')).toBeHidden();
  expect(await sent(page)).toHaveLength(1);
});

test('"already sent" is answered in words and prints nothing new', async ({ page }) => {
  await mount(page);
  await reply(page, 'already');
  await page.getByTestId('harness-round').click();
  await page.getByTestId('print-ask-kot-confirm').click();
  await expect(page.getByTestId('toast').first()).toContainText('KOT-001 was already sent to the printer — it was not printed again');
});

test('someone without the grant to print is not asked a question they cannot act on', async ({ page }) => {
  await mount(page, { grants: ['orders.add_items'] });
  await page.getByTestId('harness-round').click();
  await page.getByTestId('harness-pay').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('print-ask-kot')).toBeHidden();
  await expect(page.getByTestId('print-ask-invoice')).toBeHidden();
});
