/**
 * Column names the application writes by hand, checked against the schema that defines them.
 *
 * WHY THIS FILE EXISTS
 *   On 12-Sep-2026 `reassignBillStaff` shipped writing `captain_id` / `waiter_id`. The real
 *   columns are `captain_staff_id` / `waiter_staff_id`, so the feature would have thrown on
 *   every use. It was found by accident — a snapshot query failed while applying an unrelated
 *   migration — and NOTHING in the pipeline would have found it otherwise: a column name is a
 *   string by the time PostgREST sees it, so `tsc`, the build, lint and every unit spec are all
 *   blind to it. The same afternoon, `discount_type` shipped in a write before its migration was
 *   applied, breaking bill closure in production. Twice, the same class.
 *
 *   The class is: **application code naming a database column, with nothing checking that the
 *   column exists.** This file is the thing that checks.
 *
 * WHAT IT READS
 *   The migration files, which are the only description of the schema this repository owns. Not
 *   a live connection — the gate must run where there is no database, and a rung that needs one
 *   is a rung that skips, and a skip reads as a pass.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026):
 *   OBSERVED FAILING — run against the mapping exactly as it shipped
 *   (`{ captain: 'captain_id', waiter: 'waiter_id' }`): **1 failed** —
 *   `bill.captain_id must be declared in the core schema · expected true, received false`.
 *   That is the defect, caught by the rung that did not exist when it shipped.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BILL_STAFF_COLUMN } from '../../src/lib/db/types';

const MIGRATIONS_DIR = 'supabase/migrations';

/** Every migration, concatenated. A column may be added by a later one, not only the core file. */
const allMigrations = (): string =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');

const schema = allMigrations();

/**
 * Does any migration declare this column?
 *
 * Matches a column at the start of a line (a `create table` body) or after `add column [if not
 * exists]`. Deliberately loose about what follows: this is asking "does the name exist", not
 * "what is its type".
 */
function declaresColumn(column: string): boolean {
  const atLineStart = new RegExp(`^\\s*${column}\\s+\\w`, 'm');
  const added = new RegExp(`add\\s+column\\s+(if\\s+not\\s+exists\\s+)?${column}\\b`, 'i');
  return atLineStart.test(schema) || added.test(schema);
}

/**
 * The `create table` body for one table, or null if no migration declares it.
 *
 * `declaresColumn` above asks "does this NAME appear anywhere in the schema", which is the
 * weakest question that could still be called a check. `created_at` is declared on FIFTEEN
 * tables, so it answers true while `audit_entry.created_at` — the column whose absence stopped
 * the CI reset on main @ 91004d1 — does not exist. Ownership is the part that matters.
 */
function tableBody(table: string): string | null {
  const m = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i').exec(schema);
  return m?.[2] ?? null;
}

/**
 * Does a migration declare this column ON THIS TABLE?
 *
 * Two ways a column legitimately arrives: in the `create table` body, or in a later
 * `alter table … add column`. `bill.discount_type` came the second way, so a check that read
 * only the create body would call a real column missing.
 */
function declaresColumnOn(table: string, column: string): boolean {
  const body = tableBody(table);
  if (body !== null && new RegExp(`^\\s*${column}\\s+\\w`, 'm').test(body)) return true;

  for (const alter of schema.matchAll(new RegExp(`alter\\s+table\\s+(?:only\\s+)?public\\.${table}\\b([\\s\\S]*?);`, 'gi'))) {
    if (new RegExp(`add\\s+column\\s+(if\\s+not\\s+exists\\s+)?${column}\\b`, 'i').test(alter[1] ?? '')) return true;
  }
  return false;
}

test('the migrations were actually read — a rung that parsed nothing is not a passing rung', () => {
  // Binding rule 3: a detector that parsed nothing reports BLOCKED, never success. A glob that
  // silently matched zero files would make every assertion below vacuously true.
  expect(schema.length, 'concatenated migrations').toBeGreaterThan(5000);
  expect(declaresColumn('captain_staff_id'), 'a column known to exist').toBe(true);
  expect(declaresColumn('no_such_column_anywhere'), 'and one known not to').toBe(false);
});

test('every bill column the app writes by name exists in the schema', () => {
  // THE defect. Before the fix this failed on `captain_id`.
  for (const [role, column] of Object.entries(BILL_STAFF_COLUMN)) {
    expect(declaresColumn(column), `${role} → bill.${column} must be declared by a migration`).toBe(true);
  }
});

test('the two roles map to two different columns', () => {
  // A copy-paste that pointed both at the captain's column would silently reassign the wrong
  // person, and the audit line would say it had done the right thing.
  expect(BILL_STAFF_COLUMN.captain).not.toBe(BILL_STAFF_COLUMN.waiter);
});

test('discount_type is declared — the column whose absence broke bill closure in production', () => {
  // `closeBill` writes this on EVERY closure, discounted or not. It shipped before its migration
  // was applied and PostgREST rejected the update. The rung is the migration file existing at
  // all; whether it has been APPLIED to a given database is a deployment question no unit spec
  // can answer, and that gap is recorded in the request file rather than pretended away.
  expect(declaresColumn('discount_type')).toBe(true);
});

test('the other columns this run added writes for are all real', () => {
  // Swept once, by hand, against the live schema on 12-Sep-2026; pinned here so the sweep does
  // not have to be repeated from memory.
  for (const column of ['released_at', 'staff_id', 'settled_at', 'table_id', 'payment_requested_at']) {
    expect(declaresColumn(column), `${column} must be declared by a migration`).toBe(true);
  }
});

/* ---------------------------------------------------------------------------------------------
 * TABLE-AWARE (14-Sep-2026)
 *
 * Everything above asks whether a NAME exists in the schema. That question cannot fail for a
 * common column, so it could never have caught the defect that stopped CI on main @ 91004d1:
 * `scripts/reset-test-db.mjs` filtered six tables on `created_at`, and `audit_entry` timestamps
 * with `at`. `declaresColumn('created_at')` is true — fifteen tables have one — while
 * `audit_entry.created_at` does not exist. The assertions below ask the owning question.
 *
 * FAIL-FIRST EVIDENCE (14-Sep-2026):
 *   OBSERVED FAILING — `declaresColumnOn` aliased to the old table-blind `declaresColumn`, run
 *   against this same tree: **2 failed** — `audit_entry.created_at must NOT be declared · expected
 *   false, received true` and `no table in the reset list may be filtered on a column it does not
 *   have · audit_entry.created_at · expected false, received true`. That is the defect, seen by
 *   the rung that did not exist when it shipped.
 * ------------------------------------------------------------------------------------------- */

test('the table-aware parse actually parsed — ownership, not just presence', () => {
  // Binding rule 3 again, for the second parser in this file: a regex that matched no table body
  // would make every `toBe(false)` below vacuously true, which is the shape of a check that
  // silently stopped checking.
  expect(tableBody('audit_entry'), 'audit_entry create-table body').not.toBeNull();
  expect(tableBody('bill'), 'bill create-table body').not.toBeNull();
  expect(tableBody('no_such_table'), 'and a table known not to exist').toBeNull();
  expect(declaresColumnOn('bill', 'created_at'), 'a column known to be on bill').toBe(true);
  expect(declaresColumnOn('bill', 'no_such_column'), 'and one known not to be').toBe(false);
});

test('audit_entry timestamps with `at`, and has no `created_at` — the CI reset defect', () => {
  // THE defect, both directions. `at` is deliberate (core schema: "Standard 6.1: what changed,
  // when - date AND time"), and `src/lib/db/queries.ts` selects and orders by it.
  expect(declaresColumnOn('audit_entry', 'at'), 'audit_entry.at must be declared').toBe(true);
  expect(declaresColumnOn('audit_entry', 'created_at'), 'audit_entry.created_at must NOT be declared').toBe(false);

  // And the reason the old check could not see it: the name is everywhere.
  expect(declaresColumn('created_at'), 'created_at exists SOMEWHERE — which is why presence is not ownership').toBe(true);
});

test('no table in the reset list may be filtered on a column it does not have', () => {
  // scripts/reset-test-db.mjs deletes these six. It now filters on `id`, which every one of them
  // has; this pins BOTH halves of that claim — that `id` is universal here, and that `created_at`
  // is not — so the next person who reaches for a timestamp filter is told which tables it breaks.
  const RESET_TABLES = ['bill', 'guest_session', 'table_request', 'suggestion', 'print_job', 'audit_entry'];

  for (const table of RESET_TABLES) {
    expect(declaresColumnOn(table, 'id'), `${table}.id — the reset's delete predicate`).toBe(true);
  }

  expect(declaresColumnOn('audit_entry', 'created_at'), 'audit_entry.created_at').toBe(false);
  for (const table of RESET_TABLES.filter((t) => t !== 'audit_entry')) {
    expect(declaresColumnOn(table, 'created_at'), `${table}.created_at`).toBe(true);
  }
});

test('every bill column the app writes by name exists ON THE BILL TABLE', () => {
  // The 12-Sep defect, re-asserted with ownership. `captain_id` would now fail even if some other
  // table happened to have a column by that name.
  for (const [role, column] of Object.entries(BILL_STAFF_COLUMN)) {
    expect(declaresColumnOn('bill', column), `${role} → bill.${column}`).toBe(true);
  }
  expect(declaresColumnOn('bill', 'captain_id'), 'the name that shipped, which bill does not have').toBe(false);
  expect(declaresColumnOn('bill', 'waiter_id'), 'likewise').toBe(false);

  // Arrived by `alter table … add column`, not in the create body — the case a create-body-only
  // parser would call missing.
  expect(declaresColumnOn('bill', 'discount_type'), 'bill.discount_type').toBe(true);
  expect(declaresColumnOn('bill', 'payment_requested_at'), 'bill.payment_requested_at').toBe(true);
});

test('the hand-swept columns are on the tables the application writes them to', () => {
  // The same sweep as above, but naming the owner. Mapped against the core schema on 14-Sep-2026.
  const OWNED: ReadonlyArray<readonly [string, string]> = [
    ['bill_table', 'released_at'],
    ['tip', 'staff_id'],
    ['tip', 'settled_at'],
    ['audit_entry', 'table_id'],
    ['bill', 'payment_requested_at'],
  ];
  for (const [table, column] of OWNED) {
    expect(declaresColumnOn(table, column), `${table}.${column}`).toBe(true);
  }
});
