/**
 * The two cookie names, in a module that imports NOTHING.
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
export const COOKIE_NAMES = { staff: 'jalsa_staff', guest: 'jalsa_guest' } as const;
