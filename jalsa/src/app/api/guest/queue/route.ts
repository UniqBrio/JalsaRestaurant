import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handler, ok, fail, body } from '@/lib/route';
import { guestJoinQueue, guestLeaveQueue } from '@/lib/db/mutations';
import { QUEUE_CLOSED } from '@/lib/queue-closed';
import { readQueueEntry } from '@/lib/db/queries';

/**
 * The entrance queue, from the phone that scanned the door code.
 *
 * WHY THE IDENTIFIER IS A COOKIE AND NOT A URL
 *   The party's handle on their own row is its uuid, set here as an http-only cookie. In the URL
 *   it would be shoulder-surfable across a crowded doorway, bookmarked, pasted into a group chat
 *   and shared with people who are not in that party. In a cookie it belongs to the one phone
 *   that tapped Join.
 *
 * WHAT IT AUTHORISES, EXACTLY
 *   Reading that one row and leaving the queue. Nothing else. It cannot notify, cannot seat,
 *   cannot see another party, and cannot alter its own token, code or position — every one of
 *   those is server-owned. For a scanned join the row holds no name and no number, so the worst
 *   case of a leaked cookie is a stranger removing a party from a queue, which the host can undo
 *   by adding them again at the front.
 */
const COOKIE = 'jalsa_queue';
const A_DAY = 60 * 60 * 24;

export const GET = handler(async (): Promise<NextResponse> => {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return ok({ entry: null });

  const entry = await readQueueEntry(id);
  // A cookie for a row that no longer exists — a reset test database, a different restaurant —
  // reads as "not in the queue" rather than as an error. The phone simply offers to join.
  return ok({ entry });
});

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const input = await body<{ action: 'join'; partySize: number } | { action: 'leave' }>(req);
  const jar = await cookies();

  if (input.action === 'join') {
    const existing = jar.get(COOKIE)?.value;
    if (existing) {
      // Already holding a live row: hand it back rather than minting a second token for the
      // same party. A double tap at the door must not put four people in the queue twice.
      const entry = await readQueueEntry(existing);
      if (entry && (entry.state === 'waiting' || entry.state === 'ready')) return ok({ entry });
    }
    /* A closed queue is refused by the MUTATION, not by this route — so a direct POST meets the
       same rule a tap on the page does. 409, not 400: the request was well formed and would have
       succeeded a minute earlier; what changed is the restaurant's state, not the input. */
    let id: string;
    try {
      ({ id } = await guestJoinQueue({ partySize: input.partySize }));
    } catch (err) {
      if (err instanceof Error && err.message === QUEUE_CLOSED) {
        return fail(409, { code: 'conflict', message: QUEUE_CLOSED });
      }
      throw err;
    }
    jar.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: A_DAY });
    return ok({ entry: await readQueueEntry(id) });
  }

  if (input.action === 'leave') {
    const id = jar.get(COOKIE)?.value;
    if (!id) return fail(400, { code: 'validation', message: 'You are not in the queue.' });
    await guestLeaveQueue({ entryId: id });
    jar.delete(COOKIE);
    return ok({ entry: null });
  }

  return fail(400, { code: 'validation', message: 'That is not something the queue can do.' });
});
