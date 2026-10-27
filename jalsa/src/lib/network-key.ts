import { createHmac } from 'node:crypto';

/**
 * network-key — which NETWORK a sign-in came from, as a keyed hash (27-Oct-2026, P-5).
 *
 * The sign-in throttle (migration 20261027100000) counts failures per network. It is given this
 * key, never an address: the database stores no IP, and the key is useless without the server's
 * session secret.
 *
 * WHY IPv6 IS CUT TO ITS /64
 *   One phone or one attacker's machine is routinely handed a whole /64 — 18 quintillion addresses.
 *   Keyed per address, every guess could come from a "new network". Keyed per /64, they share one
 *   allowance, as one household's IPv4 address always has.
 *
 * WHERE THE ADDRESS COMES FROM (src/lib/db/auth.ts): `x-real-ip`, else the first `x-forwarded-for`
 * entry. On Vercel both are written by the platform and a client cannot set them. Behind any other
 * proxy that does not overwrite them, a client could choose its own network — the per-surface
 * global limit still bounds that case. An empty address is one shared network, never a free pass.
 *
 * Pure (no request, no config), so it is tested directly.
 */

/** The part of an address that names the network: IPv4 whole, IPv6 its first 64 bits. */
export function networkPrefix(address: string): string {
  const a = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');
  if (!a.includes(':')) return a;
  // IPv4 carried in IPv6 (::ffff:203.0.113.7) is that IPv4 address.
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return mapped[1];
  const [head = '', tail = ''] = a.split('::');
  const left = head ? head.split(':') : [];
  const right = a.includes('::') && tail ? tail.split(':') : [];
  const groups = a.includes('::')
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => (g || '0').replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/** The key the throttle stores: an HMAC of the network prefix under the server's secret. */
export function networkKey(address: string, secret: string): string {
  return `n1:${createHmac('sha256', secret).update(networkPrefix(address)).digest('base64url').slice(0, 32)}`;
}
