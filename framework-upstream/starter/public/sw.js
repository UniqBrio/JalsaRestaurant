/**
 * sw - the service worker. Hand-written, dependency-free, and deliberately small.
 *
 * THE FAILURE THIS FILE IS DESIGNED AROUND
 *   A service worker is the only code in a web application that can outlive a deploy. Get the
 *   caching strategy wrong and users are pinned to a version of the app that no longer exists,
 *   with no way to escape short of clearing site data - a bug that cannot be fixed by shipping
 *   a fix, because the broken worker is what decides whether the fix is ever fetched. Every
 *   decision below is a defence against that, and none of them is a performance decision.
 *
 * THE STRATEGIES, AND WHY EACH IS THE ONE IT IS
 *   Navigations (HTML)   NETWORK FIRST, cache only as a fallback.
 *                        Cache-first HTML is the pin described above. The network is asked
 *                        every time; the cached copy exists for the case where there is no
 *                        answer at all, and the offline page for the case where there is not
 *                        even a cached copy.
 *   Static assets        STALE WHILE REVALIDATE - serve the cached copy, fetch a fresh one for
 *                        next time. Safe only because build output is content-addressed: a
 *                        changed asset has a changed URL, so a stale entry is never a WRONG
 *                        entry, merely an old one nobody will ask for again.
 *   Everything else      NOT CACHED, AT ALL. API responses, anything non-GET, anything
 *                        cross-origin, anything with an Authorization header or a query
 *                        string. A cache that serves one user's data to the next is a security
 *                        defect, and the way it happens is a well-meaning "cache the API too".
 *
 * WHAT IT NEVER DOES
 *   - skipWaiting() on its own. Swapping the code under a running session reloads assets that
 *     the page it is running in was not built against. The new worker waits; the app SEES it
 *     waiting (pwa.ts), tells the user, and activates only when the user says so.
 *   - Cache a response that is not ok, opaque, or partial. A cached 404 or 500 is a defect
 *     that survives the outage that caused it.
 *   - Assume it can update itself. CACHE_VERSION is part of every cache name and every old
 *     cache is deleted on activate, so a bad cache cannot outlive one deploy.
 *
 * rung: starter/tests/unit/pwa.unit.spec.ts (the decision logic) +
 *       scripts/audits/check-pwa-baseline.mjs (that this file exists and is registered)
 */

// Bumped by a deploy. Every cache name derives from it, so activating a new version orphans
// every old cache and the cleanup below removes them.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

/* The shell is the minimum that must work with no network. Kept deliberately tiny: every entry
 * is a file the install will FAIL on if it 404s, and an install that fails leaves the app with
 * no worker at all. */
const SHELL = [OFFLINE_URL, '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll is atomic and rejects the whole install if any entry fails, which is what we
      // want for a two-file shell: a partial shell is a worker that thinks it can serve
      // offline and cannot.
      .then((cache) => cache.addAll(SHELL))
      // No skipWaiting() here on purpose - see the header.
      .catch((err) => {
        // An install that cannot build its shell must not silently become a worker that
        // intercepts every request and has nothing to serve.
        console.error('[sw] install failed; not taking over:', err);
        throw err;
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
    for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name);
    // Claim only once this worker is the active one and the old caches are gone, so the first
    // controlled fetch cannot read a cache that is on its way out.
    await self.clients.claim();
  })());
});

/**
 * The user accepted the update. This is the ONLY path to skipWaiting: it is a response to an
 * explicit choice, made while the page that will be reloaded is still on screen.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** Cacheable means: our origin, a plain GET, and nothing that identifies a user. */
function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.search) return false;                        // a query string is usually a query
  if (request.headers.has('authorization')) return false;
  if (url.pathname.startsWith('/api/')) return false;  // never the data layer
  return true;
}

const isNavigation = (request) =>
  request.mode === 'navigate'
  || (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));

/** Only a complete, successful, same-origin response is worth keeping. */
const isStorable = (response) =>
  Boolean(response) && response.ok && response.status === 200 && response.type === 'basic';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isNavigation(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        // Keep the last good copy of each page so a later outage has something to show.
        if (isStorable(fresh) && isCacheable(request, url)) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match(request))
          || (await caches.match(OFFLINE_URL))
          // Last resort. Reaching here means even the shell is gone, and a thrown error would
          // surface as the browser's own network page, which says nothing useful about an
          // installed app.
          || new Response('Offline, and no cached copy of this page is available.',
            { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  if (!isCacheable(request, url)) return;   // untouched: it goes to the network as normal

  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
      .then((response) => { if (isStorable(response)) cache.put(request, response.clone()); return response; })
      .catch(() => undefined);
    // Stale first when we have it; otherwise wait for the network. If both fail, the rejection
    // is the browser's normal "failed to fetch" for a subresource, which is the honest result.
    if (cached) return cached;
    const fresh = await network;
    if (fresh) return fresh;
    return Response.error();
  })());
});
