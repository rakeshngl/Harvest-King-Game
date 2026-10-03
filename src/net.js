const STORAGE = 'annadata-session'
const API = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API}${path}`
}

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE) || 'null')
  } catch {
    return null
  }
}

export function saveSession(s) {
  if (!s) sessionStorage.removeItem(STORAGE)
  else sessionStorage.setItem(STORAGE, JSON.stringify(s))
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

export function createRoom(name) {
  return post('/api/create', { name })
}

export function joinRoom(code, name) {
  return post('/api/join', { code: String(code || '').toUpperCase(), name })
}

export function startRoom(sess) {
  return post('/api/start', { code: sess.code, token: sess.token })
}

export function sendAction(sess, action) {
  return post('/api/action', { code: sess.code, token: sess.token, action })
}

export async function fetchStats() {
  const res = await fetch(apiUrl('/api/stats'))
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) return { visits: 0, online: 0, playing: 0 }
  return data
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

export async function waitSnapshot(sess, seq) {
  const q = new URLSearchParams({ code: sess.code, token: sess.token, seq: String(seq) })
  const res = await fetch(apiUrl(`/api/session?${q}`))
  const data = await res.json().catch(() => ({ error: 'Network error' }))
  if (!res.ok) throw new Error(data.error || 'Session lost')
  return data
}
