/* Lekkertaal service worker — install/activate, fetch caching, push, click. */

const CACHE_VERSION = "lekkertaal-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE = [
  "/",
  "/app/path",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) =>
        Promise.allSettled(
          PRECACHE.map((url) => c.add(url).catch(() => null)),
        ),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Strategy:
  //  - /api/*: NetworkFirst (always try fresh; fall back to cache to keep
  //    a faint offline shell working).
  //  - /sfx/*, /stroop/*, /logo*, /favicon, /manifest.json, fonts: CacheFirst.
  //  - HTML navigations: NetworkFirst.
  //  - Anything else: NetworkFirst with cache fallback.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }
  if (
    url.pathname.startsWith("/sfx/") ||
    url.pathname.startsWith("/stroop/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }
  event.respondWith(networkFirst(req, STATIC_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const r = await fetch(req);
    if (r.ok) cache.put(req, r.clone()).catch(() => {});
    return r;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const r = await fetch(req);
    if (r.ok && req.url.startsWith(self.location.origin)) {
      cache.put(req, r.clone()).catch(() => {});
    }
    return r;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

// Push (no-payload) → SW composes local Dutch reminder.
self.addEventListener("push", (event) => {
  const title = "🔥 Houd je reeks levend";
  const body = "5 minuten Nederlands oefenen voor vandaag.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: "daily-nag",
      renotify: false,
      data: { url: "/app/path" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app/path";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const c of clientsArr) {
          if ("focus" in c) {
            c.navigate(target);
            return c.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});
