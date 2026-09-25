import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { actorFor, currentStaff, type SignedInStaff } from '@/lib/db/auth';
import { withState } from '@/lib/db/action-echo';
import { buildStaffPayload } from '@/lib/db/staff-view';
import {
  advanceKot,
  cancelItem,
  changeQty,
  closeBill,
  completeRequest,
  ensureOpenBill,
  freeTable,
  clearTable,
  joinTableToBill,
  placeRound,
  reprintKot,
  retryPrintJob,
  setItemAvailability,
} from '@/lib/db/mutations';
import { getBill } from '@/lib/db/queries';
import type { KotStatus } from '@/lib/status';

/**
 * Everything a captain or waiter DOES, behind one door.
 *
 * WHY ONE ROUTE AND A DISCRIMINATED ACTION
 *   Nine verbs, one identity check, one permission model, one audit obligation. Split across nine
 *   files, the ninth is the one that forgets to re-read the session, and nothing about it looks
 *   wrong. Here, `currentStaff()` happens once and there is no path past it.
 *
 * WHY EVERY VERB RE-CHECKS ITS PERMISSION IN THE MUTATION LAYER, NOT HERE
 *   The screen hides an action it cannot honour; this route hands it to `mutations`, which
 *   refuses it. Two independent checks, and only the second one is a boundary. If they ever
 *   disagree, the strict one wins — which is the safe direction to be wrong in.
 */

type Action =
  | {
      action: 'add-round';
      tableId: string;
      billId?: string;
      lines: Array<{ menuItemId: string; qty: number }>;
      note?: string;
    }
  | { action: 'change-qty'; kotItemId: string; qty: number }
  | { action: 'cancel-item'; kotItemId: string; reason: string }
  | { action: 'advance-kot'; kotId: string; to: KotStatus }
  | { action: 'reprint'; kotId: string }
  | { action: 'retry-print'; jobId: string }
  | { action: 'complete-request'; requestId: string }
  | {
      action: 'close-bill';
      billId: string;
      mode: string;
      reference?: string;
      /* ONE discount, two views. The screen sends which box was typed and its value; the
         other figure is derived on the server, so the two can never disagree and the
         discount can never be taken twice. */
      discountType?: 'percentage' | 'amount';
      discountValue?: number;
    }
  | { action: 'join-table'; billId: string; tableId: string }
  | { action: 'free-table'; tableId: string }
  | { action: 'clear-table'; tableId: string }
  | { action: 'set-availability'; itemId: string; available: boolean; reason?: string };

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN before doing that.' });
  }
  // The answer carries the captain's screen as it now stands, so the phone does not have to ask
  // for it in a second request (`action-echo.ts`). A staff action cannot change the actor's own
  // grants, so the identity read at the top of this request is still the right one to build with.
  return withState(await perform(staff, await body<Action>(req)), () => buildStaffPayload(staff));
});

async function perform(staff: SignedInStaff, input: Action): Promise<NextResponse> {
  const actor = actorFor(staff);

  switch (input.action) {
    case 'add-round': {
      const bill = input.billId ? await getBill(input.billId) : await ensureOpenBill(input.tableId);
      if (!bill) return fail(404, { code: 'not-found', message: 'That bill is no longer open.' });
      const result = await placeRound({
        billId: bill.id,
        tableId: input.tableId,
        lines: input.lines,
        source: 'captain',
        actor,
        ...(input.note ? { note: input.note } : {}),
      });
      if (!result.kotId) {
        return fail(409, {
          code: 'conflict',
          message: `Nothing was sent — ${result.refused.join(', ')} ${result.refused.length === 1 ? 'is' : 'are'} off the menu.`,
        });
      }
      /* The bill id, because this call may have CREATED it: a round placed on a free table opens
         its bill through `ensureOpenBill`, and without this the screen has nothing to open next
         and has to wait for the poll to notice. */
      return ok({ kotCode: result.kotCode, refused: result.refused, billId: bill.id });
    }

    case 'change-qty':
      await changeQty({ kotItemId: input.kotItemId, qty: input.qty, actor });
      return ok({ done: true });

    case 'cancel-item': {
      const result = await cancelItem({ kotItemId: input.kotItemId, reason: input.reason, actor });
      // An escalation is a SUCCESS with a different outcome, not a 403. The captain did exactly
      // the right thing; the answer is simply the owner's to give.
      return ok(result);
    }

    case 'advance-kot':
      await advanceKot({ kotId: input.kotId, to: input.to, actor });
      return ok({ done: true });

    case 'reprint':
      await reprintKot({ kotId: input.kotId, actor });
      return ok({ done: true });

    // A captain standing in the room is the person who finds out a ticket did not come out, so
    // the retry belongs on their phone and not only in the owner's console. It re-sends the job
    // to the machine it was already assigned to — the same grant as a reprint, because it is the
    // same authority over the same paper.
    case 'retry-print':
      return ok(await retryPrintJob({ jobId: input.jobId, actor }));

    case 'complete-request':
      await completeRequest({ requestId: input.requestId, actor });
      return ok({ done: true });

    case 'close-bill': {
      const result = await closeBill({
        billId: input.billId,
        mode: input.mode,
        ...(input.reference ? { reference: input.reference } : {}),
        ...(input.discountType && input.discountValue
          ? { discountType: input.discountType, discountValue: input.discountValue }
          : {}),
        actor,
      });
      return ok(result);
    }

    case 'join-table':
      await joinTableToBill({ billId: input.billId, tableId: input.tableId, actor });
      return ok({ done: true });

    case 'free-table':
      // Guarded in freeTable, not here: the permission and the "nothing with the kitchen" rule
      // are properties of the operation, and a second copy at a second entry point is how the
      // two eventually disagree.
      await freeTable({ tableId: input.tableId, actor });
      return ok({ done: true });

    case 'clear-table':
      await clearTable({ tableId: input.tableId, actor });
      return ok({ done: true });

    case 'set-availability':
      await setItemAvailability({
        itemId: input.itemId,
        available: input.available,
        ...(input.reason ? { reason: input.reason } : {}),
        actor,
      });
      return ok({ done: true });

    default:
      return fail(400, { code: 'validation', message: 'That is not something this screen can do.' });
  }
}
