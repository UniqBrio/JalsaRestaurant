import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { billForSession, currentGuestSession } from '@/lib/db/guest';
import { addTip, audit, GUEST_ACTOR, requestPayment } from '@/lib/db/mutations';
import { db } from '@/lib/supabase/server';
import { billTotals } from '@/lib/db/queries';
import { rupees } from '@/lib/money';

type Action = 'request-payment' | 'tip' | 'pay' | 'occasion';

/**
 * The guest's half of closure — and it is only ever a half.
 *
 * THE RULE THIS ROUTE EXISTS TO HOLD
 *   There is no `close` action here, and there never will be. A guest can ask for the bill, add
 *   a tip, and tell us a payment attempt succeeded or failed. Recording the closure is a named
 *   member of staff's action, on the staff surface, and the database refuses a closed bill
 *   without one.
 *
 * `pay` IS A REPORT, NOT A DECISION
 *   No payment provider is chosen yet (Product Plan §8). The pay step is a single swappable
 *   stage with its own states, so what this route does today is record the attempt against the
 *   bill and leave it open. When a provider arrives, its webhook replaces this body and nothing
 *   above it changes — which is precisely why the flow was designed independent of the vendor.
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const session = await currentGuestSession();
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'Scan the code on your table again — this phone is not attached to a table right now.',
    });
  }

  const input = await body<{
    action?: Action;
    amount?: number;
    outcome?: 'succeeded' | 'failed';
    type?: string;
    name?: string;
  }>(req);
  const bill = await billForSession(session.id);

  if (!bill) {
    return fail(409, {
      code: 'conflict',
      message: 'There is no open bill on this table yet. Order something first.',
    });
  }
  if (bill.status === 'closed') {
    return fail(409, {
      code: 'conflict',
      message: 'This bill has already been settled. If that is a surprise, your captain can show you the receipt.',
    });
  }

  switch (input.action) {
    case 'request-payment': {
      await requestPayment(bill.id);
      return ok({ status: 'payment_requested' });
    }

    case 'tip': {
      const amount = Math.max(0, Math.floor(input.amount ?? 0));
      // The tip is attributed to the CAPTAIN on the bill, so the ledger has an owner even when
      // several people served the table. Standard 7.3: it is their money, tracked apart.
      await addTip({ billId: bill.id, amount, staffId: bill.captainId });
      return ok({ tip: amount });
    }

    case 'pay': {
      const totals = billTotals(bill);
      if (input.outcome === 'failed') {
        await audit({
          action: 'Payment attempt',
          detail: `Failed — nothing charged, ${bill.code} still open at ${rupees(totals.payable)}`,
          actor: GUEST_ACTOR,
          billId: bill.id,
        });
        return ok({ outcome: 'failed', payable: totals.payable });
      }
      await audit({
        action: 'Payment attempt',
        detail: `Reported as paid by the guest — ${rupees(totals.payable)} awaiting staff confirmation`,
        actor: GUEST_ACTOR,
        billId: bill.id,
      });
      // Still open. The guest's phone saying "paid" is evidence, not a closure.
      return ok({ outcome: 'reported', payable: totals.payable });
    }

    case 'occasion': {
      await db()
        .from('bill')
        .update({
          occasion_type: (input.type ?? '').slice(0, 60),
          occasion_name: (input.name ?? '').slice(0, 80),
          occasion_source: 'the guest, on their phone',
        })
        .eq('id', bill.id);
      await audit({
        action: 'Occasion',
        detail: `${input.type ?? 'Celebration'}${input.name ? ` for ${input.name}` : ''} — nothing added to the bill`,
        actor: GUEST_ACTOR,
        billId: bill.id,
      });
      return ok({ done: true });
    }

    default:
      return fail(400, { code: 'validation', message: 'That is not something this screen can do.' });
  }
});
