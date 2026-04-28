const CACHE_NAME = "flare-ai-os-v17";
const APP_SHELL_URL = "/app?utm_source=pwa";
const PRECACHE_URLS = ["/", APP_SHELL_URL, "/logo.png"];

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
      return caches.match(event.request) || caches.match(APP_SHELL_URL) || caches.match("/");
    })
  );
});

// --- Push Notifications (FCM via Web Push API) ---

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.notification?.title || "Notification FLARE AI";
    const body = data.notification?.body || "";
    const icon = "/logo.png";
    const badge = "/logo.png"; // Idéalement une icône monochrome 96x96
    const url = data.data?.url || "/app";

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data: { url },
        vibrate: [200, 100, 200],
      })
    );
  } catch (error) {
    console.error("[SW] Erreur parsing push data:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si une fenêtre est déjà ouverte, on la focus et on navigue
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      // Sinon on ouvre une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
// --- Update Management ---

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting().then(() => {
        // Optionnel: notifier les clients que le SW a sauté l'attente
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: "SW_UPDATED" }));
        });
    });
  }
});
