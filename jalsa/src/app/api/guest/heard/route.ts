import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { currentGuestSession } from '@/lib/db/guest';
import { recordHeardAbout } from '@/lib/db/mutations';

/**
 * "How did you hear about us?" — recorded against the visit.
 *
 * ITS OWN ROUTE, DELIBERATELY
 *   `/api/guest/bill` is about a bill and refuses to be about anything else; at the landing
 *   screen there is no bill at all. `/api/guest/ask` raises a request for the floor, and this
 *   asks nobody for anything. A third meaning bolted onto either would be the kind of
 *   catch-all endpoint that eventually needs a comment explaining which half of it applies.
 *
 * WHAT A GUEST MAY WRITE, AND ONLY THAT
 *   One text value, on their OWN session, found by the token in their own cookie. There is no
 *   session id in the request body: a guest cannot name another party's visit, because they are
 *   never asked to. The restaurant is the session's, not the caller's.
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const session = await currentGuestSession();
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'Scan the code on your table again — this phone is not attached to a table right now.',
    });
  }

  const input = await body<{ source?: string }>(req);
  const source = (input.source ?? '').trim();

  // The same 60 the column's own constraint states, refused here so the guest reads a sentence
  // rather than meeting a constraint violation.
  if (source.length > 60) {
    return fail(400, { code: 'validation', message: 'That is a little long — keep it under 60 characters.' });
  }

  await recordHeardAbout({ sessionId: session.id, source });
  return ok({ source });
});
