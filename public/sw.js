/* Lekkertaal service worker — push + click handlers. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // No payload form: the cron sends a "tickle" and the SW composes copy
  // locally. Streak length is unavailable here; the notification is a
  // generic prompt.
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
