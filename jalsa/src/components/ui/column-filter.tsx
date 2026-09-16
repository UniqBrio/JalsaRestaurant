'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Input } from './field';
import { isColumnFilterActive, type ColumnFilter } from '@/lib/list-controls';

/**
 * The filter control that lives IN a column header.
 *
 * WHY IN THE HEADER AND NOT IN A PANEL
 *   A filter bar above a table is a second place to look and a permanent strip of screen paid
 *   for whether or not anyone is filtering. Put the control on the column it acts on and the
 *   question "how do I narrow this?" answers itself — the icon is beside the word.
 *
 * WHY THE ICON CHANGES RATHER THAN APPEARING
 *   A control that appears only when active cannot be found by someone who wants to use it;
 *   one that looks identical whether or not it is doing something hides a narrowed list, which
 *   is how an owner concludes half the menu has vanished. So it is always there, and it is
 *   unmistakable when it is on.
 *
 * Sorting is NOT here. It stays on the header itself, where it already was. The requester asked
 * for the two to be kept apart and then resolved the one place their own brief mixed them.
 */
export function ColumnFilterControl({
  label,
  filter,
  onChange,
  onClear,
  children,
  testId,
}: {
  /** The column's name, for the accessible label — "Filter Category". */
  label: string;
  filter: ColumnFilter | undefined;
  onChange: (next: ColumnFilter) => void;
  onClear: () => void;
  /** The dropdown body: options, a text box, or a range. */
  children: React.ReactNode;
  testId: string;
}) {
  const active = isColumnFilterActive(filter);
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-testid={testId}
          data-active={active ? 'true' : 'false'}
          aria-label={active ? `${label} — filtered. Change or clear` : `Filter ${label}`}
          className={cn(
            'ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] align-middle transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]',
            active
              ? 'bg-[var(--primary)] text-[var(--on-primary)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-body)]'
          )}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 5h18l-7 8v6l-4 2v-8z" />
          </svg>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          data-testid={`${testId}-panel`}
          className="z-50 w-[15rem] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-raised)] focus:outline-none"
        >
          <div className="flex flex-col gap-2">
            {children}
            {active ? (
              <Button
                data-testid={`${testId}-clear`}
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={onClear}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** A closed list — category, food type, availability. Several chosen values are an OR. */
export function OptionsFilterBody({
  options,
  chosen,
  onChange,
  testId,
}: {
  options: readonly string[];
  chosen: readonly string[];
  onChange: (values: string[]) => void;
  testId: string;
}) {
  return (
    <div className="flex max-h-[14rem] flex-col gap-0.5 overflow-y-auto">
      {options.map((o) => {
        const on = chosen.includes(o);
        return (
          <button
            key={o}
            type="button"
            data-testid={`${testId}-opt-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            aria-pressed={on}
            onClick={() => onChange(on ? chosen.filter((c) => c !== o) : [...chosen, o])}
            className={cn(
              'flex min-h-9 items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 text-left type-caption transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]',
              on
                ? 'bg-[var(--primary-surface)] font-semibold text-[var(--on-primary-surface)]'
                : 'hover:bg-[var(--surface-sunken)]'
            )}
          >
            <span className="min-w-0 truncate">{o}</span>
            {on ? <span aria-hidden>✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A name. Contains, not equals — nobody types a dish name in full to find it. */
export function TextFilterBody({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  testId: string;
}) {
  return (
    <Input
      data-testid={`${testId}-text`}
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * A number, between two ends — and ONLY that.
 *
 * Low → High and High → Low are sorting, and sorting stays on the header. The requester's first
 * draft put all three in this dropdown and then chose to keep them apart when asked.
 */
export function RangeFilterBody({
  min,
  max,
  onChange,
  testId,
}: {
  min: number | undefined;
  max: number | undefined;
  onChange: (next: { min?: number; max?: number }) => void;
  testId: string;
}) {
  const read = (raw: string): number | undefined => {
    const t = raw.replace(/[^\d]/g, '');
    return t === '' ? undefined : Number(t);
  };
  /* An absent end is an ABSENT KEY, not an `undefined` value — `exactOptionalPropertyTypes` is
     on, and the difference is what lets `isColumnFilterActive` tell "no minimum" from "zero". */
  const bounds = (lo: number | undefined, hi: number | undefined): { min?: number; max?: number } => ({
    ...(lo !== undefined ? { min: lo } : {}),
    ...(hi !== undefined ? { max: hi } : {}),
  });
  return (
    <div className="flex items-center gap-2">
      <Input
        data-testid={`${testId}-min`}
        inputMode="numeric"
        placeholder="Min"
        value={min === undefined ? '' : String(min)}
        onChange={(e) => onChange(bounds(read(e.target.value), max))}
      />
      <span aria-hidden className="type-caption text-[var(--text-muted)]">
        to
      </span>
      <Input
        data-testid={`${testId}-max`}
        inputMode="numeric"
        placeholder="Max"
        value={max === undefined ? '' : String(max)}
        onChange={(e) => onChange(bounds(min, read(e.target.value)))}
      />
    </div>
  );
}
