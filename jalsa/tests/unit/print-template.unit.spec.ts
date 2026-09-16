/**
 * print-template unit spec — the character grid, pinned to the width of the paper.
 *
 * WHY THIS FILE IS THE WHOLE OF THE PRINT SETUP EVIDENCE
 *   Nothing else in this repository can observe a thermal ticket. There is no printer in CI, no
 *   58 mm roll, and the owner's screen cannot be rendered against data here. What CAN be
 *   observed is the string a printer would be handed, so every claim the design makes about the
 *   grid — "N character positions", "separate layouts rather than one scaled picture",
 *   "validation blocks a save that would print clipped" — is asserted against that string.
 *
 * FAIL-FIRST EVIDENCE: observed on 16-Sep-2026. Against the pre-fix tree every test here failed
 * to collect — `src/lib/print-template.ts` did not exist, so the import threw and the file was
 * reported as an error rather than as passes. That proves the file is new, not that its
 * assertions can fail, so two deliberate defects were then introduced into the finished module
 * and the suite re-run: **4 failed, 30 passed**.
 *
 *   1. `validateTemplate` returning `canSave: true` regardless of its failures. Three tests
 *      went red — "AN OVER-WIDTH LINE BLOCKS THE SAVE", "a printable width WIDER than the roll
 *      is refused", and "AUTO-FIT PRODUCES A TEMPLATE THAT ACTUALLY VALIDATES". That is the
 *      exact defect the design's failure note describes: the line does not shrink on a thermal
 *      printer, it disappears, and a warning nobody is forced to read is how it reaches the
 *      kitchen.
 *   2. The reprint band spliced in after the header instead of prepended. "A REPRINT IS MARKED
 *      BEFORE ANYTHING ELSE" went red — the mark landed on line 4, below the restaurant name.
 *      A cook reading the top of the ticket sees a normal KOT and cooks the round twice.
 *
 * Both defects were reverted and the suite returned to 34 passed.
 */
import { test, expect } from '@playwright/test';
import {
  PAPER,
  autoFit,
  buildBill,
  buildKot,
  centre,
  columnsFor,
  defaultTemplate,
  groupHeading,
  itemLines,
  leftRight,
  printOrder,
  validateTemplate,
  wrap,
  type TemplateConfig,
  type TicketData,
} from '../../src/lib/print-template';

const DATA: TicketData = {
  restaurant: 'JALSA RESTAURANT',
  branch: 'Bagalur Road, Hosur',
  phone: '+91 90000 12345',
  gstin: '33ABCDE1234F1Z5',
  kotCode: 'KOT-0042',
  roundCode: 'R-3',
  billCode: 'B-1048',
  table: 'T12',
  customer: 'Rahul',
  captain: 'Imran',
  date: '09-Sep-2026',
  time: '08:42 PM',
  source: 'Guest phone',
  note: 'Less spicy, no onion in the paneer',
  items: [
    { name: 'Paneer Butter Masala Special', qty: 1, foodType: 'veg', rate: 191, category: 'Indian Curry', instruction: 'less spicy' },
    { name: 'Veg Fried Rice', qty: 2, foodType: 'veg', rate: 130, category: 'Rice', instruction: '' },
    { name: 'Chicken 65', qty: 2, foodType: 'non_veg', rate: 140, category: 'Non-Veg Starters', instruction: '' },
    { name: 'Egg Fried Rice', qty: 1, foodType: 'egg', rate: 160, category: 'Rice', instruction: '' },
  ],
  totals: { subtotal: 981, discount: 50, tax: 47, payable: 978, paymentMode: 'UPI' },
  upiId: 'jalsahosur@upi',
};

const kot = (patch?: Partial<TemplateConfig>): TemplateConfig => ({ ...defaultTemplate('kot'), ...patch });
const bill = (patch?: Partial<TemplateConfig>): TemplateConfig => ({ ...defaultTemplate('bill'), ...patch });

/* ── The grid primitives ───────────────────────────────────────────────── */

test('centring is by character position, not by a proportional measurement', () => {
  expect(centre('JALSA', 11)).toBe('   JALSA');
  expect(centre('JALSA', 11).length + 3).toBe(11);
});

test('a centred line WIDER than the paper is cut, because the paper cuts it', () => {
  expect(centre('JALSA RESTAURANT', 8)).toBe('JALSA RE');
});

test('left and right meet exactly at the width', () => {
  expect(leftRight('TABLE', 'T12', 20)).toBe('TABLE            T12');
  expect(leftRight('TABLE', 'T12', 20)).toHaveLength(20);
});

test('when the pair cannot fit, the RIGHT value loses characters — a clipped figure is a lie', () => {
  // A clipped label is still readable as a label. A clipped amount reads as a smaller amount.
  const line = leftRight('SUBTOTAL', '129999', 10);
  expect(line).toHaveLength(10);
  expect(line.startsWith('SUBTOTAL')).toBe(true);
});

test('wrapping breaks on spaces; a single word longer than the line is cut', () => {
  expect(wrap('Paneer Butter Masala', 12)).toEqual(['Paneer', 'Butter', 'Masala']);
  expect(wrap('Supercalifragilistic', 8)).toEqual(['Supercal']);
});

test('wrapping nothing yields ONE empty line, never an empty ticket section', () => {
  expect(wrap('', 32)).toEqual(['']);
  expect(wrap('   ', 32)).toEqual(['']);
});

test('a group heading is padded to exactly the width so the band reads as a band', () => {
  const head = groupHeading('VEG', kot(), 32);
  expect(head).toHaveLength(32);
  expect(head).toContain(' VEG ');
});

/* ── 58 mm is a different layout, not a smaller picture ────────────────── */

test('THE TWO WIDTHS ARE DIFFERENT GRIDS — 48 characters against 32', () => {
  expect(columnsFor(kot({ width: '80', font: 'normal' }))).toBe(48);
  expect(columnsFor(kot({ width: '58', font: 'normal' }))).toBe(32);
  expect(PAPER['58'].printable).toBeLessThan(PAPER['58'].mm);
});

test('EVERY LINE OF A VALID TICKET FITS ITS GRID, at both widths', () => {
  (['80', '58'] as const).forEach((width) => {
    const config = kot({ width, printableMm: PAPER[width].printable });
    const cols = columnsFor(config);
    buildKot(DATA, config).forEach((line) => {
      expect(line.text.length, `"${line.text}" at ${width} mm`).toBeLessThanOrEqual(cols);
    });
  });
});

test('the SAME ticket at the two widths is re-flowed, not scaled — the line counts differ', () => {
  const wide = buildKot(DATA, kot({ width: '80' })).length;
  const narrow = buildKot(DATA, kot({ width: '58' })).length;
  expect(narrow).toBeGreaterThan(wide);
});

/* ── Item layouts ──────────────────────────────────────────────────────── */

test('layout A puts the quantity at the right-hand edge of the LAST wrapped line', () => {
  const lines = itemLines(DATA.items[0]!, kot({ layout: 'A' }), 32, false);
  expect(lines[lines.length - 1]!.endsWith('1')).toBe(true);
  expect(lines[lines.length - 1]).toHaveLength(32);
});

test('layout B puts the quantity FIRST, where a narrow roll cannot strand it', () => {
  const lines = itemLines(DATA.items[0]!, kot({ layout: 'B' }), 24, false);
  expect(lines[0]!.startsWith('1 x ')).toBe(true);
  // Continuation lines are indented under the name, never under the quantity.
  lines.slice(1).forEach((l) => expect(l.startsWith('    ')).toBe(true));
});

test('layout C gives the name its own lines and the quantity its own', () => {
  const lines = itemLines(DATA.items[0]!, kot({ layout: 'C' }), 20, false);
  expect(lines[lines.length - 1]!.trim()).toBe('x1');
});

test('a bill line carries the AMOUNT and a KOT line never does — the kitchen is not told the price', () => {
  const billLine = itemLines(DATA.items[2]!, bill(), 48, true).join('\n');
  const kotLine = itemLines(DATA.items[2]!, kot(), 48, false).join('\n');
  expect(billLine).toContain('280');
  expect(kotLine).not.toContain('280');
});

/* ── Food-type grouping ────────────────────────────────────────────────── */

test('grouping prints a band per food type, in the configured order', () => {
  const text = buildKot(DATA, kot({ group: true, groupOrder: ['non_veg', 'veg', 'egg'] }))
    .map((l) => l.text)
    .join('\n');
  expect(text.indexOf('NON-VEG')).toBeLessThan(text.indexOf(' VEG '));
  expect(text).toContain('EGG');
});

test('an EMPTY group drops out rather than printing an empty heading', () => {
  const vegOnly: TicketData = { ...DATA, items: DATA.items.filter((i) => i.foodType === 'veg') };
  const text = buildKot(vegOnly, kot({ hideEmpty: true })).map((l) => l.text).join('\n');
  expect(text).not.toContain('NON-VEG');
  expect(text).not.toContain('EGG');
});

test('with grouping OFF the items print as one list and no band appears', () => {
  const text = buildKot(DATA, kot({ group: false })).map((l) => l.text).join('\n');
  expect(text).not.toContain(' VEG ');
  expect(text).toContain('Chicken 65');
});

/* ── Which lines print ─────────────────────────────────────────────────── */

test('switching a field off removes its line and NOTHING else', () => {
  const on = buildKot(DATA, kot()).map((l) => l.text).join('\n');
  const off = buildKot(DATA, kot({ on: { ...defaultTemplate('kot').on, table: false } }))
    .map((l) => l.text)
    .join('\n');
  expect(on).toContain('TABLE');
  expect(off).not.toContain('TABLE');
  expect(off).toContain('BILL NO');
});

test('reordering fields reorders the ticket', () => {
  const base = defaultTemplate('kot');
  const swapped = kot({ order: ['time', 'date', ...base.order.filter((k) => k !== 'time' && k !== 'date')] });
  const text = buildKot(DATA, swapped).map((l) => l.text).join('\n');
  expect(text.indexOf('TIME')).toBeLessThan(text.indexOf('DATE'));
});

test('A SAVED TEMPLATE SURVIVES THIS MODULE GAINING A FIELD — the unknown key still prints', () => {
  // A template stored before `instr` existed lists every other key and not that one. Dropping
  // it would silently stop printing special instructions, with no symptom anybody could trace.
  const stale = kot({ order: defaultTemplate('kot').order.filter((k) => k !== 'instr') });
  expect(printOrder(stale, 'kot')).toContain('instr');
});

test('a field key this module has never heard of is ignored rather than printed blank', () => {
  expect(printOrder(kot({ order: ['ghost', 'kot'] }), 'kot')).not.toContain('ghost');
});

/* ── The bill ──────────────────────────────────────────────────────────── */

test('the two printed GST halves add back to the tax the bill was totalled with', () => {
  const odd: TicketData = { ...DATA, totals: { ...DATA.totals!, tax: 47.01 } };
  const text = buildBill(odd, bill()).map((l) => l.text).join('\n');
  const halves = [...text.matchAll(/(?:CGST|SGST)\s+([\d.]+)/g)].map((m) => Number(m[1]));
  expect(halves).toHaveLength(2);
  expect(Math.round((halves[0]! + halves[1]!) * 100) / 100).toBe(47.01);
});

test('a discount of nothing is not a line — printing "DISCOUNT 0" invites the question', () => {
  const none: TicketData = { ...DATA, totals: { ...DATA.totals!, discount: 0 } };
  expect(buildBill(none, bill()).map((l) => l.text).join('\n')).not.toContain('DISCOUNT');
  expect(buildBill(DATA, bill()).map((l) => l.text).join('\n')).toContain('DISCOUNT');
});

test('no UPI id configured means no QR block, not an empty one', () => {
  const noUpi: TicketData = { ...DATA, upiId: '' };
  expect(buildBill(noUpi, bill()).map((l) => l.text).join('\n')).not.toContain('UPI QR');
});

/* ── The reprint mark ──────────────────────────────────────────────────── */

test('A REPRINT IS MARKED BEFORE ANYTHING ELSE — it is the first line on the paper', () => {
  const lines = buildKot(DATA, kot(), { reprint: true });
  expect(lines[0]!.text).toContain('*** REPRINT ***');
  expect(lines[0]!.weight).toBe('big');
});

test('the reprint mark is NOT configurable — switching every field off still prints it', () => {
  const nothingOn = kot({ on: Object.fromEntries(defaultTemplate('kot').order.map((k) => [k, false])) });
  expect(buildKot(DATA, nothingOn, { reprint: true })[0]!.text).toContain('REPRINT');
});

test('an ordinary ticket carries no reprint mark', () => {
  expect(buildKot(DATA, kot()).map((l) => l.text).join('\n')).not.toContain('REPRINT');
});

/* ── Validation blocks the save ────────────────────────────────────────── */

test('AN OVER-WIDTH LINE BLOCKS THE SAVE — it does not shrink on a thermal printer', () => {
  const verdict = validateTemplate('kot', DATA, kot({ width: '58', font: 'large' }));
  expect(verdict.canSave).toBe(false);
  expect(verdict.failures.length).toBeGreaterThan(0);
  expect(verdict.checks.some((c) => !c.ok)).toBe(true);
});

test('a workable template reports no failures and may be saved', () => {
  const verdict = validateTemplate('kot', DATA, kot({ width: '80', font: 'normal' }));
  expect(verdict.failures).toEqual([]);
  expect(verdict.canSave).toBe(true);
  expect(verdict.cols).toBe(48);
});

test('a printable width WIDER than the roll is refused', () => {
  expect(validateTemplate('kot', DATA, kot({ printableMm: 96 })).canSave).toBe(false);
  expect(validateTemplate('kot', DATA, kot({ printableMm: 0 })).canSave).toBe(false);
});

test('every verdict names what it checked, passing or failing — a silent pass proves nothing', () => {
  const verdict = validateTemplate('bill', DATA, bill());
  expect(verdict.checks.length).toBeGreaterThanOrEqual(5);
  verdict.checks.forEach((c) => expect(c.label.length).toBeGreaterThan(10));
  expect(verdict.lineCount).toBeGreaterThan(10);
});

test('AUTO-FIT PRODUCES A TEMPLATE THAT ACTUALLY VALIDATES, not one that merely differs', () => {
  const broken = kot({ width: '58', font: 'large', layout: 'A' });
  expect(validateTemplate('kot', DATA, broken).canSave).toBe(false);
  const fixed = autoFit('kot', DATA, broken);
  expect(validateTemplate('kot', DATA, fixed).canSave).toBe(true);
});

test('auto-fit NEVER switches a field off — what the kitchen is told is not the machine`s call', () => {
  const broken = kot({ width: '58', font: 'large' });
  const fixed = autoFit('kot', DATA, broken);
  expect(fixed.on).toEqual(broken.on);
  expect(fixed.order).toEqual(broken.order);
});

test('auto-fit on an already-valid template changes nothing at all', () => {
  const good = kot({ width: '80' });
  expect(autoFit('kot', DATA, good)).toEqual(good);
});
