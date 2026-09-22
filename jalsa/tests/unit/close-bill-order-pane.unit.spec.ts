/**
 * The Record payment dialog's order pane, read out of the source that ships it.
 *
 * WHY A SOURCE PARSE
 *   What this change adds is a READING of data the component already received and ignored.
 *   There is no new function to call and no new value to compute, so there is nothing a pure
 *   unit test could exercise — the only questions worth asking are structural, and the file is
 *   where the answers are. `tests/render/close-bill-panes.render.spec.ts` measures the layout.
 *
 * WHAT IT GUARDS AGAINST, SPECIFICALLY
 *   1. The pane quietly losing its data source and going back to showing only sums.
 *   2. The per-table breakdown being DUPLICATED rather than moved — two lists of the same
 *      figures on one dialog is worse than the one list that was there before.
 *   3. A second way of drawing a dish line appearing, diverging from `LiveOrders`.
 *   4. A data-layer import creeping in. The whole point is that none is needed.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026, run against the pre-change tree — `git stash` of
 * CloseBillSheet.tsx): OBSERVED FAILING — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SOURCE = 'src/features/owner/CloseBillSheet.tsx';
const source = readFileSync(SOURCE, 'utf8');

test('the parse found the dialog — a scan of the wrong file is not a pass', () => {
  expect(source.length, 'the component must be readable').toBeGreaterThan(2000);
  expect(source).toContain('export function CloseBillSheet');
  expect(source).toContain('title={`Record payment · ${bill.code}`}');
});

test('the order pane reads the rounds the payload already carried', () => {
  // `bill.kots[].items[]` was in OwnerBillView the whole time and this component never read it.
  expect(source, 'the rounds must come from the bill').toMatch(/const rounds = bill\.kots;/);
  expect(source).toContain('rounds.map(');
  expect(source).toContain('k.items.map(');
  expect(source).toContain('data-testid="owner-close-order-pane"');
});

test('the dish line is the same line LiveOrders draws', () => {
  // Not a claim about LiveOrders — a claim about THIS file carrying the four parts of that row.
  // A divergence here is two screens disagreeing about one round.
  expect(source, 'the veg/non-veg mark').toContain('<FoodMark type={i.foodType} />');
  expect(source, 'the dish name').toContain('{i.name}');
  expect(source, 'the quantity').toContain('×{i.qty}');
  expect(source, 'the line amount').toContain('{i.lineLabel}');
  expect(source, 'a cancelled line is struck through, not hidden').toContain(
    "i.cancelled && 'text-[var(--text-muted)] line-through'"
  );
});

test('the per-table breakdown MOVED into the pane and was not duplicated', () => {
  const heads = source.match(/What each table ordered/g) ?? [];
  expect(heads, 'exactly one per-table list on the dialog').toHaveLength(1);
  // Still present, and still saying the thing that keeps it from reading as a split.
  expect(source).toContain('It stays one bill and one payment.');
});

test('the money pane keeps everything that was already on it', () => {
  expect(source).toContain('data-testid="owner-close-money-pane"');
  for (const kept of [
    'TotalsBlock rows={bill.totals}',
    '<DiscountFields',
    'Paid by',
    'data-testid="owner-close-reference"',
    'Recorded against',
  ]) {
    expect(source, `${kept} must survive the re-layout`).toContain(kept);
  }
});

test('a bill with no rounds says so rather than showing an empty box', () => {
  expect(source).toContain('data-testid="owner-close-rounds-empty"');
  expect(source).toContain('No rounds on this bill.');
});

test('the layout is one column on a phone and two from md up', () => {
  expect(source, 'the grid must be responsive, not a fixed pair of columns').toContain(
    'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
  );
  // `1fr 1fr` would let a long dish name push the form off the side: a grid track's default
  // min-width is auto, which refuses to shrink below its longest unbroken word.
  expect(source, 'never a bare 1fr pair').not.toMatch(/grid-cols-\[1fr_1fr\]/);
  expect(source, 'never two columns at every width').not.toMatch(/(?<!md:)grid-cols-2/);
});

test('no data-layer import was added — none is needed', () => {
  // The change is a reading of data already in hand. A query or a mutation imported here would
  // mean the pane went and fetched what it had already been given.
  expect(source).not.toMatch(/from '@\/lib\/db\/(queries|mutations)'/);
  expect(source).toMatch(/import type \{ OwnerBillView \}/);

  // `send` IS used, exactly once, and it is the close-bill write that was always here — not a
  // read for the pane. Asserting the count is the honest form: "no send at all" was wrong when
  // this spec was first run, and a spec that has to be loosened to pass is worth writing down.
  const sends = source.match(/send<[^>]*>\(/g) ?? [];
  expect(sends, 'one send, and it is the closure write').toHaveLength(1);
  expect(source).toContain("action: 'close-bill'");
});
