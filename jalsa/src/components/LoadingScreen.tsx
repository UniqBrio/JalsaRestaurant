'use client';
/**
 * LoadingScreen — the full-surface wait, designed rather than defaulted.
 *
 * WHAT IT IS FOR, AND WHAT IT IS NOT FOR
 *   Use it where the whole surface has nothing to show yet: a first load, a report being
 *   assembled, a document being generated. Do NOT use it for a slow row inside a populated
 *   table — replacing a screen the user is reading with a spinner loses their place.
 *
 * THREE THINGS IT DOES THAT A SPINNER DOES NOT
 *   1. It SAYS what is being done, in the user's words, from configurable copy (docs/05).
 *   2. It SHOWS the work: a line diagram of the pipeline with the active stage marked, so a
 *      long wait reads as progress rather than a hang.
 *   3. It STOPS PRETENDING. Past the stalled threshold it says so and offers a route onward —
 *      the "no dead ends" rule applies to waiting screens too, and this is the one screen
 *      where the user has nothing else to click.
 *
 * MOTION IS DECORATION (CP-13)
 *   The stage marks animate through the motion tokens and collapse to their end state under
 *   `prefers-reduced-motion` — handled globally in the generated theme CSS. Nothing here waits
 *   on an animation, and the escape control is a real button the whole time.
 *
 * ACCESSIBILITY
 *   `role="status"` with `aria-live="polite"` so the change from working → slow → stalled is
 *   announced once, not on every tick. The diagram is `aria-hidden`: the stage list beside it
 *   carries the same information as text, which is what a screen reader should get.
 */
import React from 'react';
import { loadingStage, type LoadingConfig } from '../lib/loading';
import './components.css';

export interface LoadingStage {
  id: string;
  /** The thing being done, named as a noun phrase: "Your details", "Prices", "The document". */
  label: string;
}

export function LoadingScreen({
  elapsedMs,
  config,
  stages = [],
  activeStageId,
  onRetry,
  onLeave,
  leaveLabel = 'Go back',
  testId = 'loading',
}: {
  /** How long this wait has been running. The parent owns the clock — see CP-3. */
  elapsedMs: number;
  config?: LoadingConfig;
  /** The pipeline, in order. Two or three entries; a nine-step list is a progress bar in prose. */
  stages?: LoadingStage[];
  activeStageId?: string;
  /** Offered once the wait is stalled. Absent = no retry is possible, and none is shown. */
  onRetry?: () => void;
  onLeave?: () => void;
  leaveLabel?: string;
  testId?: string;
}) {
  const state = loadingStage(elapsedMs, config);
  const activeIndex = Math.max(
    0,
    stages.findIndex((s) => s.id === activeStageId)
  );

  return (
    <div
      className={`loading-screen loading-screen--${state.tone}`}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <LoadingDiagram tone={state.tone} />

      <h1 className="loading-screen__headline" data-testid={`${testId}-headline`}>
        {state.headline}
      </h1>
      {state.detail && (
        <p className="loading-screen__detail" data-testid={`${testId}-detail`}>
          {state.detail}
        </p>
      )}

      {stages.length > 0 && (
        <ol className="loading-screen__stages" data-testid={`${testId}-stages`}>
          {stages.map((s, i) => {
            // Done / in progress / waiting — as WORDS, never as colour alone.
            const status = i < activeIndex ? 'Done' : i === activeIndex ? 'In progress' : 'Waiting';
            return (
              <li
                key={s.id}
                className="loading-screen__stage"
                data-state={status.toLowerCase().replace(' ', '-')}
                data-testid={`${testId}-stage-${s.id}`}
              >
                <span className="loading-screen__stage-mark" aria-hidden="true" />
                <span className="loading-screen__stage-label">{s.label}</span>
                <span className="loading-screen__stage-status">{status}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* The waited time is stated only once the wait is abnormal. Shown from the first second
          it turns an ordinary two-second load into something the user watches and worries at. */}
      {state.tone !== 'working' && (
        <p className="loading-screen__waited" data-testid={`${testId}-waited`}>
          Waiting {state.waitedSeconds}s
        </p>
      )}

      {state.showEscape && (
        <div className="loading-screen__escape" data-testid={`${testId}-escape`}>
          {onRetry && (
            <button data-testid={`${testId}-retry`} type="button" className="loading-screen__retry" onClick={onRetry}>
              Try again
            </button>
          )}
          {onLeave && (
            <button data-testid={`${testId}-leave`} type="button" className="loading-screen__leave" onClick={onLeave}>
              {leaveLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The line diagram: intake → work → delivery, drawn in `currentColor` so it inherits the theme
 * and needs no per-theme asset. It is deliberately abstract — a business-specific illustration
 * would have to be redrawn for every application, and this component ships to all of them.
 * Applications that want their own artwork pass it as a child of their own wrapper instead.
 */
function LoadingDiagram({ tone }: { tone: string }) {
  return (
    <svg
      className={`loading-screen__diagram loading-screen__diagram--${tone}`}
      viewBox="0 0 240 72"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="28" y1="36" x2="212" y2="36" className="loading-screen__track" />
      <line x1="28" y1="36" x2="212" y2="36" className="loading-screen__pulse" />
      <rect x="10" y="22" width="28" height="28" rx="6" className="loading-screen__node" />
      <circle cx="120" cy="36" r="16" className="loading-screen__node loading-screen__node--busy" />
      <path d="M204 22 h26 v28 h-26 z" className="loading-screen__node" />
      <path d="M112 36 l6 6 l12 -14" className="loading-screen__tick" />
    </svg>
  );
}
