'use client';

import * as React from 'react';
import { Card, SectionLabel } from '@/components/ui/atoms';
import { rangeLabel, readReportAnswer, type DateRange } from '@/lib/report-range';
import type { LovedTally } from '@/lib/favourites';

/**
 * People loved items - the dishes guests hearted on "See my order", over the Reports range
 * (03-Oct-2026).
 *
 * Read from `guest_favourite` through its own endpoint, on open and on a range change - never on
 * the console's poll. Counted in PARTIES: a table hearts a dish once however many phones tap it,
 * so "3" means three tables loved it. Built like `HeardAboutCard` beside it - the same card, the
 * same bar, the same empty and problem states - so the two read as one report.
 */
export function LovedItemsCard({ range, testId = 'owner-rep-loved' }: { range: DateRange; testId?: string }) {
  const [result, setResult] = React.useState<{ items: LovedTally[]; hearts: number } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/owner/favourites?from=${range.from}&to=${range.to}`)
      .then(async (res) => {
        const read = readReportAnswer<{ items: LovedTally[]; hearts: number }>(res.ok, await res.json());
        if (cancelled) return;
        setResult(read.report);
        setProblem(read.problem);
      })
      .catch(() => {
        if (!cancelled) setProblem('The hearts could not be read — the connection may have dropped. Reload the page to try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const top = result?.items[0]?.parties ?? 0;

  return (
    <Card data-testid={testId}>
      <SectionLabel>People loved items · {rangeLabel(range)}</SectionLabel>
      <p className="m-0 mb-3 type-caption leading-relaxed text-[var(--text-muted)]">
        The dishes guests marked with a heart once they were served.
      </p>
      {problem ? (
        <p className="m-0 type-caption text-[var(--error)]" data-testid={`${testId}-problem`}>
          {problem}
        </p>
      ) : !result ? (
        <p className="m-0 type-caption text-[var(--text-muted)]">Reading the hearts…</p>
      ) : result.items.length === 0 ? (
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]" data-testid={`${testId}-empty`}>
          No dish was hearted in this range. Guests can heart a dish on their order screen once it has been served.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {result.items.map((r) => (
            <li key={r.menuItemId ?? `name:${r.name}`} data-testid={`${testId}-row`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate type-body font-semibold">♥ {r.name}</span>
                <span className="shrink-0 type-caption text-[var(--text-muted)]">
                  <span className="tabular-nums">{r.parties}</span> {r.parties === 1 ? 'table' : 'tables'}
                </span>
              </div>
              <div aria-hidden className="mt-1 h-2 w-full rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-2 rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(top ? Math.round((r.parties / top) * 100) : 0, 2)}%` }}
                />
              </div>
            </li>
          ))}
          <li className="type-caption text-[var(--text-muted)]" data-testid={`${testId}-total`}>
            {`${result.items.length} ${result.items.length === 1 ? 'dish' : 'dishes'} loved · ${result.hearts} ${result.hearts === 1 ? 'heart' : 'hearts'} in all`}
          </li>
        </ul>
      )}
    </Card>
  );
}
