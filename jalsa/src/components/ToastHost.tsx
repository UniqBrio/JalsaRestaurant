'use client';
/**
 * ToastHost — the message that says what happened, carrying Undo where the action is reversible.
 *
 * WHY THE UNDO LIVES IN THE TOAST AND NOT IN A MENU
 *   The moment a user wants to undo is the second after they acted, looking at the place they
 *   acted. An Undo in a menu three clicks away is an Undo nobody finds in time; by the time
 *   they find it the window has closed and it is a support call instead.
 *
 * THE COMMIT IS THE POINT (see ../lib/undo.ts)
 *   This host owns the clock. When a window closes it runs `undo.commit` — which is where the
 *   real write happens. Undo before then is a local cancel that cannot fail. A host that
 *   forgets to run commits turns every reversible action into a no-op, so the timer and the
 *   unmount path both drain the queue.
 *
 * ANNOUNCED, NOT JUST DRAWN
 *   `role="status"` / `aria-live="polite"`, so a user who cannot see the corner of the screen
 *   is still told what happened — and told it in the same specific words.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createUndoState,
  dismissToast,
  expireToasts,
  pushToast,
  undoToast,
  type LiveToast,
  type UndoableEntry,
  type UndoState,
} from '../lib/undo';
import './components.css';

export interface ToastHandle {
  show: (entry: UndoableEntry) => void;
}

export function useToasts(tickMs = 500): {
  state: UndoState;
  show: (entry: UndoableEntry) => void;
  undo: (id: string) => void;
  dismiss: (id: string) => void;
} {
  const [state, setState] = useState<UndoState>(() => createUndoState());
  // Commits are side effects: they are collected from the pure reducer and run here, never
  // inside a setState updater, which React may call more than once.
  const pending = useRef<LiveToast[]>([]);

  const drain = useCallback(() => {
    const due = pending.current;
    pending.current = [];
    for (const t of due) void t.undo?.commit();
  }, []);

  const show = useCallback((entry: UndoableEntry) => {
    setState((s) => {
      const r = pushToast(s, entry, Date.now());
      pending.current.push(...r.commit);
      return r.state;
    });
  }, []);

  const undo = useCallback((id: string) => {
    setState((s) => {
      const r = undoToast(s, id, Date.now());
      if (r.outcome === 'undone' && r.entry?.undo?.cancel) void r.entry.undo.cancel();
      // 'too-late' keeps the toast on screen with its Undo spent; the caller shows the honest
      // line rather than the host silently doing nothing.
      return r.state;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setState((s) => {
      const r = dismissToast(s, id);
      pending.current.push(...r.commit);
      return r.state;
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => {
        const r = expireToasts(s, Date.now());
        pending.current.push(...r.commit);
        return r.state;
      });
      drain();
    }, tickMs);
    return () => {
      clearInterval(t);
      // Unmounting must not swallow a pending write. Everything still live commits now.
      setState((s) => {
        const r = expireToasts(s, Number.POSITIVE_INFINITY);
        pending.current.push(...r.commit);
        return r.state;
      });
      drain();
    };
  }, [drain, tickMs]);

  useEffect(drain);

  return { state, show, undo, dismiss };
}

export function ToastHost({
  state,
  onUndo,
  onDismiss,
  testId = 'toast',
}: {
  state: UndoState;
  onUndo: (id: string) => void;
  onDismiss: (id: string) => void;
  testId?: string;
}) {
  if (state.toasts.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite" data-testid={testId}>
      {state.toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone ?? 'success'}`} data-testid={`${testId}-${t.id}`}>
          <span className="toast__message" data-testid={`${testId}-${t.id}-message`}>
            {t.message}
          </span>
          {t.undo && (
            <button
              data-testid={`${testId}-${t.id}-undo`}
              type="button"
              className="toast__undo"

              onClick={() => onUndo(t.id)}
            >
              {t.undo.label ?? 'Undo'}
            </button>
          )}
          <button
            data-testid={`${testId}-${t.id}-dismiss`}
            type="button"
            className="toast__dismiss"
            aria-label="Dismiss this message"

            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
