import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Reissue PIN, who a PIN belongs to, and who opened a bill (24-Sep correction list F1, G2, C1).
 *
 * F1  Reissue PIN failed on every press: the live database still carries both
 *     `set_staff_pin(uuid,text)` and `set_staff_pin(uuid,text,boolean)` (migration 20260917120000
 *     was never applied there), and a two-argument named call matches both - PostgREST refuses
 *     it as ambiguous (PGRST203).
 * G2  A round placed on a captain's phone was recorded against the owner. The KOT records the
 *     signed-in session faithfully; what was missing was any record of WHOSE session was on which
 *     surface, and "Bill opened" credited every bill to the guest's phone.
 * C1  Free tables offered to staff included tables still waiting to be cleared, and the server
 *     accepted a round onto a closed bill.
 *
 * These paths run against Postgres, so the pins are on the source lines that carry each rule -
 * the house idiom for server paths (see indoor-queue, printers-screen).
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

const OWNER = 'src/lib/db/owner-mutations.ts';
const MUTATIONS = 'src/lib/db/mutations.ts';

test('F1: a reissued PIN names all three arguments, so it resolves and is provisional', () => {
  const fn = bodyOf(OWNER, 'export async function issuePin');
  expect(fn).toContain("rpc('set_staff_pin', { p_staff: input.staffId, p_pin: pin, p_provisional: true })");
  expect(fn).not.toMatch(/rpc\('set_staff_pin', \{ p_staff: input\.staffId, p_pin: pin \}\)/);
});

test('G2: an issued PIN is never one another member of staff already signs in with', () => {
  const fn = bodyOf(OWNER, 'export async function issuePin');
  expect(fn).toContain("rpc('verify_staff_pin', { p_restaurant: restaurantId, p_pin: candidate })");
  /* SUPERSEDED 24-Sep-2026 (review): previously `row.id !== input.staffId`. `verify_staff_pin`
     returns ONE row, so a PIN held by both this person and another could come back as their own
     row and pass. Any holder at all now redraws. */
  expect(fn).toContain('return ((data as Array<{ id: string }> | null) ?? []).length > 0;');
});

test('G2: "Bill opened" names whoever opened it; staff and owner routes say who', () => {
  const fn = bodyOf(MUTATIONS, 'export async function ensureOpenBill');
  expect(fn).toContain('actor: opts.actor ?? GUEST_ACTOR');
  expect(fn).not.toMatch(/action: 'Bill opened',[\s\S]{0,120}actor: GUEST_ACTOR,/);
  expect(code('src/app/api/staff/action/route.ts')).toMatch(/ensureOpenBill\(input\.tableId, \{\s*actor,/);
  expect(code('src/app/api/owner/action/route.ts')).toContain('ensureOpenBill(input.tableId, { actor })');
  // The guest's own round still opens as the guest.
  expect(code('src/app/api/guest/round/route.ts')).toMatch(/ensureOpenBill\(session\.tableId\)/);
});

test('G2: a captain opening an unassigned table becomes its captain; the owner does not', () => {
  const fn = bodyOf(MUTATIONS, 'export async function ensureOpenBill');
  expect(fn).toContain('captain_staff_id: captain?.id ?? opts.openerCaptainId ?? null');
  const staffRoute = code('src/app/api/staff/action/route.ts');
  expect(staffRoute).toContain("staff.role === 'Captain' ? { openerCaptainId: staff.staffId } : {}");
  expect(code('src/app/api/owner/action/route.ts')).not.toContain('openerCaptainId');
});

test('G2: every sign-in is recorded with the person and the surface', () => {
  const route = code('src/app/api/staff/session/route.ts');
  expect(route).toContain("action: 'Signed in'");
  expect(route).toContain('actor: { staffId: session.staffId, label: session.name }');
  expect(route).toMatch(/owner console' : 'staff app'/);
});

test('C1: staff cannot open a bill on a table out of service, or add to a closed bill', () => {
  const fn = bodyOf(MUTATIONS, 'export async function ensureOpenBill');
  expect(fn).toContain('opts.actor && tableRow && tableRow.active === false');
  /* SUPERSEDED 24-Sep-2026 (review): previously `bill.status === 'closed'` only. A VOIDED bill
     (freed by hand) and a table moved off the bill are refused too. */
  const staffRoute = code('src/app/api/staff/action/route.ts');
  expect(staffRoute).toContain("(bill.status !== 'open' && bill.status !== 'payment_requested')");
  expect(staffRoute).toContain('!bill.tables.includes(tableRow.name as string)');
});

test('C1: a table waiting to be cleared is not offered as free, on either surface', () => {
  expect(code('src/features/staff/StaffTables.tsx')).toContain(
    'data.tables.filter((t) => t.billId === null && t.active && t.clearing === null)'
  );
  expect(code('src/features/owner/sections/Dashboard.tsx')).toContain(
    'disabled={!t.billId && !(canOrder && t.active && t.clearing === null)}'
  );
});
