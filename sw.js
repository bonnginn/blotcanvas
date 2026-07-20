const CACHE = "blotcanvas-app-v3";
const BASE = self.registration.scope;
const APP_FILES = [
  "./",
  "manifest.webmanifest",
  "blotcanvas-icon.svg",
  "blotcanvas-icon-192.png",
  "blotcanvas-icon-512.png",
].map((path) => new URL(path, BASE).href);
const TIFF_DECODER = "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(APP_FILES);
      try {
        await cache.add(TIFF_DECODER);
      } catch {
        // The app remains installable; the decoder is cached after its first use.
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(BASE, copy));
          return response;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
