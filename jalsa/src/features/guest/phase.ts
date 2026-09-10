import type { GuestPayload } from '@/lib/db/guest-view';

/**
 * The guest journey's phase, and the ONE rule for reconciling it with the server.
 *
 * It lives in its own module, with no React and no imports beyond a type, for one reason: it is
 * the rule that decides whether a guest halfway through choosing a tip gets yanked back to their
 * order list by a poll. That is a behaviour worth a test, and a test worth having is a test that
 * does not need a browser to run.
 */
export type Phase =
  'welcome' | 'menu' | 'cart' | 'placed' | 'status' | 'upsell' | 'tip' | 'paying' | 'failed' | 'paid' | 'invoice';

/**
 * The steps that belong to the PHONE rather than to the bill.
 *
 * A guest choosing a dish, reviewing a cart, or working through the closure steps is mid-decision
 * on their own device; the server has no opinion about which of those they are on. Everything
 * else follows the bill, because the bill is the thing several people can change at once.
 */
const PHONE_OWNED: readonly Phase[] = ['menu', 'cart', 'upsell', 'tip', 'paying', 'failed', 'invoice'];

/** The minimum a reconciliation needs to know. Keeps the rule testable without a whole payload. */
export interface PhaseFacts {
  phase: GuestPayload['phase'];
  billStatus: GuestPayload['billStatus'];
  roundCount: number;
}

export function reconcilePhase(current: Phase, facts: PhaseFacts): Phase {
  // A settled bill wins over everything except the guest actually reading their itemised bill.
  if (facts.phase === 'recently_paid' || facts.billStatus === 'closed') {
    return current === 'invoice' ? 'invoice' : 'paid';
  }
  if (PHONE_OWNED.includes(current)) return current;
  if (facts.roundCount > 0) return current === 'placed' ? 'placed' : 'status';
  return 'welcome';
}

/** Where a phone lands when the page is first opened. */
export function startingPhase(facts: PhaseFacts): Phase {
  if (facts.phase === 'recently_paid' || facts.billStatus === 'closed') return 'paid';
  return facts.roundCount > 0 ? 'status' : 'welcome';
}

export function factsOf(data: GuestPayload): PhaseFacts {
  return { phase: data.phase, billStatus: data.billStatus, roundCount: data.rounds.length };
}
