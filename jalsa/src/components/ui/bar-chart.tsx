'use client';

import * as React from 'react';

/**
 * One series of bars, for Reports (item 39, 25-Sep-2026).
 *
 * WHY HAND-DRAWN AND NOT A LIBRARY: the project has none, and Reports already draws its payment
 * bars in CSS. Colour is a token (`--primary`, contrast-gated in both themes), so the chart
 * follows the theme with no second palette. One series: no legend - the section title names it.
 *
 * READABLE WITHOUT THE PICTURE: every bar carries its value in a hover tooltip (`title`), the
 * figure is printed beside the largest bar, and the whole chart has a text alternative listing
 * every value - the table below each chart is the full table view.
 */
export interface Bar {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  /** Shown on hover after the value, e.g. "3 bills". */
  detail?: string;
}

/** Vertical bars along a time axis - "Sales by day". Scales to its container. */
export function ColumnChart({ bars, testId, summary }: { bars: readonly Bar[]; testId: string; summary: string }) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  const n = bars.length;
  const W = 640;
  const H = 180;
  const base = H - 22;
  const gap = n > 40 ? 1 : 2;
  const bw = n ? Math.max(1, (W - gap * (n - 1)) / n) : 0;
  const every = Math.max(1, Math.ceil(n / 8));
  const peak = bars.findIndex((b) => b.value === max && max > 0);
  return (
    <figure className="m-0" data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={summary}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--border)" strokeWidth={1} />
        {bars.map((b, i) => {
          const h = max > 0 ? Math.max(b.value > 0 ? 2 : 0, ((base - 16) * b.value) / max) : 0;
          const x = i * (bw + gap);
          return (
            <g key={b.key} data-testid={`${testId}-bar-${b.key}`}>
              {/* The hit area is the whole column, taller than the bar, so a thin bar can be hovered. */}
              <rect x={x} y={0} width={bw} height={base} fill="transparent">
                <title>{`${b.label}: ${b.valueLabel}${b.detail ? ` · ${b.detail}` : ''}`}</title>
              </rect>
              <rect
                x={x}
                y={base - h}
                width={bw}
                height={h}
                rx={Math.min(2, bw / 2)}
                fill="var(--primary)"
                pointerEvents="none"
              />
              {i % every === 0 ? (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                  {b.label}
                </text>
              ) : null}
              {i === peak ? (
                <text
                  x={Math.min(Math.max(x + bw / 2, 30), W - 30)}
                  y={base - h - 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-body)"
                >
                  {b.valueLabel}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Horizontal bars, largest first - "Sales by category". */
export function BarList({ bars, testId }: { bars: readonly Bar[]; testId: string }) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid={testId}>
      {bars.map((b) => (
        <li key={b.key} title={`${b.label}: ${b.valueLabel}${b.detail ? ` · ${b.detail}` : ''}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate type-caption font-semibold">{b.label}</span>
            <span className="shrink-0 type-caption tabular-nums text-[var(--text-muted)]">
              {b.valueLabel}
              {b.detail ? ` · ${b.detail}` : ''}
            </span>
          </div>
          <div aria-hidden className="mt-1 h-2 w-full rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-2 rounded-full bg-[var(--primary)]"
              style={{ width: `${max > 0 ? Math.max(b.value > 0 ? 2 : 0, (b.value / max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
