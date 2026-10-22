/**
 * Mounts the REAL print prompt (PrintAskProvider) for the KOT and invoice print switches
 * (print-ask.render.spec.ts, 22-Oct-2026). Two buttons stand in for "a round was sent" and "a
 * payment was recorded": each hands the prompt the server answer the spec chose. `send` records
 * every request the prompt makes; `window.__printReply` chooses what it answers.
 */
import './process-shim';
import { createRoot } from 'react-dom/client';
import * as React from 'react';
import { PrintAskProvider, usePrintAsk, type PrintAnswer } from '../../../src/components/ui/print-ask';
import { ToastProvider } from '../../../src/components/ui/toast';

declare global {
  interface Window {
    __grants: string[];
    __sent: unknown[];
    __printReply: 'queued' | 'already' | 'no-printer';
    __printAnswer: PrintAnswer;
  }
}
window.__sent = [];
window.__printReply = 'queued';
window.__printAnswer = { print: 'ask' };

let seq = 0;

function Screen() {
  const printAsk = usePrintAsk();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        data-testid="harness-round"
        onClick={() => {
          seq += 1;
          printAsk.after(window.__printAnswer, { kind: 'KOT', kotId: `k${seq}`, code: `KOT-00${seq}`, place: 'Table A5' });
        }}
      >
        round
      </button>
      <button
        data-testid="harness-pay"
        onClick={() => printAsk.after(window.__printAnswer, { kind: 'Invoice', billId: 'b1', code: 'B-104' })}
      >
        pay
      </button>
      {/* Two answers before anyone has replied - two rounds sent back to back. */}
      <button
        data-testid="harness-two-rounds"
        onClick={() => {
          for (let i = 0; i < 2; i += 1) {
            seq += 1;
            printAsk.after(window.__printAnswer, { kind: 'KOT', kotId: `k${seq}`, code: `KOT-00${seq}`, place: 'Table A5' });
          }
        }}
      >
        two rounds
      </button>
      {/* A re-render of the screen with the same answer must not ask again. */}
      <button data-testid="harness-pay-again" onClick={() => printAsk.after({ print: 'ask' }, { kind: 'Invoice', billId: 'b1', code: 'B-104' })}>
        again
      </button>
    </div>
  );
}

const send = (async (_path: string, payload: unknown) => {
  window.__sent.push(payload);
  await new Promise((r) => setTimeout(r, 150));
  if (window.__printReply === 'no-printer') throw new Error('No printer is set to print bills. Under Printers, turn on Bills for one.');
  return window.__printReply === 'already' ? { outcome: 'already', printerName: '' } : { outcome: 'queued', printerName: 'Counter' };
}) as <R>(path: string, payload: unknown) => Promise<R>;

const host = document.createElement('div');
host.id = 'print-ask-host';
host.style.cssText = 'padding:16px;box-sizing:border-box;width:100%;max-width:38rem';
document.body.prepend(host);
createRoot(host).render(
  <ToastProvider>
    <PrintAskProvider endpoint="/api/staff/action" send={send} grants={window.__grants}>
      <Screen />
    </PrintAskProvider>
  </ToastProvider>
);
