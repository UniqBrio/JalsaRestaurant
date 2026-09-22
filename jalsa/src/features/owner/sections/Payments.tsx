'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Pill, SectionLabel } from '@/components/ui/atoms';
import { FirstRunState } from '@/components/ui/states';
import { DataTable } from '@/components/ui/data-table';
import type { OwnerBillView } from '@/lib/db/owner-view';
import type { OwnerSectionProps } from '../OwnerConsole';
import { CloseBillSheet } from '../CloseBillSheet';
import { restaurantIdentity } from '@/lib/restaurant-identity';
import { defaultWhatsAppTemplate, type WhatsAppTemplate } from '@/lib/bill-share';
import { BillDetailSheet } from '../BillDetailSheet';

/**
 * Screen 24 — the closure queue, and everything closed today.
 *
 * THE QUEUE IS THE POINT OF THIS SCREEN. A guest who taps Request payment has finished eating
 * and is waiting; every minute a bill sits here is a table not turning over. It is therefore
 * ordered oldest-first and it says how long each one has waited.
 *
 * "CLOSED TODAY" SITS BESIDE IT rather than on a report, because the question this screen gets
 * asked is "did we take that one?" — and answering it should not need a date range
 * (Standard 4.5: a ledger beside the summary).
 */
export function Payments({ data, send, runBusy, busy }: OwnerSectionProps) {
  const [closing, setClosing] = React.useState<OwnerBillView | null>(null);
  /* Two sheets, two pieces of state, deliberately not one. Reading a closed bill and recording
     a payment are different acts on different bills, and a single `selected` would open the
     wrong one the first time both were reachable from the same table. */
  const [viewing, setViewing] = React.useState<OwnerBillView | null>(null);

  /* The owner's saved WhatsApp template, with any gap filled from the default — which IS the
     message that shipped before it was configurable, so an owner who has never opened Templates
     sends exactly what they sent yesterday. Stored beside the printer templates under
     `settings.print`, in its own key, so the two cannot affect each other. */
  const waTemplate: WhatsAppTemplate = {
    ...defaultWhatsAppTemplate(),
    ...(((data.settings.print ?? {}) as Record<string, unknown>).whatsapp as Partial<WhatsAppTemplate> ?? {}),
  };

  const awaiting = data.openBills
    .filter((b) => b.status === 'payment_requested')
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const others = data.openBills.filter((b) => b.status !== 'payment_requested');

  const canClose = data.grants.includes('bill.record_payment');

  return (
    <div className="flex flex-col gap-5" data-testid="owner-payments">
      <section>
        <SectionLabel>Awaiting closure · {awaiting.length}</SectionLabel>
        {awaiting.length === 0 ? (
          <FirstRunState
            title="Nobody is waiting to pay"
            note="When a guest taps Request payment, their bill lands here with everything already itemised, and the table shows as payment requested on every captain's phone."
            testId="owner-payments-empty"
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {awaiting.map((b) => (
              <li key={b.id}>
                <Card className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block type-body font-bold">
                      {b.tables.join(', ')} <Pill tone="primary">Payment requested</Pill>
                    </span>
                    <span className="block type-caption text-[var(--text-muted)]">
                      {b.code} · {b.spine.captain} · {b.guests} guests · opened {b.openedAt}
                    </span>
                  </span>
                  <span className="type-h3 font-bold tabular-nums">{b.payableLabel}</span>
                  {canClose ? (
                    <Button data-testid={`owner-close-${b.code}`} onClick={() => setClosing(b)}>
                      Record payment
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length ? (
        <section>
          <SectionLabel>Still eating · {others.length}</SectionLabel>
          <Card>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {others.map((b) => (
                <li key={b.id} className="flex flex-wrap items-baseline gap-x-3 type-caption">
                  <span className="font-semibold">{b.tables.join(', ')}</span>
                  <span className="text-[var(--text-muted)]">
                    {b.code} · {b.spine.captain} · {b.kots.length === 1 ? '1 round' : `${b.kots.length} rounds`}
                  </span>
                  <span className="ml-auto tabular-nums">{b.payableLabel}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionLabel>Closed today · {data.closedToday.length}</SectionLabel>
        <DataTable
          rows={data.closedToday}
          rowKey={(b) => b.id}
          defaultSort={{ key: 'bill', direction: 'desc' }}
          exportName="jalsa-closures"
          emptyTitle="Nothing closed yet today"
          emptyNote="Every bill you record lands here, with the mode, the reference and your name on it, ready to reconcile against the till."
          searchPlaceholder="Search bill, table, captain or mode"
          testId="owner-closed-table"
          columns={[
            {
              key: 'bill',
              header: 'Bill',
              /* The bill number opens the bill. It is a button and not a row click: a row that
                 is entirely clickable swallows the text selection somebody needs to copy a
                 reference out of, and it gives a keyboard user no target to tab to. */
              cell: (b) => (
                <button
                  data-testid={`owner-open-bill-${b.code}`}
                  type="button"
                  onClick={() => setViewing(b)}
                  className="rounded-[var(--radius-sm)] font-semibold text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                >
                  {b.code}
                </button>
              ),
              value: (b) => b.code,
            },
            { key: 'table', header: 'Table', cell: (b) => b.tables.join(', '), value: (b) => b.tables.join(', ') },
            {
              key: 'captain',
              header: 'Captain',
              cell: (b) => b.spine.captain,
              value: (b) => b.spine.captain,
              secondary: true,
            },
            {
              key: 'guests',
              header: 'Guests',
              cell: (b) => b.guests,
              value: (b) => b.guests,
              align: 'right',
              secondary: true,
            },
            {
              key: 'rounds',
              header: 'Rounds',
              cell: (b) => b.kots.length,
              value: (b) => b.kots.length,
              align: 'right',
              secondary: true,
            },
            {
              key: 'amount',
              header: 'Payable',
              cell: (b) => <span className="font-semibold">{b.payableLabel}</span>,
              value: (b) => b.payable,
              align: 'right',
            },
          ]}
        />
        <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
          The export carries exactly the rows shown, with the filter you have applied — so what you reconcile against
          is what you were looking at.
        </p>
      </section>

      <BillDetailSheet
        bill={viewing}
        open={viewing !== null}
        onOpenChange={(v) => !v && setViewing(null)}
        /* `data.restaurant.name` is a column that has never existed - the row carries
           `legal_name` and `display_name` - so this read was always undefined and the hardcoded
           fallback went out on every WhatsApp bill. Renaming the restaurant in Settings changed
           nothing. Resolved from the real columns now, in one place. */
        identity={restaurantIdentity(data.restaurant, data.settings.tax as { gstin?: unknown })}
        whatsAppTemplate={waTemplate}
      />

      <CloseBillSheet
        bill={closing}
        open={closing !== null}
        onOpenChange={(v) => !v && setClosing(null)}
        send={send}
        runBusy={runBusy}
        busy={busy}
        canDiscount={data.grants.includes('bill.disc_pct') || data.grants.includes('bill.disc_flat')}
        closerName={data.me.name}
      />
    </div>
  );
}
