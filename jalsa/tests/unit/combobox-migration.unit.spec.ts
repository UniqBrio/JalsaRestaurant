/**
 * What the combobox standardisation promised, checked against the files that ship it.
 *
 * WHY A SOURCE PARSE
 *   Every promise here is structural: which fields use the one component, which deliberately do
 *   not, which allow creation, and — the one that matters most — that no migrated field started
 *   storing a display name where it used to store an id. None of that can be reached by a tier
 *   that cannot mount React, and all of it is exactly readable from the source.
 *
 * THE GUEST BOUNDARY IS CLOSED (19-Sep-2026)
 *   The sixth migrated field — Guest > "How did you hear about us?" — was held back when the
 *   combobox landed, because `listHeardSources` selects `guest_session.heard_about` and the
 *   migration adding that column was not applied. The ratchet that asserted its absence has
 *   done its job and is gone; the four cases it named are restored below.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026, against the pre-change tree): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * A file with its commentary removed.
 *
 * WHY, AND IT IS NOT A LOOPHOLE
 *   This spec asks "does this field allow creation?", and the honest answer lives in the JSX.
 *   The comment above each search-only field explains that it deliberately does NOT — and says
 *   the word `allowCreate` while doing so. Matching raw text made those two files fail for
 *   carrying the explanation, which would make deleting the explanation the cheapest way to go
 *   green. That is the wrong thing to make cheap. So the question is asked of the CODE.
 *
 *   It removes block comments (a JSX comment is one) and whole-line `//` comments, and nothing
 *   else: a prop that moved into a variable or a condition is still in this text.
 */
function codeOnly(source: string, name: string): string {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  // A strip that consumed the file would satisfy every `not.toContain` by having nothing left.
  expect(stripped.length, `${name}: stripping comments must leave the code`).toBeGreaterThan(source.length / 3);
  return stripped;
}
const menu = read('src/features/owner/sections/MenuSection.tsx');
const ledgers = read('src/features/owner/sections/LedgersSection.tsx');
const print = read('src/features/owner/sections/PrintSetupSection.tsx');
const live = read('src/features/owner/sections/LiveOrders.tsx');
const welcome = read('src/features/guest/GuestOrdering.tsx');
const combobox = read('src/components/ui/combobox.tsx');
const ownerMutations = read('src/lib/db/owner-mutations.ts');

const SRC = 'src';
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );
}
const tsx = walk(SRC).filter((f) => f.endsWith('.tsx'));

test('the parse found the files — a scan of the wrong tree is not a pass', () => {
  expect(tsx.length, 'the component tree must be readable').toBeGreaterThan(20);
  expect(combobox).toContain('export function Combobox');
});

test('there is exactly ONE combobox implementation', () => {
  // The whole point. Three answers to one question was the defect.
  const implementations = tsx.filter((f) => read(f).includes('role="combobox"'));
  expect(implementations).toEqual(['src/components/ui/combobox.tsx']);
});

test('the three old implementations are gone', () => {
  const allSource = tsx.map((f) => codeOnly(read(f), f)).join('\n');
  // A datalist element anywhere in the tree (the word survives in prose; the tag must not).
  expect(allSource, 'no datalist element').not.toMatch(/<datalist[\s>]/);
  expect(codeOnly(live, 'live orders'), 'the hand-rolled staff query state is gone').not.toContain('staffQuery');
  expect(menu, 'the menu category is no longer a native select').not.toMatch(
    /<Select[\s\S]{0,200}data-testid="owner-item-category"/
  );
});

test('the five migrated fields use the shared component', () => {
  for (const [name, src, testId] of [
    ['menu category', menu, 'owner-item-category'],
    ['expense category', ledgers, 'owner-expense-category'],
    ['printer route', print, 'owner-print-route-'],
    ['staff reassign', live, 'owner-reassign-search'],
    ['guest heard-about', welcome, 'guest-heard'],
  ] as const) {
    expect(src, `${name} imports the shared component`).toContain(
      "import { Combobox } from '@/components/ui/combobox'"
    );
    expect(src, `${name} renders it`).toContain('<Combobox');
    expect(src, `${name} keeps its testid`).toContain(testId);
  }
});

test('creation is allowed on the three data-entry fields and nowhere else', () => {
  for (const [name, src] of [
    ['menu category', menu],
    ['expense category', ledgers],
    ['guest heard-about', welcome],
  ] as const) {
    expect(src, `${name} allows create`).toContain('allowCreate');
  }
  // Search-only. A printer is a machine on a network; a staff member has a role, a PIN and a
  // permission set. Neither is conjured from a picker.
  expect(codeOnly(print, 'print setup'), 'no create on the printer route').not.toContain('allowCreate');
  expect(codeOnly(live, 'live orders'), 'no create on the staff picker').not.toContain('allowCreate');
});

test('the filter system was not touched and never offers creation', () => {
  const filter = codeOnly(read('src/components/ui/column-filter.tsx'), 'column filter');
  expect(filter, 'the filter control is still its own thing').not.toContain('Combobox');
  expect(filter, 'a filter never creates a value').not.toContain('allowCreate');
});

test('THE DATA CONTRACTS DID NOT CHANGE — ids stayed ids', () => {
  // The single most expensive way this work could have gone wrong: a picker that displays names
  // starting to STORE names.
  expect(menu, 'the menu item still stores category_id').toContain('editing.categoryId');
  expect(menu, 'the option value is the category id').toContain('value: c.id');
  expect(live, 'reassignment still posts a staffId').toContain('staffId,');
  expect(live, 'the option value is the staff id').toContain('value: p.id');
  expect(print, 'routing still posts a printer id').toContain('value: p.id');
  // The expense category was ALWAYS a string on the expense row — no table, no foreign key —
  // so a string value here is the unchanged contract, not a regression.
  expect(ledgers).toContain('value={editing.category}');
});

test('the 11 static selects were left alone', () => {
  const remaining = tsx
    .filter((f) => !f.endsWith('components/ui/field.tsx'))
    .flatMap((f) => (read(f).match(/<Select\b/g) ?? []).map(() => f));
  /* SUPERSEDED 25-Sep-2026: previously exactly 11. The twelfth is the food-type choice on the
     "new dish" form (E1, components/ui/new-dish.tsx): the same three-value enum as the Menu
     item's own food-type select, which the audit kept static - not an id picker. The sub-menu
     parent picker added the same day is an id picker and uses the combobox. */
  expect(remaining.length, 'the eleven the audit kept, plus the new-dish food type').toBe(12);
  expect(remaining.filter((f) => f.endsWith('components/ui/new-dish.tsx'))).toHaveLength(1);
});

test('creating a category reuses an existing one rather than making a second', () => {
  // The database decides it: menu_category_name_unique is on (restaurant_id, lower(btrim(name))).
  const schema = readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .map((f) => read(join('supabase/migrations', f)))
    .join('\n');
  expect(schema).toContain('menu_category_name_unique');
  expect(schema).toContain('lower(btrim(name))');

  // And the mutation honours it instead of surfacing a constraint violation.
  expect(ownerMutations, 'a duplicate is re-read, not thrown').toContain("error.code !== '23505'");
  expect(ownerMutations, 'the id comes back so the form can select it').toContain(
    'export async function addCategory(input: { name: string; actor: Actor }): Promise<string>'
  );
  expect(ownerMutations, 'creation is still behind its grant').toContain("demand(input.actor, 'menu.category')");
});

test('nothing pretends a failed create succeeded', () => {
  // `onValueChange` runs only after `onCreate` RESOLVES, and a rejection is shown rather than
  // swallowed. A category the database refused must never end up selected on an item.
  expect(combobox).toContain('const created = await onCreate(name);');
  expect(combobox).toContain('onValueChange(created);');
  expect(combobox, 'the failure is surfaced').toContain('setProblem(');
  expect(combobox, 'and it is announced').toContain("role=\"alert\"");
  expect(combobox, 'no swallowed catch').not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
});

test('the guest answer is persisted server-side, not left in the browser', () => {
  expect(welcome, 'it posts').toContain("send('/api/guest/heard'");
  expect(welcome, 'a failed write rolls the box back').toContain('setHeard(previous)');
  const route = read('src/app/api/guest/heard/route.ts');
  // The session comes from the cookie. A guest is never asked which visit to write to, so they
  // cannot name somebody else's.
  expect(route).toContain('const session = await currentGuestSession();');
  expect(route, 'no session id from the body').not.toMatch(/input\.sessionId/);
});

test('the combobox carries real combobox semantics', () => {
  for (const aria of [
    'role="combobox"',
    'aria-expanded={open}',
    'aria-controls={listId}',
    'aria-autocomplete="list"',
    'aria-activedescendant',
    'role="listbox"',
    'role="option"',
    'aria-selected',
  ]) {
    expect(combobox, `${aria} must be present`).toContain(aria);
  }
  for (const key of ["'ArrowDown'", "'ArrowUp'", "'Enter'", "'Escape'"]) {
    expect(combobox, `${key} must be handled`).toContain(key);
  }
});

/* ── the three defects the pre-commit review found ───────────────────────── */

test('the sources list is read ONLY on the screen that asks', () => {
  // `/api/guest/state` is polled. Issued unconditionally, `listHeardSources` was an unbounded
  // scan of every answer the restaurant has ever recorded, rebuilt every few seconds for every
  // phone, to feed a field that renders on one screen.
  const view = read('src/lib/db/guest-view.ts');
  expect(view, 'gated on the welcome phase').toContain(
    "ctx.phase === 'welcome' ? listHeardSources() : Promise.resolve([])"
  );
  expect(codeOnly(view, 'guest-view'), 'and never called unconditionally').not.toMatch(
    /^\s*listHeardSources\(\),\s*$/m
  );
});

test('focus returns to the input when the list closes', () => {
  // Radix restores focus to a popover's TRIGGER, and this component deliberately has none — the
  // input is the control. With nothing to restore to, picking an option with a pointer dropped
  // focus to document.body and the next Tab started from the top of the page.
  expect(combobox).toContain('inputRef.current?.focus();');
  const closeBody = combobox.slice(combobox.indexOf('const close = React.useCallback'));
  expect(closeBody.slice(0, closeBody.indexOf('}, []);')), 'restored inside close()').toContain(
    'inputRef.current?.focus()'
  );
});

test('the list does NOT open merely because the input has focus', () => {
  // It would fight the line above — close() returns focus, which would reopen the list the
  // instant an option was chosen — and on a phone the software keyboard can cover a list that
  // opens at the same moment as it.
  expect(codeOnly(combobox, 'combobox'), 'no focus-to-open').not.toContain('onFocus=');
  expect(combobox, 'a click opens it').toContain('onClick={() => !disabled && setOpen(true)}');
  expect(combobox, 'typing opens it').toContain('if (!open) setOpen(true);');
  expect(combobox, 'and ArrowDown opens it').toContain('if (!open) return setOpen(true);');
});

test('the listbox OWNS its options', () => {
  // listbox > listitem > option is not a listbox of options: the li breaks the ownership chain
  // and the options stop being announced as one of N.
  const listStart = combobox.indexOf('role="listbox"');
  expect(listStart, 'the listbox must exist').toBeGreaterThan(-1);
  const list = combobox.slice(listStart);
  const items = list.match(/<li\b[^>]*>/g) ?? [];
  expect(items.length, 'every li in the list is accounted for').toBeGreaterThan(2);
  for (const li of items) {
    expect(li, `${li} must be presentational`).toContain('role="presentation"');
  }
});

test('the list portals, so a dialog cannot clip it', () => {
  // Every one of these fields lives inside a sheet whose body is overflow-y-auto. A list
  // positioned in that flow is clipped by it — the most common way a combobox ships broken.
  expect(combobox).toContain('PopoverPrimitive.Portal');
  expect(combobox, 'and it matches the trigger width').toContain('var(--radix-popover-trigger-width)');
});
