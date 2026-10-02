/**
 * Takeaway scenarios (02-Oct-2026) — bundled and run by tests/unit/takeaway-flow.unit.spec.ts.
 *
 * Calls the REAL `placeTakeaway` (and through it the real `placeRound` and `queuePrint`) against
 * fake-supabase, and reports every row it tried to write, so the spec can hold the order path to:
 * a bill at no table, a round with no table, packaging stored as entered, the KOT routed by the
 * same printers as any round - and nothing at all written when the order is refused.
 */
import { placeTakeaway } from '@/lib/db/mutations';
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
}

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
];
void iso;
process.stdout.write(`${JSON.stringify(results)}\n`);
