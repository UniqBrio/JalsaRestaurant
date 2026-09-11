import * as React from 'react';
import { cn } from '@/lib/cn';
import { FOOD_TYPE, type FoodType, type Tone } from '@/lib/status';

/**
 * atoms — the small, shared pieces the three surfaces all draw with.
 *
 * They live together because they are read together: a card carries a pill, a pill carries a
 * tone, a row carries a food mark. Split across five files they drift; here, a change to the
 * tone vocabulary is one edit and every surface follows.
 */

/* ── Card ──────────────────────────────────────────────────────────────── */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'm-0 mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.11em] text-[var(--text-muted)]',
        className
      )}
    >
      {children}
    </p>
  );
}

/* ── Status pill ───────────────────────────────────────────────────────── */

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  primary: 'bg-[var(--primary)] text-[var(--on-primary)]',
  success: 'bg-[var(--success-surface)] text-[var(--on-success-surface)]',
  warning: 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]',
  error: 'bg-[var(--error-surface)] text-[var(--on-error-surface)]',
  info: 'bg-[var(--info-surface)] text-[var(--on-info-surface)]',
};

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Food type mark ────────────────────────────────────────────────────── */

const MARK_CLASS: Record<FoodType, string> = {
  veg: 'border-[var(--food-type-veg)]',
  non_veg: 'border-[var(--food-type-non-veg)]',
  egg: 'border-[var(--food-type-egg)]',
};
const DOT_CLASS: Record<FoodType, string> = {
  veg: 'bg-[var(--food-type-veg)]',
  non_veg: 'bg-[var(--food-type-non-veg)]',
  egg: 'bg-[var(--food-type-egg)]',
};

/**
 * The veg / non-veg / eggitarian mark.
 *
 * A VISUAL PRIMITIVE, NOT DECORATION. It reads on cards, in cart lines, on the KOT and on the
 * bill, and for a great many guests it is the single most important thing on the screen. It
 * therefore always carries its label to assistive technology — colour alone is not the mark,
 * because roughly one in twelve men cannot separate the green from the red.
 */
export function FoodMark({ type, size = 13 }: { type: FoodType; size?: number }) {
  const label = FOOD_TYPE[type].label;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[3px] border-[1.5px]',
        MARK_CLASS[type]
      )}
      style={{ width: size, height: size }}
    >
      <span className={cn('rounded-full', DOT_CLASS[type])} style={{ width: size * 0.46, height: size * 0.46 }} />
    </span>
  );
}

/* ── Quantity stepper ──────────────────────────────────────────────────── */

/**
 * − qty + at 44px per tap target.
 *
 * The count sits BETWEEN the two buttons and is not itself tappable: a stepper whose middle is
 * also a control is a stepper people press by accident while aiming for one of the ends.
 */
export function Stepper({
  qty,
  onDecrease,
  onIncrease,
  testIdPrefix,
  label,
  disabled,
}: {
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  testIdPrefix: string;
  label: string;
  disabled?: boolean;
}) {
  const btn =
    'inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)]/40 ' +
    'bg-[var(--surface)] text-[18px] leading-none text-[var(--text-body)] transition-colors ' +
    'hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-45 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]';
  return (
    <div className="inline-flex items-center gap-2">
      <button
        data-testid={`${testIdPrefix}-decrease`}
        type="button"
        className={btn}
        onClick={onDecrease}
        disabled={disabled}
        aria-label={`One fewer ${label}`}
      >
        −
      </button>
      <span
        className="min-w-6 text-center text-[14px] font-bold tabular-nums"
        aria-live="polite"
        aria-label={`${qty} ${label}`}
        data-testid={`${testIdPrefix}-qty`}
      >
        {qty}
      </span>
      <button
        data-testid={`${testIdPrefix}-increase`}
        type="button"
        className={btn}
        onClick={onIncrease}
        disabled={disabled}
        aria-label={`One more ${label}`}
      >
        +
      </button>
    </div>
  );
}

/* ── Chip ──────────────────────────────────────────────────────────────── */

export function Chip({
  on = false,
  children,
  className,
  'data-testid': testId,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; 'data-testid': string }) {
  // The id is placed explicitly rather than arriving through the spread: it is required by the
  // type either way, and stating it keeps the element addressable to a reader and to the
  // coverage gate, neither of which can see through `{...rest}`.
  return (
    <button
      data-testid={testId}
      type="button"
      aria-pressed={on}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[12.5px] font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        on
          ? 'bg-[var(--primary)] text-[var(--on-primary)]'
          : 'border border-[var(--border-strong)]/25 bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A horizontally scrolling row of chips, with the right-edge fade the design set asks for so
 * the cut is legible rather than looking like the row simply ends.
 */
export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="j-scroll-x flex gap-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--background)] to-transparent"
      />
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */

/**
 * The loading state holds the LAYOUT, not just the space.
 *
 * A spinner that is replaced by content reflows the page under a thumb already on its way to a
 * button. Blocks of the right height mean the button is where it was.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('j-skeleton', className)} aria-hidden />;
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-[var(--radius-md)]" />
      ))}
    </div>
  );
}
