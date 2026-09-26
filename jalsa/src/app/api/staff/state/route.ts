import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { buildStaffPayload } from '@/lib/db/staff-view';
import { floorStamp, staffStamp, STAMP_HEADER, UNCHANGED } from '@/lib/db/change-stamp';

export const dynamic = 'force-dynamic';

/**
 * The floor, re-read.
 *
 * A captain's phone polls this while it is awake. Three things arrive from elsewhere and all
 * three are the reason: a guest sends a round, the kitchen marks one ready, and a table taps a
 * request. Each is a person waiting, so "within seconds" is the requirement — not milliseconds.
 */
export const GET = handler(async (req: Request): Promise<NextResponse> => {
  // Who is asking, and whether anything on the floor has moved, in one round (change-stamp.ts).
  // The identity check still runs on every poll: a removed person loses access on the next one.
  const [staff, floor] = await Promise.all([currentStaff('staff'), floorStamp()]);
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to see your tables.' });
  }
  const stamp = staffStamp(floor, staff);
  const init: ResponseInit = stamp ? { headers: { [STAMP_HEADER]: stamp } } : {};
  if (stamp && new URL(req.url).searchParams.get('since') === stamp) return ok(UNCHANGED, init);
  return ok(await buildStaffPayload(staff), init);
});
