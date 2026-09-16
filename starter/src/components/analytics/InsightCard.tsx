'use client';
/**
 * InsightCard - the sentence a chart would have made the reader derive.
 *
 * WHY THIS EXISTS AT ALL
 *   "Revenue is 18% higher than last month" is the finding. A line chart is the EVIDENCE for it.
 *   A dashboard made only of evidence hands the reader homework; one made only of findings is
 *   unverifiable. The pairing is the point - lead with the sentence, keep the chart beneath it.
 *
 * THE KIND IS A CLAIM ABOUT URGENCY, AND IT IS WORDED
 *   exception and alert say something is wrong NOW; recommendation says something is worth doing;
 *   goal reports progress; insight is neutral observation. Each renders its kind as a visible
 *   word, so the urgency survives greyscale, colour-blindness and a screenshot in a support chat.
 *
 * AN INSIGHT WITHOUT AN ACTION IS TRIVIA
 *   Every kind except 'insight' should carry an action. "5 payments are overdue" with nowhere to
 *   go is a worry, not a tool.
 */
import React from 'react';

export type InsightKind = 'insight' | 'exception' | 'recommendation' | 'goal' | 'alert';

const KIND_WORD: Record<InsightKind, string> = {
  insight: 'Insight',
  exception: 'Needs attention',
  recommendation: 'Suggested',
  goal: 'Goal',
  alert: 'Alert',
};

export interface Insight {
  id: string;
  kind: InsightKind;
  /** The finding, as one plain sentence in the user's words. */
  headline: string;
  /** Optional supporting number or period. */
  detail?: string;
  action?: { id: string; label: string };
}

export function InsightCard({
  insight,
  onAction,
  testId,
}: {
  insight: Insight;
  onAction?: (actionId: string) => void;
  testId?: string;
}) {
  const id = testId ?? `insight-${insight.id}`;
  return (
    <article className={`insight insight--${insight.kind}`} data-testid={id}>
      <span className="insight__kind">{KIND_WORD[insight.kind]}</span>
      <p className="insight__headline">{insight.headline}</p>
      {insight.detail && <p className="insight__detail">{insight.detail}</p>}
      {insight.action && onAction && (
        <button
          type="button"
          className="insight__action"
          data-testid={`${id}-action`}
          onClick={() => onAction(insight.action!.id)}
        >
          {insight.action.label}
        </button>
      )}
    </article>
  );
}

export function InsightList({
  insights,
  onAction,
  emptyMessage = 'Nothing needs your attention right now.',
  testId = 'insights',
}: {
  insights: readonly Insight[];
  onAction?: (actionId: string) => void;
  emptyMessage?: string;
  testId?: string;
}) {
  if (insights.length === 0) {
    // "All clear" is a real, valuable state - not an empty div.
    return <p className="insight__empty" data-testid={`${testId}-empty`}>{emptyMessage}</p>;
  }
  return (
    <div className="insights" data-testid={testId}>
      {insights.map((i) => <InsightCard key={i.id} insight={i} {...(onAction ? { onAction } : {})} />)}
    </div>
  );
}
