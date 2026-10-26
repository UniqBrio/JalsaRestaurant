#!/usr/bin/env node
/**
 * perf rig — what an open screen costs the database while nobody touches it, and what one action costs.
 *
 *   node scripts/perf/idle.mjs [--seconds 60]
 *
 * For each surface: sign in (or scan), let the page settle, clear the gateway's call log, then wait.
 * A "full read" is a burst of 8+ database calls starting within 150 ms of each other — the screen being
 * rebuilt. A quiet tick is 1-4 calls (identity + "has anything changed?").
 *
 * Then, on the owner console: one action (switch a dish off and on again), and every database call in
 * the 20 s after it — the action's own echo plus whatever the polling does next.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP ?? 'http://localhost:3400';
const GATEWAY = process.env.RIG_GATEWAY ?? 'http://127.0.0.1:54321';
const i = process.argv.indexOf('--seconds');
const SECONDS = i > -1 ? Number(process.argv[i + 1]) : 60;

const calls = async () => (await fetch(`${GATEWAY}/__rig/calls`)).json();
const reset = () => fetch(`${GATEWAY}/__rig/reset`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bursts(list) {
  const out = [];
  for (const c of [...list].sort((a, b) => a.at - b.at)) {
    const last = out.at(-1);
    if (last && c.at - last.start <= 150) last.calls.push(c);
    else out.push({ start: c.at, calls: [c] });
  }
  return out.map((b) => ({
    at: b.start,
    n: b.calls.length,
    ms: Math.max(...b.calls.map((c) => c.at + c.ms)) - b.start,
  }));
}

function summarise(label, list, seconds) {
  const b = bursts(list);
  const full = b.filter((x) => x.n >= 8);
  const t0 = list.length ? Math.min(...list.map((c) => c.at)) : 0;
  return {
    label,
    seconds,
    dbCalls: list.length,
    callsPerMinute: Math.round((list.length / seconds) * 60),
    fullReads: full.length,
    fullReadAt: full.map((x) => `+${((x.at - t0) / 1000).toFixed(1)}s:${x.n}calls/${x.ms}ms`),
    quietTicks: b.filter((x) => x.n < 8).length,
  };
}

async function signIn(page, surface, pin) {
  await page.goto(`${APP}/${surface}`);
  await page.getByTestId('staff-signin').waitFor();
  for (const d of pin) await page.getByTestId(`staff-key-${d}`).click();
}

const browser = await chromium.launch();
const out = [];

// Each surface, from the moment its first screen is up.
for (const [label, open, ready] of [
  ['owner console', (p) => signIn(p, 'owner', '2580'), 'owner-dashboard'],
  ['captain floor', (p) => signIn(p, 'staff', '3691'), 'staff-floor'],
  ['guest phone (running bill)', (p) => p.goto(`${APP}/t/A1`), 'guest-app'],
]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await open(page);
  await page.getByTestId(ready).waitFor({ timeout: 30000 });
  /* Let the first screen's own server work finish, then count from a clean log. (A start point taken
     from the gateway log itself counted the tail of the page's own render as a rebuild - corrected
     26-Oct.) The first poll comes 6-8 s after mount, so it is still inside the window. */
  await sleep(3000);
  await reset();
  await sleep(SECONDS * 1000);
  out.push(summarise(`${label}: ${SECONDS}s from 3 s after its first screen`, await calls(), SECONDS));
  await ctx.close();
}

// One owner action, then the next 20 s.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, 'owner', '2580');
  await page.getByTestId('owner-dashboard').waitFor({ timeout: 30000 });
  await sleep(SECONDS > 20 ? 20000 : SECONDS * 1000); // past the first ticks
  const item = await page.evaluate(async () => {
    const s = await (await fetch('/api/owner/state')).json();
    return s.menu?.items?.[0]?.id ?? s.menu?.[0]?.id ?? null;
  });
  await reset();
  const t = Date.now();
  const send = (available) =>
    page.evaluate(
      async ([id, on]) =>
        (
          await fetch('/api/owner/action', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'set-availability', itemId: id, available: on, reason: 'perf rig' }),
          })
        ).status,
      [item, available]
    );
  const status = [await send(false), await send(true)];
  const actionMs = Date.now() - t;
  await sleep(20000);
  out.push({
    ...summarise('owner: two actions (dish off, on), then 20 s', await calls(), 20),
    statuses: status,
    actionsMs: actionMs,
  });
  await ctx.close();
}

await browser.close();
for (const r of out) console.log(JSON.stringify(r));
