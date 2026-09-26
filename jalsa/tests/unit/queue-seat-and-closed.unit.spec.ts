import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { NEW_TABLES_CLOSED, QUEUE_CLOSED } from '../../src/lib/queue-closed';

/**
 * Seating a called party, and a table code scanned while the queue is closed
 * (24-Sep correction list F2, F3).
 *
 * F2  "Called queue guest -> table selection appears -> table is not actually assigned."
 *     Seating stamped `waitlist_entry.seated_table_id` and nothing else. The floor reads
 *     occupancy from an OPEN BILL, so the table stayed free on every screen and was offered to
 *     the next party. Live evidence: W-1, seated at A2 on 19-Sep, no bill ever opened there.
 *     Seating now opens the table's bill through `ensureOpenBill` - still the one way a bill is
 *     opened - after the server has checked the table and claimed the queue row.
 * F3  A table code scanned while the queue is closed showed the full menu, and the round route
 *     opened a bill for anyone. The closed switch now stops NEW tables on both the screen and
 *     the server; a table already seated keeps ordering.
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

test('F2: seating opens the bill on that table, with the party as its guests', () => {
  const fn = bodyOf(OWNER, 'export async function seatWaitlist');
  /* SUPERSEDED 24-Sep-2026 (review): previously without `mustBeNew`. Two hosts seating two
     parties at one table at once both passed the free check, and the second joined the first's
     bill through ensureOpenBill's "return the existing bill" path. A seat now refuses instead. */
  expect(fn).toMatch(
    /ensureOpenBill\(input\.tableId, \{\s*guests: \(row\.party_size as number\) \|\| 2,\s*actor: input\.actor,\s*mustBeNew: true,/
  );
  const m = code('src/lib/db/mutations.ts');
  const open = m.slice(m.indexOf('export async function ensureOpenBill'));
  expect(open).toMatch(/if \(existing\) \{\s*if \(opts\.mustBeNew\) throw new Error/);
  expect(open).toMatch(/if \(won && opts\.mustBeNew\) \{\s*throw new Error/);
  expect(fn).toContain('seated_table_id: input.tableId');
});

test('F2: the server refuses a table that is off, taken, or waiting to be cleared', () => {
  const fn = bodyOf(OWNER, 'export async function seatWaitlist');
  expect(fn).toContain('table.active !== true');
  expect(fn).toContain('openBillForTable(input.tableId)');
  expect(fn).toMatch(/if \(openBill\) throw new Error/);
  expect(fn).toMatch(/\.not\('released_at', 'is', null\)\s*\.is\('cleared_at', null\)/);
  // Checked BEFORE anything is written: the claim comes after the table checks.
  expect(fn.indexOf('if (openBill) throw')).toBeLessThan(fn.indexOf(".from('waitlist_entry')"));
});

test('F2: a party already seated or removed is refused, not reported seated', () => {
  const fn = bodyOf(OWNER, 'export async function seatWaitlist');
  expect(fn).toMatch(/\.is\('seated_at', null\)\s*\.is\('removed_at', null\)\s*\.select\('token,party_size'\)/);
  expect(fn).toContain('if (!row) throw new Error');
  // The claim happens before the bill, so a refused claim leaves no bill behind.
  expect(fn.indexOf('if (!row) throw')).toBeLessThan(fn.indexOf('ensureOpenBill('));
});

test('F2: if the bill cannot be opened, the party goes back to waiting', () => {
  const fn = bodyOf(OWNER, 'export async function seatWaitlist');
  expect(fn).toMatch(/catch \(err\) \{[\s\S]*seated_at: null, seated_table_id: null[\s\S]*throw err;/);
});

test('F2: a seat always names its table', () => {
  const route = code('src/app/api/owner/action/route.ts');
  expect(route).toMatch(/if \(!input\.tableId\)\s*return fail\(400/);
  expect(route).toContain('seatWaitlist({ id: input.id, tableId: input.tableId, actor })');
});

test('F3: the closed sentence is shared, and is not the door queue sentence', () => {
  expect(NEW_TABLES_CLOSED).not.toBe(QUEUE_CLOSED);
  expect(NEW_TABLES_CLOSED.length).toBeGreaterThan(20);
});

test('F3: a table with no bill is closed to new orders when the queue is closed; a seated one is not', () => {
  const view = code('src/lib/db/guest-view.ts');
  expect(view).toContain('((settings.queue ?? {}) as { open?: boolean }).open !== false');
  expect(view).toContain('newTablesClosed: !queueOpen && !bill');
  const app = code('src/features/guest/GuestApp.tsx');
  expect(app).toContain('if (data.newTablesClosed)');
  expect(app).toContain('data-testid="guest-new-tables-closed"');
});

test('F3: the round route refuses a NEW bill while closed, and still serves a seated table', () => {
  const route = code('src/app/api/guest/round/route.ts');
  expect(route).toContain("readSettings('queue', { open: true })");
  expect(route).toContain('if (!existing && queue.open === false)');
  expect(route).toContain('message: NEW_TABLES_CLOSED');
  /* SUPERSEDED 26-Sep-2026 (latency, write path): previously
     'existing ?? (await ensureOpenBill(session.tableId))'. The route has just read the table, so
     it tells ensureOpenBill not to read it again. */
  expect(route).toContain('existing ?? (await ensureOpenBill(session.tableId, { knownAbsent: true }))');
});
