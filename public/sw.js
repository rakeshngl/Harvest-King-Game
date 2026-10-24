/* Harvest King service worker. Bump VERSION when the shell changes. */
const VERSION = 'hk-shell-1'
const SHELL = 'hk-shell-' + VERSION
const ASSETS = 'hk-assets-' + VERSION
const API_CACHE = 'hk-api-' + VERSION

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/hero.webp',
  '/icons/icon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => precacheShell(cache)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith('hk-') && !key.endsWith(VERSION))
        .map((key) => caches.delete(key))
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (isStream(req, url)) return

  if (isApi(url)) {
    event.respondWith(networkFirst(req, API_CACHE, apiFallback()))
    return
  }

  if (url.origin !== self.location.origin) return

  if (isAsset(url)) {
    event.respondWith(cacheFirst(req, ASSETS))
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SHELL, () => caches.match('/index.html')))
    return
  }

  event.respondWith(cacheFirst(req, SHELL))
})

async function addSoft(cache, urls) {
  await Promise.all(urls.map(async (url) => {
    try {
      await cache.add(url)
    } catch {
      /* missing is fine */
    }
  }))
}

async function precacheShell(cache) {
  await addSoft(cache, PRECACHE)
  const index = await cache.match('/index.html') || await cache.match('/')
  if (!index) return
  const html = await index.text()
  const extra = []
  const re = /(?:href|src)="(\/assets\/[^"]+)"/g
  let m
  while ((m = re.exec(html))) extra.push(m[1])
  if (extra.length) await addSoft(cache, extra)
}

function isApi(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/')
}

function isAsset(url) {
  return url.pathname.startsWith('/assets/')
}

function isStream(req, url) {
  if (url.pathname === '/api/events' || url.pathname.startsWith('/api/events')) return true
  const accept = req.headers.get('accept') || ''
  return accept.includes('text/event-stream')
}

async function cacheFirst(req, name) {
  const cached = await caches.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    putCache(name, req, res)
    return res
  } catch {
    return (await caches.match('/index.html')) || offlinePage()
  }
}

async function networkFirst(req, name, fallback) {
  try {
    const res = await fetch(req)
    putCache(name, req, res)
    return res
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    if (typeof fallback === 'function') return fallback()
    return fallback || offlinePage()
  }
}

function putCache(name, req, res) {
  if (!res || !res.ok) return
  if (res.type !== 'basic' && res.type !== 'cors') return
  const copy = res.clone()
  caches.open(name).then((cache) => cache.put(req, copy)).catch(() => {})
}

function apiFallback() {
  return new Response(JSON.stringify({ ok: false, offline: true, error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })
}

function offlinePage() {
  return new Response('Offline', { status: 503, statusText: 'Offline' })
}
