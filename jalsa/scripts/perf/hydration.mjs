#!/usr/bin/env node
/**
 * perf rig — how long a screen is VISIBLE before it WORKS (26-Oct-2026, N-01).
 *
 *   node scripts/perf/hydration.mjs [local|india4g] [n]
 *
 * In the page itself: when the element first exists (painted from the server's HTML) and when React has
 * attached to it (a tap can be answered). The difference is the window in which taps are lost - or, with
 * the keypads' `useInteractive`, visibly not taken.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
(async () => {
  const profile = process.argv[2] ?? 'india4g',
    n = Number(process.argv[3] ?? 10);
  const b = await chromium.launch();
  const rows = [];
  for (const [path, id] of [
    ['/owner', 'staff-signin'],
    ['/staff', 'staff-signin'],
    ['/t/A3', 'guest-app'],
  ]) {
    const gaps = [],
      visible = [];
    for (let i = 0; i < n; i++) {
      const ctx = await b.newContext();
      const p = await ctx.newPage();
      if (profile === 'india4g') {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 150,
          downloadThroughput: 1125000,
          uploadThroughput: 187500,
        });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      // Stamped in the page itself: when the element first exists, and when React has attached to it.
      await p.addInitScript((tid) => {
        const t0 = performance.now();
        const tick = () => {
          const el = document.querySelector(`[data-testid="${tid}"]`);
          if (el && !window.__seen) window.__seen = performance.now();
          if (el && Object.keys(el).some((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'))) {
            window.__live = performance.now();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, id);
      await p.goto(`${process.env.APP ?? 'http://localhost:3400'}${path}`, { waitUntil: 'commit' });
      await p.waitForFunction(() => window.__live, null, { timeout: 30000 });
      const { seen, live } = await p.evaluate(() => ({ seen: window.__seen, live: window.__live }));
      visible.push(Math.round(seen));
      gaps.push(Math.round(live - seen));
      await ctx.close();
    }
    rows.push({
      profile,
      screen: path,
      n,
      visibleP50: pct(visible, 50),
      deadP50: pct(gaps, 50),
      deadP95: pct(gaps, 95),
      deadMax: Math.max(...gaps),
    });
  }
  for (const r of rows) console.log(JSON.stringify(r));
  await b.close();
})();
