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

import type { FoodType, KotStatus } from '@/lib/status';

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
  const distinct = new Set(types);
  if (distinct.size === 0) return null;
  if (distinct.size > 1) return 'mixed';
  if (distinct.has('veg')) return 'veg';
  if (distinct.has('non_veg')) return 'nonVeg';
  return 'egg';
}

/** The food types a route is allowed to show. Veg-only means veg-only — no chicken, no egg. */
export const ROUTE_TYPES: Record<CravingRoute, readonly FoodType[]> = {
  veg: ['veg'],
  nonVeg: ['non_veg'],
  egg: ['egg'],
  mixed: ['veg', 'non_veg', 'egg'],
};

/** What the offer calls itself, per route. One line, in Jalsa's voice, never a cartoon. */
export const ROUTE_LINE: Record<CravingRoute, string> = {
  veg: 'Your table is going vegetarian tonight.',
  nonVeg: 'Something from the grill is on its way.',
  egg: 'Egg is on the menu tonight.',
  mixed: 'A bit of everything is on its way.',
};

/* ── Which round the moment belongs to ─────────────────────────────────────────────────────── */

/** The statuses a guest is actually WAITING through. Ready and served are not waiting. */
const WAITING: readonly KotStatus[] = ['new', 'preparing'];

export function isWaiting(status: KotStatus): boolean {
  return WAITING.includes(status);
}

/**
 * The ONE round the engagement belongs to, or null when there is none.
 *
 * A table has rounds, not a round: 101 served, 102 preparing, 103 just placed. The requester was
 * explicit that this must not become three games, so this returns exactly one — the round
 * furthest along that is still being waited for, which is the one whose food is closest to
 * arriving and therefore the one worth building an appetite for.
 *
 * Returns null the moment nothing is waiting, which is what makes the experience disappear on
 * Ready and on Served without any component needing to remember to.
 */
export function activeCravingRound<T extends { code: string; status: KotStatus }>(
  rounds: readonly T[]
): T | null {
  const waiting = rounds.filter((r) => isWaiting(r.status));
  if (waiting.length === 0) return null;
  // `preparing` beats `new`; among equals, the most recent round.
  const preparing = waiting.filter((r) => r.status === 'preparing');
  const pool = preparing.length ? preparing : waiting;
  return pool[pool.length - 1] ?? null;
}

/* ── What falls ────────────────────────────────────────────────────────────────────────────── */

export interface CravingItem {
  id: string;
  name: string;
  foodType: FoodType;
}

/**
 * The food this round's game drops, drawn from the real menu.
 *
 * Available items only: dropping something the kitchen has run out of would build a craving the
 * restaurant cannot satisfy, and the suggestion at the end would then have to refuse it.
 *
 * Capped, because the list is a pool to draw from and not a catalogue — a phone does not need
 * fifty names in memory to drop eight of them.
 */
export function cravingPool(
  route: CravingRoute,
  menu: readonly (CravingItem & { available: boolean })[],
  limit = 12
): CravingItem[] {
  const allowed = ROUTE_TYPES[route];
  return menu
    .filter((m) => m.available && allowed.includes(m.foodType))
    .slice(0, limit)
    .map((m) => ({ id: m.id, name: m.name, foodType: m.foodType }));
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
 * 24 SECONDS, inside the 20–30 the requester asked for. It is deliberately not a number the
 * component owns: the test that proves the game stops reads it from here, so "it ends" and "it
 * ends when we said" cannot drift apart.
 */
export const CRAVING_SECONDS = 24;
/** How often a new item is released, in milliseconds. */
export const CRAVING_SPAWN_MS = 900;
/** How long one item takes to fall. Long enough to reach for, short enough to feel lively. */
export const CRAVING_FALL_MS = 2600;
/**
 * How many times a guest may play before the offer stops offering.
 *
 * A cap rather than a block: the requester asked that nobody be trapped in a loop, and the
 * primary experience is ordering dinner.
 */
export const CRAVING_MAX_PLAYS = 2;

/**
 * The plate's width, as a percentage of the play area — and the single number every other piece
 * of the geometry is derived from.
 *
 * IT IS HERE BECAUSE THREE THINGS DEPEND ON IT AND THEY MUST AGREE. How far the plate may slide
 * before part of it leaves the area, how close a dish must land to count, and where dishes may
 * be dropped are all the same fact seen three ways. Written separately they disagreed: the first
 * version clamped the plate's CENTRE to 92%, which put its right edge at 103% — outside the
 * area. `craving.render.spec.ts` measured it and refused it.
 */
export const PLATE_WIDTH_PCT = 22;
/** Half the plate. The plate is centred on its position, so this is its reach either way. */
export const PLATE_REACH_PCT = PLATE_WIDTH_PCT / 2;

/** Clamps the plate's centre so that no part of it leaves the play area. */
export function clampPlate(pct: number): number {
  return Math.min(100 - PLATE_REACH_PCT, Math.max(PLATE_REACH_PCT, pct));
}

/** Whether a dish that landed at `itemPct` was caught by a plate centred at `platePct`. */
export function isCaught(itemPct: number, platePct: number): boolean {
  return Math.abs(itemPct - platePct) <= PLATE_REACH_PCT;
}

export type CravingPhase = 'offer' | 'playing' | 'done' | 'dismissed';

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
  return input.plays < CRAVING_MAX_PLAYS || input.phase === 'done';
}
