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
  CATCH_POINTS,
  CRAVING_LIVES,
  cravingRoute,
  cravingSuggestions,
  CRAVING_MAX_PLAYS,
  CRAVING_SECONDS,
  clampPlate,
  dropIsEnemy,
  ENEMY,
  ENEMY_PENALTY,
  foodEmoji,
  FRESH_SCORE,
  isCaught,
  LEVEL_ORDER,
  LEVELS,
  orderTargets,
  plateReach,
  ROUTE_TYPES,
  scoreLanding,
  shouldOfferCraving,
  phaseForRound,
} from '../../src/lib/craving';
import type { FoodType } from '../../src/lib/status';

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

/** A round's lines, shaped as the guest payload delivers them (id is the KOT line's). */
const line = (id: string, name: string, foodType: FoodType) => ({ id, name, foodType, qty: 1 });

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

test('3b. what falls is the order itself, so a veg order can never drop chicken or egg', () => {
  // Superseded 03-Oct-2026: this asserted that `cravingPool('veg', MENU)` - a draw from the whole
  // menu - held only veg dishes. The pool is now the order's own lines (`orderTargets`), so a dish
  // the table did not order cannot fall at all; the veg promise holds by construction.
  const targets = orderTargets([line('k1', 'Paneer Butter Masala', 'veg'), line('k2', 'Veg Biryani', 'veg')]);
  expect(targets.map((t) => t.name)).toEqual(['Paneer Butter Masala', 'Veg Biryani']);
  expect(targets.every((t) => t.foodType === 'veg')).toBe(true);
});

test('the mixed route may show all three, which is the point of it', () => {
  // Superseded 30-Sep-2026: previously asserted exactly ['egg', 'non_veg', 'veg']. The KOT
  // classification Other (28-Sep) came after this spec; a table that already mixed may see a
  // juice or a dessert too. The three it was written for are all still there.
  expect([...ROUTE_TYPES.mixed].sort()).toEqual(['egg', 'non_veg', 'other', 'veg']);
});

test('nothing that was not ordered ever falls - not a sold-out dish, not any other menu row', () => {
  // Superseded 03-Oct-2026: this asserted that the menu pool skipped 'Sold Out Special'. There is
  // no menu pool now; only the order's lines fall.
  const targets = orderTargets([line('k1', 'Chicken 65', 'non_veg')]);
  expect(targets.map((t) => t.name)).toEqual(['Chicken 65']);
  for (const m of MENU.filter((x) => x.name !== 'Chicken 65')) {
    expect(targets.map((t) => t.name)).not.toContain(m.name);
  }
});

/* ── 1+2+7+8. When it is offered, and when it is gone ──────────────────────────────────────── */

test('1. nothing is offered before a round exists', () => {
  // Superseded 03-Oct-2026: also asserted `activeCravingRound([])` was null; that helper went with
  // the move to the order-placed screen, where the round is the one this phone just placed.
  expect(orderTargets([])).toEqual([]);
  expect(
    shouldOfferCraving({ enabled: true, hasWaitingRound: false, plays: 0, phase: 'offer' })
  ).toBe(false);
  expect(read(PROGRESS)).toContain("if (!round || !route || targets.length === 0) return null;");
});

test('2. it is offered on the order-placed screen, for the round this phone just placed', () => {
  // Superseded 03-Oct-2026: asserted `isWaiting('new'|'preparing')` and that the waited-for round
  // was chosen. The owner moved the game to the order-placed screen; the round is `placedCode`.
  expect(
    shouldOfferCraving({ enabled: true, hasWaitingRound: true, plays: 0, phase: 'offer' })
  ).toBe(true);
  const src = read(PROGRESS);
  expect(src).toContain('const round = placedCode ? data.rounds.find((r) => r.code === placedCode) : undefined;');
  expect(src).toContain('const targets = React.useMemo(() => (round ? orderTargets(round.items) : []), [round]);');
  expect(read('src/features/guest/GuestOrdering.tsx')).toContain('notePlaced(res.kotCode);');
});

test('7. "See my order" has no game - it is for the order', () => {
  // Superseded 03-Oct-2026: asserted that a Ready round ended the game on the status screen. The
  // status screen no longer hosts it at all.
  const src = read(PROGRESS);
  const status = src.slice(src.indexOf('export function StatusScreen('));
  expect(status).not.toContain('CravingGame');
  expect(status).not.toContain('PlacedCraving');
  expect(status).not.toContain('craving');
});

test('8. the order-placed screen renders the game once, below the confirmation and above the bar', () => {
  // Superseded 03-Oct-2026: asserted that served / picked-up / cancelled rounds were not waiting.
  const src = read(PROGRESS);
  const placed = src.slice(src.indexOf('export function PlacedScreen('), src.indexOf('export function StatusScreen('));
  expect(placed.match(/<PlacedCraving /g)?.length).toBe(1);
  expect(placed.indexOf('<PlacedCraving')).toBeGreaterThan(placed.indexOf('{summary}'));
  expect(placed.indexOf('<ActionBar testId="guest-placed-bar">')).toBeGreaterThan(placed.indexOf('<PlacedCraving'));
  // One component, one place: the game is not duplicated across screens.
  expect(src.match(/<CravingGame/g)?.length).toBe(1);
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

test('17. with several rounds on the bill, the game is about the one this phone just placed', () => {
  // Superseded 03-Oct-2026: asserted that of 101 served / 102 preparing / 103 new, the game chose
  // 102 (`activeCravingRound`). It now follows `placedCode`, so a round sent by another phone a
  // second later - or an earlier one - can never re-point it.
  const src = read(PROGRESS);
  expect(src).toContain('key={round.code}');
  expect(src).not.toContain('data.rounds[data.rounds.length - 1]?.items.map((i) => i.name)');
  expect(src).toContain('placedCode ? data.rounds.find((r) => r.code === placedCode) : undefined');
});

test('17b. a reload does not attach the game to any order', () => {
  // Superseded 03-Oct-2026: asserted the most recent of two new rounds was chosen.
  // `placedCode` is component state: a reload starts it at null, and with no placed round the
  // screen renders no game rather than one about some other order.
  expect(read('src/features/guest/GuestApp.tsx')).toContain('const [placedCode, setPlacedCode] = React.useState<string | null>(null);');
  expect(codeOnly('src/features/guest/GuestApp.tsx')).not.toMatch(/localStorage|sessionStorage/);
});

test('17c. the component renders at most one game, keyed by the placed round', () => {
  // Superseded 03-Oct-2026: pinned the status screen's `activeCravingRound` guard.
  const src = read(PROGRESS);
  expect(src).toContain('<PlacedCraving {...props} />');
  expect(src.match(/<CravingGame/g)?.length).toBe(1);
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
  // Superseded 03-Oct-2026: pinned one "Catch Your Craving" start button. There is now one start
  // button per level, and one "Play <level>" per level at the end - still only from a tap.
  expect(CRAVING_MAX_PLAYS).toBeLessThanOrEqual(3);
  const src = read(GAME);
  expect(src).toContain('{plays < CRAVING_MAX_PLAYS');
  expect(src).toContain('data-testid={`craving-start-${l}`}');
  expect(src).toContain('onClick={() => begin(l)}');
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
  // 03-Oct-2026: and the germ is there too, scored the same way as a caught one.
  expect(src).toContain('data-testid="craving-tap-enemy"');
  expect(src).toContain("onClick={() => record('enemy', true, ENEMY.name)}");
  // And the falling area is not rendered at all there, which is the whole point: the token sheet
  // collapses animations to 1ms under the preference, so a falling game would be unplayable.
  expect(src).toContain('{reduced ? (');
});

/* ── 13+14. Nothing else moved ─────────────────────────────────────────────────────────────── */

test('13+14. the game never sits in front of the order it is about', () => {
  // Superseded 03-Oct-2026: asserted the game was last on the STATUS screen. It is on the
  // order-placed screen now: after the placed round's card, before the action bar (see 8).
  const src = read(PROGRESS);
  const placed = src.slice(src.indexOf('export function PlacedScreen('));
  expect(placed.indexOf('<PlacedCraving')).toBeGreaterThan(placed.indexOf('<Pill tone={last.tone as Tone}>'));
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

test('the plate can never be slid out of the play area, at any level', () => {
  // The defect this replaced: the centre was clamped to 92% while the plate reaches 11% either
  // side, so its right edge sat at 103%. `craving.render.spec.ts` measured 297 against an area
  // of 289 and refused it.
  // Revised 03-Oct-2026: the plate's width is the level's, so the property is checked per level.
  for (const l of LEVEL_ORDER) {
    const w = LEVELS[l].plateWidthPct;
    const reach = plateReach(w);
    expect(clampPlate(200, w)).toBe(100 - reach);
    expect(clampPlate(-50, w)).toBe(reach);
    expect(clampPlate(50, w), 'an ordinary position is untouched').toBe(50);
    expect(clampPlate(200, w) + reach, 'right edge inside').toBeLessThanOrEqual(100);
    expect(clampPlate(-50, w) - reach, 'left edge inside').toBeGreaterThanOrEqual(0);
  }
});

test('catching is decided by the same half-width the plate is drawn with', () => {
  // Revised 03-Oct-2026: per level; the plate's width is no longer one constant.
  for (const l of LEVEL_ORDER) {
    const w = LEVELS[l].plateWidthPct;
    expect(isCaught(50, 50, w), 'dead centre').toBe(true);
    expect(isCaught(50 + plateReach(w), 50, w), 'the very edge counts').toBe(true);
    expect(isCaught(50 + plateReach(w) + 1, 50, w), 'just past it does not').toBe(false);
    expect(isCaught(10, 90, w), 'the far side of the area').toBe(false);
  }
  // And the component draws, clamps and catches with the one width.
  const src = read(GAME);
  expect(src).toContain('style={{ left: `${plate}%`, width: `${rules.plateWidthPct}%` }}');
  expect(src).toContain('setPlate(clampPlate(pct, rules.plateWidthPct));');
  expect(src).toContain('isCaught(drop.left, plate, rules.plateWidthPct)');
});

test('every place a dish can be dropped is reachable by the plate', () => {
  // The component drops between 10% and 90%. A dish that could never be caught would be a
  // small dishonesty, so the two ranges are checked against each other rather than assumed.
  for (const l of LEVEL_ORDER) {
    const w = LEVELS[l].plateWidthPct;
    for (const drop of [10, 25, 50, 75, 90]) {
      const best = clampPlate(drop, w);
      expect(isCaught(drop, best, w), `a dish at ${drop}% must be catchable on ${l}`).toBe(true);
    }
  }
});

/* ── 30-Sep-2026: the "Other" KOT classification ───────────────────────────────────────────────
 *
 * This game was written on 18-Sep, when every dish was veg, non-veg or egg. On 28-Sep a Food
 * Type could carry the classification Other (a juice, a dessert with no KOT class). Unhandled,
 * an order of only a juice fell through cravingRoute to EGG, and a veg order with a dessert
 * became MIXED - which may drop chicken in front of a vegetarian table (3b above). Other says
 * nothing about the table's diet, so it is not counted; an order of nothing else takes the
 * veg route, the one that shows no meat and no egg to a guest who ordered neither. */

test('Other says nothing about the diet: a veg order with a dessert stays veg', () => {
  expect(cravingRoute(['veg', 'other'])).toBe('veg');
  expect(cravingRoute(['non_veg', 'other'])).toBe('nonVeg');
  expect(cravingRoute(['egg', 'other', 'other'])).toBe('egg');
  expect(cravingRoute(['veg', 'non_veg', 'other'])).toBe('mixed');
});

test('an order of only Other dishes takes the veg route - never egg, never meat', () => {
  expect(cravingRoute(['other'])).toBe('veg');
  expect(cravingRoute(['other', 'other'])).toBe('veg');
});

/* ── 30-Sep-2026: code review of the recovered wiring ─────────────────────────────────────────
 *
 * The first wiring held the game's PHASE above the screens. A guest who left mid-game came back
 * to a component mounted straight into 'playing' - a fresh 24 s game nobody tapped for, and not
 * counted against the cap - and a finished card outlived its score onto the next round. Only a
 * dismissal is remembered now, per round; everything else belongs to the mount. */

test('a game left mid-play never resumes by itself: a fresh mount starts at the offer', () => {
  expect(phaseForRound('K1', [], null)).toBe('offer');
  // What the screen holds while it is mounted still counts, for the same round only.
  expect(phaseForRound('K1', [], { code: 'K1', phase: 'playing' })).toBe('playing');
});

test('a finished or dismissed card belongs to its round, not to the next one', () => {
  expect(phaseForRound('K2', [], { code: 'K1', phase: 'done' })).toBe('offer');
  expect(phaseForRound('K1', ['K1'], null)).toBe('dismissed');
  expect(phaseForRound('K2', ['K1'], null), 'once per waiting round').toBe('offer');
});

test('the placed screen keys the game by its round and remembers only dismissals above it', () => {
  // Superseded 03-Oct-2026: pinned the STATUS screen's `cravingRound` key and phase. Same rule,
  // on the order-placed screen.
  const src = read(PROGRESS);
  expect(src).toContain('key={round.code}');
  expect(src).toContain('phaseForRound(round.code, cravingDismissed, local)');
  expect(read('src/features/guest/GuestApp.tsx')).not.toContain('useState<CravingPhase>');
});

test('the 24 s stop is not restarted by a live-data refresh', () => {
  // The round is replaced on every payload change during exactly the wait this game fills, so
  // the timers must not depend on what is derived from it.
  // Revised 03-Oct-2026: the dependency list gained `level` (a new level is a new game) and the
  // ref holds the order's targets rather than the menu pool.
  const src = codeOnly(GAME);
  expect(src).toContain('}, [playing, reduced, setPhase, level]);');
  expect(src).toContain('targetsRef.current');
});

test('each drop takes its key before the state update, so two ticks never share one', () => {
  const src = codeOnly(GAME);
  expect(src).toContain('const key = ++dropSeq.current;');
  expect(src).not.toContain('key: dropSeq.current');
});

test('Other dishes fall when they were ordered, and are suggested wherever the table is not vegetarian-only', () => {
  // Revised 03-Oct-2026: the first half drew from the menu pool by route; an Other dish now falls
  // exactly when it is in the order.
  const withOther = [...MENU, item('o1', 'Rose Milk', 'other', 'Drinks'), item('o2', 'Falooda', 'other', 'Desserts')];
  expect(orderTargets([line('k1', 'Rose Milk', 'other')]).map((t) => t.name)).toEqual(['Rose Milk']);
  // With the Veg dessert and drink already ordered, the finishers left are the Other ones.
  expect(cravingSuggestions('mixed', withOther, ['d1', 'd2']).map((p) => p.foodType)).toEqual(['other', 'other']);
});

test('the offer claims nothing about the menu - it lists the order that will fall', () => {
  // Superseded 03-Oct-2026: asserted the four ROUTE_LINE offer lines used the menu's Veg /
  // Non-veg / Egg words. Those lines described the menu draw ("A few Veg favourites from
  // tonight's menu."); with only the order falling they were false, and were removed.
  const src = read(GAME);
  expect(src).not.toContain('ROUTE_LINE');
  expect(read(LOGIC)).not.toContain('export const ROUTE_LINE');
  expect(src).toContain("{targets.map((t) => `${t.emoji} ${t.name}`).join(' · ')} — but never the {ENEMY.emoji}.");
});

test('the ending does not say "Nice catch!" when nothing was caught, and says what was caught', () => {
  // Revised 03-Oct-2026: the count is `tally.caught` (points are separate), and germs are said too.
  const src = read(GAME);
  expect(src).toContain('{tally.caught > 0 ? (');
  expect(src).toContain("`You caught ${tally.caught} ${tally.caught === 1 ? 'dish' : 'dishes'}`");
  expect(src).toContain('{`${tally.score} points · ${LEVELS[level].label}`}');
});

test('Add says what it did, and that nothing went to the kitchen', () => {
  expect(read(GAME)).toContain('aria-label={`Add ${s.name}`}');
  expect(read(PROGRESS)).toContain('`${item.name} added · nothing sent to the kitchen yet`');
});

test('no game is offered when the placed round has nothing to fall', () => {
  // Superseded 03-Oct-2026: pinned `cravingPool(cravingRoute, data.menu).length > 0`.
  expect(read(PROGRESS)).toContain('if (!round || !route || targets.length === 0) return null;');
});

/* ── 03-Oct-2026: the order's own food, a germ to avoid, three levels and points ──────────────
 *
 * The owner: "placing emojis for the food items along with name and some kind of enemy which
 * they should not pick ... add levels easy moderate hard, give points, and the food items for
 * catch should be based on their order ... replace that brown slate for catching with a plate". */

test('each ordered dish falls once, as its name and an emoji, however many were ordered', () => {
  const t = orderTargets([
    line('k1', 'Chicken Dum Biryani', 'non_veg'),
    line('k2', 'Chicken Dum Biryani', 'non_veg'),
    line('k3', 'Butter Naan', 'veg'),
    line('k4', 'Fresh Lime Soda', 'other'),
  ]);
  expect(t.map((x) => [x.name, x.emoji])).toEqual([
    ['Chicken Dum Biryani', '🍛'],
    ['Butter Naan', '🫓'],
    ['Fresh Lime Soda', '🥤'],
  ]);
});

test('the emoji is read from the dish name, most specific first, and never guesses a dish', () => {
  expect(foodEmoji('Chicken Biryani', 'non_veg'), 'the biryani, not the chicken').toBe('🍛');
  expect(foodEmoji('Chicken 65', 'non_veg')).toBe('🍗');
  expect(foodEmoji('Paneer Tikka', 'veg')).toBe('🧀');
  expect(foodEmoji('Gulab Jamun', 'veg')).toBe('🍮');
  expect(foodEmoji('Masala Chai', 'other')).toBe('☕');
  // A name that matches nothing falls as its Food Type's plate.
  expect(foodEmoji('House Special', 'veg')).toBe('🥗');
  expect(foodEmoji('House Special', 'non_veg')).toBe('🍗');
  expect(foodEmoji('House Special', 'egg')).toBe('🥚');
  expect(foodEmoji('House Special', 'other')).toBe('🍽️');
});

test('the enemy is a germ - plainly not food, and plainly not wanted', () => {
  expect(ENEMY.emoji).toBe('🦠');
  for (const m of MENU) expect(foodEmoji(m.name, m.foodType)).not.toBe(ENEMY.emoji);
});

test('a dish on the plate scores, a germ on the plate costs points and a life, a miss changes nothing', () => {
  const caught = scoreLanding(FRESH_SCORE, 'food', true);
  expect(caught).toEqual({ score: CATCH_POINTS, lives: CRAVING_LIVES, caught: 1, germs: 0 });
  const germ = scoreLanding(caught, 'enemy', true);
  expect(germ).toEqual({ score: 0, lives: CRAVING_LIVES - 1, caught: 1, germs: 1 });
  expect(ENEMY_PENALTY).toBeGreaterThan(CATCH_POINTS);
  expect(scoreLanding(caught, 'food', false), 'a missed dish').toEqual(caught);
  expect(scoreLanding(caught, 'enemy', false), 'a germ left alone costs nothing').toEqual(caught);
});

test('points never go below zero, and lives run out at zero', () => {
  let s = FRESH_SCORE;
  for (let i = 0; i < CRAVING_LIVES + 2; i++) s = scoreLanding(s, 'enemy', true);
  expect(s.score).toBe(0);
  expect(s.lives).toBe(0);
  // And running out of lives ends the game - in an effect, never inside the score updater.
  const src = codeOnly(GAME);
  expect(src).toContain("if (playing && tally.lives === 0) setPhase('done');");
  expect(src).toContain('setTally((s) => scoreLanding(s, kind, onPlate));');
});

test('the three levels change play, not colour: faster, busier, more germs, smaller plate', () => {
  expect(LEVEL_ORDER).toEqual(['easy', 'moderate', 'hard']);
  const [e, m, h] = LEVEL_ORDER.map((l) => LEVELS[l]);
  expect(e!.fallMs).toBeGreaterThan(m!.fallMs);
  expect(m!.fallMs).toBeGreaterThan(h!.fallMs);
  expect(e!.spawnMs).toBeGreaterThan(m!.spawnMs);
  expect(m!.spawnMs).toBeGreaterThan(h!.spawnMs);
  expect(e!.enemyChance).toBeLessThan(m!.enemyChance);
  expect(m!.enemyChance).toBeLessThan(h!.enemyChance);
  expect(e!.plateWidthPct).toBeGreaterThan(m!.plateWidthPct);
  expect(m!.plateWidthPct).toBeGreaterThan(h!.plateWidthPct);
  // And the component actually uses them.
  const src = read(GAME);
  expect(src).toContain('}, LEVELS[level].spawnMs);');
  expect(src).toContain('animationDuration: `${rules.fallMs}ms`');
  expect(src).toContain('dropIsEnemy(level, Math.random())');
});

test('how often the germ falls is the level\'s share and nothing else', () => {
  for (const l of LEVEL_ORDER) {
    const c = LEVELS[l].enemyChance;
    expect(dropIsEnemy(l, c - 0.001)).toBe(true);
    expect(dropIsEnemy(l, c)).toBe(false);
  }
  // Over a fixed sweep of rolls, Hard drops more germs than Easy.
  const rolls = Array.from({ length: 100 }, (_, i) => i / 100);
  const count = (l: 'easy' | 'hard') => rolls.filter((r) => dropIsEnemy(l, r)).length;
  expect(count('hard')).toBeGreaterThan(count('easy'));
});

test('the score is on screen while playing, and the final score at the end', () => {
  const src = read(GAME);
  // One word for points, during play and at the end (copy review).
  expect(src).toContain('{`${tally.score} points`}');
  expect(src).not.toContain('pts`');
  // A round ended by germs says so.
  expect(src).toContain('Three germs on the plate — that round is over.');
  expect(src).toContain('data-testid="craving-live-score"');
  expect(src).toContain('data-testid="craving-lives"');
  expect(src).toContain('data-testid="craving-final-score"');
});

test('the one-line instruction says what to do without a tutorial', () => {
  expect(read(GAME)).toContain('Catch your ordered food. Avoid the bad item!');
});

test('the catching surface is a plate, not the brown slate it replaced', () => {
  const src = read(GAME);
  // The slate: a thin bar in the primary (brown) colour.
  expect(src).not.toContain('absolute bottom-2 h-3 -translate-x-1/2 rounded-full bg-[var(--primary)]');
  // The plate: a white oval with a rim and a well.
  expect(src).toContain('rounded-[50%] border-2 border-[var(--border-strong)] bg-[var(--surface)]');
  expect(src).toContain('h-2 w-3/5 rounded-[50%] border border-[var(--border)] bg-[var(--surface-sunken)]');
});

test('a game in play is never taken away by the replay cap - "Play again" starts a game, it does not remove the card', () => {
  // The review's case: begin() counts the play first, so the last allowed game is played at
  // plays === CRAVING_MAX_PLAYS. Before the fix this returned false and the card vanished.
  expect(shouldOfferCraving({ enabled: true, hasWaitingRound: true, plays: CRAVING_MAX_PLAYS, phase: 'playing' })).toBe(true);
  expect(shouldOfferCraving({ enabled: true, hasWaitingRound: true, plays: CRAVING_MAX_PLAYS, phase: 'done' })).toBe(true);
  // The cap still holds where it should: no new offer once the plays are used.
  expect(shouldOfferCraving({ enabled: true, hasWaitingRound: true, plays: CRAVING_MAX_PLAYS, phase: 'offer' })).toBe(false);
  // The owner's switch and a dismissal still win.
  expect(shouldOfferCraving({ enabled: false, hasWaitingRound: true, plays: 1, phase: 'playing' })).toBe(false);
});
