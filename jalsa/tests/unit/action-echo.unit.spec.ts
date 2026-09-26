/**
 * action-echo unit spec — a staff or owner action answers WITH the screen it changed.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 3): every tap on the captain's
 * phone or the owner's console answered `{ done: true }`, and the phone then made a SECOND request
 * to re-read the whole screen — another trip from India to the server, another sign-in check,
 * another full payload read, with the screen frozen in between. The guest surface stopped doing
 * this on 12-Sep (guest-echo.ts); `useLiveData.send` already applies a `state` that comes back.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md — run against the pre-fix tree before the change.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

interface Result {
  name: string;
  status: number;
  keys: string[];
  stateKeys: string[] | null;
  calls: number;
  rounds: number;
  answeredMs: number;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/actions.scenarios.ts', import.meta.url));
let results: Result[] = [];
const get = (name: string) => {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`scenario missing: ${name}`);
  return r;
};

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

test('the rig ran every scenario against the real route handlers', () => {
  expect(results.map((r) => r.name)).toEqual([
    'staff advance-kot',
    'staff advance-kot, screen build fails',
    'staff unknown action',
    'owner write-setting',
    'owner route, actor without the console grant',
    'removed captain',
    'staff advance-kot, screen build hangs',
    'currentStaff alone',
  ]);
  for (const r of results) expect(r.calls, r.name).toBeGreaterThan(0);
});

test('a staff action answers with its own result AND the staff screen', () => {
  const r = get('staff advance-kot');
  expect(r.status).toBe(200);
  expect(r.keys).toEqual(['done', 'state']);
  expect(r.stateKeys).toEqual(expect.arrayContaining(['bills', 'me', 'menu', 'requests']));
});

test('an owner action answers with the owner console', () => {
  const r = get('owner write-setting');
  expect(r.status).toBe(200);
  // SUPERSEDED 24-Sep-2026 (review of fix 3): was `toContain('state')`, which would not notice the
  // action's own result being dropped from the answer.
  expect(r.keys).toEqual(['done', 'state']);
  expect(r.stateKeys).toEqual(expect.arrayContaining(['floor', 'settings']));
});

test('a write that succeeded is never reported as failed because the screen could not be built', () => {
  const r = get('staff advance-kot, screen build fails');
  expect(r.status).toBe(200);
  expect(r.keys).toEqual(['done']); // no state: the phone falls back to reading it, as before
});

test('a refused action carries no state', () => {
  const r = get('staff unknown action');
  expect(r.status).toBe(400);
  expect(r.keys).not.toContain('state');
});

test('who is signed in, and what they may do, is one round, not two', () => {
  const r = get('currentStaff alone');
  expect(r.status).toBe(200);
  expect(r.keys).toEqual(['orders.status', 'orders.view', 'tables.view']);
  expect(r.rounds).toBe(1);
});

/* ── added 24-Sep-2026, review of latency fix 3 ───────────────────────────── */

test('the owner console is echoed only to someone who may open it', () => {
  const r = get('owner route, actor without the console grant');
  expect(r.status, 'the write itself is theirs to make').toBe(200);
  expect(r.keys).toEqual(['done']);
});

test('a removed person is signed out, grants or no grants', () => {
  expect(get('removed captain').status).toBe(401);
  expect(get('removed captain').keys).not.toContain('state');
});

test('a screen that will not build in time never holds up — or fails — a write that succeeded', () => {
  const r = get('staff advance-kot, screen build hangs');
  expect(r.status).toBe(200);
  expect(r.keys).toEqual(['done']);
  expect(r.answeredMs, 'answered at the deadline, not when the stalled read gave up').toBeLessThan(4000);
});
