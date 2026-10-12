'use client';

import * as React from 'react';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { TABLE_MOVE_COPY, tableMovedMessage } from '@/lib/table-move';

/**
 * "Move to another table" - the one dialog, on the captain's floor and the owner's (12-Oct-2026).
 *
 * The existing ConfirmDialog, its chips holding the free tables to choose from instead of reasons.
 * Nothing is sent until a table is chosen and the confirmation pressed; the server decides whether
 * it can be done (`moveOrderToTable`) and its own words are shown when it refuses.
 */
export interface MoveTarget {
  billId: string;
  tableId: string;
  tableName: string;
}

export function MoveTableDialog({
  target,
  freeTables,
  onClose,
  endpoint,
  send,
  runBusy,
  busy,
  testId,
}: {
  target: MoveTarget | null;
  /** The tables it may move to, in floor order (`tableMoveTargets`). */
  freeTables: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
  endpoint: '/api/staff/action' | '/api/owner/action';
  send: <R>(path: string, payload: unknown) => Promise<R>;
  runBusy: (fn: () => Promise<void>) => void;
  busy: boolean;
  testId: string;
}) {
  const toast = useToast();
  const [chosen, setChosen] = React.useState('');
  const to = freeTables.find((t) => t.name === chosen) ?? null;

  const close = () => {
    setChosen('');
    onClose();
  };

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(v) => !v && close()}
      title={target ? TABLE_MOVE_COPY.title(target.tableName) : TABLE_MOVE_COPY.action}
      tone="primary"
      consequence={
        <>
          <p className="m-0">{TABLE_MOVE_COPY.body}</p>
          {freeTables.length === 0 ? (
            <p className="m-0 mt-2 type-caption text-[var(--text-muted)]" data-testid={`${testId}-none`}>
              {TABLE_MOVE_COPY.noFreeTable}
            </p>
          ) : null}
        </>
      }
      confirmLabel={to ? TABLE_MOVE_COPY.confirm(to.name) : TABLE_MOVE_COPY.confirmNone}
      keepLabel={TABLE_MOVE_COPY.keep}
      reasons={freeTables.map((t) => t.name)}
      reasonsLabel={TABLE_MOVE_COPY.pick}
      reason={chosen}
      onReasonChange={(name) => setChosen(name === chosen ? '' : name)}
      testId={testId}
      busy={busy || !to}
      onConfirm={() => {
        const t = target;
        if (!t || !to) return;
        runBusy(async () => {
          try {
            const out = await send<{ billCode?: string; from?: string; to?: string }>(endpoint, {
              action: 'move-table',
              billId: t.billId,
              fromTableId: t.tableId,
              toTableId: to.id,
            });
            toast.show(tableMovedMessage(out.billCode ?? 'The order', out.from || t.tableName, out.to || to.name), {
              tone: 'success',
            });
          } finally {
            close();
          }
        });
      }}
    />
  );
}
