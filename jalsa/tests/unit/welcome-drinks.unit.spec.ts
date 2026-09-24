import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  isFirstOrder,
  readWelcomeDrinks,
  welcomeDrinksAdded,
  welcomeDrinksToOffer,
  withWelcomeDrinks,
} from '../../src/lib/welcome-drinks';

/**
 * Welcome drinks on a table's first order (24-Sep correction list, D1).
 *
 * The owner turns them on and picks which menu items they are. On a table's FIRST order - no
 * bill, or a bill with no round yet - the ordering screen offers one tap that puts them in the
 * round. Never on a later round, never without the tap, and the screen says when they are in.
 */

const MENU = [
  { id: 'lassi', name: 'Sweet Lassi', available: true },
  { id: 'mojito', name: 'Virgin Mojito', available: false },
  { id: 'biryani', name: 'Mutton Biryani', available: true },
];
const ON = { enabled: true, itemIds: ['lassi', 'mojito'] };

test('a table with no bill, or a bill with no round, is a first order; one with a round is not', () => {
  expect(isFirstOrder(null)).toBe(true);
  expect(isFirstOrder({ kots: [] })).toBe(true);
  expect(isFirstOrder({ kots: [{}] })).toBe(false);
});

test('offered on the first order only, and only when switched on', () => {
  expect(welcomeDrinksToOffer(ON, true, MENU).map((m) => m.id)).toEqual(['lassi']);
  expect(welcomeDrinksToOffer(ON, false, MENU)).toEqual([]);
  expect(welcomeDrinksToOffer({ ...ON, enabled: false }, true, MENU)).toEqual([]);
});

test('a sold-out drink, or one no longer on the menu, is not offered', () => {
  expect(welcomeDrinksToOffer({ enabled: true, itemIds: ['mojito', 'gone'] }, true, MENU)).toEqual([]);
});

test('one tap sets each drink to one per guest, without lowering anything already in the round', () => {
  const drinks = [{ id: 'lassi' }];
  expect(withWelcomeDrinks({}, drinks, 4)).toEqual({ lassi: 4 });
  expect(withWelcomeDrinks({ lassi: 6, biryani: 1 }, drinks, 4)).toEqual({ lassi: 6, biryani: 1 });
  expect(withWelcomeDrinks({}, drinks, 0)).toEqual({ lassi: 1 });
});

test('the screen can tell whether they were added', () => {
  const drinks = [{ id: 'lassi' }, { id: 'chaas' }];
  expect(welcomeDrinksAdded({}, drinks)).toBe(false);
  expect(welcomeDrinksAdded({ lassi: 2 }, drinks)).toBe(false);
  expect(welcomeDrinksAdded({ lassi: 2, chaas: 2 }, drinks)).toBe(true);
  expect(welcomeDrinksAdded({}, [])).toBe(false);
});

test('a malformed stored setting reads as off, never as an error', () => {
  expect(readWelcomeDrinks(undefined)).toEqual({ enabled: false, itemIds: [] });
  expect(readWelcomeDrinks({ enabled: 'yes', itemIds: [1, 'lassi'] })).toEqual({
    enabled: false,
    itemIds: ['lassi'],
  });
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('stored as one setting, under the features permission, and offered on both ordering screens', () => {
  expect(code('src/lib/db/owner-mutations.ts')).toContain("welcomeDrinks: 'set.features'");
  expect(code('src/lib/db/staff-view.ts')).toContain('welcomeDrinks: readWelcomeDrinks(settings.welcomeDrinks)');
  const staff = code('src/features/staff/StaffTables.tsx');
  expect(staff).toContain('welcomeDrinksToOffer(data.welcomeDrinks, isFirstOrder(bill), data.menu)');
  expect(staff).toContain('<WelcomeDrinksOffer');
  const owner = code('src/features/owner/sections/Dashboard.tsx');
  expect(owner).toContain('welcomeDrinksToOffer(welcomeDrinks, true, menu)');
  expect(owner).toContain('<WelcomeDrinksOffer');
  const settings = code('src/features/owner/sections/SettingsSection.tsx');
  expect(settings).toContain("key: 'welcomeDrinks'");
  expect(settings).toContain('<WelcomeDrinksPanel {...props} />');
});
