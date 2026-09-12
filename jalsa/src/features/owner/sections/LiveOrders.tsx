'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, Chip, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { IdentitySpine, TotalsBlock } from '@/components/ui/bill';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { FirstRunState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import type { OwnerSectionProps } from '../OwnerConsole';
import { CloseBillSheet } from '../CloseBillSheet';

/**
 * Screen 23 — the live orders board, and the bill detail behind it.
 *
 * THE PROVENANCE OF EVERY ROUND IS ON THE SCREEN, not only in the log (Standard 6.4). "Guest
 * phone", "Captain", "Owner" — because whether the QR is actually being used is a question the
 * owner will ask within a week, and it cannot be reconstructed after the fact.
 *
 * A FAILED PRINT IS A BADGE WITH A RETRY, not a silence. The order exists either way; what is
 * missing is a piece of paper, and the person who can fix that is looking at this screen.
 */

const CANCEL_REASONS = [
  'Guest changed their mind',
  'Kitchen delay',
  'Out of stock',
  'Ordered by mistake',
  'Wrong item',
] as const;

export function LiveOrders({ data, arg, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [filter, setFilter] = React.useState<'all' | 'payment_requested' | 'new'>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(arg);
  const [closing, setClosing] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<{ id: string; name: string; qty: number } | null>(null);
  const [cancelReason, setCancelReason] = React.useState<string>(CANCEL_REASONS[0]);
  /* Correcting the captain or waiter on a bill — running or closed. Behind a grant, because on a
     closed bill it moves an unsettled tip with the name. See reassignBillStaff. */
  const [reassign, setReassign] = React.useState<'captain' | 'waiter' | null>(null);
  const canReassign = data.grants.includes('bill.reassign_staff');

  // A dashboard tile that names a bill selects that bill. Adjusted during render so the panel
  // opens on the right one immediately rather than on the previous selection for a frame.
  const [lastArg, setLastArg] = React.useState(arg);
  if (lastArg !== arg) {
    setLastArg(arg);
    if (arg) setSelectedId(arg);
  }

  const bills = data.openBills.filter((b) => {
    if (filter === 'payment_requested') return b.status === 'payment_requested';
    if (filter === 'new') return b.kots.some((k) => k.statusLabel === 'New');
    return true;
  });

  const selected = data.openBills.find((b) => b.id === selectedId) ?? bills[0] ?? null;

  if (data.openBills.length === 0) {
    return (
      <FirstRunState
        title="No bills are open"
        note="A bill opens the moment a table sends its first round. Until then the floor is free, and there is nothing here to watch."
        testId="owner-orders-empty"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[22rem_1fr] lg:items-start" data-testid="owner-orders">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', `All ${data.openBills.length}`],
              ['payment_requested', `Awaiting closure ${data.today.awaitingClosure}`],
              ['new', 'Not yet started'],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              on={filter === key}
              onClick={() => setFilter(key)}
              data-testid={`owner-orders-filter-${key}`}
            >
              {label}
            </Chip>
          ))}
        </div>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {bills.map((b) => (
            <li key={b.id}>
              <button
                data-testid={`owner-bill-${b.code}`}
                type="button"
                onClick={() => setSelectedId(b.id)}

                className={cn(
                  'w-full rounded-[var(--radius-md)] p-3 text-left shadow-[var(--shadow-card)] transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                  selected?.id === b.id
                    ? 'bg-[var(--primary-surface)]'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-sunken)]'
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">{b.tables.join(', ')}</span>
                  <span className="text-[13px] font-bold tabular-nums">{b.payableLabel}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  {b.code} · {b.spine.captain} · {b.kots.length === 1 ? '1 round' : `${b.kots.length} rounds`} ·{' '}
                  {b.openedAt}
                  <Pill tone={b.tone}>{b.statusLabel}</Pill>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <div className="flex flex-col gap-3">
          <IdentitySpine fields={selected.spine} />

          {canReassign ? (
            <div className="flex flex-wrap gap-2">
              <Button
                data-testid="owner-reassign-captain"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setReassign('captain')}
              >
                Change captain
              </Button>
              <Button
                data-testid="owner-reassign-waiter"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setReassign('waiter')}
              >
                Change waiter
              </Button>
            </div>
          ) : null}

          <Sheet
            open={reassign !== null}
            onOpenChange={(v) => !v && setReassign(null)}
            posture="modal"
            title={reassign === 'waiter' ? `Waiter on ${selected.code}` : `Captain on ${selected.code}`}
            description={
              selected.status === 'closed'
                ? 'This bill is closed. An unsettled tip moves with the name; a settled one does not.'
                : 'Recorded against your name, with the name it was before.'
            }
            testId="owner-reassign-sheet"
          >
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {data.staff
                .filter((p) => p.active)
                .map((p) => (
                  <li key={p.id}>
                    <Button
                      data-testid={`owner-reassign-to-${p.id}`}
                      variant="quiet"
                      disabled={busy}
                      className="w-full justify-between"
                      onClick={() => {
                        const role = reassign;
                        if (!role) return;
                        runBusy(async () => {
                          const res = await send<{ tipMoved: number }>('/api/owner/action', {
                            action: 'reassign-bill-staff',
                            billId: selected.id,
                            role,
                            staffId: p.id,
                          });
                          toast.show(
                            res.tipMoved > 0
                              ? `${selected.code}: ${role} is now ${p.name} — ${rupees(res.tipMoved)} of unsettled tip moved with it`
                              : `${selected.code}: ${role} is now ${p.name}`,
                            { tone: 'success' }
                          );
                          setReassign(null);
                        });
                      }}
                    >
                      <span>{p.name}</span>
                      <span className="text-[11.5px] font-normal opacity-70">{p.role}</span>
                    </Button>
                  </li>
                ))}
            </ul>
          </Sheet>

          {selected.groupCode ? (
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--info-surface)] px-4 py-2.5 text-[12px] text-[var(--on-info-surface)]">
              {selected.groupCode} — one bill across {selected.tables.length} tables. Each keeps its own code and
              orders on its own phone; every round carries the table it came from.
            </p>
          ) : null}

          {selected.occasion ? (
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--primary-surface)] px-4 py-2.5 text-[12px] font-semibold text-[var(--on-primary-surface)]">
              🎂 {selected.occasion}
            </p>
          ) : null}

          <div>
            <SectionLabel>Rounds</SectionLabel>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {selected.kots.map((k) => (
                <li key={k.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold">
                        {k.code} <span className="font-normal text-[var(--text-muted)]">· {k.placedAt}</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone="neutral">{k.sourceLabel}</Pill>
                        {k.printStatus === 'failed' ? <Pill tone="error">Print failed</Pill> : null}
                        {k.reprintCount > 0 ? <Pill tone="neutral">Reprinted ×{k.reprintCount}</Pill> : null}
                        <Pill tone={k.tone}>{k.statusLabel}</Pill>
                      </div>
                    </div>
                    <p className="m-0 mt-0.5 text-[11px] text-[var(--text-muted)]">
                      From table {k.fromTable} ·{' '}
                      {k.printStatus === 'printed' ? 'printed to the kitchen' : 'not printed'}
                    </p>

                    <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
                      {k.items.map((i) => (
                        <li key={i.id} className="flex items-center gap-2.5 text-[12.5px]">
                          <FoodMark type={i.foodType} />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate',
                              i.cancelled && 'text-[var(--text-muted)] line-through'
                            )}
                          >
                            {i.name}
                          </span>
                          <span className="tabular-nums text-[var(--text-muted)]">×{i.qty}</span>
                          <span className="w-16 text-right tabular-nums">{i.lineLabel}</span>
                          {!i.cancelled && data.grants.includes('orders.cancel_after') ? (
                            <Button
                              data-testid={`owner-cancel-${i.id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => setCancelTarget({ id: i.id, name: i.name, qty: i.qty })}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>

                    {data.grants.includes('orders.reprint') ? (
                      <Button
                        data-testid={`owner-reprint-${k.id}`}
                        size="sm"
                        variant="secondary"
                        className="mt-2.5"
                        disabled={busy}
                        onClick={() =>
                          runBusy(async () => {
                            await send('/api/owner/action', { action: 'reprint', kotId: k.id });
                            toast.show(
                              k.printStatus === 'failed'
                                ? `${k.code} sent to the printer again — it will show as a reprint`
                                : `${k.code} reprinted — stamped REPRINT`
                            );
                          })
                        }
                      >
                        {k.printStatus === 'failed' ? 'Retry the print' : 'Reprint'}
                      </Button>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </div>

          <Card>
            <TotalsBlock rows={selected.totals} testId="owner-bill-totals" />
          </Card>

          {data.grants.includes('bill.record_payment') ? (
            <Button data-testid="owner-open-close" onClick={() => setClosing(true)}>
              Record payment
            </Button>
          ) : null}
        </div>
      ) : null}

      <CloseBillSheet
        bill={selected}
        open={closing}
        onOpenChange={setClosing}
        send={send}
        runBusy={runBusy}
        busy={busy}
        canDiscount={data.grants.includes('bill.disc_pct') || data.grants.includes('bill.disc_flat')}
        closerName={data.me.name}
        onClosed={() => setSelectedId(null)}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel this item"
        confirmLabel="Cancel item"
        reasons={CANCEL_REASONS}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        busy={busy}
        testId="owner-cancel-dialog"
        consequence={
          cancelTarget ? (
            <p className="m-0">
              <strong>
                {cancelTarget.name} ×{cancelTarget.qty}
              </strong>{' '}
              comes off the bill immediately and stays on the ticket, struck through, with your name and this reason
              against it.
            </p>
          ) : null
        }
        onConfirm={() =>
          cancelTarget &&
          runBusy(async () => {
            await send('/api/owner/action', {
              action: 'cancel-item',
              kotItemId: cancelTarget.id,
              reason: cancelReason,
            });
            toast.show(`${cancelTarget.name} cancelled — ${cancelReason.toLowerCase()}`, { tone: 'success' });
            setCancelTarget(null);
          })
        }
      />
    </div>
  );
}
