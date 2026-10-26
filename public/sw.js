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

// Phone notifications: a request from the website, sent (encrypted) by the «re-push» function
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'سويت هاوس للعقار', {
      body: data.body || '',
      icon: `${BASE}icon-192.png`,
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      dir: 'rtl',
      lang: 'ar',
      data: { url: new URL(data.url || 'admin', self.registration.scope).href },
    }),
  )
})

// a tap opens the request in the dashboard (the open tab when there is one)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || new URL('admin', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const tab = list.find((c) => new URL(c.url).pathname.startsWith(`${BASE}admin`))
      if (!tab) return self.clients.openWindow(target)
      return tab
        .focus()
        .then((c) => c.navigate(target))
        .catch(() => self.clients.openWindow(target))
    }),
  )
})

// the push service renewed this device's address: subscribe again with the same key
// (the dashboard tells the server on its next opening)
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription && event.oldSubscription.options
  if (!options || !options.applicationServerKey) return
  event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey }).catch(() => undefined))
})
