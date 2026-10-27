import { NextResponse, after } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { SignInThrottled, signInWithPin } from '@/lib/db/auth';
import { audit } from '@/lib/db/mutations';
import { logError } from '@/lib/logger';
import { clearStaffSession, surfaceFrom } from '@/lib/sessions';

/**
 * Signing in and out - of ONE surface.
 *
 * WHICH SURFACE (24-Sep list, G2)
 *   The owner console and the staff app keep separate sessions. The keypad on each says which it
 *   is signing in to (`surface` in the body; anything but 'owner' is the staff app), and a
 *   sign-in or sign-out here touches that surface's cookie and no other.
 *
 * WHY THE FAILURE MESSAGE IS DELIBERATELY UNHELPFUL
 *   A four-digit PIN has ten thousand values. Any message that separates "no such PIN" from
 *   "that person is not on tonight" turns the keypad into an enumeration tool for whoever picks
 *   the handset up. One answer, always: that PIN did not work.
 *
 * WHERE THE RATE LIMIT LIVES (27-Oct-2026, P-5)
 *   In the database, per network and per surface, counting only PINs that did not work (migration
 *   20261027100000, applied through `signInWithPin`). It replaced a per-process window of ten
 *   attempts a minute shared by everyone — a speed bump for an attacker and a lockout for the
 *   whole floor at shift change. Until the migration runs, `signInWithPin` keeps the old window.
 *   SUPERSEDED: "WHY THE RATE LIMIT IS PER PROCESS AND SAYS SO" — that limit is now the fallback.
 */

/** "Wait a moment" under a minute; whole minutes after that. */
function waitWords(seconds: number): string {
  if (seconds < 60) return 'Wait a moment, then try again.';
  const minutes = Math.ceil(seconds / 60);
  return `Wait ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, then try again.`;
}

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const input = await body<{ pin?: string; surface?: string }>(req);
  const surface = surfaceFrom(input.surface);
  let session;
  try {
    session = await signInWithPin((input.pin ?? '').trim(), surface);
  } catch (err) {
    if (!(err instanceof SignInThrottled)) throw err;
    const res = fail(429, {
      code: 'rate-limited',
      message: `Too many attempts. ${waitWords(err.retryAfterSeconds)}`,
    });
    res.headers.set('Retry-After', String(err.retryAfterSeconds));
    return res;
  }
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'That PIN did not work. Javeed reissues it from Staff if you have forgotten yours.',
    });
  }
  /* WHO SIGNED IN, WHERE, AND WHEN (24-Sep list, G2). Without this entry there was no way to
     tell afterwards whose session a round came from. */
  /* SUPERSEDED 25-Sep-2026: the surface was read from the Referer, because both surfaces shared
     one cookie and the page was only a hint. Each surface now has its own session, so the
     surface named here is the one this cookie opens. */
  // Best-effort and never fatal: the person IS signed in (the cookie is written), so a failed
  // record must not turn their sign-in into an error.
  /* AFTER the answer, not before it (26-Oct-2026, requests/2026-10-26-navigation-latency.md): the
     record was a whole database round between a correct PIN and the screen opening, and nothing the
     person sees waits on it. `after` keeps the function alive until it lands; it is still written. */
  after(async () => {
    try {
      await audit({
        action: 'Signed in',
        detail: `${session.name} signed in on the ${surface === 'owner' ? 'owner console' : 'staff app'}`,
        actor: { staffId: session.staffId, label: session.name },
      });
    } catch (err) {
      logError('api', err, { url: req.url });
    }
  });
  return ok({ name: session.name, role: session.role, initials: session.initials });
});

export const DELETE = handler(async (req: Request): Promise<NextResponse> => {
  // An empty body (a page loaded before surfaces existed) signs out of the staff app, as before.
  let input: { surface?: string } = {};
  try {
    input = (await req.json()) as { surface?: string };
  } catch {
    /* no body */
  }
  await clearStaffSession(surfaceFrom(input.surface));
  return ok({ signedOut: true });
});
