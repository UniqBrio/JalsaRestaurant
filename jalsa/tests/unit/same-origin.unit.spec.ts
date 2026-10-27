/**
 * SEC-14 (27-Oct-2026): a write another site's page sent is refused before anything is read or
 * written; reads, this site's own writes and header-less clients (the print bridge) are not.
 *
 * FAIL-FIRST: the wiring rung fails against the pre-change `handler()`, which had no such check;
 * the rules are a new module.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isCrossSiteWrite } from '../../src/lib/same-origin';

const req = (
  method: string,
  headers: Record<string, string> = {},
  url = 'https://jalsa.example.in/api/owner/action'
) => new Request(url, { method, headers });

test('this site writing to itself is allowed', () => {
  expect(isCrossSiteWrite(req('POST', { origin: 'https://jalsa.example.in' }))).toBe(false);
  expect(isCrossSiteWrite(req('DELETE', { origin: 'https://JALSA.example.in' }))).toBe(false);
  expect(isCrossSiteWrite(req('POST', { origin: 'http://localhost:3400' }, 'http://localhost:3400/api/x'))).toBe(
    false
  );
  // Behind a proxy that forwards the public host.
  expect(
    isCrossSiteWrite(
      req(
        'POST',
        { origin: 'https://jalsa.example.in', 'x-forwarded-host': 'jalsa.example.in' },
        'http://internal:3000/api/x'
      )
    )
  ).toBe(false);
});

test('another site writing is refused — by Origin, by an opaque origin, or by Sec-Fetch-Site', () => {
  expect(isCrossSiteWrite(req('POST', { origin: 'https://evil.example' }))).toBe(true);
  expect(isCrossSiteWrite(req('PATCH', { origin: 'https://jalsa.example.in.evil.example' }))).toBe(true);
  expect(isCrossSiteWrite(req('PUT', { origin: 'null' }))).toBe(true);
  expect(isCrossSiteWrite(req('POST', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
});

test('reads and header-less clients (the print bridge, server-to-server) are not refused', () => {
  expect(isCrossSiteWrite(req('GET', { origin: 'https://evil.example' }))).toBe(false);
  expect(isCrossSiteWrite(req('HEAD'))).toBe(false);
  expect(isCrossSiteWrite(req('POST'))).toBe(false);
  expect(isCrossSiteWrite(req('POST', { 'sec-fetch-site': 'same-origin' }))).toBe(false);
});

test('handler() refuses before the route runs', () => {
  const src = readFileSync(fileURLToPath(new URL('../../src/lib/route.ts', import.meta.url)), 'utf8');
  const body = src.slice(src.indexOf('export function handler'));
  expect(body.indexOf('if (isCrossSiteWrite(req))')).toBeGreaterThan(-1);
  expect(body.indexOf('if (isCrossSiteWrite(req))')).toBeLessThan(body.indexOf('await fn(req, ctx)'));
});
