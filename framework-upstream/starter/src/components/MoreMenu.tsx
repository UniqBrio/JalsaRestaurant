'use client';
/**
 * MoreMenu - the overflow menu for actions that are real but not daily.
 *
 * WHAT BELONGS HERE, AND WHAT DOES NOT
 *   Settings, help, account, sign out: things a user needs occasionally and can afford one
 *   extra interaction to reach. A frequent action hidden in here costs that interaction on
 *   every single visit, forever - "configuration is not a peer of daily work" (docs/04 §5) cuts
 *   both ways, and this menu is where the non-peers go.
 *
 * SIGN OUT SITS APART, AT THE END
 *   It ends the session, so it is separated from the ordinary items and never adjacent to
 *   them - the same isolation rule destructive actions get. And it routes through
 *   ConfirmDialog: a mis-tapped sign-out costs the user their place in whatever they were
 *   doing, which is small per incident and infuriating at frequency.
 *
 * ACCESSIBILITY
 *   Escape and an outside click both close it - a menu that closes only by choosing something
 *   traps whoever opened it by mistake. Items are native controls, so keyboard operation is
 *   free (CP-22).
 */
import React, { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
}

export function MoreMenu({
  items,
  signOut,
  label = 'More',
  testId = 'more',
}: {
  items: readonly MenuItem[];
  /** Rendered last, separated. Its handler should open a ConfirmDialog, not sign out directly. */
  signOut?: { label?: string; onSelect: () => void };
  label?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <div className="more" ref={rootRef}>
      <button
        type="button"
        className="more__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid={`${testId}-trigger`}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>

      {open && (
        <div className="more__panel" role="menu" aria-label={label} data-testid={`${testId}-panel`}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="more__item"
              data-testid={`${testId}-item-${item.id}`}
              onClick={() => choose(item.onSelect)}
            >
              {item.label}
            </button>
          ))}

          {signOut && (
            <>
              <hr className="more__separator" />
              <button
                type="button"
                role="menuitem"
                className="more__item more__item--signout"
                data-testid={`${testId}-signout`}
                onClick={() => choose(signOut.onSelect)}
              >
                {signOut.label ?? 'Sign out'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
