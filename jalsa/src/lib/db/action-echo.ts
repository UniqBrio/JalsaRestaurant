import 'server-only';
import type { NextResponse } from 'next/server';
import { ok } from '@/lib/route';
import { logError } from '@/lib/logger';

/**
 * action-echo — a staff or owner write answers WITH the screen it changed.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 3)
 *   Every tap on the captain's phone and the owner's console used to answer `{ done: true }`, and
 *   the phone then made a SECOND request to read the whole screen back: another trip from India
 *   to the server, another sign-in check, another full payload read, with the button frozen in
 *   between. The server had just made the change and was sitting next to the database; handing
 *   the screen back in the same answer removes the second request entirely. `useLiveData.send`
 *   already applies a `state` that arrives with a write — the guest surface has worked this way
 *   since 12-Sep (`guest-echo.ts`), and this is the same contract for the other two surfaces.
 *
 * WHAT IT NEVER DOES
 *   Turn a write that SUCCEEDED into a failed answer. If building the screen throws, the action's
 *   own answer goes back unchanged and the phone falls back to reading the screen, exactly as it
 *   did before this existed. The error still reaches the log.
 *
 *   Attach anything to a refusal. A 4xx or 5xx goes back untouched.
 */
/**
 * How long the answer may wait for the screen. The write is already committed; past this, the
 * action answers without the screen and the phone reads it, as it did before echoes existed.
 *
 * WHY A DEADLINE AND NOT ONLY A catch (review of latency fix 3): a build that HANGS — a lock wait,
 * a stalled connection — is not an exception. Without a deadline it would hold the answer until
 * the platform's function timeout, the phone would see a 504 for a write that succeeded, and the
 * person would do it again: a second round in the kitchen, or a one-time PIN issued twice.
 */
export const ECHO_BUDGET_MS = 2500;

const TIMED_OUT = Symbol('echo-timed-out');

export async function withState(
  res: NextResponse,
  build: () => Promise<unknown>,
  budgetMs: number = ECHO_BUDGET_MS
): Promise<NextResponse> {
  if (!res.ok) return res;
  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    return res;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return res;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lateOnly = false;
  try {
    const building = build();
    // A build that loses the race may still fail later: logged then, never thrown. One that fails
    // in time is logged once, below.
    building.catch((err: unknown) => {
      if (lateOnly) logError('action.echo.late', err);
    });
    const state = await Promise.race([
      building,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), budgetMs);
      }),
    ]);
    if (state === TIMED_OUT) {
      lateOnly = true;
      logError('action.echo', new Error(`screen not built within ${budgetMs} ms; answered without it`));
      return res;
    }
    if (state === null || state === undefined) return res;
    return ok({ ...(body as Record<string, unknown>), state });
  } catch (err) {
    logError('action.echo', err);
    return res;
  } finally {
    clearTimeout(timer);
  }
}
