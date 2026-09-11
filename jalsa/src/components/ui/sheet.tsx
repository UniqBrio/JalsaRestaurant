'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { Button } from './button';

/**
 * sheet — the bottom sheet on the guest and staff phones, and the centred modal on the owner's
 * desktop. ONE component, two postures (Standard 10.4: consolidate before adding; 10.2: layout
 * follows density, not device).
 *
 * ONE CLOSE AFFORDANCE, AND IT IS THE X (Standard 1.5)
 *   An X at the top right and nothing else meaning the same thing. The footer carries the real
 *   decision — Save and Cancel — and Cancel is a decision, not a second close. Two closes make
 *   people stop and work out whether they differ; they never do.
 *
 * Radix handles the parts that are invisible until they are wrong: focus trapping, restoring
 * focus to the trigger on close, Escape, scroll locking, and aria-modal wiring.
 */

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The line under the title. The design set uses it constantly to say what the sheet is for. */
  description?: string;
  children: React.ReactNode;
  /** The footer decision. Omit for a sheet that is purely informational. */
  footer?: React.ReactNode;
  posture?: 'sheet' | 'modal';
  testId: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  posture = 'sheet',
  testId,
}: SheetProps) {
  const isModal = posture === 'modal';
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="j-scrim fixed inset-0 z-50 data-[state=open]:animate-in data-[state=open]:fade-in"
          data-testid={`${testId}-scrim`}
        />
        <DialogPrimitive.Content
          data-testid={testId}
          className={cn(
            'fixed z-50 flex flex-col bg-[var(--surface-raised)] shadow-[var(--shadow-raised)] focus:outline-none',
            isModal
              ? 'left-1/2 top-1/2 max-h-[88vh] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-xl)]'
              : // Bottom-anchored, capped at 88% so the guest can always see which screen they
                // are on behind it — a full-height sheet is just a page with no back button.
                'inset-x-0 bottom-0 max-h-[88vh] rounded-t-[var(--radius-xl)]'
          )}
        >
          <header className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[17px] font-semibold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <button
                data-testid={`${testId}-close`}
                type="button"
                aria-label="Close"

                className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[19px] leading-none text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              >
                ×
              </button>
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>

          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom)]" />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The ONE confirm dialog (Standard 5.3 and 10.4).
 *
 * It states what will happen IN SPECIFICS — never "Are you sure?" — and the destructive action
 * is labelled by its verb, so the button someone taps without reading still says what it does.
 * Where a reason is required it is captured here, because a reason asked for afterwards is a
 * reason nobody gives.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  onConfirm,
  tone = 'danger',
  reasons,
  reason,
  onReasonChange,
  testId,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: 'danger' | 'primary';
  reasons?: readonly string[];
  reason?: string;
  onReasonChange?: (r: string) => void;
  testId: string;
  busy?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      posture="modal"
      testId={testId}
      footer={
        <>
          <Button data-testid={`${testId}-keep`} variant="ghost" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button data-testid={`${testId}-confirm`} variant={tone} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-[13px] leading-relaxed">
        <div>{consequence}</div>
        {reasons?.length ? (
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.11em] text-[var(--text-muted)]">
              Why — recorded in the audit log
            </legend>
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => (
                <button
                  data-testid={`${testId}-reason-${r.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => onReasonChange?.(r)}

                  className={cn(
                    'min-h-11 rounded-full px-4 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                    reason === r
                      ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                      : 'border border-[var(--border-strong)]/25 bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>
    </Sheet>
  );
}
