/**
 * analytics/format - value presentation, separated from value calculation (CP-24).
 *
 * WHY FORMATTING IS ITS OWN MODULE
 *   A metric that renders "245000" on one screen and "2.45L" on another is two metrics as far
 *   as the reader is concerned. One formatter, configured per application, is what makes a
 *   dashboard scannable in ten seconds instead of read in sixty.
 *
 * LOCALISATION IS A CONFIGURATION, NOT A REWRITE
 *   Locale, currency and compact convention are options with defaults, never literals inside a
 *   component. `compactStyle: 'in'` gives the Indian ladder (K / L / Cr); 'intl' gives K / M / B.
 *   Neither is hardcoded as "correct" - a framework that assumes one market is a framework that
 *   needs forking for the next one.
 *
 * THE HONEST-ZERO RULE
 *   A value that is genuinely absent formats as the placeholder (default '—'), never as '0'.
 *   Zero revenue and unknown revenue are different facts, and a dashboard that renders them
 *   identically is lying to the person making a decision from it.
 */

export type FormatKind =
  'number' | 'decimal' | 'currency' | 'percent' | 'compact' | 'duration' | 'date' | 'datetime' | 'count';

export interface FormatOptions {
  locale?: string;
  currency?: string;
  /** 'in' -> K / L / Cr (thousand, lakh, crore) · 'intl' -> K / M / B. */
  compactStyle?: 'in' | 'intl';
  decimals?: number;
  /** Prefix a leading '+' on positive values - for deltas, never for absolute amounts. */
  signed?: boolean;
  unit?: string;
  /** What an absent value renders as. Never '0'. */
  placeholder?: string;
}

const DEFAULTS: Required<Pick<FormatOptions, 'locale' | 'currency' | 'compactStyle' | 'placeholder'>> = {
  locale: 'en-IN',
  currency: 'INR',
  compactStyle: 'in',
  placeholder: '—',
};

export const isAbsent = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

/** Trim to at most `d` decimals and drop trailing zeros: 2.50 -> "2.5", 2.00 -> "2". */
function trim(n: number, d = 2): string {
  return Number(n.toFixed(d)).toString();
}

export function formatCompact(value: number, opts: FormatOptions = {}): string {
  const style = opts.compactStyle ?? DEFAULTS.compactStyle;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (style === 'in') {
    if (abs >= 1e7) return `${sign}${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}K`;
  } else {
    if (abs >= 1e9) return `${sign}${trim(abs / 1e9)}B`;
    if (abs >= 1e6) return `${sign}${trim(abs / 1e6)}M`;
    if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}K`;
  }
  return `${sign}${trim(abs)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function intl(value: number, locale: string, o: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(locale, o).format(value);
  } catch {
    // A bad locale must never take a dashboard down - degrade to the raw number, visibly.
    return String(value);
  }
}

export function formatValue(value: unknown, kind: FormatKind = 'number', opts: FormatOptions = {}): string {
  const placeholder = opts.placeholder ?? DEFAULTS.placeholder;
  if (isAbsent(value)) return placeholder;

  const locale = opts.locale ?? DEFAULTS.locale;
  const currency = opts.currency ?? DEFAULTS.currency;

  if (kind === 'date' || kind === 'datetime') {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return placeholder;
    const base: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const o = kind === 'datetime' ? { ...base, hour: '2-digit' as const, minute: '2-digit' as const } : base;
    try {
      return new Intl.DateTimeFormat(locale, o).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return placeholder;

  const sign = opts.signed && n > 0 ? '+' : '';
  const unit = opts.unit ? ` ${opts.unit}` : '';

  switch (kind) {
    case 'currency': {
      // Compact currency keeps the symbol and drops the digits: the decision needs the scale,
      // not the paise. The exact figure belongs in the drill-down table.
      if (opts.compactStyle && Math.abs(n) >= (opts.compactStyle === 'in' ? 1e5 : 1e6)) {
        const symbol = intl(0, locale, { style: 'currency', currency, maximumFractionDigits: 0 }).replace(
          /[\d\s.,]/g,
          ''
        );
        return `${sign}${symbol}${formatCompact(n, opts)}`;
      }
      return (
        sign +
        intl(n, locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: opts.decimals ?? 0,
          maximumFractionDigits: opts.decimals ?? 0,
        })
      );
    }
    case 'percent':
      return `${sign}${trim(n, opts.decimals ?? 1)}%`;
    case 'compact':
      return sign + formatCompact(n, opts) + unit;
    case 'decimal':
      return (
        sign +
        intl(n, locale, {
          minimumFractionDigits: opts.decimals ?? 2,
          maximumFractionDigits: opts.decimals ?? 2,
        }) +
        unit
      );
    case 'duration':
      return formatDuration(n);
    case 'count':
    case 'number':
    default:
      return sign + intl(n, locale, { maximumFractionDigits: opts.decimals ?? 0 }) + unit;
  }
}
