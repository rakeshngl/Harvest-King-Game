const STORAGE = 'annadata-session'
const SEATS = 'annadata-seats'
const API = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API}${path}`
}

function readJson(store, key, fallback) {
  try {
    const raw = store.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function loadSeats() {
  const seats = readJson(localStorage, SEATS, {})
  return seats && typeof seats === 'object' ? seats : {}
}

function writeSeats(seats) {
  try {
    localStorage.setItem(SEATS, JSON.stringify(seats))
  } catch {
    /* quota */
  }
}

export function savedSeat(code) {
  return loadSeats()[String(code || '').toUpperCase()] || null
}

export function savedSeats() {
  return loadSeats()
}

export function forgetSeat(code) {
  const seats = loadSeats()
  delete seats[String(code || '').toUpperCase()]
  writeSeats(seats)
}

export function loadSession() {
  const cur = readJson(localStorage, STORAGE, null)
  if (cur && cur.token) return cur
  const legacy = readJson(sessionStorage, STORAGE, null)
  if (legacy && legacy.token) {
    saveSession(legacy)
    try { sessionStorage.removeItem(STORAGE) } catch { /* ignore */ }
    return legacy
  }
  return null
}

export function saveSession(s) {
  try { sessionStorage.removeItem(STORAGE) } catch { /* ignore */ }
  if (!s) {
    try { localStorage.removeItem(STORAGE) } catch { /* ignore */ }
    return
  }
  try { localStorage.setItem(STORAGE, JSON.stringify(s)) } catch { /* quota */ }
  if (s.code && s.token) {
    const seats = loadSeats()
    seats[String(s.code).toUpperCase()] = {
      token: s.token,
      you: s.you,
      spectator: !!s.spectator,
      name: s.name || ''
    }
    writeSeats(seats)
  }
}

async function post(path, body) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({ error: 'Network error' }))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function createRoom(name, opts = {}) {
  return post('/api/create', { name, password: opts.password || '' })
}

export function joinRoom(code, name, opts = {}) {
  return post('/api/join', {
    code: String(code || '').toUpperCase(),
    name,
    token: opts.token || undefined,
    watch: !!opts.watch,
    password: opts.password || undefined
  })
}

export function rejoinRoom(code, token) {
  return post('/api/join', {
    code: String(code || '').toUpperCase(),
    token
  })
}

export function startRoom(sess) {
  return post('/api/start', { code: sess.code, token: sess.token })
}

export function sendAction(sess, action) {
  return post('/api/action', { code: sess.code, token: sess.token, action })
}

export function kickSeat(sess, seat) {
  return post('/api/kick', { code: sess.code, token: sess.token, seat })
}

export function passHost(sess, seat) {
  return post('/api/host', { code: sess.code, token: sess.token, seat })
}

export function addCpu(sess, difficulty) {
  return post('/api/cpu', { code: sess.code, token: sess.token, difficulty: difficulty || 'normal' })
}

export async function fetchStats() {
  const res = await fetch(apiUrl('/api/stats'))
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) return { visits: 0, online: 0, playing: 0 }
  return data
}

export async function fetchLobby() {
  const res = await fetch(apiUrl('/api/lobby'))
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) return []
  return Array.isArray(data.rooms) ? data.rooms : []
}

export async function pingPresence(visitor, playing) {
  const res = await fetch(apiUrl('/api/presence'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor, playing: !!playing })
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) return { visits: 0, online: 0, playing: 0 }
  return data
}

export async function waitSnapshot(sess) {
  const q = new URLSearchParams({ code: sess.code, token: sess.token })
  const res = await fetch(apiUrl(`/api/session?${q}`))
  const data = await res.json().catch(() => ({ error: 'Network error' }))
  if (!res.ok) throw new Error(data.error || 'Session lost')
  return data
}

export function openEventStream(sess, { onSnapshot, onError, onOpen }) {
  const q = new URLSearchParams({ code: sess.code, token: sess.token })
  const source = new EventSource(apiUrl(`/api/events?${q}`))
  source.addEventListener('snapshot', (ev) => {
    try {
      onSnapshot(JSON.parse(ev.data))
    } catch {
      /* ignore */
    }
  })
  source.addEventListener('open', () => {
    if (onOpen) onOpen()
  })
  source.onerror = () => {
    if (onError) onError(new Error('Connection lost'))
  }
  return source
}
