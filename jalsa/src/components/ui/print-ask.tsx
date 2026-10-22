'use client';

import * as React from 'react';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { INVOICE_ASK, KOT_ASK, type PrintOnceResult, type PrintOutcome } from '@/lib/print-choice';

/**
 * print-ask — the one prompt shown when automatic printing is off (22-Oct-2026).
 *
 * WHY IT LIVES ABOVE THE SCREENS, NOT IN THEM
 *   Sending a round moves the captain to the table; recording a payment moves them to the floor.
 *   A prompt owned by the screen that sent the request would unmount with it, mid-question. The
 *   provider is mounted once per surface (StaffApp, OwnerConsole) and outlives the navigation.
 *
 * WHY IT IS OPENED BY AN ANSWER, NEVER BY THE DATA
 *   The prompt is raised by the server's reply to the one request that placed the round or took
 *   the payment - not by a poll, an echo or a render noticing an unprinted ticket. A re-render
 *   cannot ask twice, and a second screen watching the same floor is never asked at all. Each
 *   ticket is asked about at most once per page (`asked`).
 *
 * WHY PRINT CANNOT SEND TWICE
 *   `inFlight` is a ref, not state: two taps inside one frame both read the same state, but only
 *   the first finds the ref clear. The server is the real boundary - a round is claimed in one
 *   conditional update, a bill's first invoice has one fixed job id - and a second request is
 *   answered `already`, printing nothing.
 *
 * NEITHER BUTTON WRITES A SETTING. Print sends this ticket; Skip sends nothing. The switch under
 * Settings is untouched, so the next round or payment asks again.
 */

export type PrintSubject =
  | { kind: 'KOT'; kotId: string; code: string; place?: string }
  | { kind: 'Invoice'; billId: string; code: string };

/** What a round or a payment answered about its print (`placeRound`, `closeBill`). */
export interface PrintAnswer {
  print?: PrintOutcome;
  printProblem?: string;
}

interface PrintAskApi {
  /** Act on the server's answer: ask, report a failure, or do nothing because it printed. */
  after: (answer: PrintAnswer, subject: PrintSubject) => void;
  /** Print this ticket now, without asking - a round card's own Print KOT. */
  printNow: (subject: PrintSubject) => void;
  /** True while a Print is on its way - the button that sent it stays disabled. */
  printing: boolean;
}

const PrintAskContext = React.createContext<PrintAskApi | null>(null);

/* Outside a provider (a component mounted on its own, in a render spec) there is nobody to ask,
   and nothing is printed. Both app shells mount the provider - asserted by
   tests/unit/print-switches.unit.spec.ts - so this is never the path a person takes. */
const NO_PROVIDER: PrintAskApi = { after: () => undefined, printNow: () => undefined, printing: false };

export function usePrintAsk(): PrintAskApi {
  return React.useContext(PrintAskContext) ?? NO_PROVIDER;
}

const keyOf = (s: PrintSubject): string => (s.kind === 'KOT' ? `KOT:${s.kotId}` : `Invoice:${s.billId}`);

export function PrintAskProvider({
  endpoint,
  send,
  grants,
  children,
}: {
  endpoint: '/api/staff/action' | '/api/owner/action';
  send: <R>(path: string, payload: unknown) => Promise<R>;
  grants: readonly string[];
  children: React.ReactNode;
}) {
  const toast = useToast();
  // Tickets waiting to be asked about, oldest first: two rounds sent back to back are two
  // questions, never one question about whichever came last.
  const [queue, setQueue] = React.useState<PrintSubject[]>([]);
  const [printing, setPrinting] = React.useState(false);
  const inFlight = React.useRef(false);
  const asked = React.useRef(new Set<string>());
  const current = queue[0] ?? null;

  const mayPrint = React.useCallback(
    (s: PrintSubject) => grants.includes(s.kind === 'KOT' ? 'orders.reprint' : 'bill.record_payment'),
    [grants]
  );

  const finish = React.useCallback((s: PrintSubject) => {
    setQueue((q) => q.filter((x) => keyOf(x) !== keyOf(s)));
  }, []);

  const print = React.useCallback(
    async (s: PrintSubject): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setPrinting(true);
      try {
        const res = await send<PrintOnceResult>(
          endpoint,
          s.kind === 'KOT' ? { action: 'print-kot', kotId: s.kotId } : { action: 'print-invoice', billId: s.billId }
        );
        const what = s.kind === 'KOT' ? s.code : `${s.code} invoice`;
        if (res.outcome === 'already') {
          toast.show(`${what} was already sent to the printer — it was not printed again`);
        } else if (res.printProblem) {
          toast.show(`${what} did not print. ${res.printProblem}`, { tone: 'error' });
        } else {
          // Sent, not printed: nothing here can know paper came out (the bridge reports that).
          toast.show(`${what} sent to ${res.printerName || 'the printer'}`, { tone: 'success' });
        }
        return true;
      } catch (err) {
        // The printer could not be reached or none is set up. Said in words; the order and the
        // payment are untouched, and the person can try again or skip.
        toast.show(err instanceof Error ? err.message : 'That did not print. Try again, or skip it.', { tone: 'error' });
        return false;
      } finally {
        inFlight.current = false;
        setPrinting(false);
      }
    },
    [endpoint, send, toast]
  );

  const after = React.useCallback(
    (answer: PrintAnswer, s: PrintSubject) => {
      if (answer.print === 'failed') {
        toast.show(
          s.kind === 'KOT'
            ? `${s.code} is with the kitchen, but its ticket did not print. ${answer.printProblem ?? ''}`.trim()
            : `Payment recorded, but the ${s.code} invoice did not print. ${answer.printProblem ?? ''}`.trim(),
          { tone: 'error' }
        );
        return;
      }
      if (answer.print !== 'ask' || !mayPrint(s)) return;
      const key = keyOf(s);
      if (asked.current.has(key)) return;
      asked.current.add(key);
      setQueue((q) => [...q, s]);
    },
    [mayPrint, toast]
  );

  const printNow = React.useCallback((s: PrintSubject) => void print(s), [print]);

  const api = React.useMemo(() => ({ after, printNow, printing }), [after, printNow, printing]);
  const words = current?.kind === 'Invoice' ? INVOICE_ASK : KOT_ASK;

  return (
    <PrintAskContext.Provider value={api}>
      {children}
      <ConfirmDialog
        open={current !== null}
        onOpenChange={(open) => {
          // Skip, Escape or a tap outside: nothing is sent. Not while a Print is on its way - its
          // answer closes the prompt.
          if (!open && current && !inFlight.current) finish(current);
        }}
        title={words.title}
        consequence={
          current?.kind === 'KOT'
            ? `${current.code}${current.place ? ` · ${current.place}` : ''}. Only this KOT prints — Enable KOT Printing stays off.`
            : `${current?.code ?? ''}. Only this invoice prints — Enable Invoice Printing stays off.`
        }
        confirmLabel={words.print}
        keepLabel={words.skip}
        tone="primary"
        busy={printing}
        testId={current?.kind === 'Invoice' ? 'print-ask-invoice' : 'print-ask-kot'}
        onConfirm={() => {
          if (!current) return;
          const s = current;
          void print(s).then((sent) => {
            if (sent) finish(s);
          });
        }}
      />
    </PrintAskContext.Provider>
  );
}
