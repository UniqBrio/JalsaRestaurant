/**
 * outage unit spec — when the database cannot answer, the screen says so within about 2 s.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 5): the client library retried a
 * failed read three times (1 s + 2 s + 4 s), so a guest waited ~7 s (measured 7.03–7.17 s) before
 * the designed "unavailable" screen. Runs the REAL `@/lib/supabase/server` client.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

interface Outcome {
  readMs: number;
  readFailed: boolean;
  writePendingAfter3s: boolean | null;
}

const SCENARIO = fileURLToPath(new URL('../support/rounds/outage.scenarios.ts', import.meta.url));

test('a database that refuses connections fails a read at once, not after seven seconds of retries', async () => {
  const r = await runScenario<Outcome>(SCENARIO, {
    realDb: true,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1' },
  });
  expect(r.readFailed).toBe(true);
  expect(r.readMs).toBeLessThan(1000);
});

test('a database that accepts and never answers fails a read at the 2 s deadline', async () => {
  const r = await runScenario<Outcome>(SCENARIO, {
    realDb: true,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54398', HANG_PORT: '54398' },
  });
  expect(r.readFailed).toBe(true);
  expect(r.readMs).toBeGreaterThanOrEqual(1900);
  expect(r.readMs).toBeLessThan(3000);
});

test('a write is never cut off by the read deadline — it may still commit', async () => {
  const r = await runScenario<Outcome>(SCENARIO, {
    realDb: true,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54397', HANG_PORT: '54397' },
  });
  expect(r.writePendingAfter3s).toBe(true);
});
