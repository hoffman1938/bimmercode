const CACHE_NAME = "bimmercodes-v33-sw-fetch-fallback";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/forum.html",
  "/vin.html",
  "/topic",
  "/css/style.css",
  "/css/ui-buttons.css",
  "/css/responsive.css",
  "/css/forum.css",
  "/js/script.js",
  "/js/translations.js",
  "/js/forum.js",
  "/js/topic.js",
  "/js/live.js",
  "/data/codes.json",
  "/assets/icons/ico.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
             return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  // 1. Navigation strategy (Network First -> Cache -> Fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Use original request to preserve cookies/headers
          return await fetch(event.request);
        } catch (error) {
          return caches.match(event.request)
            .then(cached => cached || caches.match("/index.html"));
        }
      })()
    );
    return;
  }

  // 2. Asset Strategy (Stale-While-Revalidate) with STRICT PROTOCOL CHECK
  const url = new URL(event.request.url);
  
  // IMMEDIATELY RETURN NETWORK ONLY for non-http protocols (extensions, data uris, blob, etc)
  if (!url.protocol.startsWith("http")) {
      return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          if (url.protocol.startsWith("http")) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/index.html")));
    })
  );
});
