const CACHE_NAME = 'reportes-toc-shell-v1'
const RUNTIME_CACHE = 'reportes-toc-runtime-v1'
const APP_BASE = self.registration.scope
const INDEX_URL = new URL('index.html', APP_BASE).href
const APP_SHELL = [APP_BASE, INDEX_URL, new URL('manifest.webmanifest', APP_BASE).href, new URL('icons/icon-64.png', APP_BASE).href, new URL('icons/icon-192.png', APP_BASE).href, new URL('icons/icon-512.png', APP_BASE).href]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_APP_RESOURCES' || !Array.isArray(event.data.urls)) return
  event.waitUntil(caches.open(RUNTIME_CACHE).then(async (cache) => {
    const urls = event.data.urls.filter((value) => {
      try { return new URL(value, self.location.origin).origin === self.location.origin } catch { return false }
    })
    await Promise.allSettled(urls.map(async (value) => {
      const request = new Request(value, { credentials: 'same-origin' })
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response)
    }))
  }).then(() => event.ports?.[0]?.postMessage({ type: 'APP_RESOURCES_CACHED' })))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      void caches.open(RUNTIME_CACHE).then((cache) => cache.put(INDEX_URL, copy))
      return response
    }).catch(async () => (await caches.match(request)) || (await caches.match(INDEX_URL)) || (await caches.match(APP_BASE))))
    return
  }
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached
    return fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
      }
      return response
    })
  }))
})
