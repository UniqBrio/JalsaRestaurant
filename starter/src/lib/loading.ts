/**
 * loading — what a waiting screen says, and when it stops pretending.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 *   A spinner is the one state every user sees and nobody designs. Three things go wrong with
 *   it, and each is invisible in a demo where the data arrives in 40ms:
 *
 *   1. IT SAYS NOTHING. "Loading…" tells the user the page is not broken and nothing else.
 *      A waiting screen is the only surface where the application has the user's full
 *      attention and no content to show — so it says what it is doing FOR them.
 *   2. IT NEVER ENDS. CP-3 makes the loader terminate; this makes the WAIT terminate for the
 *      user. Past a threshold, the honest answer is "this is taking longer than it should",
 *      with a way onward — never the same cheerful message at minute three.
 *   3. THE COPY IS HARD-CODED. Every string here is customer-facing, so it is configuration
 *      (docs/05). A cleared field falls back to the default rather than blanking the screen:
 *      an empty headline is a worse loading screen than a generic one.
 *
 * WHY THIS IS A PURE FUNCTION AND NOT A COMPONENT
 *   The decision — which tone, which words, is there a way out yet — is the part that can be
 *   wrong, so it is the part that is tested. The component below it only paints.
 */

/** How long the wait has been going, in the user's terms. */
export type LoadingTone = 'working' | 'slow' | 'stalled';

export interface LoadingCopy {
  /** The promise. Shown large. */
  headline: string;
  /** The specifics: what is being made, or what to do about it. */
  detail?: string;
}

export interface LoadingConfig {
  /** After this long the wait stops being ordinary and says so. */
  slowAfterMs?: number;
  /** After this long the wait is a failure with a way onward, not a wait. */
  stalledAfterMs?: number;
  /** Administrator-editable copy. A blank string falls back — it never blanks the screen. */
  copy?: Partial<Record<LoadingTone, Partial<LoadingCopy>>>;
  /** What is being made, in the user's words: "your invoice", "this month's report". */
  work?: string;
}

export interface LoadingState extends LoadingCopy {
  tone: LoadingTone;
  /** True once the screen owes the user a route out (docs standard: no dead ends). */
  showEscape: boolean;
  /** Whole seconds waited — for the "waiting 12s" line, never for a progress claim. */
  waitedSeconds: number;
}

/**
 * The default words. They are a starting point an administrator overrides, not a constant:
 * every one of them is customer-facing copy.
 */
export const DEFAULT_LOADING_COPY: Record<LoadingTone, LoadingCopy> = {
  working: {
    headline: 'We’re working for you, making things for you.',
    detail: 'This usually takes a moment.',
  },
  slow: {
    headline: 'We’re working for you, making things for you.',
    detail: 'This is taking longer than usual. You can keep waiting — nothing is lost.',
  },
  stalled: {
    headline: 'This is taking much longer than it should.',
    detail: 'Nothing you entered has been lost. Try again, or carry on and come back to it.',
  },
};

export const DEFAULT_SLOW_AFTER_MS = 6_000;
export const DEFAULT_STALLED_AFTER_MS = 20_000;

/** A configured string wins only if it is actually a string with content in it. */
function pick(configured: string | undefined, fallback: string | undefined): string | undefined {
  const trimmed = typeof configured === 'string' ? configured.trim() : '';
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Thresholds are configuration, so they arrive wrong sometimes. A `stalledAfterMs` at or below
 * `slowAfterMs` would make the stalled tone unreachable — the state the user most needs would
 * simply never render, and nothing would report it. Ordering them is not politeness, it is the
 * difference between a configurable threshold and a silently dead one.
 */
export function resolveThresholds(config: LoadingConfig = {}): { slow: number; stalled: number } {
  const slow = Number.isFinite(config.slowAfterMs) && (config.slowAfterMs as number) >= 0
    ? (config.slowAfterMs as number)
    : DEFAULT_SLOW_AFTER_MS;
  const wanted = Number.isFinite(config.stalledAfterMs) && (config.stalledAfterMs as number) >= 0
    ? (config.stalledAfterMs as number)
    : DEFAULT_STALLED_AFTER_MS;
  return { slow, stalled: wanted > slow ? wanted : slow + 1 };
}

/**
 * The whole decision, from one number. `elapsedMs` that is negative, NaN or absent is treated
 * as "just started" — a clock that went backwards must not fabricate a failure state.
 */
export function loadingStage(elapsedMs: number, config: LoadingConfig = {}): LoadingState {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const { slow, stalled } = resolveThresholds(config);

  const tone: LoadingTone = elapsed >= stalled ? 'stalled' : elapsed >= slow ? 'slow' : 'working';
  const base = DEFAULT_LOADING_COPY[tone];
  const override = config.copy?.[tone] ?? {};

  const headline = pick(override.headline, base.headline) as string;
  let detail = pick(override.detail, base.detail);
  // The work is named where it is known: "making your invoice" beats "making things for you"
  // every time, and it is the one fact the user came here holding.
  if (config.work && tone !== 'stalled') {
    detail = detail ? `${detail} We’re preparing ${config.work}.` : `We’re preparing ${config.work}.`;
  }

  return {
    tone,
    headline,
    detail,
    showEscape: tone === 'stalled',
    waitedSeconds: Math.floor(elapsed / 1000),
  };
}
