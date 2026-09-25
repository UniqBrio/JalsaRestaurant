import { effectiveTemplate } from './invoice';
import { resolvePrinter, splitRound, type RoutablePrinter, type TicketSide } from './print-routing';
import {
  buildTicket,
  type FontSize,
  type PaperWidth,
  type TemplateConfig,
  type TicketData,
  type TicketItem,
  type TicketKind,
  type TicketLine,
} from './print-template';
import type { FoodType } from './status';

/**
 * ticket-compose — a print job turned into the exact lines that belong on its paper.
 *
 * WHY THIS EXISTS AT ALL
 *   `buildTicket` had exactly ONE caller in this repository before Gate 4: the owner's Print
 *   Setup preview, over a hand-written `sample: TicketData`. Nothing anywhere composed a real
 *   ticket from a real round. The template was a thing the restaurant could configure and could
 *   not print. This module is the missing half.
 *
 * WHAT IT IS AND IS NOT ALLOWED TO DECIDE
 *   It decides NOTHING about destination. The job already carries `printer_id` and `station`, and
 *   those are immutable in the database. This module uses them ONLY to work out which items of a
 *   round belong on this particular ticket, and refuses rather than guesses when it cannot.
 *
 * PURE ON PURPOSE
 *   No database, no clock, no `server-only`. Every fact — the date string, the table name, the
 *   restaurant's own header — arrives as an argument. That is what makes "the same round always
 *   composes the same lines, and therefore the same bytes" a thing a test can assert, and it is
 *   what lets the whole composition run in the unit tier, which is the tier that always executes.
 *
 * WHY IT CAN REFUSE
 *   See `BLOCKED_AMBIGUOUS` below. A ticket composed from the wrong half of a round is not a
 *   near miss — it is a second identical ticket in a kitchen, and somebody cooks the round twice.
 *   Binding rule 4: a step that cannot say what it did is BLOCKED, never a pass.
 */

/** One line of a round, as composition needs it. Every field is a snapshot off `kot_item`. */
export interface ComposeItem {
  name: string;
  qty: number;
  foodType: FoodType;
  /** Whole rupees. Zero on a KOT, which carries no money. */
  rate: number;
  /** `kot_item.menu_category_name` — the routing input, snapshotted. */
  category: string;
  instruction: string;
}

/**
 * The job's own immutable facts. Nothing here is recomputed; it is read off the row.
 *
 * For a REDIRECTED job these are the ORIGIN's identity, not the redirect's — see
 * `bridge-payload.ts`. Redirecting a ticket changes where it prints, never what is on it.
 */
export interface ComposeJob {
  id: string;
  kind: TicketKind;
  printerId: string | null;
  station: string;
  /**
   * Which half of the round this ticket is (`print_job.food_side`, added 22-Sep-2026).
   * `'all'` means one side carrying everything, which is every job written while the food-type
   * split is off and every row that predates the column.
   */
  foodSide: TicketSide;
  isReprint: boolean;
}

export interface ComposeInput {
  job: ComposeJob;
  /** The paper the ASSIGNED machine actually holds, not a default. */
  width: PaperWidth;
  /** The owner's saved template for this kind, as a partial over `defaultTemplate`. */
  template: Partial<TemplateConfig>;
  /** Every machine of this job's purpose, so the round can be split the way it was split. */
  printers: readonly RoutablePrinter[];
  splitByFoodType: boolean;
  /**
   * Header facts. Strings, already formatted — this module owns no locale and no clock.
   *
   * `station` is DELIBERATELY NOT among them. It is not a header fact a caller supplies; it is
   * the job's own routing destination, and it is read from `job.station` below. Leaving it out
   * of this type means a caller cannot pass the printing machine's station by mistake, which is
   * the one wrong value that looks entirely plausible.
   */
  header: Omit<TicketData, 'items' | 'totals' | 'upiId' | 'station'>;
  items: readonly ComposeItem[];
  totals?: TicketData['totals'];
  upiId?: string;
}

export interface ComposeOk {
  ok: true;
  lines: TicketLine[];
  width: PaperWidth;
  /** How many of the round's lines ended up on this ticket. For the log, never for a decision. */
  itemCount: number;
  /** The font the lines were laid out in - the printer has to be told (item 7). */
  font: FontSize;
}

export interface ComposeBlocked {
  ok: false;
  /** One sentence, plain enough to reach `print_job.last_error` and be read by a person. */
  blocked: string;
}

export type ComposeResult = ComposeOk | ComposeBlocked;

/**
 * THE AMBIGUITY THAT SURVIVED THE FIX, AND WHY IT MUST
 *
 *   `print_job.food_side` (22-Sep-2026) records which half of a round a ticket is, so the two
 *   halves of a split round are now distinguishable and both print. That column has a DEFAULT of
 *   'all', which is correct for every row written while the split is off — and is exactly as
 *   uninformative as before for a row written while the split was ON and BEFORE the migration.
 *
 *   Those legacy rows still collide: two siblings, both 'all', for one machine and station, with
 *   nothing to say which half either is. Backfilling them would mean guessing, and the guess
 *   prints the whole round twice at one machine.
 *
 *   So they are refused, exactly as they were, and the refusal names what it actually is now: an
 *   old row, not a design gap. Binding rule 4: a step that cannot say what it did is BLOCKED.
 */
const BLOCKED_AMBIGUOUS =
  'This round was split into two tickets for the same machine and station (veg / non-veg), and this job predates the column that records which half it is. Printing either one could duplicate the round, so nothing was sent. Re-send the round to get a ticket that knows its own half.';

/**
 * Which bucket a single item lands in.
 *
 * DUPLICATED FROM `splitRound`, DELIBERATELY AND UNDER GUARD. `splitRound` returns aggregate
 * tickets — counts and food types — not the item lists behind them, and it is a Phase 1 contract
 * this gate may not widen. So the key is restated here, and
 * `tests/unit/ticket-compose.unit.spec.ts` asserts over a table of rounds that the buckets
 * produced by this function are exactly the buckets `splitRound` produces. The day that key
 * changes, the rung goes red rather than the kitchen getting the wrong paper.
 */
function bucketKeyOf(
  item: { category: string; foodType: FoodType },
  printers: readonly RoutablePrinter[],
  splitByFoodType: boolean
): string {
  const decision = resolvePrinter({ purpose: 'KOT', category: item.category, printers });
  const side = splitByFoodType && item.foodType === 'non_veg' ? 'non_veg' : 'veg_side';
  return `${decision.printer?.id ?? 'none'}|${decision.station}|${splitByFoodType ? side : 'all'}`;
}

/** The machine-and-station part of a bucket key, used only to explain a failure to match. */
const keyRowOf = (key: string): string => key.split('|').slice(0, 2).join('|');

/**
 * The items of this round that belong on THIS job's paper.
 *
 * A bill is not split at all — one machine takes every invoice — so it returns the round whole.
 */
function itemsForJob(input: ComposeInput): { items: readonly ComposeItem[] } | { blocked: string } {
  if (input.job.kind === 'bill') return { items: input.items };

  if (!input.job.printerId) {
    return {
      blocked: 'This job was never assigned to a machine, so there is nothing to compose a ticket for.',
    };
  }

  // The job's WHOLE identity, all three segments of the bucket key it was created from. Matching
  // on two of them is what let a redirect compose the wrong half of a round.
  const wanted = `${input.job.printerId}|${input.job.station}|${input.job.foodSide}`;
  const rowKey = `${input.job.printerId}|${input.job.station}`;

  const keyed = input.items.map((item) => ({
    item,
    key: bucketKeyOf(item, input.printers, input.splitByFoodType),
  }));

  const exact = keyed.filter((k) => k.key === wanted);
  // A full key identifies one bucket, so a match is unique by construction. There is no longer a
  // "which of these two did they mean" case to decide — the row says which.
  if (exact.length > 0) return { items: exact.map((k) => k.item) };

  const sameMachine = keyed.filter((k) => keyRowOf(k.key) === rowKey);

  if (sameMachine.length === 0) {
    // The assignment stands and the round no longer resolves to it — a category was re-routed, or
    // the machine was switched off, between the order and now. Refusing is the honest answer: the
    // job's machine is fixed forever and this module cannot know what was meant for it.
    return {
      blocked: `Nothing in this round still routes to ${input.job.station}. The routing configuration changed after this ticket was assigned, so its contents cannot be reconstructed.`,
    };
  }

  // The machine is right and the half is not. Two ways that happens, and they read differently to
  // the person holding the failed job.
  if (input.splitByFoodType && input.job.foodSide === 'all') {
    // A row written before the column existed, while the split was on. See above.
    if (new Set(sameMachine.map((k) => k.key)).size > 1) return { blocked: BLOCKED_AMBIGUOUS };
  }

  return {
    blocked: `This ticket is the ${sideInWords(input.job.foodSide)} of a round that no longer has one at ${input.job.station}. The veg/non-veg split setting changed after the ticket was assigned, so its contents cannot be reconstructed.`,
  };
}

const sideInWords = (side: TicketSide): string =>
  side === 'non_veg' ? 'non-veg half' : side === 'veg_side' ? 'veg half' : 'whole round';

const asTicketItem = (i: ComposeItem): TicketItem => ({
  name: i.name,
  qty: i.qty,
  foodType: i.foodType,
  rate: i.rate,
  category: i.category,
  instruction: i.instruction,
});

/**
 * The job, as lines.
 *
 * The width comes from the ASSIGNED machine and overrides whatever the saved template says. The
 * template is one configuration shared by every machine of a kind; the paper is a property of the
 * one in the corner, and a 58 mm roll fed 80 mm of layout loses the right-hand column silently.
 */
export function composeTicket(input: ComposeInput): ComposeResult {
  const chosen = itemsForJob(input);
  if ('blocked' in chosen) return { ok: false, blocked: chosen.blocked };

  // The one merge, shared with every preview (`invoice.ts`), so a preview cannot be laid out at a
  // width the paper does not have.
  const config: TemplateConfig = effectiveTemplate(input.job.kind, input.width, input.template);

  const data: TicketData = {
    ...input.header,
    // THE JOB'S STATION, NOT THE MACHINE'S (22-Sep-2026). `input.job.station` is the station the
    // round was routed TO; a fallback or a redirect prints it somewhere else entirely, and the
    // ticket has to say where the food belongs rather than where the paper came out.
    station: input.job.station,
    items: chosen.items.map(asTicketItem),
    ...(input.totals ? { totals: input.totals } : {}),
    ...(input.upiId ? { upiId: input.upiId } : {}),
  };

  return {
    ok: true,
    lines: buildTicket(input.job.kind, data, config, { reprint: input.job.isReprint }),
    width: input.width,
    itemCount: chosen.items.length,
    font: config.font,
  };
}

/**
 * Exported for the equivalence rung only.
 *
 * It exists so the spec can prove this module's buckets ARE `splitRound`'s buckets, rather than
 * asserting it in a comment. Nothing in the application calls it.
 */
export const __keyedItems = (
  items: readonly ComposeItem[],
  printers: readonly RoutablePrinter[],
  splitByFoodType: boolean
): Array<{ key: string; side: string; item: ComposeItem }> =>
  items.map((item) => {
    const key = bucketKeyOf(item, printers, splitByFoodType);
    return { key, side: key.split('|')[2] ?? '', item };
  });

export const __bucketsFor = (
  items: readonly ComposeItem[],
  printers: readonly RoutablePrinter[],
  splitByFoodType: boolean
): string[] => [...new Set(items.map((i) => bucketKeyOf(i, printers, splitByFoodType)))].sort();

export const __splitBuckets = splitRound;
