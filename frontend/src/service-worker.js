/* eslint-disable no-restricted-globals */
/**
 * OP360 EduERP — Service Worker (Workbox / InjectManifest)
 *
 * react-scripts 5.0.1 auto-detects this file at build time and runs it
 * through Workbox's InjectManifest plugin, which injects the precache
 * manifest at self.__WB_MANIFEST. No eject / webpack config needed.
 *
 * Caching policy:
 *  - App shell (HTML/JS/CSS/fonts from the build) -> precached by Workbox
 *  - Runtime JS/CSS/fonts not in the manifest       -> StaleWhileRevalidate
 *  - Images                                          -> CacheFirst (30 days)
 *  - Google Fonts (webfont files)                    -> CacheFirst (1 year)
 *  - API GET requests (/api/**)                      -> NetworkFirst (5 min)
 *  - API POST/PUT/DELETE/PATCH                        -> NEVER intercepted
 *  - Auth endpoints (/api/auth/**)                     -> NEVER intercepted
 *  - Navigation (SPA routes)                          -> NetworkFirst,
 *                                                        falls back to the
 *                                                        cached app shell,
 *                                                        then /offline.html
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

clientsClaim();

// ── Precache everything the build emits (JS/CSS/HTML with hashed names) ──
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ── API paths that must NEVER be cached or intercepted ──────────────────
// Auth endpoints carry/rotate tokens; caching them (even accidentally via
// a broad matcher) would be a correctness and security bug.
const NEVER_CACHE_API_PATTERNS = [
  /\/api\/auth\//,
  /\/auth\/login/,
  /\/auth\/student-login/,
  /\/auth\/refresh/,
  /\/auth\/logout/,
];

function isApiGetRequest(url, request) {
  if (request.method !== 'GET') return false;
  if (!url.pathname.includes('/api/')) return false;
  return !NEVER_CACHE_API_PATTERNS.some((re) => re.test(url.pathname));
}

// ── 1. API GET requests — NetworkFirst, short-lived cache ───────────────
// Cross-origin safe: the backend lives on a different domain (Render), so
// we match on pathname/method via a predicate, not on same-origin routing.
registerRoute(
  ({ url, request }) => isApiGetRequest(url, request),
  new NetworkFirst({
    cacheName: 'op360-api-get-cache',
    networkTimeoutSeconds: 8,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }), // 5 min
    ],
  })
);

// Note: POST/PUT/DELETE/PATCH requests and auth endpoints deliberately have
// no registered route above. Any request that matches no route falls
// through to a normal, uncached network fetch — which is exactly the
// "never cache mutations or auth" behavior we want, with no extra code.

// ── 2. Images — CacheFirst ───────────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'op360-images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 days
    ],
  })
);

// ── 3. Google Fonts (stylesheet + font files) — CacheFirst, long-lived ──
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'op360-google-fonts-stylesheets' })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'op360-google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1 year
    ],
  })
);

// ── 4. Same-origin JS/CSS not already in the precache manifest ─────────
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' || request.destination === 'style'),
  new StaleWhileRevalidate({ cacheName: 'op360-static-resources' })
);

// ── 5. Navigation requests (SPA routes) ─────────────────────────────────
// NetworkFirst so users always get the freshest app shell when online;
// falls back to the precached index.html when offline, so React Router
// still works client-side. If even that isn't available yet (first-ever
// offline visit before anything was cached), the global catch handler
// below serves the static offline page.
const navigationHandler = new NetworkFirst({
  cacheName: 'op360-navigation-cache',
  networkTimeoutSeconds: 8,
  plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
});

registerRoute(new NavigationRoute(navigationHandler, {
  // Never intercept navigations toward the API or the static offline page itself.
  denylist: [/\/api\//, /\/offline\.html$/],
}));

// ── Global catch: last-resort offline fallback for navigations ─────────
// Fires only when a matched route's strategy throws (e.g. NetworkFirst
// above exhausts both network and cache). Using Workbox's own catch
// handler — NOT a second raw 'fetch' listener — avoids double-calling
// event.respondWith() on the same event, which throws at runtime.
setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return (await matchPrecache('/index.html')) || caches.match('/offline.html');
  }
  return Response.error();
});

// ── Auto-update: let the app trigger activation of a waiting worker ────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
