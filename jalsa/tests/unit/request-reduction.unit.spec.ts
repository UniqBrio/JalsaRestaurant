/**
 * Fewer database calls per screen, and no stale catalog (27-Oct-2026, P-1;
 * requests/2026-10-27-performance-security-delivery.md).
 *
 * WHAT CHANGED
 *   1. The menu, the settings and the restaurant row come from a per-instance cache keyed by the
 *      catalog counter, which every state route already reads in its first round
 *      (src/lib/db/catalog-cache.ts). Owner 31 → 25 calls on the rig, captain 14 → 10, guest 12 → 8.
 *   2. The printers a paired computer reported ride in the computer read — production has one, so
 *      every full owner read paid a third serial round for them.
 *   3. The stale-claim sweep runs beside the owner's build, not in front of it.
 *
 * FAIL-FIRST: against the pre-change tree the scenario rungs fail — every read touches all five
 * catalog tables, and the owner's full read takes 3 rounds (sweep, then build, then printers).
 * The pure cache rungs are a new module and were written before it.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { catalogRead, clearCatalogCache, MAX_AGE_MS } from '../../src/lib/db/catalog-cache';

interface Read {
  name: string;
  status: number;
  calls: number;
  rounds: number;
  tables: string[];
  catalogTables: string[];
  computers?: number[];
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/catalog-cache.scenarios.ts', import.meta.url));
const src = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');
let reads: Read[] = [];
const get = (name: string) => {
  const r = reads.find((x) => x.name === name);
  if (!r) throw new Error(`scenario missing: ${name}`);
  return r;
};

test.describe('through the real routes', () => {
  test.beforeAll(async () => {
    reads = await runScenario<Read[]>(SCENARIOS);
  });

  test('every read answered', () => {
    for (const r of reads) expect(r.status, r.name).toBe(200);
  });

  test('a cold instance reads the catalog; while the counter holds, no screen reads it again', () => {
    expect(get('owner, cold').catalogTables).toEqual([
      'menu_category',
      'menu_food_type',
      'menu_item',
      'restaurant',
      'setting',
    ]);
    for (const name of ['owner, catalog unchanged', 'captain, catalog unchanged', 'guest, catalog unchanged']) {
      expect(get(name).catalogTables, name).toEqual([]);
    }
    expect(get('owner, catalog unchanged').calls).toBeLessThan(get('owner, cold').calls);
  });

  test('the moment the catalog counter moves, the catalog is read again', () => {
    expect(get('captain, catalog moved').catalogTables).toEqual([
      'menu_category',
      'menu_food_type',
      'menu_item',
      'setting',
    ]);
    expect(get('guest, after the captain re-read it').catalogTables).toEqual([]);
  });

  test('the floor moving alone does not re-read the catalog', () => {
    // Only `restaurant`: the captain re-read the menu and settings at the new version, but no
    // screen since the move has read the restaurant row, so it alone is read - once.
    expect(get('owner, only the floor moved').catalogTables).toEqual(['restaurant']);
  });

  test('without a counter to trust, every read is fresh — never served from the cache', () => {
    for (const name of ['captain, no counter', 'captain, no counter, again']) {
      expect(get(name).catalogTables, name).toEqual(['menu_category', 'menu_food_type', 'menu_item', 'setting']);
    }
  });

  test("the owner's full read is two rounds, with the paired computer's printers in it", () => {
    for (const name of ['owner, cold', 'owner, catalog unchanged']) {
      expect(get(name).rounds, name).toBe(2);
      expect(get(name).tables, name).not.toContain('bridge_discovered_printer');
    }
    expect(get('owner, cold').computers).toEqual([1]);
  });
});

test.describe('the cache rules', () => {
  test.beforeEach(() => clearCatalogCache());

  test('one load per version; a new version loads again', async () => {
    let loads = 0;
    const load = async () => ({ n: ++loads });
    await catalogRead('k', '1', load, undefined, 0);
    expect(await catalogRead('k', '1', load, undefined, 10)).toEqual({ n: 1 });
    expect(await catalogRead('k', '2', load, undefined, 20)).toEqual({ n: 2 });
    expect(loads).toBe(2);
  });

  test('no version: always loads, never stores', async () => {
    let loads = 0;
    const load = async () => ++loads;
    await catalogRead('k', null, load);
    await catalogRead('k', null, load);
    await catalogRead('k', '1', load, undefined, 0);
    expect(loads).toBe(3);
  });

  test('a failed read, or an answer carrying an error, is never kept', async () => {
    let loads = 0;
    await expect(
      catalogRead(
        'k',
        '1',
        async () => {
          loads += 1;
          throw new Error('down');
        },
        undefined,
        0
      )
    ).rejects.toThrow('down');
    const bad = async () => ({ error: (loads += 1) === 2 ? 'boom' : null });
    await catalogRead('k', '1', bad, (v) => !v.error, 1);
    await new Promise((r) => setTimeout(r, 0));
    expect(await catalogRead('k', '1', bad, (v) => !v.error, 2)).toEqual({ error: null });
    expect(loads, 'loaded after the throw, after the error answer, and once more').toBe(3);
  });

  test('an entry is trusted for at most MAX_AGE_MS, whatever the counter says', async () => {
    let loads = 0;
    const load = async () => ++loads;
    await catalogRead('k', '1', load, undefined, 0);
    await catalogRead('k', '1', load, undefined, MAX_AGE_MS - 1);
    await catalogRead('k', '1', load, undefined, MAX_AGE_MS);
    expect(loads).toBe(2);
  });

  test('a caller cannot change what the next caller gets', async () => {
    const first = await catalogRead('k', '1', async () => ({ rows: [{ name: 'Biryani' }] }), undefined, 0);
    first.rows[0]!.name = 'changed';
    const second = await catalogRead('k', '1', async () => ({ rows: [] as Array<{ name: string }> }), undefined, 1);
    expect(second.rows[0]?.name).toBe('Biryani');
  });
});

test.describe('the wiring', () => {
  test('the counter is read in the FIRST round, before the build, by every state route', () => {
    for (const route of ['src/app/api/owner/state/route.ts', 'src/app/api/staff/state/route.ts']) {
      const s = src(route);
      expect(s, route).toMatch(/Promise\.all\(\[currentStaff\('(owner|staff)'\), readVersions\(\)\]\)/);
      expect(s, route).toContain('versions.catalog');
    }
    const guest = src('src/app/api/guest/state/route.ts');
    expect(guest.indexOf('guestVersions(')).toBeLessThan(guest.indexOf('buildGuestPayload(table, catalog)'));
  });

  test('the owner and staff pages pass the counter they read first; the guest page and write echoes read fresh', () => {
    for (const [page, build] of [
      ['src/app/owner/page.tsx', 'buildOwnerPayload(staff, publicConfig.qrOrigin, versions.catalog)'],
      ['src/app/staff/page.tsx', 'buildStaffPayload(staff, versions.catalog)'],
    ] as const) {
      const s = src(page);
      expect(s.indexOf('readVersions()]'), page).toBeGreaterThan(-1);
      expect(s.indexOf('readVersions()]'), page).toBeLessThan(s.indexOf(build));
    }
    // The guest page has no counter in hand before its build, so it passes none.
    expect(src('src/app/t/[table]/page.tsx')).toContain('() => buildGuestPayload(table))');
    expect(src('src/app/api/owner/action/route.ts')).toContain('buildOwnerPayload(staff, publicConfig.qrOrigin)]');
    expect(src('src/app/api/staff/action/route.ts')).toContain('() => buildStaffPayload(staff))');
  });

  test('the menu shaping (which reads the clock) runs on every request — only the rows are cached', () => {
    const q = src('src/lib/db/queries.ts');
    const menu = q.slice(q.indexOf('export async function listMenu'), q.indexOf('/* ── Bills'));
    expect(menu.indexOf('catalogRead(')).toBeLessThan(menu.indexOf('const now = Date.now()'));
    expect(menu).toContain('stillClosed');
  });
});
