// Офлайн-кэш: приложение открывается без сети, данные и так лежат локально.
//
// Страница берётся из сети, а из кэша только если сети нет. Иначе после
// выкладки новой версии кэш отдавал бы старый index.html со ссылками на
// файлы сборки, которых уже нет, и приложение падало бы в пустой экран.
// Файлы сборки, наоборот, берутся из кэша: их имена содержат хэш и не меняются.

const CACHE = 'voice-expenses-v3'
const SHELL = ['./', './index.html', './icon.svg']

// cache: 'reload' — берём из сети мимо обычного кэша браузера. Иначе в кэш
// воркера попадала бы страница, которую браузер держит у себя ещё десять минут.
const fresh = (url) => new Request(url, { cache: 'reload' })

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(SHELL.map((url) => cache.add(fresh(url))))),
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

const isDocument = (request) =>
  request.mode === 'navigate' || request.destination === 'document'

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Проверка обновления спрашивает страницу с меткой nocache: такие запросы
  // отдаём браузеру как есть, иначе кэш вернул бы ту же версию, что уже открыта
  if (url.searchParams.has('nocache')) return

  if (isDocument(request)) {
    event.respondWith(
      fetch(fresh(request.url))
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html').then((cached) => cached ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
        return response
      })
    }),
  )
})
