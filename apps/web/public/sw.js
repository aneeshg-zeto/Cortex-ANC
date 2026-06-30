// Cortex service worker — offline shell + web push for the morning digest.
const CACHE = 'cortex-v1';
const SHELL = ['/executive-desk', '/panel', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Network-first for navigations, fall back to cache when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/executive-desk'))),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Cortex', body: 'You have a new brief.', url: '/executive-desk' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/executive-desk';
  event.waitUntil(self.clients.openWindow(url));
});
