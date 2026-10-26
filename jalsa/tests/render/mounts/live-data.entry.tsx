/**
 * Mounts the REAL `useLiveData` behind a probe (navigation-latency.render.spec.ts, 26-Oct-2026). The spec
 * answers its requests, so what is asserted is what the hook ASKS for: the URL of each poll.
 */
import './process-shim';
import { createRoot } from 'react-dom/client';
import { useLiveData } from '../../../src/hooks/useLiveData';

declare global {
  interface Window {
    __stamp: string | null;
  }
}

function Probe() {
  const { data, send } = useLiveData<{ n: number }>('/api/probe/state', { n: 0 }, 250, {
    fullEveryMs: 60_000,
    initialStamp: window.__stamp,
  });
  return (
    <div data-testid="probe" data-n={data.n}>
      <button data-testid="probe-write" onClick={() => void send('/api/probe/write', {})}>
        write
      </button>
    </div>
  );
}

const host = document.createElement('div');
document.body.prepend(host);
createRoot(host).render(<Probe />);
