/**
 * errors.taxonomy - PURE error classification. No DOM, no framework, no I/O, no side effects.
 *
 * WHY THE SPLIT
 *   Classification is the part with all the branches and therefore all the bugs, and it is the
 *   part that is trivially unit-testable IF it imports nothing. Keeping the side effect (see
 *   errors.ts) in a separate file means the taxonomy can be exercised exhaustively in a plain
 *   test runner, with no browser and no mocks.
 *
 * WHY A TAXONOMY AT ALL
 *   Without one, every catch site invents its own handling, and the same backend condition
 *   produces a different user experience on every screen. The classes below are chosen by what
 *   the USER and the APP must do about them, not by where the error came from:
 *
 *     forbidden     A valid identity lacking permission. Retrying and refreshing cannot help.
 *                   Show an honest no-access state. Never re-authenticate on this.
 *     unauthenticated  Credentials are missing or expired but recoverable.
 *     session-dead  Recovery is impossible. Hand to the re-auth boundary. Never force a redirect.
 *     conflict      A uniqueness/version collision. This is DATA, not auth. Never a raw 23505.
 *     validation    The submitted values are wrong. Field-level, actionable.
 *     not-found     The addressed thing does not exist.
 *     rate-limited  Back off and say when to retry.
 *     stale-client  The client is older than the server contract. Prompt a refresh.
 *     offline       No connectivity.
 *     network       Reached the network, did not get an answer.
 *     server        The backend failed. Never show its internals to a user.
 *     unknown       Genuinely unclassified. Never silently swallowed.
 */

export type ErrorClass =
  | 'forbidden'
  | 'unauthenticated'
  | 'session-dead'
  | 'conflict'
  | 'validation'
  | 'not-found'
  | 'rate-limited'
  | 'stale-client'
  | 'offline'
  | 'network'
  | 'server'
  | 'unknown';

export interface NormalizedError {
  code: string;
  status: number | null;
  message: string;
  name: string;
}

/**
 * Backends disagree about field names. Normalise ONCE so the rules below read cleanly and a
 * new provider is a change to this function alone.
 */
export function normalize(err: unknown): NormalizedError {
  const e = (err ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const val = e[k];
      if (typeof val === 'string' && val) return val;
      if (typeof val === 'number') return String(val);
    }
    return '';
  };
  const statusRaw = pick('status', 'statusCode', 'httpStatus', 'http_status');
  return {
    code: pick('code', 'error_code', 'errorCode').toUpperCase(),
    status: statusRaw ? Number(statusRaw) : null,
    message: (pick('message', 'error_description', 'error', 'msg', 'details', 'hint') ||
      (typeof err === 'string' ? err : '')).toLowerCase(),
    name: pick('name'),
  };
}

const has = (hay: string, needles: string[]) => needles.some((n) => hay.includes(n));

/**
 * ORDER IS THE CONTRACT: most specific first. A reordering is a behaviour change and needs a
 * test, because `403` would otherwise be swallowed by a broader auth rule and users would be
 * logged out for a permission problem - the single most common version of this bug.
 */
export function classifyError(err: unknown): ErrorClass {
  const { code, status, message, name } = normalize(err);

  // 1. Unrecoverable session death - checked before anything else that could trigger a refresh.
  if (has(message, ['refresh token not found', 'refresh token revoked', 'invalid refresh token', 'session not found']))
    return 'session-dead';

  // 2. Authorisation. A valid identity without permission. NEVER refresh or sign out here.
  if (status === 403 || code === '42501' || has(message, ['permission denied', 'row-level security', 'not authorized', 'not authorised', 'forbidden']))
    return 'forbidden';

  // 3. Data collisions before generic 4xx - a duplicate is not a client auth problem.
  if (status === 409 || code === '23505' || has(message, ['duplicate key', 'already exists', 'unique constraint', 'version mismatch']))
    return 'conflict';

  // 4. Contract drift: the client is asking for something this server version does not have.
  if (code === 'PGRST202' || has(message, ['could not find the function', 'schema cache', 'unknown field', 'unsupported api version']))
    return 'stale-client';

  if (status === 404 || code === '404' || has(message, ['not found', 'no rows returned'])) return 'not-found';
  if (status === 422 || status === 400 || has(message, ['validation', 'invalid input', 'is required', 'must be'])) return 'validation';
  if (status === 429 || has(message, ['rate limit', 'too many requests'])) return 'rate-limited';

  // 5. Recoverable auth. Deliberately AFTER 403 so a permission denial can never land here.
  if (status === 401 || code === 'PGRST303' || has(message, ['jwt expired', 'jwt is expired', 'token expired', 'unauthenticated']))
    return 'unauthenticated';

  if (has(message, ['offline', 'no internet'])) return 'offline';
  // The api-client's own timeout aborts the fetch, which surfaces as an AbortError. That is
  // "reached the network, did not get an answer" - the definition of `network`. Unclassified
  // it falls to `unknown`: generic wording and no retry, for the one failure the client
  // manufactures itself. Matched by NAME, not by the word "abort" - Postgres says "current
  // transaction is aborted" about something else entirely.
  if (name.toLowerCase() === 'aborterror' || has(message, ['operation was aborted', 'signal is aborted'])) return 'network';
  if (name.toLowerCase() === 'typeerror' && has(message, ['fetch'])) return 'network';
  if (has(message, ['network', 'econnreset', 'etimedout', 'timeout', 'socket hang up', 'failed to fetch'])) return 'network';
  if (status !== null && status >= 500) return 'server';

  return 'unknown';
}

/**
 * ONE wording table for the whole application. Copy lives here, never at the call site,
 * so the same condition reads identically on every screen and can be reviewed in one place.
 *
 * `null` means "show no message" - a class whose recovery UI is the message. A toast alongside
 * a re-auth screen contradicts it.
 *
 * NOTE: the raw error still goes to the log (see errors.ts). The user gets a calm sentence
 * with a next step; the engineer gets the machine detail. Never trade one for the other.
 */
export function userMessageFor(cls: ErrorClass, fallback = 'Something went wrong. Please try again.'): string | null {
  switch (cls) {
    case 'session-dead':
    case 'unauthenticated':
      return null;
    case 'forbidden':
      return 'You do not have permission to do that.';
    case 'conflict':
      return 'That was just changed somewhere else. Refresh and try again.';
    case 'validation':
      return 'Please check the highlighted fields and try again.';
    case 'not-found':
      return 'We could not find that. It may have been removed.';
    case 'rate-limited':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'stale-client':
      return 'The app has just been updated. Refresh to continue.';
    case 'offline':
      return 'You appear to be offline. Check your connection and try again.';
    case 'network':
      return 'We could not reach the server. Check your connection and try again.';
    case 'server':
      return 'Something went wrong on our side. Please try again shortly.';
    case 'unknown':
    default:
      return fallback;
  }
}

/** Whether a class is worth retrying automatically, and how long to wait. */
export function retryPolicyFor(cls: ErrorClass): { retry: boolean; backoffMs: number } {
  switch (cls) {
    case 'network':
    case 'server':
      return { retry: true, backoffMs: 800 };
    case 'rate-limited':
      return { retry: true, backoffMs: 5000 };
    default:
      return { retry: false, backoffMs: 0 };
  }
}
