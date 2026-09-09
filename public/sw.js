// Простой офлайн-кэш: приложение открывается без сети, данные и так лежат локально.
const CACHE = 'voice-expenses-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './icon.svg'])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const fromNetwork = fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => cached || caches.match('./index.html'))
      return cached || fromNetwork
    }),
  )
})
