/**
 * Takeaway scenarios (02-Oct-2026) — bundled and run by tests/unit/takeaway-flow.unit.spec.ts.
 *
 * Calls the REAL `placeTakeaway` (and through it the real `placeRound` and `queuePrint`) against
 * fake-supabase, and reports every row it tried to write, so the spec can hold the order path to:
 * a bill at no table, a round with no table, packaging stored as entered, the KOT routed by the
 * same printers as any round - and nothing at all written when the order is refused.
 */
import { closeBill, placeTakeaway } from '@/lib/db/mutations';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const iso = new Date().toISOString();

interface World {
  grants: string[];
  /** The `tax` setting's `packagingTaxable`: undefined means the owner has not decided. */
  packagingTaxable?: boolean;
  /** Every dish is sold out. */
  soldOut?: boolean;
  /** The printers, as `printer` rows. */
  printers?: Array<Record<string, unknown>>;
  /** For a CLOSE: the open takeaway's packaging charge and its GST decision. */
  open?: { packaging: number; taxable: boolean | null };
}

/** An open takeaway as `BILL_SELECT` returns it: two plates of fried rice at ₹170, no table. */
const takeawayRow = (open: { packaging: number; taxable: boolean | null }) => ({
  id: 'b-take',
  code: 'TK-1',
  status: 'open',
  group_code: null,
  guests: 1,
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
  packaging_charge: open.packaging,
  packaging_taxable: open.taxable,
  host_table: null,
  captain: null,
  waiter: null,
  closed_by: null,
  discount_by: null,
  bill_table: [],
  tip: [],
  kot: [
    {
      id: 'k1',
      code: 'KOT-1',
      status: 'served',
      source: 'owner',
      placed_by_label: 'Meena · Owner',
      note: '',
      print_status: 'printed',
      print_attempts: 1,
      reprint_count: 0,
      created_at: iso,
      started_at: null,
      ready_at: null,
      picked_up_at: null,
      served_at: null,
      dining_table: null,
      kot_item: [
        { id: 'i1', name: 'Chicken Fried Rice', unit_price: 170, qty: 2, food_type: 'non_veg', food_type_name: 'Non-veg', qty_before: null, cancelled_at: null, cancel_reason: '', menu_category_name: 'Rice', menu_parent_category_name: '', line_seq: 1 },
      ],
      print_job: [],
    },
  ],
});

const KITCHEN_ONLY = [
  { id: 'p-kot', machine_id: 'KOT-1', name: 'Kitchen', purpose: 'KOT', roles: ['KOT'], default_roles: [], station: 'Main Kitchen', routes: [], online: false, enabled: true },
];
const ONE_FOR_BOTH = [
  { id: 'p-both', machine_id: 'POS-1', name: 'Counter', purpose: 'KOT', roles: ['KOT', 'Invoice'], default_roles: [], station: 'Billing', routes: [], online: false, enabled: true },
];

function responder(world: World, writes: Array<{ table: string; op: string; body: unknown }>) {
  return (q: FakeQuery): unknown[] | Record<string, unknown> | null => {
    if (q.op !== 'select' && q.op !== 'rpc') writes.push({ table: q.table, op: q.op, body: q.body });
    if (q.op === 'rpc') return 'TK-1' as unknown as Record<string, unknown>;
    switch (q.table) {
      case 'setting':
        if (q.filters.some(([k, c, v]) => k === 'eq' && c === 'key' && v === 'tax'))
          return [{ value: { rate: 5, ...(world.packagingTaxable === undefined ? {} : { packagingTaxable: world.packagingTaxable }) } }];
        return [];
      case 'menu_item':
        return [
          {
            id: 'm1',
            name: 'Chicken Fried Rice',
            price: 170,
            food_type: 'non_veg',
            available: !world.soldOut,
            closed_until: null,
            printer_id: null,
            station: null,
            food_type_ref: { name: 'Non-veg' },
            menu_category: { name: 'Rice', parent_id: null, parent: null },
          },
        ];
      case 'printer': {
        const kind = q.filters.find(([k, c]) => k === 'cs' && c === 'roles')?.[2] as string[] | undefined;
        const all = world.printers ?? KITCHEN_ONLY;
        return kind ? all.filter((p) => (p.roles as string[]).includes(kind[0]!)) : all;
      }
      case 'bill':
        if (q.op === 'insert') return [{ id: 'b-take' }];
        if (q.op === 'select' && world.open) return [takeawayRow(world.open)];
        return [];
      case 'kot':
        return q.op === 'insert' ? [{ id: 'k1' }] : [];
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

async function run(name: string, world: World, input: { packagingCharge: number }) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const writes: Array<{ table: string; op: string; body: unknown }> = [];
  db.respond = responder(world, writes);
  try {
    const out = await placeTakeaway({
      lines: [{ menuItemId: 'm1', qty: 2 }],
      packagingCharge: input.packagingCharge,
      source: 'owner',
      actor: ownerWith(world.grants),
    });
    return { name, out, threw: null, writes };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? err.message : String(err), writes };
  }
}

async function close(name: string, world: World) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  const writes: Array<{ table: string; op: string; body: unknown }> = [];
  db.respond = responder(world, writes);
  try {
    const out = await closeBill({ billId: 'b-take', mode: 'Cash', actor: ownerWith(['bill.record_payment']) });
    return { name, out, threw: null, writes };
  } catch (err) {
    return { name, out: null, threw: err instanceof Error ? err.message : String(err), writes };
  }
}

const BOTH = ['orders.create', 'orders.add_items'];
const results = [
  await run('placed with no packaging', { grants: BOTH }, { packagingCharge: 0 }),
  await run('packaging, GST decision not made', { grants: BOTH }, { packagingCharge: 40 }),
  await run('packaging, no GST on it', { grants: BOTH, packagingTaxable: false }, { packagingCharge: 40 }),
  await run('packaging, GST on it', { grants: BOTH, packagingTaxable: true }, { packagingCharge: 25 }),
  await run('no orders.create', { grants: ['orders.add_items'] }, { packagingCharge: 0 }),
  await run('a negative packaging charge', { grants: BOTH, packagingTaxable: true }, { packagingCharge: -50 }),
  await run('everything sold out', { grants: BOTH, soldOut: true }, { packagingCharge: 0 }),
  await run('one printer for both', { grants: BOTH, printers: ONE_FOR_BOTH }, { packagingCharge: 0 }),
  // CLOSING a takeaway: 2 x Rs.170 = 340 of food, Rs.25 packaging, 5% GST.
  await close('close, packaging untaxed, one printer for both', { grants: [], printers: ONE_FOR_BOTH, open: { packaging: 25, taxable: false } }),
  await close('close, packaging taxed', { grants: [], printers: ONE_FOR_BOTH, open: { packaging: 25, taxable: true } }),
  await close('close, only a kitchen printer', { grants: [], printers: KITCHEN_ONLY, open: { packaging: 0, taxable: null } }),
];
void iso;
process.stdout.write(`${JSON.stringify(results)}\n`);
