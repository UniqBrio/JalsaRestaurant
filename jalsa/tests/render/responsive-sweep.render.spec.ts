/**
 * Page-level responsive sweep — every route this tier can reach, at every width the requester named.
 *
 * WHAT IT CHECKS, AND WHY THESE
 *   Acceptance criterion 7 ("no page-level horizontal overflow") and 10 ("no content is
 *   clipped") are the two that a machine can settle without a human eye. Both reduce to
 *   geometry: does the document scroll sideways, and is any element's box outside the viewport.
 *   Everything else in a responsive audit — hierarchy, density, whether a two-column layout
 *   SHOULD become one — is a judgement, and a test that claimed to settle it would be lying.
 *
 * WHAT IT CANNOT REACH, STATED HERE RATHER THAN IMPLIED BY ITS SILENCE
 *   Six routes exist. All six render, but four of them render a SIGNED-OUT or DEGRADED state in
 *   this tier: the owner console's thirteen sections, the staff surface's five tabs and the
 *   guest's eleven screens all sit behind a PIN and a database, and the only reachable database
 *   is production, which is never an automated target. So this sweep covers the shells and the
 *   states — not the screens behind them. A suite that quietly skipped them would report a
 *   clean application; this one names the gap in `SIGNED_OUT` below and the report repeats it.
 */
import { test, expect } from '@playwright/test';

/** Every width in the requester's matrix, narrowest first. */
const WIDTHS = [320, 360, 375, 390, 430, 768, 834, 1024, 1280, 1366, 1440, 1536, 1920] as const;

const ROUTES = [
  { path: '/', name: 'surface router' },
  { path: '/offline', name: 'offline fallback' },
  { path: '/staff', name: 'staff PIN sign-in' },
  { path: '/owner', name: 'owner PIN sign-in' },
  { path: '/t/A5', name: 'guest table (degraded)' },
  { path: '/q', name: 'entrance queue (degraded)' },
] as const;

/** Named so the gap is in the suite, not only in a report somebody has to find. */
const SIGNED_OUT = 'renders its signed-out or degraded state here; the screens behind the PIN need a database';

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`${route.path} does not scroll sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');

      const m = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        // Every element whose box leaves the viewport, named by what it is so a failure is
        // actionable rather than a number. Elements inside a DELIBERATE scroll region are
        // excluded: a contained data table that scrolls is the correct pattern, and only
        // page-level overflow is the defect.
        outside: [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            if (el.closest('.j-scroll-x')) return false;
            return r.right > document.documentElement.clientWidth + 1 || r.left < -1;
          })
          .slice(0, 5)
          .map((el) => {
            const r = el.getBoundingClientRect();
            const id = el.getAttribute('data-testid');
            return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''} ${Math.round(r.left)}→${Math.round(r.right)}`;
          }),
      }));

      expect(
        m.scrollWidth,
        `${route.name} (${route.path}) scrolls sideways: ${m.scrollWidth} > ${m.clientWidth}. ` +
          `Outside the viewport: ${m.outside.join(' · ') || 'nothing measurable'}`
      ).toBeLessThanOrEqual(m.clientWidth + 1);

      expect(m.outside, `${route.name}: no element may sit outside the viewport`).toEqual([]);
    });
  }
}

test('the sweep reached every route it claims to cover — a route that 404s is not a pass', async ({ page }) => {
  // A page that failed to load has no overflow either, and would sail through every assertion
  // above. Rule 3: a detector that parsed nothing reports BLOCKED, never success.
  for (const route of ROUTES) {
    const res = await page.goto(route.path);
    expect(res?.status(), `${route.path} must actually render`).toBeLessThan(400);
    const text = await page.evaluate(() => document.body.innerText.trim().length);
    expect(text, `${route.path} rendered an empty body`).toBeGreaterThan(20);
  }
  expect(SIGNED_OUT.length).toBeGreaterThan(0);
});
