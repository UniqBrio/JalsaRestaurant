'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { controlClass } from '@/components/ui/field';
import { entriesFor, moveActive, searchNav, type NavEntry } from '@/lib/owner-search';

/**
 * "Search the console" - the owner's way to a screen by name (03-Oct-2026).
 *
 * A search field over the console's own screens (see `src/lib/owner-search.ts`): type, and the
 * matching screens list below the field; Up / Down move through them, Enter opens the one marked,
 * Escape closes the list. A tap or click opens a result directly. Only screens this person may
 * open are ever listed; opening one still passes the console's own gate.
 *
 * NOT A SECOND COMBOBOX. `components/ui/combobox.tsx` is the one value PICKER (the rule
 * combobox-migration.unit.spec.ts holds); this picks no value, it navigates, and it ranks by
 * keyword and alias, which the picker's contains-match does not. So the field is a `searchbox`
 * that drives a listbox through `aria-activedescendant` - valid on a textbox - rather than a
 * second `combobox` implementation.
 */
export function OwnerSearch({
  entries,
  grants,
  onOpen,
}: {
  /** Every screen, from the console's own lists. */
  entries: readonly NavEntry[];
  grants: readonly string[];
  onOpen: (e: NavEntry) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const listId = React.useId();
  const mine = React.useMemo(() => entriesFor(entries, grants), [entries, grants]);
  const results = React.useMemo(() => searchNav(mine, query), [mine, query]);
  const showing = open && query.trim() !== '';

  const choose = (e: NavEntry) => {
    onOpen(e);
    setQuery('');
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      setOpen(true);
      setActive((cur) => moveActive(cur, ev.key === 'ArrowDown' ? 1 : -1, results.length));
    } else if (ev.key === 'Enter') {
      const pick = results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (pick) {
        ev.preventDefault();
        choose(pick);
      }
    } else if (ev.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="relative" data-testid="owner-search">
      <input
        data-testid="owner-search-input"
        type="search"
        aria-label="Search the console"
        aria-controls={showing ? listId : undefined}
        aria-activedescendant={showing && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Search screens — try GST, printers, staff PIN, loved items"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={controlClass}
      />
      {showing ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Screens"
          data-testid="owner-search-results"
          className="absolute inset-x-0 top-full z-20 m-0 mt-1 max-h-[min(24rem,60dvh)] list-none overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-raised)]"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 type-caption text-[var(--text-muted)]" data-testid="owner-search-none">
              No screen matches “{query.trim()}”. Try another word, such as GST or printers.
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                data-testid={`owner-search-result-${r.id.replace('/', '-')}`}
                // Before the input's blur closes the list, so a click or tap lands on the result.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col justify-center rounded-[var(--radius-sm)] px-3 py-2',
                  i === active ? 'bg-[var(--primary-surface)] text-[var(--on-primary-surface)]' : 'hover:bg-[var(--surface-sunken)]'
                )}
              >
                <span className="type-body font-semibold">
                  {r.parent ? <span className="font-normal text-[var(--text-muted)]">{r.parent} › </span> : null}
                  {r.label}
                </span>
                {r.description ? (
                  <span className="type-caption text-[var(--text-muted)]">{r.description}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
