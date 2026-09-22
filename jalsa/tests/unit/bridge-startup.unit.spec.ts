/**
 * Bridge startup spec — what must be true before the first poll, and what is never logged.
 *
 * WHY STARTUP IS A FUNCTION THAT RETURNS PROBLEMS
 *   A bridge that comes up on a broken configuration, polls forever and prints nothing looks
 *   exactly like a bridge working in a restaurant with no orders. It is discovered during
 *   service, by paper that never arrives. `startup()` returns every problem at once, by name, so
 *   the whole of it is exercisable here rather than by starting a process and reading a log.
 *
 * FAIL-FIRST EVIDENCE (22-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { jsonLogger, run, startup, transportFor, type LogLine } from '../../bridge/src/main';
import { loadConfig, type BridgeConfig } from '../../bridge/src/config';
import type { CycleOutcome, LoopDeps } from '../../bridge/src/loop';
import type { JalsaApi } from '../../bridge/src/api';

const ENV = {
  JALSA_BRIDGE_API: 'http://localhost:3000/api/bridge',
  JALSA_BRIDGE_TOKEN: 'jbt_not_a_real_token_0123456789',
  JALSA_BRIDGE_LABEL: 'Kitchen PC',
  JALSA_BRIDGE_DESTINATIONS: 'KOT-TANDOOR=RP3160;KOT-VEG-01=RP3160-VEG',
  JALSA_BRIDGE_SPOOL_DIR: 'C:\\jalsa\\spool',
} as const;

const env = (over: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
  ...ENV,
  ...over,
});

const configFor = (over: Record<string, string | undefined> = {}): BridgeConfig => {
  const r = loadConfig(env(over));
  if (!r.ok) throw new Error(r.problems.join(' '));
  return r.config;
};

/* ── Choosing a transport ──────────────────────────────────────────────── */

test('the transport comes from configuration, never from the platform', () => {
  // A bridge that silently chose differently because of where it was running would be the one
  // configuration nobody could reason about from the log.
  expect(transportFor(configFor({ JALSA_BRIDGE_TRANSPORT: 'file' }), 'linux')).toMatchObject({ ok: true });
  expect(transportFor(configFor({ JALSA_BRIDGE_TRANSPORT: 'null' }), 'linux')).toMatchObject({ ok: true });
  expect(transportFor(configFor({ JALSA_BRIDGE_TRANSPORT: 'windows' }), 'win32')).toMatchObject({ ok: true });
});

test('each transport names itself, so a log says which one carried the ticket', () => {
  const names = (['file', 'null', 'windows'] as const).map((kind) => {
    const chosen = transportFor(configFor({ JALSA_BRIDGE_TRANSPORT: kind }), 'win32');
    return chosen.ok ? chosen.transport.name : 'refused';
  });
  expect(names).toEqual(['file', 'null', 'windows-spooler']);
});

test('the Windows transport is REFUSED on a host that is not Windows', () => {
  const chosen = transportFor(configFor({ JALSA_BRIDGE_TRANSPORT: 'windows' }), 'darwin');
  expect(chosen.ok).toBe(false);
  if (chosen.ok) return;
  expect(chosen.problems.join(' ')).toContain('this host is darwin');
  // And it says what to do instead, rather than only what is wrong.
  expect(chosen.problems.join(' ')).toContain('"file" for development');
});

test('an unknown transport name is refused by configuration, with the choices named', () => {
  const r = loadConfig(env({ JALSA_BRIDGE_TRANSPORT: 'bluetooth' }));
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.problems.join(' ')).toContain('file, null, windows');
});

test('a transport that must write refuses to start without somewhere to write', () => {
  const r = loadConfig(env({ JALSA_BRIDGE_SPOOL_DIR: undefined }));
  expect(r.ok).toBe(false);
  expect(!r.ok && r.problems.join(' ')).toContain('somewhere to write');

  // `null` writes nothing, so it does not need one.
  expect(loadConfig(env({ JALSA_BRIDGE_SPOOL_DIR: undefined, JALSA_BRIDGE_TRANSPORT: 'null' })).ok).toBe(true);
});

/* ── Startup ───────────────────────────────────────────────────────────── */

test('startup reports EVERY problem at once, not the first one', () => {
  // An operator fixing one variable per restart is an operator restarting four times.
  const started = startup({ JALSA_BRIDGE_TRANSPORT: 'file' }, { platform: 'linux' });
  expect(started.ok).toBe(false);
  if (started.ok) return;
  expect(started.problems.length).toBeGreaterThanOrEqual(4);
  const all = started.problems.join(' ');
  for (const named of ['JALSA_BRIDGE_API', 'JALSA_BRIDGE_TOKEN', 'JALSA_BRIDGE_LABEL', 'JALSA_BRIDGE_DESTINATIONS']) {
    expect(all, `${named} is named`).toContain(named);
  }
});

test('a Supabase credential in the environment stops the bridge starting', () => {
  // Gate 1's security model: bridge token only. A database credential on a kitchen PC means
  // somebody has misunderstood the deployment, and starting anyway would hide that.
  const started = startup(env({ SUPABASE_SECRET_KEY: 'sb_secret_should_not_be_here' }), { platform: 'win32' });
  expect(started.ok).toBe(false);
  expect(!started.ok && started.problems.join(' ')).toContain('never holds a database credential');
});

test('a good configuration starts, and serves exactly the machines it was given', () => {
  const started = startup(env({ JALSA_BRIDGE_TRANSPORT: 'file' }), { platform: 'linux' });
  expect(started.ok).toBe(true);
  if (!started.ok) return;

  expect(started.config.machineIds).toEqual(['KOT-TANDOOR', 'KOT-VEG-01']);
  expect(started.deps.transportFor('KOT-TANDOOR')).not.toBeNull();
  expect(started.deps.transportFor('KOT-VEG-01')).not.toBeNull();
  // A machine this PC does not serve gets NULL — never another machine's transport.
  expect(started.deps.transportFor('KOT-NV-01')).toBeNull();
  expect(started.deps.transportFor('')).toBeNull();
});

/* ── Logging ───────────────────────────────────────────────────────────── */

test('the startup line says what an operator needs and withholds the token', () => {
  const lines: LogLine[] = [];
  const started = startup(env({ JALSA_BRIDGE_TRANSPORT: 'file' }), {
    platform: 'linux',
    log: (f) => lines.push(f),
  });
  expect(started.ok).toBe(true);

  const start = lines.find((l) => l.event === 'bridge.starting');
  expect(start).toBeTruthy();
  expect(start?.transport).toBe('file');
  expect(start?.label).toBe('Kitchen PC');
  expect(start?.machines).toEqual(['KOT-TANDOOR', 'KOT-VEG-01']);
  expect(start?.token).toBe('withheld');
});

test('THE TOKEN NEVER REACHES A LOG, not even a prefix of it', () => {
  // A prefix pasted into a support thread is still a prefix of a live credential.
  const lines: LogLine[] = [];
  startup(env({ JALSA_BRIDGE_TRANSPORT: 'file' }), { platform: 'linux', log: (f) => lines.push(f) });

  const printed = JSON.stringify(lines);
  expect(printed).not.toContain(ENV.JALSA_BRIDGE_TOKEN);
  for (let cut = 8; cut <= ENV.JALSA_BRIDGE_TOKEN.length; cut += 4) {
    expect(printed, `not even the first ${cut} characters`).not.toContain(ENV.JALSA_BRIDGE_TOKEN.slice(0, cut));
  }
});

test('a log line is one line of JSON, with a timestamp', () => {
  // Read at a distance, usually pasted into a message. A pretty-printed structure does not
  // survive that; one object per line does.
  const written: string[] = [];
  const log = jsonLogger((l) => written.push(l), { now: () => '2026-09-22T00:00:00.000Z' });
  log({ event: 'bridge.cycle', line: 'job=1' });

  expect(written).toHaveLength(1);
  expect(written[0]).not.toContain('\n');
  expect(JSON.parse(written[0] as string)).toEqual({
    at: '2026-09-22T00:00:00.000Z',
    event: 'bridge.cycle',
    line: 'job=1',
  });
});

/* ── Shutdown ──────────────────────────────────────────────────────────── */

function countingDeps(cycles: { value: number }): LoopDeps {
  const api: JalsaApi = {
    list: async () => {
      cycles.value += 1;
      return [];
    },
    claim: async () => ({ claimed: false, job: null, payload: null, renderError: null }),
    report: async () => ({ applied: false }),
  };
  return {
    config: configFor({ JALSA_BRIDGE_TRANSPORT: 'null' }),
    api,
    transportFor: () => null,
  };
}

test('a stop signal ends the loop rather than killing a ticket mid-flight', async () => {
  // A bridge killed between its transport call and its report leaves a job in `processing` that
  // nobody can adjudicate. Finishing the cycle avoids paying the sweeper's price on every restart.
  const cycles = { value: 0 };
  const lines: LogLine[] = [];
  let stop: (() => void) | null = null;

  const finished = run(countingDeps(cycles), { onStop: (h) => (stop = h) }, (f) => lines.push(f));
  // Let a cycle or two happen, then ask it to stop.
  await new Promise((r) => setTimeout(r, 30));
  (stop as unknown as () => void)();
  await finished;

  expect(lines.map((l) => l.event)).toContain('bridge.stopping');
  expect(lines.map((l) => l.event)).toContain('bridge.stopped');
  const at = cycles.value;
  await new Promise((r) => setTimeout(r, 30));
  expect(cycles.value, 'no cycle runs after the loop returned').toBe(at);
});

test('a second signal is not a second shutdown', async () => {
  const lines: LogLine[] = [];
  let stop: (() => void) | null = null;
  const finished = run({ ...countingDeps({ value: 0 }) }, { onStop: (h) => (stop = h) }, (f) => lines.push(f));

  (stop as unknown as () => void)();
  (stop as unknown as () => void)();
  (stop as unknown as () => void)();
  await finished;

  expect(lines.filter((l) => l.event === 'bridge.stopping')).toHaveLength(1);
});

test('the process registers the signals a Windows service actually receives', () => {
  const source = readFileSync('bridge/src/main.ts', 'utf8');
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    expect(source, `${signal} is handled`).toContain(signal);
  }
  // And a refused startup exits non-zero: a service manager that sees 0 will not restart it, and
  // the restaurant gets a bridge that is not running and not complaining.
  expect(source).toContain('process.exit(2)');
});
