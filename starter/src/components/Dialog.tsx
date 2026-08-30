'use client';
/**
 * CP-14 (dialogs never eat work) + CP-16 (focus).
 *
 * THE BUG THIS PREVENTS
 *   A dialog that dismisses on a backdrop tap discards everything typed into it. One stray tap
 *   — a mis-aimed scroll, a fat thumb near the edge — costs a user five minutes of work, with
 *   no undo and no explanation. It is not a rare event; it is a daily one at scale.
 *
 * THE RULES, and each is a default that must be opted OUT of rather than into:
 *   1. A backdrop tap does NOT dismiss an input dialog.
 *   2. Closing with unsaved changes asks first.
 *   3. Focus moves to the first field on open, and RETURNS to the opener on close.
 *   4. Escape closes only a dialog with nothing to lose.
 *   5. Focus is trapped while it is open, or a keyboard user tabs into the page behind it.
 */
import React, { useCallback, useEffect, useRef } from 'react';

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  hasUnsavedChanges = false,
  /** Opt-in, and it needs a reason: correct for a read-only preview, wrong for anything with input. */
  dismissOnBackdrop = false,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hasUnsavedChanges?: boolean;
  dismissOnBackdrop?: boolean;
  testId: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges && !window.confirm('Discard your changes?')) return;
    onClose();
  }, [hasUnsavedChanges, onClose]);

  // The focus effect below must depend on `open` ALONE. Depending on requestClose re-runs it
  // the moment hasUnsavedChanges flips - which is the user's FIRST KEYSTROKE - and the re-run
  // "returns" focus to the opener and then re-focuses the first field, yanking the caret out
  // of whatever the user was typing. The ref gives the key handler the current closure
  // without making it a dependency.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => { requestCloseRef.current = requestClose; }, [requestClose]);

  useEffect(() => {
    if (!open) return;

    // Remember who opened this. Returning focus to the void on close strands a keyboard user
    // at the top of the document with no idea where they were.
    openerRef.current = document.activeElement as HTMLElement | null;

    const first = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select, [contenteditable=true], button'
    );
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); requestCloseRef.current(); return; }
      if (e.key !== 'Tab') return;

      // Trap: without this, Tab walks into the page behind the dialog, which is still there.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dialog__backdrop"
      data-testid={`${testId}-backdrop`}
      onClick={dismissOnBackdrop ? requestClose : undefined}
    >
      <div
        ref={panelRef}
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${testId}-title`} className="dialog__title">{title}</h2>
        <div className="dialog__body">{children}</div>
        {/* CP-19: peers share one treatment, at most one is primary, and a destructive control
            is never adjacent to it. That grouping is the footer's job, not each caller's. */}
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}
