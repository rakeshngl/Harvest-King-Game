import { TILES, CROPS, GROUPS, LOAN_STEP, LOAN_CAP } from './data.js'
import { currentPlayer, farmsOf, seasonOf, groupOwned, actingSeat, raisableLots } from './engine.js'
import { rngNext } from './rng.js'

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
  easy: { reserve: 1800, miss: 0.18, gamble: 0.35, luck: 0 },
  normal: { reserve: 2800, miss: 0.06, gamble: 0.12, luck: 0 },
  hard: { reserve: 3600, miss: 0.0, gamble: 0.04, luck: 0.12 }
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

function applyMood(state, p, knobs) {
  if (knobs.luck && rngNext(state) < knobs.luck) {
    knobs.reserve = Math.round(knobs.reserve * 0.55)
    knobs.lucky = true
  }
  let g = knobs.gamble
  const id = personaOf(p).id
  if (id === 'gambler') g = Math.min(0.9, g + 0.28)
  if (id === 'thrifty') g *= 0.4
  knobs.gambled = g > 0 && rngNext(state) < g
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
  if (knobs.gambled && crop.vol >= 0.32) y *= 1.22
  if (knobs.lucky) y *= 1.1
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
  if (knobs.gambled && ['orchard', 'spice', 'cotton'].includes(tile.group)) v += 350
  if (knobs.lucky && remain === 1) v += 800
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

function raiseAction(state) {
  const r = state.pending
  const p = state.players[r.pid]
  if (!p) return { type: 'giveup' }
  const lots = raisableLots(state, r.pid)
  if (!lots.length) return { type: 'giveup' }
  const need = Math.max(0, r.amount - p.cash)
  const idle = lots.filter((l) => l.kind === 'farm' && l.stage === 'idle')
  const yards = lots.filter((l) => l.kind !== 'farm')
  const crops = lots.filter((l) => l.kind === 'farm' && l.stage !== 'idle')
  const pick = idle[0] || yards[0] || crops[0]
  if (!pick) return { type: 'giveup' }
  if (pick.value + p.cash < r.amount && lots.length === 1 && need > pick.value) return { type: 'giveup' }
  return { type: 'raise', tileId: pick.tileId }
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
  const keep = knobs.gambled ? 0.45 : (persona.id === 'landlord' ? 0.35 : 0.7)
  const buyOk = p.cash >= t.price && cashAfter(p, t.price) >= knobs.reserve * keep
  const leaseOk = p.cash >= t.lease && cashAfter(p, t.lease) >= knobs.reserve * (knobs.gambled ? 0.2 : 0.4)
  if (persona.id === 'thrifty' && !knobs.gambled && leaseOk && (!buyOk || t.price > 3000)) return { type: 'lease' }
  if (buyOk && value > 500) return { type: 'buy' }
  if (leaseOk && value > 200) return { type: 'lease' }
  if (buyOk && (persona.id === 'landlord' || knobs.gambled)) return { type: 'buy' }
  return { type: 'skip' }
}

function infraAction(state, p, tile, knobs) {
  const persona = personaOf(p)
  if (p.cash < tile.price) return { type: 'skip' }
  const keep = knobs.gambled ? 0.3 : (persona.id === 'banker' ? 0.35 : 0.65)
  if (cashAfter(p, tile.price) < knobs.reserve * keep) return { type: 'skip' }
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

function auctionAction(state, knobs) {
  const a = state.pending
  const p = state.players[a.actor]
  if (!p) return { type: 'passbid' }
  const tile = TILES[a.tileId]
  const floor = a.highBid > 0 ? a.highBid + 100 : a.minBid
  if (p.cash < floor) return { type: 'passbid' }
  if (a.highBidder === p.id) return { type: 'passbid' }
  const value = tile && tile.type === 'farm' ? farmValue(state, p, tile, knobs) : (tile ? tile.price * 0.6 : 0)
  const stretch = personaOf(p).id === 'landlord' ? 1.35 : (knobs.gambled ? 1.2 : 1.05)
  const cap = Math.min(p.cash - knobs.reserve * (knobs.gambled ? 0.15 : 0.35), Math.round((tile ? tile.price : floor) * stretch))
  const bid = Math.min(p.cash, Math.max(floor, Math.round(cap / 100) * 100))
  if (bid < floor) return { type: 'passbid' }
  if (value < 200 && personaOf(p).id !== 'landlord' && !knobs.gambled) return { type: 'passbid' }
  if (bid > p.cash - knobs.reserve * 0.25 && personaOf(p).id === 'thrifty' && !knobs.gambled) return { type: 'passbid' }
  return { type: 'bid', amount: bid }
}

function tradeReply(state, knobs) {
  const deal = state.pending
  const me = state.players[deal.to]
  const them = state.players[deal.from]
  if (!me || !them) return { type: 'reject' }
  let score = (deal.cashTake || 0) - (deal.cashGive || 0)
  if (deal.landTake != null) {
    const t = TILES[deal.landTake]
    score += t ? t.price * 0.9 : 0
  }
  if (deal.landGive != null) {
    const t = TILES[deal.landGive]
    score -= t ? t.price * 0.9 : 0
  }
  score -= (deal.debtTake || 0) * 0.6
  score += (deal.debtGive || 0) * 0.4
  if (deal.landGive != null && TILES[deal.landGive] && groupOwned(state, me.id, TILES[deal.landGive].group) === false) {
    const ids = TILES.filter((x) => x.type === 'farm' && x.group === TILES[deal.landGive].group)
    const owned = ids.filter((x) => state.farms[x.id].owner === me.id).length
    if (owned === ids.length - 1) score += 1800
  }
  const floor = knobs && knobs.lucky ? -400 : knobs && knobs.gambled ? -200 : 0
  return score >= floor ? { type: 'accept' } : { type: 'reject' }
}

function wantFarm(state, p, tile, knobs) {
  const ids = TILES.filter((t) => t.type === 'farm' && t.group === tile.group)
  const owned = ids.filter((t) => state.farms[t.id].owner === p.id).length
  const remain = ids.length - owned
  if (owned > 0 && remain === 1) return 3
  if (owned > 0) return 2
  if (knobs.gambled && ['orchard', 'spice', 'cotton'].includes(tile.group)) return 1
  if (knobs.lucky && ['orchard', 'spice'].includes(tile.group)) return 1
  return 0
}

function tradeOffer(state, p, knobs) {
  if (state._cpuOffered) return null
  const others = state.players.filter((o) => o.id !== p.id && !o.bankrupt)
  let best = null
  let bestV = 0
  others.forEach((them) => {
    TILES.forEach((t) => {
      if (t.type !== 'farm') return
      const f = state.farms[t.id]
      if (!f || f.owner !== them.id || f.mortgaged) return
      const want = wantFarm(state, p, t, knobs)
      if (!want) return
      const rate = knobs.lucky && want >= 3 ? 1 : knobs.gambled ? 0.95 : 0.9
      const keep = knobs.gambled ? 0.25 : 0.5
      const maxPay = p.cash - Math.round(knobs.reserve * keep)
      let pay = Math.floor(t.price * rate / 100) * 100
      pay = Math.min(pay, Math.floor(Math.max(0, maxPay) / 100) * 100)
      if (them.cpu) pay = Math.min(pay, Math.floor(t.price * 0.9 / 100) * 100)
      if (pay < 100) return
      const v = want * 1000 + t.price - pay
      if (v > bestV) {
        bestV = v
        best = {
          type: 'offer',
          to: them.id,
          cashGive: pay,
          cashTake: 0,
          landGive: null,
          landTake: t.id,
          debtGive: 0,
          debtTake: 0
        }
      }
    })
  })
  if (!best) return null
  state._cpuOffered = true
  return best
}

export function chooseAction(state, difficulty = 'normal') {
  const pending = state.pending
  const actorId = actingSeat(state)
  const p = state.players[actorId] || currentPlayer(state)
  if (!p || state.phase === 'over') return { type: 'endTurn' }
  if (p.bankrupt) return { type: 'endTurn' }
  const knobs = { ...(DIFF[difficulty] || DIFF.normal) }
  if (state.phase === 'roll') {
    state._cpuOffered = false
    return { type: 'roll' }
  }
  if (state.phase === 'action' && pending && pending.kind === 'raise') return raiseAction(state)
  applyMood(state, p, knobs)
  if (state.phase === 'action' && pending && pending.kind === 'auction') return auctionAction(state, knobs)
  if (state.phase === 'action' && pending && pending.kind === 'trade') return tradeReply(state, knobs)
  if (state.turn !== actorId) return { type: 'skip' }
  if (knobs.miss && rngNext(state) < knobs.miss) {
    if (state.phase === 'action') return { type: 'skip' }
    if (state.phase === 'end') return { type: 'endTurn' }
  }

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
    const deal = tradeOffer(state, p, knobs)
    if (deal) return deal
    return { type: 'endTurn' }
  }

  return { type: 'endTurn' }
}

export function describeAction(state, action) {
  const p = state.players[actingSeat(state)] || currentPlayer(state)
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
    case 'mortgage': return `${name} mortgages ${tile ? tile.name : 'a field'}.`
    case 'raise': return `${name} raises cash on ${tile ? tile.name : 'a lot'}.`
    case 'giveup': return `${name} gives up the lands.`
    case 'fci': return `${name} sells grain to the warehouse.`
    case 'loan': return `${name} takes a crop loan.`
    case 'repay': return `${name} repays the rural bank.`
    case 'work': return `${name} works ${tile ? tile.name : 'a field'}.`
    case 'skip': return `${name} passes.`
    case 'bid': return `${name} bids Rs ${action.amount}.`
    case 'passbid': return `${name} passes on the auction.`
    case 'accept': return `${name} accepts the deal.`
    case 'reject': return `${name} turns down the deal.`
    case 'offer': return `${name} offers a deal.`
    case 'endTurn': return `${name} ends the turn.`
    default: return `${name} acts.`
  }
}
