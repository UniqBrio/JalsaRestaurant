import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { isSharedSetupCode, SHARED_SETUP_CODES } from '../../src/lib/setup-pins';
import nextConfig from '../../next.config';

/**
 * The authentication and security audit of 26-Oct-2026 (requests/2026-10-26-auth-performance-security-audit.md,
 * docs/audit/AUTH_PERFORMANCE_SECURITY_AUDIT.md). One rung per confirmed finding that was fixed.
 *
 * SEC-01  Four live accounts still carried the shared setup PIN `1234` (counted read-only on
 *         production, 26-Oct). Anyone who could reach the site could sign in with it and then
 *         either "Skip for now" or "choose your own PIN" with 1234 as the current one - a full,
 *         named staff session for a stranger. The shared codes are now refused at sign-in.
 * SEC-02  Rule 5 (an issued PIN opens one screen) was held by the pages and the action routes,
 *         but eight READ routes served a provisional session the floor, the console and the
 *         reports. Every route that reads a staff session now refuses a provisional one, except
 *         the one screen it opens.
 * SEC-04  No response carried anti-framing, nosniff or a referrer policy.
 * SEC-05  `issuePin` drew a credential from Math.random.
 * SEC-06  The entrance-queue cookie was sent without `Secure`.
 * PERF-02 The sales report's closed bills and expenses, the tip ledger and the expense ledger were each read in ONE
 *         request. PostgREST answers at most `max_rows` (1000 by default) per request, so past
 *         that a report under-counts revenue, tips or expenses and says nothing. They are paged
 *         now, exactly as `listFavouritesBetween` already was (review, 03-Oct-2026).
 *
 * Server paths run against Postgres, so those pins are on the source lines that carry each rule -
 * the house idiom (see pin-and-attribution, session-surfaces). The pure rule is executed.
 */

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function bodyOf(path: string, signature: string): string {
  const src = code(path);
  const start = src.indexOf(signature);
  expect(start, `${signature} exists in ${path}`).toBeGreaterThan(-1);
  const rest = src.slice(start);
  return rest.slice(0, rest.indexOf('\n}\n'));
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('SEC-01: the shared setup codes are exactly the ones set_own_pin refuses', () => {
  // The one list both sides must agree on. Parsed from the migration that defines the refusal,
  // so the two cannot drift: a code the database refuses as a NEW pin is a code nobody could
  // have chosen, so the only way an account holds one is the shared seed.
  const sql = readFileSync('supabase/migrations/20260910073000_jalsa_provisional_pins.sql', 'utf8');
  const m = /if p_new in \(([^)]*)\) then/.exec(sql);
  expect(m, 'set_own_pin still names the codes it refuses').not.toBeNull();
  const refused = [...m![1]!.matchAll(/'(\d{4})'/g)].map((x) => x[1]).sort();
  expect(refused.length).toBeGreaterThan(0);
  expect([...SHARED_SETUP_CODES].sort()).toEqual(refused);
});

test('SEC-01: a shared setup code never signs anybody in', () => {
  expect(isSharedSetupCode('1234')).toBe(true);
  expect(isSharedSetupCode('0000')).toBe(true);
  expect(isSharedSetupCode('4321')).toBe(true);
  // A PIN the owner issued, or one a person chose, is not refused.
  expect(isSharedSetupCode('2580')).toBe(false);
  expect(isSharedSetupCode('7093')).toBe(false);
  expect(isSharedSetupCode('')).toBe(false);

  // Refused BEFORE the database is asked, and with the same "no session" every wrong PIN gets -
  // so the keypad still cannot tell a stranger which codes exist.
  const fn = bodyOf('src/lib/db/auth.ts', 'export async function signInWithPin');
  const refusal = fn.indexOf('if (isSharedSetupCode(pin)) return null;');
  expect(refusal, 'signInWithPin refuses a shared setup code').toBeGreaterThan(-1);
  expect(refusal).toBeLessThan(fn.indexOf("rpc('verify_staff_pin'"));
});

test('SEC-02: every route that reads a staff session refuses an issued PIN, except the one screen it opens', () => {
  // The choose-your-own-PIN route is the screen rule 5 opens; it must accept a provisional session.
  const OPENS_THE_ONE_SCREEN = join('src', 'app', 'api', 'staff', 'pin', 'route.ts');
  const readers = filesUnder(join('src', 'app', 'api')).filter((f) => /currentStaff\(/.test(code(f)));
  // A scan that matched nothing would pass vacuously (binding rule 3's corollary).
  expect(readers.length).toBeGreaterThanOrEqual(10);
  expect(readers).toContain(OPENS_THE_ONE_SCREEN);

  const open = readers.filter((f) => f !== OPENS_THE_ONE_SCREEN).filter((f) => !/\.provisional\b/.test(code(f)));
  expect(open, 'routes that serve a provisional (issued-PIN) session').toEqual([]);
});

test('SEC-02: the read routes refuse with the same sentence the action routes use', () => {
  for (const route of [
    'src/app/api/staff/state/route.ts',
    'src/app/api/owner/state/route.ts',
    'src/app/api/owner/report/route.ts',
    'src/app/api/owner/favourites/route.ts',
    'src/app/api/owner/heard/route.ts',
    'src/app/api/owner/qr/route.ts',
    'src/app/api/owner/review-qr/route.ts',
    'src/app/api/owner/print-bridge/download/route.ts',
  ]) {
    expect(code(route), route).toMatch(
      /if \(staff\.provisional\) return fail\(403, \{ code: 'forbidden', message: PROVISIONAL_REFUSAL \}\);/
    );
  }
});

test('SEC-04: every response forbids framing and MIME sniffing, and trims the referrer', async () => {
  const rules = await nextConfig.headers!();
  const all = rules.find((r) => r.source === '/:path*');
  expect(all, 'a header rule covering every path').toBeDefined();
  const h = Object.fromEntries(all!.headers.map((x) => [x.key.toLowerCase(), x.value]));
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  // The service worker's own rule is untouched.
  expect(rules.find((r) => r.source === '/sw.js')).toBeDefined();
});

test('SEC-05: an issued PIN is drawn from the CSPRNG, never Math.random', () => {
  const fn = bodyOf('src/lib/db/owner-mutations.ts', 'export async function issuePin');
  expect(fn).toContain("String(randomInt(10000)).padStart(4, '0')");
  expect(fn).not.toContain('Math.random');
});

test('SEC-06: the entrance-queue cookie is Secure in production, like every other cookie', () => {
  expect(code('src/app/api/guest/queue/route.ts')).toMatch(
    /jar\.set\(COOKIE, id, \{[^}]*secure: process\.env\.NODE_ENV === 'production'[^}]*\}\)/
  );
});

for (const [fn, table] of [
  ['export async function listClosedBillsBetween(', 'bill'],
  ['export async function listTips(', 'tip'],
  ['export async function listExpenses(', 'expense'],
  ['export async function listExpensesBetween(', 'expense'],
] as const) {
  test(`PERF-02: ${fn.replace('export async function ', '').replace('(', '')} reads every page, not only the first ${table} rows`, () => {
    const body = bodyOf('src/lib/db/queries.ts', fn);
    // The same loop as listFavouritesBetween: fixed pages, a stable order, stop on a short page.
    expect(body).toContain('const PAGE = 1000;');
    expect(body).toMatch(/\.range\((\w+), \1 \+ PAGE - 1\);/);
    expect(body).toContain('if (!page || page.length < PAGE) break;');
    // A tiebreak on id, so two rows with the same time never swap between pages.
    expect(body).toMatch(/\.order\('id'\)/);
  });
}

/* Executed, not only pinned: the real functions, against a fake that answers like PostgREST - at most
   1000 rows a request (tests/support/rounds/paging.scenarios.ts). Before the fix each returned 1000
   of the 2007 rows stored, in one request. */
interface Paged {
  name: string;
  stored: number;
  returned: number;
  distinct: number;
  requests: number;
}
const PAGING = fileURLToPath(new URL('../support/rounds/paging.scenarios.ts', import.meta.url));

test('PERF-02: a report or ledger larger than one PostgREST page is read whole, each row once', async () => {
  const results = await runScenario<Paged[]>(PAGING);
  expect(results.map((r) => r.name)).toEqual([
    'listClosedBillsBetween',
    'listTips',
    'listExpenses',
    'listExpensesBetween',
  ]);
  for (const r of results) {
    expect(r.returned, r.name).toBe(r.stored);
    expect(r.distinct, `${r.name}: no row twice`).toBe(r.stored);
    // 1000 + 1000 + 7: three requests, and no fourth once a short page says it is done.
    expect(r.requests, r.name).toBe(3);
  }
});
