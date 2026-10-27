/**
 * same-origin — a state-changing request whose browser says it came from ANOTHER site is refused
 * (27-Oct-2026, audit SEC-14).
 *
 * Defence in depth behind the cookies' SameSite=Lax, which already keeps them off a cross-site
 * POST in every current browser. This holds where that one cannot: a browser or an embedded view
 * that sends cookies anyway, and a future cookie someone sets without the attribute.
 *
 * WHAT IS REFUSED: a POST, PUT, PATCH or DELETE whose `Origin` names a host other than the one it
 * was sent to (or is `null`, an opaque origin), or that has no `Origin` but a `Sec-Fetch-Site:
 * cross-site`. WHAT IS NOT: any read, and a request with neither header — the print bridge on the
 * kitchen PC and server-to-server calls send none, and they authenticate by token, not by cookie.
 *
 * Pure, so the rules are tested directly (tests/unit/same-origin.unit.spec.ts).
 */
const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isCrossSiteWrite(req: Request): boolean {
  if (!WRITES.has(req.method.toUpperCase())) return false;
  const origin = req.headers.get('origin');
  if (origin === null) return req.headers.get('sec-fetch-site') === 'cross-site';
  let from: string;
  try {
    from = new URL(origin).host;
  } catch {
    return true; // `null` (an opaque origin) or anything unreadable is not this site
  }
  if (!from) return true;
  const own = [new URL(req.url).host, req.headers.get('host'), req.headers.get('x-forwarded-host')];
  return !own.some((h) => h !== null && h.toLowerCase() === from.toLowerCase());
}
