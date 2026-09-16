import type { FoodType } from './status';

/**
 * print-routing — which machine prints which items, and what happens when it does not answer.
 *
 * WHY THIS IS A MODULE AND NOT A `WHERE` CLAUSE
 *   `Jalsa Navigation Flowchart.dc.html`, section six: *"Routing runs category → station →
 *   printer, with the food-type split a separate decision."* And in section five, the row for
 *   **Print failed**: *"station tickets fall back to the main kitchen printer rather than
 *   vanishing."*
 *
 *   Those two sentences are a decision with four inputs and a fallback, taken on the hot path of
 *   every round placed, and they are the difference between a tandoor ticket reaching the
 *   tandoor and a party waiting for food nobody was told to cook. A decision like that belongs
 *   somewhere it can be executed against a table of cases without a database, which is here.
 *
 * WHY THE FALLBACK IS NEVER "NOWHERE"
 *   The honest failure for an unreachable printer is a ticket on the wrong machine with the
 *   station named on it. The dishonest one is no ticket at all, which is indistinguishable from
 *   a round that was never placed. `resolvePrinter` therefore returns a printer in every case it
 *   possibly can, and says which rule it used — so the ticket can carry "TANDOOR" in its header
 *   when it comes out of the main kitchen machine.
 */

export interface RoutablePrinter {
  id: string;
  name: string;
  /** 'KOT' or 'Invoice'. A bill never goes to a kitchen machine, whatever its routes say. */
  purpose: string;
  /** The place in the building. What a fallback ticket is stamped with. */
  station: string;
  /** Menu category names this machine prints. Empty means "whatever falls back to me". */
  routes: string[];
  /** Answered recently. */
  online: boolean;
  /** Switched off by the owner. An offline machine is a fault; a disabled one is a decision. */
  enabled: boolean;
}

export type RoutingRule =
  /** A machine claims this category, and it answered. */
  | 'routed'
  /** The machine that claims this category is unreachable or off; the main machine takes it. */
  | 'fallback'
  /** No machine claims this category; the main machine takes it. */
  | 'unrouted'
  /** There is no machine of this kind at all. */
  | 'none';

export interface RoutingDecision {
  printer: RoutablePrinter | null;
  rule: RoutingRule;
  /**
   * The station to stamp on the ticket header. Equal to the chosen printer's own station on a
   * `routed` decision, and to the station that SHOULD have printed it on a `fallback` — which
   * is the whole point of carrying it.
   */
  station: string;
  /** One sentence for the print-history row and the failure badge. Never empty. */
  reason: string;
}

const usable = (p: RoutablePrinter): boolean => p.enabled && p.online;

/**
 * The machine everything falls back to: the first enabled, reachable KOT machine with no
 * category of its own, and failing that the first enabled reachable one at all.
 *
 * "No category of its own" is what makes a main kitchen machine the main kitchen machine — the
 * tandoor claims Non-Veg Starters, the counter claims invoices, and the machine left claiming
 * nothing is the one that prints everything else.
 */
export function mainPrinter(purpose: string, printers: readonly RoutablePrinter[]): RoutablePrinter | null {
  const kind = printers.filter((p) => p.purpose === purpose);
  return (
    kind.find((p) => usable(p) && p.routes.length === 0) ??
    kind.find((p) => usable(p)) ??
    // Everything is down. Return the machine the ticket WOULD have gone to, so the failed job
    // names a printer a person can go and look at rather than a blank.
    kind.find((p) => p.enabled) ??
    kind[0] ??
    null
  );
}

/**
 * Where one item's ticket goes.
 *
 * Category match is case- and space-insensitive: routing is configured by picking a category
 * from a list, but the list is edited by people, and a category renamed from "Non-Veg Starters"
 * to "Non-veg starters" must not silently stop reaching the tandoor.
 */
export function resolvePrinter(input: {
  purpose: string;
  category: string;
  printers: readonly RoutablePrinter[];
}): RoutingDecision {
  const key = input.category.trim().toLowerCase();
  const kind = input.printers.filter((p) => p.purpose === input.purpose);

  if (kind.length === 0) {
    return { printer: null, rule: 'none', station: '', reason: `No ${input.purpose} printer is configured.` };
  }

  const claimed = kind.find((p) => p.routes.some((r) => r.trim().toLowerCase() === key)) ?? null;
  const fallback = mainPrinter(input.purpose, input.printers);

  if (claimed && usable(claimed)) {
    return {
      printer: claimed,
      rule: 'routed',
      station: claimed.station,
      reason: `${input.category} → ${claimed.station} → ${claimed.name}`,
    };
  }

  if (claimed) {
    return {
      printer: fallback,
      rule: 'fallback',
      // The station the ticket was MEANT for, not the one it came out at. A tandoor ticket on
      // the main kitchen machine has to say TANDOOR or the wrong cook picks it up.
      station: claimed.station,
      reason: `${claimed.name} is ${claimed.enabled ? 'not answering' : 'switched off'} — printing at ${
        fallback ? fallback.name : 'no reachable machine'
      } marked ${claimed.station}`,
    };
  }

  return {
    printer: fallback,
    rule: 'unrouted',
    station: fallback?.station ?? '',
    reason: `${input.category} is not routed to a station — printing at ${
      fallback ? fallback.name : 'no reachable machine'
    }`,
  };
}

/**
 * A whole round, split into the tickets that will actually come out of the machines.
 *
 * TWO SEPARATE DECISIONS, IN ORDER. Routing decides the MACHINE. The food-type split decides how
 * many tickets come out of it — one combined, or a veg ticket and a non-veg ticket so the two
 * sides of the kitchen never share paper. The design states them as separate controls and they
 * are computed in that order here, because reversing them produces a veg ticket at the tandoor
 * for a round with no veg in it.
 */
export function splitRound(input: {
  items: ReadonlyArray<{ category: string; foodType: FoodType }>;
  printers: readonly RoutablePrinter[];
  /** Print veg and non-veg as separate tickets. Egg travels with veg — one fryer, one side. */
  splitByFoodType: boolean;
}): Array<{ printerId: string | null; station: string; rule: RoutingRule; reason: string; foodTypes: FoodType[]; count: number }> {
  const buckets = new Map<
    string,
    { printerId: string | null; station: string; rule: RoutingRule; reason: string; foodTypes: FoodType[]; count: number }
  >();

  input.items.forEach((item) => {
    const decision = resolvePrinter({ purpose: 'KOT', category: item.category, printers: input.printers });
    const side = input.splitByFoodType && item.foodType === 'non_veg' ? 'non_veg' : 'veg_side';
    const key = `${decision.printer?.id ?? 'none'}|${decision.station}|${input.splitByFoodType ? side : 'all'}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.foodTypes.includes(item.foodType)) existing.foodTypes.push(item.foodType);
      return;
    }
    buckets.set(key, {
      printerId: decision.printer?.id ?? null,
      station: decision.station,
      rule: decision.rule,
      reason: decision.reason,
      foodTypes: [item.foodType],
      count: 1,
    });
  });

  return [...buckets.values()];
}
