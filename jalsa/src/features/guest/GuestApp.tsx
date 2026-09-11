'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { OfflineBanner, PartialNotice } from '@/components/ui/states';
import type { GuestPayload } from '@/lib/db/guest-view';
import { useLiveData } from '@/hooks/useLiveData';
import { WelcomeScreen, MenuScreen, CartScreen } from './GuestOrdering';
import { PlacedScreen, StatusScreen } from './GuestProgress';
import { UpsellScreen, TipScreen, PayingScreen, FailedScreen, PaidScreen, InvoiceScreen } from './GuestClosure';
import { GuestSheets, type SheetKind } from './GuestSheets';
import { factsOf, reconcilePhase, startingPhase, type Phase } from './phase';

/**
 * GuestApp — the eleven screens of the guest journey, and the seven sheets behind them.
 *
 * WHY ONE COMPONENT HOLDS THE JOURNEY RATHER THAN ELEVEN ROUTES
 *   The journey is one straight line with three places to leave it and come back, on one bill,
 *   on a phone that must survive a locked screen and a dead spot. As routes, every step would
 *   be a navigation that can fail mid-order and a back button that means something different at
 *   each stop. As one screen with a phase, "where was I" is answered by the SERVER on the next
 *   poll — which is exactly the resumability the design set asks for (Standard 6.5).
 *
 * ONE DECISION PER SCREEN, on the customer path. Every tap that is not ordering, paying or
 * tipping is a tap the design removed, and this component keeps it removed: there is a single
 * primary action pinned at the bottom of each phase, and everything optional lives behind ⋯.
 */

/* Re-exported so the screen files keep importing their prop types from one place. The rule that
 * decides a phase lives in ./phase, which has no React in it and can therefore be tested. */
export type { Phase };

export interface GuestScreenProps {
  data: GuestPayload;
  go: (phase: Phase) => void;
  openSheet: (kind: SheetKind, arg?: string) => void;
  send: <T>(path: string, payload: unknown) => Promise<T>;
  busy: boolean;
  runBusy: (fn: () => Promise<void>) => void;
}

export function GuestApp({ table, initial }: { table: string; initial: GuestPayload }) {
  const { data, staleReason, send } = useLiveData<GuestPayload>(
    `/api/guest/state?table=${encodeURIComponent(table)}`,
    initial
  );
  const toast = useToast();

  const [phase, setPhase] = React.useState<Phase>(() => startingPhase(factsOf(initial)));
  const [sheet, setSheet] = React.useState<{ kind: SheetKind; arg?: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  /**
   * The server decides the phase whenever it knows better than the phone does.
   *
   * A guest who reopens the link mid-service must land where their bill actually is, not where
   * this tab last was — that is the difference between "restored" and "a stale page that looks
   * restored". The phone keeps control only of the steps the server cannot see: which closure
   * step they are on.
   *
   * Adjusted DURING RENDER rather than in an effect. React re-runs this component before it
   * paints, so the guest never sees the old screen flash; an effect would commit the wrong phase
   * first and correct it a frame later, which on a slow handset is visible.
   */
  const serverKey = `${data.phase}|${data.billStatus ?? ''}|${data.rounds.length}`;
  const [lastServerKey, setLastServerKey] = React.useState(serverKey);
  if (lastServerKey !== serverKey) {
    setLastServerKey(serverKey);
    setPhase(reconcilePhase(phase, factsOf(data)));
  }

  const runBusy = React.useCallback(
    (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      void fn()
        .catch((err: unknown) => {
          toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' });
        })
        .finally(() => setBusy(false));
    },
    [busy, toast]
  );

  const shared: GuestScreenProps = {
    data,
    go: setPhase,
    openSheet: (kind, arg) => setSheet(arg === undefined ? { kind } : { kind, arg }),
    send,
    busy,
    runBusy,
  };

  if (data.phase === 'table_inactive') {
    return <TableInactive table={data.table.name} callNumber={data.callNumber} />;
  }

  const back = backTarget(phase);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full flex-col"
      style={{ maxWidth: 'var(--layout-guest-max-width)' }}
      data-testid="guest-app"
      data-phase={phase}
    >
      <OfflineBanner />

      {phase !== 'welcome' ? (
        <GuestHeader
          title={headerTitle(phase, data)}
          sub={headerSub(data)}
          onMore={() => setSheet({ kind: 'help' })}
          {...(back ? { onBack: () => setPhase(back) } : {})}
        />
      ) : null}

      <main className="flex-1 px-4 pb-[var(--layout-bottom-chrome-clearance)] pt-3">
        {staleReason ? (
          <PartialNotice testId="guest-stale">
            {staleReason} What you can see below is the last thing we heard — your order is safe on our side.
          </PartialNotice>
        ) : null}

        {phase === 'welcome' ? <WelcomeScreen {...shared} /> : null}
        {phase === 'menu' ? <MenuScreen {...shared} /> : null}
        {phase === 'cart' ? <CartScreen {...shared} /> : null}
        {phase === 'placed' ? <PlacedScreen {...shared} /> : null}
        {phase === 'status' ? <StatusScreen {...shared} /> : null}
        {phase === 'upsell' ? <UpsellScreen {...shared} /> : null}
        {phase === 'tip' ? <TipScreen {...shared} /> : null}
        {phase === 'paying' ? <PayingScreen {...shared} /> : null}
        {phase === 'failed' ? <FailedScreen {...shared} /> : null}
        {phase === 'paid' ? <PaidScreen {...shared} /> : null}
        {phase === 'invoice' ? <InvoiceScreen {...shared} /> : null}
      </main>

      <GuestSheets
        sheet={sheet}
        onClose={() => setSheet(null)}
        openSheet={(kind, arg) => setSheet(arg === undefined ? { kind } : { kind, arg })}
        data={data}
        send={send}
        runBusy={runBusy}
        busy={busy}
      />
    </div>
  );
}

function headerTitle(phase: Phase, data: GuestPayload): string {
  if (phase === 'menu') return data.restaurantName;
  if (phase === 'cart') return 'Your order';
  if (phase === 'invoice') return 'Bill';
  if (phase === 'status') return `Table ${data.table.name}`;
  return data.restaurantName;
}

function headerSub(data: GuestPayload): string {
  const people = [data.captain, data.waiter].filter(Boolean);
  if (data.rounds.length) {
    const rounds = data.rounds.length === 1 ? '1 round' : `${data.rounds.length} rounds`;
    return people.length ? `${rounds} · ${people.join(' and ')}` : rounds;
  }
  if (people.length === 2) return `${people[0]} and ${people[1]} look after this table`;
  if (people.length === 1) return `${people[0]} looks after this table`;
  return `Table ${data.table.name}`;
}

/** Back goes UP the journey, never off it. A phase with no honest parent gets no back button. */
function backTarget(phase: Phase): Phase | null {
  if (phase === 'cart') return 'menu';
  if (phase === 'menu') return 'status';
  if (phase === 'invoice') return 'paid';
  if (phase === 'tip') return 'upsell';
  if (phase === 'upsell') return 'status';
  return null;
}

function GuestHeader({
  title,
  sub,
  onMore,
  onBack,
}: {
  title: string;
  sub: string;
  onMore: () => void;
  onBack?: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--primary)] px-3 py-3 text-[var(--on-primary)]"
      data-testid="guest-header"
    >
      {onBack ? (
        <button
          data-testid="guest-back"
          type="button"
          onClick={onBack}
          aria-label="Back"

          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] leading-none transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-primary)]"
        >
          ‹
        </button>
      ) : (
        <span className="w-2" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[15px] font-semibold">{title}</p>
        <p className="m-0 truncate text-[11.5px] opacity-85">{sub}</p>
      </div>
      <button
        data-testid="guest-more"
        type="button"
        onClick={onMore}
        aria-label="Ask for something"

        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] leading-none transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-primary)]"
      >
        ⋯
      </button>
    </header>
  );
}

/**
 * A code on a table that is not in service.
 *
 * NOT A DEAD END (Standard 1.6). It states the situation, gives the fact needed next, and
 * offers the two things that still work: a person, and a phone number.
 */
function TableInactive({ table, callNumber }: { table: string; callNumber: string }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-4 px-6 text-center"
      data-testid="guest-table-inactive"
    >
      <h1 className="text-[21px] font-semibold">Table {table} is not in service</h1>
      <p className="m-0 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
        This code is on a table we are not seating at the moment. Any of the team will move you to one that is — you
        have not lost your place by scanning it.
      </p>
      {callNumber ? (
        <Button data-testid="guest-inactive-call" asChild>
          <a data-testid="guest-inactive-call-link" href={`tel:${callNumber.replace(/\s+/g, '')}`}>
            Call the restaurant
          </a>
        </Button>
      ) : null}
    </main>
  );
}

/** The pinned bottom bar every phase uses for its ONE primary action. */
export function ActionBar({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 mx-auto flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3',
        className
      )}
      style={{ maxWidth: 'var(--layout-guest-max-width)' }}
    >
      {children}
    </div>
  );
}
