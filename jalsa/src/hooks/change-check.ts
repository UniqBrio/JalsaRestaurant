/**
 * change-check — how a polling screen asks "has anything changed?" instead of re-reading it all.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 4)
 *   `useLiveData` re-read a screen's whole payload on every tick: 10–12 database calls a guest
 *   phone every 6 s, 29 for the owner's console every 8 s, nearly always to learn nothing had
 *   happened. The server now stamps each full screen (`src/lib/db/change-stamp.ts`); a tick sends
 *   that stamp back and gets `{ unchanged: true }` — one cheap read on the server, a few bytes on
 *   the wire — unless something really moved.
 *
 * WHY A FULL READ IS STILL DUE NOW AND THEN
 *   Some of what a screen shows moves with the CLOCK, not the data: a KOT's "waiting 12 min", the
 *   guest's receipt giving way to the welcome screen when the rescan window ends. No write happens
 *   for those, so no stamp moves. `fullEveryMs` bounds how stale they can get.
 *
 * Pure, so the rules can be unit-tested without a browser; the hook owns the state.
 */

export interface CheckState {
  /** The stamp of the screen now showing; null when unknown, which forces a full read. */
  stamp: string | null;
  /** When the screen was last read in full (ms since epoch). */
  lastFullAt: number;
  /** The longest a screen may go without a full read. */
  fullEveryMs: number;
}

export const newCheck = (fullEveryMs: number): CheckState => ({ stamp: null, lastFullAt: 0, fullEveryMs });

/** What this tick asks for. A person-caused read (`force`) is always a full one. */
export function pollTarget(
  url: string,
  check: CheckState,
  now: number,
  force: boolean
): { href: string; full: boolean } {
  const due = now - check.lastFullAt >= check.fullEveryMs;
  if (force || due || !check.stamp) return { href: url, full: true };
  const sep = url.includes('?') ? '&' : '?';
  return { href: `${url}${sep}since=${encodeURIComponent(check.stamp)}`, full: false };
}

/** Is this answer the server's "nothing moved"? Anything else is a screen. */
export function isUnchanged(text: string): boolean {
  if (text.length > 64) return false;
  try {
    return (JSON.parse(text) as { unchanged?: unknown }).unchanged === true;
  } catch {
    return false;
  }
}

/** A full screen arrived: remember its stamp (or that it had none) and when. */
export function readInFull(check: CheckState, stamp: string | null, now: number): void {
  check.stamp = stamp;
  check.lastFullAt = now;
}

/**
 * A write answered with its own screen. That screen's stamp is unknown, so the next tick reads in
 * full rather than risk comparing against a stamp older than what is showing.
 */
export function forgetStamp(check: CheckState): void {
  check.stamp = null;
}
