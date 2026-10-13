/**
 * Mounts the REAL owner screens whose Edit and Delete became icons on 13-Oct-2026, beside the Menu
 * (icon-actions.render.spec.ts): Settings → Tables & QR, Staff, Expenses, Printers, Print setup.
 * `window.__iaScreen` (set before this bundle runs) picks the screen; every grant is held, so every
 * opener is drawn. `send` records what a screen sends.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsSection } from '../../../src/features/owner/sections/SettingsSection';
import { StaffSection } from '../../../src/features/owner/sections/StaffSection';
import { ExpensesSection } from '../../../src/features/owner/sections/LedgersSection';
import { PrintersSection } from '../../../src/features/owner/sections/PrintersSection';
import { PrintSetupSection } from '../../../src/features/owner/sections/PrintSetupSection';
import { ToastProvider, useToast } from '../../../src/components/ui/toast';
import type { OwnerPayload } from '../../../src/lib/db/owner-view';
import type { OwnerSectionProps } from '../../../src/features/owner/OwnerConsole';

export type IconScreen = 'tables' | 'staff' | 'expenses' | 'printers' | 'printsetup';

declare global {
  interface Window {
    __iaScreen?: IconScreen;
    __iaScreenSent: Array<Record<string, unknown>>;
  }
}

window.__iaScreenSent = [];

const NOW = '2026-10-13T08:00:00.000Z';

const employment = {
  employeeCode: '', designation: '', department: '', joinedOn: '', lastWorkingDay: '', gender: '',
  employmentType: '', monthlySalary: null, reportsTo: '', shift: '', email: '', homeAddress: '', pan: '', uan: '', bankLast4: '',
};

const printer = {
  id: 'p1', machineId: 'TVS-01', name: 'Tandoor printer', purpose: 'KOT', roles: ['KOT'], defaultFor: ['KOT'],
  station: 'Main Kitchen', paperMm: 80, routes: [], chefs: [], connection: 'Ethernet', address: '192.168.1.40',
  port: 9100, online: false, enabled: true, lastSeenAt: null, createdAt: NOW, lastPrintedAt: null,
};

const data = {
  me: { id: 's0', name: 'Javeed Ahmed', role: 'Owner', initials: 'JA' },
  grants: [
    'set.tables', 'tables.qr', 'queue.close', 'staff.create', 'staff.perms', 'staff.pin', 'day.setup',
    'staff.paperwork', 'expense.manage', 'rep.sales', 'set.printer', 'orders.reprint', 'menu.item_edit',
  ],
  restaurant: { id: 'r1', slug: 'jalsa-hosur', display_name: 'Jalsa', logo_url: '/brand/jalsa-badge.png' },
  settings: { routing: {}, engagement: {}, tax: { rate: 5 } },
  today: {
    salesLabel: '₹0', sales: 0, orders: 0, coversLabel: '0', tipsLabel: '₹0', tips: 0, discountsLabel: '₹0',
    openBills: 0, awaitingClosure: 0, openRequests: 0, printFailures: 0, printWaiting: 0, paymentMix: [],
  },
  floor: [
    { id: 't5', name: 'A5', zone: 'AC', seats: 4, active: true, stateLabel: 'Free', tone: 'success', billId: null, line: '', totalLabel: '', freeable: false, roundCount: 0, clearing: null, state: 'free', phonesAttached: 0 },
  ],
  openBills: [],
  closedToday: [],
  requests: [],
  suggestions: [],
  menu: [],
  categories: [],
  foodTypes: [],
  staff: [
    { id: 's1', name: 'Ravi Kumar', role: 'Captain', initials: 'RK', mobile: '9876543210', active: true, onDuty: true, hasPin: true, standingTables: [], liveTables: [], employment },
  ],
  staffGrants: { s1: [] },
  tips: [],
  waitlist: [],
  tipsTotalLabel: '₹0',
  expenses: [{ id: 'e1', spentOn: '2026-10-12', category: 'Gas', note: 'Cylinder', amount: 450, enteredBy: 'Javeed Ahmed' }],
  expensesTotalLabel: '₹450',
  printers: [printer],
  bridges: [],
  // A paired computer, so Printers lists its machines rather than the first-run card (whose
  // next/image this bundle does not resolve).
  printComputers: [
    { id: 'c1', label: 'Counter computer', source: 'paired', hostname: 'COUNTER', bridgeVersion: '1.0.0', lastSeenAt: NOW, createdAt: NOW, discovered: [] },
  ],
  printerMappings: [{ printerId: 'p1', computerId: 'c1', queueName: 'TVS RP3160' }],
  pairing: null,
  printBridgeDownload: { available: false },
  printJobs: [],
  audit: [],
  qrOrigin: 'http://localhost:3000',
} as unknown as OwnerPayload;

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
  const send = (async (_path: string, payload: Record<string, unknown>) => {
    window.__iaScreenSent.push(payload);
    await new Promise((r) => setTimeout(r, 50));
    return { done: true };
  }) as OwnerSectionProps['send'];
  const props = { data, send, runBusy, busy, go: () => undefined } as const;
  const screen = window.__iaScreen ?? 'tables';
  return (
    <div style={{ padding: 16 }} data-testid="ia-screen">
      {screen === 'tables' ? <SettingsSection {...props} arg="tables" /> : null}
      {screen === 'staff' ? <StaffSection {...props} arg={null} /> : null}
      {screen === 'expenses' ? <ExpensesSection {...props} arg={null} /> : null}
      {screen === 'printers' ? <PrintersSection {...props} arg={null} /> : null}
      {screen === 'printsetup' ? <PrintSetupSection {...props} arg={null} /> : null}
    </div>
  );
}

const host = document.createElement('div');
host.id = 'icon-actions-screens-host';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <Harness />
  </ToastProvider>
);
