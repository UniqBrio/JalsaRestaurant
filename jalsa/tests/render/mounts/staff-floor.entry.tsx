/**
 * Mounts the REAL captain's floor (FloorScreen) with the tables the spec hands in
 * (staff-floor-actions.render.spec.ts, 08-Oct-2026). Only what the floor reads is supplied.
 */
import './process-shim';
import { createRoot } from 'react-dom/client';
import { FloorScreen } from '../../../src/features/staff/StaffTables';
import { ToastProvider } from '../../../src/components/ui/toast';
import type { StaffScreenProps } from '../../../src/features/staff/StaffApp';

declare global {
  interface Window {
    __tables: unknown[];
    __grants: string[];
  }
}

const data = { grants: window.__grants, isWaiter: false, tables: window.__tables } as unknown as StaffScreenProps['data'];
const noop = () => undefined;

const host = document.createElement('div');
host.id = 'floor-host';
host.style.cssText = 'padding:16px;box-sizing:border-box;width:100%;max-width:38rem';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <FloorScreen
      data={data}
      go={noop}
      selectedBillId={null}
      selectedTableId={null}
      goFreeTable={noop}
      send={(async () => ({})) as StaffScreenProps['send']}
      busy={false}
      runBusy={noop}
    />
  </ToastProvider>
);
