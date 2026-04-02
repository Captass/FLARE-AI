const CACHE_NAME = "flare-ai-os-v13";
const PRECACHE_URLS = ["/", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST /chat, etc.)
  if (event.request.method !== "GET") return;

  // Skip API calls entirely — never cache backend requests
  if (url.hostname.includes("run.app") || url.pathname.startsWith("/api")) return;

  // GCS images/media: Cache-first (persistent generated content)
  if (url.hostname === "storage.googleapis.com") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Favicons (source logos): Cache-first
  if (url.hostname === "www.google.com" && url.pathname.includes("favicons")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 404 }));
      })
    );
    return;
  }

  // Static assets: Network-first (ensures fresh code after deploys)
  if (url.origin === self.location.origin && (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico|webp)$/) ||
    url.pathname.startsWith("/_next/")
  )) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // All other requests: Network-first
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request) || caches.match("/");
    })
  );
});
