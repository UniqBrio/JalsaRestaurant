/**
 * No database function may end the migration sequence with two live signatures.
 *
 * WHY THIS FILE EXISTS
 *   On 17-Sep-2026 "Give them the app" and "Reissue PIN" both failed with a generic toast. The
 *   cause was two functions where there should have been one:
 *
 *     20260910071000  create or replace function set_staff_pin(p_staff uuid, p_pin text)
 *     20260910073000  create or replace function set_staff_pin(p_staff uuid, p_pin text,
 *                                                              p_provisional boolean default false)
 *
 *   `create or replace function` replaces a function with the SAME signature. A third parameter
 *   is a different signature, so the second statement created a SIBLING and left the original
 *   standing. Because the new parameter has a default, both were callable with two named
 *   arguments, and PostgREST — which resolves an RPC by the names in the body — could not
 *   choose. Observed on the test project:
 *
 *     ERROR 42725: function public.set_staff_pin(p_staff => uuid, p_pin => unknown) is not unique
 *
 *   The class is: **a migration widening a function's signature without dropping the narrow one.**
 *   Nothing in the pipeline could see it. `tsc` cannot — an RPC name is a string by the time
 *   PostgREST reads it. The build cannot. No unit spec touched it. It reached a user.
 *
 *   The author knew the hazard: line 90 of that very migration drops the old `verify_staff_pin`
 *   before widening it. The correct pattern was six lines of SQL away. A missed step is exactly
 *   what a rung is for.
 *
 * WHAT IT READS
 *   The migration files, in filename order — the only description of the schema this repository
 *   owns. Not a live connection: the gate must run where there is no database.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026): run against the tree with
 *   `20260917120000_jalsa_drop_ambiguous_set_staff_pin.sql` removed — **2 failed, 1 passed**:
 *   `set_staff_pin ends the sequence with 2 live signatures: (p_staff uuid, p_pin text) and
 *   (p_staff uuid, p_pin text, p_provisional boolean default false)`, and the companion case
 *   naming the survivor. The third — "the parse found functions" — stayed green, correctly: the
 *   parse was never the thing that was broken. Restoring the migration returned all three to
 *   green, which is the whole of the fix stated as a measurement.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/* Relative to the app root, matching `schema-columns.unit.spec.ts`. Playwright runs from there,
 * and `__dirname` does not exist in this ES-module scope. */
const DIR = 'supabase/migrations';

/** Normalised so `uuid` and ` UUID ` are the same argument list. Defaults are kept — they are
 *  what made the two candidates ambiguous, so a reader of a failure needs to see them. */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

interface Live { name: string; args: string }

function liveFunctions(): Live[] {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  expect(files.length, 'the migration directory must not be empty — a parse of nothing is not a pass').toBeGreaterThan(5);

  const live = new Map<string, Live>();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');

    // Lines are stripped so a signature quoted inside a comment — as this very spec's header
    // does — is never mistaken for a declaration.
    const code = sql
      .split('\n')
      .filter((l) => !/^\s*(--|\*|\/\*)/.test(l))
      .join('\n');

    for (const m of code.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(([^)]*)\)/gi)) {
      const name = m[1]!.toLowerCase();
      const args = norm(m[2] ?? '');
      live.set(`${name}(${args})`, { name, args });
    }
    for (const m of code.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)\s*\(([^)]*)\)/gi)) {
      const name = m[1]!.toLowerCase();
      const dropped = norm(m[2] ?? '');
      // A drop names TYPES; a create names `name type [default x]`. Match on the types.
      for (const key of [...live.keys()]) {
        const v = live.get(key)!;
        if (v.name !== name) continue;
        const types = v.args
          .split(',')
          .map((a) => a.trim().split(/\s+/).slice(1).join(' ').replace(/\s*default\s+.*$/, '').trim())
          .join(', ');
        if (types === dropped) live.delete(key);
      }
    }
  }
  return [...live.values()];
}

test('THE PARSE FOUND FUNCTIONS — a sweep that matched nothing is not a clean schema', () => {
  const fns = liveFunctions();
  expect(fns.length, 'no CREATE FUNCTION was parsed out of the migrations').toBeGreaterThan(3);
});

test('no function ends the migration sequence with two live signatures', () => {
  const byName = new Map<string, string[]>();
  for (const f of liveFunctions()) byName.set(f.name, [...(byName.get(f.name) ?? []), f.args]);

  const overloaded = [...byName.entries()]
    .filter(([, sigs]) => sigs.length > 1)
    .map(([name, sigs]) => `${name} ends the sequence with ${sigs.length} live signatures: ${sigs.map((s) => `(${s})`).join(' and ')}`);

  // An overload is not illegal in Postgres. It is illegal HERE because every one of these is
  // reached through PostgREST by NAME, and two candidates that both accept the same named
  // arguments cannot be told apart — which is a 42725 in a user's face, not a design choice.
  expect(overloaded, 'widen a function by DROPPING the narrow signature first, as verify_staff_pin does').toEqual([]);
});

test('set_staff_pin specifically survives as the three-argument form', () => {
  // Named because it is the one that failed, and because the survivor matters: only the wide
  // form can set `pin_provisional`, which is what makes guardrail 5 true — an issued PIN opens
  // "choose your own PIN" and nothing else.
  const sigs = liveFunctions().filter((f) => f.name === 'set_staff_pin');
  expect(sigs).toHaveLength(1);
  expect(sigs[0]!.args).toContain('p_provisional');
});

/* ── The advice the screen gives when the schema and the code disagree ──────
 * Separate from the parse above: that one guards the migrations, this one guards the sentence a
 * person reads. Both exist because the same incident produced both defects — an ambiguous
 * function, and a screen telling the owner to try again at something that could never succeed. */
import { isSchemaFault } from '../../src/lib/db-errors';

test('a PostgREST ambiguity is recognised as a schema fault, not a transient one', () => {
  // The exact shape supabase-js throws: a plain object, not an Error.
  expect(isSchemaFault({ code: '42725', message: 'function is not unique' })).toBe(true);
  expect(isSchemaFault({ code: '42883', message: 'function does not exist' })).toBe(true);
  expect(isSchemaFault({ code: '42703', message: 'column does not exist' })).toBe(true);
  expect(isSchemaFault({ code: '42P01', message: 'relation does not exist' })).toBe(true);
});

test('a genuinely transient failure still gets "try again" — the advice must stay true both ways', () => {
  expect(isSchemaFault({ code: '57014', message: 'canceling statement due to timeout' })).toBe(false);
  expect(isSchemaFault(new Error('socket hang up'))).toBe(false);
  expect(isSchemaFault(null)).toBe(false);
  expect(isSchemaFault(undefined)).toBe(false);
  expect(isSchemaFault('a string')).toBe(false);
});
