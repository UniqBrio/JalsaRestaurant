/**
 * Print reliability scenarios (02-Oct-2026) - bundled and run by
 * tests/unit/print-reliability.unit.spec.ts.
 *
 * Calls the REAL `printElsewhere`, `retryPrintJob`, `reprintBill` and `maybeSweepStaleClaims`
 * against fake-supabase and reports every write and every RPC, so the spec can hold them to:
 * a redirect goes through the one transactional function, a cancelled job is never re-sent, a
 * bill reprint writes a print job and an audit row and NOTHING on the bill, and the sweeper runs
 * at most once a minute.
 */
import { printElsewhere, reprintBill, retryPrintJob } from '@/lib/db/mutations';
import { maybeSweepStaleClaims, SWEEP_EVERY_MS } from '@/lib/db/bridge-mutations';
import { upsertPrinter } from '@/lib/db/owner-mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

interface World {
  grants: string[];
  /** The job being redirected or retried. */
  jobStatus?: 'queued' | 'processing' | 'printed' | 'failed' | 'cancelled';
  /** The job's kind (KOT unless said). */
  jobKind?: 'KOT' | 'Invoice';
  /** The bill being reprinted. */
  billStatus?: 'open' | 'payment_requested' | 'closed';
  printers?: Array<Record<string, unknown>>;
}

interface Write {
  table: string;
  op: string;
  body: unknown;
  filters: string[];
}

const KITCHEN = { id: 'p-kot', machine_id: 'KOT-1', name: 'Kitchen', purpose: 'KOT', roles: ['KOT'], default_roles: [], station: 'Main Kitchen', routes: [], online: false, enabled: true };
const TANDOOR = { id: 'p-tan', machine_id: 'KOT-2', name: 'Tandoor', purpose: 'KOT', roles: ['KOT'], default_roles: [], station: 'Tandoor', routes: [], online: false, enabled: true };
const COUNTER = { id: 'p-inv', machine_id: 'POS-1', name: 'Counter', purpose: 'Invoice', roles: ['Invoice'], default_roles: [], station: 'Billing', routes: [], online: false, enabled: true };

function responder(world: World, writes: Write[]) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    if (q.op !== 'select') {
      writes.push({
        table: q.table,
        op: q.op,
        body: q.body,
        filters: q.filters.map(([k, c, v]) => `${k}:${c}=${String(v)}`),
      });
    }
    if (q.op === 'rpc') return 'new-job' as unknown as Record<string, unknown>;
    switch (q.table) {
      case 'print_job':
        if (q.op === 'select') {
          return [
            { id: 'j1', kind: world.jobKind ?? 'KOT', kot_id: world.jobKind === 'Invoice' ? null : 'k1', status: world.jobStatus ?? 'queued', attempts: 1, printer_id: 'p-tan', printer_name: 'Tandoor', station: 'Tandoor' },
          ];
        }
        // A conditional update reports the row it changed - the retry checks that it changed one.
        if (q.op === 'update') return [{ id: 'j1' }];
        return [];
      case 'printer': {
        const all = world.printers ?? [KITCHEN, TANDOOR, COUNTER];
        const kind = q.filters.find(([k, c]) => k === 'cs' && c === 'roles')?.[2] as string[] | undefined;
        const id = q.filters.find(([k, c]) => k === 'eq' && c === 'id')?.[2];
        if (id) return all.filter((p) => p.id === id);
        return kind ? all.filter((p) => (p.roles as string[]).includes(kind[0]!)) : all;
      }
      case 'bill':
        return q.op === 'select' ? [{ id: 'b1', code: 'B-104', status: world.billStatus ?? 'closed' }] : [];
      default:
        return [];
    }
  };
}

const ownerWith = (grants: string[]) => ({
  staffId: 'ow1',
  label: 'Meena · Owner',
  grants: { can: (k: string) => grants.includes(k) },
});

async function run(name: string, world: World, call: (actor: ReturnType<typeof ownerWith>) => Promise<unknown>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const writes: Write[] = [];
  db.respond = responder(world, writes);
  try {
    const out = await call(ownerWith(world.grants));
    return { name, out: out ?? null, threw: null, writes };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? err.message : String(err), writes };
  }
}

const REPRINT = ['orders.reprint'];
const elsewhere = (actor: ReturnType<typeof ownerWith>) => printElsewhere({ jobId: 'j1', printerId: 'p-kot', actor });

const results = [
  await run('elsewhere, waiting', { grants: REPRINT, jobStatus: 'queued' }, elsewhere),
  await run('elsewhere, printed', { grants: REPRINT, jobStatus: 'printed' }, elsewhere),
  await run('elsewhere, failed', { grants: REPRINT, jobStatus: 'failed' }, elsewhere),
  await run('elsewhere, printing now', { grants: REPRINT, jobStatus: 'processing' }, elsewhere),
  await run('elsewhere, already sent elsewhere', { grants: REPRINT, jobStatus: 'cancelled' }, elsewhere),
  await run('elsewhere, no grant', { grants: [], jobStatus: 'queued' }, elsewhere),
  await run('retry, a cancelled job', { grants: REPRINT, jobStatus: 'cancelled' }, (actor) => retryPrintJob({ jobId: 'j1', actor })),
  await run('retry, a failed job', { grants: REPRINT, jobStatus: 'failed' }, (actor) => retryPrintJob({ jobId: 'j1', actor })),
  await run('reprint bill, settled', { grants: ['bill.reprint'], billStatus: 'closed' }, (actor) => reprintBill({ billId: 'b1', actor })),
  await run('reprint bill, still open', { grants: ['bill.reprint'], billStatus: 'open' }, (actor) => reprintBill({ billId: 'b1', actor })),
  await run('reprint bill, no grant', { grants: ['orders.reprint', 'bill.view'], billStatus: 'closed' }, (actor) =>
    reprintBill({ billId: 'b1', actor })
  ),
  await run('reprint bill, nothing prints bills', { grants: ['bill.reprint'], billStatus: 'closed', printers: [KITCHEN] }, (actor) =>
    reprintBill({ billId: 'b1', actor })
  ),
  // Review, 02-Oct-2026: a printed BILL sent elsewhere is a bill reprint - it needs bill.reprint.
  await run('elsewhere, a bill, kitchen grant only', { grants: REPRINT, jobStatus: 'printed', jobKind: 'Invoice' }, (actor) =>
    printElsewhere({ jobId: 'j1', printerId: 'p-inv', actor })
  ),
  await run('elsewhere, a bill, both grants', { grants: [...REPRINT, 'bill.reprint'], jobStatus: 'printed', jobKind: 'Invoice' }, (actor) =>
    printElsewhere({ jobId: 'j1', printerId: 'p-inv', actor })
  ),
  await run('retry, being printed', { grants: REPRINT, jobStatus: 'processing' }, (actor) => retryPrintJob({ jobId: 'j1', actor })),
  // Review, 02-Oct-2026: an unknown printer id takes no other printer's default on its way out.
  await run('printer, unknown id', { grants: ['set.printer'] }, (actor) =>
    upsertPrinter({
      id: 'p-ghost', machineId: 'POS-9', name: 'Ghost', purpose: 'Invoice', roles: ['Invoice'], defaultFor: ['Invoice'],
      station: 'Billing', paperMm: 80, connection: 'USB', address: '', port: 9100, routes: [], enabled: true, actor,
    })
  ),
  // The sweeper: three polls inside a minute, then one after it, for one restaurant.
  await run('sweep throttle', { grants: [] }, async () => {
    const t0 = 1_000_000_000;
    await maybeSweepStaleClaims('r1', t0);
    await maybeSweepStaleClaims('r1', t0 + 8_000);
    await maybeSweepStaleClaims('r1', t0 + SWEEP_EVERY_MS - 1);
    await maybeSweepStaleClaims('r1', t0 + SWEEP_EVERY_MS);
    // Another restaurant is not held back by this one's last sweep.
    await maybeSweepStaleClaims('r2', t0 + 8_000);
  }),
];
process.stdout.write(`${JSON.stringify(results)}\n`);
