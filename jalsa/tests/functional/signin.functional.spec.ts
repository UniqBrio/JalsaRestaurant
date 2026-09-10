/**
 * The sign-in keypad — the one journey every member of staff makes, every shift.
 *
 * WHY THIS SCREEN CARRIES THE FUNCTIONAL TIER'S WEIGHT
 *   It is the only surface in this application that renders a complete, real journey without a
 *   database: the route resolves, finds no session cookie, and hands back the keypad. Everything
 *   past it is bill data. So this is where the shape of a Jalsa journey test is pinned.
 *
 * THE ONE BOUNDARY
 *   `/api/staff/session`. The browser in this application never speaks to Supabase — every read
 *   and write goes through this app's own route handlers — so mocking that path is mocking the
 *   whole outside world, in one place, exactly once.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, run against this tree):
 *   OBSERVED FAILING — "the fourth digit IS the submit, and it submits exactly once" failed on
 *   its FIRST run against the shipped code, with `expected 1, received 2`. The keypad called
 *   `submit()` from inside a `setPin` updater, and React 19 deliberately invokes an updater
 *   twice under StrictMode — so every correct four-digit PIN produced two sign-in attempts.
 *   Against any lockout policy that is a captain locked out of their own shift for typing their
 *   PIN correctly, once. Nothing on screen showed it. Fixed in `src/features/staff/PinSignIn.tsx`
 *   by computing the next value outside the updater; the same run turned green.
 *
 *   OBSERVED FAILING — "a fifth tap cannot slip a fifth digit past the four-digit rule" and
 *   "a whole sign-in, keyboard only, end to end" (`keyboard-signin.functional.spec.ts`) failed
 *   on the same defect and the same fix, which is what a real root cause looks like.
 *
 *   OBSERVED FAILING — "a refused PIN is refused in the restaurant's own words" failed first
 *   with `expected "Ask Javeed", received "Not tonight / That PIN did not work."`: the mock had
 *   wrapped the body in `{error:{…}}` while `fail()` returns code and message at the top level,
 *   so the screen fell back to its generic sentence. Recorded because it is the honest kind of
 *   red — a mock that had drifted from the contract, found by the assertion rather than by a
 *   reader.
 *
 *   NOT OBSERVED FAILING — the 44px touch-target assertion. The keys are `h-14` (56px) and no
 *   mutation short of editing that class makes it fail; it is asserted because the class is the
 *   kind of thing a redesign changes without anyone re-measuring, not because it is currently
 *   load-bearing.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

interface Attempt {
  pin: string;
}

/** Boot the keypad with the single outside boundary under our control. */
async function keypad(page: Page, reply: { status: number; json: unknown }) {
  const attempts: Attempt[] = [];
  await page.route('**/api/staff/session', (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts.push(route.request().postDataJSON() as Attempt);
    return route.fulfill({ status: reply.status, json: reply.json });
  });
  await page.goto('/staff');
  await expect(page.getByTestId('staff-signin')).toBeVisible();
  return { attempts };
}

/* The shape `fail()` actually returns — code and message at the top level, no envelope. A mock
   that invents a different shape tests the mock. */
const REFUSED = {
  status: 401,
  json: { code: 'unauthenticated', message: 'That PIN is not one of ours. Ask Javeed to check it.' },
};

test.describe('staff sign-in', () => {
  test('the keypad is the screen, and every digit is on it', async ({ page }) => {
    await keypad(page, REFUSED);
    for (const k of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      await expect(page.getByTestId(`staff-key-${k}`), `digit ${k} must be on the keypad`).toBeVisible();
    }
    await expect(page.getByTestId('staff-key-back')).toBeVisible();
  });

  test('the fourth digit IS the submit, and it submits exactly once', async ({ page }) => {
    const { attempts } = await keypad(page, REFUSED);
    for (const k of ['1', '2', '3', '4']) await page.getByTestId(`staff-key-${k}`).click();

    // Assert the REQUEST, not the spinner. A keypad that looks like it submitted and did not is
    // a captain standing at a table pressing keys.
    await expect.poll(() => attempts.length, { message: 'four taps must send exactly one attempt' }).toBe(1);
    expect(attempts[0]).toMatchObject({ pin: '1234' });
  });

  test('a fifth tap cannot slip a fifth digit past the four-digit rule', async ({ page }) => {
    const { attempts } = await keypad(page, REFUSED);
    for (const k of ['1', '2', '3', '4', '5']) await page.getByTestId(`staff-key-${k}`).click();
    await expect.poll(() => attempts.length).toBe(1);
    expect(attempts[0]?.pin, 'the PIN sent must be the first four digits, not five').toBe('1234');
  });

  test('a refused PIN is refused in the restaurant’s own words, and the dots clear', async ({ page }) => {
    await keypad(page, REFUSED);
    for (const k of ['9', '9', '9', '9']) await page.getByTestId(`staff-key-${k}`).click();

    const error = page.getByTestId('staff-pin-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Ask Javeed');
    // No machine text ever reaches a person standing in a dining room.
    await expect(error).not.toContainText(/constraint|null|undefined|stack|postgres|5\d\d/i);
    // And the keypad is ready for the next try rather than holding a dead value.
    await expect(page.getByTestId('staff-pin-input')).toHaveValue('');
  });

  test('a till that cannot be reached says so, and does not claim the PIN was wrong', async ({ page }) => {
    // The difference matters: "wrong PIN" sends someone to find the owner; "no connection"
    // sends them to the router. Telling them the first when it is the second wastes a shift.
    await page.route('**/api/staff/session', (route: Route) => route.abort('connectionrefused'));
    await page.goto('/staff');
    for (const k of ['1', '2', '3', '4']) await page.getByTestId(`staff-key-${k}`).click();

    const error = page.getByTestId('staff-pin-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/wifi/i);
    await expect(error).not.toContainText(/PIN did not work|not one of ours/i);
  });

  test('every key clears the 44px floor for a thumb', async ({ page }) => {
    await keypad(page, REFUSED);
    for (const k of ['1', '5', '9', '0', 'back']) {
      const box = await page.getByTestId(`staff-key-${k}`).boundingBox();
      expect(box, `key ${k} has no box`).not.toBeNull();
      expect(box!.height, `key ${k} is under the 44px touch floor`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `key ${k} is under the 44px touch floor`).toBeGreaterThanOrEqual(44);
    }
  });

  test('the last control is reachable at a SHORT viewport', async ({ page }) => {
    // 360x640, not 360x800: the taller frame does not overflow, so it cannot expose occlusion.
    await page.setViewportSize({ width: 360, height: 640 });
    await keypad(page, REFUSED);

    const back = page.getByTestId('staff-signin-home-link');
    await back.scrollIntoViewIfNeeded();
    // No { force: true }. If fixed chrome covers it, Playwright fails with "intercepts pointer
    // events" — and that failure IS the assertion.
    await back.click();
    await expect(page.getByTestId('home-staff')).toBeVisible();
  });

  test('the page never scrolls sideways at the narrowest phone we support', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await keypad(page, REFUSED);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, 'horizontal scroll on a phone is a layout defect, never a preference').toBeLessThanOrEqual(0);
  });
});
