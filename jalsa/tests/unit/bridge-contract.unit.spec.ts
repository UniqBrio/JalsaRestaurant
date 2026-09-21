/**
 * bridge-contract unit spec — what a print bridge may do, and the much longer list of what it
 * structurally cannot.
 *
 * WHY THIS FILE READS SOURCE AS WELL AS CALLING IT
 *   The Gate 1 guarantees are properties of writes and of type shapes: which columns a patch may
 *   contain, which status a path can produce, which fields an input type does NOT have. None of
 *   that can be exercised without a database, and `schema-columns.unit.spec.ts` set the precedent
 *   for exactly this shape of problem — read the files, which are the only description of the
 *   behaviour this repository owns, and assert the property. A rung that needs a database is a
 *   rung that skips, and a skip reads as a pass.
 *
 *   The claim's ATOMICITY is not asserted here at all, because a source file cannot demonstrate
 *   it. It was proved against the TEST database through MCP on 21-Sep-2026: two identical
 *   conditional updates against one queued job returned 1 row and 0 rows respectively. That run
 *   is recorded in TEST_SUMMARY.md. What this file pins is that the CODE still issues the
 *   statement that has that property.
 *
 * FAIL-FIRST EVIDENCE (21-Sep-2026): recorded in TEST_SUMMARY.md. Each guarantee was re-checked
 * by injecting its defect into the finished tree and re-running; the per-defect results are in
 * that ledger.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hashToken, bearerFrom } from '../../src/lib/bridge-token';

const read = (p: string): string => readFileSync(p, 'utf8');

const AUTH = read('src/lib/bridge-auth.ts') + read('src/lib/bridge-token.ts');
const MUT = read('src/lib/db/bridge-mutations.ts');
const ROUTE = read('src/app/api/bridge/route.ts');
const MIGRATION = read('supabase/migrations/20260921090000_jalsa_print_bridge.sql');
const PHASE1 = read('src/lib/db/mutations.ts');

/**
 * The same source with comments removed.
 *
 * "This identifier does not appear" is the wrong question when the file DOCUMENTS why it is
 * absent. Both of these rungs first went red on their own explanations — `bridge-auth.ts` has a
 * heading reading "WHY NOT `SUPABASE_SECRET_KEY`", and the route has a comment mentioning the
 * sweeper. A rung that punishes a file for explaining itself teaches people to stop explaining.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
}

function bodyOf(source: string, name: string): string | null {
  const start = source.search(new RegExp(`(export )?async function ${name}\\(`));
  if (start === -1) return null;
  const end = source.indexOf('\n}\n', start);
  return end === -1 ? null : source.slice(start, end);
}

/** Field assignments to a status column, whatever expression produces the value. */
function statusWrites(body: string): Array<[string, string]> {
  return [...body.matchAll(/(?:^|[\s{(])(status|print_status):([^\n]*)/gm)].map((m) => [m[1] ?? '', m[2] ?? '']);
}

/* ── The parse guard ───────────────────────────────────────────────────── */

test('the sources this rung reasons about were actually read', () => {
  // Binding rule 3: a detector that parsed nothing reports BLOCKED, never success.
  expect(AUTH.length, 'bridge-auth.ts').toBeGreaterThan(2000);
  expect(MUT.length, 'bridge-mutations.ts').toBeGreaterThan(4000);
  expect(ROUTE.length, 'the bridge route').toBeGreaterThan(1500);
  expect(bodyOf(MUT, 'reportPrintJob'), 'reportPrintJob body').not.toBeNull();
  expect(bodyOf(MUT, 'no_such_function'), 'and one known not to exist').toBeNull();
});

/* ── Schema ────────────────────────────────────────────────────────────── */

test('the migration adds the in-flight status and the claim, and nothing routing-shaped', () => {
  expect(MIGRATION).toContain("add value if not exists 'processing'");
  expect(MIGRATION).toContain('add column if not exists claimed_by');
  expect(MIGRATION).toContain('add column if not exists claimed_at');
  expect(MIGRATION).toContain('create index if not exists print_job_claimed_idx');
  // It must not touch the assignment the Phase 1 trigger protects.
  expect(MIGRATION).not.toMatch(/alter table public\.print_job[\s\S]*printer_id/);
});

test('the enum value is added but never USED in the same migration', () => {
  // Postgres refuses to use a new enum label in the transaction that introduced it. A migration
  // that half-applies is worse than one that does one thing, so the label is added and left.
  const body = MIGRATION.slice(MIGRATION.indexOf('begin;'));
  const uses = [...body.matchAll(/'processing'/g)];
  expect(uses.length, "only the `add value` mentions 'processing'").toBe(1);
});

test('bridge tokens are stored hashed, and the table carries the same RLS posture as the rest', () => {
  expect(MIGRATION).toContain('token_hash');
  expect(MIGRATION).toContain('alter table public.bridge_token enable row level security');
  // The raw token must not be a column. A dump of this table yields no working credential.
  expect(MIGRATION).not.toMatch(/^\s+token\s+text/m);
});

/* ── Authentication ────────────────────────────────────────────────────── */

test('a token is matched by its SHA-256, never stored in the clear', () => {
  // Stable, and the value the migration's unique index is on.
  expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(hashToken('abc')).toHaveLength(64);
  expect(hashToken('abc')).not.toBe(hashToken('abd'));
});

test('only a properly formed Bearer header is accepted', () => {
  const h = (v: string | null): Request =>
    new Request('https://x.test/api/bridge', { headers: v === null ? {} : { authorization: v } });

  expect(bearerFrom(h('Bearer tok_123'))).toBe('tok_123');
  expect(bearerFrom(h('bearer tok_123')), 'scheme is case-insensitive').toBe('tok_123');
  expect(bearerFrom(h('  Bearer   tok_123  '))).toBe('tok_123');
  // A bare token is refused: supporting two formats forever means the looser one ends up in a
  // URL query string, where it lands in access logs.
  expect(bearerFrom(h('tok_123'))).toBeNull();
  expect(bearerFrom(h('Basic tok_123'))).toBeNull();
  expect(bearerFrom(h(''))).toBeNull();
  expect(bearerFrom(h(null))).toBeNull();
});

test('AUTH FAILS CLOSED — an unreachable lookup is "no", never "yes"', () => {
  const a = bodyOf(AUTH, 'authenticateBridge') ?? '';
  expect(a).toContain('if (error || !data) return null;');
  expect(a, 'a revoked token is dead').toContain('revoked_at');
  // The secret key must never be handed to the bridge, in any form. Asked of the CODE: the file
  // names the variable in a comment precisely to explain why it is not used.
  expect(code(AUTH), 'the secret key is never read here').not.toContain('SUPABASE_SECRET_KEY');
  expect(code(AUTH)).not.toContain('serverConfig');
});

/* ── The claim ─────────────────────────────────────────────────────────── */

test('THE CLAIM IS ONE CONDITIONAL UPDATE — the property atomicity rests on', () => {
  const c = bodyOf(MUT, 'claimPrintJob') ?? '';
  expect(c).toContain(".eq('status', 'queued')");
  expect(c).toContain("status: 'processing'");
  expect(c).toContain('claimed_by');
  // Read-then-write leaves a window where two bridges both see `queued`. There must be no select
  // of this job before the update.
  expect(c).not.toContain(".select('id,status')");
  expect(c).not.toMatch(/\.from\('print_job'\)\s*\n\s*\.select\(/);
  // Losing is ordinary, not exceptional.
  expect(c).toContain('return null;');
});

test('a claim is scoped to the bridge restaurant', () => {
  for (const fn of ['claimPrintJob', 'reportPrintJob', 'listBridgeJobs']) {
    expect(bodyOf(MUT, fn) ?? '', `${fn} is tenant-scoped`).toContain('restaurantId');
  }
});

/* ── The report ────────────────────────────────────────────────────────── */

test('THE REPORT CANNOT NAME A PRINTER — rerouting is not expressible', () => {
  const r = bodyOf(MUT, 'reportPrintJob') ?? '';
  const patch = /\.update\(\{([\s\S]*?)\n\s*\}\)/.exec(r)?.[1] ?? '';
  expect(patch.length, 'the report patch was located').toBeGreaterThan(20);

  const keys = [...patch.matchAll(/^\s{6}(\w+)\s*[,:]/gm)].map((m) => m[1]).sort();
  expect(keys, 'exactly what a report may change').toEqual([
    'completed_at',
    'last_attempt_at',
    'last_error',
    'status',
  ]);
  for (const frozen of ['printer_id', 'printer_name', 'station', 'routing_rule']) {
    expect(keys, `${frozen} is the assignment and a bridge may not touch it`).not.toContain(frozen);
  }

  // And the input type itself has no vocabulary for it.
  expect(ROUTE).not.toMatch(/action: 'report'[^}]*printer/);
  expect(r).not.toContain('printerId');
});

test('a bridge may only report on a job it is HOLDING', () => {
  const r = bodyOf(MUT, 'reportPrintJob') ?? '';
  // Not claimed, claimed by someone else, or already swept: all three update nothing.
  expect(r).toContain(".eq('status', 'processing')");
  expect(r).toContain(".eq('claimed_by', input.bridge.label)");
  expect(r).toContain('return { applied: false };');
  expect(ROUTE, 'and the route says so rather than pretending it worked').toContain('not_claimed');
});

test('a bridge can report only two outcomes — it cannot re-queue anything', () => {
  expect(MUT).toContain("export type BridgeOutcome = 'printed' | 'failed';");
  const r = bodyOf(MUT, 'reportPrintJob') ?? '';
  for (const [, value] of statusWrites(r)) {
    expect(value, 'a report never writes queued or processing').not.toContain("'queued'");
    expect(value, 'a report never writes queued or processing').not.toContain("'processing'");
  }
});

/* ── printed, and who may write it ─────────────────────────────────────── */

test('PRINTED IS REACHABLE ONLY FROM A BRIDGE REPORT', () => {
  // The Phase 1 order paths must still be unable to write it. This is the Phase 1 guarantee,
  // re-asserted from the Phase 2 side so that adding a writer cannot quietly reopen it.
  for (const fn of ['queuePrint', 'retryPrintJob', 'printElsewhere']) {
    for (const [field, value] of statusWrites(bodyOf(PHASE1, fn) ?? '')) {
      expect(value, `${fn} must still not write ${field} 'printed'`).not.toContain("'printed'");
    }
  }
  // And exactly one Phase 2 function does write it.
  const writers = ['reportPrintJob', 'sweepStaleClaims', 'claimPrintJob', 'listBridgeJobs'].filter((fn) =>
    statusWrites(bodyOf(MUT, fn) ?? '').some(([, v]) => v.includes("'printed'"))
  );
  expect(writers).toEqual(['reportPrintJob']);
});

/* ── The sweeper ───────────────────────────────────────────────────────── */

test('A STALE CLAIM EXPIRES TO failed AND NEVER TO queued', () => {
  // A bridge that vanished may have put paper in the kitchen a moment before it died. Re-queueing
  // asserts it did not, and a wrong assertion prints the round twice.
  const s = bodyOf(MUT, 'sweepStaleClaims') ?? '';
  expect(s.length, 'sweepStaleClaims exists').toBeGreaterThan(200);
  expect(s).toContain("status: 'failed'");
  for (const [, value] of statusWrites(s)) {
    expect(value, 'the sweeper must never re-queue').not.toContain("'queued'");
  }
  expect(s).toContain(".eq('status', 'processing')");
  expect(s).toContain(".lt('claimed_at'");
});

test('the sweeper is server-side only — a bridge cannot adjudicate its own death', () => {
  // It must not be reachable from the bridge's three verbs. Asked of the CODE, because the route
  // legitimately mentions the sweeper in a comment about late reports.
  expect(code(ROUTE), 'the sweeper is not callable from the bridge surface').not.toContain('sweep');
});

/* ── The surface as a whole ────────────────────────────────────────────── */

test('the bridge can reach three verbs and no others', () => {
  const actions = [...ROUTE.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]).sort();
  expect(actions).toEqual(['claim', 'list', 'report']);
  // Nothing about bills, guests, menus or staff is importable here.
  for (const forbidden of ['closeBill', 'placeRound', 'listMenu', 'currentStaff', 'reprintKot']) {
    expect(ROUTE, `the bridge route must not import ${forbidden}`).not.toContain(forbidden);
  }
});

test('an unauthenticated caller is refused before the body is read', () => {
  const authIndex = ROUTE.indexOf('authenticateBridge');
  const bodyIndex = ROUTE.indexOf('await body<');
  expect(authIndex).toBeGreaterThan(-1);
  expect(authIndex, 'authentication happens first').toBeLessThan(bodyIndex);
  expect(ROUTE).toContain("fail(401");
});

test('the round badge learns the new state, pessimistically', () => {
  const sync = bodyOf(PHASE1, 'syncKotPrintState') ?? '';
  expect(sync).toContain("'processing'");
  // Order is the pessimism: any failure outranks everything; printed requires ALL.
  const failedAt = sync.indexOf("j.status === 'failed'");
  const printedAt = sync.indexOf("j.status === 'printed'");
  const processingAt = sync.indexOf("j.status === 'processing'");
  expect(failedAt).toBeLessThan(printedAt);
  expect(printedAt).toBeLessThan(processingAt);
});

test('"Sending…" is not a claim that paper moved', () => {
  const ui = read('src/components/ui/print.tsx');
  expect(ui).toContain("processing: { word: 'Sending…'");
  expect(ui).not.toContain("processing: { word: 'Printed'");
});
