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
