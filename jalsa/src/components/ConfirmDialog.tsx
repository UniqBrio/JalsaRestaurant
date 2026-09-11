'use client';
/**
 * ConfirmDialog - the one way this application asks "are you sure?".
 *
 * WHY A WRAPPER AND NOT A COPY OF Dialog
 *   It composes `Dialog`, so the focus trap, the focus return, the no-backdrop-dismiss rule
 *   and the unsaved-changes guard all come from CP-14 rather than being re-implemented with
 *   small differences. A second dialog implementation is how one screen dismisses on a
 *   backdrop tap and the next does not.
 *
 * WHEN TO USE IT - AND WHEN NOT TO
 *   Confirm a **destructive** action (delete, cancel, revoke) or a **session-ending** one
 *   (sign out). Do NOT confirm a reversible action: the blessed pattern there is immediate
 *   action plus undo (docs/04 §5). A confirmation on something reversible trains the user to
 *   click through confirmations without reading them, which is exactly how the dangerous one
 *   gets clicked through too.
 *
 * THE DESTRUCTIVE VARIANT IS SEPARATED, NOT JUST RED
 *   `tone="destructive"` renders the confirm control apart from Cancel and names the action in
 *   its own label ("Delete invoice", never "OK"). Colour alone is not a warning, and a button
 *   labelled "OK" tells the user nothing about what they are agreeing to.
 */
import React from 'react';
import { Dialog } from './Dialog';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
  busy = false,
  testId = 'confirm',
}: {
  open: boolean;
  title: string;
  /** What will happen, in the user's words. Never "Are you sure?" alone - say what changes. */
  message: string;
  /** Name the action: "Sign out", "Delete invoice". Never "OK" or "Yes". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
  /** In flight - the confirm control is held so a double tap cannot fire it twice. */
  busy?: boolean;
  testId?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      testId={testId}
      // Nothing is typed here, so Escape and a backdrop tap are safe exits from a question.
      dismissOnBackdrop
      footer={
        <div className={`confirm__actions confirm__actions--${tone}`}>
          <button
            data-testid={`${testId}-cancel`}
            type="button"
            className="confirm__cancel"

            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            data-testid={`${testId}-ok`}
            type="button"
            className={`confirm__ok confirm__ok--${tone}`}
            aria-disabled={busy}

            onClick={() => {
              if (!busy) onConfirm();
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="confirm__message">{message}</p>
    </Dialog>
  );
}
