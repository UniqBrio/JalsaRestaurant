import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { buildStaffPayload } from '@/lib/db/staff-view';

export const dynamic = 'force-dynamic';

/**
 * The floor, re-read.
 *
 * A captain's phone polls this while it is awake. Three things arrive from elsewhere and all
 * three are the reason: a guest sends a round, the kitchen marks one ready, and a table taps a
 * request. Each is a person waiting, so "within seconds" is the requirement — not milliseconds.
 */
export const GET = handler(async (): Promise<NextResponse> => {
  const staff = await currentStaff('staff');
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to see your tables.' });
  }
  return ok(await buildStaffPayload(staff));
});
