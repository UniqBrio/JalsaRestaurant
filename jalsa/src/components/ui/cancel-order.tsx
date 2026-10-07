'use client';

import * as React from 'react';
import { ConfirmDialog } from '@/components/ui/sheet';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  ORDER_CANCEL_COPY,
  ORDER_CANCEL_REASONS,
  OTHER_NOTE_MAX,
  orderCancelReason,
  orderCancelledMessage,
} from '@/lib/order-cancel';

/**
 * "Cancel order & free table" - the one dialog, on the captain's floor and the owner's (07-Oct-2026).
 *
 * The existing ConfirmDialog, with the requested words, the reason chips and, for "Other", a short
 * line of text. A reason is optional; "Other" needs its few words. The server decides whether it
 * can be done (`cancelOrderAndFreeTable`); this only asks, sends once (`busy` holds the button),
 * and says what happened - the server's own words when it refuses, never a database message.
 */
export interface CancelTarget {
  billId: string;
  tableId: string;
  tableName: string;
  /** The rounds the tile showed when the dialog opened - sent, so a round added since is refused. */
  rounds: number;
}

export function CancelOrderDialog({
  target,
  onClose,
  endpoint,
  send,
  runBusy,
  busy,
  testId,
}: {
  target: CancelTarget | null;
  onClose: () => void;
  endpoint: '/api/staff/action' | '/api/owner/action';
  send: <R>(path: string, payload: unknown) => Promise<R>;
  runBusy: (fn: () => Promise<void>) => void;
  busy: boolean;
  testId: string;
}) {
  const toast = useToast();
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [problem, setProblem] = React.useState<string | null>(null);
  const noteId = React.useId();

  const close = () => {
    setReason('');
    setNote('');
    setProblem(null);
    onClose();
  };

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(v) => !v && close()}
      title={ORDER_CANCEL_COPY.title}
      consequence={
        <>
          <p className="m-0">{ORDER_CANCEL_COPY.body}</p>
          {target ? (
            <p className="m-0 mt-2 type-caption text-[var(--text-muted)]" data-testid={`${testId}-table`}>
              Table {target.tableName}
            </p>
          ) : null}
        </>
      }
      confirmLabel={ORDER_CANCEL_COPY.confirm}
      keepLabel={ORDER_CANCEL_COPY.keep}
      reasons={ORDER_CANCEL_REASONS}
      reason={reason}
      onReasonChange={(r) => {
        setReason(r === reason ? '' : r);
        setProblem(null);
      }}
      testId={testId}
      busy={busy}
      onConfirm={() => {
        const t = target;
        if (!t) return;
        const why = orderCancelReason(reason, note);
        if (!why.ok) {
          setProblem(why.problem);
          return;
        }
        runBusy(async () => {
          try {
            const out = await send<{ tables?: string[] }>(endpoint, {
              action: 'cancel-free-table',
              billId: t.billId,
              tableId: t.tableId,
              reason,
              note,
              rounds: t.rounds,
            });
            toast.show(orderCancelledMessage(out.tables?.length ? out.tables : [t.tableName]), { tone: 'success' });
          } finally {
            close();
          }
        });
      }}
    >
      {reason === 'Other' ? (
        <Field label="What happened" htmlFor={noteId} error={problem}>
          <Input
            id={noteId}
            data-testid={`${testId}-note`}
            value={note}
            maxLength={OTHER_NOTE_MAX}
            placeholder={ORDER_CANCEL_COPY.otherPlaceholder}
            onChange={(e) => {
              setNote(e.target.value);
              setProblem(null);
            }}
          />
        </Field>
      ) : null}
    </ConfirmDialog>
  );
}
