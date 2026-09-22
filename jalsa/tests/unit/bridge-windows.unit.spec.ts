/**
 * WindowsSpoolerTransport spec — the queue, and the exact boundary of what it can claim.
 *
 * THE LINE THIS FILE HOLDS
 *   Every rung below exercises a SIMULATED spooler. Not one of them is evidence that a TVS RP3160
 *   printed anything, and the last rung in this file exists to say so in a way that cannot be
 *   skimmed past. Paper is Gate 7, on real hardware, and no amount of green here moves that.
 *
 *   What IS proved: the bytes staged for the spooler are the encoder's bytes; a non-zero exit is
 *   a failure and never a success; a hung command is a failure that says nothing can be known; a
 *   queue name that is not a queue name is refused before any process starts.
 *
 * WHY THE COMMAND IS INJECTED
 *   `copy /b` only runs on Windows. Wired directly, every failure path in this transport would be
 *   testable nowhere, which is the same as not existing. The rule lives in the transport; the
 *   spawn is `windowsCopyCommand`, and it is swapped here.
 *
 * FAIL-FIRST EVIDENCE (22-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';
import {
  WindowsSpoolerTransport,
  windowsCopyCommand,
  type SpoolerCommand,
  type SpoolerRun,
} from '../../bridge/src/transport/windows';
import { failed, succeeded, type TransportTarget } from '../../bridge/src/transport/types';

const dirs: string[] = [];
const sandbox = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'jalsa-spool-'));
  dirs.push(d);
  return d;
};
test.afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const target = (over: Partial<TransportTarget> = {}): TransportTarget => ({
  machineId: 'KOT-TANDOOR',
  jobId: 'job_1',
  destination: '\\\\localhost\\RP3160',
  ...over,
});

const OK: SpoolerRun = { code: 0, stdout: '1 file(s) copied.', stderr: '', timedOut: false };

/** Records what it was asked to do, and what was in the file at that moment. */
function recorder(result: SpoolerRun = OK): {
  command: SpoolerCommand;
  calls: Array<{ file: string; destination: string; timeoutMs: number; bytes: Uint8Array | null }>;
} {
  const calls: Array<{ file: string; destination: string; timeoutMs: number; bytes: Uint8Array | null }> = [];
  return {
    calls,
    command: async (input) => {
      let bytes: Uint8Array | null = null;
      try {
        bytes = new Uint8Array(await readFile(input.file));
      } catch {
        bytes = null;
      }
      calls.push({ ...input, bytes });
      return result;
    },
  };
}

const transport = (tempDir: string, command: SpoolerCommand, timeoutMs = 5_000): WindowsSpoolerTransport =>
  new WindowsSpoolerTransport({ command, tempDir, timeoutMs });

const TICKET = encodeTicket(
  [
    { text: 'JALSA', weight: 'big' },
    { text: 'KOT-113', weight: 'bold' },
    { text: '2 x Paneer Tikka', weight: 'plain' },
  ],
  DEFAULT_ENCODER
);

/* ── The bytes that reach the queue ────────────────────────────────────── */

test('the spooler is handed the encoder\u2019s bytes, exactly', async () => {
  const dir = sandbox();
  const rec = recorder();
  const result = await transport(dir, rec.command).send(TICKET, target());

  expect(succeeded(result)).toBe(true);
  expect(rec.calls).toHaveLength(1);
  expect(rec.calls[0]?.bytes).not.toBeNull();
  expect(hex(rec.calls[0]?.bytes as Uint8Array)).toBe(hex(TICKET));
});

test('all 256 byte values survive staging', async () => {
  // The whole reason `copy /b` exists. A text-mode path stops at 0x1A and rewrites line endings,
  // which on an ESC/POS stream is a truncated ticket that still prints something.
  const dir = sandbox();
  const rec = recorder();
  const every = Uint8Array.from({ length: 256 }, (_, i) => i);
  await transport(dir, rec.command).send(every, target());

  expect(Array.from(rec.calls[0]?.bytes as Uint8Array)).toEqual(Array.from(every));
});

test('the queue name and the timeout reach the command unchanged', async () => {
  const dir = sandbox();
  const rec = recorder();
  await transport(dir, rec.command, 1234).send(TICKET, target({ destination: 'RP3160' }));

  expect(rec.calls[0]?.destination).toBe('RP3160');
  expect(rec.calls[0]?.timeoutMs).toBe(1234);
  expect(rec.calls[0]?.file.endsWith('job_1.prn')).toBe(true);
});

test('the staged file is cleaned up, on success and on failure alike', async () => {
  for (const run of [OK, { code: 1, stdout: '', stderr: 'The network name cannot be found.', timedOut: false }]) {
    const dir = sandbox();
    await transport(dir, recorder(run).command).send(TICKET, target());
    expect(readdirSync(dir), `nothing left behind after exit ${run.code}`).toEqual([]);
  }
});

/* ── Success means the SPOOLER accepted it, and says so ────────────────── */

test('a success reports that the QUEUE accepted the job, never that it printed', async () => {
  // Windows queues happily for a printer that is switched off. A `detail` saying "printed" would
  // be the Phase 1 defect — a success nobody performed — arriving one layer further down.
  const result = await transport(sandbox(), recorder().command).send(TICKET, target());

  expect(succeeded(result)).toBe(true);
  if (!succeeded(result)) return;
  expect(result.detail).toContain('accepted by queue');
  expect(result.detail.toLowerCase()).not.toContain('printed');
  expect(result.detail.toLowerCase()).not.toContain('paper');
  expect(result.bytesSent).toBe(TICKET.length);
});

/* ── Failure ───────────────────────────────────────────────────────────── */

test('a non-zero exit is a failure, and it names the queue and the code', async () => {
  const result = await transport(sandbox(), recorder({
    code: 1,
    stdout: '',
    stderr: 'The network name cannot be found.',
    timedOut: false,
  }).command).send(TICKET, target({ destination: 'RP3160' }));

  expect(failed(result)).toBe(true);
  if (!failed(result)) return;
  expect(result.error).toContain('RP3160');
  expect(result.error).toContain('exit 1');
  expect(result.error).toContain('The network name cannot be found.');
  expect(result.retryable).toBe(true);
});

test('a hung spooler is a failure that admits nothing can be known', async () => {
  const result = await transport(sandbox(), recorder({
    code: null,
    stdout: '',
    stderr: '',
    timedOut: true,
  }).command, 250).send(TICKET, target());

  expect(failed(result)).toBe(true);
  if (!failed(result)) return;
  expect(result.error).toContain('did not answer');
  expect(result.error).toContain('250 ms');
  expect(result.error).toContain('Nothing can be said');
  expect(result.retryable).toBe(true);
});

test('a command that throws is a returned failure, never an escaped exception', async () => {
  const angry: SpoolerCommand = async () => {
    throw new Error('spawn ENOENT');
  };
  const result = await transport(sandbox(), angry).send(TICKET, target());

  expect(failed(result)).toBe(true);
  expect(failed(result) && result.error).toContain('failed unexpectedly');
  expect(failed(result) && result.error).toContain('spawn ENOENT');
});

test('an unstageable directory fails before any process starts', async () => {
  const dir = sandbox();
  const inTheWay = join(dir, 'occupied');
  writeFileSync(inTheWay, 'x');
  const rec = recorder();

  const result = await transport(inTheWay, rec.command).send(TICKET, target());

  expect(failed(result)).toBe(true);
  expect(failed(result) && result.error).toContain('could not stage');
  expect(rec.calls, 'the spooler was never asked').toEqual([]);
});

/* ── What it refuses to hand to a command line ─────────────────────────── */

for (const destination of [
  '',
  'RP3160 & del /q C:\\*',
  'RP3160 | more',
  'RP3160 > out.txt',
  'RP3160"',
  'RP3160\nSECOND',
  '../../windows/system32',
  'a'.repeat(201),
]) {
  test(`the queue name ${JSON.stringify(destination)} is refused before anything is spawned`, async () => {
    const rec = recorder();
    const result = await transport(sandbox(), rec.command).send(TICKET, target({ destination }));

    expect(failed(result)).toBe(true);
    expect(failed(result) && result.error).toContain('not a printer share');
    expect(failed(result) && result.retryable, 'nothing about retrying fixes a malformed name').toBe(false);
    expect(rec.calls, 'no process was started').toEqual([]);
  });
}

for (const destination of ['RP3160', 'TVS RP3160', '\\\\localhost\\RP3160', '\\\\PC-KITCHEN\\TVS_RP3160']) {
  test(`the queue name ${JSON.stringify(destination)} is accepted`, async () => {
    const rec = recorder();
    const result = await transport(sandbox(), rec.command).send(TICKET, target({ destination }));
    expect(succeeded(result)).toBe(true);
    expect(rec.calls[0]?.destination).toBe(destination);
  });
}

test('a job id that is not a filename is refused rather than sanitised', async () => {
  const rec = recorder();
  const result = await transport(sandbox(), rec.command).send(TICKET, target({ jobId: '../../etc/passwd' }));

  expect(failed(result)).toBe(true);
  expect(failed(result) && result.error).toContain('used as a filename');
  expect(rec.calls).toEqual([]);
});

/* ── The result shape, same contract as every other transport ──────────── */

test('nothing in the result could name a different printer', async () => {
  for (const run of [OK, { code: 1, stdout: '', stderr: 'x', timedOut: false }]) {
    const result = await transport(sandbox(), recorder(run).command).send(TICKET, target());
    expect(Object.keys(result).sort()).toEqual(
      result.ok ? ['bytesSent', 'detail', 'ok'] : ['error', 'ok', 'retryable']
    );
  }
});

/* ── The real command, on a host that is not Windows ───────────────────── */

test('the real command refuses a non-Windows host as a VALUE, not a crash', async () => {
  // This suite runs on Linux. The command must come back with a run that names the platform
  // rather than dying on a missing `cmd.exe`, or the transport's own error handling never sees it.
  const run = await windowsCopyCommand({ file: '/tmp/nothing.prn', destination: 'RP3160', timeoutMs: 1000 });

  expect(run.code).toBeNull();
  expect(run.timedOut).toBe(false);
  expect(run.stderr).toContain('needs Windows');
  expect(run.stderr).toContain(process.platform);
});

test('the real command uses copy /b, and passes its arguments as an array', () => {
  // `/b` is load-bearing: without it `copy` runs in text mode, stops at the first 0x1A and
  // translates line endings. And an argv array is what keeps a queue name from becoming a second
  // command, alongside the whitelist above.
  const source = readFileSync('bridge/src/transport/windows.ts', 'utf8');
  expect(source).toContain("spawn('cmd.exe', ['/c', 'copy', '/b', file, destination]");
  expect(source).toContain('shell: false');
});

/* ── The line this file will not cross ─────────────────────────────────── */

test('NOTHING IN THIS FILE IS EVIDENCE THAT A PRINTER PRINTED', () => {
  // Deliberately a rung and not a comment. Every spooler in this spec is a function that returns
  // an object; no byte has left this machine. When Gate 7 runs against a real RP3160 it will
  // record that separately, and this rung is the marker that says the two are not the same claim.
  // The transport's own success sentence must stay carefully worded, and its header must keep
  // saying what a success is worth. Both are what a reader meets before the code.
  const transportSource = readFileSync('bridge/src/transport/windows.ts', 'utf8');
  expect(transportSource).toContain('accepted by queue');
  expect(transportSource).toContain('It does not mean paper came out');
});
