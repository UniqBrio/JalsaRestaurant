'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, and nothing else.
 *
 * WHY REGISTRATION WAITS FOR LOAD
 *   Registering during the first render competes for bandwidth with the very page the guest is
 *   waiting for. The worker matters on the SECOND visit; the first one should be fast.
 *
 * WHY A FAILURE IS SILENT TO THE USER AND LOUD IN THE CONSOLE
 *   A phone with service workers disabled, or a private window, still gets a completely working
 *   application — it simply has no offline shell. Telling a guest about a caching layer they
 *   did not ask for would be noise; telling an engineer is useful, so the warning stays.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err: unknown) => {
        console.warn('Service worker registration failed; the app works, offline support does not.', err);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
