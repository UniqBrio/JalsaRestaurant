/**
 * Catch Your Craving — the rules, and the promises the component makes about how it is built.
 *
 * WHY SO MUCH OF THIS IS A SOURCE PIN
 *   Half of what the requester asked for is a NEGATIVE: no dependency, no network during play,
 *   no server persistence, no analytics, no leaked timer. None of those can be proved by calling
 *   a function — the evidence is the absence of something in the shipped source, so that is what
 *   is asserted, file by file and by name.
 *
 * THE OTHER HALF IS ORDINARY LOGIC. Which route an order takes, which round the moment belongs
 * to, what falls and what is suggested are all pure functions in `src/lib/craving.ts`, and they
 * are called here rather than described.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  activeCravingRound,
  cravingPool,
  cravingRoute,
  cravingSuggestions,
  CRAVING_MAX_PLAYS,
  CRAVING_SECONDS,
  clampPlate,
  isCaught,
  isWaiting,
  PLATE_REACH_PCT,
  ROUTE_TYPES,
  shouldOfferCraving,
} from '../../src/lib/craving';
import type { FoodType, KotStatus } from '../../src/lib/status';

const GAME = 'src/features/guest/CravingGame.tsx';
const LOGIC = 'src/lib/craving.ts';
const PROGRESS = 'src/features/guest/GuestProgress.tsx';

const read = (p: string): string => readFileSync(p, 'utf8');

/**
 * The file with its comments removed.
 *
 * Needed because several assertions below are NEGATIVE — "this file must not contain
 * `requestAnimationFrame`" — and the first version of this spec failed on the header comment
 * that PROMISES there is no requestAnimationFrame. A negative assertion over prose tests the
 * prose. The guard on the strip is what stops a bad regex silently leaving an empty string,
 * which would make every negative assertion pass for the wrong reason.
 */
function codeOnly(path: string): string {
  const raw = read(path);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  expect(stripped.length, `stripping ${path} must leave the code behind`).toBeGreaterThan(raw.length / 3);
  return stripped;
}

/** A menu row, shaped as the guest payload really delivers it. */
const item = (
  id: string,
  name: string,
  foodType: FoodType,
  category: string,
  available = true
) => ({ id, name, foodType, category, available, priceLabel: '₹30' });

const MENU = [
  item('v1', 'Paneer Butter Masala', 'veg', 'Indian Curry'),
  item('v2', 'Veg Biryani', 'veg', 'Biryani'),
  item('n1', 'Chicken 65', 'non_veg', 'Non-Veg Starters'),
  item('n2', 'Mutton Biryani', 'non_veg', 'Biryani'),
  item('e1', 'Egg Curry', 'egg', 'Indian Curry'),
  item('d1', 'Gulab Jamun', 'veg', 'Desserts'),
  item('d2', 'Badam Milk', 'veg', 'Drinks'),
  item('x1', 'Sold Out Special', 'veg', 'Desserts', false),
];

const round = (code: string, status: KotStatus, types: FoodType[] = ['veg']) => ({
  code,
  status,
  items: types.map((t, i) => ({ id: `${code}-${i}`, foodType: t })),
});

/* ── 3-6. The four routes ──────────────────────────────────────────────────────────────────── */

test('3. a veg-only order takes the veg route', () => {
  expect(cravingRoute(['veg', 'veg'])).toBe('veg');
});

test('4. a non-veg order takes the non-veg route', () => {
  expect(cravingRoute(['non_veg'])).toBe('nonVeg');
  expect(cravingRoute(['non_veg', 'non_veg'])).toBe('nonVeg');
});

test('5. an egg order takes the egg route', () => {
  expect(cravingRoute(['egg'])).toBe('egg');
});

test('6. any combination takes the mixed route', () => {
  expect(cravingRoute(['veg', 'non_veg'])).toBe('mixed');
  expect(cravingRoute(['veg', 'egg'])).toBe('mixed');
  expect(cravingRoute(['non_veg', 'egg'])).toBe('mixed');
  expect(cravingRoute(['veg', 'non_veg', 'egg'])).toBe('mixed');
});

test('an order with nothing in it routes nowhere, rather than defaulting', () => {
  // A default here would be a route chosen for a guest whose order could not be read.
  expect(cravingRoute([])).toBeNull();
});

test('3b. the veg route can never show chicken or egg — the requester was explicit', () => {
  const pool = cravingPool('veg', MENU);
  expect(pool.length).toBeGreaterThan(0);
  expect(pool.every((p) => p.foodType === 'veg')).toBe(true);
  expect(pool.map((p) => p.name)).not.toContain('Chicken 65');
  expect(pool.map((p) => p.name)).not.toContain('Egg Curry');
});

test('the mixed route may show all three, which is the point of it', () => {
  expect([...ROUTE_TYPES.mixed].sort()).toEqual(['egg', 'non_veg', 'veg']);
});

test('nothing unavailable ever falls', () => {
  // Building a craving the kitchen cannot satisfy is worse than building none.
  expect(cravingPool('veg', MENU).map((p) => p.name)).not.toContain('Sold Out Special');
});

/* ── 1+2+7+8. When it is offered, and when it is gone ──────────────────────────────────────── */

test('1. nothing is offered before a round exists', () => {
  expect(activeCravingRound([])).toBeNull();
  expect(
    shouldOfferCraving({ enabled: true, hasWaitingRound: false, plays: 0, phase: 'offer' })
  ).toBe(false);
});

test('2. it is offered while a round is being waited for', () => {
  expect(isWaiting('new')).toBe(true);
  expect(isWaiting('preparing')).toBe(true);
  expect(activeCravingRound([round('K1', 'preparing')])?.code).toBe('K1');
  expect(
    shouldOfferCraving({ enabled: true, hasWaitingRound: true, plays: 0, phase: 'offer' })
  ).toBe(true);
});

test('7. a Ready round is not waiting, so the experience is gone', () => {
  expect(isWaiting('ready')).toBe(false);
  expect(activeCravingRound([round('K1', 'ready')])).toBeNull();
});

test('8. nor is a Served one — and nor is picked up or cancelled', () => {
  expect(isWaiting('served')).toBe(false);
  expect(isWaiting('picked_up')).toBe(false);
  expect(isWaiting('cancelled')).toBe(false);
  expect(activeCravingRound([round('K1', 'served')])).toBeNull();
  expect(activeCravingRound([round('K1', 'served'), round('K2', 'ready')])).toBeNull();
});

test('9. a guest who waves it away is not asked again', () => {
  expect(
    shouldOfferCraving({ enabled: true, hasWaitingRound: true, plays: 0, phase: 'dismissed' })
  ).toBe(false);
});

test('the owner can switch it off, and then it is off', () => {
  expect(
    shouldOfferCraving({ enabled: false, hasWaitingRound: true, plays: 0, phase: 'offer' })
  ).toBe(false);
});

/* ── 17. Multiple rounds ───────────────────────────────────────────────────────────────────── */

test('17. three rounds produce ONE experience, on the one furthest along', () => {
  // The requester's own example: 101 served, 102 preparing, 103 just placed.
  const rounds = [round('K101', 'served'), round('K102', 'preparing'), round('K103', 'new')];
  const active = activeCravingRound(rounds);
  expect(active?.code, 'preparing beats newly placed').toBe('K102');
  // And it is ONE round, not a list — there is no way for a caller to start three games.
  expect(Array.isArray(active)).toBe(false);
});

test('17b. with only new rounds, the most recent one is chosen', () => {
  expect(activeCravingRound([round('K1', 'new'), round('K2', 'new')])?.code).toBe('K2');
});

test('17c. the component renders at most one game, guarded by the single active round', () => {
  const src = read(PROGRESS);
  expect(src).toContain('const cravingRound = activeCravingRound(data.rounds);');
  expect(src).toContain('{cravingRound && cravingRoute && shouldOfferCraving({');
  // Not inside the rounds loop — that is what would produce one per round.
  const loop = src.indexOf('{data.rounds.map((r) => (');
  const game = src.indexOf('<CravingGame');
  const loopEnd = src.indexOf('</ul>', loop);
  expect(game, 'the game sits AFTER the rounds list, not inside it').toBeGreaterThan(loopEnd);
});

/* ── 18. The suggestion ────────────────────────────────────────────────────────────────────── */

test('18. suggestions are real, available menu items — never invented', () => {
  const picks = cravingSuggestions('veg', MENU, []);
  expect(picks.length).toBeGreaterThan(0);
  for (const p of picks) {
    expect(MENU.some((m) => m.id === p.id && m.available), `${p.name} must be a real available row`).toBe(true);
  }
});

test('18b. a dessert or a drink is preferred, because it finishes a meal', () => {
  const picks = cravingSuggestions('veg', MENU, []);
  expect(picks.map((p) => p.name)).toEqual(['Gulab Jamun', 'Badam Milk']);
});

test('18c. at most two, because this is a suggestion and not a shop', () => {
  expect(cravingSuggestions('mixed', MENU, []).length).toBeLessThanOrEqual(2);
});

test('18d. it never suggests what they are already waiting for', () => {
  const picks = cravingSuggestions('veg', MENU, ['d1']);
  expect(picks.map((p) => p.id)).not.toContain('d1');
});

test('18e. a vegetarian table is not offered chicken, even as a finisher', () => {
  const picks = cravingSuggestions('veg', MENU, []);
  expect(picks.every((p) => p.foodType === 'veg')).toBe(true);
});

test('18f. an unavailable item is never suggested', () => {
  expect(cravingSuggestions('veg', MENU, ['d1', 'd2']).map((p) => p.name)).not.toContain('Sold Out Special');
});

test('18g. a restaurant naming no category like a finisher still gets a suggestion', () => {
  // The hints are hints. Hardcoded category names would silently suggest nothing the day an
  // owner renamed "Desserts".
  const plain = [item('a', 'Something', 'veg', 'Mains'), item('b', 'Else', 'veg', 'Mains')];
  expect(cravingSuggestions('veg', plain, []).length).toBe(2);
});

/* ── 10. The lifecycle ─────────────────────────────────────────────────────────────────────── */

test('10. it lasts the 20–30 seconds the requester asked for, and stops itself', () => {
  expect(CRAVING_SECONDS).toBeGreaterThanOrEqual(20);
  expect(CRAVING_SECONDS).toBeLessThanOrEqual(30);
  const src = read(GAME);
  // The end is a timer set from the same constant, so "it ends" and "it ends when we said"
  // cannot drift apart.
  expect(src).toContain("setTimeout(() => setPhase('done'), CRAVING_SECONDS * 1000)");
});

test('10b. it never restarts itself, and replay is capped', () => {
  expect(CRAVING_MAX_PLAYS).toBeLessThanOrEqual(3);
  const src = read(GAME);
  expect(src).toContain('{plays < CRAVING_MAX_PLAYS ? (');
  // `begin` is only ever reached from a real tap.
  expect(src).toContain('<Button data-testid="craving-start" onClick={begin}>');
  expect(src, 'nothing starts a game on its own').not.toContain('useEffect(() => begin');
});

test('every timer this game creates is cleared', () => {
  const src = read(GAME);
  const timers = (src.match(/setTimeout\(|setInterval\(/g) ?? []).length;
  const clears = (src.match(/clearTimeout\(|clearInterval\(/g) ?? []).length;
  expect(timers, 'the count is what it is; the point is the pairing').toBeGreaterThan(0);
  expect(clears, 'every timer has a matching clear in the effect cleanup').toBeGreaterThanOrEqual(timers);
});

/* ── 11+12. No network, no persistence, no dependency ──────────────────────────────────────── */

test('11. gameplay makes no network request of any kind', () => {
  const src = codeOnly(GAME);
  for (const forbidden of ['fetch(', 'send(', 'XMLHttpRequest', 'navigator.sendBeacon', 'EventSource', 'WebSocket']) {
    expect(src, `the game must never ${forbidden}`).not.toContain(forbidden);
  }
});

test('12. nothing about the game is stored anywhere but this browser', () => {
  const src = codeOnly(GAME);
  for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'supabase']) {
    expect(src, `no ${forbidden}`).not.toContain(forbidden);
  }
  // And no server route learned about it.
  expect(read(LOGIC)).not.toContain('server-only');
});

test('no game engine, no animation library, no new dependency', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {});
  for (const banned of ['phaser', 'pixi.js', 'three', 'framer-motion', 'gsap', 'matter-js', 'react-spring']) {
    expect(deps, `${banned} must not be a dependency`).not.toContain(banned);
  }
  const src = read(GAME);
  expect(src, 'and nothing is rendered with a canvas or WebGL').not.toContain('getContext(');
  expect(src).not.toContain('<canvas');
});

test('the motion is CSS, not a JavaScript loop', () => {
  const src = codeOnly(GAME);
  expect(src, 'no per-frame loop').not.toContain('requestAnimationFrame');
  // The hit test runs once per item, when it is level with the plate.
  expect(src).toContain('onAnimationEnd={() => landed(drop)}');
  expect(read('src/app/globals.css')).toContain('@keyframes j-craving-fall');
});

test('no analytics and no tracking were added', () => {
  const src = codeOnly(GAME);
  for (const banned of ['gtag', 'analytics', 'dataLayer', 'posthog', 'mixpanel', 'Sentry']) {
    expect(src).not.toContain(banned);
  }
});

/* ── 15. Reduced motion ────────────────────────────────────────────────────────────────────── */

test('15. reduced motion gets a real variant, not a broken falling one', () => {
  const src = read(GAME);
  expect(src).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
  expect(src).toContain('data-testid="craving-reduced"');
  // The tap variant scores the same way and ends the same way, so the concept survives.
  expect(src).toContain('data-testid={`craving-tap-${item.id}`}');
  // And the falling area is not rendered at all there, which is the whole point: the token sheet
  // collapses animations to 1ms under the preference, so a falling game would be unplayable.
  expect(src).toContain('{reduced ? (');
});

/* ── 13+14. Nothing else moved ─────────────────────────────────────────────────────────────── */

test('13+14. the game is the LAST thing on the status screen, never in front of it', () => {
  const src = read(PROGRESS);
  const rounds = src.indexOf('{data.rounds.map((r) => (');
  const game = src.indexOf('<CravingGame');
  const bar = src.indexOf('<ActionBar testId="guest-status-bar">');
  expect(rounds).toBeGreaterThan(-1);
  expect(game, 'order status comes first').toBeGreaterThan(rounds);
  expect(bar, 'and the action bar still follows it').toBeGreaterThan(game);
});

test('13b. adding a suggestion goes through the ordinary cart path, not a new one', () => {
  const src = read(PROGRESS);
  expect(src).toContain('setCartQty(itemId, qtyOf(item) + 1)');
  // No bespoke endpoint was invented for the upsell.
  expect(read(GAME)).not.toContain('/api/');
});

test('the experience is switchable by the owner, through the existing feature set', () => {
  const features = read('src/lib/guest-features.ts');
  expect(features).toContain('craving: boolean;');
  expect(features).toContain('craving: true,');
  // One row in the existing data-driven list — not a second settings mechanism.
  expect(read('src/features/owner/sections/SettingsSection.tsx')).toContain("'craving',");
});

test('16. the play area cannot widen the page', () => {
  // The 320px rule, as a property of the markup rather than a measurement: the area is
  // `w-full` and clips its own children, so a falling item can never push the page sideways.
  const src = read(GAME);
  expect(src).toContain('relative h-52 w-full touch-none overflow-hidden');
});

test('dragging the plate never scrolls the page under the thumb', () => {
  expect(read(GAME)).toContain('touch-none');
});

/* ── The plate geometry, after the render spec caught it ───────────────────────────────────── */

test('the plate can never be slid out of the play area', () => {
  // The defect this replaced: the centre was clamped to 92% while the plate reaches 11% either
  // side, so its right edge sat at 103%. `craving.render.spec.ts` measured 297 against an area
  // of 289 and refused it.
  expect(clampPlate(200)).toBe(100 - PLATE_REACH_PCT);
  expect(clampPlate(-50)).toBe(PLATE_REACH_PCT);
  expect(clampPlate(50), 'an ordinary position is untouched').toBe(50);
  // The edges, stated as the property that actually matters.
  expect(clampPlate(200) + PLATE_REACH_PCT, 'right edge inside').toBeLessThanOrEqual(100);
  expect(clampPlate(-50) - PLATE_REACH_PCT, 'left edge inside').toBeGreaterThanOrEqual(0);
});

test('catching is decided by the same half-width the plate is drawn with', () => {
  expect(isCaught(50, 50), 'dead centre').toBe(true);
  expect(isCaught(50 + PLATE_REACH_PCT, 50), 'the very edge counts').toBe(true);
  expect(isCaught(50 + PLATE_REACH_PCT + 1, 50), 'just past it does not').toBe(false);
  expect(isCaught(10, 90), 'the far side of the area').toBe(false);
});

test('every place a dish can be dropped is reachable by the plate', () => {
  // The component drops between 10% and 90%. A dish that could never be caught would be a
  // small dishonesty, so the two ranges are checked against each other rather than assumed.
  for (const drop of [10, 25, 50, 75, 90]) {
    const best = clampPlate(drop);
    expect(isCaught(drop, best), `a dish at ${drop}% must be catchable`).toBe(true);
  }
});
