'use client';

import * as React from 'react';
import { Card, Chip, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import { FirstRunState } from '@/components/ui/states';
import { rupees } from '@/lib/money';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * The four report panels, in the design set's own order and wording (`repTabs` in
 * Jalsa Owner Admin.dc.html). Named sub-tabs rather than one long scroll — the same rule
 * Settings follows (Standard 1.3), and the same Chip idiom, because a second way to switch a
 * sub-panel in one console is a defect rather than a variation.
 *
 * Uplift is NOT among them: the Navigation Flowchart carries it as its own top-level section and
 * that is where it now lives (see UpliftSection). What remains here is the flowchart's own list —
 * "Sales, purchases and expenses, final report, all-orders ledger".
 *
 * One of the four cannot be computed from this payload. They are drawn as named tabs with an
 * honest empty state rather than left out: a missing tab reads as "this product has no final
 * report", which is untrue, while a named tab that says what it is waiting for is the gap
 * itself, labelled.
 */
type ReportTab = 'sales' | 'orders' | 'expenses' | 'final';

const REPORT_TABS: Array<{ key: ReportTab; label: string }> = [
  { key: 'sales', label: 'Sales & products' },
  { key: 'orders', label: 'All orders' },
  { key: 'expenses', label: 'Purchases & expenses' },
  { key: 'final', label: 'Final report' },
];

export function ReportsSection({ data }: OwnerSectionProps) {
  const [tab, setTab] = React.useState<ReportTab>('sales');
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
      <nav
        className="j-scroll-x flex gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Reports"
      >
        {REPORT_TABS.map((t) => (
          <Chip
            key={t.key}
            on={tab === t.key}
            onClick={() => setTab(t.key)}
            data-testid={`owner-rep-tab-${t.key}`}
          >
            {t.label}
          </Chip>
        ))}
      </nav>

      {tab === 'sales' ? (
        <>
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
        </>
      ) : null}

      {tab === 'orders' ? (
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
        <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
          &ldquo;Placed by&rdquo; is recorded on every round as it is created and cannot be reconstructed afterwards —
          it is what makes &ldquo;is the QR actually being used?&rdquo; answerable at all.
        </p>
      </section>
      ) : null}

      {tab === 'expenses' ? (
        <section>
          <SectionLabel>Purchases &amp; expenses · {data.expensesTotalLabel}</SectionLabel>
          <DataTable
            rows={data.expenses}
            rowKey={(e) => e.id}
            defaultSort={{ key: 'date', direction: 'desc' }}
            exportName="jalsa-purchases"
            emptyTitle="Nothing recorded yet"
            emptyNote="Purchases are typed in under Tips &amp; expenses. This report is only ever as complete as the day's entries — nothing is inferred from anywhere else."
            searchPlaceholder="Search category, note or person"
            testId="owner-purchases-table"
            columns={[
              { key: 'date', header: 'Date', cell: (e) => e.spentOn, value: (e) => e.spentOn },
              {
                key: 'category',
                header: 'Category',
                cell: (e) => <span className="font-semibold">{e.category}</span>,
                value: (e) => e.category,
              },
              { key: 'note', header: 'Note', cell: (e) => e.note, value: (e) => e.note, secondary: true },
              { key: 'by', header: 'Entered by', cell: (e) => e.enteredBy, value: (e) => e.enteredBy, secondary: true },
              { key: 'amount', header: 'Amount', cell: (e) => rupees(e.amount), value: (e) => e.amount, align: 'right' },
            ]}
          />
          <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
            This is the same ledger the Tips &amp; expenses section writes — one set of entries, read here as a report
            rather than re-keyed. Entering and correcting an expense stays there, with the reason it asks for.
          </p>
        </section>
      ) : null}

      {tab === 'final' ? (
        <section>
          <SectionLabel>Final report</SectionLabel>
          <FirstRunState
            title="The final report needs a date range"
            note="Income, purchases and the net for a range — the figure the books are closed on. It needs a ranged read this screen does not do, and a range control that silently only ever meant today would be worse than none: every panel under it would look authoritative and be wrong. Every other tab here exports exactly the rows shown, so a range can be assembled by hand in the meantime."
            testId="owner-final-empty"
          />
        </section>
      ) : null}
    </div>
  );
}
