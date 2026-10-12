/**
 * Mounts the REAL captain's floor (FloorScreen) for "Move to another table"
 * (table-move.render.spec.ts, 12-Oct-2026). `send` records what the floor sends; the spec chooses
 * the server's answer through `window.__moveAnswer`.
 */
import './process-shim';
import { createRoot } from 'react-dom/client';
import * as React from 'react';
import { FloorScreen } from '../../../src/features/staff/StaffTables';
import { ToastProvider, useToast } from '../../../src/components/ui/toast';
import type { StaffScreenProps } from '../../../src/features/staff/StaffApp';

declare global {
  interface Window {
    __tables: unknown[];
    __grants: string[];
    __moveSent: unknown[];
    __moveAnswer: 'moved' | 'taken';
  }
}
window.__moveSent = [];
window.__moveAnswer = 'moved';

const data = { grants: window.__grants, isWaiter: false, tables: window.__tables } as unknown as StaffScreenProps['data'];
const noop = () => undefined;

function Harness() {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const runBusy = (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void fn()
      .catch((err: unknown) => toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' }))
      .finally(() => setBusy(false));
  };
  const send = (async (_path: string, payload: unknown) => {
    window.__moveSent.push(payload);
    await new Promise((r) => setTimeout(r, 50));
    if (window.__moveAnswer === 'taken') throw new Error('That table is no longer free. Choose another.');
    return { done: true, billCode: 'B-0412', from: 'A1', to: 'A2' };
  }) as StaffScreenProps['send'];
  return (
    <FloorScreen
      data={data}
      go={noop}
      selectedBillId={null}
      selectedTableId={null}
      goFreeTable={noop}
      send={send}
      busy={busy}
      runBusy={runBusy}
    />
  );
}

const host = document.createElement('div');
host.id = 'move-floor-host';
host.style.cssText = 'padding:16px;box-sizing:border-box;width:100%;max-width:38rem';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <Harness />
  </ToastProvider>
);
