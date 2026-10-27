#!/usr/bin/env node
/**
 * perf rig journeys — what a person waits for, from the click to usable data, on a production build.
 *
 *   node scripts/perf/journeys.mjs [--n 10] [--profile local|india4g|both] [--only owner-reports,...] [--out file.json]
 *
 * Needs the rig (bootstrap.sql + migrations + PostgREST + gateway.mjs), seed-service.mjs, and the app built
 * and started (`next build && next start -p 3400`) against the gateway. Chromium is the one Playwright ships
 * with this container (`require('playwright')`).
 *
 * WHAT IS MEASURED, PER JOURNEY AND SAMPLE
 *   usableMs   the click (or navigation) to the moment the screen's own data is on screen — not its shell.
 *   shellMs    the click to the first frame of the destination (where a journey has one).
 *   requests   app requests the journey made (documents, RSC, /api) and the slowest one's server wait.
 *   dbCalls    database calls the gateway saw inside the journey, and dbMs: first call to last answer.
 *
 * PROFILES
 *   local     no throttling: the rig's database latency only (calibrated on production, see gateway.mjs).
 *   india4g   + a phone in Hosur: 150 ms round trip to Sydney (published Chennai–Sydney figures are
 *             140–160 ms), 9 Mbps down, 1.5 Mbps up, CPU slowed 4× (a mid-range Android). Emulated with
 *             Chrome DevTools Protocol, so it is a MODEL of that phone, not a measurement of one.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP ?? 'http://localhost:3400';
const GATEWAY = process.env.RIG_GATEWAY ?? 'http://127.0.0.1:54321';
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const N = Number(arg('n', 10));
const PROFILES = arg('profile', 'both') === 'both' ? ['local', 'india4g'] : [arg('profile', 'local')];
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const OUT = arg('out', null);

const PROFILE = {
  local: null,
  india4g: { latency: 150, downloadThroughput: (9e6 / 8) | 0, uploadThroughput: (1.5e6 / 8) | 0, cpu: 4 },
};

async function rigCalls() {
  return (await fetch(`${GATEWAY}/__rig/calls`)).json();
}

async function newPage(browser, profile, storageState) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(storageState ? { storageState } : {}),
  });
  const page = await ctx.newPage();
  const p = PROFILE[profile];
  if (p) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: p.latency,
      downloadThroughput: p.downloadThroughput,
      uploadThroughput: p.uploadThroughput,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  }
  const log = [];
  /* In-flight app requests, for `settle` below. `waitForLoadState('networkidle')` was used first and sat
     out its whole 30 s timeout in background runs, so the rig decides "quiet" itself. */
  const inflight = new Set();
  page.on('request', (req) => inflight.add(req));
  page.on('requestfailed', (req) => inflight.delete(req));
  page.on('requestfinished', (req) => inflight.delete(req));
  page.settle = async () => {
    const until = Date.now() + 5000;
    let quietSince = Date.now();
    while (Date.now() < until) {
      if (inflight.size) quietSince = Date.now();
      else if (Date.now() - quietSince >= 600) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  };
  page.on('requestfinished', async (req) => {
    const u = new URL(req.url());
    if (u.origin !== new URL(APP).origin) return;
    if (u.pathname.startsWith('/_next/static') || /\.(png|svg|ico|webmanifest|js|css|woff2?)$/.test(u.pathname))
      return;
    const t = req.timing();
    log.push({
      path: u.pathname + (u.search.length < 60 ? u.search : '?…'),
      method: req.method(),
      start: t.startTime,
      waitMs: Math.round(t.responseStart - t.requestStart),
      totalMs: Math.round(t.responseEnd),
    });
  });
  return { ctx, page, log };
}

/* THE APP'S OWN SIGN-IN THROTTLE IS LEFT ALONE. It allows 10 attempts a minute per server process,
   shared by everyone (audit SEC-03), so a rig signing in for every sample is refused from the 11th and
   then waits out a 30 s timeout. Sign-ins are paced to one per 6.5 s, and journeys that do not measure
   sign-in start from a session saved once per surface. */
let lastSignIn = 0;
async function paceSignIn() {
  const wait = lastSignIn + 6500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSignIn = Date.now();
}

async function signIn(page, surface, pin) {
  await paceSignIn();
  await page.goto(`${APP}/${surface}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('staff-signin').waitFor();
  for (const d of pin) await page.getByTestId(`staff-key-${d}`).click();
}

const notReading = (testId) => async (page) =>
  page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return el && !/reading…|Loading|loading…/.test(el.textContent ?? '');
    },
    testId,
    { timeout: 30000 }
  );

/** Each journey: optional setup (not timed), then the timed act, then what "usable" means. */
const JOURNEYS = [
  {
    name: 'owner-signin',
    what: 'PIN typed → owner console with live data',
    setup: async (page) => {
      await paceSignIn();
      await page.goto(`${APP}/owner`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('staff-signin').waitFor();
      for (const d of '258') await page.getByTestId(`staff-key-${d}`).click();
    },
    act: (page) => page.getByTestId('staff-key-0').click(),
    usable: (page) => page.getByTestId('owner-dashboard').waitFor({ timeout: 30000 }),
  },
  {
    name: 'owner-reload',
    what: 'refresh the browser on /owner (signed in)',
    setup: (page) => signedInOwner(page),
    act: (page) => page.reload({ waitUntil: 'commit' }),
    usable: (page) => page.getByTestId('owner-dashboard').waitFor({ timeout: 30000 }),
  },
  ...['orders', 'payments', 'menu', 'staff', 'tips'].map((s) => ({
    name: `owner-nav-${s}`,
    what: `Dashboard → ${s} (no request)`,
    setup: (page) => signedInOwner(page),
    act: (page) => page.getByTestId(`owner-nav-${s}`).click(),
    usable: (page) => page.getByTestId(`owner-${s}`).first().waitFor({ timeout: 30000 }),
  })),
  {
    name: 'owner-nav-reports',
    what: 'Dashboard → Reports (today)',
    setup: (page) => signedInOwner(page),
    act: (page) => page.getByTestId('owner-nav-reports').click(),
    usable: async (page) => {
      await page.getByTestId('owner-reports').waitFor();
      await notReading('owner-reports')(page);
    },
  },
  {
    name: 'owner-reports-range',
    what: 'Reports: Today → Last 30 days',
    setup: async (page) => {
      await signedInOwner(page);
      await page.getByTestId('owner-nav-reports').click();
      await notReading('owner-reports')(page);
    },
    act: (page) => page.getByTestId('owner-rep-preset-last30').click(),
    usable: (page) => notReading('owner-reports')(page),
  },
  {
    name: 'owner-nav-expenses',
    what: 'Dashboard → Income & expenses',
    setup: (page) => signedInOwner(page),
    act: (page) => page.getByTestId('owner-nav-expenses').click(),
    usable: async (page) => {
      await page.getByTestId('owner-finance-summary').waitFor({ timeout: 30000 });
      await notReading('owner-finance-summary')(page);
    },
  },
  {
    name: 'owner-nav-uplift',
    what: 'Dashboard → Uplift',
    setup: (page) => signedInOwner(page),
    /* Usable = its own answer arrived and the next frame painted. (Measured first with the rig's 600 ms
       "network quiet" wait, which put 600 ms of the rig's own into the number - corrected 26-Oct.) */
    act: async (page) => {
      page.heard = page.waitForResponse((r) => r.url().includes('/api/owner/heard'), { timeout: 30000 });
      await page.getByTestId('owner-nav-uplift').click();
    },
    usable: async (page) => {
      await page.getByTestId('owner-uplift').waitFor();
      await page.heard;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    },
  },
  {
    name: 'staff-signin',
    what: 'PIN typed → captain floor with tables',
    setup: async (page) => {
      await paceSignIn();
      await page.goto(`${APP}/staff`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('staff-signin').waitFor();
      for (const d of '369') await page.getByTestId(`staff-key-${d}`).click();
    },
    act: (page) => page.getByTestId('staff-key-1').click(),
    usable: (page) => page.getByTestId('staff-floor').waitFor({ timeout: 30000 }),
  },
  {
    name: 'staff-reload',
    what: 'refresh the browser on /staff (signed in)',
    session: 'staff',
    setup: async (page) => {
      await page.goto(`${APP}/staff`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('staff-floor').waitFor({ timeout: 30000 });
    },
    act: (page) => page.reload({ waitUntil: 'commit' }),
    usable: (page) => page.getByTestId('staff-floor').waitFor({ timeout: 30000 }),
  },
  {
    name: 'guest-scan',
    what: 'scan a table QR (new phone) → menu or bill on screen',
    setup: async () => undefined,
    act: (page) => page.goto(`${APP}/t/A3`, { waitUntil: 'commit' }),
    usable: (page) => page.getByTestId('guest-app').waitFor({ timeout: 30000 }),
  },
  {
    name: 'guest-scan-open-bill',
    what: 'scan a table with a running bill → its order on screen',
    setup: async () => undefined,
    act: (page) => page.goto(`${APP}/t/A1`, { waitUntil: 'commit' }),
    usable: (page) => page.getByTestId('guest-app').waitFor({ timeout: 30000 }),
  },
];

async function signedInOwner(page) {
  await page.goto(`${APP}/owner`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('owner-dashboard').waitFor({ timeout: 30000 });
}

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

const browser = await chromium.launch();
const sessions = {};
for (const [surface, pin, ready] of [
  ['owner', '2580', 'owner-dashboard'],
  ['staff', '3691', 'staff-floor'],
]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, surface, pin);
  await page.getByTestId(ready).waitFor({ timeout: 30000 });
  sessions[surface] = await ctx.storageState();
  await ctx.close();
}
const sessionFor = (j) =>
  j.session
    ? sessions[j.session]
    : j.name.startsWith('owner-') && j.name !== 'owner-signin'
      ? sessions.owner
      : undefined;
const results = [];
for (const profile of PROFILES) {
  for (const j of JOURNEYS) {
    if (ONLY && !ONLY.includes(j.name)) continue;
    const samples = [];
    for (let i = 0; i < N; i += 1) {
      const { ctx, page, log } = await newPage(browser, profile, sessionFor(j));
      try {
        await j.setup(page);
        await page.settle();
        log.length = 0;
        // The gateway's log is cleared per sample: everything in it after this line is this journey's.
        await fetch(`${GATEWAY}/__rig/reset`);
        const t0 = Date.now();
        await j.act(page);
        await j.usable(page);
        const usableMs = Date.now() - t0;
        const calls = await rigCalls();
        const inWindow = calls.filter((c) => c.at - (calls[0]?.at ?? 0) <= usableMs + 50);
        const dbMs = inWindow.length ? Math.max(...inWindow.map((c) => c.at + c.ms)) - inWindow[0].at : 0;
        samples.push({
          usableMs,
          requests: log.map((r) => `${r.method} ${r.path} wait ${r.waitMs}`),
          dbCalls: inWindow.length,
          dbMs,
        });
      } catch (err) {
        samples.push({ error: String(err).slice(0, 200) });
      } finally {
        await ctx.close();
      }
    }
    const ok = samples.filter((s) => s.usableMs !== undefined);
    const u = ok.map((s) => s.usableMs);
    const row = {
      profile,
      journey: j.name,
      what: j.what,
      n: ok.length,
      errors: samples.length - ok.length,
      p50: pct(u, 50),
      p95: pct(u, 95),
      p99: ok.length >= 20 ? pct(u, 99) : null,
      max: u.length ? Math.max(...u) : null,
      dbCallsP50: pct(
        ok.map((s) => s.dbCalls),
        50
      ),
      dbMsP50: pct(
        ok.map((s) => s.dbMs),
        50
      ),
      requestsExample: ok[0]?.requests ?? samples[0]?.error,
    };
    results.push(row);
    // Written after every journey, so a run that is stopped keeps what it measured.
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(
      JSON.stringify({ ...row, requestsExample: undefined, firstError: samples.find((x) => x.error)?.error })
    );
  }
}
await browser.close();
if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
