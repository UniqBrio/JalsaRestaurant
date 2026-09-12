/**
 * stale-notice — when a screen is allowed to tell someone it has stopped keeping up.
 *
 * WHY THERE IS A THRESHOLD AT ALL
 *   Every guest screen re-reads every six seconds, from a phone, in a restaurant. A cold
 *   serverless function, a lift, a thick wall — one of those reads fails now and then and
 *   nothing is wrong: the screen is correct, the order is safe, and the next tick is six seconds
 *   away. Saying so on the FIRST failure is what produced "sometimes, something went wrong error
 *   appears" (12-Sep-2026) on a screen that was showing exactly the right menu and the right
 *   total underneath the alarm.
 *
 * WHY THE ANSWER IS NOT TO REMOVE THE BANNER
 *   It earns its place when the screen really has stopped tracking the kitchen. A guest watching
 *   a stale "Preparing" while their food sits ready is a worse failure than any banner. So the
 *   rule changes, not the feature: two consecutive failures before anything is said, and any
 *   success resets it at once.
 */

export const STALE_AFTER_CONSECUTIVE_FAILURES = 2;

/**
 * The line to show, or null for "say nothing yet".
 *
 * The sentence is the restaurant's, not the runtime's. "Something went wrong. Please try again."
 * is the error taxonomy's generic fallback — it names nothing and asks a guest to retry something
 * they did not do, about a problem they cannot fix.
 */
export function staleNotice(consecutiveFailures: number): string | null {
  if (consecutiveFailures < STALE_AFTER_CONSECUTIVE_FAILURES) return null;
  return 'This screen is having trouble keeping up.';
}
