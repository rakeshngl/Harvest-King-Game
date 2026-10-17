export const RECENT_KEEP = 10

function toCount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function blankProfile(id, name) {
  return {
    id: String(id || '').slice(0, 64),
    name: String(name || '').slice(0, 16),
    games: 0,
    wins: 0,
    insolvencies: 0,
    bestNet: 0,
    updatedAt: 0,
    recent: []
  }
}

export function normalizeProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const prof = blankProfile(src.id, src.name)
  prof.games = toCount(src.games)
  prof.wins = Math.min(toCount(src.wins), prof.games)
  prof.insolvencies = Math.min(toCount(src.insolvencies), prof.games)
  prof.bestNet = Number.isFinite(Number(src.bestNet)) ? Number(src.bestNet) : 0
  prof.updatedAt = Number(src.updatedAt) || 0
  const recent = Array.isArray(src.recent) ? src.recent : []
  prof.recent = recent.slice(0, RECENT_KEEP).map((m) => ({
    at: Number(m && m.at) || 0,
    code: String((m && m.code) || '').slice(0, 8),
    seats: toCount(m && m.seats),
    rank: Math.max(1, toCount(m && m.rank) || 1),
    net: Number(m && m.net) || 0,
    won: !!(m && m.won),
    seasons: toCount(m && m.seasons)
  }))
  return prof
}

export function applyMatch(profile, match) {
  const prof = normalizeProfile(profile)
  const at = Number(match && match.at) || Date.now()
  const won = !!(match && match.won)
  const net = Number(match && match.net) || 0
  prof.games += 1
  if (won) prof.wins += 1
  if (match && match.bankrupt) prof.insolvencies += 1
  if (net > prof.bestNet) prof.bestNet = net
  if (match && match.name) prof.name = String(match.name).slice(0, 16)
  prof.updatedAt = at
  prof.recent.unshift({
    at,
    code: String((match && match.code) || '').slice(0, 8),
    seats: toCount(match && match.seats),
    rank: Math.max(1, toCount(match && match.rank) || 1),
    net: Math.round(net),
    won,
    seasons: toCount(match && match.seasons)
  })
  prof.recent = prof.recent.slice(0, RECENT_KEEP)
  return prof
}

export function publicProfile(profile) {
  if (!profile) {
    return { id: '', name: '', games: 0, wins: 0, insolvencies: 0, bestNet: 0, recent: [] }
  }
  const prof = normalizeProfile(profile)
  return {
    id: prof.id,
    name: prof.name,
    games: prof.games,
    wins: prof.wins,
    insolvencies: prof.insolvencies,
    bestNet: prof.bestNet,
    recent: prof.recent.slice(0, RECENT_KEEP)
  }
}
