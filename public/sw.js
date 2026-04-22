importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

workbox.setConfig({ debug: false })

const { registerRoute } = workbox.routing
const { NetworkFirst, StaleWhileRevalidate } = workbox.strategies
const { ExpirationPlugin } = workbox.expiration
const { CacheableResponsePlugin } = workbox.cacheableResponse

// App shell — network-first, short timeout, fall back to cache
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'app-shell',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 86400 }),
    ],
  })
)

// Calendar events API — network-first, 5-min cache TTL
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/calendars'),
  new NetworkFirst({
    cacheName: 'calendar-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 300 }),
    ],
  })
)

// Family members API — stale-while-revalidate (changes infrequently)
registerRoute(
  ({ url }) => url.pathname === '/api/family',
  new StaleWhileRevalidate({
    cacheName: 'family-api',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 3600 }),
    ],
  })
)

// ── Web Push stub (Phase 3E) ──────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return
  const { title = 'TalleyCalendar', body = '', icon = '/icons/icon-192.png' } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, { body, icon, badge: icon })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
