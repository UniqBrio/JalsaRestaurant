'use client';
/**
 * MetricCard - one tile, four optional layers: value · comparison · target · sparkline.
 *
 * WHY ONE COMPONENT AND NOT FIVE
 *   MetricCard / MetricWithTrend / MetricWithComparison / MetricWithTarget / MetricWithSparkline
 *   are the same card with a layer switched on. Five components means five places a padding
 *   changes, five to keep in step, and a reviewer who cannot tell which one a screen should use.
 *   The layers are props because the DIFFERENCE between them is data, not design.
 *
 * THE DIRECTION IS NOT THE VERDICT
 *   The arrow says which way the number moved; the worded status says whether that is good.
 *   They differ whenever `higherIsBetter` is false - expenses, churn, outstanding, cancellations
 *   - and a card that only coloured the arrow would call a rising overdue balance "green".
 *   Status is carried by a WORD plus the class, never by colour alone (rule A-4).
 *
 * AN UNKNOWN NUMBER IS NOT ZERO
 *   `value: null` renders the placeholder and suppresses the comparison entirely. A tile showing
 *   "0" for "we could not load this" is the most expensive lie a dashboard can tell.
 */
import React from 'react';
import { formatValue } from '../../lib/analytics/format';
import type { MetricDefinition, MetricResult } from '../../lib/analytics/metrics';
import { Sparkline } from './Sparkline';
import { ProgressMeter } from './ProgressMeter';

const STATUS_WORD = { good: 'better', bad: 'worse', neutral: 'unchanged', unknown: '' } as const;
const ARROW = { up: '↑', down: '↓', flat: '→' } as const;

export function MetricCard({
  definition,
  result,
  comparisonLabel = 'vs previous period',
  onAction,
  loading = false,
  error,
  testId,
}: {
  definition: MetricDefinition;
  result: MetricResult;
  comparisonLabel?: string;
  /** Present = the card offers its drill-down / declared action. */
  onAction?: (actionId: string) => void;
  loading?: boolean;
  /** Customer-worded, from the error taxonomy - never a raw engine string. */
  error?: string;
  testId?: string;
}) {
  const id = testId ?? `metric-${definition.id}`;
  const fmt = { ...definition.formatOptions, unit: definition.unit };

  if (loading) {
    return (
      <article className="metric metric--loading" aria-busy="true" data-testid={`${id}-loading`}>
        <span className="metric__label">{definition.label}</span>
        <span className="metric__skeleton" />
      </article>
    );
  }

  if (error) {
    return (
      <article className="metric metric--error" data-testid={`${id}-error`}>
        <span className="metric__label">{definition.label}</span>
        <p className="metric__error">{error}</p>
      </article>
    );
  }

  const value = formatValue(result.value, definition.format ?? 'number', fmt);
  const showComparison =
    result.value !== null && result.growth !== null && definition.comparisonPeriod !== 'none';
  const action = definition.actions?.[0];

  return (
    <article
      className={`metric metric--${definition.priority ?? 'primary'} metric--status-${result.status}`}
      data-testid={id}
    >
      <span className="metric__label">{definition.label}</span>

      <strong className="metric__value" data-testid={`${id}-value`}>{value}</strong>

      {showComparison ? (
        <p className="metric__comparison" data-testid={`${id}-trend`}>
          <span aria-hidden="true">{ARROW[result.direction]}</span>{' '}
          {formatValue(Math.abs(result.growth! * 100), 'percent', { decimals: 1 })}{' '}
          {/* The word is what makes the movement judgeable without seeing the colour. */}
          <span className="metric__status-word">{STATUS_WORD[result.status]}</span>{' '}
          <span className="metric__comparison-label">{comparisonLabel}</span>
        </p>
      ) : result.value !== null && definition.comparisonPeriod !== 'none' ? (
        <p className="metric__comparison metric__comparison--none" data-testid={`${id}-no-comparison`}>
          No prior period to compare
        </p>
      ) : null}

      {definition.visualization === 'sparkline' && result.series && (
        <Sparkline series={result.series} label={definition.label} testId={`${id}-sparkline`} />
      )}

      {definition.visualization === 'progress' && (
        <ProgressMeter
          progress={result.targetProgress}
          label={definition.label}
          caption={definition.target !== undefined
            ? `${value} of ${formatValue(definition.target, definition.format ?? 'number', fmt)}`
            : undefined}
          testId={`${id}-progress`}
        />
      )}

      {definition.description && <p className="metric__description">{definition.description}</p>}

      {action && onAction && (
        <button
          type="button"
          className="metric__action"
          data-testid={`${id}-action`}
          onClick={() => onAction(action.id)}
        >
          {action.label}
        </button>
      )}
    </article>
  );
}
