import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { afterDishSaved, canAddDish, dishKey, existingDish, newDishProblem } from '../../src/lib/new-dish';

/**
 * Add a dish from the ordering screen (24-Sep correction list, E1).
 *
 * The captain's Add items screen and the owner's New round sheet get a "+" that creates a menu
 * item (name, price, category, food type) when the dish is not listed, through the Menu section's
 * own write and grant, and puts it in the round. No duplicates: a name the menu already has is the
 * existing dish, on the screen and on the server.
 */

const MENU = [{ name: 'Mutton Biryani' }, { name: 'Sweet Lassi' }];
const GOOD = { name: 'Paneer Tikka', price: 280, categoryId: 'starters', foodType: 'veg' as const };

test('only a holder of menu.item_edit AND menu.price_edit is offered the "+"', () => {
  /* SUPERSEDED 25-Sep-2026 (review): previously menu.item_edit alone was enough. A new dish IS a
     price, so a person who may add items but not set prices could create a dish at ₹1 from the
     floor and order it. Both grants are now required, on the screen and on the server. */
  expect(canAddDish(['menu.item_edit', 'menu.price_edit', 'orders.add_items'])).toBe(true);
  expect(canAddDish(['menu.item_edit', 'orders.add_items'])).toBe(false);
  expect(canAddDish(['orders.add_items', 'menu.view', 'menu.availability'])).toBe(false);
});

test('a saved dish goes in the round once; an existing sold-out one does not, and the screen says so', () => {
  expect(afterDishSaved({}, { id: 'n', existed: false, available: true }, 'Paneer Tikka')).toEqual({
    cart: { n: 1 },
    message: 'Paneer Tikka added to the menu and to this round',
    tone: 'success',
  });
  expect(afterDishSaved({ n: 2 }, { id: 'n', existed: true, available: true }, 'Paneer Tikka').cart).toEqual({
    n: 3,
  });
  const soldOut = afterDishSaved({ x: 1 }, { id: 'n', existed: true, available: false }, 'Paneer Tikka');
  expect(soldOut.cart).toEqual({ x: 1 });
  expect(soldOut.message).toContain('sold out');
});

test('a name the menu already has is that dish - case and outer spaces do not make a new one', () => {
  expect(dishKey('  Mutton BIRYANI ')).toBe('mutton biryani');
  expect(existingDish(MENU, ' mutton biryani')).toEqual({ name: 'Mutton Biryani' });
  expect(existingDish(MENU, 'Chicken Biryani')).toBeNull();
  expect(existingDish(MENU, '   ')).toBeNull();
});

test('the dish is refused with a sentence, never a constraint violation', () => {
  expect(newDishProblem(GOOD)).toBeNull();
  expect(newDishProblem({ ...GOOD, name: '  ' })).toBe('Give the dish a name.');
  expect(newDishProblem({ ...GOOD, name: 'x'.repeat(121) })).toContain('120');
  expect(newDishProblem({ ...GOOD, price: 0 })).toContain('above ₹0');
  expect(newDishProblem({ ...GOOD, price: Number.NaN })).toContain('above ₹0');
  expect(newDishProblem({ ...GOOD, categoryId: '' })).toBe('Choose a category.');
  expect(newDishProblem({ ...GOOD, foodType: 'vegan' as never })).toBe('Choose veg, non-veg or egg.');
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function bodyOf(path: string, signature: string): string {
  const src = code(path);
  const start = src.indexOf(signature);
  expect(start, `${signature} exists in ${path}`).toBeGreaterThan(-1);
  const rest = src.slice(start);
  return rest.slice(0, rest.indexOf('\n}\n'));
}

test('the server writes through upsertMenuItem, and a duplicate returns the existing dish', () => {
  const fn = bodyOf('src/lib/db/owner-mutations.ts', 'export async function addDishWhileOrdering');
  expect(fn).toContain('await upsertMenuItem({');
  expect(fn).not.toMatch(/from\('menu_item'\)\s*\.insert/);
  expect(fn).toContain("?.code !== '23505') throw err;");
  expect(fn).toContain('existingDish(');
  /* SUPERSEDED 25-Sep-2026 (review): previously `return { id: found.id, existed: true }` - an
     existing sold-out dish was put in the round and refused at Send. Its availability comes back. */
  expect(fn).toContain('return { id: found.id, existed: true, available: found.available === true };');
  expect(fn).toContain('for (const grant of NEW_DISH_GRANTS) demand(input.actor, grant);');
  // The grant the Menu section demands for an insert.
  const upsert = bodyOf('src/lib/db/owner-mutations.ts', 'export async function upsertMenuItem');
  expect(upsert).toContain("'menu.item_edit'");
});

test('both routes validate first, then use the one write', () => {
  for (const route of ['src/app/api/staff/action/route.ts', 'src/app/api/owner/action/route.ts']) {
    const src = code(route);
    const at = src.indexOf("case 'add-dish': {");
    expect(at, route).toBeGreaterThan(-1);
    const verb = src.slice(at, at + 600);
    expect(verb).toContain('const problem = newDishProblem(input);');
    expect(verb).toContain("if (problem) return fail(400, { code: 'validation', message: problem });");
    expect(verb).toContain('await addDishWhileOrdering({');
  }
});

test('both ordering screens offer it only to a holder, and put the new dish in the round', () => {
  const staff = code('src/features/staff/StaffTables.tsx');
  expect(staff).toContain('{canAddDish(data.grants) ? (');
  /* SUPERSEDED 25-Sep-2026 (review): previously the screen added the dish to the cart inline;
     both screens now share `afterDishSaved`, which leaves a sold-out existing dish out. */
  expect(staff).toContain("send<NewDishSaved>('/api/staff/action', { action: 'add-dish', ...dish })");
  expect(staff).toContain('const next = afterDishSaved(cart, saved, dish.name);');
  expect(staff).toContain('categories={data.menuCategories}');
  expect(code('src/lib/db/staff-view.ts')).toContain(
    'menuCategories: categories.map((c) => ({ id: c.id, name: c.name })),'
  );

  const owner = code('src/features/owner/sections/Dashboard.tsx');
  expect(owner).toContain('{canAddDish(grants) ? (');
  expect(owner).toContain("send<NewDishSaved>('/api/owner/action', { action: 'add-dish', ...dish })");
  expect(owner).toContain('const next = afterDishSaved(cart, saved, dish.name);');
  expect(owner).toContain('grants={data.grants}');

  // The list refreshes through the live-data hook's own send: a write that echoes no state is
  // followed by a read before the promise resolves, so the new row is on screen - no reload.
  expect(code('src/hooks/useLiveData.ts')).toMatch(/await refreshNow\(\);\s*return parsed;/);
});

test('the form offers the searched name, and nothing is added before the server answers', () => {
  const ui = code('src/components/ui/new-dish.tsx');
  /* SUPERSEDED 25-Sep-2026 (review): previously offered any name not listed EXACTLY, so "chick"
     beside Chicken Biryani offered a dish called "chick". Now only when the search found nothing. */
  expect(ui).toContain('!menu.some((m) => dishKey(m.name).includes(dishKey(typed)))');
  expect(ui).toContain('data-testid={`${testIdPrefix}-new-dish-problem`}');
  expect(ui).toContain("setName(unlisted ? typed : '');");
  expect(ui).toMatch(/const saved = await onCreate\(dish\);\s*setOpen\(false\);\s*onAdded\(saved, dish\);/);
});
