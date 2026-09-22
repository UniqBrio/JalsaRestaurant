/**
 * print-routing unit spec — category → station → printer, and the fallback that stops a ticket
 * vanishing.
 *
 * FAIL-FIRST EVIDENCE: observed on 16-Sep-2026. Against the pre-fix tree the whole file failed
 * to collect (`src/lib/print-routing.ts` did not exist). Two deliberate defects were then put
 * into the finished module and the suite re-run:
 *
 *   1. `resolvePrinter` returning `{ printer: null }` when the claiming machine is unreachable,
 *      instead of falling back — **3 failed, 15 passed**, among them "AN UNREACHABLE STATION
 *      FALLS BACK TO THE MAIN KITCHEN — a ticket never vanishes". That is the defect the
 *      flowchart's Print-failed row names in so many words, and its symptom is a party waiting
 *      for food nobody was told to cook.
 *   2. The fallback decision reporting the FALLBACK machine's station instead of the intended
 *      one — **2 failed, 16 passed**. "A FALLBACK TICKET CARRIES THE STATION IT WAS MEANT FOR"
 *      went red: the tandoor's ticket came out of the main kitchen printer stamped "Main
 *      Kitchen", where the wrong cook picks it up.
 *
 * Both were reverted and the suite returned to 18 passed.
 *
 * ── SUPERSEDED ASSERTIONS · 19-Sep-2026 · Phase 1 print-job assignment ──────────────────────
 * Four cases below asserted that a printer which had not ANSWERED (`online: false`) lost its
 * categories to the main kitchen. That was true and correct while the printer was re-chosen on
 * every attempt. It stopped being correct when `print_job.printer_id` became permanent and
 * immutable: `online` is a fact about this second and the assignment is forever, so a tandoor
 * machine that happened to be unplugged when a round was placed would have had its ticket
 * assigned to the main kitchen FOR GOOD, with no later retry able to correct it. `online` is
 * therefore no longer a routing input — it is a delivery fact, for the layer that can act on it.
 *
 * What the four cases asserted, kept here because it was once the specified behaviour:
 *   · an unreachable station fell back to the main kitchen
 *   · that fallback ticket carried the station it was meant for
 *   · "switched off" and "not answering" produced different fallback reasons
 *   · a split merged an unreachable station's items onto the fallback machine
 *
 * Each is rewritten below against the rule that replaced it. The FALLBACK ITSELF IS NOT GONE —
 * it is now triggered by `enabled: false`, the owner's decision to take a machine out of use,
 * which is a fact with no clock on it. Both halves of the original defect (a ticket must never
 * vanish; a fallback ticket must carry the station it was meant for) are still asserted, and
 * still fail if either is broken.
 */
import { test, expect } from '@playwright/test';
import { mainPrinter, resolvePrinter, splitRound, type RoutablePrinter } from '../../src/lib/print-routing';

const printer = (p: Partial<RoutablePrinter> & { id: string }): RoutablePrinter => ({
  // Defaulted from the id so every fixture has the tie-break key routing now sorts on, and the
  // order of a fixture array stops being able to decide anything.
  machineId: p.id,
  name: `Machine ${p.id}`,
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: true,
  enabled: true,
  ...p,
});

const MAIN = printer({ id: 'main', name: 'Main Kitchen Printer', station: 'Main Kitchen' });
const TANDOOR = printer({
  id: 'tandoor',
  name: 'Tandoor Station',
  station: 'Tandoor',
  routes: ['Non-Veg Starters', 'Veg Starters'],
});
const COUNTER = printer({ id: 'counter', name: 'Counter Bill Printer', purpose: 'Invoice', station: 'Billing' });
const FLOOR = [MAIN, TANDOOR, COUNTER];

/* ── The happy route ───────────────────────────────────────────────────── */

test('a category a machine claims goes to that machine', () => {
  const d = resolvePrinter({ purpose: 'KOT', category: 'Non-Veg Starters', printers: FLOOR });
  expect(d.printer?.id).toBe('tandoor');
  expect(d.rule).toBe('routed');
  expect(d.station).toBe('Tandoor');
});

test('the decision reads as the design writes it — category, station, printer', () => {
  const d = resolvePrinter({ purpose: 'KOT', category: 'Non-Veg Starters', printers: FLOOR });
  expect(d.reason).toBe('Non-Veg Starters → Tandoor → Tandoor Station');
});

test('a category NOBODY claims lands on the main machine rather than nowhere', () => {
  const d = resolvePrinter({ purpose: 'KOT', category: 'Desserts', printers: FLOOR });
  expect(d.printer?.id).toBe('main');
  expect(d.rule).toBe('unrouted');
});

test('a renamed category still reaches its station — matching ignores case and padding', () => {
  const d = resolvePrinter({ purpose: 'KOT', category: '  non-veg starters ', printers: FLOOR });
  expect(d.printer?.id).toBe('tandoor');
  expect(d.rule).toBe('routed');
});

test('a bill never goes to a kitchen machine, whatever the routes say', () => {
  const d = resolvePrinter({ purpose: 'Invoice', category: 'Non-Veg Starters', printers: FLOOR });
  expect(d.printer?.id).toBe('counter');
});

/* ── The fallback ──────────────────────────────────────────────────────── */

test('A SWITCHED-OFF STATION FALLS BACK TO THE MAIN KITCHEN — a ticket never vanishes', () => {
  // Supersedes the `online: false` version. The owner taking a machine out of use is a decision
  // with no clock on it, so it is safe to route around permanently; "did not answer" is not.
  const off = [MAIN, { ...TANDOOR, enabled: false }, COUNTER];
  const d = resolvePrinter({ purpose: 'KOT', category: 'Non-Veg Starters', printers: off });
  expect(d.printer?.id).toBe('main');
  expect(d.rule).toBe('fallback');
});

test('A STATION THAT HAS NOT ANSWERED KEEPS ITS OWN TICKETS — the assignment outlives the fault', () => {
  // THE CORRECTION. Before Phase 1 this returned 'main', which — once printer_id became
  // permanent — meant a momentarily unplugged tandoor lost every ticket placed in that window,
  // with no retry able to bring them back. A printer that is merely quiet is still the right
  // destination; getting paper out of it is the delivery layer's problem.
  const quiet = [MAIN, { ...TANDOOR, online: false }, COUNTER];
  const d = resolvePrinter({ purpose: 'KOT', category: 'Non-Veg Starters', printers: quiet });
  expect(d.printer?.id).toBe('tandoor');
  expect(d.rule).toBe('routed');
  expect(d.station).toBe('Tandoor');
});

test('A FALLBACK TICKET CARRIES THE STATION IT WAS MEANT FOR, not the one it came out at', () => {
  // Same assertion as before, on the trigger that now causes a fallback.
  const down = [MAIN, { ...TANDOOR, enabled: false }, COUNTER];
  const d = resolvePrinter({ purpose: 'KOT', category: 'Veg Starters', printers: down });
  expect(d.printer?.id).toBe('main');
  expect(d.station).toBe('Tandoor');
  expect(d.reason).toContain('Tandoor');
});

test('OFF and NOT ANSWERING are different things — and only one of them changes the routing', () => {
  // They were two wordings of one outcome. They are now two outcomes: a decision reroutes, a
  // fault does not. That distinction is the whole correction, so it is asserted on the DECISION
  // rather than on the sentence describing it.
  const off = resolvePrinter({ purpose: 'KOT', category: 'Veg Starters', printers: [MAIN, { ...TANDOOR, enabled: false }] });
  const quiet = resolvePrinter({ purpose: 'KOT', category: 'Veg Starters', printers: [MAIN, { ...TANDOOR, online: false }] });

  expect(off.rule).toBe('fallback');
  expect(off.printer?.id).toBe('main');
  expect(off.reason).toContain('switched off');

  expect(quiet.rule).toBe('routed');
  expect(quiet.printer?.id).toBe('tandoor');
});

test('with EVERY machine down the decision still names one, so the failure has an address', () => {
  const dark = FLOOR.map((p) => ({ ...p, online: false }));
  const d = resolvePrinter({ purpose: 'KOT', category: 'Desserts', printers: dark });
  expect(d.printer).not.toBeNull();
  expect(d.printer?.purpose).toBe('KOT');
});

test('no machine of that kind at all is reported as such, never as a fallback', () => {
  const d = resolvePrinter({ purpose: 'KOT', category: 'Desserts', printers: [COUNTER] });
  expect(d.printer).toBeNull();
  expect(d.rule).toBe('none');
  expect(d.reason).toContain('No KOT printer');
});

/* ── Which machine is "main" ───────────────────────────────────────────── */

test('the main machine is the one claiming no category of its own', () => {
  expect(mainPrinter('KOT', FLOOR)?.id).toBe('main');
});

test('with every machine claiming a category, the first reachable one is main', () => {
  const all = [{ ...MAIN, routes: ['Rice'] }, TANDOOR];
  expect(mainPrinter('KOT', all)?.id).toBe('main');
});

/* ── The food-type split is a SECOND decision ──────────────────────────── */

test('routing decides the machine; the food-type split decides how many tickets it prints', () => {
  const items = [
    { category: 'Rice', foodType: 'veg' as const },
    { category: 'Rice', foodType: 'non_veg' as const },
  ];
  const combined = splitRound({ items, printers: FLOOR, splitByFoodType: false });
  const split = splitRound({ items, printers: FLOOR, splitByFoodType: true });
  expect(combined).toHaveLength(1);
  expect(split).toHaveLength(2);
  expect(new Set(split.map((t) => t.printerId))).toEqual(new Set(['main']));
});

test('EGG TRAVELS WITH VEG — one fryer, one side of the kitchen', () => {
  const items = [
    { category: 'Rice', foodType: 'veg' as const },
    { category: 'Rice', foodType: 'egg' as const },
  ];
  expect(splitRound({ items, printers: FLOOR, splitByFoodType: true })).toHaveLength(1);
});

test('a split never invents a ticket for a side the round has nothing on', () => {
  const items = [{ category: 'Rice', foodType: 'veg' as const }];
  const tickets = splitRound({ items, printers: FLOOR, splitByFoodType: true });
  expect(tickets).toHaveLength(1);
  expect(tickets[0]?.foodTypes).toEqual(['veg']);
});

test('a round spanning two stations produces one ticket per station', () => {
  const items = [
    { category: 'Non-Veg Starters', foodType: 'non_veg' as const },
    { category: 'Rice', foodType: 'veg' as const },
  ];
  const tickets = splitRound({ items, printers: FLOOR, splitByFoodType: false });
  expect(tickets).toHaveLength(2);
  expect(new Set(tickets.map((t) => t.station))).toEqual(new Set(['Tandoor', 'Main Kitchen']));
});

test('a fallback merges into the machine it fell back to but KEEPS its own station heading', () => {
  const down = [MAIN, { ...TANDOOR, enabled: false }];
  const items = [
    { category: 'Non-Veg Starters', foodType: 'non_veg' as const },
    { category: 'Rice', foodType: 'veg' as const },
  ];
  const tickets = splitRound({ items, printers: down, splitByFoodType: false });
  expect(tickets).toHaveLength(2);
  expect(tickets.every((t) => t.printerId === 'main')).toBe(true);
  expect(tickets.map((t) => t.station).sort()).toEqual(['Main Kitchen', 'Tandoor']);
});

test('every ticket carries a reason — a routing nobody can read is a routing nobody can fix', () => {
  const tickets = splitRound({
    items: [{ category: 'Desserts', foodType: 'veg' as const }],
    printers: FLOOR,
    splitByFoodType: false,
  });
  tickets.forEach((t) => expect(t.reason.length).toBeGreaterThan(10));
});

/* ── R4-1 · The side a bucket is, carried out of the function (22-Sep-2026) ── */

/**
 * `splitRound` keys buckets on printer, station and side. Until today the side existed only as a
 * local variable: `queuePrint` persisted the other two and discarded it, so two tickets for one
 * machine — a veg half and a non-veg half — became two rows identical in every stored field.
 *
 * These rungs pin the side as a VALUE on the ticket. `foodTypes` is not the same fact: it records
 * which types landed in a bucket, and the two sides are interchangeable in that aggregate, which
 * is exactly why the side has to be carried rather than reconstructed.
 */
test('every ticket names which side of the split it is', () => {
  const items = [
    { category: 'Non-Veg Starters', foodType: 'non_veg' as const },
    { category: 'Desserts', foodType: 'veg' as const },
  ];
  for (const ticket of splitRound({ items, printers: FLOOR, splitByFoodType: true })) {
    expect(['all', 'veg_side', 'non_veg']).toContain(ticket.side);
  }
});

test('with the split OFF every ticket is `all` — one side, carrying everything', () => {
  const items = [
    { category: 'Non-Veg Starters', foodType: 'non_veg' as const },
    { category: 'Desserts', foodType: 'veg' as const },
    { category: 'Breads', foodType: 'egg' as const },
  ];
  const tickets = splitRound({ items, printers: FLOOR, splitByFoodType: false });
  expect(tickets.length).toBeGreaterThan(0);
  for (const t of tickets) expect(t.side).toBe('all');
});

test('with the split ON, a non-veg ticket says non_veg and a veg ticket says veg_side', () => {
  // The side and the food types must agree. If they ever disagree the row records one thing and
  // the paper carries another, which is the whole class of defect this column exists to close.
  const items = [
    { category: 'Non-Veg Starters', foodType: 'non_veg' as const },
    { category: 'Non-Veg Starters', foodType: 'veg' as const },
  ];
  for (const t of splitRound({ items, printers: FLOOR, splitByFoodType: true })) {
    if (t.side === 'non_veg') expect(t.foodTypes).toEqual(['non_veg']);
    else expect(t.foodTypes).not.toContain('non_veg');
  }
});

test('egg travels with veg, on the side as well as in the bucket', () => {
  // One fryer, one side — the rule the split already had. The side must say the same thing.
  const items = [{ category: 'Breads', foodType: 'egg' as const }];
  const tickets = splitRound({ items, printers: FLOOR, splitByFoodType: true });
  expect(tickets).toHaveLength(1);
  expect(tickets[0]?.side).toBe('veg_side');
});

test('the side distinguishes two tickets that are otherwise identical', () => {
  // The defect, stated as a rung: same machine, same station, and until today nothing else.
  const items = [
    { category: 'Non-Veg Starters', foodType: 'non_veg' as const },
    { category: 'Non-Veg Starters', foodType: 'veg' as const },
  ];
  const tickets = splitRound({ items, printers: FLOOR, splitByFoodType: true });
  expect(tickets).toHaveLength(2);
  expect(tickets[0]?.printerId).toBe(tickets[1]?.printerId);
  expect(tickets[0]?.station).toBe(tickets[1]?.station);
  expect(tickets[0]?.side).not.toBe(tickets[1]?.side);
});
