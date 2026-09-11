'use client';
/**
 * BarChart - comparison and ranking, in one component with two orientations.
 *
 * WHICH ORIENTATION, AND WHY IT IS NOT A STYLE CHOICE
 *   'horizontal' is for RANKING (top courses, top menu items): the labels are words, words read
 *   left to right, and a ranked list wants to be read down the page. 'vertical' is for
 *   COMPARING across a small ordered set (revenue by month): position carries the order.
 *   Choosing by taste is how a leaderboard ends up with rotated 45-degree labels nobody can read.
 *
 * IT IS A LIST, NOT A PICTURE
 *   Bars are real list items with real values rendered as text beside them. Anyone who cannot
 *   see the bars still reads the ranking; the bar is the accelerator, never the message. When
 *   rows are actionable they are native controls, which makes the whole chart keyboard-operable
 *   for free (CP-22) - a canvas chart would have to re-earn that.
 */
import React from 'react';

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  /** Pre-formatted for display; the raw value drives the bar. */
  display?: string;
}

export function BarChart({
  data,
  orientation = 'horizontal',
  onSelect,
  emptyMessage = 'No data for this period.',
  max,
  testId = 'bars',
}: {
  data: readonly BarDatum[];
  orientation?: 'horizontal' | 'vertical';
  /** Present = every bar becomes a control that drills into that row. */
  onSelect?: (datum: BarDatum) => void;
  emptyMessage?: string;
  /** Override the scale ceiling; defaults to the largest value present. */
  max?: number;
  testId?: string;
}) {
  if (data.length === 0) {
    return <p className="bars__empty" data-testid={`${testId}-empty`}>{emptyMessage}</p>;
  }

  const ceiling = max ?? Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <ul className={`bars bars--${orientation}`} data-testid={testId}>
      {data.map((d) => {
        const pct = Math.max(0, Math.min(100, (Math.abs(d.value) / ceiling) * 100));
        const text = d.display ?? String(d.value);
        const body = (
          <>
            <span className="bars__label">{d.label}</span>
            <span className="bars__track">
              <span className="bars__fill" style={orientation === 'horizontal' ? { width: `${pct}%` } : { height: `${pct}%` }} />
            </span>
            <span className="bars__value">{text}</span>
          </>
        );
        return (
          <li key={d.id} className="bars__row">
            {onSelect ? (
              <button
                type="button"
                className="bars__button"
                aria-label={`${d.label}: ${text}. View details`}
                data-testid={`${testId}-row-${d.id}`}
                onClick={() => onSelect(d)}
              >
                {body}
              </button>
            ) : (
              <span className="bars__static" data-testid={`${testId}-row-${d.id}`}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
