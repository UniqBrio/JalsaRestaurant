'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';
import { controlClass } from './field';

/**
 * Combobox — the ONE searchable picker in Jalsa.
 *
 * WHY THIS EXISTS
 *   Before it, one interaction had three implementations: a native datalist on the expense
 *   category (browser-drawn, browser-styled, different on every engine), a native select element
 *   on the menu category (the operating system's own popup), and a hand-rolled search box beside
 *   a filtered list in `LiveOrders`. Three answers to one question, none of which could be fixed
 *   in one place. This is the one place.
 *
 *   (Those two tag names are written out in words deliberately. The testid audit matches element
 *   tags with a regex that cannot tell code from a comment, so a bare angle-bracket tag in a
 *   sentence is counted as an element missing an id — which is how this paragraph first failed
 *   the gate.)
 *
 * WHAT IT IS NOT
 *   It is not the filter control. `ColumnFilterControl` stays exactly as it is: a filter narrows
 *   a list somebody is already looking at, and offering to CREATE a value from a filter is
 *   offering to invent data from a reading tool. `allowCreate` is for data entry and nowhere else.
 *
 * THE VALUE IS AN ID, NOT A LABEL
 *   `value` is whatever the field stores — `category_id`, `staff_id`, `printer_id`, or a plain
 *   string where the column is a string. The label is what a person reads. Keeping them apart is
 *   the whole reason a picker can change without a migration.
 *
 * CREATION IS ASYNCHRONOUS AND MAY FAIL, AND THE UI SAYS SO
 *   `onCreate` returns the new option's value — from the server, after the row exists. Nothing
 *   is selected until it resolves, and a rejection leaves the box open with the message on it.
 *   A picker that optimistically selects a category the database refused is a menu item that
 *   saves against nothing.
 *
 * WHY RADIX POPOVER AND NOT AN ABSOLUTELY-POSITIONED DIV
 *   Every one of these fields lives inside a dialog whose body is `overflow-y-auto`. A list
 *   positioned in that flow is clipped by it — which is the single most common way a combobox
 *   ships broken. The popover portals to the body and is measured against the trigger.
 */

export interface ComboboxOption {
  /** What gets stored. An id wherever the column is an id. */
  value: string;
  /** What a person reads and searches. */
  label: string;
  /** An optional second line — a role beside a name, a station beside a printer. */
  hint?: string;
}

/**
 * Matching, in one place so every caller matches the same way.
 *
 * Case-insensitive and trimmed on both sides: a query of `"  ADV "` finds `Advance Payment`.
 * `includes` rather than `startsWith`, because a person hunting "biryani" should find
 * "Chicken Biryani". No fuzzy matching — a picker that returns something the query does not
 * contain teaches people not to trust the box.
 */
export function comboboxMatches(option: ComboboxOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return option.label.toLowerCase().includes(q) || (option.hint ?? '').toLowerCase().includes(q);
}

/**
 * Does this query already name an existing option EXACTLY?
 *
 * The comparison is trimmed and case-folded, so typing `desserts` when `Desserts` exists offers
 * no Add row. That is the duplicate guard a user can see; `onCreate` still owns the one the
 * database enforces, because two people can type it in the same second.
 */
export function comboboxExactMatch(options: readonly ComboboxOption[], query: string): ComboboxOption | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return options.find((o) => o.label.trim().toLowerCase() === q) ?? null;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  testId,
  allowCreate = false,
  onCreate,
  disabled = false,
  loading = false,
  invalid = false,
  emptyLabel = 'Nothing matches',
  id,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder: string;
  testId: string;
  /** Data-entry fields only. Never a filter. */
  allowCreate?: boolean;
  /** Must resolve to the NEW option's value, from the server. Reject to show a message. */
  onCreate?: (name: string) => Promise<string>;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  emptyLabel?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = React.useMemo(() => options.filter((o) => comboboxMatches(o, query)), [options, query]);
  const exact = comboboxExactMatch(options, query);
  /* The Add row appears only when there is something to add that is not already there — the
     rule the requester stated, and the reason `comboboxExactMatch` is its own function. */
  const canCreate = allowCreate && onCreate !== undefined && query.trim().length > 0 && exact === null;
  const rows = canCreate ? filtered.length + 1 : filtered.length;

  /* The box shows the SELECTION when closed and the QUERY when open. A closed box showing a
     half-typed search is a field that looks filled in and is not. */
  const shown = open ? query : (selected?.label ?? '');

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    setProblem(null);
    /*
      FOCUS COMES BACK TO THE INPUT, EXPLICITLY.

      Radix restores focus to the popover's TRIGGER on close, and this component deliberately
      has none — it uses an Anchor so the input is the control rather than a button beside one.
      With no trigger there is nothing for Radix to restore to, so after picking an option with
      a pointer the focus fell to `document.body`: the next Tab started from the top of the
      document, and a screen reader lost its place mid-form.
    */
    inputRef.current?.focus();
  }, []);

  const choose = (option: ComboboxOption) => {
    onValueChange(option.value);
    close();
  };

  const create = async () => {
    if (!onCreate || creating) return;
    const name = query.trim();
    setCreating(true);
    setProblem(null);
    try {
      const created = await onCreate(name);
      onValueChange(created);
      close();
    } catch (err: unknown) {
      // The server's own sentence, not a generic one. A failure to create a category and a
      // failure to reach the database need different actions from the person reading it.
      setProblem(err instanceof Error ? err.message : 'That could not be added.');
    } finally {
      setCreating(false);
    }
  };

  const commitActive = () => {
    if (canCreate && active === filtered.length) return void create();
    const option = filtered[active];
    if (option) choose(option);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (rows === 0) return;
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % rows : (i - 1 + rows) % rows));
      return;
    }
    if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      commitActive();
      return;
    }
    if (e.key === 'Escape') {
      if (!open) return;
      e.preventDefault();
      close();
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true);
        else close();
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            data-testid={testId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            {...(open && rows > 0 ? { 'aria-activedescendant': `${listId}-${active}` } : {})}
            {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
            {...(invalid ? { 'aria-invalid': true } : {})}
            autoComplete="off"
            disabled={disabled}
            value={shown}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setProblem(null);
              if (!open) setOpen(true);
            }}
            /*
              THE LIST OPENS ON A CLICK, ON TYPING, OR ON ArrowDown — NOT ON FOCUS.

              Two reasons, and the second is the one that matters on a phone. Focus-to-open
              fought the line above: `close()` returns focus here, which would have re-opened
              the list the instant an option was chosen. And on a 360px screen, focusing an
              input raises the software keyboard, so a list that opens at the same moment can
              be entirely behind it — the guest taps the field and sees nothing happen.

              It is also what the ARIA authoring practices describe: a combobox's listbox opens
              on ArrowDown or on input, not merely because the control has focus.
            */
            onClick={() => !disabled && setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              controlClass,
              'pr-10',
              invalid && 'border-[var(--error)]'
            )}
          />
          {/* The chevron is the affordance that says "there is a list behind this", and it is a
              real button so a pointer user who wants the list without typing has a target. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            data-testid={`${testId}-toggle`}
            disabled={disabled}
            onClick={() => {
              setOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-body)] disabled:opacity-45"
          >
            <span className="type-caption leading-none">˅</span>
          </button>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          /* Focus stays in the input: this is one control, not a dialog. Without this the
             popover steals focus on open and the first keystroke is lost. */
          onOpenAutoFocus={(e) => e.preventDefault()}
          data-testid={`${testId}-list`}
          className="z-[60] max-h-[18rem] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-raised)]"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          {problem ? (
            <p
              data-testid={`${testId}-problem`}
              role="alert"
              className="m-0 rounded-[var(--radius-sm)] bg-[var(--error-surface)] px-3 py-2 type-caption leading-relaxed text-[var(--on-error-surface)]"
            >
              {problem}
            </p>
          ) : null}

          {loading ? (
            <p data-testid={`${testId}-loading`} className="m-0 px-3 py-2 type-caption text-[var(--text-muted)]">
              Loading…
            </p>
          ) : (
            <ul id={listId} role="listbox" className="m-0 flex list-none flex-col p-0">
              {filtered.map((o, i) => (
                /* `presentation`, so the listbox OWNS the options. Without it the accessibility
                   tree reads listbox > listitem > option, and an `option` that is not a child of
                   its `listbox` is not announced as one of N. */
                <li key={o.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${i}`}
                    aria-selected={o.value === value}
                    data-testid={`${testId}-option-${o.value}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={cn(
                      'flex w-full min-h-11 flex-col justify-center rounded-[var(--radius-sm)] px-3 py-1.5 text-left type-body transition-colors',
                      i === active ? 'bg-[var(--primary-surface)]' : 'hover:bg-[var(--surface-sunken)]',
                      o.value === value && 'font-semibold'
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.hint ? (
                      <span className="truncate type-caption text-[var(--text-muted)]">{o.hint}</span>
                    ) : null}
                  </button>
                </li>
              ))}

              {canCreate ? (
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${filtered.length}`}
                    aria-selected={false}
                    data-testid={`${testId}-create`}
                    disabled={creating}
                    onMouseEnter={() => setActive(filtered.length)}
                    onClick={() => void create()}
                    className={cn(
                      'flex w-full min-h-11 items-center gap-2 rounded-[var(--radius-sm)] px-3 type-body font-semibold text-[var(--primary)] transition-colors disabled:opacity-45',
                      active === filtered.length ? 'bg-[var(--primary-surface)]' : 'hover:bg-[var(--surface-sunken)]'
                    )}
                  >
                    <span aria-hidden>⊕</span>
                    <span className="truncate">{creating ? `Adding “${query.trim()}”…` : `Add “${query.trim()}”`}</span>
                  </button>
                </li>
              ) : null}

              {rows === 0 ? (
                <li role="presentation">
                  <p
                    data-testid={`${testId}-empty`}
                    className="m-0 px-3 py-2 type-caption leading-relaxed text-[var(--text-muted)]"
                  >
                    {emptyLabel}
                  </p>
                </li>
              ) : null}
            </ul>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
