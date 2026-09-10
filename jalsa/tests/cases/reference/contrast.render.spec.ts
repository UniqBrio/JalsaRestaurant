/**
 * Reference RENDER spec - the COMPUTED-contrast assertion.
 *
 * WHY THIS EXISTS ALONGSIDE THE TOKEN-LEVEL CONTRAST GATE
 *   scripts/check-contrast.mjs proves the PALETTE is safe. It cannot prove that a given element
 *   used the palette. The defect it structurally cannot see is a component styled with a
 *   literal copied from elsewhere: on the wrong surface that text is not low-contrast, it is
 *   INVISIBLE - and there is no token to tune, because none was ever read.
 *
 *   This spec reads the colour the BROWSER computed, walks up to find the real painted
 *   background (an element's own background is usually transparent), and measures.
 *
 * SEED EVERY STATE
 *   Run this across each state a line can render in - empty, loading, error, populated,
 *   and every status variant. The classic escape is a state QA never had data for.
 */
import { test, expect, type Page } from '@playwright/test';

const THEMES = ['light', 'dark'] as const;

function srgb(c: number) { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
function lum([r, g, b]: number[]) {
  // The tuple always has three members - it is parsed from an rgb() string - but under
  // noUncheckedIndexedAccess the compiler cannot know that, and 0 is the safe reading of a
  // missing channel rather than a crash inside a contrast assertion.
  return 0.2126 * srgb(r ?? 0) + 0.7152 * srgb(g ?? 0) + 0.0722 * srgb(b ?? 0);
}
function ratio(fg: number[], bg: number[]) {
  const [hi, lo] = lum(fg) > lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
  return (hi + 0.05) / (lo + 0.05);
}
const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Walk ancestors until a non-transparent background is found - that is what the eye sees. */
async function measure(page: Page, selector: string) {
  return page.$eval(selector, (el) => {
    const fg = getComputedStyle(el).color;
    let node: Element | null = el;
    let bg = 'rgba(0, 0, 0, 0)';
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
      node = node.parentElement;
    }
    if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor;
    return { fg, bg, text: (el.textContent ?? '').trim() };
  });
}

/** Every text element a change touches goes in this list, with the state that produces it. */
const TARGETS = [
  { selector: '[data-testid="page-title"]', min: 4.5, state: 'default' },
  { selector: '[data-testid="page-subtitle"]', min: 4.5, state: 'default' },
  { selector: '[data-testid="status-badge"]', min: 4.5, state: 'default' },
  // DR-3 — the selected tab is the one element whose background CHANGES under it. The token
  // pair is asserted by the contrast gate; this asserts the tab actually used it, which is the
  // defect the token gate structurally cannot see. Both states are listed: an unselected tab
  // that became unreadable while the selected one was being tuned is the same bug, unnoticed.
  { selector: '.tab-row__tab[aria-selected="true"]', min: 4.5, state: 'tab selected' },
  { selector: '.tab-row__tab[aria-selected="false"]', min: 4.5, state: 'tab unselected' },
];

for (const theme of THEMES) {
  test.describe(`computed contrast - ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Force the theme rather than trusting the runner's OS preference: a suite that only
      // ever sees one theme is a suite that has only ever tested one theme.
      await page.addInitScript((t) => localStorage.setItem('app.theme', t), theme);
      await page.goto('/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    });

    for (const target of TARGETS) {
      test(`${target.selector} (${target.state}) meets ${target.min}:1`, async ({ page }) => {
        const el = page.locator(target.selector);
        if ((await el.count()) === 0) test.skip(true, `${target.selector} not present on this page`);

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
