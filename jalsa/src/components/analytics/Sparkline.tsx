'use client';
/**
 * Sparkline - shape of a series, inline, at tile size.
 *
 * WHY INLINE SVG AND NOT A CHARTING LIBRARY
 *   A sparkline is a polyline. Pulling a charting dependency in for it costs an install, a
 *   bundle, a version to track and a theme integration - to draw a line. Every visualization in
 *   this module is inline SVG for the same reason; when a genuine chart need arrives that this
 *   cannot serve, THAT is the moment to weigh a dependency, with a real requirement to weigh it
 *   against.
 *
 * COLOUR IS NEVER THE MESSAGE
 *   The stroke inherits `currentColor` from the status class its parent sets, so it always
 *   agrees with the worded status beside it. A reader who cannot distinguish the colours loses
 *   nothing: the number, the direction word and the arrow all carry the same fact.
 *
 * ACCESSIBLE BY SUMMARY, NOT BY POINTS
 *   A screen reader gets one sentence - the range and the movement - not sixty coordinates.
 *   An accessible chart is one whose POINT is announced, not whose data is dictated.
 */
import React from 'react';

export function Sparkline({
  series,
  label,
  width = 96,
  height = 28,
  testId = 'sparkline',
}: {
  series: readonly number[];
  /** What the series is, for the spoken summary: "Revenue, last 12 weeks". */
  label?: string;
  width?: number;
  height?: number;
  testId?: string;
}) {
  const points = series.filter((n) => Number.isFinite(n));
  if (points.length < 2) {
    // One point is not a trend. Say so rather than drawing a misleading flat line.
    return (
      <span className="sparkline sparkline--empty" data-testid={`${testId}-empty`}>
        —
      </span>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1; // a flat series draws through the middle, not divided by zero
  const stepX = width / (points.length - 1);
  const pad = 2;
  const usable = height - pad * 2;

  const d = points
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${(pad + usable - ((v - min) / span) * usable).toFixed(2)}`
    )
    .join(' ');

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const movement = last > first ? 'rising' : last < first ? 'falling' : 'flat';
  const summary = `${label ? `${label}: ` : ''}${points.length} points, ${movement}, low ${min}, high ${max}`;

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={summary}
      data-testid={testId}
    >
      <path
        className="sparkline__line"
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        className="sparkline__end"
        cx={width}
        cy={pad + usable - ((last - min) / span) * usable}
        r="2"
        fill="currentColor"
      />
    </svg>
  );
}
