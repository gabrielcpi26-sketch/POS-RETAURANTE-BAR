self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

// ⚠️ No cacheamos API para NO romper pedidos
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api")) {
    return;
  }

  event.respondWith(fetch(event.request));
});
