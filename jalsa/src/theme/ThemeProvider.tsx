'use client';
/**
 * ThemeProvider - the ONE place that decides which theme is active.
 *
 * CONTRACT
 *   - Three states, not two: 'light' | 'dark' | 'system'. "System" is a real user choice and
 *     must survive a reload as itself, not be collapsed into whichever value it resolved to.
 *   - The provider sets `data-theme` on <html> ONLY for an explicit choice. Under 'system' it
 *     removes the attribute so the CSS `prefers-color-scheme` block wins. This keeps the CSS
 *     the source of truth and means the app is correctly themed before React hydrates.
 *   - Storage is best-effort. Private windows, cleared site data and storage-blocking browsers
 *     all throw on access, so every read and write is wrapped. A failed read is 'system'.
 *
 * WHY NOT A COLOUR CONTEXT
 *   Components must not read colour VALUES from React. They reference CSS custom properties
 *   (`var(--text-body)`), so a theme switch is a single attribute change - no re-render storm,
 *   no component that forgot to subscribe, and no way to style one element off-theme by accident.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'app.theme';

interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually rendering right now. */
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  /** Cycles light -> dark -> system. Expose an explicit 3-way control in settings too. */
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* The choice when storage cannot be written to at all - a private window, a browser set to
 * block site data. The session still themes correctly; it simply will not survive a reload,
 * which is the honest outcome rather than a silently ignored preference. */
let inMemoryPreference: ThemePreference = 'system';

const readStored = (): ThemePreference => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return inMemoryPreference;
  } catch {
    return inMemoryPreference;
  }
};

const systemPrefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

/**
 * Inline this in <head> BEFORE any stylesheet-dependent paint to prevent a flash of the
 * wrong theme. It is intentionally tiny and dependency-free - it runs before the bundle.
 */
export const themeNoFlashScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');if(p==='light'||p==='dark'){document.documentElement.setAttribute('data-theme',p);}}catch(e){}})();`;

/* Both the stored choice and the OS setting are EXTERNAL STORES, and React 19 has one correct
 * way to read one: subscribe, snapshot, server-snapshot. Doing it with an effect instead means a
 * second commit on every mount and a documented lint failure - and, more importantly, a window
 * in which React's idea of the theme disagrees with what is already painted. */
const storageListeners = new Set<() => void>();
const notifyStorage = () => storageListeners.forEach((l) => l());

function subscribePreference(onChange: () => void): () => void {
  storageListeners.add(onChange);
  // Another tab changing the theme is the same event as this one changing it.
  window.addEventListener('storage', onChange);
  return () => {
    storageListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function subscribeSystem(onChange: () => void): () => void {
  let mql: MediaQueryList;
  try {
    mql = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return () => {};
  }
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function ThemeProvider({
  children,
  defaultPreference = 'system',
}: {
  children: React.ReactNode;
  defaultPreference?: ThemePreference;
}) {
  const preference = useSyncExternalStore(subscribePreference, readStored, () => defaultPreference);
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false);

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // Reflect the choice onto <html>. Removing the attribute is what hands control back to CSS.
  useEffect(() => {
    const el = document.documentElement;
    if (preference === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', preference);

    // Keep the browser UI (address bar, PWA chrome) in step with the app surface.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(el).getPropertyValue('--background').trim();
      if (bg) meta.setAttribute('content', bg);
    }
  }, [preference, resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    inMemoryPreference = p;
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* storage unavailable - the in-memory value above still drives this session */
    }
    notifyStorage();
  }, []);

  const cycle = useCallback(() => {
    setPreference(preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light');
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}
