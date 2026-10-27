#!/usr/bin/env node
/**
 * perf rig gateway — stands where Supabase's API gateway stands, for a LOCAL PostgREST.
 *
 *   app (supabase-js) ──▶ this gateway :54321 ──▶ PostgREST :54330 ──▶ Postgres :54329
 *
 * WHAT IT DOES, AND ONLY THIS
 *   1. Maps `/rest/v1/*` to PostgREST and swaps the app's secret key for a service_role JWT, as the
 *      real gateway does. `/storage/v1/*` answers 404 (the rig has no object storage).
 *   2. Adds latency with a model CALIBRATED ON PRODUCTION (docs/audit/NAVIGATION_PERFORMANCE_BASELINE.md):
 *      every call pays RIG_FIXED_MS in parallel, then queues for RIG_SERIAL_MS one at a time. On
 *      24-Oct-2026 a call alone took 41–53 ms at Supabase's gateway, and a call inside a 21+-call burst
 *      402 ms at p50 (558 ms for the whole burst) — the burst queues. 20 + 20 reproduces both.
 *   3. Records every call (start, end, method, path) so a journey can count and time its database work
 *      without instrumenting application code: GET /__rig/calls, POST /__rig/reset.
 *
 * Never point an application at this with real credentials. It holds none.
 *
 *   node scripts/perf/gateway.mjs            (env: RIG_FIXED_MS=20 RIG_SERIAL_MS=20 RIG_PORT=54321)
 */
import http from 'node:http';
import { createHmac } from 'node:crypto';

const PORT = Number(process.env.RIG_PORT ?? 54321);
const UPSTREAM = new URL(process.env.RIG_UPSTREAM ?? 'http://127.0.0.1:54330');
const SECRET = process.env.RIG_JWT_SECRET ?? 'jalsa-perf-rig-not-a-credential-0123456789';
let FIXED = Number(process.env.RIG_FIXED_MS ?? 20);
let SERIAL = Number(process.env.RIG_SERIAL_MS ?? 20);

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const head = b64({ alg: 'HS256', typ: 'JWT' });
const body = b64({ role: 'service_role', iss: 'perf-rig', exp: 4102444800 });
const JWT = `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The serial part of the model: one call at a time, in arrival order. */
let queue = Promise.resolve();
const serialSlot = () => {
  const turn = queue.then(() => sleep(SERIAL));
  queue = turn;
  return turn;
};

let calls = [];
const t0 = Date.now();

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://rig');
    if (url.pathname === '/__rig/calls') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(calls));
    }
    if (url.pathname === '/__rig/reset') {
      calls = [];
      if (url.searchParams.has('fixed')) FIXED = Number(url.searchParams.get('fixed'));
      if (url.searchParams.has('serial')) SERIAL = Number(url.searchParams.get('serial'));
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ fixed: FIXED, serial: SERIAL }));
    }
    if (!url.pathname.startsWith('/rest/v1')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ message: 'not in the perf rig', statusCode: '404' }));
    }

    const start = Date.now();
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await sleep(FIXED);
    await serialSlot();

    const headers = { ...req.headers, authorization: `Bearer ${JWT}`, host: UPSTREAM.host };
    delete headers.apikey;
    const up = http.request(
      {
        host: UPSTREAM.hostname,
        port: UPSTREAM.port,
        method: req.method,
        path: url.pathname.replace(/^\/rest\/v1/, '') + url.search,
        headers,
      },
      (r) => {
        const out = [];
        r.on('data', (c) => out.push(c));
        r.on('end', () => {
          const buf = Buffer.concat(out);
          calls.push({
            at: start - t0,
            ms: Date.now() - start,
            method: req.method,
            path: url.pathname.replace('/rest/v1/', ''),
            status: r.statusCode,
            bytes: buf.length,
          });
          res.writeHead(r.statusCode ?? 502, r.headers);
          res.end(buf);
        });
      }
    );
    up.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: String(e) }));
    });
    up.end(Buffer.concat(chunks));
  })
  .listen(PORT, () =>
    console.log(`perf rig gateway :${PORT} -> ${UPSTREAM.href} (fixed ${FIXED} ms, serial ${SERIAL} ms)`)
  );
