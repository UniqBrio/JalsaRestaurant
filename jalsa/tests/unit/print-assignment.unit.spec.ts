/**
 * print-assignment unit spec — a print job knows the exact physical printer it was assigned to,
 * and every later action honours that assignment.
 *
 * WHY HALF OF THIS FILE READS SOURCE INSTEAD OF CALLING IT
 *   The rules this phase turns on are properties of writes: which column a patch contains, which
 *   status string an insert can produce, whether a function consults routing. None of that can be
 *   exercised without a database, and `schema-columns.unit.spec.ts` established the answer for
 *   exactly this shape of problem — read the files, which are the only description of the
 *   behaviour this repository owns, and assert the property. A rung that needs a database is a
 *   rung that skips, and a skip reads as a pass.
 *
 *   The pure decisions — routing, the split, the vocabulary — are called for real.
 *
 * FAIL-FIRST EVIDENCE (19-Sep-2026)
 *
 * Run 0 — against the true pre-fix tree at ef930ea, with only this file added:
 *   **NOT OBSERVED FAILING PER-CASE.** The file does not collect at all — it imports
 *   `src/components/ui/print.tsx`, which did not exist, so Playwright reports "No tests found".
 *   That is evidence the file is new, not evidence any single rung can fail, so each of the
 *   three shipped defects was then put back into the FINISHED tree, one at a time, and the
 *   suite re-run. Those runs are the real evidence:
 *
 * Run A — `retryPrintJob` re-selects a printer and patches `printer_id`, as it shipped:
 *   **3 failed, 23 passed** — "RETRY MUST NOT REASSIGN THE PRINTER", "RETRY MUST NOT RE-RUN
 *   ROUTING", and "a failed Tandoor ticket can never be retried onto the Main Kitchen machine".
 *   The third is the scenario in the request, and it went red on the defect that caused it.
 *
 * Run B — `queuePrint` writes one job for the whole round with
 *   `status: reachable ? 'printed' : 'failed'`, as it shipped:
 *   **2 failed, 24 passed** — "a printer answering is not a job succeeding" and "NOTHING IN THE
 *   PRINT PATH MAY WRITE printed". The second went red only after the rung was rewritten: the
 *   first version asked for `status: 'printed'` literally and the real defect is a TERNARY, so
 *   it passed over the exact thing it is named after. That near-miss is why `statusWrites`
 *   matches the field and takes whatever expression follows.
 *
 * Run C — `reprintKot` passes no items, as it shipped:
 *   **1 failed, 25 passed** — "A REPRINT ROUTES ON WHAT THE ROUND CONTAINS".
 *
 * Finished tree: **26 passed**.
 *
 * ONE HONEST LIMIT. "the split is what the order path actually calls" asserts that the CALL is
 * present, not that it is reachable — under Run B, written as a dead `false &&` branch, it
 * stayed green. Static analysis cannot answer reachability, and the pretence that it can is
 * worse than the gap. What `splitRound` DOES is executed for real, further down this file.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  mainPrinter,
  printerShortName,
  resolvePrinter,
  splitRound,
  type RoutablePrinter,
} from '../../src/lib/print-routing';
import { PRINT_STATUS, printDestination } from '../../src/components/ui/print';
import type { KotPrintJob } from '../../src/lib/db/types';

const read = (p: string): string => readFileSync(p, 'utf8');

const MUTATIONS = read('src/lib/db/mutations.ts');
const QUERIES = read('src/lib/db/queries.ts');
const MIGRATION = read('supabase/migrations/20260919090000_jalsa_print_job_assignment.sql');
/* R4-1 (22-Sep-2026): the module that now names the side, and the migration that persists it. */
const ROUTING = read('src/lib/print-routing.ts');

/**
 * The same source with comments removed.
 *
 * Same reason as `bridge-contract.unit.spec.ts`: these files explain at length what they must not
 * do, and a rung that goes red on a file's own explanation teaches people to stop explaining.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
}

/**
 * One exported function's body, by name.
 *
 * Assertions below are about what ONE function does. Searched across the whole file, "does not
 * write printer_id" is false for the module (`queuePrint` must write it) while being exactly the
 * rule for `retryPrintJob` — so the question has to be asked of a function, not of a file.
 */
/**
 * Every expression one function assigns to a status column.
 *
 * Asking whether a body "contains status: 'printed'" is not the question: the defect shipped as
 * `status: reachable ? 'printed' : 'failed'`, which that phrasing does not match, and a rung
 * blind to the exact form of the defect it is named after is decoration. Matching the FIELD and
 * taking whatever expression follows catches every form.
 *
 * Deliberately the field and not the whole payload. `printElsewhere` writes
 * `is_reprint: job.status === 'printed'` — reading the old job's status to decide whether the
 * paper needs marking, which is exactly right — and a payload-wide search would call that the
 * defect. Deliberately the whole body and not a located `.insert({…})`: `queuePrint` builds its
 * rows with `.map()` and inserts an array, so a payload matcher finds nothing there and reports
 * a clean function by failing to parse it.
 */
function statusWrites(body: string): Array<[string, string]> {
  return [...body.matchAll(/(?:^|[\s{(])(status|print_status):([^\n]*)/gm)].map((m) => [m[1] ?? '', m[2] ?? '']);
}

function bodyOf(source: string, name: string): string | null {
  // Exported or not: `routablePrinters` is module-private and is exactly the function whose
  // ORDER BY this file has to assert.
  const start = source.search(new RegExp(`(export )?async function ${name}\\(`));
  if (start === -1) return null;
  const end = source.indexOf('\n}\n', start);
  return end === -1 ? null : source.slice(start, end);
}

/* ── The parse guard ───────────────────────────────────────────────────── */

test('the sources were actually read — a rung that parsed nothing is not a passing rung', () => {
  // Binding rule 3: a detector that parsed nothing reports BLOCKED, never success. A bad path
  // here would make every `not.toContain` below vacuously true, which is the exact shape of a
  // check that has silently stopped checking.
  expect(MUTATIONS.length, 'mutations.ts').toBeGreaterThan(10000);
  expect(MIGRATION.length, 'the assignment migration').toBeGreaterThan(2000);
  expect(bodyOf(MUTATIONS, 'retryPrintJob'), 'retryPrintJob body').not.toBeNull();
  expect(bodyOf(MUTATIONS, 'queuePrint'), 'queuePrint body').not.toBeNull();
  expect(bodyOf(MUTATIONS, 'no_such_function_anywhere'), 'and one known not to exist').toBeNull();
});

/* ── 1 · The job stores the exact printer ──────────────────────────────── */

test('a print job is written with the printer the decision chose, and its snapshot', () => {
  const q = bodyOf(MUTATIONS, 'queuePrint') ?? '';
  expect(q).toContain('printer_id: t.printerId');
  // The name and the station travel WITH the job. Joined instead, renaming a machine at nine
  // o'clock would silently rewrite where the eight o'clock ticket went.
  expect(q).toContain('printer_name: t.printerName');
  expect(q).toContain('station: t.station');
  expect(q).toContain('routing_rule: t.rule');
});

test('the schema carries the assignment, not only the foreign key', () => {
  for (const column of ['station', 'printer_name', 'routing_rule', 'last_attempt_at', 'redirected_from_job_id']) {
    expect(MIGRATION, `print_job.${column}`).toContain(`add column if not exists ${column}`);
  }
});

test('THE ASSIGNMENT IS IMMUTABLE IN THE DATABASE — not only in the layer that broke it', () => {
  // The rule the whole phase rests on, enforced where application code cannot route around it.
  expect(MIGRATION).toContain('print_job_printer_is_immutable');
  expect(MIGRATION).toContain('before update on public.print_job');
  expect(MIGRATION).toMatch(/raise exception[\s\S]*immutable/i);
});

/* ── 2 & 3 · Retry re-sends; it does not re-decide ─────────────────────── */

test('RETRY MUST NOT REASSIGN THE PRINTER — the defect this phase exists to remove', () => {
  const r = bodyOf(MUTATIONS, 'retryPrintJob') ?? '';

  // It shipped as `printer_id: target?.id ?? null` inside the patch. Anything that writes that
  // column here is that defect returning, whatever it is called.
  expect(r).not.toContain('printer_id:');

  // `printer_name` and `station` are asked of the PATCH rather than of the whole body, because
  // retry legitimately READS both — it returns them so the toast can say which machine the
  // ticket went back to. Reading the assignment is the point; rewriting it is the defect.
  const patch = /\.update\(\{([\s\S]*?)\}\)/.exec(r)?.[1] ?? '';
  expect(patch.length, 'the retry patch was located').toBeGreaterThan(20);
  expect(patch).not.toContain('printer_name');
  expect(patch).not.toContain('station');
});

test('RETRY MUST NOT RE-RUN ROUTING — it has none of the context routing needs', () => {
  const r = bodyOf(MUTATIONS, 'retryPrintJob') ?? '';
  for (const router of ['resolvePrinter', 'splitRound', 'mainPrinter', 'routablePrinters']) {
    expect(r, `retryPrintJob must not call ${router}`).not.toContain(router);
  }
  // Nor may it reach the printer table by hand, which is how it re-chose before.
  expect(r).not.toContain("from('printer')");
});

test('retry reads the assignment it is honouring, and refuses when there is none', () => {
  const r = bodyOf(MUTATIONS, 'retryPrintJob') ?? '';
  expect(r).toContain('printer_id');            // in the select
  expect(r).toContain('if (!job.printer_id)');  // and the honest refusal
  // Picking a machine for the operator is precisely what must not happen; the answer is to say so.
  expect(r).toContain('Print elsewhere');
});

test('a failed Tandoor ticket can never be retried onto the Main Kitchen machine', () => {
  // The scenario in one assertion, as a WHITELIST rather than a list of things to avoid.
  //
  // A blacklist ("the patch must not say printer_id") only ever catches the defect somebody
  // already thought of; the next column that should not be rewritten — `station`, or whatever
  // Phase 2 adds — arrives unguarded. Naming the complete set inverts that: anything new in the
  // patch fails this rung until a person adds it here deliberately.
  const r = bodyOf(MUTATIONS, 'retryPrintJob') ?? '';
  const patch = /\.update\(\{([\s\S]*?)\}\)/.exec(r)?.[1] ?? '';
  expect(patch.length, 'the retry patch was located').toBeGreaterThan(20);

  // `[,:]` because `attempts,` is written as a shorthand property and has no colon — a matcher
  // that demanded one would silently drop it and assert over a set it had mis-parsed.
  const keys = [...patch.matchAll(/^\s{6}(\w+)\s*[,:]/gm)].map((m) => m[1]).sort();
  expect(keys, 'exactly what a retry may change').toEqual([
    'attempts',
    'completed_at',
    'last_attempt_at',
    'last_error',
    'status',
  ]);

  // Said again in the language of the objective: the four facts that constitute the assignment
  // are untouched, so the ticket cannot move rooms.
  for (const frozen of ['printer_id', 'printer_name', 'station', 'routing_rule']) {
    expect(keys, `${frozen} is part of the assignment and is never re-patched`).not.toContain(frozen);
  }
});

/* ── 4 · Sending it somewhere else is a decision, and a new job ────────── */

test('Print elsewhere requires a printer from the operator and never picks one', () => {
  const e = bodyOf(MUTATIONS, 'printElsewhere') ?? '';
  expect(e.length, 'printElsewhere exists').toBeGreaterThan(200);
  expect(e).toContain('printerId: string');
  for (const router of ['resolvePrinter', 'splitRound', 'mainPrinter']) {
    expect(e, `printElsewhere must not call ${router}`).not.toContain(router);
  }
  // A new row pointing at the one it replaces — never an edit, because the original is evidence.
  expect(e).toContain('redirected_from_job_id');
  expect(e).toContain(".from('print_job')\n    .insert(");
});

/* ── 5 · A reprint routes on the round it is reprinting ────────────────── */

test('A REPRINT ROUTES ON WHAT THE ROUND CONTAINS — it used to route on nothing', () => {
  // `queuePrint` with no items resolves the empty category, which no machine claims, so every
  // reprint took the "nobody claims this" branch to the fallback machine. The tandoor's ticket
  // reprinted in the main kitchen, by construction, every single time.
  const r = bodyOf(MUTATIONS, 'reprintKot') ?? '';
  expect(r).toContain('items: await kotPrintableItems(');

  const c = bodyOf(MUTATIONS, 'changeQty') ?? '';
  expect(c, 'a quantity change reprints too, and routes the same way').toContain('items: await kotPrintableItems(');
});

test('the category a reprint routes on is a snapshot on the round, not a join', () => {
  // Joined through `menu_item`, a category renamed between the order and the reprint would send
  // the reprint to a different station than the original. Snapshotted, it cannot.
  expect(MIGRATION).toContain('add column if not exists menu_category_name');
  expect(MUTATIONS).toContain('menu_category_name:');
  expect(bodyOf(MUTATIONS, 'kotPrintableItems') ?? '').toContain('menu_category_name');
});

/* ── 6 · No decision depends on array order ────────────────────────────── */

const printer = (p: Partial<RoutablePrinter> & { id: string; machineId: string }): RoutablePrinter => ({
  name: `Machine ${p.id}`,
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: true,
  enabled: true,
  ...p,
});

const KITCHEN_1 = printer({ id: 'k1', machineId: 'KOT-VEG-01', name: 'TVS RP 3160 Gold — Kitchen 1' });
const KITCHEN_2 = printer({
  id: 'k2',
  machineId: 'KOT-NV-01',
  name: 'TVS RP 3160 Gold — Kitchen 2',
  routes: ['Biryani'],
});
const TANDOOR = printer({
  id: 'tan',
  machineId: 'KOT-TAN-01',
  name: 'TVS RP 3160 Gold — Tandoor station',
  station: 'Tandoor',
  routes: ['Non-Veg Starters'],
});
const FLOOR = [KITCHEN_1, KITCHEN_2, TANDOOR];

test('TWO MACHINES ON ONE STATION DO NOT MAKE ROUTING AMBIGUOUS — station is not the key', () => {
  // KOT-VEG-01 and KOT-NV-01 are both "Main Kitchen" in the seed. Routing runs on `routes`, so
  // the shared station name decides nothing at all — which is why it was safe to seed.
  expect(KITCHEN_1.station).toBe(KITCHEN_2.station);
  expect(resolvePrinter({ purpose: 'KOT', category: 'Biryani', printers: FLOOR }).printer?.id).toBe('k2');
  expect(resolvePrinter({ purpose: 'KOT', category: 'Desserts', printers: FLOOR }).printer?.id).toBe('k1');
});

test('THE SAME FLOOR IN ANY ORDER RESOLVES THE SAME WAY — no .find() on an unordered query', () => {
  // The hot-path query had no ORDER BY, so the winner was whatever PostgREST returned first.
  const orders = [
    [KITCHEN_1, KITCHEN_2, TANDOOR],
    [TANDOOR, KITCHEN_2, KITCHEN_1],
    [KITCHEN_2, TANDOOR, KITCHEN_1],
  ];
  for (const category of ['Biryani', 'Non-Veg Starters', 'Desserts']) {
    const chosen = orders.map((printers) => resolvePrinter({ purpose: 'KOT', category, printers }).printer?.id);
    expect(new Set(chosen).size, `${category} resolved ${chosen.join('/')}`).toBe(1);
  }
  expect(new Set(orders.map((p) => mainPrinter('KOT', p)?.id)).size).toBe(1);
});

test('two machines claiming ONE category: the lowest machine id takes it, and the other is named', () => {
  // The ambiguity the product has not decided. The safe reading is one ticket on one machine,
  // the same machine every time — and the duplicate said out loud rather than absorbed.
  const rival = printer({ id: 'rival', machineId: 'KOT-ZZZ-99', name: 'Second claimant', routes: ['Biryani'] });
  const d = resolvePrinter({ purpose: 'KOT', category: 'Biryani', printers: [rival, KITCHEN_1, KITCHEN_2] });
  expect(d.printer?.id).toBe('k2');          // KOT-NV-01 < KOT-ZZZ-99
  expect(d.reason).toContain('Second claimant');
  expect(d.reason).toContain('lowest machine id');
});

test('the order path and the owner Routing screen sort the printers the same way', () => {
  // They disagreed: `listPrinters` ordered by machine_id, the order path did not order at all,
  // so the screen could promise one machine and the kitchen get another.
  expect(bodyOf(MUTATIONS, 'routablePrinters') ?? '', 'the order path').toContain("order('machine_id'");
  expect(QUERIES, 'listPrinters').toContain("order('machine_id'");
});

/* ── 7 · A round spanning two stations is two jobs ─────────────────────── */

test('A ROUND SPANNING TWO STATIONS IS TWO PRINT JOBS, one per machine', () => {
  const tickets = splitRound({
    items: [
      { category: 'Non-Veg Starters', foodType: 'non_veg' }, // Chicken Tikka → Tandoor
      { category: 'Desserts', foodType: 'veg' },             // → the machine claiming nothing
    ],
    printers: FLOOR,
    splitByFoodType: false,
  });

  expect(tickets).toHaveLength(2);
  expect(new Set(tickets.map((t) => t.printerId))).toEqual(new Set(['tan', 'k1']));
  expect(new Set(tickets.map((t) => t.station))).toEqual(new Set(['Tandoor', 'Main Kitchen']));
  // Each one names its own machine, because each one becomes a row that must.
  tickets.forEach((t) => expect(t.printerName.length).toBeGreaterThan(0));
});

test('the split is what the order path actually calls — it was written and then not used', () => {
  const q = bodyOf(MUTATIONS, 'queuePrint') ?? '';
  expect(q).toContain('splitRound(');
  // One row per bucket. `decisions[0]` was the whole bug: one job for a round with two halves.
  expect(q).toContain('tickets.map(');
  expect(q).not.toContain('decisions[0]');

  // AND THE CALL IS NOT BEHIND A DEAD GUARD. This rung stayed green under a deliberately
  // injected `false && purpose === 'KOT' && …` during the fail-first runs — a call that is
  // present and unreachable, which is precisely the state `splitRound` was already in. Pinning
  // the guard to the one condition that may gate it closes that hole. Static analysis still
  // cannot prove reachability in general; it can refuse the specific way this one was faked.
  const guard = /const tickets: RoundTicket\[\] =\s*([\s\S]*?)\s*\n\s*\?/.exec(q)?.[1]?.trim() ?? '';
  expect(guard, 'the split is gated on the round having items, and on nothing else').toBe('input.items?.length');
});

test('the same two dishes added in either order produce the same two jobs', () => {
  const a = splitRound({
    items: [
      { category: 'Non-Veg Starters', foodType: 'non_veg' },
      { category: 'Desserts', foodType: 'veg' },
    ],
    printers: FLOOR,
    splitByFoodType: false,
  });
  const b = splitRound({
    items: [
      { category: 'Desserts', foodType: 'veg' },
      { category: 'Non-Veg Starters', foodType: 'non_veg' },
    ],
    printers: FLOOR,
    splitByFoodType: false,
  });
  expect(a.map((t) => t.printerId)).toEqual(b.map((t) => t.printerId));
});

/* ── 8 · The screens can see the machine ───────────────────────────────── */

test('the printer identity reaches the surfaces, not only its name', () => {
  // A screen that knows only `printerName` can describe where a ticket went but cannot act on
  // it — which is why every retry had to re-derive a target on the server.
  expect(read('src/lib/db/types.ts')).toContain('printerId: string | null');
  expect(QUERIES, 'the bill read fetches the round print jobs').toContain('print_job (');
  for (const surface of [
    'src/features/owner/sections/LiveOrders.tsx',
    'src/features/staff/StaffTables.tsx',
    'src/features/staff/StaffLists.tsx',
  ]) {
    expect(read(surface), `${surface} shows the round destination`).toContain('<PrintTargets');
  }
});

test('the retry an operator presses names the machine it will use', () => {
  const component = read('src/components/ui/print.tsx');
  expect(component).toContain('Retry on {printerShortName(job.printerName)}');
  // And it sends the JOB, not the round: a round with two tickets has two independent failures.
  expect(read('src/features/owner/sections/LiveOrders.tsx')).toContain("action: 'retry-print'");
  expect(read('src/features/staff/StaffTables.tsx')).toContain("action: 'retry-print'");
});

test('a machine is named the way a person says it, not by its model number', () => {
  // All four machines are "TVS RP 3160 Gold". Truncating the full name distinguishes nothing.
  expect(printerShortName('TVS RP 3160 Gold — Kitchen 1')).toBe('Kitchen 1');
  expect(printerShortName('TVS RP 3160 Gold — Tandoor station')).toBe('Tandoor station');
  expect(printerShortName('Counter')).toBe('Counter');
});

test('a stand-in ticket says so on the surface, not only in the history', () => {
  const job = (over: Partial<KotPrintJob>): KotPrintJob => ({
    id: 'j', status: 'queued', attempts: 1, isReprint: false, lastError: '',
    printerId: 'k1', printerName: 'TVS RP 3160 Gold — Kitchen 1', station: 'Tandoor',
    routingRule: 'fallback', ...over,
  });
  expect(printDestination(job({}))).toBe('Tandoor → Kitchen 1 (stand-in)');
  expect(printDestination(job({ routingRule: 'routed', station: 'Main Kitchen' }))).toBe('Main Kitchen → Kitchen 1');
  expect(printDestination(job({ routingRule: 'chosen' }))).toContain('by hand');
  expect(printDestination(job({ printerId: null }))).toBe('No machine assigned');
});

/* ── 9 · Nothing claims a print that did not happen ────────────────────── */

test('NOTHING IN THE PRINT PATH MAY WRITE printed — there is no transport to learn it from', () => {
  // It used to: `reachable = chosen.online && chosen.enabled` decided the status, so "printed"
  // meant a boolean on another table was true. No socket was opened and no paper necessarily
  // moved. Until the Phase 2 bridge reports back, this layer cannot know and must not say.
  let inspected = 0;
  for (const fn of ['queuePrint', 'retryPrintJob', 'printElsewhere']) {
    const writes = statusWrites(bodyOf(MUTATIONS, fn) ?? '');
    expect(writes.length, `${fn} sets a status at all`).toBeGreaterThan(0);

    for (const [field, value] of writes) {
      inspected += 1;
      expect(value, `${fn} must not be able to write ${field} 'printed'`).not.toContain("'printed'");
    }
  }
  expect(inspected, 'status writes were found and inspected, not merely absent').toBeGreaterThan(2);

  // And `syncKotPrintState` may, because it is the one place that MIRRORS a status the jobs
  // already hold — it can only reach 'printed' if every job already says so, which in Phase 1
  // nothing can make true.
  const sync = bodyOf(MUTATIONS, 'syncKotPrintState') ?? '';
  expect(sync, 'the mirror derives the word, it does not decide it').toContain("j.status === 'printed'");
});

test('a printer answering is not a job succeeding — routing no longer reads online at all', () => {
  const q = bodyOf(MUTATIONS, 'queuePrint') ?? '';
  expect(q).not.toContain('.online');
  expect(q).not.toContain('reachable');
  // Assigned, and waiting for something that can actually deliver it.
  expect(q).toContain("status: t.printerId ? 'queued' : 'failed'");
});

test('the only failure this layer can see is having nothing to assign to', () => {
  const dark = FLOOR.map((p) => ({ ...p, enabled: false }));
  const d = resolvePrinter({ purpose: 'KOT', category: 'Desserts', printers: dark });
  expect(d.rule).toBe('none');
  expect(d.printer).toBeNull();

  // And a machine that is merely quiet is still assignable, because the retry can reach it.
  const quiet = FLOOR.map((p) => ({ ...p, online: false }));
  expect(resolvePrinter({ purpose: 'KOT', category: 'Desserts', printers: quiet }).printer?.id).toBe('k1');
});

test('QUEUED IS NOT SILENT — a ticket that has not printed must never read as one that has', () => {
  expect(PRINT_STATUS.queued.word).toBe('Waiting to print');
  expect(PRINT_STATUS.queued.word.toLowerCase()).not.toContain('printed to');
  expect(PRINT_STATUS.queued.tone).not.toBe('success');
  expect(PRINT_STATUS.failed.word).toBe('Print failed');
  expect(PRINT_STATUS.printed.tone).toBe('success');
});

/* ── The Tandoor case, on the floor the restaurant actually has ────────── */

/**
 * The seeded machines, exactly as `20260916110000_jalsa_print_setup` leaves them.
 *
 * Asserted against that migration below rather than trusted, because a fixture that drifts from
 * the seed proves something about a restaurant that does not exist.
 */
const SEED_MIGRATION = read('supabase/migrations/20260916110000_jalsa_print_setup.sql');

const SEEDED = [
  printer({ id: 'veg', machineId: 'KOT-VEG-01', name: 'TVS RP 3160 Gold — Kitchen 1', station: 'Main Kitchen', routes: [] }),
  printer({ id: 'nv', machineId: 'KOT-NV-01', name: 'TVS RP 3160 Gold — Kitchen 2', station: 'Main Kitchen', routes: ['Biryani'] }),
  printer({
    id: 'tan',
    machineId: 'KOT-TAN-01',
    name: 'TVS RP 3160 Gold — Tandoor station',
    station: 'Tandoor',
    routes: ['Non-Veg Starters', 'Veg Starters'],
  }),
];

test('the seeded floor these cases assume is still the floor the migration creates', () => {
  // The fixture above is only worth anything while it matches. If the seed is re-pointed, this
  // fails first and says so, rather than letting the Tandoor cases keep passing about nothing.
  expect(SEED_MIGRATION).toContain("station = 'Tandoor'      where restaurant_id = r and machine_id = 'KOT-TAN-01'");
  expect(SEED_MIGRATION).toContain("routes = array['Non-Veg Starters', 'Veg Starters']");
  expect(SEED_MIGRATION).toContain("machine_id in ('KOT-VEG-01', 'KOT-NV-01')");
  // Two machines on one station, in the real seed — the collision that must not decide anything.
  expect(SEEDED.filter((p) => p.station === 'Main Kitchen')).toHaveLength(2);
});

test('A TANDOOR ROUND REPRINTS AT THE TANDOOR — the case that always went to the main kitchen', () => {
  // `reprintKot` reads the round's snapshotted categories and hands them to `queuePrint`, which
  // splits them. This is that computation, on the real floor, for a real Tandoor round.
  const tickets = splitRound({
    items: [
      { category: 'Non-Veg Starters', foodType: 'non_veg' }, // Chicken Tikka
      { category: 'Veg Starters', foodType: 'veg' },
    ],
    printers: SEEDED,
    splitByFoodType: false,
  });

  expect(tickets).toHaveLength(1);
  expect(tickets[0]?.printerId, 'the Tandoor machine, not the fallback').toBe('tan');
  expect(tickets[0]?.station).toBe('Tandoor');
  expect(tickets[0]?.rule).toBe('routed');
  // The defect, named: it must not be either main-kitchen machine.
  expect(['veg', 'nv']).not.toContain(tickets[0]?.printerId);
});

test('a Tandoor round reprints at the Tandoor EVEN WHEN that machine has not answered', () => {
  // The pre-Phase-1 build would have sent this to Kitchen 1 and written that choice permanently.
  const quiet = SEEDED.map((p) => (p.machineId === 'KOT-TAN-01' ? { ...p, online: false } : p));
  const tickets = splitRound({
    items: [{ category: 'Non-Veg Starters', foodType: 'non_veg' }],
    printers: quiet,
    splitByFoodType: false,
  });
  expect(tickets[0]?.printerId).toBe('tan');
  expect(tickets[0]?.rule).toBe('routed');
});

test('a MIXED round is two jobs — the Tandoor half and the kitchen half, each with its own machine', () => {
  // Chicken Tikka → Tandoor · Butter Chicken (no machine claims its category) → Kitchen 1.
  const tickets = splitRound({
    items: [
      { category: 'Non-Veg Starters', foodType: 'non_veg' },
      { category: 'Main Course', foodType: 'non_veg' },
    ],
    printers: SEEDED,
    splitByFoodType: false,
  });

  expect(tickets).toHaveLength(2);
  const byStation = new Map(tickets.map((t) => [t.station, t]));
  expect(byStation.get('Tandoor')?.printerId).toBe('tan');
  expect(byStation.get('Main Kitchen')?.printerId).toBe('veg');
});

/* ── Print elsewhere leaves the original alone ─────────────────────────── */

test('PRINT ELSEWHERE NEVER TOUCHES THE JOB IT REPLACES — the original is the evidence', () => {
  const e = bodyOf(MUTATIONS, 'printElsewhere') ?? '';
  // It reads the old job and inserts a new one. It must not update `print_job` at all: editing
  // the original would destroy the record that the Tandoor was ever meant to get this round,
  // which is the same loss the old retry caused, reached deliberately instead of by accident.
  expect(e).toContain(".from('print_job')\n    .select(");
  expect(e.match(/\.from\('print_job'\)\s*\n\s*\.update\(/g), 'no update of print_job').toBeNull();
  expect(e).toContain('redirected_from_job_id: job.id');
});

test('the redirect lineage is readable on the screen, not only in the row', () => {
  const setup = read('src/features/owner/sections/PrintSetupSection.tsx');
  expect(setup, 'a redirected job says so').toContain('redirectedFromJobId');
  expect(setup, 'and a hand-directed one says who decided').toContain("routingRule === 'chosen'");
  expect(QUERIES, 'the history row carries the lineage').toContain('redirectedFromJobId');
});

/* ── The zero-failure dashboard must not read as success ───────────────── */

test('A ZERO FAILURE COUNT IS NOT A CLAIM THAT ANYTHING PRINTED', () => {
  // Found at the Phase 1 gate. With `queued` as the resting state, `printFailures` is normally
  // zero — and the dashboard read "Every ticket printed" off it, over a kitchen that had had no
  // paper all night. The same false claim `status: 'printed'` used to make, through the note.
  const dashboard = read('src/features/owner/sections/Dashboard.tsx');
  expect(dashboard, 'the tile knows about undelivered tickets').toContain('printWaiting');
  expect(read('src/lib/db/owner-view.ts'), 'and the payload counts them').toContain('printWaiting');

  const note = /note=\{[\s\S]*?\n\s*\}/.exec(dashboard)?.[0] ?? '';
  expect(note, 'the success wording is reachable only when nothing is waiting either').toContain('printWaiting');
  expect(note).toContain('Every ticket printed');

  const setup = read('src/features/owner/sections/PrintSetupSection.tsx');
  expect(setup, '"Nothing outstanding" likewise').toContain("waiting ? `${waiting} waiting to print` : 'Nothing outstanding'");
});

/* ── R4-1 · The half of the round is persisted, and stays (22-Sep-2026) ──── */

/**
 * `queuePrint` persisted `printer_id` and `station` and discarded the third segment of
 * `splitRound`'s bucket key. With the food-type split on, one round therefore wrote two rows
 * identical in every stored field, and nothing downstream could say which half either was.
 *
 * These rungs read source for the same reason the rest of this file does: the property is a
 * property of a WRITE, and a rung that needs a database is a rung that skips.
 */
test('queuePrint persists the side the ticket says it is', () => {
  const q = bodyOf(MUTATIONS, 'queuePrint') ?? '';
  expect(q).toContain('food_side: t.side');
});

test('queuePrint cannot quietly hard-code the un-split reading', () => {
  // `food_side: 'all'` would compile, would pass every split-off test, and would reinstate the
  // exact defect for the one configuration that needed the column.
  const q = code(bodyOf(MUTATIONS, 'queuePrint') ?? '');
  const writes = [...q.matchAll(/food_side:\s*([^,\n]+)/g)].map((m) => (m[1] ?? '').trim());
  expect(writes, 'exactly one write, and it is the ticket').toEqual(['t.side']);
});

test('the insert shape stays a closed, reviewed set', () => {
  // Same idiom as the Phase 1 patch-shape rungs: a blacklist only catches the column somebody
  // already imagined. If this list changes, the change was deliberate and is read here.
  const q = code(bodyOf(MUTATIONS, 'queuePrint') ?? '');
  const rows = q.slice(q.indexOf('const rows = tickets.map('));
  const columns = [...rows.slice(0, rows.indexOf('}));')).matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1]);
  expect([...columns].sort()).toEqual(
    [
      'attempts',
      'bill_id',
      'completed_at',
      'food_side',
      'is_reprint',
      'kind',
      'kot_id',
      'last_error',
      'printer_id',
      'printer_name',
      'requested_by',
      'restaurant_id',
      'routing_rule',
      'station',
      'status',
    ].sort()
  );
});

test('retryPrintJob still cannot touch the half — its patch is closed', () => {
  // A retry re-sends the SAME half to the SAME machine. The patch was already a closed set; this
  // names the new column in it so a future edit has to argue with a rung rather than with nobody.
  const r = code(bodyOf(MUTATIONS, 'retryPrintJob') ?? '');
  expect(r).not.toContain('food_side');
  expect(r).not.toContain('printer_id:');
});

test('printElsewhere copies the ORIGINAL job’s half, never the destination’s', () => {
  // Redirecting changes where a ticket prints. It does not change what is on it. Deriving the
  // side from the chosen machine would compose whichever half that machine happens to claim —
  // which is precisely what happened before the column existed.
  const p = code(bodyOf(MUTATIONS, 'printElsewhere') ?? '');
  expect(p).toContain('job.food_side');
  expect(p, 'the destination printer never decides the half').not.toMatch(/food_side:\s*printer\./);
  // And it must actually have read the column to copy it.
  expect(p).toContain('food_side');
  expect(p, 'the origin is selected').toMatch(/select\([^)]*food_side/);
});

test('the sides a job may carry are exactly the ones routing can produce', () => {
  // One vocabulary. A fourth value in the database that `splitRound` cannot emit, or a value
  // `splitRound` emits that the constraint rejects, is a job that can never be composed.
  const migration = read('supabase/migrations/20260922090000_jalsa_print_job_food_side.sql');
  expect(migration.length).toBeGreaterThan(1500);
  for (const side of ['all', 'veg_side', 'non_veg']) {
    expect(migration, `the constraint admits ${side}`).toContain(`'${side}'`);
    expect(ROUTING, `routing can produce ${side}`).toContain(`'${side}'`);
  }
  expect(migration).toContain('print_job_food_side_check');
});

test('the half is immutable in the DATABASE, not only in TypeScript', () => {
  // The lesson `printer_id` already taught one migration earlier: a rule enforced only in the
  // layer that broke it is a comment.
  const migration = read('supabase/migrations/20260922090000_jalsa_print_job_food_side.sql');
  expect(migration).toContain('print_job_food_side_is_immutable');
  expect(migration).toContain('before update on public.print_job');
  expect(migration).toContain('raise exception');
  // And it is a SEPARATE trigger: widening the printer one would leave a name that lies.
  expect(migration).not.toContain('print_job_printer_is_immutable');
});

test('the migration does not backfill a guess onto old rows', () => {
  // A pre-migration row written while the split was on says nothing about which half it is.
  // Guessing would be the duplicate-printing defect, arriving as a migration.
  const migration = code(read('supabase/migrations/20260922090000_jalsa_print_job_food_side.sql'));
  expect(migration).toContain("default 'all'");
  expect(migration, 'no UPDATE of existing rows').not.toMatch(/update\s+public\.print_job\s+set\s+food_side/i);
});
