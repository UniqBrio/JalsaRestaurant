import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { signInWithPin } from '@/lib/db/auth';
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
 * WHY THE RATE LIMIT IS PER PROCESS AND SAYS SO
 *   It is a speed bump, not a lockout — a captain who fat-fingers three times mid-service must
 *   not be locked out of their own floor. Anything stronger belongs at the edge, and pretending
 *   this is that would be the dishonest kind of security.
 */

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const attempts: number[] = [];

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const now = Date.now();
  while (attempts.length && now - (attempts[0] ?? 0) > WINDOW_MS) attempts.shift();
  if (attempts.length >= MAX_ATTEMPTS) {
    return fail(429, {
      code: 'rate-limited',
      message: 'Too many attempts in the last minute. Wait a moment, then try again.',
    });
  }
  attempts.push(now);

  const input = await body<{ pin?: string; surface?: string }>(req);
  const surface = surfaceFrom(input.surface);
  const session = await signInWithPin((input.pin ?? '').trim(), surface);
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
  try {
    await audit({
      action: 'Signed in',
      detail: `${session.name} signed in on the ${surface === 'owner' ? 'owner console' : 'staff app'}`,
      actor: { staffId: session.staffId, label: session.name },
    });
  } catch (err) {
    logError('api', err, { url: req.url });
  }
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
