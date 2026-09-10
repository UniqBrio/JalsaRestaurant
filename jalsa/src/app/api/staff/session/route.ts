import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { signInWithPin } from '@/lib/db/auth';
import { clearStaffSession } from '@/lib/sessions';

/**
 * Signing in and out.
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

  const input = await body<{ pin?: string }>(req);
  const session = await signInWithPin((input.pin ?? '').trim());
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'That PIN did not work. Javeed reissues it from Staff if you have forgotten yours.',
    });
  }
  return ok({ name: session.name, role: session.role, initials: session.initials });
});

export const DELETE = handler(async (): Promise<NextResponse> => {
  await clearStaffSession();
  return ok({ signedOut: true });
});
