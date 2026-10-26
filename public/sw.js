// Sweet House — service worker. The app opens fast and still opens without network;
// data (Supabase), photos and pages always come from the network first.
const VERSION = 'shi-__BUILD__'
const BASE = new URL('./', self.location).pathname
const SHELL = `${BASE}index.html`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([SHELL, `${BASE}logo.svg`, `${BASE}icon-192.png`]))
      .then(() => self.skipWaiting()),
  )
})

// a new deployment: the previous files are thrown away
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Supabase, photos, fonts…: straight to the network, never cached here
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return

  // pages: the network first, the last good copy when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((cache) => cache.put(SHELL, copy))
          }
          return res
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    )
    return
  }

  // built files carry a hash in their name: once cached they never change
  if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(VERSION).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
