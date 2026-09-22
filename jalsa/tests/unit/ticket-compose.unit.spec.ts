/**
 * ticket-compose unit spec — a job turned into exactly its own paper, or refused.
 *
 * WHY THE REFUSALS ARE THE IMPORTANT HALF
 *   Composing the right lines is a thing you can see by looking at the ticket. Composing the
 *   WRONG lines is not: a second ticket carrying the whole round, at the machine that already
 *   printed half of it, looks like a perfectly ordinary KOT. The kitchen cooks it. The rungs
 *   below spend most of their length on the cases where this module must produce nothing at all.
 *
 * THE EQUIVALENCE RUNG IS LOAD-BEARING
 *   `splitRound` decides how a round becomes jobs; this module has to decide, separately, which
 *   items belong to one of those jobs, because the aggregate `splitRound` returns does not carry
 *   item lists and is a Phase 1 contract this gate may not widen. Two implementations of one
 *   rule is a defect waiting to happen, so the first rung below asserts they agree over a table
 *   of rounds rather than trusting a comment that says they do.
 *
 * FAIL-FIRST EVIDENCE (21-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { splitRound, type RoutablePrinter } from '../../src/lib/print-routing';
import { defaultTemplate, PAPER, type TicketLine } from '../../src/lib/print-template';
import {
  composeTicket,
  __bucketsFor,
  __keyedItems,
  type ComposeInput,
  type ComposeItem,
  type ComposeJob,
} from '../../src/lib/ticket-compose';

/* ── The restaurant these rungs are set in ─────────────────────────────── */

const printer = (over: Partial<RoutablePrinter> & { id: string; machineId: string }): RoutablePrinter => ({
  name: `TVS RP 3160 — ${over.machineId}`,
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: false,
  enabled: true,
  ...over,
});

/** The fallback takes anything nobody claims; the other two claim one category each. */
const VEG = printer({ id: 'p1', machineId: 'KOT-VEG-01', station: 'Main Kitchen', routes: [] });
const NV = printer({ id: 'p2', machineId: 'KOT-NV-01', station: 'Main Kitchen', routes: ['Biryani'] });
const TANDOOR = printer({ id: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor', routes: ['Tandoor'] });
const PRINTERS = [VEG, NV, TANDOOR];

const item = (over: Partial<ComposeItem> & { name: string; category: string }): ComposeItem => ({
  qty: 1,
  foodType: 'veg',
  rate: 0,
  instruction: '',
  ...over,
});

const PANEER = item({ name: 'Paneer Tikka', category: 'Tandoor' });
const BIRYANI = item({ name: 'Chicken Biryani', category: 'Biryani', foodType: 'non_veg' });
const VEG_BIRYANI = item({ name: 'Veg Biryani', category: 'Biryani', foodType: 'veg' });
const DAL = item({ name: 'Dal Tadka', category: 'Curry' });

const HEADER: ComposeInput['header'] = {
  restaurant: 'JALSA',
  branch: 'Hosur',
  phone: '04344 000000',
  gstin: '—',
  kotCode: 'KOT-113',
  roundCode: 'R-1',
  billCode: 'B-0007',
  table: 'T12',
  customer: '',
  captain: 'Guest phone',
  date: '21 Sep 2026',
  time: '7:40 PM',
  source: 'Guest phone',
  note: '',
};

const job = (over: Partial<ComposeJob> = {}): ComposeJob => ({
  id: 'job-1',
  kind: 'kot',
  printerId: 'p3',
  station: 'Tandoor',
  foodSide: 'all',
  isReprint: false,
  ...over,
});

const compose = (over: Partial<ComposeInput> = {}): ReturnType<typeof composeTicket> =>
  composeTicket({
    job: job(),
    width: '80',
    template: {},
    printers: PRINTERS,
    splitByFoodType: false,
    header: HEADER,
    items: [PANEER, BIRYANI, DAL],
    ...over,
  });

const textOf = (lines: TicketLine[]): string => lines.map((l) => l.text).join('\n');

/* ── The equivalence rung ──────────────────────────────────────────────── */

const ROUNDS: ComposeItem[][] = [
  [PANEER],
  [PANEER, BIRYANI],
  [PANEER, BIRYANI, DAL],
  [BIRYANI, VEG_BIRYANI],
  [DAL, DAL, PANEER],
  [VEG_BIRYANI, PANEER, BIRYANI, DAL],
];

test('this module buckets a round exactly the way splitRound does', () => {
  for (const split of [false, true]) {
    for (const items of ROUNDS) {
      const mine = __bucketsFor(items, PRINTERS, split);
      // splitRound returns aggregates, so its bucket identity is reconstructed from the fields
      // it DOES expose — which is the same triple its own key is built from.
      const theirs = splitRound({ items, printers: PRINTERS, splitByFoodType: split }).map(
        (t) => `${t.printerId ?? 'none'}|${t.station}`
      );
      expect(
        mine.map((k) => k.split('|').slice(0, 2).join('|')).sort(),
        `round ${items.map((i) => i.name).join('+')} split=${split}`
      ).toEqual([...theirs].sort());
      // And the count of buckets agrees, which is what the ambiguity refusal turns on.
      expect(mine.length, `bucket count, split=${split}`).toBe(theirs.length);
    }
  }
});

test('and it puts the same ITEMS on the same side as splitRound does', () => {
  // WHY THIS RUNG EXISTS AS WELL AS THE ONE ABOVE (21-Sep-2026)
  //   The rung above strips the side off the key before comparing, so it compares which MACHINES
  //   a round touches and how many buckets there are. It was written to guard the duplicated
  //   food-type rule, and it could not see that rule at all: swapping `non_veg` for `veg` in the
  //   side test leaves every machine and every bucket count identical, and the rung stayed green
  //   through exactly the defect it is named after. Caught by fail-first injection, 21-Sep-2026.
  //
  //   This one asserts the MEANING. Every item on the non-veg side must be non-veg, every item on
  //   the veg side must not be — and the food types splitRound reports for the same machine must
  //   be the food types this module put there.
  for (const items of ROUNDS) {
    for (const { key, side, item } of __keyedItems(items, PRINTERS, true)) {
      if (side === 'non_veg') expect(item.foodType, key).toBe('non_veg');
      else expect(item.foodType, key).not.toBe('non_veg');
    }

    // NOT ASSERTED AGAINST splitRound's AGGREGATE, and that is not an omission.
    //   `RoundTicket` carries `foodTypes` but not the side its key was built from, and the
    //   ambiguous case is precisely two buckets sharing one machine-and-station. Grouped by
    //   anything splitRound exposes, the veg and non-veg halves are interchangeable — the
    //   swapped rule produces the identical aggregate. So the aggregate cannot see this defect,
    //   and a rung that compared it would be the green one that missed. The assertion above is
    //   the rule's MEANING, checked directly, which is the only thing that does see it.
  }

  // With the split OFF there is one side and it carries everything, whatever the food type.
  for (const items of ROUNDS) {
    for (const { side } of __keyedItems(items, PRINTERS, false)) expect(side).toBe('all');
  }
});

/* ── A job composes ITS items and no others ────────────────────────────── */

test('a tandoor job carries the tandoor item and nothing else from the round', () => {
  const result = compose();
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(textOf(result.lines)).toContain('Paneer Tikka');
  expect(textOf(result.lines)).not.toContain('Chicken Biryani');
  expect(textOf(result.lines)).not.toContain('Dal Tadka');
  expect(result.itemCount).toBe(1);
});

test('the fallback machine carries what nobody claimed, and not the claimed dishes', () => {
  const result = compose({ job: job({ printerId: 'p1', station: 'Main Kitchen' }) });
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(textOf(result.lines)).toContain('Dal Tadka');
  expect(textOf(result.lines)).not.toContain('Paneer Tikka');
  expect(textOf(result.lines)).not.toContain('Chicken Biryani');
});

/**
 * SUPERSEDED 22-Sep-2026 (R4-2), under the contract-change exception in jalsa/CLAUDE.md.
 *
 * This rung was "KNOWN GAP: the station never reaches the paper, because the template has no
 * field for it". It asserted the ABSENCE of the station from a composed ticket and that
 * `defaultTemplate('kot').on` had no `station` key — a rung written to go red the day somebody
 * added one, so the composer would be wired at the same time.
 *
 * That day is today. `TicketData.station`, `KOT_FIELDS.station` and `buildKot`'s case exist, the
 * field prints by default, and the assertions below are the positive form of what that rung was
 * holding the place for.
 */
test('the station reaches the paper, and it is the one the round was routed to', () => {
  const result = compose();
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(textOf(result.lines).toUpperCase()).toContain('TANDOOR');
  expect(Object.keys(defaultTemplate('kot', '80').on)).toContain('station');
});

test('a FALLBACK ticket says the station it was meant for, not the machine it came out of', () => {
  // The whole reason `station` exists on a routing decision. `print-routing.ts`: *"A tandoor
  // ticket on the main kitchen machine has to say TANDOOR or the wrong cook picks it up."*
  //
  // Set up the real thing rather than a hand-made job: the tandoor machine is switched OFF, so
  // `resolvePrinter` falls back to the main-kitchen machine and stamps the decision TANDOOR. The
  // bucket is therefore `p1 | Tandoor`, and that is what the job carries.
  const tandoorOff = { ...TANDOOR, enabled: false };
  const result = composeTicket({
    job: { id: 'j', kind: 'kot', printerId: 'p1', station: 'Tandoor', foodSide: 'all', isReprint: false },
    width: '80',
    template: {},
    printers: [VEG, tandoorOff],
    splitByFoodType: false,
    header: HEADER,
    items: [PANEER],
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const paper = textOf(result.lines).toUpperCase();
  expect(paper, 'the station it is FOR').toContain('TANDOOR');
  expect(paper, 'never the station of the machine printing it').not.toContain('MAIN KITCHEN');
  expect(paper, 'and it is the tandoor dish on it').toContain('PANEER');
});

test('the station cannot be supplied by a caller — it comes from the job and nowhere else', () => {
  // Structural, and it is the point: `ComposeInput.header` omits `station`, so the one wrong
  // value that looks entirely plausible — the printing machine's own station — has no way in.
  expect(Object.keys(HEADER), 'the header carries no station').not.toContain('station');

  // And what lands on the paper is the job's, verbatim.
  const result = compose();
  expect(result.ok && textOf(result.lines)).toContain(job().station);
});

test('an empty station costs no line, in the idiom `note` already uses', () => {
  // A machine with no station configured. `resolvePrinter` carries the empty string through, and
  // a blank STATION line would cost a line of paper and tell the kitchen nothing.
  const nameless = { ...VEG, id: 'p9', machineId: 'KOT-NONE', station: '' };
  const result = composeTicket({
    job: { id: 'j', kind: 'kot', printerId: 'p9', station: '', foodSide: 'all', isReprint: false },
    width: '80',
    template: {},
    printers: [nameless],
    splitByFoodType: false,
    header: HEADER,
    items: [DAL],
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(textOf(result.lines)).not.toContain('STATION');
  expect(textOf(result.lines), 'the round is still on it').toContain('Dal Tadka');
});

test('switching the station field off removes it, like any other field', () => {
  const base = defaultTemplate('kot', '80');
  const result = compose({ template: { ...base, on: { ...base.on, station: false } } });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(textOf(result.lines)).not.toContain('STATION');
});

/* ── The refusals ──────────────────────────────────────────────────────── */

/* ── The split, now that the row records which half it is ──────────────── */

/**
 * SUPERSEDED 22-Sep-2026 (R4-1), under the contract-change exception in jalsa/CLAUDE.md.
 *
 * This block previously held ONE rung, "BLOCKED: two tickets for one machine and station cannot
 * be told apart". It asserted that a round split veg/non-veg to one machine could not be composed
 * at all, because `print_job` stored `printer_id` and `station` and discarded the third segment
 * of `splitRound`'s bucket key. That was a true statement about a defective contract.
 *
 * `print_job.food_side` now records the half, so both tickets compose. The refusal is NOT deleted
 * — it is kept below for the case that is still genuinely ambiguous, a row written before the
 * column existed, which carries the backfill default and therefore says nothing. What replaces
 * the old assertion is the stronger positive one: the two halves are disjoint and together they
 * are the whole round.
 */
test('the two halves of a split round are DISJOINT and together are the whole round', () => {
  const round = [BIRYANI, VEG_BIRYANI];
  const at = (foodSide: ComposeJob['foodSide']): string[] => {
    const r = compose({
      job: job({ printerId: 'p2', station: 'Main Kitchen', foodSide }),
      items: round,
      splitByFoodType: true,
    });
    expect(r.ok, `the ${foodSide} half must compose`).toBe(true);
    return r.ok ? round.filter((i) => textOf(r.lines).includes(i.name)).map((i) => i.name) : [];
  };

  const vegHalf = at('veg_side');
  const nonVegHalf = at('non_veg');

  // Not merely "different". Union is the round; intersection is empty. Anything weaker passes on
  // two tickets that both carry the whole round, which is the defect this replaced.
  expect([...vegHalf, ...nonVegHalf].sort()).toEqual(round.map((i) => i.name).sort());
  expect(vegHalf.filter((n) => nonVegHalf.includes(n)), 'no dish on both tickets').toEqual([]);
  expect(vegHalf).toEqual(['Veg Biryani']);
  expect(nonVegHalf).toEqual(['Chicken Biryani']);
});

test('BLOCKED: a row that predates the food_side column is still refused', () => {
  // The backfill default is 'all', which is correct for every row written while the split was off
  // and says nothing at all about a row written while it was on. Guessing between the two halves
  // prints the whole round twice at one machine, so the legacy row is refused exactly as before.
  const result = compose({
    job: job({ printerId: 'p2', station: 'Main Kitchen', foodSide: 'all' }),
    items: [BIRYANI, VEG_BIRYANI],
    splitByFoodType: true,
  });

  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('veg / non-veg');
  expect(!result.ok && result.blocked).toContain('duplicate');
  // And it says WHY it cannot, in terms of the row rather than of a design gap.
  expect(!result.ok && result.blocked).toContain('predates');
});

test('a job asking for a half the round no longer has is refused, and says which half', () => {
  const result = compose({
    job: job({ printerId: 'p2', station: 'Main Kitchen', foodSide: 'non_veg' }),
    items: [VEG_BIRYANI],
    splitByFoodType: true,
  });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('non-veg half');
});

test('the same round with the split OFF composes normally — the refusal is not blanket', () => {
  const result = compose({
    job: job({ printerId: 'p2', station: 'Main Kitchen' }),
    items: [BIRYANI, VEG_BIRYANI],
    splitByFoodType: false,
  });
  expect(result.ok).toBe(true);
  expect(result.ok && result.itemCount).toBe(2);
});

test('BLOCKED: the routing changed after this job was assigned', () => {
  // The assignment is immutable and the configuration is not. A tandoor job whose category has
  // since been re-routed cannot have its contents reconstructed, and the honest answer is to say
  // so rather than to print whatever still happens to match.
  const result = compose({ printers: [VEG, NV] });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('routing configuration changed');
});

test('BLOCKED: a job with no machine has no ticket', () => {
  const result = compose({ job: job({ printerId: null, station: '' }) });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('never assigned');
});

test('every refusal reads as a sentence, not a code', () => {
  // It lands in `print_job.last_error`, which a person reads on the history screen at speed.
  for (const result of [
    compose({ job: job({ printerId: null }) }),
    compose({ printers: [VEG] }),
    compose({ job: job({ printerId: 'p2', station: 'Main Kitchen' }), items: [BIRYANI, VEG_BIRYANI], splitByFoodType: true }),
  ]) {
    expect(result.ok).toBe(false);
    if (result.ok) continue;
    expect(result.blocked.length).toBeGreaterThan(40);
    expect(result.blocked.trim().endsWith('.')).toBe(true);
  }
});

/* ── Paper ─────────────────────────────────────────────────────────────── */

test('the ASSIGNED machine decides the paper, overriding the saved template', () => {
  // The template is one configuration shared by every machine of a kind; the roll is a property
  // of the one in the corner. A 58 mm machine fed 80 mm of layout loses its right-hand column.
  const wide = compose({ width: '80', template: { width: '58' } });
  const narrow = compose({ width: '58', template: { width: '80' } });

  expect(wide.ok && wide.width).toBe('80');
  expect(narrow.ok && narrow.width).toBe('58');
  if (!wide.ok || !narrow.ok) return;

  const widest = (lines: TicketLine[]): number => Math.max(...lines.map((l) => l.text.length));
  expect(widest(narrow.lines)).toBeLessThanOrEqual(PAPER['58'].cols.normal);
  expect(widest(wide.lines)).toBeLessThanOrEqual(PAPER['80'].cols.normal);
});

test('a saved template still applies where the paper does not contradict it', () => {
  const base = defaultTemplate('kot', '80');
  const hidden = compose({ template: { ...base, on: { ...base.on, table: false } } });
  const shown = compose();

  expect(hidden.ok && shown.ok).toBe(true);
  if (!hidden.ok || !shown.ok) return;
  // The owner switched the table line off; the paper override must not switch it back on.
  expect(textOf(hidden.lines)).not.toContain('T12');
  expect(textOf(shown.lines)).toContain('T12');
});

/* ── Determinism ───────────────────────────────────────────────────────── */

test('the same job composes the same lines, every time', () => {
  // Nothing here reads a clock or a random. That is the whole reason the byte-determinism rung
  // in the loop spec can mean anything.
  const runs = Array.from({ length: 5 }, () => compose());
  for (const r of runs) expect(r.ok).toBe(true);
  const first = JSON.stringify(runs[0]);
  for (const r of runs) expect(JSON.stringify(r)).toBe(first);
});

test('item order on the paper follows the order it was handed, not a set', () => {
  const a = compose({ job: job({ printerId: 'p1', station: 'Main Kitchen' }), items: [DAL, item({ name: 'Jeera Rice', category: 'Curry' })] });
  const b = compose({ job: job({ printerId: 'p1', station: 'Main Kitchen' }), items: [item({ name: 'Jeera Rice', category: 'Curry' }), DAL] });
  expect(a.ok && b.ok).toBe(true);
  if (!a.ok || !b.ok) return;
  expect(textOf(a.lines).indexOf('Dal Tadka')).toBeLessThan(textOf(a.lines).indexOf('Jeera Rice'));
  expect(textOf(b.lines).indexOf('Jeera Rice')).toBeLessThan(textOf(b.lines).indexOf('Dal Tadka'));
});

/* ── A reprint says so ─────────────────────────────────────────────────── */

test('a reprint job composes a ticket that admits it is a reprint', () => {
  const fresh = compose();
  const again = compose({ job: job({ isReprint: true }) });
  expect(fresh.ok && again.ok).toBe(true);
  if (!fresh.ok || !again.ok) return;
  expect(textOf(again.lines).toUpperCase()).toContain('REPRINT');
  expect(textOf(fresh.lines).toUpperCase()).not.toContain('REPRINT');
});

/* ── The composer decides nothing about destination ────────────────────── */

test('nothing a composed result carries could name a printer', () => {
  const result = compose();
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(Object.keys(result).sort()).toEqual(['itemCount', 'lines', 'ok', 'width']);
});

/* ── R4-1 · A redirected ticket carries the ORIGIN's half ──────────────── */

test('a redirect composed from the ORIGIN identity carries the origin’s dishes', () => {
  // The whole defect, as a pair of rungs. A tandoor round is redirected by hand to the main
  // kitchen machine — a machine this round ALSO touches, which is what made the old behaviour
  // silent rather than merely wrong.
  const round = [PANEER, DAL]; // PANEER -> p3|Tandoor, DAL -> p1|Main Kitchen

  const fromOrigin = compose({
    job: job({ id: 'redirect', printerId: 'p3', station: 'Tandoor', foodSide: 'all' }),
    items: round,
  });

  expect(fromOrigin.ok).toBe(true);
  if (!fromOrigin.ok) return;
  expect(textOf(fromOrigin.lines), 'the tandoor dish, which is what was redirected').toContain('Paneer Tikka');
  expect(textOf(fromOrigin.lines), 'not the main kitchen’s').not.toContain('Dal Tadka');
});

test('the same redirect composed from its OWN identity would carry the wrong half', () => {
  // Kept as the negative half of the pair. This is what `bridge-payload.ts` used to do, and the
  // reason `redirect-lineage.ts` exists — the output is a perfectly ordinary-looking ticket for
  // food that already printed somewhere else.
  const round = [PANEER, DAL];

  const fromItself = compose({
    job: job({ id: 'redirect', printerId: 'p1', station: 'Main Kitchen', foodSide: 'all' }),
    items: round,
  });

  expect(fromItself.ok).toBe(true);
  if (!fromItself.ok) return;
  expect(textOf(fromItself.lines), 'the main kitchen’s dish — the wrong one').toContain('Dal Tadka');
  expect(textOf(fromItself.lines)).not.toContain('Paneer Tikka');
});
