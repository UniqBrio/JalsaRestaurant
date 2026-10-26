#!/usr/bin/env node
/**
 * perf rig seed — a service in progress, made through the application's OWN routes.
 *
 * Nothing is inserted by hand: a captain places rounds, the owner records payments, guest phones scan
 * and order, exactly as on a Friday. So the rows have the shape the real code writes, and the seed
 * cannot drift from the schema.
 *
 *   node scripts/perf/seed-service.mjs [--open 12] [--closed 40] [--guests 2]
 *
 * Needs: the rig (bootstrap.sql + migrations, PostgREST, gateway.mjs) and the app on APP (default
 * http://localhost:3400), with a captain on PIN 3691 and the owner on 2580 in the RIG database only.
 * Latency is switched off while seeding and restored afterwards.
 */
const APP = process.env.APP ?? 'http://localhost:3400';
const GATEWAY = process.env.RIG_GATEWAY ?? 'http://127.0.0.1:54321';
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const OPEN = arg('open', 12);
const CLOSED = arg('closed', 40);
const GUESTS = arg('guests', 2);

function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    take(res) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(';');
        const [k, v] = pair.split('=');
        cookies.set(k.trim(), v);
      }
    },
  };
}

async function call(j, method, path, body) {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: j.header() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  j.take(res);
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const pick = (arr, n, offset) => Array.from({ length: n }, (_, i) => arr[(offset + i * 7) % arr.length]);

// Read the current model first: a reset with no parameters changes nothing but the call log.
const saved = await (await fetch(`${GATEWAY}/__rig/reset`)).json();
await fetch(`${GATEWAY}/__rig/reset?fixed=0&serial=0`);
try {
  const captain = jar();
  await call(captain, 'POST', '/api/staff/session', { pin: '3691', surface: 'staff' });
  const owner = jar();
  await call(owner, 'POST', '/api/staff/session', { pin: '2580', surface: 'owner' });

  const floor = await call(captain, 'GET', '/api/staff/state');
  const dishes = floor.menu.filter((m) => m.available).map((m) => m.id);
  const tables = floor.tables.filter((t) => t.active);

  // Bills that will be paid: open, one round, close - repeated on the tables that end the day free.
  const payer = tables[tables.length - 1];
  for (let i = 0; i < CLOSED; i += 1) {
    const placed = await call(captain, 'POST', '/api/staff/action', {
      action: 'add-round',
      tableId: payer.id,
      lines: pick(dishes, 3, i).map((menuItemId) => ({ menuItemId, qty: 1 + (i % 2) })),
    });
    const bill = placed.state.tables.find((t) => t.id === payer.id).billId;
    await call(owner, 'POST', '/api/owner/action', {
      action: 'close-bill',
      billId: bill,
      mode: i % 3 ? 'upi' : 'cash',
    });
    await call(owner, 'POST', '/api/owner/action', { action: 'clear-table', tableId: payer.id }).catch(() => null);
  }

  // Tables still eating: one or two rounds each.
  for (let i = 0; i < Math.min(OPEN, tables.length - 1 - GUESTS); i += 1) {
    const t = tables[i];
    for (let r = 0; r < 1 + (i % 2); r += 1) {
      await call(captain, 'POST', '/api/staff/action', {
        action: 'add-round',
        tableId: t.id,
        lines: pick(dishes, 3 + (r % 2), i + r).map((menuItemId) => ({ menuItemId, qty: 1 })),
      });
    }
  }

  // Guest phones that scanned and ordered for themselves.
  for (let g = 0; g < GUESTS; g += 1) {
    const t = tables[tables.length - 2 - g];
    const phone = jar();
    await call(phone, 'GET', `/t/${encodeURIComponent(t.name)}`).catch(() => null);
    const res = await fetch(`${APP}/t/${encodeURIComponent(t.name)}`, { headers: { cookie: phone.header() } });
    phone.take(res);
    for (const menuItemId of pick(dishes, 2, g)) {
      await call(phone, 'POST', '/api/guest/cart', { itemId: menuItemId, qty: 1 });
    }
    await call(phone, 'POST', '/api/guest/round', {});
  }

  const after = await call(captain, 'GET', '/api/staff/state');
  const busy = after.tables.filter((t) => t.billId).length;
  console.log(JSON.stringify({ openBills: busy, closedBills: CLOSED, guestPhones: GUESTS, dishes: dishes.length }));
} finally {
  await fetch(`${GATEWAY}/__rig/reset?fixed=${saved.fixed}&serial=${saved.serial}`);
}
