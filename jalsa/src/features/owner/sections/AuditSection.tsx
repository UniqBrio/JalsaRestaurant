'use client';

import * as React from 'react';
import { Card, Chip, Pill, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import type { OwnerSectionProps } from '../OwnerConsole';

/**
 * Screen 33's log — date, time, action, what changed, where, and who.
 *
 * Standard 6.1: disputes are resolved by the log or by argument. A log without a DATE only
 * proves that something happened eventually, which is why both halves are separate columns here
 * and both are sortable.
 *
 * IT IS APPEND-ONLY, AND THERE IS NO WRITE PATH TO IT FROM ANY SCREEN. That is not a UI choice —
 * the application has no update or delete call for this table at all, so "who edited the log"
 * is a question that cannot arise.
 */
export function AuditSection({ data }: OwnerSectionProps) {
  const [type, setType] = React.useState('All');

  const types = ['All', ...[...new Set(data.audit.map((a) => a.action))].sort()];
  const rows = data.audit.filter((a) => type === 'All' || a.action === type);

  return (
    <div className="flex flex-col gap-4" data-testid="owner-audit">
      <Card>
        <SectionLabel>What this log is for</SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Every consequential action — an order placed, a quantity changed, a cancellation, a discount, a closure, a
          permission granted, a price moved — with the minute it happened and the name against it. Entries marked
          confidential involve money, access or someone&rsquo;s employment.
        </p>
      </Card>

      <div className="j-scroll-x flex gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {types.map((t) => (
          <Chip
            key={t}
            on={type === t}
            onClick={() => setType(t)}
            data-testid={`owner-audit-filter-${t.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          >
            {t}
            {t !== 'All' ? (
              <span className="opacity-60">{data.audit.filter((a) => a.action === t).length}</span>
            ) : (
              <span className="opacity-60">{data.audit.length}</span>
            )}
          </Chip>
        ))}
      </div>

      <DataTable
        rows={rows}
        rowKey={(a) => String(a.id)}
        defaultSort={{ key: 'when', direction: 'desc' }}
        exportName="jalsa-audit"
        emptyTitle="Nothing logged yet"
        emptyNote="The first order, closure or setting change writes the first entry. Nothing that matters happens without one."
        searchPlaceholder="Search action, detail, bill, table or person"
        testId="owner-audit-table"
        columns={[
          {
            key: 'date',
            header: 'Date',
            cell: (a) => new Date(a.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            value: (a) => a.at,
          },
          {
            key: 'when',
            header: 'Time',
            cell: (a) =>
              new Date(a.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
            value: (a) => a.at,
          },
          {
            key: 'action',
            header: 'Action',
            cell: (a) => (
              <span className="flex items-center gap-1.5">
                <span className="font-semibold">{a.action}</span>
                {a.confidential ? <Pill tone="warning">Confidential</Pill> : null}
              </span>
            ),
            value: (a) => a.action,
          },
          { key: 'detail', header: 'What changed', cell: (a) => a.detail, value: (a) => a.detail },
          { key: 'where', header: 'Where', cell: (a) => a.where, value: (a) => a.where, secondary: true },
          { key: 'by', header: 'By', cell: (a) => a.by, value: (a) => a.by },
        ]}
      />

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        The export carries exactly the rows shown, with the filter and search applied — and the export itself is not
        recorded, because reading a log should not be an event in it.
      </p>
    </div>
  );
}
