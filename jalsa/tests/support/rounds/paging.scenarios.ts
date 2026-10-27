/**
 * Paged ledger and report reads (26-Oct-2026 audit, PERF-02) - bundled and run by
 * tests/unit/security-audit-26oct.unit.spec.ts. Calls the REAL query functions against
 * fake-supabase, which answers the way PostgREST does: at most MAX_ROWS rows per request, the
 * requested `.range()` when there is one and the first MAX_ROWS when there is not.
 */
import { listClosedBillsBetween, listExpenses, listExpensesBetween, listTips } from '@/lib/db/queries';
import { fakeDb, type FakeQuery } from '../fake-supabase';

/** PostgREST's default `max_rows`. */
const MAX_ROWS = 1000;
/** More than two pages, so a reader that stops after one page, or after two, is caught. */
const STORED = 2007;

const ROW: Record<string, (i: number) => Record<string, unknown>> = {
  bill: (i) => ({
    id: `b${i}`,
    code: `B-${i}`,
    status: 'closed',
    closed_at: '2026-10-20T12:00:00Z',
    kot: [],
    tip: [],
  }),
  tip: (i) => ({
    id: `t${i}`,
    amount: 10,
    settled_at: null,
    created_at: '2026-10-20T12:00:00Z',
    staff: null,
    bill: null,
  }),
  expense: (i) => ({ id: `e${i}`, spent_on: '2026-10-20', category: 'Gas', note: '', amount: 1, entered_by: 'x' }),
};

function respond(q: FakeQuery): unknown[] {
  const make = ROW[q.table];
  if (!make || q.op !== 'select') return [];
  const [from, to] = q.range ?? [0, MAX_ROWS - 1];
  const end = Math.min(to + 1, from + MAX_ROWS, STORED);
  return Array.from({ length: Math.max(0, end - from) }, (_, k) => make(from + k));
}

async function run(name: string, read: () => Promise<unknown[]>) {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 0;
  db.respond = respond;
  const rows = await read();
  return {
    name,
    stored: STORED,
    returned: rows.length,
    distinct: new Set(rows.map((r) => (r as { id: string }).id)).size,
    requests: db.calls.length,
  };
}

const results = [
  await run('listClosedBillsBetween', () => listClosedBillsBetween('2026-10-01', '2026-10-31')),
  await run('listTips', () => listTips()),
  await run('listExpenses', () => listExpenses()),
  await run('listExpensesBetween', () => listExpensesBetween('2026-10-01', '2026-10-31')),
];

process.stdout.write(`${JSON.stringify(results)}\n`);
