/**
 * Which seeded table a DB-backed spec is allowed to touch.
 *
 * WHY THIS FILE EXISTS
 *   Three functional specs wrote to table A5, and six browser projects each run all three. That
 *   is eighteen executions against one table. None of them cleans up — deliberately, each says so
 *   in its own header — and the reset runs ONCE before the whole suite, so the first execution to
 *   open a bill on A5 occupied it for the other seventeen. CI on 3a43532: 18 failed, 48 did not
 *   run, every failure on the same first assertion, `guest-welcome` not visible, because a table
 *   with an open bill shows that bill's order list instead (JP-4, bill_table_one_open_per_table).
 *
 *   It is NOT primarily a race. The bill persists for the rest of the run, so the collision
 *   happens at one worker as surely as at two. Serialising would have hidden the smaller half and
 *   left the larger one. The only thing that removes it is removing the shared row: two
 *   executions that never touch the same table cannot collide, in any order, at any worker count.
 *
 * WHY A REGISTRY AND NOT A HASH
 *   A hash of (spec, project) is deterministic but not injective — two combinations can land on
 *   one table, which is the exact defect, reintroduced and much harder to see. An explicit list
 *   indexed by position cannot collide BY CONSTRUCTION, and running out is an error rather than a
 *   silent wrap-around onto a table someone else owns.
 *
 * WHY IT ALLOCATES PER SPEC FILE, NOT PER TEST
 *   Each of the three specs is `describe.serial`, so its tests run in order in one worker, and
 *   some of them depend on that: `guest-journey`'s second test asserts that a second phone joins
 *   the bill the first test opened. A per-TEST table would destroy that intent. The file is the
 *   unit that owns a table because the file is the unit that is internally ordered.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   It does not touch the database. There is no cleanup here, no credential, and no second way to
 *   delete a row — `scripts/reset-test-db.mjs` owns that and a second idiom for one concern is a
 *   defect (CLAUDE.md, canonical patterns). Allocation needs no database access at all.
 */
import { test } from '@playwright/test';

/**
 * Every ACTIVE table in the seed, in the seed's own order.
 *
 * N10 IS ABSENT ON PURPOSE. `20260910071000_jalsa_seed_and_pin.sql` seeds it with
 * `active = false`, and an inactive table is not a table a guest can sit at. Handing one to a
 * spec would produce a failure that looks like the spec's fault. `table-allocation.unit.spec.ts`
 * reads the seed and asserts this list still matches it.
 */
export const ACTIVE_SEEDED_TABLES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9',
] as const;

/**
 * The specs that WRITE to a table, by the key each one passes.
 *
 * A spec that reads without writing is not here and does not need to be: `reachability` visits a
 * name no table has, and `degraded` talks to the instance with no database at all.
 */
export const DB_BACKED_SPECS = [
  'guest-journey',
  'guest-total-visibility',
  'closure-upsell-tip',
] as const;

/**
 * The Playwright projects that run `tests/functional`, exactly as `playwright.config.ts` names
 * them. Order fixes the allocation; it is not otherwise meaningful.
 */
export const FUNCTIONAL_PROJECTS = [
  'desktop',
  'desktop-wide',
  'tablet',
  'mobile',
  'mobile-ios',
  'mobile-short',
] as const;

export interface TableRegistry {
  readonly specs: readonly string[];
  readonly projects: readonly string[];
  readonly tables: readonly string[];
}

/** The real one. Injectable in `allocateTable` so exhaustion is reachable from a test. */
export const SEEDED_REGISTRY: TableRegistry = {
  specs: DB_BACKED_SPECS,
  projects: FUNCTIONAL_PROJECTS,
  tables: ACTIVE_SEEDED_TABLES,
};

/**
 * The table this spec owns in this project. Pure: same inputs, same answer, always.
 *
 * `spec * projects + project` gives every combination its own index, so two different
 * combinations can never be handed the same table. It depends on neither the worker count nor the
 * order anything ran in — which is the whole point, because both of those vary per runner.
 */
export function allocateTable(
  spec: string,
  project: string,
  registry: TableRegistry = SEEDED_REGISTRY
): string {
  const specIndex = registry.specs.indexOf(spec);
  if (specIndex < 0) {
    throw new Error(
      `[tables] Unknown spec "${spec}". Add it to DB_BACKED_SPECS in tests/support/tables.ts. ` +
        `Known: ${registry.specs.join(', ')}.`
    );
  }

  const projectIndex = registry.projects.indexOf(project);
  if (projectIndex < 0) {
    throw new Error(
      `[tables] Unknown project "${project}". Add it to FUNCTIONAL_PROJECTS in ` +
        `tests/support/tables.ts, which must match playwright.config.ts. ` +
        `Known: ${registry.projects.join(', ')}.`
    );
  }

  const index = specIndex * registry.projects.length + projectIndex;
  const table = registry.tables[index];
  if (table === undefined) {
    // Loudly, and naming the fix. The alternative — wrapping around with `% tables.length` —
    // would hand two specs one table and restore the exact defect this file exists to remove,
    // silently, on whichever runner happened to schedule them together.
    throw new Error(
      `[tables] Out of seeded tables: ${registry.specs.length} spec(s) × ` +
        `${registry.projects.length} project(s) needs ${registry.specs.length * registry.projects.length}, ` +
        `and the seed has ${registry.tables.length} active. ` +
        `"${spec}" on "${project}" wanted index ${index}. ` +
        `Seed more tables in supabase/migrations, or reduce the matrix — never reuse one.`
    );
  }
  return table;
}

/**
 * The table this spec owns in the project currently running it.
 *
 * Called from inside a test (or a helper a test calls), never at module scope: the project name
 * is only knowable once a test is running, and `test.info()` throws outside one — loudly, which
 * is the right answer to calling this in the wrong place.
 */
export function tableFor(spec: (typeof DB_BACKED_SPECS)[number]): string {
  return allocateTable(spec, test.info().project.name);
}
