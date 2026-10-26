#!/usr/bin/env node
/**
 * perf rig — a service under load: what every screen waits for when many are open at once.
 *
 *   node scripts/perf/concurrency.mjs [--seconds 90] [--owners 1] [--captains 5] [--guests 20]
 *
 * Each simulated screen polls its real route the way `useLiveData` does: a full read first, then
 * `?since=<stamp>` every tick (owner 8 s, captain 6 s, guest 6 s), and a full read whenever the stamp
 * moved. A captain places a round every 10 s, which moves the floor counter, so every staff screen
 * rebuilds - the busy-evening pattern. Reported per kind of request: p50 / p95 / p99 and failures.
 *
 * A failure here is a request answering non-2xx: in this app that is a read that missed its 2 s
 * deadline (src/lib/supabase/server.ts) or a queue that never answered - the screen then keeps its
 * last data under a stale notice until the next tick.
 */
const APP = process.env.APP ?? 'http://localhost:3400';
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const SECONDS = arg('seconds', 90);
const OWNERS = arg('owners', 1);
const CAPTAINS = arg('captains', 5);
const GUESTS = arg('guests', 20);

/** The pollers name routes the way the browser does; Node's fetch wants an origin. */
const absolute = (u) => (u.startsWith('http') ? u : `${APP}${u}`);
globalThis.fetch = (
  (orig) => (u, init) =>
    orig(absolute(String(u)), init)
)(globalThis.fetch);

const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(pin, surface) {
  const res = await fetch(`${APP}/api/staff/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin, surface }),
  });
  if (!res.ok) throw new Error(`sign-in ${surface}: ${res.status}`);
  return cookieOf(res);
}

const samples = [];
function record(kind, ms, ok) {
  samples.push({ kind, ms, ok });
}

/** One screen's polling loop. */
async function poller(kind, url, cookie, every, until) {
  let stamp = null;
  await sleep(Math.random() * every);
  while (Date.now() < until) {
    const href = stamp ? `${url}${url.includes('?') ? '&' : '?'}since=${encodeURIComponent(stamp)}` : url;
    const t = Date.now();
    try {
      const res = await fetch(href, { headers: { cookie } });
      const text = await res.text();
      const quiet = res.ok && text.length < 64 && text.includes('"unchanged":true');
      record(`${kind} ${quiet ? 'quiet tick' : 'full read'}`, Date.now() - t, res.ok);
      if (res.ok && !quiet) stamp = res.headers.get('x-change-stamp');
    } catch {
      record(`${kind} failed`, Date.now() - t, false);
    }
    await sleep(every);
  }
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null;
};

const owner = await session('2580', 'owner');
await sleep(7000); // the sign-in throttle (10 a minute, shared) is left as it is
const captain = await session('3691', 'staff');
const floor = await (await fetch(`${APP}/api/staff/state`, { headers: { cookie: captain } })).json();
const tables = floor.tables.filter((t) => t.active);
const dishes = floor.menu.filter((m) => m.available).map((m) => m.id);

const guestCookies = [];
for (let g = 0; g < GUESTS; g += 1) {
  const t = tables[g % tables.length];
  const res = await fetch(`${APP}/t/${encodeURIComponent(t.name)}`);
  guestCookies.push({ table: t.name, cookie: cookieOf(res) });
}

const until = Date.now() + SECONDS * 1000;
const loops = [];
for (let i = 0; i < OWNERS; i += 1)
  loops.push(poller('owner', '/api/owner/state', owner, 8000, until).catch(() => null));
for (let i = 0; i < CAPTAINS; i += 1)
  loops.push(poller('captain', '/api/staff/state', captain, 6000, until).catch(() => null));
for (const g of guestCookies)
  loops.push(
    poller('guest', `/api/guest/state?table=${encodeURIComponent(g.table)}`, g.cookie, 6000, until).catch(() => null)
  );

// The writes that make a service busy: a captain sends a round every 10 s.
loops.push(
  (async () => {
    let i = 0;
    while (Date.now() < until) {
      await sleep(10000);
      const t = tables[i % 8];
      const s = Date.now();
      const res = await fetch(`${APP}/api/staff/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: captain },
        body: JSON.stringify({
          action: 'add-round',
          tableId: t.id,
          lines: [{ menuItemId: dishes[i % dishes.length], qty: 1 }],
        }),
      }).catch(() => null);
      record('captain action (add round)', Date.now() - s, Boolean(res?.ok));
      i += 1;
    }
  })()
);

await Promise.all(loops);

const kinds = [...new Set(samples.map((s) => s.kind))].sort();
const rows = kinds.map((k) => {
  const xs = samples.filter((s) => s.kind === k);
  const ms = xs.map((s) => s.ms);
  return {
    kind: k,
    n: xs.length,
    failed: xs.filter((s) => !s.ok).length,
    p50: pct(ms, 50),
    p95: pct(ms, 95),
    p99: xs.length >= 20 ? pct(ms, 99) : null,
    max: Math.max(...ms),
  };
});
console.log(JSON.stringify({ seconds: SECONDS, owners: OWNERS, captains: CAPTAINS, guests: GUESTS, rows }, null, 1));
