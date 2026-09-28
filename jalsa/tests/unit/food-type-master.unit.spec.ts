/**
 * Food Type (the restaurant's own list) and KOT Classification (how the kitchen treats it),
 * through the application: routing, the printed KOT, the owner's verbs, rounds, reports and the
 * guest's search (28-Sep-2026). The database half is `food-type-master.db.unit.spec.ts`.
 *
 * The owner's words: "Food Type must NOT be limited to Veg / Non-Veg / Egg... When creating a new
 * Food Type, the user must select its KOT classification: Veg, Non-Veg, Egg, Other... Existing
 * Veg / Non-Veg / Egg functionality must continue working without regression."
 *
 * FAIL-FIRST EVIDENCE (28-Sep-2026): against origin/main the file failed to collect - `status.ts`
 * had no `KOT_CLASSES`. With the finished change, `completeGroupOrder` was then made to return the
 * saved order as-is (the defect that drops a Dessert line off a three-band template): 2 failed,
 * 6 passed. Reverted: 8 passed.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { splitRound, type RoutablePrinter } from '../../src/lib/print-routing';
import { completeGroupOrder, defaultTemplate, type TemplateConfig } from '../../src/lib/print-template';
import { FOOD_TYPE, KOT_CLASSES, KOT_CLASS_LABEL, isKotClass } from '../../src/lib/status';
import { composeTicket, type ComposeItem } from '../../src/lib/ticket-compose';

const src = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');

const MAIN: RoutablePrinter = {
  id: 'main',
  machineId: 'KOT-MAIN',
  name: 'KOT-MAIN',
  purpose: 'KOT',
  station: 'Main Kitchen',
  routes: [],
  online: true,
  enabled: true,
};

const I = (name: string, foodType: ComposeItem['foodType']): ComposeItem => ({
  name,
  qty: 1,
  foodType,
  rate: 0,
  category: 'Mains',
  instruction: '',
});

/* ── The classification list ───────────────────────────────────────────── */

test('the KOT classifications are Veg, Non-veg, Egg and Other - and only those', () => {
  expect([...KOT_CLASSES]).toEqual(['veg', 'non_veg', 'egg', 'other']);
  expect(KOT_CLASS_LABEL.other).toMatch(/Other/);
  expect(FOOD_TYPE.other.label).toBe('Other');
  expect(isKotClass('other')).toBe(true);
  expect(isKotClass('fish')).toBe(false); // a Food Type name is never a classification
  expect(isKotClass('')).toBe(false);
});

/* ── Routing: which ticket a line prints on ────────────────────────────── */

test('an Other-classified dish (Dessert) prints on the veg side; a Non-veg-classified one (Fish) on non-veg', () => {
  const tickets = splitRound({
    items: [I('Gulab Jamun', 'other'), I('Fish Fry', 'non_veg'), I('Dal', 'veg')],
    printers: [MAIN],
    splitByFoodType: true,
  });
  expect(tickets.map((t) => t.side).sort()).toEqual(['non_veg', 'veg_side']);
  expect(tickets.find((t) => t.side === 'veg_side')?.foodTypes.sort()).toEqual(['other', 'veg']);
  expect(tickets.find((t) => t.side === 'non_veg')?.foodTypes).toEqual(['non_veg']);
});

/* ── The printed KOT: no line may vanish ───────────────────────────────── */

test('a template saved before Other existed still prints every classification, Other last', () => {
  expect(completeGroupOrder(['non_veg', 'veg', 'egg'])).toEqual(['non_veg', 'veg', 'egg', 'other']);
  expect(completeGroupOrder(undefined)).toEqual(['veg', 'non_veg', 'egg', 'other']);
  expect(completeGroupOrder(['egg', 'egg'])).toEqual(['egg', 'veg', 'non_veg', 'other']);
});

test('a Dessert line prints under OTHER on the veg-side ticket, with an old three-band template', () => {
  const items = [I('Dal', 'veg'), I('Gulab Jamun', 'other')];
  const old: Partial<TemplateConfig> = { ...defaultTemplate('kot'), groupOrder: ['veg', 'non_veg', 'egg'] };
  const printed = composeTicket({
    job: { id: 'j', kind: 'kot', printerId: 'main', station: 'Main Kitchen', foodSide: 'veg_side', isReprint: false },
    width: '80',
    template: old,
    printers: [MAIN],
    splitByFoodType: true,
    header: {
      restaurant: 'JALSA',
      branch: '',
      phone: '',
      gstin: '',
      kotCode: 'KOT-1',
      roundCode: 'R-1',
      billCode: 'B-1',
      table: 'A5',
      customer: '',
      captain: 'Ravi',
      date: '28 Sep 2026',
      time: '1:00 pm',
      source: 'Captain',
      note: '',
    },
    items,
  });
  if (!printed.ok) throw new Error(printed.blocked);
  const texts = printed.lines.map((l) => l.text);
  const other = texts.findIndex((t) => t.includes('OTHER'));
  const dessert = texts.findIndex((t) => t.startsWith('Gulab Jamun'));
  expect(other).toBeGreaterThan(-1);
  expect(dessert).toBeGreaterThan(other);
  expect(texts.some((t) => t.startsWith('Dal'))).toBe(true);
});

/* ── Where the name travels ────────────────────────────────────────────── */

test('the owner can add and re-classify Food Types, and a dish is saved by its Food Type, not a fixed value', () => {
  const route = src('src/app/api/owner/action/route.ts');
  expect(route).toContain("case 'add-food-type'");
  expect(route).toContain("case 'update-food-type'");
  const mut = src('src/lib/db/owner-mutations.ts');
  expect(mut).toContain('export async function addFoodType');
  expect(mut).toContain('export async function updateFoodType');
  expect(mut).toContain('food_type_id: input.foodTypeId');
});

test('a round snapshots the Food Type name, and the report sells by it', () => {
  const round = src('src/lib/db/mutations.ts');
  expect(round).toContain('food_type_ref:food_type_id(name)');
  expect(round).toContain('food_type_name:');
  const report = src('src/app/api/owner/report/route.ts');
  expect(report).toContain('foodTypes:');
  expect(src('src/features/owner/sections/ReportsSection.tsx')).toContain('owner-food-types-table');
});

test('a guest searching "fish" finds the Fish dishes, and sees the type by its name', () => {
  const guest = src('src/features/guest/GuestOrdering.tsx');
  expect(guest).toMatch(/\$\{m\.foodTypeName\}`\.toLowerCase\(\)\.includes\(q\)/);
  expect(guest).toContain('name={item.foodTypeName}');
});

test('no future Food Type is written into the application', () => {
  for (const f of [
    'src/lib/status.ts',
    'src/components/ui/food-type-picker.tsx',
    'src/features/owner/sections/MenuSection.tsx',
    'src/lib/db/owner-mutations.ts',
  ]) {
    // Code only: a comment may use a type as an example, a string literal may not.
    const code = src(f)
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
    expect(code, f).not.toMatch(/['"](Fish|Dessert|Juice|Seafood|Beverages)['"]/);
  }
});
