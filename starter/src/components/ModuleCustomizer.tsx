'use client';
/**
 * ModuleCustomizer - "choose the modules you want, and where they sit": the settings-area
 * component through which a user shapes their own app. Enable/disable per module, reorder
 * with buttons, always-on modules locked visibly, children nested under their parent.
 *
 * WHY ↑/↓ BUTTONS AND NOT DRAG (same reasoning as ColumnControl / CP-21)
 *   Buttons behave identically by mouse, keyboard and touch, and need no autoscroll or
 *   pointer heuristics. Reordering NAVIGATION is exactly where the least confident users
 *   end up - the affordance must be the boring one.
 *
 * HONESTY RULES IN THE RENDER
 *   - "Always on" is a visible worded lock, never a disabled ghost toggle - the user must
 *     learn WHY it cannot be turned off, not wonder whether the control is broken.
 *   - Position badges ("Main tab 2") count only ENABLED modules - what will really render.
 *   - Edge buttons (first item's ↑, last item's ↓) use aria-disabled and act as no-ops,
 *     staying in the Tab order so keyboard users are never silently skipped past them.
 *
 * All logic lives in ../lib/module-customizer.ts, unit-tested without a browser.
 */
import React from 'react';
import {
  type ModuleItem, moveItem, positionBadges, setEnabled,
} from '../lib/module-customizer';

export function ModuleCustomizer({
  items,
  onChange,
  topLabel = 'Main tab',
  childLabel = 'Tab',
  testId = 'customize',
}: {
  items: ModuleItem[];
  onChange: (items: ModuleItem[]) => void;
  topLabel?: string;
  childLabel?: string;
  testId?: string;
}) {
  const badges = positionBadges(items, topLabel, childLabel);

  const move = (id: string, dir: 'up' | 'down') => {
    const next = moveItem(items, id, dir);
    if (next !== items) onChange(next); // edge no-ops change nothing, save nothing
  };

  const renderRow = (it: ModuleItem, siblings: readonly ModuleItem[], depth: number) => {
    const idx = siblings.findIndex((s) => s.id === it.id);
    const atTop = idx === 0;
    const atBottom = idx === siblings.length - 1;
    return (
      <li key={it.id} className={`customize__row customize__row--depth-${depth}`}>
        <div className="customize__main">
          <span className="customize__label">
            {it.label}
            {badges.has(it.id) && <span className="customize__badge">{badges.get(it.id)}</span>}
          </span>
          {it.description && <span className="customize__desc">{it.description}</span>}
        </div>

        <button
          type="button"
          className="customize__move"
          aria-label={`Move ${it.label} up`}
          aria-disabled={atTop}
          data-testid={`${testId}-up-${it.id}`}
          onClick={() => !atTop && move(it.id, 'up')}
        >↑</button>
        <button
          type="button"
          className="customize__move"
          aria-label={`Move ${it.label} down`}
          aria-disabled={atBottom}
          data-testid={`${testId}-down-${it.id}`}
          onClick={() => !atBottom && move(it.id, 'down')}
        >↓</button>

        {it.alwaysOn ? (
          // A worded lock, not a dead toggle: the WHY is in the label.
          <span className="customize__always-on" data-testid={`${testId}-lock-${it.id}`}>
            Always on
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={it.enabled}
            aria-label={`${it.label} ${it.enabled ? 'on' : 'off'}`}
            className="customize__toggle"
            data-testid={`${testId}-toggle-${it.id}`}
            onClick={() => onChange(setEnabled(items, it.id, !it.enabled))}
          >
            {it.enabled ? 'On' : 'Off'}
          </button>
        )}

        {/* Children render only under an enabled parent; their flags survive either way. */}
        {it.enabled && it.children && it.children.length > 0 && (
          <ul className="customize__children">
            {it.children.map((c) => renderRow(c, it.children!, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (items.length === 0) {
    // An empty state that offers the next action, never just "nothing here".
    return (
      <p className="customize__empty" data-testid={`${testId}-empty`}>
        No modules to configure yet — modules appear here as they are added to the app.
      </p>
    );
  }

  return (
    <ul className="customize" data-testid={testId}>
      {items.map((it) => renderRow(it, items, 0))}
    </ul>
  );
}
