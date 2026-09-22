/**
 * module-access unit spec - the branches behind the RBAC grant editor.
 *
 * FAIL-FIRST EVIDENCE: the same assertions were executed against the esbuild-compiled
 * actual lib on 05-Sep-2026 (all passed), and a deliberately inverted alwaysOn/deny
 * assertion was observed FAILING - the guard fires. See the v1.14.0 commit message.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isSchemaFault, SCHEMA_FAULT_MESSAGE } from '../../src/lib/db-errors';
import {
  applyPreset, changedCount, emptyGrants, sectionCount, toggleGrant,
  type SectionDef,
} from '../../src/lib/module-access';

const section: SectionDef = {
  id: 's1',
  label: 'Alpha',
  capabilities: [
    { id: 'a1', label: 'View' },
    { id: 'a2', label: 'Edit', confidential: true },
    { id: 'a3', label: 'Delete' },
  ],
};
const presets = { Manager: ['a1', 'a2'] } as const;

test('deny-by-default: a fresh grant set is empty', () => {
  expect(emptyGrants().size).toBe(0);
});

test('a preset applies, and custom toggles edit on top of it', () => {
  let g = applyPreset(presets, 'Manager');
  expect([...g].sort()).toEqual(['a1', 'a2']);
  g = toggleGrant(toggleGrant(g, 'a3'), 'a1');
  expect([...g].sort()).toEqual(['a2', 'a3']);
});

test('re-applying a preset RESETS to the role - never a merge', () => {
  let g = toggleGrant(applyPreset(presets, 'Manager'), 'a3');
  g = applyPreset(presets, 'Manager');
  // A merge would have kept a3 - and an access reviewer reading "Manager preset"
  // would then be wrong about what the member actually has.
  expect([...g].sort()).toEqual(['a1', 'a2']);
});

test('an unknown preset yields empty grants, never a throw', () => {
  expect(applyPreset(presets, 'NoSuchRole').size).toBe(0);
});

test('section counts and the honest save label inputs', () => {
  const g = applyPreset(presets, 'Manager');
  expect(sectionCount(section, g)).toEqual({ granted: 2, total: 3 });
  expect(changedCount(new Set(['a1']), g)).toBe(1); // one addition
  expect(changedCount(g, emptyGrants())).toBe(2);   // removals count too
  expect(changedCount(g, g)).toBe(0);               // -> "No changes"
});

/*
 * ── PostgREST schema-fault codes (18-Sep-2026) ─────────────────────────────────────────────────
 *
 * `db-errors.ts` was written on 17-Sep-2026 so a stale schema is reported as "trying again will
 * not help" instead of "try again" - and it still did not fire, because it listed the DATABASE's
 * SQLSTATEs and the application does not talk to the database directly. PostgREST resolves an
 * overload or a missing column itself and answers with its own `PGRST***` code, which matched
 * nothing. So the owner was told to retry an action that can never succeed.
 *
 * Applying a migration fixes one fault. It does not fix the next stale schema, and there will be
 * one: the gap between a migration written and a migration applied is a permanent feature of
 * having environments. What must hold forever is that when it happens, the screen says so.
 *
 * APPENDED, not rewritten: every case above this line is untouched (test files are append-only).
 */
const read = (path: string): string => readFileSync(path, 'utf8');

/* ── THE ROOT CAUSE: a schema fault must never be reported as "try again" ──────────────────── */

test('PostgREST\'s own schema codes are recognised, not just the database\'s', () => {
  /*
    THE BUG, AS ONE ASSERTION. `PGRST203` is what supabase-js hands the application when two
    overloads exist — the 17-Sep fault, as it actually ARRIVES. Before this fix it matched
    nothing and the owner was told to retry.
  */
  expect(isSchemaFault({ code: 'PGRST203' }), 'ambiguous function, as PostgREST reports it').toBe(true);
  expect(isSchemaFault({ code: 'PGRST202' }), 'function missing from the schema cache').toBe(true);
  expect(isSchemaFault({ code: 'PGRST204' }), 'column missing from the schema cache').toBe(true);
});

test('the database\'s own SQLSTATEs still count, so nothing regressed', () => {
  for (const code of ['42725', '42883', '42703', '42P01']) {
    expect(isSchemaFault({ code }), `${code} must still be a schema fault`).toBe(true);
  }
});

test('a bad night on the network is still worth retrying, and is not swept in', () => {
  /* The value of this predicate is entirely in the two sets being DISJOINT. A serialization
     failure, a lock timeout or a dropped connection must keep the "try again" message, because
     for those it is true. */
  for (const code of ['40001', '55P03', '57014', 'PGRST301', 'ECONNRESET', '23505']) {
    expect(isSchemaFault({ code }), `${code} must NOT be called a schema fault`).toBe(false);
  }
  expect(isSchemaFault(null)).toBe(false);
  expect(isSchemaFault(new Error('boom')), 'an ordinary Error carries no code').toBe(false);
  expect(isSchemaFault({ message: 'no code here' })).toBe(false);
});

test('the sentence tells the owner the one thing they need: do not retry', () => {
  expect(SCHEMA_FAULT_MESSAGE).toContain('Trying again will not help');
  // And it names no identifier, no SQL and no code — the detail belongs in the log.
  expect(SCHEMA_FAULT_MESSAGE).not.toContain('PGRST');
  expect(SCHEMA_FAULT_MESSAGE).not.toContain('set_staff_pin');
});

/* ── The migration that has to reach the environment ───────────────────────────────────────── */

test('the drop-the-overload migration is still in the tree and still correct', () => {
  // It exists. Whether it has been APPLIED is an environment fact this tier cannot see — which
  // is exactly why the message above has to be right.
  const sql = read('supabase/migrations/20260917120000_jalsa_drop_ambiguous_set_staff_pin.sql');
  expect(sql).toContain('drop function');
  expect(sql).toContain('set_staff_pin');
});
