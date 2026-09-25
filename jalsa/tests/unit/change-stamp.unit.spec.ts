/**
 * change-stamp unit spec — a poll that finds nothing changed costs one round and builds nothing.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 4): every tick of every open
 * screen re-read its whole world — 10–29 database calls — to learn, nearly always, that nothing
 * had happened. Runs the REAL state routes against tests/support/fake-supabase.ts.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

interface Tick {
  name: string;
  status: number;
  stamp: string | null;
  unchanged: boolean;
  fullScreen: boolean;
  calls: number;
  rounds: number;
  tables: string[];
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/polling.scenarios.ts', import.meta.url));
let ticks: Tick[] = [];
const get = (name: string) => {
  const t = ticks.find((x) => x.name === name);
  if (!t) throw new Error(`scenario missing: ${name}`);
  return t;
};

test.beforeAll(async () => {
  ticks = await runScenario<Tick[]>(SCENARIOS);
});

test('every full screen carries the stamp to send back', () => {
  for (const name of ['staff full', 'owner full', 'guest full']) {
    expect(get(name).fullScreen, name).toBe(true);
    expect(get(name).stamp, name).toBeTruthy();
  }
});

test('when nothing moved, a tick is one round, a handful of calls, and no screen', () => {
  for (const [name, maxCalls] of [
    ['staff tick, nothing moved', 3],
    ['owner tick, nothing moved', 3],
    ['guest tick, nothing moved', 2],
  ] as const) {
    const t = get(name);
    expect(t.unchanged, name).toBe(true);
    expect(t.rounds, name).toBe(1);
    expect(t.calls, name).toBeLessThanOrEqual(maxCalls);
  }
});

test('a change is never answered "unchanged"', () => {
  for (const name of ['staff tick, floor moved', 'guest tick, own bill moved', 'guest tick, menu moved']) {
    expect(get(name).fullScreen, name).toBe(true);
  }
});

test("another table's business does not make a guest phone re-read", () => {
  expect(get('guest tick, only the floor moved').unchanged).toBe(true);
});

test('the identity check still runs on every tick: a removed person is refused, not told "unchanged"', () => {
  expect(get('removed captain tick').status).toBe(401);
});

test('a database the migration has not reached yet still gets full screens', () => {
  for (const name of ['staff, no migration', 'guest, no migration']) {
    expect(get(name).fullScreen, name).toBe(true);
    expect(get(name).stamp, name).toBeNull();
  }
});

/* ── the migration covers what the screens read ─────────────────────────── */

const APP = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string) => readFileSync(`${APP}/${p}`, 'utf8');
const MIGRATION = read('supabase/migrations/20260924120000_jalsa_change_versions.sql');

/** Tables deliberately left out of the counters, and why. Adding one here is a decision. */
const EXCLUDED: Record<string, string> = {
  bridge_discovered_printer: 'rewritten on every bridge sync; printer health catches up on the periodic full read',
  number_series: 'moves only alongside a bill or KOT insert, which already moves the counter',
  change_version: 'the counters themselves',
};

test('every table a polled screen reads moves a counter, or is excluded on purpose', () => {
  const sources = ['queries', 'guest', 'guest-view', 'staff-view', 'owner-view', 'mutations'].map((f) =>
    read(`src/lib/db/${f}.ts`)
  );
  const readTables = new Set(
    sources.flatMap((src) => [...src.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1] ?? ''))
  );
  expect(readTables.size, 'the scan found the data layer').toBeGreaterThan(15);
  const covered = new Set([
    ...[...MIGRATION.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? ''),
    ...[...MIGRATION.matchAll(/on public\.([a-z_]+)/g)].map((m) => m[1] ?? ''),
  ]);
  const missing = [...readTables].filter((t) => !covered.has(t) && !(t in EXCLUDED));
  expect(missing, 'a table no counter watches is a screen that never updates').toEqual([]);
});

// SUPERSEDED 24-Sep-2026: this pinned the first migration's `update of <columns>` triggers. Those
// fire whenever a column is in the SET list, and the bridge's sync rewrites `hostname` and
// `bridge_version` unchanged on every call — the floor counter moved ten times in minutes on
// development. 20260924130000 replaces them with row triggers that fire only on a real difference.
const CORRECTION = read('supabase/migrations/20260924130000_jalsa_change_versions_exact.sql');

test('a heartbeat that rewrites an unchanged value moves nothing', () => {
  for (const col of ['label', 'revoked_at', 'source', 'hostname', 'bridge_version']) {
    expect(CORRECTION, col).toContain(`old.${col} is distinct from new.${col}`);
  }
  for (const col of ['table_id', 'bill_id', 'heard_about']) {
    expect(CORRECTION, col).toContain(`old.${col} is distinct from new.${col}`);
  }
  expect(CORRECTION).not.toMatch(/last_seen_at|last_sync_at/);
  expect(CORRECTION).toContain('drop trigger if exists bridge_token_bump_floor on public.bridge_token');
  expect(CORRECTION).toContain('drop trigger if exists guest_session_bump_floor on public.guest_session');
});
