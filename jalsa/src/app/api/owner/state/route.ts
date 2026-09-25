import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { publicConfig } from '@/lib/config';
import { currentStaff } from '@/lib/db/auth';
import { buildOwnerPayload } from '@/lib/db/owner-view';
import { floorStamp, STAMP_HEADER, UNCHANGED } from '@/lib/db/change-stamp';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request): Promise<NextResponse> => {
  // Who is asking, and whether anything has moved, in one round (change-stamp.ts).
  const [staff, stamp] = await Promise.all([currentStaff(), floorStamp()]);
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to open the console.' });
  }
  // The console is gated on ONE grant, and every section inside it is gated again on its own.
  // A cashier who may close bills gets the console; the tax panel is still not theirs.
  if (!staff.grants.can('orders.view')) {
    return fail(403, {
      code: 'forbidden',
      message: 'This console is not part of your role.',
      permission: 'orders.view',
    });
  }
  const init: ResponseInit = stamp ? { headers: { [STAMP_HEADER]: stamp } } : {};
  if (stamp && new URL(req.url).searchParams.get('since') === stamp) return ok(UNCHANGED, init);
  return ok(await buildOwnerPayload(staff, publicConfig.qrOrigin), init);
});
