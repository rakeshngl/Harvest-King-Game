import crypto from 'node:crypto'

export const COOKIE = 'hk-vid'
export const SEAT_COOKIE = 'hk-seat'
export const SEAT_HEADER = 'x-seat-token'

export function mintId() {
  return crypto.randomBytes(16).toString('hex')
}

export function sign(id, secret) {
  return crypto.createHmac('sha256', String(secret || '')).update(String(id || '')).digest('hex')
}

export function pack(id, secret) {
  return `${id}.${sign(id, secret)}`
}

export function unpack(raw, secret) {
  const s = String(raw || '')
  const dot = s.lastIndexOf('.')
  if (dot < 1) return null
  const id = s.slice(0, dot)
  const sig = s.slice(dot + 1)
  if (!/^[0-9a-f]{32}$/.test(id) || !/^[0-9a-f]{64}$/.test(sig)) return null
  const expect = sign(id, secret)
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expect, 'hex')
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  return id
}

export function parseCookies(header) {
  const out = {}
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i < 1) return
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (!k) return
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  })
  return out
}
