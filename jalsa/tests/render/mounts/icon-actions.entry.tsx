/**
 * Mounts the REAL owner Menu section for icon-actions.render.spec.ts (13-Oct-2026): two dishes on
 * the menu and one OFF it, so the "Off the customer menu right now" strip is drawn. `send` records
 * what the screen sends; `window.__iaGrants` (set before this bundle runs) chooses the grants.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { MenuSection } from '../../../src/features/owner/sections/MenuSection';
import { ToastProvider, useToast } from '../../../src/components/ui/toast';
import type { OwnerPayload } from '../../../src/lib/db/owner-view';
import type { OwnerSectionProps } from '../../../src/features/owner/OwnerConsole';

declare global {
  interface Window {
    __iaSent: Array<Record<string, unknown>>;
    __iaGrants?: string[];
  }
}

window.__iaSent = [];

const menu = [
  { id: 'm1', name: 'Paneer Tikka', category: 'Starters', categoryId: 'c1', price: 240, priceLabel: '₹240', foodType: 'veg', foodTypeId: 'f1', foodTypeName: 'Veg', available: true, closedReason: '', description: '', imageUrl: '', printerId: null, station: null },
  { id: 'm2', name: 'Chicken 65', category: 'Starters', categoryId: 'c1', price: 280, priceLabel: '₹280', foodType: 'non_veg', foodTypeId: 'f2', foodTypeName: 'Non-veg', available: true, closedReason: '', description: '', imageUrl: '', printerId: null, station: null },
  { id: 'm3', name: 'Mutton Biryani', category: 'Mains', categoryId: 'c2', price: 420, priceLabel: '₹420', foodType: 'non_veg', foodTypeId: 'f2', foodTypeName: 'Non-veg', available: false, closedReason: '', description: '', imageUrl: '', printerId: null, station: null },
] as unknown as OwnerPayload['menu'];
const categories = [
  { id: 'c1', name: 'Starters', count: 2, parentId: null },
  { id: 'c2', name: 'Mains', count: 1, parentId: null },
];
const foodTypes = [
  { id: 'f1', name: 'Veg', kotClass: 'veg', count: 1 },
  { id: 'f2', name: 'Non-veg', kotClass: 'non_veg', count: 2 },
] as unknown as OwnerPayload['foodTypes'];

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
    window.__iaSent.push(payload);
    await new Promise((r) => setTimeout(r, 50));
    return { done: true };
  }) as OwnerSectionProps['send'];
  const data = {
    menu,
    categories,
    foodTypes,
    grants: window.__iaGrants ?? ['menu.item_edit', 'menu.availability', 'menu.category'],
    printers: [],
    settings: { routing: {} },
  } as unknown as OwnerPayload;

  return (
    <div style={{ padding: 16 }}>
      <MenuSection data={data} send={send} runBusy={runBusy} busy={busy} go={() => undefined} arg={null} />
    </div>
  );
}

const host = document.createElement('div');
host.id = 'icon-actions-host';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <Harness />
  </ToastProvider>
);
