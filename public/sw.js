/*
 * Kallo service worker — tier-1 offline posture.
 *
 * SAFETY: registration is gated behind NEXT_PUBLIC_ENABLE_SW (default OFF) in
 * the app; this file only runs when a build explicitly opts in. Even so it is
 * written defensively:
 *   - It NEVER caches or rewrites Next.js's hashed JS/CSS chunks, so it cannot
 *     serve a stale build and white-screen the app. Non-navigation requests
 *     pass straight through to the network with no SW involvement.
 *   - For page navigations it is network-first; the cached offline page is a
 *     fallback only when the network is unavailable.
 *   - A version bump in CACHE_NAME drops every old cache on activate.
 */

const CACHE_NAME = 'kallo-shell-v1';
const OFFLINE_URL = '/offline.html';

// Minimal, build-stable precache: the offline page and the brand icons. We do
// not precache hashed app chunks — those are owned by the network.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever intervene on top-level page navigations. Everything else
  // (scripts, styles, data, API, images) is left to the network so the SW can
  // never serve a stale or broken asset.
  if (request.mode !== 'navigate' || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL, { ignoreSearch: true }).then(
        (cached) =>
          cached ??
          new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
      )
    )
  );
});
