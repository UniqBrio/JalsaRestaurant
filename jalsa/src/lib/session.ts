/**
 * CP-1 — identity resolution as a TRI-STATE.
 *
 * THE BUG THIS PREVENTS
 *   Two states — "have a user" and "no user" — collapse "still loading" into "genuinely
 *   absent". So on the first render the app concludes there is no user, renders the signed-out
 *   view or an empty list, and then corrects itself a moment later. The user sees a flash of
 *   the wrong screen, and any logic that ran in that window ran against a null identity.
 *
 *   The same collapse is why a permission check can render a denial for an authorised user.
 */

export type Resolved<T> = { status: 'resolving' } | { status: 'none' } | { status: 'value'; value: T };

export const resolving = <T>(): Resolved<T> => ({ status: 'resolving' });
export const none = <T>(): Resolved<T> => ({ status: 'none' });
export const value = <T>(v: T): Resolved<T> => ({ status: 'value', value: v });

/** True only once the question has genuinely been answered, either way. */
export const isSettled = <T>(r: Resolved<T>): boolean => r.status !== 'resolving';

/**
 * Force every consumer to handle all three cases. There is no default branch on purpose:
 * adding a fourth state would then be a compile error rather than a silent fallthrough.
 */
export function matchResolved<T, R>(
  r: Resolved<T>,
  handlers: { resolving: () => R; none: () => R; value: (v: T) => R }
): R {
  switch (r.status) {
    case 'resolving':
      return handlers.resolving();
    case 'none':
      return handlers.none();
    case 'value':
      return handlers.value(r.value);
  }
}

export interface Session {
  userId: string;
  tenantId: string;
  roles: string[];
}

/**
 * Never `session?.tenantId` at a call site. That yields `undefined` while resolving AND when
 * signed out, which is the collapse this module exists to prevent.
 */
export const tenantIdOf = (s: Resolved<Session>): Resolved<string> =>
  matchResolved(s, {
    resolving: () => resolving<string>(),
    none: () => none<string>(),
    value: (v) => value(v.tenantId),
  });
