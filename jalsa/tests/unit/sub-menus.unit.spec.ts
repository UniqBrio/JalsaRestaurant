import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SUB_MENU_REFUSALS, parentChoices, subMenuProblem } from '../../src/lib/sub-menus';

/**
 * Sub-menus, and sales by menu with its sub-menus included (24-Sep correction list, I3).
 *
 * A category may sit under ONE top-level category. The rule is the database's (trigger
 * `menu_category_one_level`, migration 20260925090000, applied to the test project and then live
 * on 25-Sep-2026 and exercised there in a rolled-back block); the screen offers only what it
 * accepts. Each order line snapshots the menu it sold under, and the report rolls sub-menus up.
 */

const CATS = [
  { id: 'main', name: 'Main course', parentId: null },
  { id: 'biryani', name: 'Biryani', parentId: 'main' },
  { id: 'starters', name: 'Starters', parentId: null },
  { id: 'drinks', name: 'Drinks', parentId: null },
];

test('a top-level category may go under another top-level one, or back to the top', () => {
  expect(subMenuProblem(CATS, 'drinks', 'starters')).toBeNull();
  expect(subMenuProblem(CATS, 'biryani', null)).toBeNull();
  expect(subMenuProblem(CATS, 'biryani', 'starters')).toBeNull();
});

test('one level only: never under a sub-menu, never itself, never a category that has sub-menus', () => {
  expect(subMenuProblem(CATS, 'drinks', 'biryani')).toBe(SUB_MENU_REFUSALS.deep);
  expect(subMenuProblem(CATS, 'drinks', 'drinks')).toBe(SUB_MENU_REFUSALS.self);
  expect(subMenuProblem(CATS, 'main', 'starters')).toBe(SUB_MENU_REFUSALS.hasChildren);
  expect(subMenuProblem(CATS, 'drinks', 'gone')).toBe(SUB_MENU_REFUSALS.missing);
  expect(subMenuProblem(CATS, 'gone', null)).toBe(SUB_MENU_REFUSALS.missing);
});

test('the screen offers exactly the choices the rule accepts', () => {
  expect(parentChoices(CATS, 'drinks').map((c) => c.id)).toEqual(['main', 'starters']);
  expect(parentChoices(CATS, 'biryani').map((c) => c.id)).toEqual(['main', 'starters', 'drinks']);
  expect(parentChoices(CATS, 'main')).toEqual([]);
  for (const c of CATS) {
    for (const p of parentChoices(CATS, c.id))
      expect(subMenuProblem(CATS, c.id, p.id), `${c.id} under ${p.id}`).toBeNull();
  }
});

const MIGRATION = readFileSync('supabase/migrations/20260925090000_jalsa_menu_sub_categories.sql', 'utf8');

test('the database says the same sentences, and holds the rule itself', () => {
  expect(MIGRATION).toContain(
    'add column if not exists parent_id uuid references public.menu_category(id) on delete restrict'
  );
  expect(MIGRATION).toContain('before insert or update of parent_id on public.menu_category');
  expect(MIGRATION).toContain('add column if not exists menu_parent_category_name text not null default');
  for (const sentence of [SUB_MENU_REFUSALS.self, SUB_MENU_REFUSALS.deep, SUB_MENU_REFUSALS.hasChildren]) {
    expect(MIGRATION).toContain(sentence);
  }
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('every round snapshots the menu its dish sold under; the bill read carries it', () => {
  const m = code('src/lib/db/mutations.ts');
  expect(m).toContain('menu_category!inner(name,parent_id)');
  expect(m).toContain('menu_parent_category_name:');
  const q = code('src/lib/db/queries.ts');
  expect(q).toContain('menu_category_name, menu_parent_category_name )');
  expect(q).toContain("parentCategory: (i.menu_parent_category_name as string) ?? '',");
  expect(q).toContain('parentId: (c.parent_id as string | null) ?? null,');
});

test('the report keys a category by its menu, and rolls sub-menus up in the same walk', () => {
  const r = code('src/app/api/owner/report/route.ts');
  expect(r).toContain('const rowKey = `${parent}\\u0000${catKey}`;');
  expect(r).toContain('const menuKey = parent || catKey;');
  expect(r).toContain('if (parent) menu.subMenus.add(catKey);');
  expect(r).toMatch(/menus: \[\.\.\.menus\.values\(\)\]/);
  expect((r.match(/for \(const i of k\.items\)/g) ?? []).length).toBe(1);
  const ui = code('src/features/owner/sections/ReportsSection.tsx');
  expect(ui).toContain('{report.categories.some((c) => c.parent) ? (');
  expect(ui).toContain('testId="owner-menus-table"');
  expect(ui).toContain("header: 'Sub-menu of',");
  expect(ui).toContain('rowKey={(c) => `${c.parent}\\u0000${c.category}`}');
});

test('only a holder of menu.category sets a parent; a refusal is a sentence, scoped to this menu', () => {
  const o = code('src/lib/db/owner-mutations.ts');
  const fn = o.slice(o.indexOf('export async function setCategoryParent'));
  expect(fn).toContain("demand(input.actor, 'menu.category');");
  expect(fn).toContain('subMenuProblem(all, input.categoryId, input.parentId)');
  expect(fn).toMatch(/\.eq\('id', input\.categoryId\)\s*\.eq\('restaurant_id', restaurantId\)/);
  const route = code('src/app/api/owner/action/route.ts');
  expect(route).toContain(
    "if (err instanceof SubMenuRefused) return fail(400, { code: 'validation', message: err.message });"
  );
  const menu = code('src/features/owner/sections/MenuSection.tsx');
  expect(menu).toContain("const canManageCategories = data.grants.includes('menu.category');");
  expect(menu).toContain('const choices = parentChoices(data.categories, c.id);');
  expect(menu).toContain("action: 'set-category-parent', categoryId: c.id, parentId");
});
