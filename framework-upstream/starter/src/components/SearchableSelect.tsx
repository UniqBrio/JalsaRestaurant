'use client';
/**
 * SearchableSelect - DR-5. Every dropdown is searchable, opens ready to type, shows what it
 * already has, and can GROW.
 *
 * WHY THIS IS A SHARED COMPONENT AND NOT A `select`
 *   A native `select` cannot be searched, cannot be added to, and on a phone hands the user an
 *   unfiltered wheel of every option there has ever been. Past roughly seven options that is not
 *   a control, it is a scavenger hunt - so past seven, or wherever the set can grow, this is the
 *   control and `select` is not.
 *
 * THE FOUR THINGS DR-5 REQUIRES, AND WHERE EACH LIVES
 *   1. Focused with the cursor LIVE on open, so the first keystroke filters instead of being
 *      swallowed. `autoFocus` on the input + `openAndFocus`. CP-16 already required this for
 *      dialogs; the reason it is easy to get wrong here is that the list opens on click, and a
 *      click moves focus on its own.
 *   2. Existing options visible BEFORE a keystroke - `filterOptions(options, '')` returns all.
 *      A box that opens empty asks the user to guess what is in it, and they guess by typing
 *      something already there under another name.
 *   3. `+ Add "<what they typed>"` when nothing matches, refused when a normalised match exists
 *      (see select-options.ts - that is the duplicate defect this control would otherwise cause).
 *   4. What is added is KEPT - see `onCreateOption` below, and read its note: this is the half
 *      that is easy to fake.
 *
 * PERSISTENCE, STATED HONESTLY
 *   `onCreateOption` is how a new option reaches the application's own store, and it is the only
 *   way an addition reaches ANOTHER USER. `storageKey` is a per-browser fallback for a set with
 *   no backend yet: it survives reload for that one person on that one device and reaches nobody
 *   else. DR-5 says an added option is saved "so the next user sees it", and localStorage does
 *   not do that - so the fallback says what it is rather than being quietly described as
 *   persistence.
 *
 * ACCESSIBILITY
 *   The combobox pattern: the input owns `role="combobox"`, `aria-expanded`, `aria-controls` and
 *   `aria-activedescendant`; the list is `role="listbox"` and each row `role="option"`. Focus
 *   never leaves the input, so what a screen reader announces and what the arrow keys move are
 *   the same thing - a list where focus moves into the rows reads the row twice and loses the
 *   typed query.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  addOption,
  canAddOption,
  cleanLabel,
  filterOptions,
  moveActive,
  type Option,
} from '../lib/select-options';

export interface SearchableSelectProps {
  /** The options already known. Supply them; this control does not fetch. */
  options: readonly Option[];
  /** Currently selected option id, or null. */
  value: string | null;
  onChange: (option: Option | null) => void;
  /**
   * Persist a newly added option to the application's store and return it (an id from the
   * backend is ideal). WITHOUT this, an addition is local to this browser - see the note above.
   */
  onCreateOption?: ((label: string) => Option | Promise<Option>) | undefined;
  /** Per-browser fallback store. Explicitly not a substitute for `onCreateOption`. */
  storageKey?: string | undefined;
  label: string;
  placeholder?: string;
  /** Test id root; every interactive element derives from it (screen checklist item 18). */
  testId: string;
  disabled?: boolean;
  /** Set false for a set that genuinely must not grow (a fixed status list, say). */
  allowAdd?: boolean;
}

/** Every storage touch is wrapped: access itself throws in a private window. */
function readStored(key: string): Option[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Option[]).filter((o) => o && typeof o.label === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, options: readonly Option[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(options));
  } catch {
    /* storage unavailable - the session still works, the addition just will not outlive it */
  }
}

export function SearchableSelect({
  options,
  value,
  onChange,
  onCreateOption,
  storageKey,
  label,
  placeholder = 'Search or add…',
  testId,
  disabled = false,
  allowAdd = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [local, setLocal] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // The locally added set is merged in on mount only - reading storage during render would make
  // the first paint depend on a browser API that throws in a private window.
  useEffect(() => {
    if (storageKey) setLocal(readStored(storageKey));
  }, [storageKey]);

  const all = useMemo<Option[]>(() => {
    const seen = new Set(options.map((o) => o.id));
    return [...options, ...local.filter((o) => !seen.has(o.id))];
  }, [options, local]);

  const shown = useMemo(() => filterOptions(all, query), [all, query]);
  const addOffered = allowAdd && canAddOption(all, query);
  const selected = all.find((o) => o.id === value) ?? null;

  // Close on an outside click or Escape. Escape also restores the query, so an abandoned search
  // does not leave the box reading as though something is filtered.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);

    /* Escape is consumed in the CAPTURE phase, on document, and that is not a style choice.
     * The surrounding Dialog closes on Escape from its own `document` keydown listener, and a
     * React `stopPropagation()` inside the input does not reach it - React delegates from its
     * root, so by the time our handler runs the event is already on a path that ends at the
     * same document listener. One press then closed the list AND the dialog, and the user lost
     * the form they were filling because they wanted to abandon a search.
     *
     * Capturing at document runs BEFORE anything below, so stopping here consumes the key
     * outright: it never reaches the input, and never bubbles back to the dialog's listener.
     * Observed failing exactly this way in the functional spec - a handler and its container
     * only meet in a real browser. */
    const onEscapeCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!rootRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('keydown', onEscapeCapture, true);

    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onEscapeCapture, true);
    };
  }, [open]);

  const openAndFocus = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setActive(0);
    // The click that opens the list also moves focus, so the focus call has to land after it.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled]);

  const choose = useCallback((o: Option) => {
    onChange(o);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const commitAdd = useCallback(async () => {
    const labelToAdd = cleanLabel(query);
    if (!labelToAdd || !allowAdd) return;

    // addOption returns the EXISTING option when the label only differs by case or spacing, so
    // a race - two people adding "Mumbai" at once - selects rather than duplicates.
    const result = addOption(all, labelToAdd);
    if (!result.added) {
      if (result.option) choose(result.option);
      return;
    }

    setBusy(true);
    try {
      const created = onCreateOption ? await onCreateOption(labelToAdd) : result.option!;
      if (!onCreateOption && storageKey) {
        const next = [...local, created];
        setLocal(next);
        writeStored(storageKey, next);
      } else if (!onCreateOption) {
        setLocal((prev) => [...prev, created]);
      }
      choose(created);
    } finally {
      setBusy(false);
    }
  }, [all, allowAdd, choose, local, onCreateOption, query, storageKey]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => moveActive(i, shown.length, e.key === 'ArrowDown' ? 1 : -1, addOffered));
      return;
    }
    if (e.key === 'Enter') {
      // DR-4/CP-22: Enter commits. Never let it reach a surrounding form and submit the whole
      // dialog while the user was only choosing an option.
      e.preventDefault();
      if (active === -1 && addOffered) { void commitAdd(); return; }
      const pick = shown[active];
      if (pick) choose(pick);
      else if (addOffered) void commitAdd();
      return;
    }
    // Escape is handled by the capture-phase listener above, not here - see the reason there.
    if (e.key === 'Tab') setOpen(false);
  };

  const activeId = active === -1 ? `${listId}-add` : shown[active] ? `${listId}-o-${shown[active].id}` : undefined;

  return (
    <div className="sselect" ref={rootRef} data-testid={testId}>
      <label className="sselect__label" htmlFor={`${listId}-input`}>{label}</label>

      {!open ? (
        <button
          type="button"
          className="sselect__trigger"
          onClick={openAndFocus}
          disabled={disabled}
          data-testid={`${testId}-trigger`}
          aria-haspopup="listbox"
        >
          <span className={selected ? 'sselect__value' : 'sselect__value sselect__value--empty'}>
            {selected ? selected.label : placeholder}
          </span>
          <span aria-hidden="true" className="sselect__caret">▾</span>
        </button>
      ) : (
        <div className="sselect__panel">
          <input
            id={`${listId}-input`}
            ref={inputRef}
            className="sselect__input"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoFocus
            value={query}
            placeholder={placeholder}
            disabled={disabled || busy}
            data-testid={`${testId}-input`}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
          />

          <ul className="sselect__list" role="listbox" id={`${listId}-list`} aria-label={label}
              data-testid={`${testId}-list`}>
            {addOffered && (
              <li
                id={`${listId}-add`}
                role="option"
                aria-selected={active === -1}
                className={`sselect__opt sselect__opt--add${active === -1 ? ' is-active' : ''}`}
                data-testid={`${testId}-add`}
                onMouseEnter={() => setActive(-1)}
                onMouseDown={(e) => { e.preventDefault(); void commitAdd(); }}
              >
                + Add “{cleanLabel(query)}”
              </li>
            )}

            {shown.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-o-${o.id}`}
                role="option"
                aria-selected={o.id === value}
                className={`sselect__opt${i === active ? ' is-active' : ''}`}
                data-testid={`${testId}-option-${o.id}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              >
                {o.label}
              </li>
            ))}

            {/* An empty result with nothing addable still says something. A blank panel reads as
                broken, and the user cannot tell it apart from a list that failed to load. */}
            {shown.length === 0 && !addOffered && (
              <li className="sselect__empty" role="presentation" data-testid={`${testId}-empty`}>
                Nothing matches “{cleanLabel(query)}”
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
