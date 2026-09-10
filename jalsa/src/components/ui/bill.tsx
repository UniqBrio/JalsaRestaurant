import * as React from 'react';
import { cn } from '@/lib/cn';
import { rupees, type BillTotals, type TotalsRow } from '@/lib/money';

/**
 * bill — the two blocks that carry money and identity, shared by every surface that shows them.
 *
 * They are components rather than markup-per-screen for the reason the design set gives twice:
 * the identity spine must appear "in the same order and the same place on every screen"
 * (Standard 6.3), and the totals block must itemise "in the same order everywhere including
 * print" (Standard 7.2). Both are promises about CONSISTENCY, and a promise about consistency
 * kept by copy-paste is a promise with an expiry date.
 */

export interface SpineFields {
  captain: string;
  table: string;
  bill: string;
  waiter: string;
  kot: string;
}

/**
 * The five identifiers: captain, table, bill, waiter, KOT — in that order, always.
 *
 * Staff cross-reference between screens constantly. A stable spine means never hunting for the
 * same number twice, and it is why the printed ticket carries the same five in the same order.
 */
export function IdentitySpine({
  fields,
  className,
  testId = 'identity-spine',
}: {
  fields: SpineFields;
  className?: string;
  testId?: string;
}) {
  const rows: Array<[string, string]> = [
    ['Captain', fields.captain],
    ['Table', fields.table],
    ['Bill', fields.bill],
    ['Waiter', fields.waiter],
    ['KOT', fields.kot],
  ];
  return (
    <dl
      data-testid={testId}
      className={cn(
        // Wraps and shrinks rather than scrolling: on a captain's phone this is five short
        // pairs, on the owner's desktop it is one row. Same component, no breakpoint switch.
        'm-0 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 sm:grid-cols-5',
        className
      )}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</dt>
          <dd className="m-0 truncate text-[13px] font-semibold text-[var(--text-body)]">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The itemised totals block.
 *
 * Never a single opaque figure (Standard 7.2). The tip line carries its own sentence, because
 * "tip" beside a total is exactly the ambiguity that makes a guest think the restaurant is
 * keeping it and an accountant book it as revenue.
 */
export function TotalsBlock({
  rows,
  className,
  testId = 'totals',
}: {
  rows: TotalsRow[];
  className?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn('flex flex-col gap-1.5', className)}>
      {rows.map((r) => (
        <div key={r.label}>
          <div
            className={cn(
              'flex items-baseline justify-between gap-4',
              r.emphasis
                ? 'mt-1.5 border-t border-[var(--border)] pt-2.5 text-[15px] font-bold'
                : 'text-[12.5px] text-[var(--text-muted)]'
            )}
          >
            <span>{r.label}</span>
            <span className={cn('tabular-nums', r.emphasis && 'text-[var(--text-body)]')}>{r.value}</span>
          </div>
          {r.note ? <p className="m-0 mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{r.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The one-line summary used where a full block will not fit — a floor tile, a list row.
 *
 * It shows the PAYABLE, and it says the tip is inside it. A short form that quietly drops the
 * tip is the fastest way to make two screens disagree about one number.
 */
export function PayableSummary({ totals, className }: { totals: BillTotals; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span className="text-[14px] font-bold tabular-nums">{rupees(totals.payable)}</span>
      {totals.tip > 0 ? (
        <span className="text-[11px] text-[var(--text-muted)]">incl. {rupees(totals.tip)} tip</span>
      ) : null}
    </span>
  );
}
