const FNV = 2166136261
const FNV_PRIME = 16777619

export function hashString(str) {
  let h = FNV
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

export function todayKey(now = Date.now()) {
  const ist = new Date(now + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

export function dailySeed(day = todayKey()) {
  return hashString('harvest-king:' + day)
}

export function dailyCode(day = todayKey()) {
  const compact = String(day).replace(/-/g, '').slice(2)
  return ('D' + compact).slice(0, 8)
}

export function freshSeed() {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0
}

export function rngNext(state) {
  if (state && typeof state._rng === 'function') return state._rng()
  if (!state || state.rng == null) return Math.random()
  let a = (state.rng + 0x6D2B79F5) | 0
  state.rng = a >>> 0
  let t = Math.imul(a ^ a >>> 15, 1 | a)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}
