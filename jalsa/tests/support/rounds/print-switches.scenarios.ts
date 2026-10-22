/**
 * KOT and invoice print switches (22-Oct-2026) - bundled and run by
 * tests/unit/print-switches.unit.spec.ts.
 *
 * Calls the REAL `placeRound`, `closeBill`, `printKotOnce`, `printInvoiceOnce`, `changeQty` and
 * `writeSetting` against a fake-supabase that KEEPS STATE for the three rows these turn on - the
 * round's `print_status`, the bill's status and the print jobs - and applies the two filters the
 * duplicate guards depend on: the round's conditional claim (`eq print_status`) and the job's
 * primary key (a second insert of one id is refused with 23505, as Postgres refuses it). Every
 * write is reported, so the spec can count print jobs and prove no setting was touched.
 *
 * One physical printer prints both kinds ({KOT, Invoice}), as in a one-printer restaurant.
 */
import { changeQty, closeBill, placeRound, printInvoiceOnce, printKotOnce } from '@/lib/db/mutations';
import { firstInvoiceJobId } from '@/lib/print-job-id';
import { writeSetting } from '@/lib/db/owner-mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const iso = new Date().toISOString();

const SHARED = { id: 'p-one', machine_id: 'POS-1', name: 'Counter', purpose: 'KOT', roles: ['KOT', 'Invoice'], default_roles: [], station: 'Main Kitchen', routes: [], online: false, enabled: true };

interface World {
  /** The `print` setting as stored, or undefined for a restaurant that never saved one. */
  print?: Record<string, unknown>;
  printers?: Array<Record<string, unknown>>;
  billStatus?: 'open' | 'payment_requested' | 'closed' | 'void';
  /** The round already on the bill, for print-once and changeQty scenarios. */
  kot?: { print_status: string; status?: string };
  /** Every line of that round was cancelled. */
  allCancelled?: boolean;
  /** Jobs already written (an automatic first invoice, say). */
  jobs?: Array<Record<string, unknown>>;
  printJobInsertFails?: boolean;
}

interface State {
  print: Record<string, unknown> | undefined;
  billStatus: string;
  kot: { id: string; code: string; print_status: string; status: string; bill_id: string; table_id: string } | null;
  jobs: Array<Record<string, unknown>>;
  kotSeq: number;
}

interface Write {
  table: string;
  op: string;
  body: unknown;
  filters: string[];
  refused?: string;
}

const billRow = (status: string) => ({
  id: 'b1',
  code: 'B-104',
  status,
  group_code: null,
  guests: 2,
  occasion_type: null,
  occasion_name: null,
  occasion_source: null,
  discount_pct: 0,
  discount_amount: 0,
  tax_rate: 5,
  payment_mode: null,
  payment_reference: '',
  payment_requested_at: null,
  closed_at: null,
  opened_at: iso,
  order_type: 'takeaway',
  packaging_charge: 0,
  host_table: null,
  captain: null,
  waiter: null,
  closed_by: null,
  discount_by: null,
  bill_table: [],
  tip: [],
  kot: [],
});

const eqOf = (q: FakeQuery, col: string): unknown => q.filters.find(([k, c]) => k === 'eq' && c === col)?.[2];

function responder(world: World, s: State, writes: Write[]) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    const write: Write | null =
      q.op !== 'select' && q.op !== 'rpc'
        ? { table: q.table, op: q.op, body: q.body, filters: q.filters.map(([k, c, v]) => `${k}:${c}=${String(v)}`) }
        : null;
    if (write) writes.push(write);
    if (q.op === 'rpc') return `KOT-${++s.kotSeq}` as unknown as Record<string, unknown>;

    switch (q.table) {
      case 'setting': {
        const key = eqOf(q, 'key');
        if (q.op === 'upsert') {
          s.print = (q.body as { value: Record<string, unknown> }).value;
          return [];
        }
        if (key === 'tax') return [{ value: { rate: 5 } }];
        if (key === 'print') return s.print ? [{ value: s.print }] : [];
        return [];
      }
      case 'menu_item':
        return [
          { id: 'm1', name: 'Paneer Tikka', price: 240, food_type: 'veg', available: true, closed_until: null, printer_id: null, station: null, food_type_ref: { name: 'Veg' }, menu_category: { name: 'Starters', parent_id: null, parent: null } },
        ];
      case 'printer': {
        const kind = q.filters.find(([k, c]) => k === 'cs' && c === 'roles')?.[2] as string[] | undefined;
        const all = world.printers ?? [SHARED];
        return kind ? all.filter((p) => (p.roles as string[]).includes(kind[0]!)) : all;
      }
      case 'bill':
        if (q.op === 'update') {
          // closeBill's write is conditional on the bill still being open or asked to pay.
          if (s.billStatus !== 'open' && s.billStatus !== 'payment_requested') return [];
          s.billStatus = 'closed';
          return [{ id: 'b1' }];
        }
        return [{ ...billRow(s.billStatus), status: s.billStatus }];
      case 'kot':
        if (q.op === 'insert') {
          const body = q.body as Record<string, unknown>;
          s.kot = { id: `k${s.kotSeq}`, code: String(body.code), print_status: String(body.print_status), status: 'new', bill_id: 'b1', table_id: 't1' };
          return [{ id: s.kot.id }];
        }
        if (q.op === 'update' && s.kot) {
          // The conditional claim: applied only while the row still holds the state it names.
          const want = eqOf(q, 'print_status');
          if (want !== undefined && s.kot.print_status !== want) return [];
          const body = q.body as Record<string, unknown>;
          if (typeof body.print_status === 'string') s.kot.print_status = body.print_status;
          return [{ id: s.kot.id }];
        }
        return s.kot ? [{ ...s.kot }] : [];
      case 'kot_item':
        if (q.op === 'select' && q.cols.includes('kot:kot_id')) {
          return [{ id: 'i1', name: 'Paneer Tikka', qty: 1, kot: s.kot }];
        }
        if (q.op === 'select') {
          return [{ menu_category_name: 'Starters', food_type: 'veg', cancelled_at: world.allCancelled ? iso : null, route_printer_id: null, route_station: null }];
        }
        return [];
      case 'print_job': {
        if (q.op === 'insert') {
          if (world.printJobInsertFails) {
            write!.refused = 'insert failed';
            return { __error: 'print_job insert failed' };
          }
          const rows = (Array.isArray(q.body) ? q.body : [q.body]) as Array<Record<string, unknown>>;
          // The primary key, as Postgres holds it: one statement, all rows or none.
          if (rows.some((r) => r.id && s.jobs.some((j) => j.id === r.id))) {
            write!.refused = '23505';
            return { __error: 'duplicate key value violates unique constraint "print_job_pkey"', __code: '23505' };
          }
          rows.forEach((r, i) => s.jobs.push({ id: r.id ?? `job-${s.jobs.length + i + 1}`, status: r.status, attempts: 0, ...r }));
          return [];
        }
        // Reads: by round (the aggregate), or a bill's first invoice.
        const kotId = eqOf(q, 'kot_id');
        const billId = eqOf(q, 'bill_id');
        return s.jobs.filter(
          (j) =>
            (kotId === undefined || j.kot_id === kotId) &&
            (billId === undefined || j.bill_id === billId) &&
            (eqOf(q, 'kind') === undefined || j.kind === eqOf(q, 'kind')) &&
            (eqOf(q, 'is_reprint') === undefined || j.is_reprint === eqOf(q, 'is_reprint'))
        );
      }
      default:
        return [];
    }
  };
}

const staff = (grants: string[]) => ({
  staffId: 'c1',
  label: 'Ravi · Captain',
  grants: { can: (k: string) => grants.includes(k) },
});
const CAPTAIN = ['orders.add_items', 'orders.reprint', 'orders.qty_change', 'bill.record_payment'];

async function run(
  name: string,
  world: World,
  steps: (actor: ReturnType<typeof staff>) => Promise<unknown>,
  grants: string[] = CAPTAIN
) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 2;
  const writes: Write[] = [];
  const state: State = {
    print: world.print ? { ...world.print } : undefined,
    billStatus: world.billStatus ?? 'open',
    kot: world.kot ? { id: 'k0', code: 'KOT-0', status: world.kot.status ?? 'new', bill_id: 'b1', table_id: 't1', print_status: world.kot.print_status } : null,
    jobs: [...(world.jobs ?? [])],
    kotSeq: 0,
  };
  db.respond = responder(world, state, writes);
  let out: unknown = null;
  let threw: string | null = null;
  try {
    out = (await steps(staff(grants))) ?? null;
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  return { name, out, threw, writes, final: { print: state.print ?? null, kot: state.kot, jobs: state.jobs, billStatus: state.billStatus } };
}

const round = (actor: ReturnType<typeof staff>) =>
  placeRound({ billId: 'b1', tableId: 't1', lines: [{ menuItemId: 'm1', qty: 1 }], source: 'captain', actor });
const guestRound = () =>
  placeRound({ billId: 'b1', tableId: 't1', lines: [{ menuItemId: 'm1', qty: 1 }], source: 'guest', actor: { staffId: null, label: 'Guest · QR' } });
const pay = (actor: ReturnType<typeof staff>) => closeBill({ billId: 'b1', mode: 'Cash', actor });
const OFF = { kotEnabled: false, invoiceEnabled: false };

const results = [
  /* ── KOT ─────────────────────────────────────────────────────────────── */
  await run('kot: no setting saved', {}, round),
  await run('kot: on', { print: { kotEnabled: true } }, round),
  await run('kot: off', { print: { kotEnabled: false } }, round),
  await run('kot: off, a guest round', { print: { kotEnabled: false } }, guestRound),
  await run('kot: off, two rounds', { print: { kotEnabled: false } }, async (a) => [await round(a), await round(a)]),
  await run('kot: off, print once', { print: { kotEnabled: false } }, async (a) => {
    const placed = await round(a);
    return { placed, printed: await printKotOnce({ kotId: placed.kotId, actor: a }) };
  }),
  await run('kot: off, print once, tapped twice', { print: { kotEnabled: false } }, async (a) => {
    const placed = await round(a);
    return [await printKotOnce({ kotId: placed.kotId, actor: a }), await printKotOnce({ kotId: placed.kotId, actor: a })];
  }),
  await run('kot: off, print once, two at the same instant', { print: { kotEnabled: false } }, async (a) => {
    const placed = await round(a);
    return Promise.all([printKotOnce({ kotId: placed.kotId, actor: a }), printKotOnce({ kotId: placed.kotId, actor: a })]);
  }),
  await run('kot: off, print once, then the next round', { print: { kotEnabled: false } }, async (a) => {
    const first = await round(a);
    await printKotOnce({ kotId: first.kotId, actor: a });
    return round(a);
  }),
  await run('kot: on, print once on a round that printed by itself', {}, async (a) => {
    const placed = await round(a);
    return printKotOnce({ kotId: placed.kotId, actor: a });
  }),
  await run('kot: print once without the grant', { kot: { print_status: 'cancelled' } }, (a) => printKotOnce({ kotId: 'k0', actor: a }), ['orders.add_items']),
  await run('kot: print once with no kitchen printer', { kot: { print_status: 'cancelled' }, printers: [] }, (a) => printKotOnce({ kotId: 'k0', actor: a })),
  await run('kot: print once on a round whose every line was cancelled', { kot: { print_status: 'cancelled' }, allCancelled: true }, (a) =>
    printKotOnce({ kotId: 'k0', actor: a })
  ),
  await run('kot: on, its print job cannot be written', { printJobInsertFails: true }, round),
  await run('kot: never printed, quantity changed after the kitchen started', { kot: { print_status: 'cancelled', status: 'preparing' } }, (a) =>
    changeQty({ kotItemId: 'i1', qty: 2, actor: a })
  ),
  await run('kot: printed, quantity changed after the kitchen started', { kot: { print_status: 'printed', status: 'preparing' } }, (a) =>
    changeQty({ kotItemId: 'i1', qty: 2, actor: a })
  ),

  /* ── Invoice ─────────────────────────────────────────────────────────── */
  await run('invoice: no setting saved', {}, pay),
  await run('invoice: on', { print: { invoiceEnabled: true } }, pay),
  await run('invoice: off', { print: { invoiceEnabled: false } }, pay),
  await run('invoice: off, print once', { print: { invoiceEnabled: false } }, async (a) => {
    const paid = await pay(a);
    return { paid, printed: await printInvoiceOnce({ billId: 'b1', actor: a }) };
  }),
  await run('invoice: off, print once, tapped twice', { print: { invoiceEnabled: false } }, async (a) => {
    await pay(a);
    return [await printInvoiceOnce({ billId: 'b1', actor: a }), await printInvoiceOnce({ billId: 'b1', actor: a })];
  }),
  await run('invoice: off, print once, two at the same instant', { print: { invoiceEnabled: false } }, async (a) => {
    await pay(a);
    return Promise.all([printInvoiceOnce({ billId: 'b1', actor: a }), printInvoiceOnce({ billId: 'b1', actor: a })]);
  }),
  await run('invoice: on, print once after it printed by itself', {}, async (a) => {
    await pay(a);
    return printInvoiceOnce({ billId: 'b1', actor: a });
  }),
  await run('invoice: the payment recorded twice', {}, async (a) => [await pay(a), await pay(a)]),
  await run('invoice: off, the payment recorded twice', { print: { invoiceEnabled: false } }, async (a) => [await pay(a), await pay(a)]),
  await run('invoice: print once on an open bill', { billStatus: 'open' }, (a) => printInvoiceOnce({ billId: 'b1', actor: a })),
  await run('invoice: print once on a bill waiting for payment', { billStatus: 'payment_requested' }, (a) => printInvoiceOnce({ billId: 'b1', actor: a })),
  await run('invoice: print once on a cancelled order', { billStatus: 'void' }, (a) => printInvoiceOnce({ billId: 'b1', actor: a })),
  await run('invoice: a cancelled order is not paid, and prints nothing', { billStatus: 'void' }, pay),
  await run('invoice: print once without the grant', { billStatus: 'closed' }, (a) => printInvoiceOnce({ billId: 'b1', actor: a }), ['orders.reprint']),
  await run('invoice: print once with no bill printer', { billStatus: 'closed', printers: [{ ...SHARED, roles: ['KOT'] }] }, (a) =>
    printInvoiceOnce({ billId: 'b1', actor: a })
  ),
  await run('invoice: on, its print job cannot be written', { printJobInsertFails: true }, pay),

  /* ── The two switches are independent ───────────────────────────────── */
  await run('switches: KOT off, invoice on', { print: { kotEnabled: false, invoiceEnabled: true } }, async (a) => ({ round: await round(a), paid: await pay(a) })),
  await run('switches: KOT on, invoice off', { print: { kotEnabled: true, invoiceEnabled: false } }, async (a) => ({ round: await round(a), paid: await pay(a) })),
  await run('switches: both off, print both once', { print: OFF }, async (a) => {
    const placed = await round(a);
    await printKotOnce({ kotId: placed.kotId, actor: a });
    await pay(a);
    await printInvoiceOnce({ billId: 'b1', actor: a });
  }),
  await run('switches: save KOT off', { print: { invoiceEnabled: false, splitByFoodType: true } }, (a) =>
    writeSetting({ key: 'print', value: { kotEnabled: false }, actor: a }), ['set.printer']
  ),
  await run('switches: save invoice on', { print: { kotEnabled: false, invoiceEnabled: false } }, (a) =>
    writeSetting({ key: 'print', value: { invoiceEnabled: true }, actor: a }), ['set.printer']
  ),
  await run('switches: save without the printer grant', { print: { kotEnabled: true } }, (a) =>
    writeSetting({ key: 'print', value: { kotEnabled: false }, actor: a }), CAPTAIN
  ),
];

process.stdout.write(`${JSON.stringify({ results, firstInvoiceId: firstInvoiceJobId('b1'), otherInvoiceId: firstInvoiceJobId('b2') })}\n`);
