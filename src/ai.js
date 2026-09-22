import { TILES, CROPS, GROUPS, LOAN_STEP, LOAN_CAP } from './data.js'
import { currentPlayer, farmsOf, seasonOf, groupOwned } from './engine.js'

export const PERSONAS = [
  { id: 'thrifty', name: 'Thrifty', hint: 'Leases, millets, fat cash buffer' },
  { id: 'landlord', name: 'Landlord', hint: 'Buys land, hunts full belts' },
  { id: 'gambler', name: 'Gambler', hint: 'Spices, orchards, rides the market' },
  { id: 'banker', name: 'Banker', hint: 'Canal, cold store, crop loans' }
]

export const CPU_NAMES = {
  thrifty: 'Malwa',
  landlord: 'Kaveri',
  gambler: 'Idukki',
  banker: 'Narmada'
}

const DIFF = {
  easy: { reserve: 1800, miss: 0.18, gamble: 0.35 },
  normal: { reserve: 2800, miss: 0.06, gamble: 0.12 },
  hard: { reserve: 3600, miss: 0.0, gamble: 0.04 }
}

function personaOf(p) {
  return PERSONAS.find((x) => x.id === p.persona) || PERSONAS[p.id % PERSONAS.length]
}

function cashAfter(p, cost) {
  return p.cash - cost
}

function ownsWater(state, pid) {
  return state.utilities[12] === pid || state.utilities[28] === pid
}

function irrigateCost(state, p) {
  return ownsWater(state, p.id) ? 400 : 900
}

function seedCost(crop, season) {
  const off = crop.season !== season
  return crop.seed + (off ? Math.round(crop.seed * 0.35) : 0)
}

function cropScore(state, p, tile, cropId, knobs) {
  const crop = CROPS[cropId]
  const season = seasonOf(state).id
  const w = state.weather
  const cost = seedCost(crop, season)
  if (p.cash < cost) return -1e9
  const off = crop.season !== season
  const price = (state.prices[crop.id] || crop.price) * state.marketMod
  let y = crop.yield
  y *= off ? 0.72 : 1.12
  const waterFit = 1 - Math.abs(crop.water - w.water) * 0.45
  y *= Math.max(0.5, Math.min(1.2, waterFit))
  if (w.id === 'drought') y *= 0.7 + crop.drought * 0.35
  if (w.id === 'hail' && (tile.soil === 'hill' || tile.group === 'orchard')) y *= 0.55
  if (groupOwned(state, p.id, tile.group)) y *= 1.15
  const persona = personaOf(p)
  if (persona.id === 'thrifty') {
    if (cost > 900) y *= 0.7
    if (['bajra', 'jowar', 'moong', 'mustard'].includes(crop.id)) y *= 1.25
  }
  if (persona.id === 'gambler') {
    if (['spices', 'cumin', 'saffron', 'cotton', 'apple'].includes(crop.id)) y *= 1.35
    if (off) y *= 1.1
  }
  if (persona.id === 'landlord' && groupOwned(state, p.id, tile.group)) y *= 1.2
  const ev = y * price - cost - (tile.prepare || 0) * 0.25
  return ev - (knobs.reserve > p.cash - cost ? 400 : 0)
}

function bestCrop(state, p, tile, knobs) {
  let best = null
  let bestV = -1e8
  tile.crops.forEach((cid) => {
    const v = cropScore(state, p, tile, cid, knobs)
    if (v > bestV) {
      bestV = v
      best = cid
    }
  })
  return bestV > -1e8 ? best : null
}

function farmValue(state, p, tile, knobs) {
  const persona = personaOf(p)
  let v = 0
  const ids = TILES.filter((t) => t.type === 'farm' && t.group === tile.group).map((t) => t.id)
  const owned = ids.filter((id) => state.farms[id].owner === p.id).length
  const remain = ids.length - owned
  if (remain === 1) v += 2400
  else if (owned > 0) v += 900
  v += (GROUPS[tile.group]?.rentMult || 1) * 400
  const crop = bestCrop(state, p, tile, knobs)
  if (crop) v += Math.max(0, cropScore(state, p, tile, crop, knobs) * 0.4)
  if (persona.id === 'landlord') v += 700
  if (persona.id === 'thrifty') v -= tile.price * 0.15
  if (persona.id === 'gambler' && ['orchard', 'spice'].includes(tile.group)) v += 800
  const rivals = state.players.filter((o) => !o.cpu && !o.bankrupt)
  rivals.forEach((h) => {
    const hOwn = ids.filter((id) => state.farms[id].owner === h.id).length
    if (hOwn >= ids.length - 1 && knobs.miss === 0) v += 500
  })
  return v
}

function pickWork(state, p, knobs) {
  const list = farmsOf(state, p.id).filter((f) => !f.mortgaged)
  if (!list.length) return null
  const ripe = list.find((f) => f.stage === 'ripe')
  if (ripe) return ripe
  const seededDone = list.find((f) => f.stage === 'seeded' && f.growLeft <= 1)
  if (seededDone) return seededDone
  const prepared = list.find((f) => f.stage === 'prepared')
  if (prepared) return prepared
  const season = seasonOf(state).id
  const idle = list
    .filter((f) => f.stage === 'idle')
    .sort((a, b) => {
      const as = (a.tile.crops || []).some((c) => CROPS[c].season === season) ? 1 : 0
      const bs = (b.tile.crops || []).some((c) => CROPS[c].season === season) ? 1 : 0
      return bs - as
    })
  if (idle[0] && (p.freePrep || p.cash >= idle[0].tile.prepare + knobs.reserve * 0.4)) return idle[0]
  const needWater = list.find((f) => !f.irrigated && f.stage !== 'idle' && CROPS[f.crop || '']?.water > 0.7)
  if (needWater) return needWater
  return list[0] || null
}

function farmWorkAction(state, p, tileId, knobs) {
  const t = TILES[tileId]
  const f = state.farms[tileId]
  if (!f) return { type: 'skip' }
  if (f.mortgaged) {
    const cost = Math.round(t.price * 0.55)
    if (p.cash >= cost + knobs.reserve * 0.5) return { type: 'unmortgage' }
    return { type: 'skip' }
  }
  if (f.stage === 'ripe') return { type: 'harvest' }
  if (f.stage === 'prepared') {
    const crop = bestCrop(state, p, t, knobs)
    if (crop) return { type: 'seed', crop }
    return { type: 'skip' }
  }
  if (f.stage === 'idle') {
    const cost = p.freePrep ? 0 : t.prepare
    if (p.cash >= cost) return { type: 'prepare' }
    return { type: 'skip' }
  }
  if (f.stage === 'seeded') {
    const w = state.weather
    const crop = CROPS[f.crop]
    const icost = irrigateCost(state, p)
    if (!f.irrigated && p.cash >= icost + 400 && (w.id === 'drought' || (crop && crop.water >= 0.7))) {
      return { type: 'irrigate' }
    }
    const persona = personaOf(p)
    const fancy = crop && ['saffron', 'apple', 'spices', 'coffee', 'tea', 'mango'].includes(crop.id)
    if (!f.insured && p.cash >= 600 + knobs.reserve * 0.3 && (w.id === 'hail' || fancy || persona.id === 'banker')) {
      return { type: 'insure' }
    }
    if (p.cash >= 180 && f.growLeft <= 1) return { type: 'tend' }
    return { type: 'skip' }
  }
  return { type: 'skip' }
}

function acquireAction(state, p, tileId, knobs) {
  const t = TILES[tileId]
  const persona = personaOf(p)
  const value = farmValue(state, p, t, knobs)
  const buyOk = p.cash >= t.price && cashAfter(p, t.price) >= knobs.reserve * (persona.id === 'landlord' ? 0.35 : 0.7)
  const leaseOk = p.cash >= t.lease && cashAfter(p, t.lease) >= knobs.reserve * 0.4
  if (persona.id === 'thrifty' && leaseOk && (!buyOk || t.price > 3000)) return { type: 'lease' }
  if (buyOk && value > 500) return { type: 'buy' }
  if (leaseOk && value > 200) return { type: 'lease' }
  if (buyOk && persona.id === 'landlord') return { type: 'buy' }
  return { type: 'skip' }
}

function infraAction(state, p, tile, knobs) {
  const persona = personaOf(p)
  if (p.cash < tile.price) return { type: 'skip' }
  if (cashAfter(p, tile.price) < knobs.reserve * (persona.id === 'banker' ? 0.35 : 0.65)) return { type: 'skip' }
  const farms = farmsOf(state, p.id).length
  if (tile.id === 12 || tile.id === 28) {
    if (farms >= 1 || persona.id === 'banker') return { type: 'buyinfra' }
  }
  if (tile.id === 15 && farms >= 2) return { type: 'buyinfra' }
  if (tile.id === 25 && farms >= 2) return { type: 'buyinfra' }
  if (tile.id === 5 && farms >= 1) return { type: 'buyinfra' }
  if (tile.id === 35 && (farms >= 2 || persona.id === 'banker' || persona.id === 'gambler')) return { type: 'buyinfra' }
  if (persona.id === 'banker') return { type: 'buyinfra' }
  return { type: 'skip' }
}

function nabardAction(state, p, knobs) {
  const farms = farmsOf(state, p.id)
  const needSeed = farms.some((f) => f.stage === 'prepared' || f.stage === 'idle')
  if (p.debt > 0 && p.cash > knobs.reserve + LOAN_STEP + 1500 && personaOf(p).id !== 'banker') {
    return { type: 'repay' }
  }
  if (p.debt >= LOAN_CAP) return { type: 'skip' }
  if (needSeed && p.cash < knobs.reserve) return { type: 'loan' }
  if (personaOf(p).id === 'banker' && p.debt < LOAN_STEP * 2 && p.cash < 8000) return { type: 'loan' }
  return { type: 'skip' }
}

function fciAction(state, p) {
  const ready = farmsOf(state, p.id).filter((f) => f.stage === 'ripe' || (f.stage === 'seeded' && f.growLeft <= 0))
  if (!ready.length) return { type: 'skip' }
  if (state.marketMod < 0.95 || ['hail', 'flood', 'drought'].includes(state.weather.id)) return { type: 'fci' }
  if (personaOf(p).id === 'thrifty') return { type: 'fci' }
  return { type: 'skip' }
}

export function chooseAction(state, difficulty = 'normal') {
  const p = currentPlayer(state)
  if (!p || state.phase === 'over') return { type: 'endTurn' }
  if (p.bankrupt) return { type: 'endTurn' }
  const knobs = DIFF[difficulty] || DIFF.normal
  if (state.phase === 'roll') return { type: 'roll' }
  if (knobs.miss && Math.random() < knobs.miss) {
    if (state.phase === 'action') return { type: 'skip' }
    if (state.phase === 'end') return { type: 'endTurn' }
  }

  const pending = state.pending
  if (state.phase === 'action' && pending) {
    if (pending.kind === 'card') return { type: 'skip' }
    if (pending.kind === 'acquire') return acquireAction(state, p, pending.tileId, knobs)
    if (pending.kind === 'buyInfra') return infraAction(state, p, TILES[pending.tileId], knobs)
    if (pending.kind === 'fci') return fciAction(state, p)
    if (pending.kind === 'nabard') return nabardAction(state, p, knobs)
    if (pending.kind === 'farmWork') return farmWorkAction(state, p, pending.tileId, knobs)
    if (pending.kind === 'pickFarm') {
      const pick = pickWork(state, p, knobs)
      if (pick) return { type: 'work', tileId: pick.id }
      return { type: 'skip' }
    }
    return { type: 'skip' }
  }

  if (state.phase === 'end') {
    if (!state.labourUsed) {
      const pick = pickWork(state, p, knobs)
      if (pick) {
        if (pick.stage === 'ripe' || pick.stage === 'prepared' || pick.stage === 'idle' || pick.stage === 'seeded') {
          return { type: 'work', tileId: pick.id }
        }
      }
    }
    return { type: 'endTurn' }
  }

  return { type: 'endTurn' }
}

export function describeAction(state, action) {
  const p = currentPlayer(state)
  const name = p ? p.name : 'Computer'
  const pending = state.pending
  const tile = pending && pending.tileId != null ? TILES[pending.tileId] : (action.tileId != null ? TILES[action.tileId] : null)
  switch (action.type) {
    case 'roll': return `${name} rolls the dice.`
    case 'buy': return `${name} buys ${tile ? tile.name : 'the land'}.`
    case 'lease': return `${name} leases ${tile ? tile.name : 'the land'}.`
    case 'buyinfra': return `${name} acquires ${tile ? tile.name : 'infrastructure'}.`
    case 'prepare': return `${name} prepares ${tile ? tile.name : 'a field'}.`
    case 'seed': return `${name} sows ${CROPS[action.crop] ? CROPS[action.crop].name : 'a crop'}.`
    case 'harvest': return `${name} harvests ${tile ? tile.name : 'a field'}.`
    case 'tend': return `${name} tends the crop.`
    case 'irrigate': return `${name} irrigates ${tile ? tile.name : 'a field'}.`
    case 'insure': return `${name} insures the crop.`
    case 'fci': return `${name} sells grain to the warehouse.`
    case 'loan': return `${name} takes a crop loan.`
    case 'repay': return `${name} repays the rural bank.`
    case 'work': return `${name} works ${tile ? tile.name : 'a field'}.`
    case 'skip': return `${name} passes.`
    case 'endTurn': return `${name} ends the turn.`
    default: return `${name} acts.`
  }
}
