const CACHE_VERSION = "ninos-financas-v7";

const CORE_ASSETS = [
  "./",
  "./financas-familiar.html",
  "./manifest.webmanifest",
  "./assets/css/main.css",
  "./assets/js/app.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-16.png",
  "./assets/icons/favicon.ico",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!isSameOrigin(request)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response && response.ok) {
                const copy = response.clone();
                return caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
              }
              return null;
            })
            .catch(() => null)
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("./financas-familiar.html");
          }
          return new Response("", { status: 503, statusText: "Offline" });
        });
    })
  );
});
