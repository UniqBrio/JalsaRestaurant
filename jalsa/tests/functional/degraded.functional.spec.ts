/**
 * What every surface does when the database does not answer.
 *
 * WHY THIS IS ITS OWN FILE, AGAINST ITS OWN SERVER
 *   In this application the initial payload is fetched in a server component, before any HTML
 *   reaches the browser. A route interception cannot reach that call, so the outage cannot be
 *   simulated from the test — it has to be real. `tests/support/servers.ts` boots a second,
 *   genuine instance of this application pointed at an address that refuses instantly, and these
 *   assertions are made against it.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, observed on this tree before the fix):
 *   OBSERVED FAILING — every assertion in this file. `curl -s -o /dev/null -w '%{http_code}'
 *   http://localhost:3000/t/A5` returned **500**: the guest surface threw the raw Supabase
 *   `TypeError: fetch failed` out of the server component and Next.js rendered its own error
 *   page. A person holding a phone over a QR stand was shown a blank apology with no sentence,
 *   no next step, and nothing naming what still works. The fix is `attempt()` in
 *   `src/lib/supabase/server.ts` plus `UnreachableState`; with it the same request returns 200
 *   and this file passes.
 *
 * WHY NOT "IT SHOULD NEVER HAPPEN"
 *   It happens every time the database is restarted, migrated, rate-limited or throttled, and
 *   every time a deployment's egress policy changes. The screen it produces is the one people
 *   judge the whole system by, because it is the only one they meet while something is wrong.
 */
import { test, expect } from '@playwright/test';
import { DEGRADED_URL } from '../support/servers';

test.describe('the database is unreachable', () => {
  test('a guest gets a sentence, not a stack trace — and is told what still works', async ({ page }) => {
    const response = await page.goto(`${DEGRADED_URL}/t/A5`);

    // A 500 here is the whole defect: it is Next.js's error page in a guest's hand.
    expect(response?.status(), 'an outage must still render a designed screen').toBe(200);

    const state = page.getByTestId('unreachable-guest');
    await expect(state).toBeVisible();
    // Standard 1.6 — say what happened, and name the fallback that is older than the app.
    await expect(state).toContainText(/take your order/i);
    await expect(page.getByTestId('unreachable-guest-reload')).toBeVisible();
  });

  test('the outage screen is offered in the restaurant’s voice, not the runtime’s', async ({ page }) => {
    await page.goto(`${DEGRADED_URL}/t/A5`);
    // The technical detail is allowed — it is boxed, for the operator. What is forbidden is the
    // headline and the explanation being written in it.
    const headline = page.getByTestId('unreachable-guest').locator('h3');
    await expect(headline).not.toContainText(/fetch|TypeError|ECONNREFUSED|undefined|stack/i);
  });

  test('the reload control is a real, reachable control at phone size', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`${DEGRADED_URL}/t/A5`);
    const reload = page.getByTestId('unreachable-guest-reload');
    await reload.scrollIntoViewIfNeeded();
    const box = await reload.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height, 'the only control on an outage screen must clear the touch floor').toBeGreaterThanOrEqual(44);
    // Unforced: fixed chrome covering the one control would fail here, which is the assertion.
    await reload.click();
  });

  test('staff still get the keypad — sign-in does not depend on the database being up', async ({ page }) => {
    // Deliberate: the session cookie is read and verified locally, so an outage must not add a
    // second failure on top of the first by making the sign-in screen itself unreachable.
    const response = await page.goto(`${DEGRADED_URL}/staff`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('staff-signin')).toBeVisible();
  });

  test('the outage screen is legible in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(`${DEGRADED_URL}/t/A5`);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const measured = await page.getByTestId('unreachable-guest').evaluate((el) => {
        const heading = el.querySelector('h3')!;
        const fg = getComputedStyle(heading).color;
        let node: Element | null = heading;
        let bg = 'rgba(0, 0, 0, 0)';
        while (node) {
          const c = getComputedStyle(node).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
            bg = c;
            break;
          }
          node = node.parentElement;
        }
        if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor;
        return { fg, bg };
      });

      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const srgb = (c: number) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const lum = (p: number[]) => 0.2126 * srgb(p[0] ?? 0) + 0.7152 * srgb(p[1] ?? 0) + 0.0722 * srgb(p[2] ?? 0);
      const [fg, bg] = [lum(parse(measured.fg)), lum(parse(measured.bg))];
      const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
      const ratio = (hi + 0.05) / (lo + 0.05);

      expect(ratio, `outage headline in ${theme}: ${measured.fg} on ${measured.bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
