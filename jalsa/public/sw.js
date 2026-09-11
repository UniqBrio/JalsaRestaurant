/* --------------------------------------------------------------------------
 * Jalsa service worker.
 *
 * WHAT IT IS FOR, AND WHAT IT DELIBERATELY IS NOT
 *   A guest orders on restaurant wifi from a table in a building with thick walls. The shell
 *   must survive a dead spot; the ORDER must not. So:
 *
 *     - App shell, fonts, icons and static chunks: cache-first, so a dropped signal never
 *       shows a browser error page.
 *     - Anything that reads or writes a bill, a round or a payment: network-only. A cached
 *       bill total is a wrong bill total, and a cached "order placed" is an order the kitchen
 *       never received. Standard 5.7 — degrade honestly rather than pretend.
 *
 *   There is no background sync queue for orders on purpose. Replaying a queued order minutes
 *   later, after the guest has given up and told a captain, is how a table gets its food twice.
 *   The offline state says the round was not sent, and the guest sends it again when the
 *   signal returns.
 * -------------------------------------------------------------------------- */

const VERSION = 'jalsa-v1';
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = '/offline';

/* Precaching the offline page is the whole point of installing: it has to already be on the
 * device at the moment the network is gone. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, '/manifest.webmanifest', '/brand/icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Everything that touches money, an order or a session. Never cached, never replayed. */
const isLiveData = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/auth/') ||
  url.hostname.endsWith('.supabase.co');

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname === '/manifest.webmanifest');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isLiveData(url)) return; // straight to the network; a failure surfaces as a failure

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())
      )
    );
  }
});
