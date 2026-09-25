'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useLiveData } from '@/hooks/useLiveData';
import { useToast } from '@/components/ui/toast';
import { OfflineBanner, PartialNotice } from '@/components/ui/states';
import type { StaffPayload } from '@/lib/db/staff-view';
import { FloorScreen, TableScreen, AddItemsScreen } from './StaffTables';
import { ReadyScreen, KotsScreen, ClearScreen, RequestsScreen, MeScreen } from './StaffLists';

/**
 * StaffApp — the captain's and the waiter's phone.
 *
 * FIVE SECTIONS, AND THE FIVE ARE DIFFERENT PER ROLE ON PURPOSE
 *   A captain runs TABLES: every round, adding items, fixing quantities, clearing requests,
 *   closing bills. A waiter runs FOOD: what is ready, where it goes, and marking it served. The
 *   design gives them different tab bars because they are doing different jobs, not because one
 *   is a reduced version of the other — and the waiter's bar leads with the thing they are
 *   actually waiting for.
 *
 * THE BOTTOM BAR IS FIXED AND THE CONTENT CLEARS IT BY ONE TOKEN
 *   `--layout-bottom-chrome-clearance`. Hand-picked padding is how a Done button ends up under
 *   the tab bar on the one handset nobody tested on.
 */

export type StaffTab = 'floor' | 'table' | 'menu' | 'ready' | 'kots' | 'clean' | 'requests' | 'me';

export interface StaffScreenProps {
  data: StaffPayload;
  go: (tab: StaffTab, arg?: string) => void;
  /**
   * The table a round is being started on BEFORE it has a bill.
   *
   * Kept separate from `selectedBillId` rather than overloading it. One slot holding "either a
   * bill or a table" reads fine on the day it is written and is a trap afterwards: every screen
   * that receives it has to guess which kind it holds, and the guess is invisible in a type.
   * Null whenever the round belongs to a bill that already exists, which is the common case.
   */
  selectedTableId: string | null;
  /** Start a round on a free table. Clears any bill selection — the two are never both live. */
  goFreeTable: (tableId: string) => void;
  selectedBillId: string | null;
  send: <R>(path: string, payload: unknown) => Promise<R>;
  busy: boolean;
  runBusy: (fn: () => Promise<void>) => void;
}

export function StaffApp({ initial }: { initial: StaffPayload }) {
  const router = useRouter();
  const toast = useToast();
  const { data, staleReason, send } = useLiveData<StaffPayload>('/api/staff/state', initial);

  const [tab, setTab] = React.useState<StaffTab>(initial.isWaiter ? 'ready' : 'floor');
  const [selectedBillId, setSelectedBillId] = React.useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  const go = React.useCallback((next: StaffTab, arg?: string) => {
    if (arg !== undefined) setSelectedBillId(arg);
    // Any navigation that names a bill leaves the free-table path; leaving it set would make the
    // next Send post a tableId for a table nobody is looking at.
    if (arg !== undefined) setSelectedTableId(null);
    setTab(next);
  }, []);

  /** Tap a table under "Free right now": straight to the menu, with no bill open yet. */
  const goFreeTable = React.useCallback((tableId: string) => {
    setSelectedBillId(null);
    setSelectedTableId(tableId);
    setTab('menu');
  }, []);

  const shared: StaffScreenProps = { data, go, selectedBillId, selectedTableId, goFreeTable, send, busy, runBusy };

  const unclearedRequests = data.requests.length;
  // Tables the party has left that nobody has reset. The waiter's second job, and until the
  // clearing columns existed there was no way to count it.
  const needsClearing = data.tables.filter((t) => t.clearing !== null).length;
  const readyCount = data.ready.filter((r) => r.kot.status === 'ready').length;

  const tabs: Array<{ key: StaffTab; label: string; icon: string; badge: number }> = data.isWaiter
    ? [
        // The design set's waiter bar, in its order: what is ready to carry, what is ready to
        // wipe, then the room. A waiter's shift is those two queues and the floor behind them.
        { key: 'ready', label: 'To serve', icon: '▲', badge: readyCount },
        { key: 'clean', label: 'Clear', icon: '◇', badge: needsClearing },
        { key: 'floor', label: 'Tables', icon: '▦', badge: 0 },
        { key: 'requests', label: 'Requests', icon: '!', badge: unclearedRequests },
        { key: 'me', label: 'Me', icon: '●', badge: 0 },
      ]
    : [
        { key: 'floor', label: 'Tables', icon: '▦', badge: 0 },
        { key: 'ready', label: 'Ready', icon: '▲', badge: readyCount },
        { key: 'kots', label: 'KOTs', icon: '≡', badge: 0 },
        { key: 'requests', label: 'Requests', icon: '!', badge: unclearedRequests },
        { key: 'me', label: 'Me', icon: '●', badge: 0 },
      ];

  const signOut = () =>
    runBusy(async () => {
      await fetch('/api/staff/session', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ surface: 'staff' }),
      });
      router.refresh();
    });

  return (
    // The floor is an operational surface, so it takes the dense body/caption steps — see the
    // note on the owner shell and the typography block in src/app/globals.css. Headings, buttons
    // and touch targets are identical to the guest's.
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col"
      data-testid="staff-app"
      data-tab={tab}
      data-density="dense"
    >
      <OfflineBanner />

      <header className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--primary)] px-4 py-3 text-[var(--on-primary)]">
        {tab === 'table' || tab === 'menu' ? (
          <button
            data-testid="staff-back"
            type="button"
            onClick={() => go(tab === 'menu' && selectedBillId ? 'table' : 'floor')}
            aria-label="Back"

            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-h3 leading-none hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-primary)]"
          >
            ‹
          </button>
        ) : (
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--on-primary)]/15 type-body font-bold"
          >
            {data.me.initials || data.me.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate type-body font-semibold">{titleFor(tab, data, selectedBillId, selectedTableId)}</p>
          <p className="m-0 truncate type-caption opacity-85">{subtitleFor(tab, data, selectedBillId, selectedTableId)}</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-[var(--layout-bottom-chrome-clearance)] pt-3">
        {staleReason ? (
          <PartialNotice testId="staff-stale">
            {staleReason} The floor below is the last thing we heard — anything you tap will still be sent.
          </PartialNotice>
        ) : null}

        {data.dayNote && tab === 'floor' ? (
          <div
            className="mb-3 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]"
            data-testid="staff-day-note"
          >
            <strong className="block type-eyebrow">Note for the floor</strong>
            {data.dayNote}
          </div>
        ) : null}

        {tab === 'floor' ? <FloorScreen {...shared} /> : null}
        {tab === 'table' ? <TableScreen {...shared} /> : null}
        {tab === 'menu' ? <AddItemsScreen {...shared} /> : null}
        {tab === 'ready' ? <ReadyScreen {...shared} /> : null}
        {tab === 'kots' ? <KotsScreen {...shared} /> : null}
        {tab === 'clean' ? <ClearScreen {...shared} /> : null}
        {tab === 'requests' ? <RequestsScreen {...shared} /> : null}
        {tab === 'me' ? <MeScreen {...shared} onSignOut={signOut} /> : null}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[38rem] border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
        aria-label="Sections"
        data-testid="staff-tabs"
      >
        {tabs.map((t) => {
          const active = tab === t.key || (t.key === 'floor' && (tab === 'table' || tab === 'menu'));
          return (
            <button
              data-testid={`staff-tab-${t.key}`}
              key={t.key}
              type="button"
              onClick={() => go(t.key)}
              aria-current={active ? 'page' : undefined}

              className={cn(
                'relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 type-caption font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full type-caption font-bold',
                  active ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'bg-[var(--surface-sunken)]'
                )}
              >
                {t.icon}
              </span>
              {t.label}
              {t.badge > 0 ? (
                <span
                  className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-[var(--error)] px-1 type-badge font-bold leading-4 text-[var(--on-error)]"
                  aria-label={`${t.badge} waiting`}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function selected(data: StaffPayload, billId: string | null) {
  return data.bills.find((b) => b.id === billId) ?? null;
}

function titleFor(tab: StaffTab, data: StaffPayload, billId: string | null, tableId: string | null): string {
  const bill = selected(data, billId);
  const freeTable = bill ? null : (data.tables.find((t) => t.id === tableId) ?? null);
  switch (tab) {
    case 'floor':
      return 'My tables';
    case 'table':
      return bill
        ? `${bill.groupCode ? `Group ${bill.groupCode}` : `Table ${bill.tables.join(', ')}`} · ${bill.code}`
        : 'Table';
    case 'menu':
      if (bill) return `Add items · ${bill.tables.join(', ')}`;
      // A walk-in: the table is named before it has a bill to name it by.
      return freeTable ? `New round · ${freeTable.name}` : 'Add items';
    case 'ready':
      return data.isWaiter ? 'Ready to run' : 'Ready to collect';
    case 'kots':
      return 'Kitchen tickets';
    case 'clean':
      return 'Clear these tables';
    case 'requests':
      return 'Table requests';
    case 'me':
      return data.me.name;
  }
}

function subtitleFor(tab: StaffTab, data: StaffPayload, billId: string | null, tableId: string | null): string {
  const bill = selected(data, billId);
  const freeTable = bill ? null : (data.tables.find((t) => t.id === tableId) ?? null);
  switch (tab) {
    case 'floor':
      return `${data.myTables.length || data.tables.filter((t) => t.billId).length} live · ${data.me.name}`;
    case 'table':
      return bill ? `${bill.guests} guests · opened ${bill.openedAt}` : '';
    case 'menu':
      // Two different promises, and saying the wrong one is how a captain opens a bill
      // they did not mean to open.
      if (freeTable) return `Seats ${freeTable.seats} · the bill opens when this round is sent`;
      return 'A new round on the same bill';
    case 'ready':
      return data.ready.length === 1 ? '1 round waiting' : `${data.ready.length} rounds waiting`;
    case 'kots':
      return `${data.bills.reduce((a, b) => a + b.kots.length, 0)} tonight · newest first`;
    case 'clean': {
      const n = data.tables.filter((t) => t.clearing !== null).length;
      return n ? `${n} waiting · guests have left` : 'Everything is reset';
    }
    case 'requests':
      return data.requests.length
        ? `${data.requests.length} waiting · oldest ${Math.max(...data.requests.map((r) => r.ageMinutes))} min`
        : 'Nothing waiting';
    case 'me':
      return `${data.me.role} · signed in`;
  }
}
