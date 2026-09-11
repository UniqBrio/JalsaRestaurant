'use client';
/**
 * PwaProvider — registers the service worker, and surfaces the two things a user must be able
 * to act on: "you can install this" and "a new version is ready".
 *
 * WHY A PROVIDER AND NOT A CALL IN THE LAYOUT
 *   Registration alone is the easy half. The half that gets skipped is what happens AFTERWARDS:
 *   a worker waiting to take over that nobody is told about is an app permanently one version
 *   behind, and the user has no way to know. So the browser APIs are owned in one place, the
 *   decisions come from `../lib/pwa` where they are unit-tested, and the affordances render.
 *
 * NOTHING HERE DECIDES ANYTHING
 *   Every branch below asks `../lib/pwa`. That is deliberate: the interesting cases — already
 *   installed, no `beforeinstallprompt`, an update mid-session, a dismissal a week old — are
 *   the ones a browser will not reproduce on demand, so they are tested as pure functions and
 *   this file is left with wiring only.
 *
 * THE UPDATE IS OFFERED, NEVER IMPOSED
 *   `sw.js` does not call `skipWaiting()`. The user is told, and chooses. Reloading the code
 *   under a running session is how a half-submitted form is lost to an "improvement".
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  INSTALL_DISMISSED_KEY, canPrompt, readDisplayMode, shouldRegister, updateState,
  type DisplayMode, type UpdateState,
} from '../lib/pwa';
import './components.css';

/** The event Chromium fires before offering an install. Not in the DOM lib, so declared here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaProviderProps {
  /** Path the worker is served from. Must be at the scope root to control the whole app. */
  readonly swUrl?: string;
  /** Suppresses both affordances. For a page that must not be interrupted — a checkout, say. */
  readonly quiet?: boolean;
  readonly children?: React.ReactNode;
}

const readStoredDismissal = (): boolean => {
  try { return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'; }
  catch { return false; }   // storage blocked: offer it, rather than never offering it
};

export function PwaProvider({ swUrl = '/sw.js', quiet = false, children }: PwaProviderProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<DisplayMode>('browser');
  const [update, setUpdate] = useState<UpdateState>('none');
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  // Read the stored answer on the client only. Doing it during render would make the server
  // and client disagree about whether the banner is on screen.
  useEffect(() => {
    setDismissed(readStoredDismissal());
    // Handed the two facts the decision needs, not the whole Window: `navigator.standalone` is
    // an iOS-only member the DOM lib does not declare, so it is read through a local widening.
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setMode(readDisplayMode({
      matchMedia: (q) => window.matchMedia(q),
      ...(nav.standalone !== undefined ? { navigator: { standalone: nav.standalone } } : {}),
    }));
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Without this the browser shows its own mini-infobar and we lose the chance to place
      // the offer somewhere it makes sense.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setDeferred(null); setMode('standalone'); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!shouldRegister({
      serviceWorkerSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      secureContext: typeof window !== 'undefined' && window.isSecureContext,
      protocol: typeof window !== 'undefined' ? window.location.protocol : '',
    })) return;

    let cancelled = false;
    navigator.serviceWorker.register(swUrl).then((reg) => {
      if (cancelled) return;
      const sync = () => {
        const controlled = Boolean(navigator.serviceWorker.controller);
        setUpdate(updateState({
          waiting: Boolean(reg.waiting),
          installing: Boolean(reg.installing),
          controlled,
        }));
        setWaiting(reg.waiting ?? null);
      };
      sync();
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        sync();
        installing?.addEventListener('statechange', sync);
      });
    }).catch((err) => {
      // A failed registration must not take the app down with it. The app works without a
      // worker; it simply is not installable, and the console says why.
      console.error('[pwa] service worker registration failed:', err);
    });
    return () => { cancelled = true; };
  }, [swUrl]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    // Durable on purpose. An install banner that returns every visit is the pattern that
    // teaches people to dismiss dialogs without reading them.
    try { window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch { /* not fatal */ }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use: the browser will not let it be prompted twice.
    setDeferred(null);
    if (outcome === 'dismissed') dismiss();
  }, [deferred, dismiss]);


  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    // The one path to skipWaiting, taken because the user asked for it.
    waiting.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(),
      { once: true });
  }, [waiting]);

  const offerInstall = !quiet && canPrompt({
    promptAvailable: Boolean(deferred),
    alreadyInstalled: mode === 'standalone',
    previouslyDismissed: dismissed,
  });

  return (
    <>
      {children}
      {offerInstall && (
        <div className="pwa-bar" role="region" aria-label="Install this application">
          <p className="pwa-bar__text">Install this app for a faster start and an offline-ready window.</p>
          <button type="button" className="pwa-bar__action" data-testid="pwa-install" onClick={install}>
            Install
          </button>
          <button type="button" className="pwa-bar__dismiss" data-testid="pwa-install-dismiss"
            onClick={dismiss} aria-label="Not now — do not offer again">
            Not now
          </button>
        </div>
      )}
      {!quiet && update === 'ready' && (
        // role="status" so it is announced, not only drawn. An update nobody is told about is
        // an app permanently one version behind.
        <div className="pwa-bar pwa-bar--update" role="status">
          <p className="pwa-bar__text">A new version is ready.</p>
          <button type="button" className="pwa-bar__action" data-testid="pwa-update" onClick={applyUpdate}>
            Reload to update
          </button>
        </div>
      )}
    </>
  );
}

export default PwaProvider;
