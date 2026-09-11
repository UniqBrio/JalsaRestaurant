/**
 * undo — the reversible half of the destructive-action decision.
 *
 * THE DECISION THIS MODULE IMPLEMENTS ONE HALF OF
 *   Irreversible → confirm FIRST (ConfirmDialog, CP-14).
 *   Reversible   → act immediately, say what happened, and carry Undo in the message.
 *   Confirming something reversible trains the user to click through confirmations without
 *   reading them — which is precisely how the irreversible one gets clicked through too.
 *
 * WHY UNDO IS A DEFERRED COMMIT, NOT A COMPENSATING WRITE
 *   The tempting implementation writes immediately and, on Undo, writes the opposite. It is
 *   wrong in a way that only shows up in production: the compensating write can fail, and
 *   then the user has been told "Undone" about a change that is still there. Here the effect
 *   is HELD for the undo window and committed when it closes. Undo is then a local cancel,
 *   which cannot fail. Where a write genuinely cannot be deferred, do not offer undo — offer
 *   a confirmation, and say so.
 *
 * WHAT THE QUEUE MUST NEVER DO
 *   Drop an entry whose commit has not run. A cap on visible toasts is a display decision; if
 *   it silently discards a pending action, the user's archive never happens and nothing says
 *   so. Overflow COMMITS EARLY and reports it — never a silent loss.
 *
 * Pure state in, pure state out: no timers, no DOM. The component owns the clock, so every
 * branch here is testable at any instant, including the ones a test could never wait for.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface UndoableEntry<T = unknown> {
  id: string;
  /** What happened, in specifics: "Archived 3 invoices", never "Saved". */
  message: string;
  tone?: ToastTone;
  /** Present = the action is reversible and Undo is offered. Absent = it is just a message. */
  undo?: {
    label?: string;
    /** Runs when the window closes without an undo. This is where the real write happens. */
    commit: () => void | Promise<void>;
    /** Optional local cleanup on cancel. The write never ran, so there is nothing to reverse. */
    cancel?: () => void | Promise<void>;
    windowMs?: number;
  };
  payload?: T;
}

export interface LiveToast<T = unknown> extends UndoableEntry<T> {
  /** Epoch ms. The component compares against its own clock; this module never reads one. */
  expiresAt: number;
  state: 'live' | 'undone' | 'committed';
}

export interface UndoState<T = unknown> {
  /** Newest first — the order they are stacked on screen. */
  toasts: LiveToast<T>[];
}

export type UndoOutcome = 'undone' | 'too-late' | 'unknown' | 'already-undone';

export const DEFAULT_UNDO_WINDOW_MS = 8_000;
/** How many live toasts can stack before the oldest is committed early and closed. */
export const DEFAULT_MAX_VISIBLE = 3;

export const createUndoState = <T = unknown>(): UndoState<T> => ({ toasts: [] });

export interface PushResult<T> {
  state: UndoState<T>;
  /** Commits forced by the visible cap. The caller MUST run these — that is the write. */
  commit: LiveToast<T>[];
}

export function pushToast<T>(
  state: UndoState<T>,
  entry: UndoableEntry<T>,
  now: number,
  maxVisible: number = DEFAULT_MAX_VISIBLE
): PushResult<T> {
  const windowMs = entry.undo?.windowMs ?? DEFAULT_UNDO_WINDOW_MS;
  const live: LiveToast<T> = { ...entry, expiresAt: now + windowMs, state: 'live' };
  const next = [live, ...state.toasts.filter((t) => t.state === 'live')];

  const kept = next.slice(0, Math.max(1, maxVisible));
  const overflow = next.slice(Math.max(1, maxVisible));

  return {
    state: { toasts: kept },
    commit: overflow.map((t) => ({ ...t, state: 'committed' as const })),
  };
}

export interface UndoResult<T> {
  state: UndoState<T>;
  outcome: UndoOutcome;
  /** The entry to cancel locally. Never a write — the write has not happened yet. */
  entry?: LiveToast<T>;
}

/**
 * Undo is refused OUT LOUD when the window has closed. The alternative — accepting it and
 * doing nothing — leaves the user certain they undid something they did not.
 */
export function undoToast<T>(state: UndoState<T>, id: string, now: number): UndoResult<T> {
  const entry = state.toasts.find((t) => t.id === id);
  if (!entry) return { state, outcome: 'unknown' };
  if (entry.state !== 'live') return { state, outcome: 'already-undone' };
  if (!entry.undo) return { state, outcome: 'unknown' };
  if (now >= entry.expiresAt) return { state, outcome: 'too-late' };

  return {
    state: { toasts: state.toasts.map((t) => (t.id === id ? { ...t, state: 'undone' as const } : t)) },
    outcome: 'undone',
    entry,
  };
}

export interface ExpireResult<T> {
  state: UndoState<T>;
  /** Windows that closed since the last tick. The caller runs each `undo.commit`. */
  commit: LiveToast<T>[];
}

export function expireToasts<T>(state: UndoState<T>, now: number): ExpireResult<T> {
  const due = state.toasts.filter((t) => t.state === 'live' && now >= t.expiresAt);
  return {
    state: { toasts: state.toasts.filter((t) => t.state === 'live' && now < t.expiresAt) },
    commit: due.map((t) => ({ ...t, state: 'committed' as const })),
  };
}

/** Dismissing a toast by hand accepts the action — the window simply ends early. */
export function dismissToast<T>(state: UndoState<T>, id: string): ExpireResult<T> {
  const entry = state.toasts.find((t) => t.id === id && t.state === 'live');
  return {
    state: { toasts: state.toasts.filter((t) => t.id !== id) },
    commit: entry ? [{ ...entry, state: 'committed' }] : [],
  };
}

/**
 * "Say what happened, in specifics" — composed from the REAL values, so a count of one never
 * reads as a plural and a batch of one never claims to be a batch.
 */
export function describeAction(
  verb: string,
  count: number,
  subject: { one: string; many: string },
  name?: string
): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return `Nothing to ${verb.toLowerCase()}.`;
  if (n === 1) return `${verb} ${name ? name : `1 ${subject.one}`}.`;
  return `${verb} ${n} ${subject.many}.`;
}
