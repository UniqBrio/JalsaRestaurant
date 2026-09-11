import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { chooseOwnPin, currentStaff } from '@/lib/db/auth';
import { writeStaffSession } from '@/lib/sessions';

/**
 * Replacing an issued PIN with one the person chose.
 *
 * WHY THE SESSION IS REWRITTEN ON SUCCESS
 *   The cookie carries `provisional`, so without a rewrite the person would be sent back to the
 *   prompt on their very next request having just completed it — which reads as "it did not
 *   save", and the second attempt would fail because the current PIN has changed.
 *
 * WHY A FAILURE HERE IS NOT A 500
 *   "Wrong current PIN" and "that new one is too easy to guess" are both ANSWERS, not faults.
 *   They come back as 400 with the sentence the screen prints, because a stack trace on this
 *   screen would leave someone locked out of a shift with nothing to act on.
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in first.' });
  }

  const input = await body<{ current?: string; next?: string }>(req);
  const current = (input.current ?? '').trim();
  const next = (input.next ?? '').trim();

  if (!/^\d{4}$/.test(next)) {
    return fail(400, { code: 'validation', message: 'A PIN is exactly four digits.' });
  }
  if (next === current) {
    return fail(400, {
      code: 'validation',
      message: 'That is the code you were given. Choose a different four digits.',
    });
  }

  let changed: boolean;
  try {
    changed = await chooseOwnPin({ staffId: staff.staffId, current, next });
  } catch (err) {
    // The database refuses a sequence, a repeat, or the shared setup code, with a sentence
    // written to be read by the person choosing.
    const message = err instanceof Error ? err.message : 'That PIN cannot be used.';
    return fail(400, { code: 'validation', message: message.replace(/^.*?:\s*/, '') });
  }

  if (!changed) {
    return fail(400, {
      code: 'validation',
      message: 'That is not the PIN you were given. Ask Javeed to reissue it if you are not sure.',
    });
  }

  await writeStaffSession({ ...staff, provisional: false, issuedAt: Math.floor(Date.now() / 1000) });
  return ok({ changed: true });
});
