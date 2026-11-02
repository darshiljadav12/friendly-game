// Minimal service worker: makes the app installable and keeps the app shell
// (page, scripts, styles, icons) available when the connection is flaky.
// The game itself needs the live socket connection, so nothing else is cached.

const CACHE = "friendly-game-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only same-origin GETs; never touch socket.io or other servers
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: network first so updates show up, cached copy when offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Built assets are content-hashed, so cache-first is safe
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon") || url.pathname.startsWith("/apple-icon")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
