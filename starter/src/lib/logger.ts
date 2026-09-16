/**
 * logger - one sink, one shape, deduplicated.
 *
 * WHY THIS FILE IS SMALL AND BORING
 *   The point is that every part of the application reports failure in the SAME shape, so a
 *   log line can be searched, grouped by signature, and diffed across a deploy. The transport
 *   is deliberately swappable: point `sink` at your provider and nothing else changes.
 *
 * SIGNATURE, NOT INSTANCE
 *   Post-release monitoring groups by the message SHAPE. Interpolating an id into a message
 *   ("user 41f9 not found") creates one signature per user and destroys that grouping. Put
 *   variable data in `data`, never in the message.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  /** Stable, low-cardinality. This is the grouping key. */
  message: string;
  /** Variable detail. Never PII, never secrets, never a raw token. */
  data?: Record<string, unknown>;
  context?: string;
  timestamp: string;
}

type Sink = (record: LogRecord) => void;

const consoleSink: Sink = (r) => {
  const fn = r.level === 'error' ? console.error : r.level === 'warn' ? console.warn : console.log;
  fn(`[${r.level}]${r.context ? ` ${r.context}:` : ''} ${r.message}`, r.data ?? '');
};

let sink: Sink = consoleSink;
/** Swap in a real transport at application start. Keep it synchronous and non-throwing. */
export const setLogSink = (s: Sink) => { sink = s; };

/* A tight-loop failure must not emit 5,000 identical lines and bury everything else. */
const recent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 2000;

function emit(level: LogLevel, message: string, data?: Record<string, unknown>, context?: string) {
  const key = `${level}:${context ?? ''}:${message}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return;
  recent.set(key, now);
  if (recent.size > 500) recent.clear();

  try {
    sink({
      level, message,
      ...(data !== undefined ? { data } : {}),
      ...(context !== undefined ? { context } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch {
    /* A logger that throws turns a handled error into an unhandled one. Never let it. */
  }
}

export const logDebug = (m: string, d?: Record<string, unknown>, c?: string) => emit('debug', m, d, c);
export const logInfo  = (m: string, d?: Record<string, unknown>, c?: string) => emit('info', m, d, c);
export const logWarn  = (m: string, d?: Record<string, unknown>, c?: string) => emit('warn', m, d, c);

/** Errors keep their real machine detail here even when the user sees a calm sentence. */
export function logError(context: string, err: unknown, data?: Record<string, unknown>) {
  const e = err as { message?: string; code?: string; status?: number; stack?: string };
  emit('error', e?.message ?? String(err), {
    ...data,
    code: e?.code,
    status: e?.status,
    stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 6).join('\n') : undefined,
  }, context);
}
