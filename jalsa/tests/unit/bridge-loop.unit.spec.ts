/**
 * Bridge loop spec — the whole software path, end to end, without a printer in the room.
 *
 * queued → discovered → claimed → TicketLine[] → ESC/POS → transport → reported → printed
 *
 * WHAT IS REAL HERE AND WHAT IS NOT, STATED PLAINLY
 *   REAL: the loop, the configuration, `composeTicket`, `buildTicket`, `encodeTicket`,
 *   `FileTransport` and `NullTransport`. Bytes are genuinely encoded and genuinely written to
 *   genuine files, and the assertions compare them byte for byte.
 *
 *   NOT REAL: the HTTP hop and Postgres. `Store` below is an in-memory stand-in for
 *   `bridge-mutations.ts`. That is a deliberate trade — the alternative is a tier that needs a
 *   database, and a tier that needs a database is a tier that skips, and a skip reads as a pass.
 *   The trade is made honest two ways: the fidelity rung at the top asserts the stand-in's
 *   conditions against the REAL module's source, and the atomicity of the claim itself was
 *   proved against the TEST database through MCP (recorded in TEST_SUMMARY.md) rather than
 *   asserted here, because an in-memory store cannot demonstrate it.
 *
 * FAIL-FIRST EVIDENCE (21-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';
import type { PaperWidth, TicketLine } from '../../src/lib/print-template';
import type { RoutablePrinter } from '../../src/lib/print-routing';
import { composeTicket, type ComposeItem } from '../../src/lib/ticket-compose';
import { loadConfig, serves, type BridgeConfig } from '../../bridge/src/config';
import type { BridgeJobRef, ClaimResult, JalsaApi, ReportOutcome } from '../../bridge/src/api';
import { runCycle, runLoop, type LoopDeps } from '../../bridge/src/loop';
import { FileTransport } from '../../bridge/src/transport/file';
import { NullTransport } from '../../bridge/src/transport/null';
import type { PrintTransport } from '../../bridge/src/transport/types';

/* ── The restaurant ────────────────────────────────────────────────────── */

const mk = (over: Partial<RoutablePrinter> & { id: string; machineId: string }): RoutablePrinter => ({
  name: `TVS RP 3160 — ${over.machineId}`,
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: false,
  enabled: true,
  ...over,
});

const VEG = mk({ id: 'p1', machineId: 'KOT-VEG-01', station: 'Main Kitchen' });
const TANDOOR = mk({ id: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor', routes: ['Tandoor'] });
const PRINTERS = [VEG, TANDOOR];

const ITEMS: ComposeItem[] = [
  { name: 'Paneer Tikka', qty: 2, foodType: 'veg', rate: 0, category: 'Tandoor', instruction: '' },
  { name: 'Dal Tadka', qty: 1, foodType: 'veg', rate: 0, category: 'Curry', instruction: '' },
];

const HEADER = {
  restaurant: 'JALSA',
  branch: 'Hosur',
  phone: '04344 000000',
  gstin: '—',
  kotCode: 'KOT-113',
  roundCode: 'R-1',
  billCode: 'B-0007',
  table: 'T12',
  customer: '',
  captain: 'Guest phone',
  date: '21 Sep 2026',
  time: '7:40 PM',
  source: 'Guest phone',
  note: '',
};

/** The lines Jalsa would render for a job on a given machine. The REAL composer, every time. */
function linesFor(printerId: string, station: string): { lines: TicketLine[]; width: PaperWidth } {
  const r = composeTicket({
    job: { id: 'x', kind: 'kot', printerId, station, foodSide: 'all', isReprint: false },
    width: '80',
    template: {},
    printers: PRINTERS,
    splitByFoodType: false,
    header: HEADER,
    items: ITEMS,
  });
  if (!r.ok) throw new Error(`fixture could not compose: ${r.blocked}`);
  return { lines: r.lines, width: r.width };
}

/* ── The stand-in for the server ───────────────────────────────────────── */

type Status = 'queued' | 'processing' | 'printed' | 'failed';

interface Row {
  id: string;
  kind: string;
  printerId: string;
  machineId: string;
  printerName: string;
  station: string;
  routingRule: string;
  status: Status;
  claimedBy: string | null;
  attempts: number;
  lastError: string;
  completedAt: string | null;
  isReprint: boolean;
  createdAt: string;
  lines: TicketLine[];
  width: PaperWidth;
  renderError: string | null;
}

/**
 * The job table, with the two conditions that are the whole of the concurrency control.
 *
 * `claim` updates WHERE status = 'queued'; `report` updates WHERE status = 'processing' AND
 * claimed_by = me. Both are restated from `bridge-mutations.ts` and both are asserted against it
 * by the fidelity rung below. Nothing here can write `printerId`, `station` or `routingRule` —
 * not because it checks, but because no method takes them.
 */
class Store {
  readonly rows: Row[] = [];
  /** Every write, in order. Read by the immutability rung. */
  readonly writes: Array<{ id: string; field: string; to: string }> = [];

  add(over: Partial<Row> & { id: string; printerId: string; machineId: string; station: string }): Row {
    const rendered = linesFor(over.printerId, over.station);
    const row: Row = {
      kind: 'KOT',
      printerName: `TVS RP 3160 — ${over.machineId}`,
      routingRule: 'routed',
      status: 'queued',
      claimedBy: null,
      attempts: 0,
      lastError: '',
      completedAt: null,
      isReprint: false,
      createdAt: new Date(2026, 8, 21, 19, 40, this.rows.length).toISOString(),
      lines: rendered.lines,
      width: rendered.width,
      renderError: null,
      ...over,
    };
    this.rows.push(row);
    return row;
  }

  byId(id: string): Row | undefined {
    return this.rows.find((r) => r.id === id);
  }
}

class FakeJalsa implements JalsaApi {
  readonly calls: string[] = [];
  constructor(
    private readonly store: Store,
    private readonly label: string
  ) {}

  async list(input: { machineIds: readonly string[]; limit: number }): Promise<BridgeJobRef[]> {
    this.calls.push('list');
    return this.store.rows
      .filter((r) => r.status === 'queued' && input.machineIds.includes(r.machineId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, input.limit)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        printerId: r.printerId,
        printerMachineId: r.machineId,
        printerName: r.printerName,
        station: r.station,
        isReprint: r.isReprint,
        attempts: r.attempts,
        createdAt: r.createdAt,
      }));
  }

  async claim(input: { jobId: string }): Promise<ClaimResult> {
    this.calls.push('claim');
    const row = this.store.byId(input.jobId);
    // THE CONDITIONAL UPDATE. Exactly one caller can find this row queued.
    if (!row || row.status !== 'queued') return { claimed: false, job: null, payload: null, renderError: null };

    row.status = 'processing';
    row.claimedBy = this.label;
    this.store.writes.push({ id: row.id, field: 'status', to: 'processing' });

    const job: BridgeJobRef = {
      id: row.id,
      kind: row.kind,
      printerId: row.printerId,
      printerMachineId: row.machineId,
      printerName: row.printerName,
      station: row.station,
      isReprint: row.isReprint,
      attempts: row.attempts,
      createdAt: row.createdAt,
    };
    return row.renderError
      ? { claimed: true, job, payload: null, renderError: row.renderError }
      : {
          claimed: true,
          job,
          payload: { lines: row.lines, width: row.width, itemCount: ITEMS.length },
          renderError: null,
        };
  }

  async report(input: { jobId: string; outcome: ReportOutcome; error?: string }): Promise<{ applied: boolean }> {
    this.calls.push('report');
    const row = this.store.byId(input.jobId);
    if (!row || row.status !== 'processing' || row.claimedBy !== this.label) return { applied: false };

    row.status = input.outcome;
    row.attempts += 1;
    row.lastError = input.outcome === 'printed' ? '' : (input.error ?? '');
    row.completedAt = input.outcome === 'printed' ? new Date().toISOString() : null;
    this.store.writes.push({ id: row.id, field: 'status', to: input.outcome });
    return { applied: true };
  }
}

/* ── Bridges ───────────────────────────────────────────────────────────── */

const sandboxes: string[] = [];
const sandbox = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'jalsa-gate4-'));
  sandboxes.push(dir);
  return dir;
};
test.afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

function configFor(label: string, machines: Record<string, string>): BridgeConfig {
  const result = loadConfig({
    JALSA_BRIDGE_API: 'http://localhost:3000/api/bridge',
    JALSA_BRIDGE_TOKEN: 'jbt_not_a_real_token',
    JALSA_BRIDGE_LABEL: label,
    JALSA_BRIDGE_DESTINATIONS: Object.entries(machines)
      .map(([m, d]) => `${m}=${d}`)
      .join(';'),
  });
  if (!result.ok) throw new Error(result.problems.join(' '));
  return result.config;
}

function bridge(input: {
  store: Store;
  label: string;
  machines: Record<string, string>;
  transport: PrintTransport;
}): LoopDeps & { api: FakeJalsa } {
  const config = configFor(input.label, input.machines);
  const api = new FakeJalsa(input.store, input.label);
  return {
    config,
    api,
    // machine_id → a local transport. A lookup, never a search: a machine this bridge does not
    // serve yields null, and the loop fails the job rather than finding it another home.
    transportFor: (machineId) => (serves(config, machineId) ? input.transport : null),
  };
}

/** One bridge, one file sink, one tandoor job waiting. The ordinary evening. */
function ordinary(): { store: Store; dir: string; deps: LoopDeps & { api: FakeJalsa }; job: Row } {
  const store = new Store();
  const job = store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
  const dir = sandbox();
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new FileTransport({ directory: dir, humanReadable: false }),
  });
  return { store, dir, deps, job };
}

/* ── 0. Is the stand-in faithful? ──────────────────────────────────────── */

test('the in-memory store enforces the same conditions the real module does', () => {
  // Binding rule 5: a detector must be able to read what it audits. If `bridge-mutations.ts`
  // ever loses one of these, every rung below is proving a property of a fiction.
  const real = readFileSync('src/lib/db/bridge-mutations.ts', 'utf8');
  expect(real.length).toBeGreaterThan(4000);

  expect(real, 'claim is conditional on queued').toContain(".eq('status', 'queued')");
  expect(real, 'report is conditional on processing').toContain(".eq('status', 'processing')");
  expect(real, 'and on being the holder').toContain(".eq('claimed_by', input.bridge.label)");
  // And the property the whole architecture rests on: the report patch names no printer.
  const report = real.slice(real.indexOf('export async function reportPrintJob'));
  for (const forbidden of ['printer_id', 'station:', 'routing_rule']) {
    expect(report.slice(0, report.indexOf('\n}\n')), `report must not write ${forbidden}`).not.toContain(forbidden);
  }
});

/* ── 1. SUCCESS ────────────────────────────────────────────────────────── */

test('SUCCESS: queued → claim → lines → ESC/POS → FileTransport → report → printed', async () => {
  const { store, dir, deps, job } = ordinary();

  const outcome = await runCycle(deps);

  expect(outcome.claimedJobId).toBe('job-1');
  expect(outcome.encoded).toBe(true);
  expect(outcome.transport).toBe('sent');
  expect(outcome.reported).toBe('printed');
  expect(store.byId('job-1')?.status).toBe('printed');
  expect(store.byId('job-1')?.lastError).toBe('');
  expect(store.byId('job-1')?.completedAt).not.toBeNull();

  // And paper, or the nearest thing to it that exists without a printer.
  const written = new Uint8Array(readFileSync(join(dir, 'TANDOOR-QUEUE', 'job-1.bin')));
  expect(written.length).toBe(outcome.bytes);
  expect(hex(written).startsWith('1B 40')).toBe(true);
  expect(job.printerId).toBe('p3');
});

/* ── 2. FAILURE ────────────────────────────────────────────────────────── */

test('FAILURE: the same path with NullTransport ends at failed, with a reason', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new NullTransport(),
  });

  const outcome = await runCycle(deps);

  // The ticket was still composed and still encoded — the failure is at the transport, which is
  // the only place it could honestly be.
  expect(outcome.encoded).toBe(true);
  expect(outcome.transport).toBe('refused');
  expect(outcome.reported).toBe('failed');

  const row = store.byId('job-1');
  expect(row?.status).toBe('failed');
  expect(row?.completedAt).toBeNull();
  expect(row?.attempts).toBe(1);
});

/* ── 12. THE FAILURE REPORT CARRIES THE TRANSPORT'S OWN WORDS ──────────── */

test("FAILURE REPORT: the transport's sentence is what a person reads on the history screen", async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
  const reason = 'The kitchen PC has no printer attached.';
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new NullTransport(reason),
  });

  await runCycle(deps);
  expect(store.byId('job-1')?.lastError).toContain(reason);
  expect(store.byId('job-1')?.lastError).toContain('job-1');
});

/* ── 3. CONCURRENCY ────────────────────────────────────────────────────── */

test('CONCURRENCY: two bridges, one queued job — one claim, one encode, one transport', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });

  const dirA = sandbox();
  const dirB = sandbox();
  const a = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new FileTransport({ directory: dirA, humanReadable: false }),
  });
  const b = bridge({
    store,
    label: 'Counter PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new FileTransport({ directory: dirB, humanReadable: false }),
  });

  const [ra, rb] = await Promise.all([runCycle(a), runCycle(b)]);

  const claims = [ra, rb].filter((r) => r.claimedJobId !== null);
  expect(claims.length, 'exactly one bridge takes the job').toBe(1);
  expect([ra, rb].filter((r) => r.encoded).length, 'the loser never runs the encoder').toBe(1);
  expect([ra, rb].filter((r) => r.transport === 'sent').length, 'one transport').toBe(1);
  expect([ra, rb].filter((r) => r.reported !== null).length, 'one report').toBe(1);
  expect(store.byId('job-1')?.status).toBe('printed');

  // And only one of the two sinks ever received bytes.
  const landed = [dirA, dirB].filter((d) => {
    try {
      readFileSync(join(d, 'TANDOOR-QUEUE', 'job-1.bin'));
      return true;
    } catch {
      return false;
    }
  });
  expect(landed.length, 'one file, not two').toBe(1);
});

/* ── 4. MACHINE ISOLATION ──────────────────────────────────────────────── */

test('MACHINE ISOLATION: a job for machine A is never claimed by the bridge serving B', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });

  const other = bridge({
    store,
    label: 'Counter PC',
    machines: { 'KOT-VEG-01': 'VEG-QUEUE' },
    transport: new FileTransport({ directory: sandbox(), humanReadable: false }),
  });

  const outcome = await runCycle(other);

  expect(outcome.offered, 'the server never offers it').toBe(0);
  expect(outcome.claimedJobId).toBeNull();
  expect(outcome.encoded).toBe(false);
  expect(store.byId('job-1')?.status).toBe('queued');
  expect(other.api.calls).not.toContain('claim');
});

test('MACHINE ISOLATION: even if the server offered it, the bridge filters it out locally', async () => {
  // Two hops maintain one list. A job for a machine this PC cannot physically reach must not be
  // claimed just because a server-side filter was wrong — it would be a ticket that silently
  // never appears anywhere.
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });

  const deps = bridge({
    store,
    label: 'Counter PC',
    machines: { 'KOT-VEG-01': 'VEG-QUEUE' },
    transport: new NullTransport(),
  });
  // A server that has stopped filtering.
  const leaky: JalsaApi = {
    list: async () => [
      {
        id: 'job-1',
        kind: 'KOT',
        printerId: 'p3',
        printerMachineId: 'KOT-TANDOOR',
        printerName: 'TVS RP 3160 — KOT-TANDOOR',
        station: 'Tandoor',
        isReprint: false,
        attempts: 0,
        createdAt: new Date(2026, 8, 21).toISOString(),
      },
    ],
    claim: async () => {
      throw new Error('the bridge must not have claimed a machine it does not serve');
    },
    report: async () => ({ applied: false }),
  };

  const outcome = await runCycle({ ...deps, api: leaky });
  expect(outcome.offered).toBe(1);
  expect(outcome.eligible, 'filtered locally').toBe(0);
  expect(outcome.claimedJobId).toBeNull();
});

/* ── 5. PRINTER IMMUTABILITY & 6. NO REROUTING ─────────────────────────── */

test('PRINTER IMMUTABILITY: a full success and a full failure leave the assignment untouched', async () => {
  for (const transport of [new FileTransport({ directory: sandbox(), humanReadable: false }), new NullTransport()]) {
    const store = new Store();
    const job = store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
    const before = { printerId: job.printerId, machineId: job.machineId, station: job.station, rule: job.routingRule };

    await runCycle(bridge({ store, label: 'Kitchen PC', machines: { 'KOT-TANDOOR': 'Q' }, transport }));

    const after = store.byId('job-1');
    expect(after?.printerId).toBe(before.printerId);
    expect(after?.machineId).toBe(before.machineId);
    expect(after?.station).toBe(before.station);
    expect(after?.routingRule).toBe(before.rule);
    // And the only field the bridge ever wrote was the status.
    expect([...new Set(store.writes.map((w) => w.field))]).toEqual(['status']);
  }
});

test('NO REROUTING: the bridge has no input anywhere that could name a different printer', () => {
  // Structural, at three levels, because this is the property the whole architecture rests on.

  // 1. The API surface. `report` carries an outcome and a sentence.
  const api = readFileSync('bridge/src/api.ts', 'utf8');
  const reportSig = api.slice(api.indexOf('report(input:'), api.indexOf('report(input:') + 200);
  expect(reportSig).toContain("outcome: ReportOutcome");
  expect(reportSig).not.toContain('printerId');
  expect(reportSig).not.toContain('machineId');

  // 2. The loop. Nothing in it assigns a printer, and the only destination lookup is BY the id
  //    the job already carries.
  const loop = readFileSync('bridge/src/loop.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  expect(loop).toContain('destinationFor(config, job.printerMachineId)');
  for (const smell of ['.find(', 'fallback', 'reroute', 'otherPrinter']) {
    expect(loop, `the loop must not contain ${smell}`).not.toContain(smell);
  }

  // 3. The lookup itself. A machine this bridge does not serve yields null, not a substitute.
  const config = configFor('Kitchen PC', { 'KOT-TANDOOR': 'Q' });
  expect(serves(config, 'KOT-VEG-01')).toBe(false);
});

test('NO REROUTING: a job this bridge cannot serve FAILS rather than going somewhere else', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
  const dir = sandbox();
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new FileTransport({ directory: dir, humanReadable: false }),
  });

  // A bridge whose local mapping has gone: the job is still offered and still claimed, and the
  // transport lookup comes back empty.
  const outcome = await runCycle({ ...deps, transportFor: () => null });

  expect(outcome.claimedJobId).toBe('job-1');
  expect(outcome.encoded, 'nothing is encoded for a machine it cannot reach').toBe(false);
  expect(outcome.reported).toBe('failed');
  expect(store.byId('job-1')?.lastError).toContain('does not serve');
  expect(store.byId('job-1')?.printerId).toBe('p3');
});

/* ── 7. DUPLICATE PROTECTION ───────────────────────────────────────────── */

test('DUPLICATE PROTECTION: a printed job is never offered, claimed or printed again', async () => {
  const { store, deps } = ordinary();

  const first = await runCycle(deps);
  const second = await runCycle(deps);
  const third = await runCycle(deps);

  expect(first.reported).toBe('printed');
  expect(second.claimedJobId).toBeNull();
  expect(third.claimedJobId).toBeNull();
  expect(store.writes.filter((w) => w.to === 'printed').length, 'printed exactly once').toBe(1);
  expect(store.byId('job-1')?.attempts, 'one attempt, not three').toBe(1);
});

test('DUPLICATE PROTECTION: a failed job is not mistaken for a queued one', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor', status: 'failed' });
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'Q' },
    transport: new FileTransport({ directory: sandbox(), humanReadable: false }),
  });

  const outcome = await runCycle(deps);
  expect(outcome.offered).toBe(0);
  expect(outcome.claimedJobId).toBeNull();
  // Retrying a failed job is Jalsa's business, operated by a person. The bridge never revives it.
  expect(store.byId('job-1')?.status).toBe('failed');
});

test('DUPLICATE PROTECTION: polling repeatedly creates no second job', async () => {
  const { store, deps } = ordinary();
  await runLoop(deps, { cycles: 6, sleep: async () => {} });
  expect(store.rows.length, 'the bridge cannot insert rows at all').toBe(1);
  expect(store.rows[0]?.status).toBe('printed');
});

/* ── 8. RESTART ────────────────────────────────────────────────────────── */

test('RESTART: a job left in processing stays processing — the bridge never re-queues it', async () => {
  const store = new Store();
  store.add({
    id: 'job-1',
    printerId: 'p3',
    machineId: 'KOT-TANDOOR',
    station: 'Tandoor',
    status: 'processing',
    claimedBy: 'Kitchen PC (the instance that died)',
  });

  // A brand-new process, same configuration, no memory of the claim.
  const restarted = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'Q' },
    transport: new FileTransport({ directory: sandbox(), humanReadable: false }),
  });

  const outcomes = await runLoop(restarted, { cycles: 4, sleep: async () => {} });

  expect(outcomes.every((o) => o.claimedJobId === null)).toBe(true);
  expect(store.byId('job-1')?.status, 'still processing, awaiting the server-side sweeper').toBe('processing');
  expect(store.writes.length, 'the bridge wrote nothing at all').toBe(0);
});

test('RESTART: nothing in the bridge can write the word "queued"', () => {
  // Re-queueing asserts the dead instance did NOT print, and if that assertion is wrong the
  // round prints twice. The sweeper expires a stale claim to `failed`, in front of a person.
  const sources = ['bridge/src/loop.ts', 'bridge/src/api.ts', 'bridge/src/config.ts'];
  for (const file of sources) {
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
    expect(code, `${file} must not write a status`).not.toContain("'queued'");
    expect(code, `${file} must not sweep`).not.toContain('sweep');
  }
  // And the outcomes it CAN report are exactly two.
  const api = readFileSync('bridge/src/api.ts', 'utf8');
  expect(api).toContain("export type ReportOutcome = 'printed' | 'failed';");
});

/* ── 9. PAYLOAD INTEGRITY ──────────────────────────────────────────────── */

test('PAYLOAD INTEGRITY: the lines the bridge encodes are the server-rendered ticket, exactly', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });

  const seen: TicketLine[][] = [];
  const dir = sandbox();
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'TANDOOR-QUEUE' },
    transport: new FileTransport({ directory: dir, humanReadable: false }),
  });
  const watching: JalsaApi = {
    list: deps.api.list.bind(deps.api),
    claim: async (i) => {
      const r = await deps.api.claim(i);
      if (r.payload) seen.push(r.payload.lines);
      return r;
    },
    report: deps.api.report.bind(deps.api),
  };

  await runCycle({ ...deps, api: watching });

  // The template contract's own output for this job, computed independently right here.
  const expected = composeTicket({
    job: { id: 'job-1', kind: 'kot', printerId: 'p3', station: 'Tandoor', foodSide: 'all', isReprint: false },
    width: '80',
    template: {},
    printers: PRINTERS,
    splitByFoodType: false,
    header: HEADER,
    items: ITEMS,
  });
  expect(expected.ok).toBe(true);
  if (!expected.ok) return;

  expect(seen.length).toBe(1);
  expect(seen[0]).toEqual(expected.lines);
  // Lines, not bytes — the encoder lives on the bridge and that is the point of the contract.
  expect(seen[0]?.every((l) => typeof l.text === 'string' && typeof l.weight === 'string')).toBe(true);
});

/* ── 10. BYTE DETERMINISM & 11. FILE OUTPUT ────────────────────────────── */

test('BYTE DETERMINISM: the same TicketLine[] always produces the same ESC/POS bytes', () => {
  const { lines, width } = linesFor('p3', 'Tandoor');
  const runs = Array.from({ length: 5 }, () => hex(encodeTicket(lines, { ...DEFAULT_ENCODER, width })));
  expect(new Set(runs).size, 'five encodes, one answer').toBe(1);
});

test('FILE OUTPUT: what lands in the sink is the encoder output, byte for byte', async () => {
  const { dir, deps } = ordinary();
  await runCycle(deps);

  const { lines, width } = linesFor('p3', 'Tandoor');
  const expected = encodeTicket(lines, { ...DEFAULT_ENCODER, width });
  const written = new Uint8Array(readFileSync(join(dir, 'TANDOOR-QUEUE', 'job-1.bin')));

  expect(hex(written)).toBe(hex(expected));
});

/* ── A ticket that cannot be rendered fails visibly ────────────────────── */

test('a job whose ticket cannot be composed is reported failed, not abandoned in processing', async () => {
  const store = new Store();
  const row = store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
  row.renderError = 'This round was split into two tickets for the same machine and station.';

  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'Q' },
    transport: new FileTransport({ directory: sandbox(), humanReadable: false }),
  });

  const outcome = await runCycle(deps);

  expect(outcome.claimedJobId).toBe('job-1');
  expect(outcome.encoded, 'nothing to encode').toBe(false);
  expect(outcome.reported).toBe('failed');
  expect(store.byId('job-1')?.status, 'never left stuck in processing').toBe('failed');
  expect(store.byId('job-1')?.lastError).toContain('split into two tickets');
});

/* ── The loop is bounded ───────────────────────────────────────────────── */

test('an idle queue backs off instead of spinning', async () => {
  const store = new Store();
  const waits: number[] = [];
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'Q' },
    transport: new NullTransport(),
  });

  await runLoop(deps, { cycles: 8, sleep: async (ms) => void waits.push(ms) });

  expect(waits.length).toBe(7);
  // Doubling, and capped. A kitchen PC is somebody's working computer.
  expect(waits[0]).toBe(deps.config.pollMs * 2);
  expect(Math.max(...waits)).toBeLessThanOrEqual(deps.config.maxBackoffMs);
  for (let i = 1; i < waits.length; i += 1) expect(waits[i]).toBeGreaterThanOrEqual(waits[i - 1] as number);
});

test('finding work resets the backoff', async () => {
  const store = new Store();
  store.add({ id: 'job-1', printerId: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor' });
  const waits: number[] = [];
  const deps = bridge({
    store,
    label: 'Kitchen PC',
    machines: { 'KOT-TANDOOR': 'Q' },
    transport: new FileTransport({ directory: sandbox(), humanReadable: false }),
  });

  await runLoop(deps, { cycles: 3, sleep: async (ms) => void waits.push(ms) });
  expect(waits[0], 'the cycle that printed resets to the poll interval').toBe(deps.config.pollMs);
});

test('a stop signal ends the loop without running another cycle', async () => {
  const { store, deps } = ordinary();
  const outcomes = await runLoop(deps, { cycles: 10, sleep: async () => {}, stopping: () => true });
  expect(outcomes).toEqual([]);
  expect(store.byId('job-1')?.status).toBe('queued');
});

/* ── Configuration refuses what it cannot serve ────────────────────────── */

test('a bridge that serves nothing refuses to start rather than polling forever', () => {
  const result = loadConfig({
    JALSA_BRIDGE_API: 'http://localhost:3000/api/bridge',
    JALSA_BRIDGE_TOKEN: 't',
    JALSA_BRIDGE_LABEL: 'Kitchen PC',
  });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.problems.join(' ')).toContain('could never print anything');
});

test('a Supabase credential in a bridge environment stops the bridge', () => {
  // Gate 1 security model: bridge token only. A database credential on a kitchen PC means
  // somebody has misunderstood the deployment, and starting anyway would hide that.
  const result = loadConfig({
    JALSA_BRIDGE_API: 'http://localhost:3000/api/bridge',
    JALSA_BRIDGE_TOKEN: 't',
    JALSA_BRIDGE_LABEL: 'Kitchen PC',
    JALSA_BRIDGE_DESTINATIONS: 'KOT-TANDOOR=Q',
    SUPABASE_SECRET_KEY: 'sb_secret_should_not_be_here',
  });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.problems.join(' ')).toContain('never holds a database credential');
});

test('a nonsense poll interval becomes the default, never a tight loop', () => {
  for (const raw of ['0', '-1', 'soon', '', '10']) {
    const r = loadConfig({
      JALSA_BRIDGE_API: 'a',
      JALSA_BRIDGE_TOKEN: 't',
      JALSA_BRIDGE_LABEL: 'l',
      JALSA_BRIDGE_DESTINATIONS: 'm=d',
      JALSA_BRIDGE_POLL_MS: raw,
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.config.pollMs).toBeGreaterThanOrEqual(250);
  }
});
