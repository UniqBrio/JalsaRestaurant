'use client';
/**
 * ProgressMeter - "how far toward the target", the one question a percentage answers better
 * than any chart.
 *
 * WHY NOT A DONUT
 *   A donut asks the reader to compare two arc lengths. A bar plus the number asks them to read
 *   a number. Part-to-whole across MANY categories is a donut's actual job; one value against
 *   one target is not.
 *
 * OVERSHOOT IS INFORMATION
 *   Past 100% the bar caps but the LABEL does not - "128% of target" is the fact, and clamping
 *   it to "100%" hides the best news on the dashboard. The bar carries an overshoot class so a
 *   design can mark it; the number is never rewritten.
 */
import React from 'react';

export function ProgressMeter({
  /** 0..n fraction. 0.78 renders as 78%. Values above 1 are shown honestly. */
  progress,
  label,
  caption,
  testId = 'progress',
}: {
  progress: number | null;
  label: string;
  /** e.g. "₹1.95L of ₹2.5L" - the absolute pair behind the percentage. */
  caption?: string;
  testId?: string;
}) {
  if (progress === null) {
    return (
      <div className="progress progress--empty" data-testid={`${testId}-empty`}>
        <span className="progress__label">{label}</span>
        <span className="progress__value">No target set</span>
      </div>
    );
  }

  const pct = Math.round(progress * 100);
  const capped = Math.max(0, Math.min(100, pct));
  const over = pct > 100;

  return (
    <div className={`progress${over ? ' progress--over' : ''}`} data-testid={testId}>
      <div className="progress__head">
        <span className="progress__label">{label}</span>
        <span className="progress__value" data-testid={`${testId}-value`}>
          {pct}% of target
        </span>
      </div>
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pct}% of target`}
      >
        <div className="progress__fill" style={{ width: `${capped}%` }} />
      </div>
      {caption && <span className="progress__caption">{caption}</span>}
    </div>
  );
}
