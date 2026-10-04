/**
 * craving — the rules behind "Catch Your Craving", with none of the animation.
 *
 * WHY THE RULES LIVE APART FROM THE COMPONENT
 *   Everything worth being sure about here is a decision, not a drawing: which round the moment
 *   belongs to, whether it should be offered at all, which food falls, and which single item is
 *   worth suggesting at the end. Held inside the component, each of those could only be checked
 *   by driving a browser. Held here, every one of them is a function with an answer.
 *
 * WHAT THIS MODULE REFUSES TO DO
 *   It invents no food. Every item that falls, and every item suggested, is a real row from the
 *   menu the phone already holds — the same name, the same price, the same availability. A game
 *   that showed a dish Jalsa does not serve, or priced one it does, would be worse than no game:
 *   the rest of the screen is a menu the guest is about to trust with money.
 */

import type { FoodType } from '@/lib/status';

/* ── The four routes ───────────────────────────────────────────────────────────────────────── */

export type CravingRoute = 'veg' | 'nonVeg' | 'egg' | 'mixed';

/**
 * Which route an order takes, from the food types it actually contains.
 *
 * ONE ENGINE, FOUR ROUTES — never four games. The route changes what falls and nothing else,
 * which is the requester's own instruction and also the only version of this that stays
 * maintainable: a bug fixed in the veg game is a bug still shipping in the other three.
 *
 * `null` for an order with nothing in it. An honest absence rather than a default, because a
 * default here would be a route chosen for a guest whose order we could not read.
 */
export function cravingRoute(types: readonly FoodType[]): CravingRoute | null {
  if (types.length === 0) return null;
  /* 'other' (a Food Type with no KOT classification, 28-Sep) says nothing about the table's diet,
     so it is not counted. An order of nothing else takes the veg route: the one that shows no
     meat and no egg to a guest who ordered neither. */
  const distinct = new Set(types.filter((t) => t !== 'other'));
  if (distinct.size === 0) return 'veg';
  if (distinct.size > 1) return 'mixed';
  if (distinct.has('veg')) return 'veg';
  if (distinct.has('non_veg')) return 'nonVeg';
  return 'egg';
}

/** The food types a route is allowed to show. Veg-only means veg-only — no chicken, no egg.
 *  'other' (a juice, a dessert with no KOT classification, 28-Sep) is fair on every route but
 *  veg: nothing says it is vegetarian, and the veg route promises exactly that. */
export const ROUTE_TYPES: Record<CravingRoute, readonly FoodType[]> = {
  veg: ['veg'],
  nonVeg: ['non_veg', 'other'],
  egg: ['egg', 'other'],
  mixed: ['veg', 'non_veg', 'egg', 'other'],
};

/* `ROUTE_LINE` - "A few Veg favourites from tonight's menu." and its siblings - was removed on
   03-Oct-2026: it described the menu draw, and only the guest's own order falls now. The offer
   lists the order's dishes instead (copy review). */

/* ── Which round the moment belongs to ───────────────────────────────────────────────────────
 *
 * 03-Oct-2026: `isWaiting` and `activeCravingRound` (the round furthest along that was still
 * being waited for) were removed with the game's move to the order-placed screen. The round is
 * now the one this phone just placed - `placedCode`, see GuestProgress.tsx `PlacedCraving`. */

/* ── What falls: the order just placed, and one thing to avoid ──────────────────────────────── */

export interface CravingItem {
  id: string;
  name: string;
  foodType: FoodType;
}

/** A dish that can fall: one of the order's own lines, with the picture it falls as. */
export interface CravingTarget extends CravingItem {
  emoji: string;
}

/**
 * The picture a dish falls as, read from its own name.
 *
 * 03-Oct-2026: the game showed bare names in pills. The menu has no picture column to read
 * (`menu_item.image_url` is an uploaded photo, absent for most dishes and far too heavy to drop
 * ten of), so the emoji is matched from words the dish's name already contains, most specific
 * first - "Chicken Biryani" is the biryani, not the chicken. A name that matches nothing falls
 * as its Food Type's plate, never as a guess at a dish it is not.
 */
const EMOJI_WORDS: ReadonlyArray<readonly [readonly string[], string]> = [
  [['biryani', 'pulao', 'fried rice', 'rice'], '🍛'],
  [['noodle', 'chowmein', 'chow mein', 'hakka', 'ramen'], '🍜'],
  [['soup', 'rasam', 'shorba'], '🍲'],
  [['naan', 'roti', 'kulcha', 'paratha', 'parotta', 'chapati', 'dosa', 'uttapam', 'appam'], '🫓'],
  [['idli', 'vada'], '🥟'],
  [['momo', 'dumpling', 'samosa'], '🥟'],
  [['prawn', 'shrimp'], '🍤'],
  [['fish', 'pomfret', 'seer', 'crab'], '🐟'],
  [['egg', 'omelette', 'omelet'], '🥚'],
  [['paneer', 'cheese'], '🧀'],
  [['chicken', 'tandoori', 'kebab', 'kabab', 'tikka', 'wings', 'lollipop'], '🍗'],
  [['mutton', 'lamb', 'goat', 'keema'], '🍖'],
  [['burger'], '🍔'],
  [['pizza'], '🍕'],
  [['fries', 'chips'], '🍟'],
  [['sandwich', 'roll', 'wrap', 'shawarma', 'frankie'], '🌯'],
  [['salad'], '🥗'],
  [['ice cream', 'kulfi', 'sundae'], '🍨'],
  [['cake', 'brownie', 'pastry'], '🍰'],
  [['gulab', 'jamun', 'halwa', 'kheer', 'payasam', 'rasmalai', 'sweet', 'dessert'], '🍮'],
  [['lassi', 'milkshake', 'shake', 'milk'], '🥛'],
  [['coffee', 'tea', 'chai'], '☕'],
  [['juice', 'lime', 'soda', 'mojito', 'cooler', 'drink', 'water'], '🥤'],
  [['dal', 'curry', 'masala', 'gravy', 'korma', 'sabzi', 'kadai', 'kadhai'], '🥘'],
  [['mushroom'], '🍄'],
  [['corn'], '🌽'],
  [['potato', 'aloo'], '🥔'],
  [['gobi', 'cauliflower', 'manchurian', 'veg'], '🥦'],
];

const TYPE_EMOJI: Record<FoodType, string> = { veg: '🥗', non_veg: '🍗', egg: '🥚', other: '🍽️' };

export function foodEmoji(name: string, foodType: FoodType): string {
  const n = name.toLowerCase();
  for (const [words, emoji] of EMOJI_WORDS) {
    if (words.some((w) => n.includes(w))) return emoji;
  }
  return TYPE_EMOJI[foodType];
}

/**
 * The food types that fall, per route - the table's own kind of food and nothing else.
 *
 * 04-Oct-2026: the owner, after playing it: "based on menu category you show items - if they have
 * selected non veg show all non veg menu items, if veg then veg menu items". So a Non-veg order
 * drops every Non-veg dish on the menu, a Veg order every Veg dish, an Egg order every Egg dish,
 * and a table that mixed sees all three. Strictly the kind: 'other' (a juice, a dessert with no KOT
 * class) does not fall, because "all non-veg items" is what was asked, not "anything but veg".
 * The suggestions at the end keep `ROUTE_TYPES`, which does let an Other finisher through.
 */
export const GAME_TYPES: Record<CravingRoute, readonly FoodType[]> = {
  veg: ['veg'],
  nonVeg: ['non_veg'],
  egg: ['egg'],
  mixed: ['veg', 'non_veg', 'egg'],
};

/**
 * What falls: every AVAILABLE menu dish of the table's kind, each as an emoji and its name.
 *
 * SUPERSEDES `orderTargets` (03-Oct-2026), which dropped only the dishes in the order - the owner
 * found one dish falling over and over dull ("you are giving only [ordered] items"). The order
 * still decides the KIND (`cravingRoute`), so a vegetarian table never sees meat; the menu
 * decides the variety. Sold-out dishes never fall: building a craving the kitchen cannot satisfy
 * is worse than building none. Every dish of the kind, uncapped - that is what was asked.
 */
export function cravingPool(
  route: CravingRoute,
  menu: ReadonlyArray<CravingItem & { available: boolean }>
): CravingTarget[] {
  const allowed = GAME_TYPES[route];
  return menu
    .filter((m) => m.available && allowed.includes(m.foodType))
    .map((m) => ({ id: m.id, name: m.name, foodType: m.foodType, emoji: foodEmoji(m.name, m.foodType) }));
}

/** How the offer names the kind that will fall, in the menu's own Veg / Non-veg / Egg words. */
export const ROUTE_KIND: Record<CravingRoute, string> = {
  veg: 'Veg',
  nonVeg: 'Non-veg',
  egg: 'Egg',
  mixed: 'Veg, Non-veg and Egg',
};

/**
 * The one thing NOT to catch. A germ: nobody wants it on their plate, it reads as "bad" without a
 * word of instruction, and it is not food - so it can never be mistaken for a dish the kitchen
 * might be sending.
 */
export const ENEMY = { emoji: '🦠', name: 'Germ' } as const;

/* ── Levels and points ─────────────────────────────────────────────────────────────────────── */

export type CravingLevel = 'easy' | 'moderate' | 'hard';

export interface LevelRules {
  label: string;
  /** How long one drop takes to fall, ms. Shorter is harder to reach. */
  fallMs: number;
  /** How often something is released, ms. Shorter is busier. */
  spawnMs: number;
  /** The share of drops that are the germ, 0..1. */
  enemyChance: number;
  /** The plate's width, as a percentage of the play area. Narrower is harder to land on. */
  plateWidthPct: number;
}

/**
 * Three levels, and every one of them changes play - speed, density, how many germs, and how
 * wide the plate is. None is a colour change. The numbers are ordered (asserted in
 * craving.unit.spec.ts), so "Hard" can never quietly become easier than "Moderate".
 *
 * 04-Oct-2026: the guest no longer CHOOSES a level ("it's not like the user should select that"):
 * every game starts on the first and climbs on its own as it runs (`levelAt`).
 */
export const LEVELS: Record<CravingLevel, LevelRules> = {
  easy: { label: 'Easy', fallMs: 3200, spawnMs: 1100, enemyChance: 0.15, plateWidthPct: 28 },
  moderate: { label: 'Moderate', fallMs: 2500, spawnMs: 850, enemyChance: 0.25, plateWidthPct: 22 },
  hard: { label: 'Hard', fallMs: 1800, spawnMs: 600, enemyChance: 0.35, plateWidthPct: 17 },
};

export const LEVEL_ORDER: readonly CravingLevel[] = ['easy', 'moderate', 'hard'];

/** The seconds into a game at which the next level begins - 10 s each, over a 30 s game. */
export const LEVEL_UP_AT_SECONDS: readonly number[] = [10, 20];

/** The level a game is on, `elapsed` seconds in. It only ever climbs. */
export function levelAt(elapsed: number): CravingLevel {
  const passed = LEVEL_UP_AT_SECONDS.filter((t) => elapsed >= t).length;
  return LEVEL_ORDER[Math.min(passed, LEVEL_ORDER.length - 1)]!;
}

/** "Level 2" - the number the guest sees, from 1. */
export const levelNumber = (level: CravingLevel): number => LEVEL_ORDER.indexOf(level) + 1;

/** Points for a dish on the plate. */
export const CATCH_POINTS = 10;
/** Points lost for a germ on the plate. */
export const ENEMY_PENALTY = 15;
/** Germs a guest may catch before the game ends early. */
export const CRAVING_LIVES = 3;

export interface CravingScore {
  score: number;
  lives: number;
  caught: number;
  germs: number;
}

export const FRESH_SCORE: CravingScore = { score: 0, lives: CRAVING_LIVES, caught: 0, germs: 0 };

/**
 * What one landing does to the score. Pure, so the whole points table is tested without a
 * browser. A miss changes nothing; a dish adds; a germ costs points (never below zero) and a life.
 *
 * 04-Oct-2026: a dish is worth more as the game climbs - 10 on Level 1, 20 on Level 2, 30 on
 * Level 3 - so holding on through the faster levels is where the score is made.
 */
export function scoreLanding(
  s: CravingScore,
  landed: 'food' | 'enemy',
  onPlate: boolean,
  level: CravingLevel = 'easy'
): CravingScore {
  if (!onPlate) return s;
  if (landed === 'food') return { ...s, score: s.score + CATCH_POINTS * levelNumber(level), caught: s.caught + 1 };
  return { ...s, score: Math.max(0, s.score - ENEMY_PENALTY), lives: Math.max(0, s.lives - 1), germs: s.germs + 1 };
}

/** Whether the next drop is the germ. `roll` is a 0..1 random number, passed in so it is testable. */
export function dropIsEnemy(level: CravingLevel, roll: number): boolean {
  return roll < LEVELS[level].enemyChance;
}

/* ── What is suggested at the end ──────────────────────────────────────────────────────────── */

/**
 * Categories worth finishing a meal with, as hints rather than as names.
 *
 * MATCHED, NOT HARDCODED. "Desserts" and "Drinks" are what this restaurant happens to call them
 * today; another might say "Sweets" or "Beverages", and an owner may rename a category this
 * afternoon. Hint matching degrades into the fallback below instead of silently suggesting
 * nothing, which a hardcoded category name would do the day it was renamed.
 */
const FINISHER_HINTS = ['dessert', 'sweet', 'drink', 'beverage', 'side', 'bread', 'salad'];

const looksLikeFinisher = (category: string): boolean => {
  const c = category.toLowerCase();
  return FINISHER_HINTS.some((h) => c.includes(h));
};

export interface CravingSuggestion {
  id: string;
  name: string;
  priceLabel: string;
  foodType: FoodType;
  category: string;
}

/**
 * At most two items to finish the meal with — real, available, and not already ordered.
 *
 * AN OFFER, NOT A SALES MECHANISM. Two is the cap the requester set and it is also the honest
 * one: a carousel is a shop, and this is a restaurant suggesting a dessert.
 *
 * `excludeIds` is what is already in this order. Suggesting a second helping of the thing they
 * are currently waiting for reads as a system that has not noticed what they did.
 *
 * The route still applies: a vegetarian table is never offered chicken, even as a finisher. On a
 * `mixed` order every type is fair, because the table already mixed.
 */
export function cravingSuggestions(
  route: CravingRoute,
  menu: readonly (CravingSuggestion & { available: boolean })[],
  excludeIds: readonly string[],
  limit = 2
): CravingSuggestion[] {
  const allowed = ROUTE_TYPES[route];
  const exclude = new Set(excludeIds);
  const eligible = menu.filter(
    (m) => m.available && allowed.includes(m.foodType) && !exclude.has(m.id)
  );
  // Finishers first; then anything else eligible, so the list is never empty merely because
  // this restaurant does not name a category the way the hints expect.
  const finishers = eligible.filter((m) => looksLikeFinisher(m.category));
  const rest = eligible.filter((m) => !looksLikeFinisher(m.category));
  return [...finishers, ...rest].slice(0, limit).map((m) => ({
    id: m.id,
    name: m.name,
    priceLabel: m.priceLabel,
    foodType: m.foodType,
    category: m.category,
  }));
}

/* ── The lifecycle ─────────────────────────────────────────────────────────────────────────── */

/**
 * How long a round of this lasts, and how often food appears.
 *
 * 30 SECONDS, inside the 20–30 the requester asked for. It is deliberately not a number the
 * component owns: the test that proves the game stops reads it from here, so "it ends" and "it
 * ends when we said" cannot drift apart. (24 until 04-Oct-2026: three 10-second levels need 30.)
 */
export const CRAVING_SECONDS = 30;
/**
 * How many times a guest may play before the offer stops offering.
 *
 * A cap rather than a block: the requester asked that nobody be trapped in a loop, and the
 * primary experience is ordering dinner. Raised from 2 to 5 on 04-Oct-2026: the owner wants "Play
 * again" there after a game, and a game that climbs through three levels is worth replaying.
 */
export const CRAVING_MAX_PLAYS = 5;

/**
 * The plate's reach - half its width, since it is centred on its position - and the single fact
 * the drawn plate, the movable plate and the catching plate are all derived from.
 *
 * IT IS ONE NUMBER BECAUSE THREE THINGS DEPEND ON IT AND THEY MUST AGREE. The first version
 * clamped the plate's CENTRE to 92%, which put its right edge outside the area;
 * `craving.render.spec.ts` measured it and refused it. 03-Oct-2026: the width now comes from the
 * level (`LEVELS[level].plateWidthPct`), so every function here takes it rather than a constant.
 */
export const plateReach = (widthPct: number): number => widthPct / 2;

/** Clamps the plate's centre so that no part of it leaves the play area. */
export function clampPlate(pct: number, widthPct: number): number {
  const reach = plateReach(widthPct);
  return Math.min(100 - reach, Math.max(reach, pct));
}

/** Whether a drop that landed at `itemPct` was caught by a plate centred at `platePct`. */
export function isCaught(itemPct: number, platePct: number, widthPct: number): boolean {
  return Math.abs(itemPct - platePct) <= plateReach(widthPct);
}

export type CravingPhase = 'offer' | 'playing' | 'done' | 'dismissed';

/**
 * Where one round's game is.
 *
 * Only a DISMISSAL outlives the screen, and only for the round it was made on ("once per
 * waiting round"). Everything else belongs to the mount that is showing it: a guest who walks to
 * the menu mid-game comes back to the offer, never to a game that restarted itself, and a
 * finished card never carries its score onto the next round. The replay cap is counted
 * separately, for the whole visit.
 */
export function phaseForRound(
  code: string,
  dismissed: readonly string[],
  local: { code: string; phase: CravingPhase } | null
): CravingPhase {
  if (dismissed.includes(code)) return 'dismissed';
  return local && local.code === code ? local.phase : 'offer';
}

/**
 * Whether the offer should be on the screen at all.
 *
 * Every reason to say no, in one place: the owner switched it off, nothing is waiting, or this
 * guest has already played their fill or waved it away. A component asking "should I render?"
 * gets one answer rather than assembling four conditions of its own.
 */
export function shouldOfferCraving(input: {
  enabled: boolean;
  hasWaitingRound: boolean;
  plays: number;
  phase: CravingPhase;
}): boolean {
  if (!input.enabled) return false;
  if (!input.hasWaitingRound) return false;
  if (input.phase === 'dismissed') return false;
  /* A game in play is never taken away. `begin` counts the play before the first drop, so the
     last allowed game reaches `plays === CRAVING_MAX_PLAYS` while it is being played; without
     this, "Play again" removed the card it was tapped on (review, 03-Oct-2026). */
  if (input.phase === 'playing') return true;
  return input.plays < CRAVING_MAX_PLAYS || input.phase === 'done';
}
