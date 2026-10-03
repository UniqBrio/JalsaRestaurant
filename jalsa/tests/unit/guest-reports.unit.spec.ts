/**
 * Reports → Guest insights: People loved items and How guests found Jalsa (03-Oct-2026).
 *
 * People loved items reads `guest_favourite` (the hearts, kept since 03-Oct); How guests found
 * Jalsa is the existing card over `guest_attribution`, moved to this tab from the foot of Sales -
 * reused, not rebuilt. Counting is in favourites.unit.spec.ts and heard-about specs; here: where
 * each reads from, who may read it, and the empty states.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (p: string): string => readFileSync(p, 'utf8');

test('the Guests tab is a real Reports tab, and shows both cards whether or not a bill closed', () => {
  const src = read('src/features/owner/sections/ReportsSection.tsx');
  expect(src).toContain("{ key: 'guests', label: 'Guest insights' },");
  const guests = src.slice(src.indexOf("{tab === 'guests' ? ("), src.indexOf(') : !report || rangeIsEmpty(report) ? ('));
  expect(guests).toContain('<LovedItemsCard key={`loved-${range.from}/${range.to}`} range={range} />');
  expect(guests).toContain('<HeardAboutCard key={`${range.from}/${range.to}`} range={range} testId="owner-rep-heard" />');
  // Not behind the bills report's own empty or loading state.
  expect(src.indexOf("{tab === 'guests' ? (")).toBeLessThan(src.indexOf('!report || rangeIsEmpty(report) ? ('));
  // And only once: the Sales tab no longer carries it at its foot.
  expect(src.match(/<HeardAboutCard /g)?.length).toBe(1);
});

test('one source each: hearts from guest_favourite, answers from guest_attribution', () => {
  const q = read('src/lib/db/queries.ts');
  const loved = q.slice(q.indexOf('export async function listFavouritesBetween'));
  expect(loved.slice(0, 900)).toContain(".from('guest_favourite')");
  expect(loved.slice(0, 900)).toContain(".eq('restaurant_id', restaurantId)");
  expect(loved.slice(0, 900)).toContain(".gte('created_at', start.toISOString())");
  const heard = q.slice(q.indexOf('export async function listHeardAboutBetween'));
  expect(heard.slice(0, 900)).toContain(".from('guest_attribution')");
  // The card fetches its own endpoint, never the console's poll.
  expect(read('src/features/owner/sections/LovedItemsCard.tsx')).toContain('fetch(`/api/owner/favourites?from=${range.from}&to=${range.to}`)');
  expect(read('src/features/owner/sections/UpliftSection.tsx')).toContain('fetch(`/api/owner/heard?from=${range.from}&to=${range.to}`)');
});

test('who may read them: hearts with rep.products, answers with rep.sales, both signed in', () => {
  const loved = read('src/app/api/owner/favourites/route.ts');
  expect(loved).toContain("const staff = await currentStaff('owner');");
  expect(loved).toContain("if (!staff.grants.can('rep.products')) {");
  expect(loved).toContain('const verdict = checkRange({ from, to }, nowForRangeCheck());');
  const heard = read('src/app/api/owner/heard/route.ts');
  expect(heard).toContain("if (!staff.grants.can('rep.sales')) {");
  expect(read('src/features/owner/sections/ReportsSection.tsx')).toContain("{data.grants.includes('rep.sales') ? (");
});

test('empty, loading and failed states are said, never a blank card', () => {
  const card = read('src/features/owner/sections/LovedItemsCard.tsx');
  expect(card).toContain('data-testid={`${testId}-empty`}');
  expect(card).toContain('No dish was hearted in this range.');
  expect(card).toContain('Reading the hearts…');
  expect(card).toContain('data-testid={`${testId}-problem`}');
  const heard = read('src/features/owner/sections/UpliftSection.tsx');
  expect(heard).toContain('No guest responses to “How did you hear about us?” are on record for this range.');
});

test('the figures are counts of real rows: parties per dish, and the sum of them', () => {
  const route = read('src/app/api/owner/favourites/route.ts');
  expect(route).toContain('return ok({ range: { from, to }, items, hearts: items.reduce((a, i) => a + i.parties, 0) });');
  const card = read('src/features/owner/sections/LovedItemsCard.tsx');
  expect(card).toContain("{r.parties === 1 ? 'table' : 'tables'}");
  expect(card).not.toMatch(/Math\.random|sample|placeholder/i);
});
