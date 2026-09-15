'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * toast — the message that says what happened, in specifics, with Undo where undo is possible.
 *
 * TWO STANDARDS MEET HERE
 *   5.4  Reversible actions confirm AFTERWARDS with an Undo, rather than asking first. Undo is
 *        faster than a confirmation for the ninety-nine taps that were intentional, and kinder
 *        for the one that was not. Confirmations are reserved for what undo cannot reach.
 *   5.5  The message names the record and the values — "Dal Fry ×2 added", not "Saved". A
 *        specific message doubles as a receipt, and a receipt is what stops the next tap being
 *        a second one "just in case".
 *
 * WHY THE TIMER PAUSES ON HOVER AND FOCUS
 *   An Undo that disappears while someone is reaching for it is worse than no Undo, because
 *   they were promised one.
 *
 * WHY THE PILL ITSELF TAKES NO CLICKS
 *   It sits over the bottom action bar. A guest who sends a round and immediately taps "See my
 *   order" is tapping through the confirmation that their tap worked — and for six seconds the
 *   whole pill swallowed that tap, because the row carried `pointer-events-auto` while only its
 *   two buttons need it. CI run 34866569730 caught it on `guest-see-my-order`: the button
 *   "visible, enabled and stable", the click retried until the test gave up, and Playwright
 *   naming `<div data-testid="toast">` as the element that would receive it.
 *
 *   So the pill is inert and the CONTROLS are live. Nothing about how it looks, animates, reads
 *   out or expires changes; what changes is that a message about what just happened no longer
 *   blocks the next thing the guest wants to do.
 */

export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'neutral' | 'success' | 'error';
  undo?: () => void;
}

interface ToastApi {
  show: (text: string, opts?: { tone?: ToastMessage['tone']; undo?: () => void }) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const LIFETIME_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastMessage[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback<ToastApi['show']>((text, opts) => {
    const id = nextId.current++;
    setItems((cur) => [
      ...cur.slice(-2),
      { id, text, tone: opts?.tone ?? 'neutral', ...(opts?.undo ? { undo: opts.undo } : {}) },
    ]);
  }, []);

  const api = React.useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // aria-live so the message is announced, not only seen. A confirmation nobody hears is
        // a confirmation half the users never get.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--layout-bottom-chrome-clearance)+0.5rem)] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const t = setTimeout(onDismiss, LIFETIME_MS);
    return () => clearTimeout(t);
  }, [paused, onDismiss]);

  const tone =
    toast.tone === 'success'
      ? 'bg-[var(--success-surface)] text-[var(--on-success-surface)]'
      : toast.tone === 'error'
        ? 'bg-[var(--error-surface)] text-[var(--on-error-surface)]'
        : 'bg-[var(--text-body)] text-[var(--background)]';

  return (
    <div
      data-testid="toast"
      className={cn(
        'pointer-events-none flex w-full max-w-[30rem] items-center gap-3 rounded-full px-4 py-3 text-[12.5px] font-semibold shadow-[var(--shadow-raised)]',
        tone
      )}
    >
      <span className="min-w-0 flex-1">{toast.text}</span>
      {/* The only live part. It hugs the right edge, so what it covers is the end of the bar
          rather than the middle of whatever is under the message. The pause handlers live here
          rather than on the pill because this is the thing a person reaches FOR: `onFocus`
          bubbles, so tabbing to Undo pauses the timer too. */}
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="pointer-events-auto flex shrink-0 items-center gap-3"
      >
        {toast.undo ? (
          <button
            data-testid="toast-undo"
            type="button"
            onClick={() => {
              toast.undo?.();
              onDismiss();
            }}
            className="shrink-0 rounded-full px-3 py-1 text-[12px] font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Undo
          </button>
        ) : null}
        <button
          data-testid="toast-dismiss"
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded-full px-1.5 text-[15px] leading-none opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  // A toast that silently does nothing is how a "saved" message goes missing in production
  // and nobody notices for a month. Fail at the call site instead.
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}
