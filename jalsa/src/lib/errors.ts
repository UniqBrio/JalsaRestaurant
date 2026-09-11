/**
 * errors - the thin, impure facade over the pure taxonomy.
 *
 * ONE decision per catch site, and the ONLY place a side effect is allowed to happen.
 *
 * BINDING RULES (they exist because their violations are the classic session bugs):
 *   1. Never sign the user out from an error handler. Sign-out is an explicit user action.
 *      An expired token routes to the re-auth boundary IN PLACE, preserving the screen and
 *      any unsaved input.
 *   2. Never reload the page from an error handler except through the guarded stale-build path,
 *      which requires a CONFIRMED version mismatch and a loop guard. An ungated reload on a
 *      transient failure loops forever on a blank screen.
 *   3. Never refresh credentials on `forbidden`. A refresh cannot grant a permission, so the
 *      only outcome is an infinite refresh loop against a policy denial.
 */
import { classifyError, userMessageFor, type ErrorClass } from './errors.taxonomy';
import { logError } from './logger';

export const SESSION_DEAD_EVENT = 'app:session-dead';

export interface HandledError {
  cls: ErrorClass;
  /** The sentence to show, or null when the recovery UI is the message. */
  message: string | null;
  /** True when a re-auth boundary should take over the current screen. */
  requiresReauth: boolean;
}

export function handleError(err: unknown, context: string, fallback?: string): HandledError {
  const cls = classifyError(err);

  // The engineer's copy of the truth, always, before any user-facing translation.
  logError(context, err, { cls });

  const requiresReauth = cls === 'session-dead' || cls === 'unauthenticated';
  if (requiresReauth && typeof window !== 'undefined') {
    // Dispatch, do not navigate. The boundary decides how to recover, in place.
    window.dispatchEvent(new CustomEvent(SESSION_DEAD_EVENT, { detail: { cls, context } }));
  }

  return { cls, message: userMessageFor(cls, fallback), requiresReauth };
}

export { classifyError, userMessageFor } from './errors.taxonomy';
export type { ErrorClass } from './errors.taxonomy';
