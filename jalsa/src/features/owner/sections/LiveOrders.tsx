'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, Chip, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { IdentitySpine, TotalsBlock } from '@/components/ui/bill';
import { PrintTargets } from '@/components/ui/print';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input } from '@/components/ui/field';
import { FirstRunState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { billSeparability, eligibleForBillRole } from '@/lib/status';
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
 *
 * AND THE BADGE NAMES THE MACHINE (19-Sep-2026). It used to say only "Print failed", and the
 * button under it said "Retry the print" — which called `reprint`, which re-ran routing with no
 * categories and therefore sent every retry to the fallback machine. The owner could not see
 * where the ticket had been meant to go, and the button did not do what it said. Both facts now
 * come from the job itself: `PrintTargets` shows one row per machine, and its retry re-sends to
 * that same machine. Reprint, below, is the separate act of marking and re-issuing paper that
 * DID come out.
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
  const [detaching, setDetaching] = React.useState<{ table: string; amountLabel: string } | null>(null);
  /* Correcting the captain or waiter on a bill — running or closed. Behind a grant, because on a
     closed bill it moves an unsettled tip with the name. See reassignBillStaff. */
  const [reassign, setReassign] = React.useState<'captain' | 'waiter' | null>(null);
  const canReassign = data.grants.includes('bill.reassign_staff');
  // Separating a table is the same act as joining one, in reverse, so it carries the same grant.
  // Minting `bill.split` would be a migration for a permission the matrix already expresses.
  const canSplit = data.grants.includes('tables.assign');

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
                  <span className="type-body font-bold">{b.tables.join(', ')}</span>
                  <span className="type-body font-bold tabular-nums">{b.payableLabel}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 type-caption text-[var(--text-muted)]">
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
            {/* THE LIST NOW MATCHES THE TITLE. It offered every active person — Chefs, Cleaning
                staff, the Cashier — under a heading that said "Captain on B-1043", and the write
                behind it checked nothing, so an unsettled tip could be moved to a cleaner. The
                same predicate runs on the server (see reassignBillStaff). */}
            {/*
              SEARCH ONLY — no `allowCreate`. A staff member is created in the Staff section,
              with a role, a PIN and a permission set; offering to conjure one from a
              reassignment box would be inventing a person to hold a tip.

              What this replaced was a hand-rolled search box above a filtered list of buttons —
              the third implementation of one interaction, and the one the standardisation
              exists to remove. NOTHING about the write changed: the same
              `eligibleForBillRole` decides who may appear (and the same predicate still runs on
              the server in `reassignBillStaff`), the same `staffId` goes to the same action, the
              captain/waiter distinction is still `reassign`, and the tip-moved sentence is
              untouched.
            */}
            <Field label="Find a name" htmlFor="owner-reassign-search">
              <Combobox
                id="owner-reassign-search"
                testId="owner-reassign-search"
                value=""
                disabled={busy}
                placeholder={reassign === 'waiter' ? 'Search waiters' : 'Search captains'}
                emptyLabel={reassign === 'waiter' ? 'No waiter matches' : 'No captain matches'}
                options={eligibleForBillRole(
                  reassign ?? 'captain',
                  data.staff,
                  (reassign === 'waiter' ? selected.spine.waiter : selected.spine.captain)
                    ? (data.staff.find(
                        (s) => s.name === (reassign === 'waiter' ? selected.spine.waiter : selected.spine.captain)
                      )?.id ?? null)
                    : null
                ).map((p) => ({ value: p.id, label: p.name, hint: p.role }))}
                onValueChange={(staffId) => {
                  const role = reassign;
                  const person = data.staff.find((p) => p.id === staffId);
                  if (!role || !person) return;
                  runBusy(async () => {
                    const res = await send<{ tipMoved: number }>('/api/owner/action', {
                      action: 'reassign-bill-staff',
                      billId: selected.id,
                      role,
                      staffId,
                    });
                    toast.show(
                      res.tipMoved > 0
                        ? `${selected.code}: ${role} is now ${person.name} — ${rupees(res.tipMoved)} of unsettled tip moved with it`
                        : `${selected.code}: ${role} is now ${person.name}`,
                      { tone: 'success' }
                    );
                    setReassign(null);
                  });
                }}
              />
            </Field>
          </Sheet>

          {/* THE GROUP, AND WHAT EACH TABLE ON IT ATE.
              `perTable` has been computed on every group bill since the beginning and was
              rendered nowhere — the host could see one total across four tables and had no way
              to see the four. It is here now, and it is also the figure beside Separate: the
              same `where table_id = …` that moves the rounds, so what a host reads is exactly
              what leaves. */}
          {selected.groupCode ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 rounded-[var(--radius-md)] bg-[var(--info-surface)] px-4 py-2.5 type-caption text-[var(--on-info-surface)]">
                {selected.groupCode} — one bill across {selected.tables.length} tables. Each keeps its own code and
                orders on its own phone; every round carries the table it came from.
              </p>
              {selected.perTable.length ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="owner-bill-per-table">
                  {selected.perTable.map((t) => (
                    <li
                      key={t.table}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 type-caption font-semibold">
                        {t.table}
                        {t.isHost ? (
                          <span className="ml-2 font-normal text-[var(--text-muted)]">
                            the bill was opened here
                          </span>
                        ) : null}
                      </span>
                      <span className="type-caption tabular-nums">{t.amountLabel}</span>
                      {canSplit &&
                      billSeparability({
                        status: selected.status,
                        tableCount: selected.tables.length,
                        isHostTable: t.isHost,
                      }).can ? (
                        <Button
                          data-testid={`owner-bill-detach-${t.table}`}
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setDetaching({ table: t.table, amountLabel: t.amountLabel })}
                        >
                          Separate
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                These are each table&rsquo;s own rounds before tax and tip, and they add up to the bill exactly —
                nothing here is apportioned. Separating a table moves those rounds onto a bill of its own.
              </p>
            </div>
          ) : null}

          {selected.occasion ? (
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--primary-surface)] px-4 py-2.5 type-caption font-semibold text-[var(--on-primary-surface)]">
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
                      <span className="type-caption font-bold">
                        {k.code} <span className="font-normal text-[var(--text-muted)]">· {k.placedAt}</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone="neutral">{k.sourceLabel}</Pill>
                        {/* Only for a round placed before print jobs carried their own destination.
                            Where they do, PrintTargets says it per machine and this would double. */}
                        {k.printJobs.length === 0 && k.printStatus === 'failed' ? (
                          <Pill tone="error">Print failed</Pill>
                        ) : null}
                        {k.reprintCount > 0 ? <Pill tone="neutral">Reprinted ×{k.reprintCount}</Pill> : null}
                        <Pill tone={k.tone}>{k.statusLabel}</Pill>
                      </div>
                    </div>
                    <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">From table {k.fromTable}</p>

                    <PrintTargets
                      jobs={k.printJobs}
                      canRetry={data.grants.includes('orders.reprint')}
                      busy={busy}
                      testIdPrefix={`owner-kot-${k.id}`}
                      onRetry={(job) =>
                        runBusy(async () => {
                          const res = await send<{ printerName: string; station: string }>('/api/owner/action', {
                            action: 'retry-print',
                            jobId: job.id,
                          });
                          toast.show(`${k.code} re-sent to ${res.printerName} · ${res.station}`);
                        })
                      }
                    />

                    <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
                      {k.items.map((i) => (
                        <li key={i.id} className="flex items-center gap-2.5 type-caption">
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
                            toast.show(`${k.code} reprinted — stamped REPRINT`);
                          })
                        }
                      >
                        {/* Always the same word now. A retry and a reprint are different acts —
                            one re-sends paper that never came out, the other marks and re-issues
                            paper that did — and one button that silently changed which it meant
                            was how the two came to be confused in the first place. */}
                        Reprint
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

      {/* SEPARATE. A confirm rather than a button, because two bills where there was one is not
          undoable from a screen: rejoining is a fresh join, and the new bill has its own number
          that a guest may already have been shown. */}
      <ConfirmDialog
        open={detaching !== null}
        onOpenChange={(o) => !o && setDetaching(null)}
        title={detaching ? `Separate ${detaching.table} onto its own bill` : 'Separate'}
        confirmLabel="Separate it"
        busy={busy}
        testId="owner-bill-detach"
        consequence={
          detaching && selected ? (
            <p className="m-0 leading-relaxed">
              <strong>{detaching.table}</strong>&rsquo;s rounds — <strong>{detaching.amountLabel}</strong> before tax —
              move onto a new bill with its own number, and the table pays separately. {selected.code} keeps everything
              the other tables ordered, and keeps any tip: a tip is one guest&rsquo;s decision about one total and
              there is no honest way to divide it.
            </p>
          ) : null
        }
        onConfirm={() =>
          detaching &&
          selected &&
          runBusy(async () => {
            const res = await send<{ newBillCode: string; movedRounds: number }>('/api/owner/action', {
              action: 'detach-table',
              billId: selected.id,
              tableId: data.floor.find((f) => f.name === detaching.table)?.id ?? '',
            });
            toast.show(
              `${detaching.table} is now ${res.newBillCode} — ${
                res.movedRounds === 1 ? '1 round' : `${res.movedRounds} rounds`
              } moved`,
              { tone: 'success' }
            );
            setDetaching(null);
          })
        }
      />
    </div>
  );
}
