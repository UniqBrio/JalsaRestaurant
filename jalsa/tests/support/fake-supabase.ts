/**
 * fake-supabase — stands in for `@/lib/supabase/server` when a round-budget scenario is bundled
 * (tests/support/round-rig.ts). Never imported by application code.
 *
 * WHAT IT IS FOR
 *   Counting how many database round trips a screen waits for IN SEQUENCE. Every call sleeps a
 *   fixed latency and is recorded with its start and end, so "sequential rounds" is computed from
 *   the real code's real await structure — not from reading it. Measured on 24-Sep-2026, a round
 *   trip was the cost that mattered: ≈250 ms each while the functions ran in Washington against a
 *   Sydney database (requests/2026-09-24-app-feels-slow-measure-first.md).
 *
 * WHAT IT IS NOT
 *   A database. Answers come from the scenario's `respond(query)`; filters are recorded, not
 *   applied. It proves the SHAPE of the waiting, and that the code accepts well-formed rows.
 */

export interface FakeQuery {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  cols: string;
  filters: Array<[string, string, unknown]>;
  body: unknown;
  single: boolean;
  maybe: boolean;
  head: boolean;
}

export interface FakeCall {
  table: string;
  op: FakeQuery['op'];
  /** The select list, and the filters as `kind:column`, so a scenario can tell two reads apart. */
  cols: string;
  filters: string[];
  /** Keys of a written body — tells a `last_seen_at` stamp from a `bill_id` write. */
  wrote: string[];
  failed: boolean;
  t0: number;
  t1: number;
}

interface FakeState {
  latencyMs: number;
  /** Extra time for particular queries — a stalled read, for deadline scenarios. */
  delayFor?: (q: FakeQuery) => number;
  calls: FakeCall[];
  respond: (q: FakeQuery) => unknown[] | Record<string, unknown> | null;
}

const g = globalThis as unknown as { __fakeDb?: FakeState };

export function fakeDb(): FakeState {
  g.__fakeDb ??= { latencyMs: 20, calls: [], respond: () => [] };
  return g.__fakeDb;
}

/** Longest chain of calls where each starts only after the previous one finished. */
export function sequentialRounds(calls: FakeCall[]): number {
  const s = [...calls].sort((a, b) => a.t0 - b.t0);
  const chain: number[] = [];
  s.forEach((c, i) => {
    let best = 0;
    s.slice(0, i).forEach((prev, j) => {
      if (prev.t1 <= c.t0 + 1) best = Math.max(best, chain[j] ?? 0);
    });
    chain[i] = best + 1;
  });
  return chain.length ? Math.max(...chain) : 0;
}

type Answer = { data: unknown; error: null; count?: number };

class Builder {
  q: FakeQuery;
  constructor(table: string, op: FakeQuery['op'] = 'select', body: unknown = null) {
    this.q = { table, op, cols: '*', filters: [], body, single: false, maybe: false, head: false };
  }
  select(cols = '*', opts?: { head?: boolean; count?: string }) {
    if (this.q.op === 'select') this.q.cols = cols;
    if (opts?.head) this.q.head = true;
    return this;
  }
  insert(body: unknown) {
    this.q.op = 'insert';
    this.q.body = body;
    return this;
  }
  update(body: unknown) {
    this.q.op = 'update';
    this.q.body = body;
    return this;
  }
  upsert(body: unknown) {
    this.q.op = 'upsert';
    this.q.body = body;
    return this;
  }
  delete() {
    this.q.op = 'delete';
    return this;
  }
  private f(kind: string, col: string, val?: unknown) {
    this.q.filters.push([kind, col, val]);
    return this;
  }
  eq(c: string, v: unknown) {
    return this.f('eq', c, v);
  }
  neq(c: string, v: unknown) {
    return this.f('neq', c, v);
  }
  is(c: string, v: unknown) {
    return this.f('is', c, v);
  }
  not(c: string, op: string, v: unknown) {
    return this.f(`not.${op}`, c, v);
  }
  in(c: string, v: unknown) {
    return this.f('in', c, v);
  }
  ilike(c: string, v: unknown) {
    return this.f('ilike', c, v);
  }
  gt(c: string, v: unknown) {
    return this.f('gt', c, v);
  }
  gte(c: string, v: unknown) {
    return this.f('gte', c, v);
  }
  lt(c: string, v: unknown) {
    return this.f('lt', c, v);
  }
  lte(c: string, v: unknown) {
    return this.f('lte', c, v);
  }
  or(v: string) {
    return this.f('or', '', v);
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  range() {
    return this;
  }
  maybeSingle() {
    this.q.maybe = true;
    return this;
  }
  single() {
    this.q.single = true;
    return this;
  }
  // Awaitable like the real builder. Not declared as PromiseLike: the library's own generic
  // signature is stricter than a test double needs to be.
  then(ok?: (v: Answer) => unknown, bad?: (e: unknown) => unknown) {
    return run(this.q).then(ok, bad);
  }
}

async function run(q: FakeQuery): Promise<Answer> {
  const state = fakeDb();
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, state.latencyMs + (state.delayFor?.(q) ?? 0)));
  const record = (failed: boolean) =>
    state.calls.push({
      table: q.table,
      op: q.op,
      cols: q.cols,
      filters: q.filters.map(([k, c]) => `${k}:${c}`),
      wrote: q.body && typeof q.body === 'object' && !Array.isArray(q.body) ? Object.keys(q.body) : [],
      failed,
      t0,
      t1: performance.now(),
    });
  let answer: ReturnType<FakeState['respond']>;
  try {
    answer = state.respond(q);
  } catch (err) {
    // The real client answers `{ error }` and the data layer throws it; a rejection is the same
    // thing one step earlier.
    record(true);
    throw err;
  }
  record(false);
  // `{ __error }` answers the way the real client reports a failure: `{ data: null, error }`,
  // with no throw - the shape code that forgets to check `error` gets wrong (added 26-Sep-2026).
  if (answer && typeof answer === 'object' && !Array.isArray(answer) && '__error' in answer) {
    return { data: null, error: { message: String((answer as { __error: unknown }).__error) } } as unknown as Answer;
  }
  const rows = Array.isArray(answer) ? answer : answer === null ? [] : [answer];
  if (q.head) return { data: null, error: null, count: rows.length };
  if (q.single || q.maybe) return { data: rows[0] ?? null, error: null };
  return { data: q.op === 'rpc' ? answer : rows, error: null, count: rows.length };
}

const client = {
  from: (table: string) => new Builder(table),
  rpc: (name: string, args: unknown) => new Builder(name, 'rpc', args),
};

export function db() {
  return client;
}

export async function currentRestaurantId(): Promise<string> {
  return 'r1';
}

export function isConfigured(): boolean {
  return true;
}
