/**
 * Ticket golden bytes — the paper, pinned.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM `escpos.unit.spec.ts`
 *   That file pins the ENCODER: given these lines, these bytes. This one pins the whole
 *   composition — routing decision, template, item selection, encoder — for one fixed round, so a
 *   change anywhere in that chain shows up as a diff in a byte string rather than as nothing.
 *
 * GOLDEN A AND GOLDEN B, AND WHY BOTH ARE HERE
 *   A is the ticket as it was BEFORE the 22-Sep-2026 remediation, captured from the pre-change
 *   tree and reproduced here with the station field switched off. It is the executable form of
 *   the promise that R4-1 changed no output: `food_side` records which half of a round a ticket
 *   is, and for a round that was never split it must change nothing at all, byte for byte.
 *
 *   B is the ticket as it is now, with the station line printing by default. The difference
 *   between A and B is the ENTIRE visible effect of R4-2, and it is recorded as bytes rather than
 *   described in a sentence — 39 bytes at 58 mm, 55 at 80 mm, one line of paper each.
 *
 * IF ONE OF THESE FAILS
 *   A failing A means something changed the ticket that was not supposed to. A failing B means
 *   the station line moved, changed weight, or stopped printing. Neither is a test to update
 *   until the change has been looked at.
 *
 * FAIL-FIRST EVIDENCE (22-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';
import { PAPER, defaultTemplate, type PaperWidth, type TicketLine } from '../../src/lib/print-template';
import type { RoutablePrinter } from '../../src/lib/print-routing';
import { composeTicket, type ComposeItem } from '../../src/lib/ticket-compose';

const mk = (o: Partial<RoutablePrinter> & { id: string; machineId: string }): RoutablePrinter => ({
  name: `TVS RP 3160 — ${o.machineId}`,
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: false,
  enabled: true,
  ...o,
});

const VEG = mk({ id: 'p1', machineId: 'KOT-VEG-01', station: 'Main Kitchen' });
const TANDOOR = mk({ id: 'p3', machineId: 'KOT-TANDOOR', station: 'Tandoor', routes: ['Tandoor'] });
const PRINTERS = [VEG, TANDOOR];

/** Both food types, so the fixture would notice a split it was not asked for. */
const ITEMS: ComposeItem[] = [
  { name: 'Paneer Tikka', qty: 2, foodType: 'veg', rate: 0, category: 'Tandoor', instruction: '' },
  { name: 'Chicken Tikka', qty: 1, foodType: 'non_veg', rate: 0, category: 'Tandoor', instruction: '' },
];

const HEADER = {
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
  note: 'No onion in the paneer',
};

function compose(width: PaperWidth, station: boolean): TicketLine[] {
  const base = defaultTemplate('kot', width);
  const result = composeTicket({
    job: { id: 'g', kind: 'kot', printerId: 'p3', station: 'Tandoor', foodSide: 'all', isReprint: false },
    width,
    template: station ? base : { ...base, on: { ...base.on, station: false } },
    printers: PRINTERS,
    splitByFoodType: false,
    header: HEADER,
    items: ITEMS,
  });
  if (!result.ok) throw new Error(`the golden fixture must compose: ${result.blocked}`);
  return result.lines;
}

const ticket = (width: PaperWidth, station: boolean): string =>
  hex(encodeTicket(compose(width, station), { ...DEFAULT_ENCODER, width }));

/* ── GOLDEN A — captured from the tree BEFORE the 22-Sep-2026 remediation ── */

const GOLDEN_A_58 =
    '1B 40 1B 74 00 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 20 4A 41 4C ' +
    '53 41 0A 1D 21 00 20 20 20 20 20 20 20 20 20 20 20 20 20 48 6F 73 75 72 ' +
    '0A 20 20 20 20 20 20 20 20 20 20 30 34 33 34 34 20 30 30 30 30 30 30 0A ' +
    '20 0A 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 4B 4F 54 2D 31 31 33 ' +
    '0A 1D 21 00 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 54 41 42 4C 45 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 54 31 32 0A 42 49 ' +
    '4C 4C 20 4E 4F 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '42 2D 30 30 30 37 0A 43 41 50 54 41 49 4E 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 47 75 65 73 74 20 70 68 6F 6E 65 0A 44 41 54 45 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 32 31 20 53 65 70 20 32 30 32 36 ' +
    '0A 54 49 4D 45 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 37 3A 34 30 20 50 4D 0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 20 56 45 47 20 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 ' +
    '00 50 61 6E 65 65 72 20 54 69 6B 6B 61 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 32 0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '20 4E 4F 4E 2D 56 45 47 20 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 ' +
    '00 43 68 69 63 6B 65 6E 20 54 69 6B 6B 61 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 31 0A 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 4E 4F 54 45 53 ' +
    '3A 0A 4E 6F 20 6F 6E 69 6F 6E 20 69 6E 20 74 68 65 20 70 61 6E 65 65 72 ' +
    '0A 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 20 20 20 20 20 20 20 20 2D 2D 20 45 4E 44 ' +
    '20 4F 46 20 4B 4F 54 20 2D 2D 0A 20 0A 20 0A 20 0A 1B 64 04';

const GOLDEN_A_80 =
    '1B 40 1B 74 00 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 4A 41 4C 53 41 0A 1D 21 00 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 48 6F 73 75 72 0A 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 30 34 33 34 34 20 30 30 30 30 30 30 0A ' +
    '20 0A 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 4B 4F 54 2D 31 31 33 0A 1D 21 00 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 54 41 42 4C 45 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 54 31 32 0A 42 49 4C 4C 20 4E 4F 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 42 2D 30 30 30 37 0A 43 41 50 54 41 49 4E 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 47 75 65 73 74 20 70 68 6F 6E 65 0A 44 41 54 45 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 32 31 20 53 65 70 20 32 30 32 36 0A 54 49 4D 45 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 37 3A 34 30 20 50 4D 0A 1B 45 01 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 20 56 45 47 20 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 ' +
    '00 50 61 6E 65 65 72 20 54 69 6B 6B 61 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '32 0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '20 4E 4F 4E 2D 56 45 47 20 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 0A 1B 45 00 43 68 69 63 6B 65 6E 20 54 69 6B 6B 61 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 31 0A 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 4E 4F 54 45 53 3A 0A 4E 6F 20 6F 6E 69 ' +
    '6F 6E 20 69 6E 20 74 68 65 20 70 61 6E 65 65 72 0A 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 2D 2D 20 45 4E 44 20 4F 46 20 4B 4F 54 20 ' +
    '2D 2D 0A 20 0A 20 0A 20 0A 1B 64 04';

/* ── GOLDEN B — the same round with the station line, which is the change ── */

const GOLDEN_B_58 =
    '1B 40 1B 74 00 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 20 4A 41 4C ' +
    '53 41 0A 1D 21 00 20 20 20 20 20 20 20 20 20 20 20 20 20 48 6F 73 75 72 ' +
    '0A 20 20 20 20 20 20 20 20 20 20 30 34 33 34 34 20 30 30 30 30 30 30 0A ' +
    '20 0A 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 4B 4F 54 2D 31 31 33 ' +
    '0A 1D 21 00 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 01 53 54 41 54 49 4F 4E 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 54 61 6E 64 6F 6F 72 ' +
    '0A 1B 45 00 54 41 42 4C 45 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 54 31 32 0A 42 49 4C 4C 20 4E 4F 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 42 2D 30 30 30 37 0A 43 41 ' +
    '50 54 41 49 4E 20 20 20 20 20 20 20 20 20 20 20 20 20 20 47 75 65 73 74 ' +
    '20 70 68 6F 6E 65 0A 44 41 54 45 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 32 31 20 53 65 70 20 32 30 32 36 0A 54 49 4D 45 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 37 3A 34 30 20 50 4D ' +
    '0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 20 56 45 47 20 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 00 50 61 6E 65 65 72 20 54 ' +
    '69 6B 6B 61 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 32 ' +
    '0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 20 4E 4F 4E 2D 56 45 47 20 ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 00 43 68 69 63 6B 65 6E 20 ' +
    '54 69 6B 6B 61 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 31 ' +
    '0A 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 4E 4F 54 45 53 3A 0A 4E 6F 20 6F 6E 69 6F ' +
    '6E 20 69 6E 20 74 68 65 20 70 61 6E 65 65 72 0A 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '0A 20 20 20 20 20 20 20 20 2D 2D 20 45 4E 44 20 4F 46 20 4B 4F 54 20 2D ' +
    '2D 0A 20 0A 20 0A 20 0A 1B 64 04';

const GOLDEN_B_80 =
    '1B 40 1B 74 00 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 4A 41 4C 53 41 0A 1D 21 00 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 48 6F 73 75 72 0A 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 30 34 33 34 34 20 30 30 30 30 30 30 0A ' +
    '20 0A 1D 21 11 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 4B 4F 54 2D 31 31 33 0A 1D 21 00 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 01 53 54 41 54 49 4F 4E 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 54 61 6E 64 6F 6F 72 0A 1B 45 00 54 41 42 4C ' +
    '45 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 54 31 32 0A 42 49 4C ' +
    '4C 20 4E 4F 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 42 2D 30 30 30 37 0A 43 41 ' +
    '50 54 41 49 4E 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 47 75 65 73 74 20 70 68 6F 6E 65 0A 44 ' +
    '41 54 45 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 32 31 20 53 65 70 20 32 30 32 36 0A ' +
    '54 49 4D 45 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 37 3A 34 30 20 50 4D ' +
    '0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 20 56 45 47 20 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 0A 1B 45 00 50 61 6E 65 65 72 20 54 69 6B 6B 61 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 32 0A 1B 45 01 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 20 4E 4F 4E 2D 56 45 47 20 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 1B 45 00 43 68 69 63 6B 65 6E 20 ' +
    '54 69 6B 6B 61 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 ' +
    '20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 31 0A 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 0A 4E 4F 54 45 53 3A ' +
    '0A 4E 6F 20 6F 6E 69 6F 6E 20 69 6E 20 74 68 65 20 70 61 6E 65 65 72 0A ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D 2D ' +
    '0A 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 2D 2D 20 45 4E 44 20 ' +
    '4F 46 20 4B 4F 54 20 2D 2D 0A 20 0A 20 0A 20 0A 1B 64 04';

/* ── R4-1: the un-split path did not move ──────────────────────────────── */

test('58 mm: a round that was never split encodes exactly as it did before R4-1', () => {
  expect(ticket('58', false)).toBe(GOLDEN_A_58);
});

test('80 mm: a round that was never split encodes exactly as it did before R4-1', () => {
  expect(ticket('80', false)).toBe(GOLDEN_A_80);
});

/* ── R4-2: the station line, recorded as the deliberate change ─────────── */

test('58 mm: the ticket as it prints today, station line included', () => {
  expect(ticket('58', true)).toBe(GOLDEN_B_58);
});

test('80 mm: the ticket as it prints today, station line included', () => {
  expect(ticket('80', true)).toBe(GOLDEN_B_80);
});

test('the ONLY difference between A and B is the station line', () => {
  // DIFFED AS LINES, NOT AS BYTES, AND DELIBERATELY SO.
  //   The first version of this rung decoded the golden hex back to text by keeping printable
  //   bytes. That leaks the `E` out of `ESC E 01` — the bold-on the station line introduced — and
  //   reported two added lines instead of one. Decoding it properly would mean an ESC/POS parser
  //   inside a test, which is the thing `file.ts` refuses to grow for the same reason: a second
  //   implementation that can disagree with the encoder.
  //
  //   The BYTES are already pinned exactly, four rungs above. What this one adds is the shape of
  //   the change, and the composer's own `TicketLine[]` is where that lives.
  for (const width of ['58', '80'] as PaperWidth[]) {
    const a = compose(width, false).map((l) => `${l.weight}:${l.text}`);
    const b = compose(width, true).map((l) => `${l.weight}:${l.text}`);

    expect(b.length - a.length, `${width} mm: exactly one line added`).toBe(1);

    const added = b.filter((l, i) => a[i] !== l && !a.includes(l));
    expect(added.length, `${width} mm: and only one line is new`).toBe(1);
    expect(added[0], `${width} mm: it is the station, and it is bold`).toContain('bold:STATION');
    expect(added[0]).toContain('Tandoor');

    // Nothing was removed, and everything else kept its weight.
    expect(a.filter((l) => !b.includes(l)), `${width} mm: nothing was lost`).toEqual([]);
  }
});

test('the station line fits the paper at both widths', () => {
  for (const width of ['58', '80'] as PaperWidth[]) {
    const station = compose(width, true).filter((l) => l.text.startsWith('STATION'));
    expect(station.length, `${width} mm: the station prints`).toBe(1);
    // The encoder never wraps, so a line wider than the roll is lost on the paper rather than
    // rejected. This is the only place that is caught.
    expect(station[0]?.text.length, `${width} mm`).toBe(PAPER[width].cols.normal);
  }
});
