import type { TicketSide } from './print-routing';

/**
 * redirect-lineage — which job's identity decides a redirected ticket's contents.
 *
 * WHY THIS IS ITS OWN MODULE
 *   It was written inside `bridge-payload.ts`, which imports `server-only` and therefore cannot
 *   be executed by any test in this repository. A depth cap nothing runs is a comment about a
 *   depth cap. `bridge-token.ts` set the precedent at Gate 1: the pure half comes out, the
 *   database half stays in, and the rule becomes something a rung can drive.
 *
 * WHAT IT IS FOR
 *   "Print elsewhere" inserts a NEW job against a machine a person chose, carrying THAT machine's
 *   station. Composed from its own identity it matched whichever half of the round the chosen
 *   machine happens to claim — so a tandoor round redirected to the main kitchen composed the
 *   main kitchen's dishes, printed them a second time, and never delivered the tandoor's.
 *
 *   Redirecting a ticket changes WHERE it prints. It does not change WHAT is on it. This walk
 *   follows the lineage to its root and hands back the job whose identity the contents come from.
 */

export interface LineageJob {
  id: string;
  /** Null for a job nobody redirected — which is almost all of them. */
  redirectedFromJobId: string | null;
  printerId: string | null;
  station: string;
  foodSide: TicketSide;
}

/**
 * How far a chain may be followed.
 *
 * A bound, not a guess about how many times a restaurant might redirect one ticket. A cycle in
 * the lineage would otherwise be an infinite loop on a request path, and an unbounded walk is an
 * unbounded number of database round trips. Eight is far beyond any plausible evening.
 */
export const MAX_REDIRECT_DEPTH = 8;

export type LineageResult =
  | { ok: true; origin: LineageJob; depth: number }
  | { ok: false; blocked: string };

/**
 * The job whose identity decides this ticket's contents.
 *
 * For an ordinary job that is the job itself, with no reads at all. For a redirect it is the root
 * of the chain — the ticket somebody first tried to print.
 *
 * EXCEEDING THE CAP IS BLOCKED, NEVER A STOP AT THE EIGHTH. A partial walk would compose from
 * whichever job the walk happened to halt on, which is the wrong-half defect this exists to fix,
 * arriving by a different road.
 */
export async function originOf(
  job: LineageJob,
  read: (id: string) => Promise<LineageJob | null>
): Promise<LineageResult> {
  let current = job;

  for (let depth = 0; depth <= MAX_REDIRECT_DEPTH; depth += 1) {
    if (!current.redirectedFromJobId) return { ok: true, origin: current, depth };

    const next = await read(current.redirectedFromJobId);
    // `print_job` is never hard-deleted, so an origin that cannot be read is a real anomaly
    // rather than an ordinary absence. Refusing beats composing from the redirect's own identity.
    if (!next) {
      return {
        ok: false,
        blocked:
          'The ticket this one was redirected from can no longer be read, so its contents cannot be reconstructed.',
      };
    }
    current = next;
  }

  return {
    ok: false,
    blocked: `This ticket has been redirected more than ${MAX_REDIRECT_DEPTH} times, or its lineage points in a circle. Nothing was sent.`,
  };
}
