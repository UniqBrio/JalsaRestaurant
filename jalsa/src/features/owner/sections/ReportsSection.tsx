'use client';

import * as React from 'react';
import { Card, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import { FirstRunState } from '@/components/ui/states';
import { rupees } from '@/lib/money';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * Screen 32 — reports, at the depth this slice honestly reaches.
 *
 * WHAT IS HERE: today's sales, the product report, and the all-orders ledger — the three that
 * can be computed exactly from what the console already read, so every figure reconciles with
 * the dashboard tile that links to it (Standards 1.4 and 7.4). Each exports what is on screen.
 *
 * WHAT IS DELIBERATELY NOT HERE, AND SAYS SO: a date range wider than today, the purchases and
 * final reports, and the uplift report. They need a ranged read this payload does not do, and a
 * range control that silently only ever means "today" is worse than no range control at all
 * (Standard 4.4). They are Slice 2 in the request file, and the panel below names them rather
 * than leaving a gap someone has to discover.
 */
export function ReportsSection({ data }: OwnerSectionProps) {
  const closed = data.closedToday;

  // Product report: quantity and revenue per dish, from the closed bills' own lines. Computed
  // from the same rows the closure figures came from, so top sellers add up to sales.
  const products = React.useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const b of closed) {
      for (const k of b.kots) {
        for (const i of k.items) {
          if (i.cancelled) continue;
          const seen = map.get(i.name) ?? { name: i.name, qty: 0, revenue: 0 };
          seen.qty += i.qty;
          // lineLabel is already the money; the raw number is recovered from it once, here,
          // rather than by every consumer re-parsing a formatted string.
          seen.revenue += Number(i.lineLabel.replace(/[^0-9]/g, '')) || 0;
          map.set(i.name, seen);
        }
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [closed]);

  const orders = React.useMemo(
    () =>
      [...closed, ...data.openBills].map((b) => ({
        id: b.id,
        code: b.code,
        tables: b.tables.join(', '),
        captain: b.spine.captain,
        guests: b.guests,
        rounds: b.kots.length,
        sources: [...new Set(b.kots.map((k) => k.sourceLabel))].join(', '),
        status: b.statusLabel,
        openedAt: b.openedAt,
        payable: b.payable,
        payableLabel: b.payableLabel,
      })),
    [closed, data.openBills]
  );

  const cancellations = [...closed, ...data.openBills].flatMap((b) =>
    b.kots.flatMap((k) => k.items.filter((i) => i.cancelled).map((i) => ({ bill: b.code, item: i.name })))
  ).length;

  return (
    <div className="flex flex-col gap-6" data-testid="owner-reports">
      <section>
        <SectionLabel>Today</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricTile label="Sales" value={data.today.salesLabel} note="Excludes tips" testId="owner-rep-sales" />
          <MetricTile
            label="Bills closed"
            value={String(closed.length)}
            note={data.today.coversLabel}
            testId="owner-rep-bills"
          />
          <MetricTile
            label="Discounts given"
            value={data.today.discountsLabel}
            note="Each one names who gave it"
            testId="owner-rep-discounts"
          />
          <MetricTile
            label="Cancellations"
            value={String(cancellations)}
            note="Every one carries a reason"
            testId="owner-rep-cancellations"
          />
        </div>
      </section>

      <section>
        <SectionLabel>What sold · {products.length} dishes</SectionLabel>
        {products.length === 0 ? (
          <FirstRunState
            title="Nothing has been closed yet today"
            note="The product report is built from closed bills, so it fills up as the evening is settled rather than as it is ordered."
            testId="owner-products-empty"
          />
        ) : (
          <DataTable
            rows={products}
            rowKey={(p) => p.name}
            defaultSort={{ key: 'revenue', direction: 'desc' }}
            exportName="jalsa-products"
            emptyTitle="Nothing sold yet"
            emptyNote="Closed bills fill this in."
            searchPlaceholder="Search a dish"
            testId="owner-products-table"
            columns={[
              {
                key: 'name',
                header: 'Dish',
                cell: (p) => <span className="font-semibold">{p.name}</span>,
                value: (p) => p.name,
              },
              { key: 'qty', header: 'Sold', cell: (p) => p.qty, value: (p) => p.qty, align: 'right' },
              {
                key: 'revenue',
                header: 'Revenue',
                cell: (p) => rupees(p.revenue),
                value: (p) => p.revenue,
                align: 'right',
              },
            ]}
          />
        )}
      </section>

      <section>
        <SectionLabel>All orders · {orders.length}</SectionLabel>
        <DataTable
          rows={orders}
          rowKey={(o) => o.id}
          defaultSort={{ key: 'bill', direction: 'desc' }}
          exportName="jalsa-orders"
          emptyTitle="No orders yet"
          emptyNote="Every bill, open or closed, appears here with how it was ordered and who ran it."
          searchPlaceholder="Search bill, table, captain or how it was placed"
          testId="owner-orders-ledger"
          columns={[
            {
              key: 'bill',
              header: 'Bill',
              cell: (o) => <span className="font-semibold">{o.code}</span>,
              value: (o) => o.code,
            },
            { key: 'table', header: 'Table', cell: (o) => o.tables, value: (o) => o.tables },
            { key: 'opened', header: 'Opened', cell: (o) => o.openedAt, value: (o) => o.openedAt, secondary: true },
            {
              key: 'guests',
              header: 'Guests',
              cell: (o) => o.guests,
              value: (o) => o.guests,
              align: 'right',
              secondary: true,
            },
            {
              key: 'rounds',
              header: 'Rounds',
              cell: (o) => o.rounds,
              value: (o) => o.rounds,
              align: 'right',
              secondary: true,
            },
            { key: 'source', header: 'Placed by', cell: (o) => o.sources, value: (o) => o.sources },
            { key: 'captain', header: 'Captain', cell: (o) => o.captain, value: (o) => o.captain, secondary: true },
            { key: 'status', header: 'Status', cell: (o) => o.status, value: (o) => o.status },
            { key: 'total', header: 'Total', cell: (o) => o.payableLabel, value: (o) => o.payable, align: 'right' },
          ]}
        />
        <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          &ldquo;Placed by&rdquo; is recorded on every round as it is created and cannot be reconstructed afterwards —
          it is what makes &ldquo;is the QR actually being used?&rdquo; answerable at all.
        </p>
      </section>

      <section>
        <SectionLabel>Not in this release</SectionLabel>
        <Card>
          <p className="m-0 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            A date range wider than today, the purchases and final reports, the review-engagement figure and the
            uplift report are the next slice of work, not a gap in this one. They need a ranged read this screen does
            not do, and a range control that silently only ever meant &ldquo;today&rdquo; would be worse than none —
            every panel under it would look authoritative and be wrong.
          </p>
          <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            Everything above exports exactly the rows shown, so a range can be assembled by hand in the meantime.
          </p>
        </Card>
      </section>
    </div>
  );
}
