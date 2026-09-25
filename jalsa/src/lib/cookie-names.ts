/**
 * The cookie names, in a module that imports NOTHING.
 *
 * WHY THEY LIVE HERE AND NOT IN sessions.ts
 *   `middleware.ts` runs on the Edge runtime and needs the guest cookie's name. It cannot import
 *   `sessions.ts`, because that module pulls in `node:crypto` and `next/headers`, and neither
 *   exists on the Edge — the build fails. Copying the string into middleware instead would put
 *   the name in two places, and the day one of them changed the other would keep reading a
 *   cookie nobody writes any more: a session that silently never resumes.
 *
 *   So the name lives in the one place both runtimes can reach, and this file stays
 *   dependency-free on purpose. Do not add an import to it.
 */
/** The two apps a member of staff signs in to, each with its own session (see sessions.ts). */
export type Surface = 'staff' | 'owner';

/* SUPERSEDED 25-Sep-2026 (review): the staff app first KEPT `jalsa_staff`. Every owner sign-in
   before the split was written into that cookie, so a captain's phone the owner had used stayed
   signed in as the owner on /staff for up to 14 hours after the deploy - the very defect the split
   fixes. Both surfaces take new names; everyone signs in once more. */
export const COOKIE_NAMES = { staff: 'jalsa_staff_app', owner: 'jalsa_owner', guest: 'jalsa_guest' } as const;
