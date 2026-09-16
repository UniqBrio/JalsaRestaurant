'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

/**
 * field — form controls on native elements, themed.
 *
 * WHY NATIVE
 *   Standard 3.3: constrain the FORMAT rather than validating it afterwards. A native date
 *   picker, a numeric keypad on a phone and a real select element removes whole classes of error
 *   before they can be typed, and they come with the platform's own accessibility for free.
 *
 * WHY THE ASTERISK IS AFTER THE LABEL TEXT
 *   Standard 2.7, exactly as written: "An asterisk after the label text, never on its own
 *   line." A required marker floating on its own line is read by nobody and by no screen
 *   reader in the right order.
 */

export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="type-caption font-semibold text-[var(--text-body)]">
        {label}
        {required ? (
          <span className="text-[var(--error)]" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {error ? (
        <p className="m-0 type-caption font-semibold text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClass =
  'w-full min-h-11 rounded-[var(--radius-md)] border border-[var(--border-strong)]/35 bg-[var(--surface)] ' +
  'px-3.5 type-body text-[var(--text-body)] placeholder:text-[var(--text-disabled)] ' +
  'transition-colors hover:border-[var(--border-strong)]/60 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ' +
  'disabled:opacity-45';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { 'data-testid': string }
>(function Input({ className, 'data-testid': testId, ...props }, ref) {
  return <input data-testid={testId} ref={ref} className={cn(controlClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { 'data-testid': string }
>(function Textarea({ className, rows = 3, 'data-testid': testId, ...props }, ref) {
  // No fixed height on anything holding text (Standard 10.1) - py instead of a set height, so
  // the control grows with its own line count rather than clipping.
  return (
    <textarea
      data-testid={testId}
      ref={ref}
      rows={rows}
      className={cn(controlClass, 'py-2.5', className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { 'data-testid': string }
>(function Select({ className, children, 'data-testid': testId, ...props }, ref) {
  return (
    <select data-testid={testId} ref={ref} className={cn(controlClass, 'appearance-none pr-9', className)} {...props}>
      {children}
    </select>
  );
});

/**
 * A search field with a live result count and a Clear action (Standard 4.2).
 *
 * The count is the part that matters: without it, a search that returns nothing looks
 * identical to a search that has not run yet.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  resultCount,
  testId,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  resultCount?: number;
  testId: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <input
          data-testid={testId}
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}

          className={cn(controlClass, 'pr-24')}
        />
        {value && typeof resultCount === 'number' ? (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 type-caption font-semibold text-[var(--text-muted)]"
            aria-live="polite"
          >
            {resultCount === 1 ? '1 match' : `${resultCount} matches`}
          </span>
        ) : null}
      </div>
      {value ? (
        <button
          data-testid={`${testId}-clear`}
          type="button"
          onClick={() => onChange('')}

          className="min-h-11 shrink-0 rounded-full px-3 type-caption font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

/**
 * A switch with its live consequence stated beside it.
 *
 * `consequence` is not decoration: Standard 2.4 asks for a summary naming exactly what the end
 * user will now see. "Water: off" means nothing; "the water button disappears from every
 * guest's phone" is the decision being made.
 */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  consequence,
  testId,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  consequence?: string;
  testId: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="type-body font-semibold">
          {label}
        </label>
        {consequence ? (
          <p className="m-0 mt-0.5 type-caption leading-relaxed text-[var(--text-muted)]">{consequence}</p>
        ) : null}
      </div>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-testid={testId}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          'disabled:opacity-45',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]/45'
        )}
      >
        <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-[var(--surface)] shadow-[var(--shadow-card)] transition-transform data-[state=checked]:translate-x-[1.375rem]" />
      </SwitchPrimitive.Root>
    </div>
  );
}
