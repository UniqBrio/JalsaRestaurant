/**
 * Mounts the REAL screens the 12-Oct-2026 corrections changed (corrections-12oct.render.spec.ts):
 * the Takeaway dialog (NewRoundSheet) for a new takeaway and for Add items, the owner's Menu
 * section with its Edit and Delete, and the shared Select and Combobox. `send` records what the
 * screens send; `window.__c12Answer` chooses the server's answer.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { NewRoundSheet, type RoundTarget } from '../../../src/features/owner/sections/Dashboard';
import { MenuSection } from '../../../src/features/owner/sections/MenuSection';
import { Select } from '../../../src/components/ui/field';
import { Combobox } from '../../../src/components/ui/combobox';
import { ToastProvider, useToast } from '../../../src/components/ui/toast';
import type { OwnerPayload } from '../../../src/lib/db/owner-view';
import type { OwnerSectionProps } from '../../../src/features/owner/OwnerConsole';

declare global {
  interface Window {
    __c12Sent: Array<Record<string, unknown>>;
    __c12Answer: 'ok' | 'refuse-photo' | 'refuse-delete';
  }
}

window.__c12Sent = [];
window.__c12Answer = 'ok';

const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const menu = [
  { id: 'm1', name: 'Paneer Tikka', category: 'Starters', categoryId: 'c1', price: 240, priceLabel: '₹240', foodType: 'veg', foodTypeId: 'f1', foodTypeName: 'Veg', available: true, closedReason: '', description: '', imageUrl: '', printerId: null, station: null },
  { id: 'm2', name: 'Chicken 65', category: 'Starters', categoryId: 'c1', price: 280, priceLabel: '₹280', foodType: 'non_veg', foodTypeId: 'f2', foodTypeName: 'Non-veg', available: true, closedReason: '', description: '', imageUrl: '', printerId: null, station: null },
] as unknown as OwnerPayload['menu'];
const categories = [{ id: 'c1', name: 'Starters', count: 2, parentId: null }];
const foodTypes = [
  { id: 'f1', name: 'Veg', kotClass: 'veg', count: 1 },
  { id: 'f2', name: 'Non-veg', kotClass: 'non_veg', count: 1 },
] as unknown as OwnerPayload['foodTypes'];
const grants = ['orders.create', 'orders.add_items', 'menu.item_edit', 'menu.availability'];

function Harness() {
  const toast = useToast();
  const [target, setTarget] = React.useState<RoundTarget | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [went, setWent] = React.useState('');
  const [selectValue, setSelectValue] = React.useState('veg');
  const [comboValue, setComboValue] = React.useState('c1');
  const runBusy = (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void fn()
      .catch((err: unknown) => toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' }))
      .finally(() => setBusy(false));
  };
  const send = (async (_path: string, payload: Record<string, unknown>) => {
    window.__c12Sent.push(payload);
    await new Promise((r) => setTimeout(r, 50));
    if (payload.action === 'takeaway-photo' && window.__c12Answer === 'refuse-photo') throw new Error('The photo could not be saved. Try again.');
    if (payload.action === 'delete-item' && window.__c12Answer === 'refuse-delete') throw new Error('That item is no longer on the menu. Reload the page.');
    if (payload.action === 'takeaway') return { kotCode: 'KOT-7', billCode: 'TK-3', billId: 'bill-new', refused: [] };
    if (payload.action === 'takeaway-photo') return { photoUrl: DOT };
    return { done: true, kotCode: 'KOT-8', billId: 'bill-more' };
  }) as OwnerSectionProps['send'];
  const data = {
    menu,
    categories,
    foodTypes,
    grants,
    printers: [],
    settings: { routing: {} },
  } as unknown as OwnerPayload;

  return (
    <div style={{ padding: 16 }}>
      <button type="button" data-testid="open-takeaway" onClick={() => setTarget({ kind: 'takeaway' })}>
        new
      </button>
      <button
        type="button"
        data-testid="open-takeaway-more"
        onClick={() => setTarget({ kind: 'takeaway-more', billId: 'bill-more', code: 'TK-2', photoUrl: '' })}
      >
        more
      </button>
      <span data-testid="went">{went}</span>
      <NewRoundSheet
        key={target ? target.kind : 'none'}
        target={target}
        onClose={() => setTarget(null)}
        menu={menu}
        categories={categories}
        foodTypes={foodTypes}
        grants={grants}
        welcomeDrinks={{ enabled: false, itemIds: [] }}
        send={send}
        runBusy={runBusy}
        busy={busy}
        go={(section, arg) => setWent(`${section}:${arg ?? ''}`)}
        tax={{ rate: 5 }}
      />

      <div style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0' }}>
        <Select data-testid="probe-select" aria-label="Probe select" value={selectValue} onChange={(e) => setSelectValue(e.target.value)}>
          <option value="veg">Veg</option>
          <option value="non_veg">Non-veg</option>
        </Select>
        <Combobox
          testId="probe-combo"
          ariaLabel="Probe combobox"
          placeholder="Choose a category"
          value={comboValue}
          onValueChange={setComboValue}
          options={[{ value: 'c1', label: 'Starters' }]}
        />
      </div>

      <MenuSection data={data} send={send} runBusy={runBusy} busy={busy} go={() => undefined} arg={null} />
    </div>
  );
}

const host = document.createElement('div');
host.id = 'corrections-host';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <Harness />
  </ToastProvider>
);
