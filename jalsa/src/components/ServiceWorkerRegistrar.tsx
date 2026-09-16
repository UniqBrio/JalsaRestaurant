'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui/toast';

/**
 * Registers the service worker, and offers an update when one is waiting.
 *
 * WHY REGISTRATION WAITS FOR LOAD
 *   Registering during the first render competes for bandwidth with the very page the guest is
 *   waiting for. The worker matters on the SECOND visit; the first one should be fast.
 *
 * WHY A FAILURE IS SILENT TO THE USER AND LOUD IN THE CONSOLE
 *   A phone with service workers disabled, or a private window, still gets a completely working
 *   application — it simply has no offline shell. Telling a guest about a caching layer they
 *   did not ask for would be noise; telling an engineer is useful, so the warning stays.
 *
 * THE UPDATE IS OFFERED, NEVER IMPOSED (CP-30 rule 4)
 *   sw.js no longer calls skipWaiting() on install, so a new version installs and WAITS. This
 *   is the half that makes that honest: the guest is told, and the reload happens on their tap.
 *   Applying it silently would discard the round they are part-way through composing — and the
 *   guest most likely to be mid-order is the one on the slowest connection, who is also the one
 *   most likely to receive the update mid-session.
 *
 * A WAITING WORKER IS ONLY AN UPDATE IF ONE IS ALREADY IN CHARGE
 *   On a first visit the freshly installed worker is also "waiting" — for a page it does not
 *   control yet. Announcing "a new version" to someone who just arrived is nonsense, so the
 *   offer requires `navigator.serviceWorker.controller` to exist. This mirrors the framework's
 *   own `updateState`: waiting && controlled -> ready; waiting && !controlled -> none.
 */
export function ServiceWorkerRegistrar() {
  const toast = useToast();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let offered = false;
    let reloading = false;

    /* The reload is driven by controllerchange rather than by the tap, because the new worker
       has to finish activating first. Reloading straight from the click would re-request the
       page from the OLD controller and change nothing, which reads to a guest as a dead
       button. The guard stops Chrome's repeat firing turning one accept into a reload loop. */
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const offer = (waiting: ServiceWorker) => {
      if (offered) return;
      offered = true;
      toast.show('A new version of Jalsa is ready.', {
        sticky: true,
        action: {
          label: 'Reload',
          testId: 'pwa-update-reload',
          onClick: () => {
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });
            waiting.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };

    const watch = (reg: ServiceWorkerRegistration) => {
      // Already waiting when this page loaded — installed during an earlier visit.
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);

      // Or it arrives while the guest is here.
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) offer(installing);
        });
      });
    };

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(watch)
        .catch((err: unknown) => {
          console.warn('Service worker registration failed; the app works, offline support does not.', err);
        });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, [toast]);

  return null;
}
