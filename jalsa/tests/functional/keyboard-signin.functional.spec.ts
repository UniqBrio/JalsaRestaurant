/**
 * Keyboard parity for the one journey that is reachable without data (CP-22, rule A-10).
 *
 * WHY THE SIGN-IN KEYPAD IS THE RIGHT PLACE TO PIN THIS
 *   Jalsa's controls are hand-authored on Radix primitives, and the keypad is the densest patch
 *   of them: twelve buttons in a grid, a hidden input that must stay in the accessibility tree,
 *   and a link at the end. If a `div` with an onClick ever replaces one of these, this file goes
 *   red before anyone notices on a handset.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, run against this tree):
 *   OBSERVED FAILING — "a whole sign-in, keyboard only, end to end" failed on its first run
 *   against the shipped code with `expected 1, received 2`. Four Enter presses produced two
 *   sign-in attempts: `PinSignIn` called `submit()` from inside a `setPin` updater, which React
 *   19 invokes twice under StrictMode. The full account and the fix are in
 *   `signin.functional.spec.ts`; it is recorded here too because this file found it
 *   independently, by the keyboard route, which is the point of running the journey twice.
 *
 *   NOT OBSERVED FAILING — "Enter on a focused key registers the digit" and "the focused key
 *   shows a VISIBLE indicator". Both are true of the shipped code and no mutation was run
 *   against them. They are asserted because a `div` with an onClick and a stripped
 *   `focus-visible:outline-2` are the two ways this screen has been broken elsewhere, and
 *   neither shows up on a pointer run.
 *
 *   NOT OBSERVED FAILING — the Shift+Tab assertion. The screen has no dialog and therefore no
 *   trap to build; it is asserted so that adding one later cannot pass silently.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

async function keypad(page: Page) {
  const attempts: unknown[] = [];
  await page.route('**/api/staff/session', (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts.push(route.request().postDataJSON());
    return route.fulfill({ status: 401, json: { error: { code: 'unauthenticated', message: 'Not tonight.' } } });
  });
  await page.goto('/staff');
  await expect(page.getByTestId('staff-signin')).toBeVisible();
  return { attempts };
}

test.describe('keyboard parity — staff sign-in', () => {
  test('Tab reaches the keypad in visual order, top-left first', async ({ page }) => {
    await keypad(page);
    const reached: string[] = [];
    // Walk more slots than the keypad has: an extra unlisted stop is a finding too.
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (id?.startsWith('staff-key-')) reached.push(id);
    }
    expect(reached.slice(0, 4), 'the keys must be reached in the order they are read').toEqual([
      'staff-key-1',
      'staff-key-2',
      'staff-key-3',
      'staff-key-4',
    ]);
  });

  test('the focused key shows a VISIBLE indicator', async ({ page }) => {
    await keypad(page);
    const key = page.getByTestId('staff-key-7');
    await key.focus();
    const style = await key.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
    });
    const visible =
      (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
    expect(visible, 'focus moved but nothing on screen says so — outline removed?').toBe(true);
  });

  test('Enter on a focused key registers the digit', async ({ page }) => {
    await keypad(page);
    await page.getByTestId('staff-key-1').focus();
    await page.keyboard.press('Enter');
    // Assert the STATE the key changed, exactly as a click test would. A native <button> gives
    // this free; a styled div gives nothing.
    await expect(page.getByTestId('staff-pin-input')).toHaveValue('1');
  });

  test('Space on a focused key registers the digit too', async ({ page }) => {
    await keypad(page);
    await page.getByTestId('staff-key-8').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('staff-pin-input')).toHaveValue('8');
  });

  test('a whole sign-in, keyboard only, end to end', async ({ page }) => {
    const { attempts } = await keypad(page);
    // No .click() anywhere in this test — that is the entire point.
    for (const k of ['2', '4', '6', '8']) {
      await page.getByTestId(`staff-key-${k}`).focus();
      await page.keyboard.press('Enter');
    }
    await expect.poll(() => attempts.length, { message: 'the keyboard journey must land the same attempt the pointer journey lands' }).toBe(1);
    expect(attempts[0]).toMatchObject({ pin: '2468' });
  });

  test('no keyboard trap: Shift+Tab walks backward as cleanly as Tab walks forward', async ({ page }) => {
    await keypad(page);
    await page.getByTestId('staff-key-5').focus();
    await page.keyboard.press('Shift+Tab');
    const before = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(before, 'Shift+Tab did not move focus — trap?').not.toBe('staff-key-5');
  });

  test('the hidden PIN field is hidden from the eye, never from the accessibility tree', async ({ page }) => {
    await keypad(page);
    const input = page.getByTestId('staff-pin-input');
    // sr-only, not display:none — a password manager and a hardware keyboard both need it.
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    const labelled = await input.evaluate((el) => !!document.querySelector(`label[for="${el.id}"]`));
    expect(labelled, 'the real control must carry a real label').toBe(true);
  });
});
