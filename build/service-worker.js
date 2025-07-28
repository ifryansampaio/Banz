// service-worker.js - Workbox básico para PWA offline-first
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Cache de assets essenciais
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Cache de rotas
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'image',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'banca-app-assets',
    })
  );

  // Fallback para offline
  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      return caches.match('/index.html');
    }
    return Response.error();
  });
}
