/**
 * The guest's heart, kept (03-Oct-2026).
 *
 * ROOT CAUSE THIS HOLDS FIXED: the heart on "See my order" was `useState` inside the order screen
 * and nothing else - no route, no table, no payload field. Any trip to the menu, a new round, a
 * reload or a second phone reset every heart, and the owner could never learn what was loved.
 *
 * The write path is the REAL `setFavourite` on the round rig (favourite.scenarios.ts); the table
 * itself is in favourites.db.unit.spec.ts; the screen's half is pinned here by source.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { shownLoved, tallyFavourites } from '../../src/lib/favourites';

interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  log: Array<{ table: string; op: string; body: Record<string, unknown> | null; filters: string[] }>;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/favourite.scenarios.ts', import.meta.url));
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};
const read = (p: string): string => readFileSync(p, 'utf8');

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

/* ── The write ─────────────────────────────────────────────────────────────────────────────── */

test('hearting a served dish writes ONE row for this bill and this dish, idempotently', () => {
  const r = by('heart a served dish');
  expect(r.threw).toBeNull();
  expect(r.out).toEqual({ loved: true });
  const writes = r.log.filter((l) => l.op !== 'select');
  expect(writes).toHaveLength(1);
  expect(writes[0]!.table).toBe('guest_favourite');
  expect(writes[0]!.op).toBe('upsert');
  expect(writes[0]!.body).toMatchObject({ bill_id: 'b1', menu_item_id: 'm-biryani', item_name: 'Chicken Biryani', guest_session_id: 's1', restaurant_id: 'r1' });
  // The served check reads THIS bill's served rounds, and that dish's line on them.
  expect(r.log.find((l) => l.table === 'kot')!.filters).toEqual(['eq:bill_id="b1"', 'eq:status="served"']);
  expect(r.log.find((l) => l.table === 'kot_item')!.filters).toEqual(
    expect.arrayContaining(['in:kot_id=["k1"]', 'eq:menu_item_id="m-biryani"', 'is:cancelled_at=null'])
  );
  // A repeat tap is ignored by the unique rule, not added: the upsert says so.
  const m = read('src/lib/db/mutations.ts');
  expect(m).toContain("{ onConflict: 'bill_id,menu_item_id', ignoreDuplicates: true }");
});

test('a dish not served on this bill cannot be hearted - and nothing is written', () => {
  for (const name of ['heart a dish not served on this bill', 'heart with nothing served yet']) {
    const r = by(name);
    expect(r.threw, name).toBe('You can heart a dish once it has been served to your table.');
    expect(r.log.filter((l) => l.op !== 'select'), name).toEqual([]);
  }
});

test('un-hearting deletes this bill\'s heart on this dish, and nothing else', () => {
  const r = by('un-heart');
  expect(r.threw).toBeNull();
  expect(r.out).toEqual({ loved: false });
  expect(r.log).toEqual([
    { table: 'guest_favourite', op: 'delete', body: null, filters: ['eq:bill_id="b1"', 'eq:menu_item_id="m-biryani"'] },
  ]);
});

test('a failed write is thrown, never reported as saved', () => {
  expect(by('the write fails').threw).toMatch(/guest_favourite/);
  expect(by('the write fails').out).toBeNull();
  expect(by('the un-heart write fails').threw).toMatch(/guest_favourite/);
});

test('after a reload the hearts are read back with the bill itself - no extra round trip', () => {
  const r = by('read back after a reload');
  // A heart whose dish was since deleted (menu_item_id null) is not a heart on any dish shown.
  expect(r.out).toEqual(['m-biryani']);
  expect(r.log.map((l) => l.table)).toEqual(['bill']);
  expect(read('src/lib/db/queries.ts')).toContain('  guest_favourite ( menu_item_id ),');
});

/* ── The route: the guest's own bill, and only a dish id and a yes/no ───────────────────────── */

test('the route takes the bill from the cookie session, never from the request', () => {
  const src = read('src/app/api/guest/favourite/route.ts');
  expect(src).toContain('const session = await currentGuestSession();');
  expect(src).toContain('billId: session.billId');
  expect(src).not.toMatch(/input\.billId|input\.bill_id/);
  // A dish id that is not an id, or a "loved" that is not a boolean, is refused.
  expect(src).toContain("typeof input.loved !== 'boolean'");
  // Not served -> a 409 in words; anything else -> the handler's 500, never a quiet success.
  expect(src).toContain("if (err instanceof FavouriteRefused) return fail(409, { code: 'not_served', message: err.message });");
  expect(src).toContain('throw err;');
});

/* ── The screen ────────────────────────────────────────────────────────────────────────────── */

test('the heart shows what the server holds, so a reload or a second phone shows the same', () => {
  const src = read('src/features/guest/GuestProgress.tsx');
  expect(src).not.toContain('const [loved, setLoved] = React.useState<Record<string, boolean>>({});');
  expect(src).toContain('const loved = shownLoved(i.menuItemId, data.lovedItemIds, pendingLove);');
  // Keyed by the DISH, not the KOT line: the same dish in two rounds is one heart.
  expect(src).toContain("await send('/api/guest/favourite', { menuItemId, loved: next });");
  expect(src).toContain('aria-pressed={loved}');
  // And the payload carries it, read from the table for this bill.
  const view = read('src/lib/db/guest-view.ts');
  expect(view).toContain('lovedItemIds: bill?.lovedItemIds ?? [],');
  expect(view).toContain('menuItemId: i.menuItemId,');
});

test('a heart that failed to save does not stay filled, and the guest is told', () => {
  const src = read('src/features/guest/GuestProgress.tsx');
  const fn = src.slice(src.indexOf('const toggleLove = async'), src.indexOf('const anyServed'));
  expect(fn).toContain('} catch (err) {');
  expect(fn).toContain("{ tone: 'error' }");
  expect(fn).toContain('was not saved. Check your connection, then tap it again.');
  // The pending answer is dropped in `finally` - on failure too - so the truth shows again.
  expect(fn).toContain('} finally {');
  expect(fn).toContain('delete rest[menuItemId];');
});

test('shownLoved: the answer being waited for wins, then the saved truth', () => {
  expect(shownLoved('m1', [], {}), 'nothing saved').toBe(false);
  expect(shownLoved('m1', ['m1'], {}), 'saved').toBe(true);
  expect(shownLoved('m1', [], { m1: true }), 'tapped, saving').toBe(true);
  expect(shownLoved('m1', ['m1'], { m1: false }), 'un-tapped, saving').toBe(false);
  // Once the write answers the pending entry is gone: a failed heart shows what was saved.
  expect(shownLoved('m1', [], {}), 'failed heart reverts').toBe(false);
  expect(shownLoved(null, ['m1'], {}), 'a line with no dish cannot be hearted').toBe(false);
});

/* ── The owner's count ─────────────────────────────────────────────────────────────────────── */

test('the report counts parties per dish, most loved first, and keeps a deleted dish by name', () => {
  const t = tallyFavourites([
    { menuItemId: 'a', name: 'Chicken Biryani', billId: 'b1', createdAt: '2026-10-01T10:00:00Z' },
    { menuItemId: 'a', name: 'Chicken Biryani', billId: 'b2', createdAt: '2026-10-02T10:00:00Z' },
    // A duplicate that slipped past the unique rule still counts the party once.
    { menuItemId: 'a', name: 'Chicken Biryani', billId: 'b2', createdAt: '2026-10-02T10:05:00Z' },
    { menuItemId: 'b', name: 'Butter Naan', billId: 'b1', createdAt: '2026-10-03T10:00:00Z' },
    { menuItemId: null, name: 'Old Special', billId: 'b3', createdAt: '2026-09-01T10:00:00Z' },
  ]);
  expect(t.map((r) => [r.name, r.parties])).toEqual([
    ['Chicken Biryani', 2],
    ['Butter Naan', 1],
    ['Old Special', 1],
  ]);
  expect(t[0]!.lastLovedAt).toBe('2026-10-02T10:05:00Z');
  expect(tallyFavourites([]), 'no hearts, no rows').toEqual([]);
});

/* ── Review fixes (03-Oct-2026) ────────────────────────────────────────────────────────────── */

test('a dish served on ANOTHER party\'s bill cannot be hearted on this one', () => {
  const r = by('heart a dish served only on another bill');
  expect(r.threw).toBe('You can heart a dish once it has been served to your table.');
  expect(r.log.filter((l) => l.op !== 'select')).toEqual([]);
  // The served check asked about THIS bill only.
  expect(r.log.find((l) => l.table === 'kot')!.filters).toEqual(['eq:bill_id="b1"', 'eq:status="served"']);
});

test('when a table separates, its hearts follow its dishes - and leave only what no longer stays', () => {
  const r = by('table separates: hearts follow the dishes');
  expect(r.threw).toBeNull();
  const copy = r.log.find((l) => l.table === 'guest_favourite' && l.op === 'upsert')!;
  const moved = (copy.body as unknown as Array<{ menu_item_id: string; bill_id: string }>).map((h) => [h.menu_item_id, h.bill_id]);
  // Paneer and naan went with round k2; biryani did not.
  expect(moved).toEqual([['m-paneer', 'b2'], ['m-naan', 'b2']]);
  const drop = r.log.find((l) => l.table === 'guest_favourite' && l.op === 'delete')!;
  // Naan is gone from b1; paneer is still served there (k1), so its heart stays too.
  expect(drop.filters).toEqual(['eq:bill_id="b1"', 'in:menu_item_id=["m-naan"]']);
  expect(read('src/lib/db/mutations.ts')).toContain('await moveHeartsWithRounds({');
});

test('the owner\'s Hearts switch is enforced by the route, not only drawn', () => {
  const src = read('src/app/api/guest/favourite/route.ts');
  expect(src).toContain('const features = resolveFeatures((await readAllSettings()).customerFeatures);');
  expect(src).toContain("if (!features.heart) {");
  // Only a new heart is refused; taking one back is always allowed.
  expect(src.indexOf('if (input.loved) {')).toBeLessThan(src.indexOf('if (!features.heart) {'));
});

test('a malformed id is a 400, not a database error', () => {
  const src = read('src/app/api/guest/favourite/route.ts');
  expect(src).toContain('const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(uuid.test('-'.repeat(36))).toBe(false);
  expect(uuid.test('3f6c2a10-1d2e-4c5b-9a8f-0e1d2c3b4a59')).toBe(true);
});

test('a heart reaches every phone at the table: it moves the bill\'s version, and the write answers with the state', () => {
  const m = read('supabase/migrations/20261004090000_jalsa_guest_favourite.sql');
  expect(m).toContain('for each row execute function public.bill_version_from_child();');
  expect(m).not.toContain("bump_change_version('floor')");
  expect(read('src/app/api/guest/favourite/route.ts')).toContain('return ok({ ...saved, state: await freshState(session) });');
});

test('the failure toast never shows the browser\'s own error text', () => {
  const src = read('src/features/guest/GuestProgress.tsx');
  expect(src).toContain('err instanceof Error && !(err instanceof TypeError)');
  expect(src).toContain('`Your heart on ${name} was not saved. Check your connection, then tap it again.`');
});

test('the report reads every page, not only the first thousand rows', () => {
  const q = read('src/lib/db/queries.ts');
  const fn = q.slice(q.indexOf('export async function listFavouritesBetween'));
  expect(fn.slice(0, 1600)).toContain('.range(from, from + PAGE - 1);');
  expect(fn.slice(0, 1600)).toContain('if (!page || page.length < PAGE) break;');
});

test('before Served the heart explains itself instead of looking broken', () => {
  // 04-Oct-2026, the owner: "I am unable to click on heart icon ... add a tooltip that you can mark
  // favourite once dish is served so that user may not get puzzled". The served rule stays; the
  // button is no longer `disabled` before Served (a disabled button shows only a "not allowed"
  // cursor and answers no tap) - it is dimmed, says why on hover, and a tap shows it as a toast.
  const src = read('src/features/guest/GuestProgress.tsx');
  expect(src).toContain("const HEART_LOCKED = 'You can mark a favourite once the dish is served.';");
  expect(src).toContain('aria-disabled={!i.servable}');
  expect(src).toContain('title={i.servable ? `I loved the ${i.name}` : HEART_LOCKED}');
  expect(src).toContain('toast.show(HEART_LOCKED);');
  expect(src).not.toMatch(/\sdisabled=\{!i\.servable/);
  // The server still keeps hearts for served dishes only.
  expect(read('src/lib/db/mutations.ts')).toContain(".eq('status', 'served');");
});
