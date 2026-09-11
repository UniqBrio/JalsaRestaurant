'use client';
/**
 * ThemeToggle - a three-state control, because the preference has three states.
 *
 * A two-state toggle silently destroys "follow my system", and users who set their OS to switch
 * at sunset experience that as the app ignoring them. Offer the third option explicitly.
 *
 * Accessibility notes that are easy to get wrong here:
 *   - It is a radiogroup, not three unrelated buttons: arrow keys should move within it.
 *   - The current state is conveyed by aria-checked, never by colour alone.
 *   - The icon is decorative; the accessible name comes from the visible label.
 */
import React from 'react';
import { useTheme, type ThemePreference } from './ThemeProvider';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
  { value: 'system', label: 'System', icon: '◐' },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Colour theme" className="theme-toggle">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={preference === o.value}
          data-testid={`theme-toggle-${o.value}`}
          onClick={() => setPreference(o.value)}
          className="theme-toggle__option"
        >
          <span aria-hidden="true">{o.icon}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
