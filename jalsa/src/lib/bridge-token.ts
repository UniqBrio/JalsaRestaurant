import { createHash } from 'node:crypto';

/**
 * bridge-token — the pure arithmetic of a bridge credential.
 *
 * SEPARATE FROM `bridge-auth.ts` ON PURPOSE. That module is `server-only`, because resolving a
 * token means reading a table with the secret key. These two functions read nothing: one hashes a
 * string, the other parses a header. Leaving them behind the server boundary would make them
 * unreachable from a unit spec, and a credential check nothing can execute is a credential check
 * nobody has ever seen work.
 */

/**
 * The SHA-256 a token is stored and matched by.
 *
 * The raw token is shown once, at issue, and never persisted — so a dump of `bridge_token` yields
 * no working credential, and revocation is a timestamp rather than a redeploy.
 */
export const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

/**
 * The `Authorization: Bearer <token>` header, or null.
 *
 * Deliberately strict about the scheme. Accepting a bare token as well would mean two formats to
 * support forever, and the looser one is the one that ends up in a URL query string — where it
 * lands in access logs, proxy logs and browser history.
 */
export function bearerFrom(req: Request): string | null {
  const raw = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return match?.[1] ?? null;
}
