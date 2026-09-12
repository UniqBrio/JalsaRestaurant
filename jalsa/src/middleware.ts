import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAMES } from '@/lib/cookie-names';

/**
 * middleware — mint the guest's opaque token BEFORE the page renders.
 *
 * WHY THIS FILE HAD TO EXIST
 *   A guest arriving at /t/A5 with no cookie needs one. The natural place to write it looked
 *   like `resolveGuest`, and that is where it was — but `/t/[table]/page.tsx` is a SERVER
 *   COMPONENT, and Next.js refuses `cookies().set()` during a server render. It may only be
 *   called from a Server Action or a Route Handler. So the very first scan of a real table
 *   threw, `attempt()` caught it, and the guest was shown "We cannot reach the till just now" —
 *   a message about the database, for a failure that had nothing to do with the database.
 *
 *   Middleware runs before the render and owns a real response, so setting a cookie here is
 *   legal. The server component then only ever READS.
 *
 * WHY THE TOKEN IS MINTED WITH WEB CRYPTO AND NOT node:crypto
 *   Middleware runs on the Edge runtime, where `node:crypto`'s randomBytes does not exist.
 *   `crypto.getRandomValues` is the standard available in both, and produces the same 24 bytes
 *   of base64url that `newGuestToken()` produces — the two must stay interchangeable, because
 *   either may be the one that created a token the other later reads.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   No database call, no session row, no bill. Middleware runs on every matched request and a
 *   query here would tax every scan. It hands the render a key; the render decides what it opens.
 */

const GUEST_TOKEN_BYTES = 24;

/** Base64url of 24 random bytes — byte-for-byte the shape `newGuestToken()` produces. */
function mintGuestToken(): string {
  const bytes = new Uint8Array(GUEST_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (request.cookies.get(COOKIE_NAMES.guest)) return response;

  response.cookies.set(COOKIE_NAMES.guest, mintGuestToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // A seating, generously. The bill is the real lifetime — this is only how long the phone
    // keeps its key to it. Must match writeGuestToken(); two lifetimes for one cookie is a bug
    // that only shows up hours later.
    maxAge: 8 * 60 * 60,
  });
  return response;
}

export const config = {
  // Only the guest surface. Staff and owner carry their own signed cookie and must not be
  // handed a guest token they never asked for.
  matcher: ['/t/:path*'],
};
