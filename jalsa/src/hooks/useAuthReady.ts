'use client';
/**
 * CP-2 — gate every derived value until authentication has hydrated.
 *
 * THE BUG THIS PREVENTS
 *   A permission computed from a null identity is `false`. And `false` renders as a denial —
 *   an indistinguishable one. So an authorised user sees "you do not have permission" for a
 *   fraction of a second on every cold load, and any effect that fired in that window fired
 *   against the wrong answer.
 *
 *   The fix is not to make the check faster. It is to refuse to answer until the question is
 *   answerable.
 */
import { useMemo } from 'react';
import { matchResolved, type Resolved, type Session } from '../lib/session';

export type Permission = 'granted' | 'denied' | 'unknown';

export function usePermission(session: Resolved<Session>, required: string): Permission {
  return useMemo(
    () =>
      matchResolved<Session, Permission>(session, {
        // NOT 'denied'. The difference is the whole point of this hook.
        resolving: () => 'unknown',
        none: () => 'denied',
        value: (s) => (s.roles.includes(required) ? 'granted' : 'denied'),
      }),
    [session, required]
  );
}

/**
 * Render helper that makes the correct behaviour the easy one. `unknown` renders the loading
 * branch — never the denial branch, and never the granted branch.
 */
export function renderByPermission<R>(
  p: Permission,
  branches: { granted: () => R; denied: () => R; loading: () => R }
): R {
  return p === 'granted' ? branches.granted() : p === 'denied' ? branches.denied() : branches.loading();
}
