import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { authenticateBridge, touchBridge } from '@/lib/bridge-auth';
import { claimPrintJob, listBridgeJobs, reportPrintJob } from '@/lib/db/bridge-mutations';
import { ticketPayloadFor } from '@/lib/db/bridge-payload';

/**
 * The whole of what a print bridge can reach.
 *
 * THREE VERBS, ONE DOOR
 *   `list`, `claim`, `report`. A bridge cannot read a bill, a guest, a menu or a staff record,
 *   because no route it can authenticate against does those things. That is the boundary, and it
 *   is enforced by there being nothing else here rather than by a permission string somebody has
 *   to remember to check.
 *
 * WHY THE BRIDGE DOES NOT SPEAK TO SUPABASE
 *   Guardrail 3: one enforcement point for the permission matrix, in TypeScript, next to the
 *   matrix. Two would eventually disagree, and the disagreement would be discovered by a guest.
 *   A bridge issuing its own SQL from a kitchen PC would be that second point — with its own copy
 *   of the job lifecycle, on a machine nobody reviews.
 *
 * WHAT `claim` HANDS BACK (Gate 4)
 *   The job AND its rendered `TicketLine[]`. Still three verbs: the ticket is part of the answer
 *   to "I am taking this job", not a fourth capability. `list` stays metadata-only on purpose -
 *   it is polled by every bridge in the building every few seconds, and rendering every waiting
 *   ticket on every poll would compose most of them repeatedly and print none of them.
 *
 * NOTE WHAT `report` DOES NOT ACCEPT. Its input carries an outcome and an error string. There is
 * no printer field anywhere in this file, so the most a compromised or buggy bridge can say is
 * "this job succeeded" or "this job failed" about a job it already holds. Rerouting is not
 * something it can express.
 */

type BridgeRequest =
  | { action: 'list'; machineIds: string[]; limit?: number }
  | { action: 'claim'; jobId: string }
  /* No printerId. No printer. No station. Deliberately — see the note above. */
  | { action: 'report'; jobId: string; outcome: 'printed' | 'failed'; error?: string };

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const bridge = await authenticateBridge(req);
  if (!bridge) {
    // One message for a missing token, a malformed header, an unknown token and a revoked one.
    // Distinguishing them tells an attacker which half of the guess was right.
    return fail(401, { code: 'unauthorized', message: 'This endpoint requires a bridge token.' });
  }

  const input = await body<BridgeRequest>(req);
  await touchBridge(bridge.id);

  switch (input.action) {
    case 'list': {
      const machineIds = Array.isArray(input.machineIds) ? input.machineIds.filter((m) => typeof m === 'string') : [];
      // `exactOptionalPropertyTypes` is on: an absent limit is absent, not `undefined`.
      const limit = typeof input.limit === 'number' ? { limit: input.limit } : {};
      return ok({ jobs: await listBridgeJobs({ bridge, machineIds, ...limit }) });
    }

    case 'claim': {
      const job = await claimPrintJob({ bridge, jobId: input.jobId });
      // Not an error: losing a race is the ordinary outcome of two bridges polling one queue, and
      // a 4xx here would fill a kitchen PC's log with alarms about the system working correctly.
      if (!job) return ok({ claimed: false, job: null, payload: null, renderError: null });

      // THE TICKET ITSELF, RENDERED HERE AND NOWHERE ELSE (Gate 4).
      //   The bridge receives `TicketLine[]` - the same array the owner's template preview
      //   produces and the same array `escpos.ts` consumes. Not bytes, which would move the
      //   encoder onto a kitchen PC and make the golden-byte tests a claim about a machine
      //   nobody can inspect; and not order data, which would hand a bridge the bill, the guest
      //   and the menu in order to render one ticket.
      //
      //   A render that cannot be done is NOT an error status. The job is already claimed, so
      //   the bridge must be told enough to report it failed through the ordinary path -
      //   otherwise it sits in `processing` until the sweeper, and the reason nobody could
      //   render it is never written down anywhere a person looks.
      const rendered = await ticketPayloadFor({ bridge, jobId: job.id });
      return rendered.ok
        ? ok({ claimed: true, job, payload: rendered.payload, renderError: null })
        : ok({ claimed: true, job, payload: null, renderError: rendered.blocked });
    }

    case 'report': {
      if (input.outcome !== 'printed' && input.outcome !== 'failed') {
        return fail(400, { code: 'bad_outcome', message: 'Outcome must be "printed" or "failed".' });
      }
      const reason = typeof input.error === 'string' ? { error: input.error } : {};
      const { applied } = await reportPrintJob({
        bridge,
        jobId: input.jobId,
        outcome: input.outcome,
        ...reason,
      });
      if (!applied) {
        // The job is not in `processing`, or another bridge holds it. Either way this bridge has
        // nothing to report on, and saying so is what stops a late report overwriting a verdict
        // the sweeper already reached.
        return fail(409, {
          code: 'not_claimed',
          message: 'That job is not currently claimed by this bridge.',
        });
      }
      return ok({ applied: true });
    }

    default:
      return fail(400, { code: 'bad_action', message: 'Unknown bridge action.' });
  }
});
