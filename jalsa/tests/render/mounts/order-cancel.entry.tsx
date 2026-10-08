/**
 * Mounts the REAL CancelOrderDialog and the REAL ImagePicker in photo mode
 * (order-cancel.render.spec.ts, 07-Oct-2026). `send`, `upload` and `remove` record what the
 * component sends; the spec chooses the server's answer through `window.__answer`.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CancelOrderDialog, type CancelTarget } from '../../../src/components/ui/cancel-order';
import { ImagePicker } from '../../../src/components/ui/image-picker';
import { ToastProvider, useToast } from '../../../src/components/ui/toast';

declare global {
  interface Window {
    __sent: unknown[];
    __answer: 'ok' | 'gone';
    __delay: number;
    __uploads: string[];
    __removed: number;
  }
}

window.__sent = [];
window.__answer = 'ok';
window.__delay = 150;
window.__uploads = [];
window.__removed = 0;

const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function Harness() {
  const toast = useToast();
  const [target, setTarget] = React.useState<CancelTarget | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [photo, setPhoto] = React.useState('');
  const runBusy = (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void fn()
      .catch((err: unknown) => toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' }))
      .finally(() => setBusy(false));
  };
  const send = async <R,>(_path: string, payload: unknown): Promise<R> => {
    window.__sent.push(payload);
    await new Promise((r) => setTimeout(r, window.__delay));
    if (window.__answer === 'gone') throw new Error('This order has already been cancelled or completed.');
    return { done: true, billCode: 'B-0412', tables: ['12'] } as R;
  };
  return (
    <div style={{ padding: 16 }}>
      <button type="button" data-testid="open-cancel" onClick={() => setTarget({ billId: 'b1', tableId: 't1', tableName: '12', rounds: 2 })}>
        open
      </button>
      <CancelOrderDialog
        target={target}
        onClose={() => setTarget(null)}
        endpoint="/api/staff/action"
        send={send}
        runBusy={runBusy}
        busy={busy}
        testId="staff-cancel-order"
      />
      <ImagePicker
        photo
        value={photo}
        onChange={setPhoto}
        label="Photo for TK-1"
        testId="owner-takeaway-photo"
        upload={async (b64) => {
          window.__uploads.push(b64);
          return DOT;
        }}
        remove={async () => {
          window.__removed += 1;
        }}
        onSaved={(what) => toast.show(what === 'saved' ? 'TK-1: photo saved' : 'TK-1: photo removed', { tone: 'success' })}
      />
    </div>
  );
}

const host = document.createElement('div');
host.id = 'cancel-host';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <Harness />
  </ToastProvider>
);
