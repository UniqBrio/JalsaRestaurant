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
 * WHY "SKIP FOR NOW" EXISTS AND WHAT IT COSTS
 *   Requested so a shared setup PIN does not block testing. It is scoped to the session on
 *   purpose: the database keeps saying this credential was issued, not chosen, so the prompt
 *   comes back on the next sign-in and the honest state is never lost.
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

  const input = await body<{ current?: string; next?: string; skip?: boolean }>(req);

  // "Skip for now" - this SESSION proceeds; the stored credential is untouched.
  //
  // The cookie carries `provisional`, and the surfaces gate on the cookie, so clearing it here
  // opens the floor for as long as this session lasts. `staff.pin_provisional` in the database
  // is deliberately NOT cleared: the next sign-in reads it again and the screen returns. That is
  // the difference between "let me in, I am testing" and "1234 is now this account's password
  // forever" - and on a public URL the second one is the whole risk KL-4 exists to bound.
  if (input.skip === true) {
    await writeStaffSession({ ...staff, provisional: false, issuedAt: Math.floor(Date.now() / 1000) });
    return ok({ skipped: true });
  }

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
