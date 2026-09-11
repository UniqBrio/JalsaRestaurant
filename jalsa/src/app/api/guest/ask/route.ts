import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { currentGuestSession } from '@/lib/db/guest';
import { leaveSuggestion, raiseRequest } from '@/lib/db/mutations';

/**
 * "Ask for something", and "tell us what to fix".
 *
 * Both are things a guest raises without an account, so both are rate-limited by the only
 * durable thing available: the table's own session. Twenty taps of "Need water" from one bored
 * phone is a denial-of-service against the floor staff, not against the server, and the floor is
 * where it hurts.
 */

const RECENT_WINDOW_MS = 60_000;
const recent = new Map<string, number[]>();

function tooFast(sessionId: string, limit: number): boolean {
  const now = Date.now();
  const hits = (recent.get(sessionId) ?? []).filter((t) => now - t < RECENT_WINDOW_MS);
  hits.push(now);
  recent.set(sessionId, hits);
  if (recent.size > 500) recent.clear();
  return hits.length > limit;
}

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const session = await currentGuestSession();
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'Scan the code on your table again — this phone is not attached to a table right now.',
    });
  }

  const input = await body<{ kind?: string; note?: string; suggestion?: string }>(req);

  if (input.suggestion !== undefined) {
    const text = input.suggestion.trim();
    if (!text) return fail(400, { code: 'validation', message: 'Write a line first.' });
    if (tooFast(session.id, 4)) {
      return fail(429, {
        code: 'rate-limited',
        message: 'That is a few in quick succession — give us a minute to read the last one.',
      });
    }
    await leaveSuggestion({ tableId: session.tableId, billId: session.billId, body: text });
    return ok({ sent: true });
  }

  if (!input.kind) return fail(400, { code: 'validation', message: 'Ask for what?' });
  if (tooFast(session.id, 6)) {
    return fail(429, {
      code: 'rate-limited',
      message: 'Your captain has these already and is on the way. Give them a moment.',
    });
  }

  await raiseRequest({
    tableId: session.tableId,
    billId: session.billId,
    kind: input.kind.slice(0, 60),
    ...(input.note ? { note: input.note.slice(0, 200) } : {}),
  });
  return ok({ raised: true });
});
