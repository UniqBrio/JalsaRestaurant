#!/usr/bin/env node
/**
 * perf rig — taps that land BEFORE the page works, made deterministic (26-Oct-2026, N-01).
 *
 *   node scripts/perf/pretaps.mjs [n]
 *
 * The page's JavaScript is held back until four PIN digits have been tapped on the server-rendered
 * keypad, then released. Recorded per attempt: whether the keys LOOKED ready while the taps landed
 * (disabled attribute, computed opacity), whether a sign-in was ever sent, and how many digits the
 * keypad holds once the page works. On a slow phone this window is ≈0.85–1.0 s (hydration.mjs).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP ?? 'http://localhost:3400';
const N = Number(process.argv[2] ?? 5);

const browser = await chromium.launch();
const rows = [];
for (let i = 0; i < N; i += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let release;
  const held = new Promise((r) => (release = r));
  // Scripts only: the stylesheets live beside them and block rendering, so holding those would hide
  // the keypad instead of leaving it painted and not yet working.
  await page.route('**/_next/static/**', async (route) => {
    if (route.request().resourceType() === 'script') await held;
    await route.continue();
  });
  let sent = false;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/staff/session') && r.method() === 'POST') sent = true;
  });
  // 'commit', not 'domcontentloaded': with the scripts held back, the DOM is never "loaded".
  await page.goto(`${APP}/owner`, { waitUntil: 'commit' });
  await page.getByTestId('staff-signin').waitFor();
  const looked = await page.getByTestId('staff-key-0').evaluate((el) => ({
    disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    opacity: getComputedStyle(el).opacity,
  }));
  // A person's taps: `force`, because a person does not wait for the button to become enabled.
  for (const d of '0001') await page.getByTestId(`staff-key-${d}`).click({ force: true });
  release();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="staff-key-1"]');
    return el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  });
  await page.waitForTimeout(1500);
  const held4 = (await page.getByTestId('staff-pin-input').inputValue()).length;
  rows.push({
    attempt: i + 1,
    keysLookedDisabled: looked.disabled,
    keyOpacity: looked.opacity,
    signInSent: sent,
    digitsHeldAfter: held4,
  });
  await ctx.close();
}
await browser.close();
for (const r of rows) console.log(JSON.stringify(r));
