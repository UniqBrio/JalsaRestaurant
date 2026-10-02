import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  mainPrinter,
  printsKind,
  resolvePrinter,
  routeItem,
  splitRound,
  type RoutablePrinter,
} from '../../src/lib/print-routing';
import { normalizeRoles, rolesLabel } from '../../src/lib/printer-roles';

/**
 * 02-Oct-2026 — one physical printer must be able to print kitchen tickets AND bills.
 *
 * Until now `printer.purpose` was ONE kind, and routing filtered on it exactly: a restaurant with
 * one printer set to KOT wrote every bill as "failed, no machine", and one set to Bills wrote
 * every KOT that way. A printer now carries `roles` (KOT, Invoice or both) and may be the owner's
 * chosen default for either. These cases drive the SAME functions the order path calls:
 * `queuePrint` routes a bill with `resolvePrinter({ purpose: 'Invoice', category: '' })` and a
 * round with `splitRound` / `routeItem`.
 */

const P = (
  id: string,
  roles: string[],
  extra: Partial<RoutablePrinter> = {}
): RoutablePrinter => ({
  id,
  machineId: id.toUpperCase(),
  name: `Printer ${id}`,
  purpose: roles.includes('KOT') ? 'KOT' : 'Invoice',
  roles,
  defaultFor: [],
  station: 'Main Kitchen',
  routes: [],
  online: false,
  enabled: true,
  ...extra,
});

const bill = (printers: RoutablePrinter[]) => resolvePrinter({ purpose: 'Invoice', category: '', printers });
const kot = (printers: RoutablePrinter[], category = 'Biryani') => routeItem({ category, printers });

/* ── 1-3. One printer ──────────────────────────────────────────────────────────────────────── */

test('1. one printer used for kitchen tickets: KOTs print there, a bill still has nowhere to go', () => {
  const only = [P('a', ['KOT'])];
  expect(kot(only).printer?.id).toBe('a');
  // Unchanged behaviour for a KOT-only machine: a bill is never sent to it.
  expect(bill(only)).toMatchObject({ printer: null, rule: 'none' });
});

test('2. one printer used for bills: bills print there, a KOT is never sent to it', () => {
  const only = [P('a', ['Invoice'])];
  expect(bill(only).printer?.id).toBe('a');
  expect(kot(only)).toMatchObject({ printer: null, rule: 'none' });
});

test('3. one printer used for both: the KOT AND the bill print on it', () => {
  const only = [P('a', ['KOT', 'Invoice'])];
  expect(kot(only)).toMatchObject({ printer: { id: 'a' } });
  expect(bill(only)).toMatchObject({ printer: { id: 'a' } });
  // And a whole round, split as the order path splits it, lands on it too.
  const round = splitRound({
    items: [
      { category: 'Biryani', foodType: 'non_veg' },
      { category: 'Desserts', foodType: 'veg' },
    ],
    printers: only,
    splitByFoodType: false,
  });
  expect(round.map((t) => t.printerId)).toEqual(['a']);
});

/* ── 4. Two printers ───────────────────────────────────────────────────────────────────────── */

test('4. two printers with separate roles: KOT to the kitchen, bill to the counter - as before', () => {
  const two = [P('kitchen', ['KOT']), P('counter', ['Invoice'], { station: 'Billing' })];
  expect(kot(two).printer?.id).toBe('kitchen');
  expect(bill(two).printer?.id).toBe('counter');
});

test('4b. a counter printer set to both does not steal the kitchen\'s unrouted tickets', () => {
  // The counter's machine id sorts FIRST. Without the "dedicated machine first" rule the
  // kitchen's unrouted dishes would print at the bill counter.
  const two = [P('a-counter', ['KOT', 'Invoice']), P('b-kitchen', ['KOT'])];
  expect(kot(two).printer?.id).toBe('b-kitchen');
  expect(bill(two).printer?.id).toBe('a-counter');
});

test('4c. the owner\'s chosen defaults win, and one printer may be the default for both', () => {
  const both = P('z-counter', ['KOT', 'Invoice'], { defaultFor: ['KOT', 'Invoice'] });
  const printers = [P('a-kitchen', ['KOT']), P('b-bills', ['Invoice']), both];
  expect(mainPrinter('KOT', printers)?.id).toBe('z-counter');
  expect(mainPrinter('Invoice', printers)?.id).toBe('z-counter');
  // A default never overrides a category the owner routed elsewhere.
  const routed = [P('a-kitchen', ['KOT'], { routes: ['Biryani'] }), both];
  expect(kot(routed, 'Biryani').printer?.id).toBe('a-kitchen');
  expect(kot(routed, 'Desserts').printer?.id).toBe('z-counter');
});

/* ── 5. The same Windows printer for both roles ────────────────────────────────────────────── */

test('5. the same Windows printer for both roles: merged into ONE Jalsa printer, nothing unmapped', () => {
  const fn = readFileSync('src/lib/db/owner-mutations.ts', 'utf8');
  const save = fn.slice(fn.indexOf('export async function savePrinterMapping'));
  // A "new printer" on a queue that already serves one adds its roles to that printer...
  expect(save).toContain("if (!('printerId' in input.target) && sharing.length > 0) {");
  expect(save).toContain('const merged = normalizeRoles({ roles: [...had, ...requested.roles] }).roles;');
  // ...and returns BEFORE any mapping is written or removed.
  const merge = save.indexOf('const merged');
  expect(save.indexOf('return { printerId: same.id as string };')).toBeGreaterThan(merge);
  expect(save.indexOf('return { printerId: same.id as string };')).toBeLessThan(save.indexOf('.upsert('));
  // The two roles together route exactly as test 3 shows.
  expect(normalizeRoles({ roles: ['KOT', 'Invoice', 'KOT'] }).roles).toEqual(['KOT', 'Invoice']);
});

/* ── 6-8. Fallback and switched-off machines ───────────────────────────────────────────────── */

test('6. KOT fallback: a switched-off kitchen printer falls to another KOT-capable machine', () => {
  const printers = [
    P('a-tandoor', ['KOT'], { routes: ['Tandoori'], station: 'Tandoor', enabled: false }),
    P('b-counter', ['KOT', 'Invoice']),
  ];
  const d = kot(printers, 'Tandoori');
  expect(d).toMatchObject({ rule: 'fallback', station: 'Tandoor', printer: { id: 'b-counter' } });
});

test('7. bill fallback: a switched-off bill printer falls to a machine that prints both - never to a KOT-only one', () => {
  const printers = [
    P('a-bills', ['Invoice'], { enabled: false, defaultFor: ['Invoice'] }),
    P('b-kitchen', ['KOT']),
    P('c-counter', ['KOT', 'Invoice']),
  ];
  expect(bill(printers).printer?.id).toBe('c-counter');
  // With no bill-capable machine left switched on, a bill is not handed to the kitchen.
  const noBills = [P('a-bills', ['Invoice'], { enabled: false }), P('b-kitchen', ['KOT'])];
  expect(bill(noBills)).toMatchObject({ printer: null, rule: 'none' });
});

test('8. a switched-off default is skipped, and a KOT never reaches an Invoice-only machine', () => {
  const printers = [P('a', ['KOT'], { enabled: false, defaultFor: ['KOT'] }), P('b', ['Invoice'])];
  expect(kot(printers)).toMatchObject({ printer: null, rule: 'none' });
  expect(mainPrinter('KOT', [P('a', ['KOT'], { enabled: false, defaultFor: ['KOT'] }), P('c', ['KOT'])])?.id).toBe('c');
});

/* ── 9. Deleted ────────────────────────────────────────────────────────────────────────────── */

test('9. a dish whose own printer was deleted falls to the default, and a deleted default is simply gone', () => {
  const printers = [P('b-kitchen', ['KOT'])];
  const d = routeItem({ category: 'Biryani', route: { printerId: 'deleted-id', station: null }, printers });
  expect(d).toMatchObject({ rule: 'fallback', printer: { id: 'b-kitchen' } });
  // The default lives on the printer row (`default_roles`), so deleting it leaves no dangling
  // default: the automatic choice resumes.
  expect(mainPrinter('Invoice', [P('c', ['Invoice'])])?.id).toBe('c');
});

/* ── 10. Print elsewhere ───────────────────────────────────────────────────────────────────── */

test('10. Print elsewhere accepts a machine that prints both, and still refuses the wrong kind', () => {
  expect(printsKind({ purpose: 'KOT', roles: ['KOT', 'Invoice'] }, 'Invoice')).toBe(true);
  expect(printsKind({ purpose: 'KOT', roles: ['KOT'] }, 'Invoice')).toBe(false);
  // A row from before roles existed answers by its purpose.
  expect(printsKind({ purpose: 'Invoice' }, 'Invoice')).toBe(true);
  const mu = readFileSync('src/lib/db/mutations.ts', 'utf8');
  const fn = mu.slice(mu.indexOf('export async function printElsewhere'));
  expect(fn).toContain('if (!printsKind({ purpose: printer.purpose as string, roles: printer.roles as string[] | undefined }, job.kind as string)) {');
});

/* ── The rules the screens and the server share ────────────────────────────────────────────── */

test('roles are validated once: known kinds, one order, defaults only for what it prints', () => {
  expect(normalizeRoles({ roles: [] }).problem).toMatch(/kitchen tickets, bills, or both/);
  expect(normalizeRoles({ roles: ['Pizza'] }).problem).not.toBeNull();
  expect(normalizeRoles({ roles: ['Invoice', 'KOT'], defaultFor: ['Invoice', 'Pizza'] })).toEqual({
    roles: ['KOT', 'Invoice'],
    defaultFor: ['Invoice'],
    problem: null,
  });
  expect(normalizeRoles({ roles: ['KOT'], defaultFor: ['Invoice'] }).defaultFor).toEqual([]);
  expect(rolesLabel(['KOT', 'Invoice'])).toBe('Kitchen tickets and bills');
  expect(rolesLabel(['Invoice'])).toBe('Bills');
});

test('every printer read the order path and the bridge make asks for "prints this kind", not "is this kind"', () => {
  for (const file of ['src/lib/db/mutations.ts', 'src/lib/db/bridge-payload.ts']) {
    const src = readFileSync(file, 'utf8');
    expect(src, file).toContain(".contains('roles', [purpose])");
    expect(src, file).not.toContain(".eq('purpose', purpose)");
  }
});

test('a save that does not send roles keeps a "both" printer\'s bills (the Routing screen)', () => {
  const ui = readFileSync('src/features/owner/sections/PrintSetupSection.tsx', 'utf8');
  expect(ui.match(/roles: (from|to)\.roles,/g)?.length).toBe(2);
  const fn = readFileSync('src/lib/db/owner-mutations.ts', 'utf8');
  const up = fn.slice(fn.indexOf('export async function upsertPrinter'));
  expect(up).toContain('const keptDefaults = (defaultFor ?? ((before?.default_roles as string[] | null) ?? []))');
  expect(up).toContain('await releaseDefaults(restaurantId, input.id, keptDefaults);');
});
