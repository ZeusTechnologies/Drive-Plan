const CACHE_VERSION = 'driveplan-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/dp-black.png', '/dp-logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION)
    await cache.addAll(APP_SHELL)

    // Cache production's hashed entry assets during installation so the very
    // first launch is already available offline.
    const response = await fetch('/index.html')
    const html = await response.clone().text()
    const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map((match) => match[1])
    if (assetUrls.length) await cache.addAll(assetUrls)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request)
        const cache = await caches.open(CACHE_VERSION)
        cache.put('/index.html', fresh.clone())
        return fresh
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/'))
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request)
    const network = fetch(event.request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_VERSION)
        cache.put(event.request, response.clone())
      }
      return response
    }).catch(() => cached)
    return cached || network
  })())
})
