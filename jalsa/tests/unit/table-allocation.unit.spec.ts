/**
 * Every DB-backed spec, in every browser project, gets a table of its own.
 *
 * WHY THIS FILE EXISTS
 *   `guest-journey`, `guest-total-visibility` and `closure-upsell-tip` all wrote to A5, and six
 *   browser projects run all three — eighteen executions against one table. None cleans up, and
 *   the reset runs once before the whole suite, so the first execution to open a bill occupied
 *   A5 for the other seventeen. CI on 3a43532: 18 failed, 48 did not run, every failure on
 *   `guest-welcome` not visible.
 *
 *   The property that makes that impossible is INJECTIVITY: two different (spec, project) pairs
 *   must never receive one table. That is a pure claim about a pure function, so it is asserted
 *   here rather than discovered in an eight-minute CI run.
 *
 * FAIL-FIRST EVIDENCE (14-Sep-2026):
 *   OBSERVED FAILING — `allocateTable` replaced with the behaviour it replaces, `() => 'A5'`, in
 *   a temporary copy of this spec: **5 failed, 6 passed**. The failures are exactly the
 *   collision, and they name it:
 *     - different specs in the SAME project never share a table — `desktop: A5, A5, A5`
 *     - the same spec in DIFFERENT projects never shares a table — `guest-journey: A5, A5, A5, A5, A5, A5`
 *     - all 18 combinations are distinct — `distinct tables among A5, A5, … (18×)`
 *     - running out of tables throws loudly — it never throws, so it would have wrapped silently
 *     - an unknown spec or project is refused by name — likewise silent
 *   The six that still passed are the ones a hard-coded 'A5' satisfies by luck: it IS a seeded
 *   active table, it IS stable across calls. That is the point — those six could never have
 *   caught this, and the five above are the rung. The temporary copy was removed after the run.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIVE_SEEDED_TABLES,
  DB_BACKED_SPECS,
  FUNCTIONAL_PROJECTS,
  SEEDED_REGISTRY,
  allocateTable,
  tableFor,
} from '../support/tables';

const EVERY_COMBINATION = DB_BACKED_SPECS.flatMap((spec) =>
  FUNCTIONAL_PROJECTS.map((project) => ({ spec, project }))
);

test('the matrix is the size the seed has to cover', () => {
  // Binding rule 3, for this file: an empty registry would make every assertion below vacuously
  // true, and a suite that asserts nothing looks exactly like a suite that passes.
  expect(DB_BACKED_SPECS.length, 'DB-backed specs').toBe(3);
  expect(FUNCTIONAL_PROJECTS.length, 'functional projects').toBe(6);
  expect(EVERY_COMBINATION.length, 'combinations needing a table').toBe(18);
  expect(ACTIVE_SEEDED_TABLES.length, 'active seeded tables').toBe(19);
});

test('the same spec in the same project always gets the same table', () => {
  // Determinism is what lets a retry land back on the table the first attempt used, and what
  // makes a failure reproducible from the log alone.
  for (const { spec, project } of EVERY_COMBINATION) {
    const first = allocateTable(spec, project);
    expect(allocateTable(spec, project), `${spec} on ${project}, twice`).toBe(first);
    expect(allocateTable(spec, project), `${spec} on ${project}, a third time`).toBe(first);
  }
});

test('different specs in the SAME project never share a table', () => {
  // THE defect, half one: three files of one project run concurrently on two workers.
  for (const project of FUNCTIONAL_PROJECTS) {
    const allocated = DB_BACKED_SPECS.map((spec) => allocateTable(spec, project));
    expect(new Set(allocated).size, `${project}: ${allocated.join(', ')}`).toBe(allocated.length);
  }
});

test('the same spec in DIFFERENT projects never shares a table', () => {
  // THE defect, half two, and the larger one: the bill the desktop run leaves behind is still
  // there when mobile-ios arrives eight minutes later.
  for (const spec of DB_BACKED_SPECS) {
    const allocated = FUNCTIONAL_PROJECTS.map((project) => allocateTable(spec, project));
    expect(new Set(allocated).size, `${spec}: ${allocated.join(', ')}`).toBe(allocated.length);
  }
});

test('all 18 combinations are distinct — no table is handed out twice', () => {
  const allocated = EVERY_COMBINATION.map(({ spec, project }) => allocateTable(spec, project));
  expect(allocated.length, 'allocations made').toBe(18);
  expect(new Set(allocated).size, `distinct tables among ${allocated.join(', ')}`).toBe(18);
});

test('every allocated table is one the seed actually has, and N10 is never one of them', () => {
  // N10 is seeded `active = false`. Handing it to a spec produces a failure that reads as the
  // spec's fault rather than the allocator's.
  expect(ACTIVE_SEEDED_TABLES).not.toContain('N10');
  for (const { spec, project } of EVERY_COMBINATION) {
    const allocated = allocateTable(spec, project);
    expect(ACTIVE_SEEDED_TABLES, `${spec} on ${project} got ${allocated}`).toContain(allocated);
    expect(allocated, 'the inactive table is never allocated').not.toBe('N10');
  }
});

test('the allocator and the seed still agree on which tables exist and are active', () => {
  // A hand-kept list is right until the seed changes. This reads the seed and says so.
  const dir = 'supabase/migrations';
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');

  const rows = [...sql.matchAll(/\('(A\d+|N\d+)','(?:AC|Non-AC)',\d+,(true|false),\d+\)/g)];
  expect(rows.length, 'seeded dining_table rows parsed — a zero-row parse is not a clean one').toBe(20);

  const active = rows.filter((m) => m[2] === 'true').map((m) => m[1]);
  const inactive = rows.filter((m) => m[2] === 'false').map((m) => m[1]);
  expect(active, 'the seed’s active tables').toEqual([...ACTIVE_SEEDED_TABLES]);
  expect(inactive, 'and the one the allocator must skip').toEqual(['N10']);
});

test('running out of tables throws loudly, and never wraps around onto an owned one', () => {
  // Wrapping with `% tables.length` would restore the exact defect this allocator removes, on
  // whichever runner happened to schedule the two together. So: an error, naming the fix.
  const tooSmall = { specs: ['a', 'b'], projects: ['p', 'q'], tables: ['A1', 'A2', 'A3'] };

  expect(allocateTable('a', 'p', tooSmall), 'index 0 still fits').toBe('A1');
  expect(allocateTable('b', 'p', tooSmall), 'index 2 still fits').toBe('A3');
  expect(() => allocateTable('b', 'q', tooSmall), 'index 3 does not').toThrow(/Out of seeded tables/);
  expect(() => allocateTable('b', 'q', tooSmall)).toThrow(/never reuse one/);
});

test('an unknown spec or project is refused by name, not silently given table one', () => {
  // A typo that returned A1 would put two specs on one table and read as a flake.
  expect(() => allocateTable('no-such-spec', 'desktop')).toThrow(/Unknown spec "no-such-spec"/);
  expect(() => allocateTable('guest-journey', 'no-such-project')).toThrow(
    /Unknown project "no-such-project"/
  );
  expect(() => allocateTable('guest-journey', 'unit'), 'the unit project runs no functional spec').toThrow(
    /Unknown project/
  );
});

test('the project list matches playwright.config.ts — two lists that drift are one bug', () => {
  const config = readFileSync('playwright.config.ts', 'utf8');
  const declared = [...config.matchAll(/name: '([a-z-]+)'/g)].map((m) => m[1]);
  expect(declared.length, 'projects parsed from the config').toBeGreaterThan(0);
  expect(declared, 'every functional project is declared there').toEqual(
    expect.arrayContaining([...FUNCTIONAL_PROJECTS])
  );
  // And nothing calls itself functional here that the config does not run.
  for (const project of FUNCTIONAL_PROJECTS) {
    expect(declared, `${project} must exist in playwright.config.ts`).toContain(project);
  }
});

test('tableFor reads the RUNNING project, not a hard-coded one', () => {
  // `tableFor` is the half the specs actually call, and the half `allocateTable`'s tests cannot
  // reach: it supplies `test.info().project.name`. Asserting it here in the `unit` project — which
  // runs no functional spec and is therefore not in FUNCTIONAL_PROJECTS — proves it passes the
  // LIVE project name through rather than a constant. A `tableFor` that ignored the project and
  // returned tables[0] would pass silently here and collide in CI, which is the whole defect.
  expect(() => tableFor('guest-journey'), 'in the unit project there is no functional table').toThrow(
    /Unknown project "unit"/
  );
});

test('the registry the specs actually use is the seeded one', () => {
  expect(SEEDED_REGISTRY.specs).toEqual([...DB_BACKED_SPECS]);
  expect(SEEDED_REGISTRY.projects).toEqual([...FUNCTIONAL_PROJECTS]);
  expect(SEEDED_REGISTRY.tables).toEqual([...ACTIVE_SEEDED_TABLES]);
});
