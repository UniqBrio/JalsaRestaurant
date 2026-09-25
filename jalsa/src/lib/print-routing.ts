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
 *   The honest failure for a station with no usable machine is a ticket on another machine with
 *   the station named on it. The dishonest one is no ticket at all, which is indistinguishable
 *   from a round that was never placed. `resolvePrinter` therefore returns a printer in every
 *   case it possibly can, and says which rule it used — so the ticket can carry "TANDOOR" in its
 *   header when it comes out of the main kitchen machine.
 *
 * ── TWO RULES ADDED 19-Sep-2026, BOTH OF THEM CORRECTIONS ────────────────────────────────────
 *
 * 1. `online` IS NOT A ROUTING INPUT.
 *   It used to be: a machine that had not answered recently lost its own categories to the
 *   fallback. That was defensible while the assignment was re-taken on every attempt. It stopped
 *   being defensible the moment `print_job.printer_id` became permanent, because the two facts
 *   are on different clocks — `online` is a snapshot of this second, and the assignment is
 *   forever. A tandoor printer that is merely unplugged at the instant the round is placed would
 *   have had its ticket assigned to the main kitchen FOR GOOD, and no later retry could correct
 *   it. Routing therefore asks only what the owner has configured; whether a machine answers is
 *   the delivery layer's problem, which is where a retry can actually help.
 *
 *   `enabled` is a different fact and still routes: it is the owner saying "do not use this
 *   machine", which is a decision, not a fault, and the fallback is the right answer to it.
 *
 * 2. NO DECISION HERE MAY DEPEND ON ARRAY ORDER.
 *   Every selection below runs over a list sorted by `machineId`, which is unique per restaurant
 *   (`printer_machine_unique`). The hot-path query had no ORDER BY, so with two machines claiming
 *   the same category the winner was whatever PostgREST happened to return first — and the
 *   owner's Routing screen, which DOES order by `machineId`, could show one answer while the
 *   order path took the other. Sorting here makes the module's own answer stable whatever it is
 *   handed; the callers order their queries too, so the two can no longer disagree.
 */

export interface RoutablePrinter {
  id: string;
  /** Unique per restaurant, and therefore the tie-break. Never a display value. */
  machineId: string;
  name: string;
  /** 'KOT' or 'Invoice'. A bill never goes to a kitchen machine, whatever its routes say. */
  purpose: string;
  /** The place in the building. What a fallback ticket is stamped with. */
  station: string;
  /** Menu category names this machine prints. Empty means "whatever falls back to me". */
  routes: string[];
  /**
   * Answered recently. Read by the screens and, in Phase 2, by the bridge. Deliberately NOT read
   * by anything in this module — see rule 1 above.
   */
  online: boolean;
  /** Switched off by the owner. An offline machine is a fault; a disabled one is a decision. */
  enabled: boolean;
}

export type RoutingRule =
  /** An enabled machine claims this category. */
  | 'routed'
  /** The machine that claims this category is switched off; the main machine takes it. */
  | 'fallback'
  /** No machine claims this category; the main machine takes it. */
  | 'unrouted'
  /** There is no usable machine of this kind at all. The only rule that assigns no printer. */
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

/** The owner has not switched it off. The whole of what routing asks about a machine. */
const assignable = (p: RoutablePrinter): boolean => p.enabled;

/**
 * Every machine of one purpose, in the one order this module ever considers them in.
 *
 * `machineId` and not `name`: a name is edited by people and two machines may share one, while
 * `machineId` is unique by constraint. A tie-break that can tie is not a tie-break.
 */
const inOrder = (purpose: string, printers: readonly RoutablePrinter[]): RoutablePrinter[] =>
  printers.filter((p) => p.purpose === purpose).sort((a, b) => a.machineId.localeCompare(b.machineId));

/**
 * The machine everything falls back to: the first enabled machine with no category of its own,
 * and failing that the first enabled one at all — "first" by `machineId`, always.
 *
 * "No category of its own" is what makes a main kitchen machine the main kitchen machine — the
 * tandoor claims Non-Veg Starters, the counter claims invoices, and the machine left claiming
 * nothing is the one that prints everything else.
 */
export function mainPrinter(purpose: string, printers: readonly RoutablePrinter[]): RoutablePrinter | null {
  const kind = inOrder(purpose, printers);
  return kind.find((p) => assignable(p) && p.routes.length === 0) ?? kind.find(assignable) ?? null;
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
  const kind = inOrder(input.purpose, input.printers);

  if (kind.length === 0) {
    return { printer: null, rule: 'none', station: '', reason: `No ${input.purpose} printer is configured.` };
  }

  const claimants = kind.filter((p) => p.routes.some((r) => r.trim().toLowerCase() === key));
  // An enabled claimant beats a switched-off one; between two enabled claimants the lower
  // `machineId` wins. That second half is a TIE-BREAK, not a policy — see AMBIGUITY below.
  const claimed = claimants.find(assignable) ?? claimants[0] ?? null;
  const fallback = mainPrinter(input.purpose, input.printers);

  /**
   * AMBIGUITY, RECORDED RATHER THAN DECIDED (19-Sep-2026)
   *   Nothing in the design set says what two machines claiming one category MEANS — a primary
   *   and a backup, the same ticket on both, or alternating between them. The Routing screen
   *   avoids creating the state (it removes a category from its previous owner before granting
   *   it) but neither `upsertPrinter` nor the schema forbids it, so an API caller can.
   *   Until the product says otherwise the safe reading is "one ticket, one machine, the same
   *   machine every time", so the lowest `machineId` takes it and the duplicate is NAMED in the
   *   reason rather than silently absorbed. Duplicate printing is not invented here.
   */
  const contested = claimants.filter(assignable);
  const contest =
    contested.length > 1
      ? ` (also claimed by ${contested
          .filter((p) => p.id !== claimed?.id)
          .map((p) => p.name)
          .join(', ')} — lowest machine id takes it)`
      : '';

  if (claimed && assignable(claimed)) {
    return {
      printer: claimed,
      rule: 'routed',
      station: claimed.station,
      reason: `${input.category} → ${claimed.station} → ${claimed.name}${contest}`,
    };
  }

  if (!fallback) {
    return {
      printer: null,
      rule: 'none',
      station: claimed?.station ?? '',
      reason: `Every ${input.purpose} machine is switched off — nothing can be assigned.`,
    };
  }

  if (claimed) {
    return {
      printer: fallback,
      rule: 'fallback',
      // The station the ticket was MEANT for, not the one it came out at. A tandoor ticket on
      // the main kitchen machine has to say TANDOOR or the wrong cook picks it up.
      station: claimed.station,
      reason: `${claimed.name} is switched off — printing at ${fallback.name} marked ${claimed.station}`,
    };
  }

  return {
    printer: fallback,
    rule: 'unrouted',
    station: fallback.station,
    reason: `${input.category} is not routed to a station — printing at ${fallback.name}`,
  };
}

/**
 * The part of a machine's name a person actually says.
 *
 * "TVS RP 3160 Gold — Kitchen 1" is what the machine IS; "Kitchen 1" is what somebody shouts
 * across a kitchen, and it is what has to fit on a button next to a round. The model number is
 * the same on all four machines here, so a truncated full name distinguishes nothing at all.
 * Anything without a dash is already short enough and is returned untouched.
 */
/* ── Per-item routing (items 25, 26, 29, 30 - 25-Sep-2026) ──────────────────────────────── */

/**
 * What one line of a round carries about its own routing, over and above its category.
 *
 * `printerId` - the machine chosen for this dish (Add Item, or the Routing table).
 * `station`   - the station chosen for this dish (the Routing table's Station column).
 * Both null: the dish routes by its category exactly as before.
 *
 * On a `kot_item` these are the SNAPSHOT taken when the round was placed (`route_printer_id`,
 * `route_station`), so a reprint routes the line the way it was routed then.
 */
export interface ItemRoute {
  printerId: string | null;
  station: string | null;
}

const sameStation = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The machine and station for ONE line of a round.
 *
 *   1. A printer chosen for the dish - if it is switched off, the default machine prints it,
 *      still stamped with the station it was meant for (the `fallback` rule, unchanged).
 *   2. A station chosen for the dish - the first switched-on machine at that station; with none
 *      there, the category's machine prints it, stamped with the chosen station.
 *   3. Otherwise the category, exactly as `resolvePrinter` has always decided it.
 *   4. `defaultStation` (Settings, item 30) - only for a dish nothing routes: it goes to the
 *      machine at the default station instead of the main kitchen, and says that station. Passed
 *      only when a round is PLACED; the snapshot then carries the result, so a later change to the
 *      setting never re-routes a round already in the kitchen.
 */
export function routeItem(input: {
  category: string;
  route?: ItemRoute | null;
  printers: readonly RoutablePrinter[];
  defaultStation?: string;
}): RoutingDecision {
  const kind = inOrder('KOT', input.printers);
  const route = input.route ?? null;
  const byCategory = (): RoutingDecision =>
    resolvePrinter({ purpose: 'KOT', category: input.category, printers: input.printers });

  if (route?.printerId) {
    const chosen = kind.find((p) => p.id === route.printerId) ?? null;
    const station = (route.station ?? '').trim() || chosen?.station || '';
    if (chosen && assignable(chosen)) {
      return {
        printer: chosen,
        rule: 'routed',
        station,
        reason: `${input.category} (dish) → ${station} → ${chosen.name}`,
      };
    }
    const fallback = defaultPrinter(input.printers, input.defaultStation);
    if (fallback) {
      return {
        printer: fallback,
        rule: 'fallback',
        station,
        reason: `${chosen?.name ?? 'The chosen printer'} is ${chosen ? 'switched off' : 'gone'} — printing at ${fallback.name} marked ${station || fallback.station}`,
      };
    }
    return {
      printer: null,
      rule: 'none',
      station,
      reason: 'Every KOT machine is switched off — nothing can be assigned.',
    };
  }

  if (route?.station && route.station.trim()) {
    const station = route.station.trim();
    const there = kind.find((p) => assignable(p) && sameStation(p.station, station)) ?? null;
    if (there)
      return {
        printer: there,
        rule: 'routed',
        station,
        reason: `${input.category} (dish) → ${station} → ${there.name}`,
      };
    const d = byCategory();
    return d.printer
      ? {
          printer: d.printer,
          rule: 'fallback',
          station,
          reason: `No switched-on printer at ${station} — printing at ${d.printer.name} marked ${station}`,
        }
      : { ...d, station };
  }

  const d = byCategory();
  if (d.rule === 'unrouted' && input.defaultStation && input.defaultStation.trim()) {
    const station = input.defaultStation.trim();
    const there = kind.find((p) => assignable(p) && sameStation(p.station, station)) ?? d.printer;
    if (there) {
      return {
        printer: there,
        rule: 'unrouted',
        station,
        reason: `${input.category} is not routed — the default station, ${station}, at ${there.name}`,
      };
    }
  }
  return d;
}

/**
 * The printer a category with no choice of its own uses (item 29): the switched-on machine at
 * the default station when there is one, otherwise the main kitchen machine as before.
 */
export function defaultPrinter(
  printers: readonly RoutablePrinter[],
  defaultStation?: string
): RoutablePrinter | null {
  const kind = inOrder('KOT', printers);
  if (defaultStation && defaultStation.trim()) {
    const there = kind.find((p) => assignable(p) && sameStation(p.station, defaultStation));
    if (there) return there;
  }
  return mainPrinter('KOT', printers);
}

/**
 * The station names this restaurant uses (item 26): the defaults, the default station, and every
 * printer's own - one list for every Station picker, so a new name is offered everywhere at once.
 */
export function stationOptions(printers: ReadonlyArray<{ station: string }>, defaultStation?: string): string[] {
  const out: string[] = [];
  for (const s of ['Main Kitchen', 'Tandoor', 'Billing', defaultStation ?? '', ...printers.map((p) => p.station)]) {
    const t = (s ?? '').trim();
    if (t && !out.some((o) => sameStation(o, t))) out.push(t);
  }
  return out;
}

export function printerShortName(name: string): string {
  const parts = name.split(/\s[—–-]\s/);
  const last = parts[parts.length - 1]?.trim() ?? '';
  return last || name.trim();
}

/**
 * Which half of a round a ticket is, when the food-type split is on.
 *
 * ADDED 22-Sep-2026, AND WHY IT IS A VALUE RATHER THAN A DERIVATION
 *   This is the third segment of `splitRound`'s bucket key, and until now it existed only as a
 *   local variable inside that function. `queuePrint` persisted the other two segments and
 *   discarded this one, so two tickets for the same machine and station — a veg half and a
 *   non-veg half — became two database rows identical in every stored field. Nothing downstream
 *   could tell them apart, and a renderer that guessed would print the whole round twice.
 *
 *   `foodTypes` below is NOT this fact. It records which types LANDED in a bucket; this records
 *   which side the bucket IS. The two are interchangeable in the aggregate, which is exactly why
 *   the side has to be carried out of here rather than reconstructed.
 */
export type TicketSide = 'all' | 'veg_side' | 'non_veg';

/** One ticket: everything in a round that goes to one machine under one heading. */
export interface RoundTicket {
  printerId: string | null;
  printerName: string;
  station: string;
  rule: RoutingRule;
  reason: string;
  /** Which types landed here. A consequence of the split, not the key it was split on. */
  foodTypes: FoodType[];
  /**
   * Which side of the split this ticket is. `'all'` whenever the split is off — one side,
   * carrying everything. Required, not optional: a construction site that forgets it is a job
   * whose identity cannot be recovered, and the compiler is the cheapest place to catch that.
   */
  side: TicketSide;
  count: number;
}

/**
 * A whole round, split into the tickets that will actually come out of the machines.
 *
 * TWO SEPARATE DECISIONS, IN ORDER. Routing decides the MACHINE. The food-type split decides how
 * many tickets come out of it — one combined, or a veg ticket and a non-veg ticket so the two
 * sides of the kitchen never share paper. The design states them as separate controls and they
 * are computed in that order here, because reversing them produces a veg ticket at the tandoor
 * for a round with no veg in it.
 *
 * THIS IS THE PRODUCTION PATH as of 19-Sep-2026. It was written, tested and then not called:
 * `queuePrint` took `decisions[0]` and wrote one job for the whole round, so a round of chicken
 * tikka and butter chicken produced a single ticket at whichever station the first item happened
 * to resolve to, and the other station was told nothing. One bucket here is one `print_job`.
 */
export function splitRound(input: {
  /** `route` - the line's own routing snapshot (item 25/26); absent routes by category as before. */
  items: ReadonlyArray<{ category: string; foodType: FoodType; route?: ItemRoute | null }>;
  printers: readonly RoutablePrinter[];
  /** Print veg and non-veg as separate tickets. Egg travels with veg — one fryer, one side. */
  splitByFoodType: boolean;
}): RoundTicket[] {
  const buckets = new Map<string, RoundTicket>();

  input.items.forEach((item) => {
    const decision = routeItem({ category: item.category, route: item.route ?? null, printers: input.printers });
    // ONE expression, used for both the key and the ticket. They were the same value before
    // 22-Sep-2026 too — but only one of them escaped this function, and the other was the one
    // the database needed. Naming it once is what stops them ever disagreeing.
    const side: TicketSide =
      input.splitByFoodType && item.foodType === 'non_veg' ? 'non_veg' : input.splitByFoodType ? 'veg_side' : 'all';
    const key = `${decision.printer?.id ?? 'none'}|${decision.station}|${side}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.foodTypes.includes(item.foodType)) existing.foodTypes.push(item.foodType);
      return;
    }
    buckets.set(key, {
      printerId: decision.printer?.id ?? null,
      printerName: decision.printer?.name ?? '',
      station: decision.station,
      rule: decision.rule,
      reason: decision.reason,
      foodTypes: [item.foodType],
      side,
      count: 1,
    });
  });

  // Insertion order is the order the guest added items, which is not a property of the ROUND —
  // the same two dishes added the other way round would write the same two jobs in the other
  // order, and "which job is job one" would depend on typing speed. Sorted, it does not.
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, t]) => t);
}
