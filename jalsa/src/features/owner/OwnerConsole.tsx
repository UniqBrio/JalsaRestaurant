'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useLiveData } from '@/hooks/useLiveData';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { DeniedState, OfflineBanner, PartialNotice } from '@/components/ui/states';
import type { OwnerPayload } from '@/lib/db/owner-view';
import { Dashboard } from './sections/Dashboard';
import { LiveOrders } from './sections/LiveOrders';
import { Payments } from './sections/Payments';
import { MenuSection } from './sections/MenuSection';
import { StaffSection } from './sections/StaffSection';
import { LedgersSection } from './sections/LedgersSection';
import { ReportsSection } from './sections/ReportsSection';
import { SettingsSection } from './sections/SettingsSection';
import { AuditSection } from './sections/AuditSection';

/**
 * OwnerConsole — the desktop surface, dense on purpose.
 *
 * THE PRIMARY BAR IS PINNED, AND SO IS THE SUB-BAR (Standards 1.1 and 1.2)
 *   Section switching is the most frequent action in a thirteen-section console. Making it cost
 *   a scroll-to-top taxes every single move. The two bars stack into ONE sticky block so they
 *   can never overlap each other — which is the failure mode of pinning them separately.
 *
 * EVERY SECTION IS GATED ON ITS OWN GRANT, and a section a person may not open is not rendered
 * as an empty panel: it is a designed denied state naming the permission and who grants it
 * (Standard 9.3). A cashier who may close bills gets the console; the tax panel is still not
 * theirs, and the screen says so rather than looking broken.
 */

export type OwnerSection =
  'dashboard' | 'orders' | 'payments' | 'menu' | 'staff' | 'ledgers' | 'reports' | 'settings' | 'audit';

export interface OwnerSectionProps {
  data: OwnerPayload;
  go: (section: OwnerSection, arg?: string) => void;
  arg: string | null;
  send: <R>(path: string, payload: unknown) => Promise<R>;
  busy: boolean;
  runBusy: (fn: () => Promise<void>) => void;
}

const SECTIONS: Array<{ key: OwnerSection; label: string; permission: string }> = [
  { key: 'dashboard', label: 'Dashboard', permission: 'orders.view' },
  { key: 'orders', label: 'Live orders', permission: 'orders.view' },
  { key: 'payments', label: 'Payments', permission: 'bill.view' },
  { key: 'menu', label: 'Menu', permission: 'menu.view' },
  { key: 'staff', label: 'Staff', permission: 'staff.view' },
  { key: 'ledgers', label: 'Tips & expenses', permission: 'tips.all' },
  { key: 'reports', label: 'Reports', permission: 'rep.products' },
  { key: 'settings', label: 'Settings', permission: 'set.tables' },
  { key: 'audit', label: 'Audit log', permission: 'audit.view' },
];

export function OwnerConsole({ initial }: { initial: OwnerPayload }) {
  const router = useRouter();
  const toast = useToast();
  const { data, staleReason, send } = useLiveData<OwnerPayload>('/api/owner/state', initial, 8000);

  const [section, setSection] = React.useState<OwnerSection>('dashboard');
  const [arg, setArg] = React.useState<string | null>(null);
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

  const go = React.useCallback((next: OwnerSection, nextArg?: string) => {
    setArg(nextArg ?? null);
    setSection(next);
  }, []);

  const shared: OwnerSectionProps = { data, go, arg, send, busy, runBusy };
  const granted = new Set(data.grants);
  const visible = SECTIONS.filter((s) => granted.has(s.permission));
  const current = SECTIONS.find((s) => s.key === section);
  const allowed = current ? granted.has(current.permission) : false;

  const signOut = () =>
    runBusy(async () => {
      await fetch('/api/staff/session', { method: 'DELETE' });
      router.refresh();
    });

  return (
    <div className="min-h-dvh" data-testid="owner-console" data-section={section}>
      <OfflineBanner />

      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
        <div
          className="mx-auto flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ maxWidth: 'var(--layout-content-max-width)' }}
        >
          <span className="text-[15px] font-semibold">
            {(data.restaurant.display_name as string) ?? 'Jalsa Restaurant'}
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            {data.today.openBills} open · {data.today.awaitingClosure} awaiting closure · {data.today.openRequests}{' '}
            requests
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-[12px] text-[var(--text-muted)]">
              {data.me.name} · {data.me.role}
            </span>
            <Button data-testid="owner-signout" variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </span>
        </div>

        <nav
          className="j-scroll-x mx-auto flex gap-1 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maxWidth: 'var(--layout-content-max-width)' }}
          aria-label="Sections"
        >
          {visible.map((s) => {
            const active = section === s.key;
            return (
              <button
                data-testid={`owner-nav-${s.key}`}
                key={s.key}
                type="button"
                onClick={() => go(s.key)}
                aria-current={active ? 'page' : undefined}

                className={cn(
                  'relative min-h-11 whitespace-nowrap px-3 text-[13px] transition-colors',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                  // Weight AND an underline, never colour alone — the active item has to be
                  // legible to someone who cannot separate the maroon from the ink.
                  active
                    ? 'font-bold text-[var(--primary)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-[var(--primary)]'
                    : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-body)]'
                )}
              >
                {s.label}
                {s.key === 'payments' && data.today.awaitingClosure > 0 ? (
                  <span className="ml-1.5 rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-bold text-[var(--on-primary)]">
                    {data.today.awaitingClosure}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto flex flex-col gap-4 px-4 py-5" style={{ maxWidth: 'var(--layout-content-max-width)' }}>
        {staleReason ? (
          <PartialNotice testId="owner-stale">
            {staleReason} The figures below are the last complete read — nothing has been lost, and anything you save
            will still be written.
          </PartialNotice>
        ) : null}

        {!allowed && current ? (
          <DeniedState permission={current.label} testId="owner-denied" />
        ) : (
          <>
            {section === 'dashboard' ? <Dashboard {...shared} /> : null}
            {section === 'orders' ? <LiveOrders {...shared} /> : null}
            {section === 'payments' ? <Payments {...shared} /> : null}
            {section === 'menu' ? <MenuSection {...shared} /> : null}
            {section === 'staff' ? <StaffSection {...shared} /> : null}
            {section === 'ledgers' ? <LedgersSection {...shared} /> : null}
            {section === 'reports' ? <ReportsSection {...shared} /> : null}
            {section === 'settings' ? <SettingsSection {...shared} /> : null}
            {section === 'audit' ? <AuditSection {...shared} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

/** The KPI card, which is a BUTTON — every figure links to the section that itemises it (1.4). */
export function MetricTile({
  label,
  value,
  note,
  onClick,
  testId,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  onClick?: () => void;
  testId: string;
  tone?: 'neutral' | 'primary' | 'warning' | 'error';
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      data-testid={testId}
      className={cn(
        'flex flex-col gap-1 rounded-[var(--radius-lg)] p-4 text-left shadow-[var(--shadow-card)] transition-colors',
        onClick &&
          'hover:bg-[var(--primary-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        tone === 'primary'
          ? 'bg-[var(--primary)] text-[var(--on-primary)]'
          : tone === 'warning'
            ? 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]'
            : tone === 'error'
              ? 'bg-[var(--error-surface)] text-[var(--on-error-surface)]'
              : 'bg-[var(--surface)]'
      )}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-[0.11em] opacity-75">{label}</span>
      <span className="text-[24px] font-bold leading-none tabular-nums">{value}</span>
      {note ? <span className="text-[11.5px] opacity-80">{note}</span> : null}
    </Comp>
  );
}
