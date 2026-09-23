/**
 * Service spec — a paired computer, end to end, against a Jalsa that is a real HTTP server.
 *
 * WHAT IS REAL
 *   `HttpJalsaApi` over real `fetch` to a real `node:http` server in this process; `servePaired`;
 *   `runCycle`; `composeTicket`, `encodeTicket`; `FileTransport` writing real bytes. The server is
 *   an in-memory stand-in for `bridge-mutations.ts` with the same three conditions (claim on
 *   queued, report on processing-and-mine, sync answers only the mapping) — so bridge
 *   authentication, reconnection after an outage, revocation, and the mapping lookup are all
 *   exercised over the wire rather than reasoned about.
 *
 * WHAT IS NOT: Postgres, and Windows. The Windows queue transport is exercised through the
 *   injected runner in this file's last rungs.
 *
 * FAIL-FIRST EVIDENCE (23-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';
import type { TicketLine } from '../../src/lib/print-template';
import { composeTicket } from '../../src/lib/ticket-compose';
import { HttpJalsaApi, type Assignment } from '../../bridge/src/api';
import type { PairedConfig } from '../../bridge/src/paired-config';
import { SERVICE_NOTES, configFromAssignments, servePaired, type ServiceDeps, type ServiceStatus } from '../../bridge/src/service';
import { FileTransport } from '../../bridge/src/transport/file';
import { WindowsSpoolerTransport } from '../../bridge/src/transport/windows';
import { windowsQueueCommand, windowsQueueTransport } from '../../bridge/src/transport/windows-queue';
import { failed, succeeded } from '../../bridge/src/transport/types';
import type { ScriptRun } from '../../bridge/src/windows/powershell';

/* ── A Jalsa, in memory, on a port ─────────────────────────────────────── */

const TOKEN = 'jbt_' + 'd'.repeat(64);
const TANDOOR = { printerId: 'p-tan', machineId: 'KOT-TANDOOR', printerName: 'Tandoor Printer', queueName: 'TVS-RP3160' };

function linesFor(): { lines: TicketLine[] } {
  const r = composeTicket({
    job: { id: 'j', kind: 'kot', printerId: 'p-tan', station: 'Tandoor', foodSide: 'all', isReprint: false },
    width: '80',
    template: {},
    printers: [{ id: 'p-tan', machineId: 'KOT-TANDOOR', name: 'Tandoor Printer', purpose: 'KOT', station: 'Tandoor', routes: ['Tandoor'], online: false, enabled: true }],
    splitByFoodType: false,
    header: { restaurant: 'JALSA', branch: 'Hosur', phone: '', gstin: '—', kotCode: 'KOT-200', roundCode: 'R-1', billCode: 'B-1', table: 'T3', customer: '', captain: 'Guest phone', date: '23 Sep 2026', time: '7:00 PM', source: 'Guest phone', note: '' },
    items: [{ name: 'Paneer Tikka', qty: 1, foodType: 'veg', rate: 0, category: 'Tandoor', instruction: '' }],
  });
  if (!r.ok) throw new Error(r.blocked);
  return { lines: r.lines };
}

interface Job { id: string; machineId: string; printerId: string; status: string; claimedBy: string | null; lastError: string }

class FakeJalsa {
  jobs: Job[] = [];
  assignments: Assignment[] = [TANDOOR];
  syncs: Array<{ printers?: unknown; hostname: string }> = [];
  revoked = false;
  down = false;
  server!: Server;
  url = '';

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => {
        const json = (status: number, body: unknown): void => {
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        if (this.down) {
          req.socket.destroy();
          return;
        }
        if (req.headers.authorization !== `Bearer ${TOKEN}` || this.revoked) return json(401, { code: 'unauthorized' });
        const body = JSON.parse(raw) as Record<string, unknown>;
        switch (body.action) {
          case 'sync': {
            this.syncs.push({ printers: body.printers, hostname: String(body.hostname) });
            return json(200, { label: 'Kitchen PC', assignments: this.assignments });
          }
          case 'list': {
            const asked = body.machineIds as string[];
            // The server intersects with the mapping, as bridge-mutations does for a paired token.
            const allowed = asked.filter((m) => this.assignments.some((a) => a.machineId === m));
            return json(200, {
              jobs: this.jobs
                .filter((j) => j.status === 'queued' && allowed.includes(j.machineId))
                .map((j) => ({ id: j.id, kind: 'KOT', printerId: j.printerId, printerMachineId: j.machineId, printerName: 'x', station: 'Tandoor', isReprint: false, attempts: 0, createdAt: '2026-09-23T10:00:00Z' })),
            });
          }
          case 'claim': {
            const job = this.jobs.find((j) => j.id === body.jobId);
            const mapped = job && this.assignments.some((a) => a.printerId === job.printerId);
            if (!job || job.status !== 'queued' || !mapped) return json(200, { claimed: false, job: null, payload: null, renderError: null });
            job.status = 'processing';
            job.claimedBy = 'Kitchen PC';
            return json(200, {
              claimed: true,
              job: { id: job.id, kind: 'KOT', printerId: job.printerId, printerMachineId: job.machineId, printerName: 'x', station: 'Tandoor', isReprint: false, attempts: 0, createdAt: '' },
              payload: { lines: linesFor().lines, width: '80', itemCount: 1 },
              renderError: null,
            });
          }
          case 'report': {
            const job = this.jobs.find((j) => j.id === body.jobId);
            if (!job || job.status !== 'processing' || job.claimedBy !== 'Kitchen PC') return json(409, { code: 'not_claimed' });
            job.status = String(body.outcome);
            job.lastError = String(body.error ?? '');
            return json(200, { applied: true });
          }
          default:
            return json(400, { code: 'bad_action' });
        }
      });
    });
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/api/bridge`;
  }
  stop(): Promise<void> {
    return new Promise((r) => this.server.close(() => r()));
  }
}

const dirs: string[] = [];
const sandbox = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'jalsa-service-'));
  dirs.push(d);
  return d;
};
test.afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function bridge(jalsa: FakeJalsa, over: Partial<ServiceDeps> = {}): ServiceDeps & { logs: Array<Record<string, unknown>>; statuses: ServiceStatus[]; spool: string } {
  const spool = sandbox();
  const paired: PairedConfig = { version: 1, apiUrl: jalsa.url, token: TOKEN, label: 'Kitchen PC', restaurantName: 'Jalsa', pairedAt: '' };
  const logs: Array<Record<string, unknown>> = [];
  const statuses: ServiceStatus[] = [];
  const config = configFromAssignments({ paired, assignments: [], transport: 'file', spoolDir: spool, pollMs: 1, maxBackoffMs: 4 });
  return {
    paired,
    api: new HttpJalsaApi(config),
    discover: async () => ({ ok: true, printers: [{ queueName: 'TVS-RP3160', driverName: 'TVS', portName: 'USB001', status: 'ready', isVirtual: false }] }),
    transport: new FileTransport({ directory: spool, humanReadable: false }),
    transportKind: 'file',
    spoolDir: spool,
    hostname: 'KITCHEN-PC',
    bridgeVersion: '2.0.0',
    log: (f) => logs.push(f),
    writeStatus: async (s) => {
      statuses.push(s);
    },
    logs,
    statuses,
    spool,
    ...over,
  };
}

const noSleep = { sleep: async () => undefined };

test('BRIDGE AUTHENTICATION: the token is sent as a bearer on every call and buys a sync, a list, a claim and a report', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    jalsa.jobs.push({ id: 'job-1', machineId: 'KOT-TANDOOR', printerId: 'p-tan', status: 'queued', claimedBy: null, lastError: '' });
    const b = bridge(jalsa);
    const history = await servePaired(b, { ...noSleep, iterations: 2, syncEveryMs: 60_000 });

    expect(history[0]?.synced).toBe(true);
    expect(jalsa.syncs[0]).toMatchObject({ hostname: 'KITCHEN-PC' });
    expect(jalsa.syncs[0]?.printers).toEqual([{ queueName: 'TVS-RP3160', driverName: 'TVS', portName: 'USB001', status: 'ready', isVirtual: false }]);

    // The job went the whole way: claimed, encoded, written by the FILE transport, reported.
    expect(jalsa.jobs[0]?.status).toBe('printed');
    const written = readdirSync(join(b.spool, 'TVS-RP3160'));
    expect(written.some((f) => f.endsWith('.bin'))).toBe(true);
    const bytes = readFileSync(join(b.spool, 'TVS-RP3160', written.find((f) => f.endsWith('.bin')) as string));
    expect(hex(new Uint8Array(bytes))).toBe(hex(encodeTicket(linesFor().lines, { ...DEFAULT_ENCODER, width: '80' })));
    expect(b.statuses.at(-1)?.state).toBe('connected');
  } finally {
    await jalsa.stop();
  }
});

test('the token never appears in a log line or a status file', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    const b = bridge(jalsa);
    await servePaired(b, { ...noSleep, iterations: 1 });
    const everything = JSON.stringify(b.logs) + JSON.stringify(b.statuses);
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain(TOKEN.slice(0, 12));
  } finally {
    await jalsa.stop();
  }
});

test('MISSING MAPPING: with nothing mapped the bridge claims nothing, says so, and keeps asking', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    jalsa.assignments = [];
    jalsa.jobs.push({ id: 'job-2', machineId: 'KOT-TANDOOR', printerId: 'p-tan', status: 'queued', claimedBy: null, lastError: '' });
    const b = bridge(jalsa);
    const history = await servePaired(b, { ...noSleep, iterations: 3, syncEveryMs: 0 });
    expect(jalsa.jobs[0]?.status).toBe('queued');
    expect(history.every((h) => h.cycle === null)).toBe(true);
    expect(b.statuses[0]?.note).toBe(SERVICE_NOTES.noPrinters);
    // It re-syncs every iteration while unmapped, so the owner's choice is picked up promptly.
    expect(jalsa.syncs.length).toBe(3);
  } finally {
    await jalsa.stop();
  }
});

test('TRANSPORT CANNOT SELECT OR REROUTE: a job for an unmapped machine is never claimed, even when offered', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    // The server maps only the tandoor; a bill printer's job sits in the same restaurant.
    jalsa.jobs.push({ id: 'job-bill', machineId: 'BILL-01', printerId: 'p-bill', status: 'queued', claimedBy: null, lastError: '' });
    const b = bridge(jalsa);
    await servePaired(b, { ...noSleep, iterations: 2, syncEveryMs: 60_000 });
    expect(jalsa.jobs[0]?.status).toBe('queued');
    expect(readdirSync(b.spool)).toEqual([]);
  } finally {
    await jalsa.stop();
  }
});

test('the mapping is a lookup by machine id — the first queue wins a duplicate, and nothing else is invented', () => {
  const paired: PairedConfig = { version: 1, apiUrl: 'http://x/api/bridge', token: 'jbt_x', label: 'PC', restaurantName: '', pairedAt: '' };
  const c = configFromAssignments({
    paired,
    assignments: [
      { printerId: 'a', machineId: 'KOT-VEG-01', printerName: 'Veg', queueName: 'Q-VEG' },
      { printerId: 'b', machineId: 'KOT-VEG-01', printerName: 'Veg again', queueName: 'Q-OTHER' },
      { printerId: 'c', machineId: '', printerName: 'broken', queueName: 'Q-NONE' },
      { printerId: 'd', machineId: 'BILL-01', printerName: 'Bill', queueName: '' },
    ],
    transport: 'windows-queue',
    spoolDir: 'C:\\spool',
    pollMs: 3000,
    maxBackoffMs: 10_000,
  });
  expect(c.destinations).toEqual({ 'KOT-VEG-01': 'Q-VEG' });
  expect(c.machineIds).toEqual(['KOT-VEG-01']);
  expect(c.transport).toBe('windows-queue');
});

test('RESTART / RECONNECT: an outage is logged and backed off, and printing resumes on its own', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    const b = bridge(jalsa);
    const waits: number[] = [];
    // Iteration 1 syncs while up; iteration 2 hits a dead socket; iteration 3 recovers and re-syncs.
    let i = 0;
    const sleep = async (ms: number): Promise<void> => {
      waits.push(ms);
      i += 1;
      if (i === 1) jalsa.down = true;
      if (i === 2) {
        jalsa.down = false;
        jalsa.jobs.push({ id: 'job-3', machineId: 'KOT-TANDOOR', printerId: 'p-tan', status: 'queued', claimedBy: null, lastError: '' });
      }
    };
    const history = await servePaired(b, { sleep, iterations: 4, syncEveryMs: 60_000, pollMs: 1, maxBackoffMs: 4, errorBackoffMs: 64 });
    expect(history.map((h) => h.state)).toEqual(['connected', 'offline', 'connected', 'connected']);
    expect(b.logs.some((l) => l.event === 'bridge.error')).toBe(true);
    expect(b.statuses.some((s) => s.state === 'offline' && s.note === SERVICE_NOTES.offline)).toBe(true);
    // The outage backed off; the recovery re-synced BEFORE printing, then printed.
    expect(history[1]?.waitMs).toBeGreaterThan(history[0]?.waitMs ?? 0);
    expect(history[2]?.synced).toBe(true);
    expect(jalsa.jobs[0]?.status).toBe('printed');
  } finally {
    await jalsa.stop();
  }
});

test('REVOKED: a 401 becomes "not connected to this restaurant", nothing prints, and it keeps checking slowly', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    jalsa.revoked = true;
    jalsa.jobs.push({ id: 'job-4', machineId: 'KOT-TANDOOR', printerId: 'p-tan', status: 'queued', claimedBy: null, lastError: '' });
    const b = bridge(jalsa);
    const history = await servePaired(b, { ...noSleep, iterations: 2, errorBackoffMs: 999 });
    expect(history.map((h) => h.state)).toEqual(['unpaired', 'unpaired']);
    expect(history[0]?.waitMs).toBe(999);
    expect(b.logs.find((l) => l.event === 'bridge.unpaired')?.note).toBe(SERVICE_NOTES.unpaired);
    expect(jalsa.jobs[0]?.status).toBe('queued');
    // The sentence the owner will read on the PC is the one Jalsa's screen uses too.
    expect(SERVICE_NOTES.unpaired).toContain('not connected to this Jalsa restaurant');
  } finally {
    await jalsa.stop();
  }
});

test('a stop request ends the loop before the next cycle, never mid-ticket', async () => {
  const jalsa = new FakeJalsa();
  await jalsa.start();
  try {
    let stop = false;
    const b = bridge(jalsa);
    const history = await servePaired(b, { sleep: async () => { stop = true; }, stopping: () => stop, iterations: 10 });
    expect(history).toHaveLength(1);
  } finally {
    await jalsa.stop();
  }
});

/* ── The Windows queue transport, through the injected runner ──────────── */

const target = { machineId: 'KOT-TANDOOR', jobId: 'job-q', destination: 'TVS RP3160 Gold' };
const bytes = encodeTicket(linesFor().lines, { ...DEFAULT_ENCODER, width: '80' });

test('the queue name reaches PowerShell as an ENVIRONMENT VARIABLE, and the bytes as a staged file', async () => {
  const seen: Array<{ env: Record<string, string>; script: string }> = [];
  const runner = async (input: { script: string; env: Record<string, string>; timeoutMs: number }): Promise<ScriptRun> => {
    seen.push({ env: input.env, script: input.script });
    const staged = readFileSync(input.env.JALSA_FILE as string);
    expect(hex(new Uint8Array(staged))).toBe(hex(bytes));
    return { code: 0, stdout: '', stderr: '', timedOut: false };
  };
  const t = windowsQueueTransport(sandbox(), 1000, runner);
  const r = await t.send(bytes, { ...target, destination: 'x"; Remove-Item C:\\ -Recurse; "' });
  expect(succeeded(r)).toBe(true);
  expect(seen[0]?.env.JALSA_QUEUE).toBe('x"; Remove-Item C:\\ -Recurse; "');
  expect(seen[0]?.script).not.toContain('Remove-Item');
  expect(succeeded(r) && r.detail).toContain('accepted by queue');
});

test('every refusal from Windows is a failure with Windows’ own sentence, never a success', async () => {
  const cases: Array<[ScriptRun, string]> = [
    [{ code: 2, stdout: '', stderr: "No printer named 'TVS RP3160 Gold' on this computer.", timedOut: false }, 'No printer named'],
    [{ code: 5, stdout: '', stderr: "Windows reports the printer 'TVS RP3160 Gold' as Offline.", timedOut: false }, 'as Offline'],
    [{ code: 3, stdout: '', stderr: 'Windows would not accept the ticket', timedOut: false }, 'would not accept'],
    [{ code: 4, stdout: '', stderr: 'Windows accepted only part of the ticket', timedOut: false }, 'only part'],
    [{ code: null, stdout: '', stderr: '', timedOut: true }, 'did not answer within'],
  ];
  for (const [run, expected] of cases) {
    const t = new WindowsSpoolerTransport({ command: windowsQueueCommand(async () => run), tempDir: sandbox(), timeoutMs: 250, destination: { accepts: () => true, refusal: '' } });
    const r = await t.send(bytes, target);
    expect(failed(r), expected).toBe(true);
    expect(failed(r) && r.error).toContain(expected);
  }
});

test('the queue rule refuses an empty or control-character name before any process starts', async () => {
  let ran = 0;
  const t = windowsQueueTransport(sandbox(), 1000, async () => {
    ran += 1;
    return { code: 0, stdout: '', stderr: '', timedOut: false };
  });
  const r = await t.send(bytes, { ...target, destination: 'bad\u0000name' });
  expect(failed(r) && r.error).toContain('not a Windows printer name');
  expect(ran).toBe(0);
});
