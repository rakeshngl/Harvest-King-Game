const STORAGE = 'annadata-session'

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
  const res = await fetch(path, {
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

export async function waitSnapshot(sess, seq) {
  const q = new URLSearchParams({ code: sess.code, token: sess.token, seq: String(seq) })
  const res = await fetch(`/api/session?${q}`)
  const data = await res.json().catch(() => ({ error: 'Network error' }))
  if (!res.ok) throw new Error(data.error || 'Session lost')
  return data
}
