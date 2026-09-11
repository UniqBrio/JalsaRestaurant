'use client';
/**
 * CP-17 — an overflowing tab row SCROLLS.
 *
 * THE TWO WRONG ANSWERS, and why each is worse than it looks
 *   Wrapping to a second line: the row silently eats vertical space above every list on the
 *   screen, permanently, and nobody notices because it happened one tab at a time.
 *   A "More" menu: it hides items behind a lid, so the least-used item is also the hardest to
 *   find, and there is no signal that anything is hidden.
 *
 * Scrolling keeps every item at one level, preserves the ordering signal, and shows a partial
 * item at the edge — which is the affordance that tells a user to scroll.
 *
 * THE SELECTED TAB IS DISTINGUISHED THREE WAYS, NOT ONE (DR-3)
 *   Every tab carries a visible border, so the row reads as a set of controls rather than a
 *   line of text. The selected one differs by FILL, BORDER and WEIGHT together: colour alone
 *   fails a colour-blind user, weight alone is invisible at a glance, and a border alone
 *   disappears on a small screen. The fill is the `primarySurface` / `onPrimarySurface` pair,
 *   which the contrast gate asserts in both themes — so a tinted tab never turns its own label
 *   into pale text on a pale wash. `aria-selected` drives the styling, so the visual state and
 *   the announced state cannot disagree. See components.css.
 *
 * THE RULE THAT ACTUALLY CONSTRAINS THE ROW
 *   Because it no longer wraps, nothing stops it growing forever. So: a configuration screen is
 *   NOT a peer of a daily-use list. Before adding an item, ask what KIND it is and how often it
 *   is opened. If the answer differs from its neighbours, it belongs at the far end, in a header
 *   action, or on its own screen.
 */
import React, { useEffect, useRef } from 'react';
import './components.css';

export interface Tab {
  id: string;
  label: string;
  badge?: string;
}

export function TabRow({
  tabs,
  activeId,
  onSelect,
  testId = 'tabs',
}: {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  testId?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible. A horizontally scrolling row that opens scrolled away from
  // the current selection reads as the wrong tab being active.
  useEffect(() => {
    rowRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeId]);

  return (
    <div className="tab-row" ref={rowRef} role="tablist" aria-label="Sections" data-testid={testId}>
      {tabs.map((t) => (
        <button
          data-testid={`${testId}-${t.id}`}
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === activeId}
          data-tab-id={t.id}

          className="tab-row__tab"
          onClick={() => onSelect(t.id)}
        >
          {t.label}
          {/* The count is text, not a coloured dot: status is never carried by colour alone. */}
          {t.badge && <span className="tab-row__badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
