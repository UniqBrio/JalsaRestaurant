/**
 * Computed contrast on the surfaces this application actually renders.
 *
 * WHY THIS EXISTS ALONGSIDE THE TOKEN-LEVEL CONTRAST GATE
 *   `scripts/check-contrast.mjs` proves the PALETTE is safe — all 120 pairs, both themes. What it
 *   structurally cannot prove is that a given element USED the palette. An element styled with a
 *   literal copied from elsewhere, or one with no colour at all inheriting from the wrong
 *   ancestor, is not low-contrast on the wrong surface — it is invisible, and there is no token
 *   to tune because none was ever read.
 *
 * WHY EVERY TARGET MUST BE FOUND
 *   The reference shape skips a target that is not on the page. A skip reads as a pass in every
 *   report, so a screen that stopped rendering its own title would go green here forever. This
 *   file fails instead: a target that matched nothing is a BLOCKED assertion, and BLOCKED is
 *   never a pass.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, first run of this file against this tree):
 *   OBSERVED FAILING — two dark-theme targets, at 2.40:1 against a 4.5 floor:
 *   `"The floor, the rounds, the requests. Four-digit PIN." renders rgb(102, 93, 89) on
 *   rgb(160, 158, 157)`. Neither colour is in either palette. The theme was being applied
 *   AFTER navigation, so `transition-colors` was still running and getComputedStyle sampled a
 *   blend of the light and dark themes. The defect was in the measurement, not the screen — and
 *   it is worth recording precisely because a contrast suite that reports colours no token
 *   defines will be believed, and someone will "fix" a legible screen. Fixed by setting the
 *   theme through the storage key the no-flash script reads, before the first paint.
 *
 *   NOT OBSERVED FAILING — the "every target was found" guard. No mutation was run against it;
 *   it is asserted because the reference shape it replaces skipped a missing target, and a skip
 *   reads as a pass in every report this suite produces.
 */
import { test, expect, type Page } from '@playwright/test';

const THEMES = ['light', 'dark'] as const;

function srgb(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function lum(p: number[]) {
  // The tuple always has three members — it is parsed from an rgb() string — but under
  // noUncheckedIndexedAccess the compiler cannot know that, and 0 is the safe reading of a
  // missing channel rather than a crash inside a contrast assertion.
  return 0.2126 * srgb(p[0] ?? 0) + 0.7152 * srgb(p[1] ?? 0) + 0.0722 * srgb(p[2] ?? 0);
}
function ratio(fg: number[], bg: number[]) {
  const [hi, lo] = lum(fg) > lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
  return (hi + 0.05) / (lo + 0.05);
}
const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Walk ancestors until a non-transparent background is found — that is what the eye sees. */
async function measure(page: Page, selector: string) {
  return page.$eval(selector, (el) => {
    const fg = getComputedStyle(el).color;
    let node: Element | null = el;
    let bg = 'rgba(0, 0, 0, 0)';
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) {
        bg = c;
        break;
      }
      node = node.parentElement;
    }
    if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor;
    return { fg, bg, text: (el.textContent ?? '').trim().slice(0, 60) };
  });
}

interface Target {
  path: string;
  selector: string;
  /** 4.5 for body text; 3.0 is permitted only for large text, and each one says why. */
  min: number;
  what: string;
}

const TARGETS: Target[] = [
  { path: '/', selector: '[data-testid="home-guest"] span:first-child', min: 4.5, what: 'surface card title' },
  { path: '/', selector: '[data-testid="home-guest"] span:last-child', min: 4.5, what: 'surface card note (muted)' },
  { path: '/', selector: '[data-testid="home-staff"] span:last-child', min: 4.5, what: 'muted note on a second card' },
  { path: '/staff', selector: '[data-testid="staff-signin"] h1', min: 4.5, what: 'sign-in heading' },
  { path: '/staff', selector: '[data-testid="staff-signin"] p', min: 4.5, what: 'the accountability sentence' },
  { path: '/staff', selector: '[data-testid="staff-key-5"]', min: 4.5, what: 'a keypad digit on its own surface' },
  { path: '/staff', selector: '[data-testid="staff-signin-home-link"]', min: 4.5, what: 'the ghost-variant link' },
];

for (const theme of THEMES) {
  test.describe(`computed contrast — ${theme} theme`, () => {
    for (const target of TARGETS) {
      test(`${target.what} on ${target.path} meets ${target.min}:1`, async ({ page }) => {
        // Force the theme rather than trusting the runner's OS preference: a suite that only
        // ever sees one theme is a suite that has only ever tested one theme.
        //
        // It is set BEFORE navigation, through the same storage key the no-flash script reads,
        // so `data-theme` is on the root element in the very first paint. Setting it afterwards
        // starts the `transition-colors` on every card, and getComputedStyle then samples a
        // blend of the two themes — which reads as a contrast failure on a screen that is
        // perfectly legible. (Observed: 2.40:1 on a muted note whose settled value is 7.1:1.)
        await page.addInitScript((t) => localStorage.setItem('app.theme', t), theme);
        await page.goto(target.path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

        const found = await page.locator(target.selector).count();
        expect(
          found,
          `${target.selector} matched nothing — a skipped contrast assertion is not a passing one`
        ).toBeGreaterThan(0);

        const { fg, bg, text } = await measure(page, target.selector);
        const r = ratio(parse(fg), parse(bg));

        expect(
          r,
          `"${text}" renders ${fg} on ${bg} = ${r.toFixed(2)}:1 in the ${theme} theme.\n` +
            `An element with no explicit colour is a defect even when it happens to look right today.`
        ).toBeGreaterThanOrEqual(target.min);
      });
    }
  });
}
