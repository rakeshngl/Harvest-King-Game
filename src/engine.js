import {
  TILES, CROPS, GROUPS, KISAN_CARDS, MANDI_CARDS, WEATHER,
  PLAYER_PALETTE, SEASONS, START_CASH, PASS_GO, WIN_NET, MAX_SEASONS,
  LOAN_STEP, LOAN_CAP, INTEREST, SEASON_PRESETS, DEFAULT_PRESET
} from './data.js'
import { rngNext, freshSeed, dailySeed } from './rng.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

function shuffle(arr, state) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(state) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

export function createFarmState() {
  return {
    owner: null,
    leasee: null,
    leaseTurns: 0,
    mortgaged: false,
    stage: 'idle',
    crop: null,
    growLeft: 0,
    fertility: 1,
    irrigated: false,
    insured: false,
    prepared: false,
    lastYield: 0,
    lastPnl: 0
  }
}

export function presetById(id) {
  return SEASON_PRESETS.find((p) => p.id === id)
    || SEASON_PRESETS.find((p) => p.id === DEFAULT_PRESET)
    || SEASON_PRESETS[0]
}

export function createGame(playerCount = 2, names = [], opts = {}) {
  const n = clamp(playerCount, 2, 4)
  const cpu = opts.cpu || []
  const persona = opts.persona || []
  const preset = presetById(opts.preset)
  const maxSeasons = Math.max(1, Number(opts.seasons) || preset.seasons)
  const winNet = Math.max(1, Number(opts.winNet) || preset.winNet)
  const daily = opts.daily ? String(opts.daily) : null
  const seed = daily ? dailySeed(daily) : (Number.isFinite(Number(opts.seed)) ? (Number(opts.seed) >>> 0) : freshSeed())
  const players = Array.from({ length: n }, (_, i) => ({
    id: i,
    name: names[i] || PLAYER_PALETTE[i].name,
    color: PLAYER_PALETTE[i].color,
    ink: PLAYER_PALETTE[i].ink,
    cash: START_CASH,
    pos: 0,
    debt: 0,
    bankrupt: false,
    skipHarvestBonus: false,
    freePrep: false,
    knowHow: 0,
    enam: 0,
    infra: [],
    utilities: [],
    cpu: !!cpu[i],
    persona: persona[i] || null
  }))

  const farms = {}
  TILES.forEach((t) => {
    if (t.type === 'farm') farms[t.id] = createFarmState()
  })

  const prices = {}
  Object.values(CROPS).forEach((c) => { prices[c.id] = c.price })

  const state = {
    players,
    farms,
    infra: {},
    utilities: {},
    prices,
    marketMod: 1,
    seasonIndex: 0,
    preset: preset.id,
    maxSeasons,
    winNet,
    seed,
    daily,
    rng: seed,
    turn: 0,
    weather: WEATHER[0],
    kisan: [],
    mandi: [],
    kisanI: 0,
    mandiI: 0,
    log: [],
    logId: 0,
    phase: 'roll',
    lastDice: [1, 1],
    doubles: 0,
    pending: null,
    winner: null,
    started: true,
    labourUsed: false
  }
  state.kisan = shuffle(KISAN_CARDS, state)
  state.mandi = shuffle(MANDI_CARDS, state)
  log(state, 'Village Hall opens. May your granaries fill.', 'info')
  return state
}

export function seasonOf(state) {
  return SEASONS[state.seasonIndex % SEASONS.length]
}

export function tileAt(id) {
  return TILES[id]
}

export function currentPlayer(state) {
  return state.players[state.turn]
}

export function netWorth(state, player) {
  let worth = player.cash - player.debt
  TILES.forEach((t) => {
    if (t.type === 'farm' && state.farms[t.id].owner === player.id && !state.farms[t.id].mortgaged) {
      worth += t.price
      const f = state.farms[t.id]
      if (f.irrigated) worth += 800
      if (f.insured) worth += 400
      if (f.stage !== 'idle') worth += 300
    }
    if (t.type === 'infra' && state.infra[t.id] === player.id) worth += t.price
    if (t.type === 'utility' && state.utilities[t.id] === player.id) worth += t.price
  })
  return worth
}

export function finalStandings(state) {
  const rows = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    net: Math.round(netWorth(state, p)),
    bankrupt: !!p.bankrupt
  }))
  const order = [...rows].sort((a, b) => b.net - a.net)
  const rankOf = new Map()
  order.forEach((r, i) => rankOf.set(r.id, i + 1))
  return rows.map((r) => ({
    ...r,
    rank: rankOf.get(r.id),
    won: state.winner != null ? state.winner === r.id : rankOf.get(r.id) === 1
  }))
}

export function farmsOf(state, pid) {
  return Object.entries(state.farms)
    .filter(([, f]) => f.owner === pid || f.leasee === pid)
    .map(([id, f]) => ({ id: Number(id), ...f, tile: TILES[Number(id)] }))
}

export function groupOwned(state, pid, group) {
  const ids = TILES.filter((t) => t.type === 'farm' && t.group === group).map((t) => t.id)
  return ids.every((id) => state.farms[id].owner === pid)
}

function log(state, msg, kind = 'info', meta = null) {
  state.logId += 1
  state.log.unshift({ id: state.logId, kind, text: msg, meta })
}

function gain(state, player, amount, reason) {
  const a = Math.round(amount)
  if (a <= 0) return
  player.cash += a
  log(state, `${player.name} receives Rs ${a}${reason ? ' — ' + reason : ''}.`, 'gain', { amount: a, pid: player.id })
}

function drawCard(state, kind) {
  const deck = kind === 'kisan' ? state.kisan : state.mandi
  const key = kind === 'kisan' ? 'kisanI' : 'mandiI'
  const card = deck[state[key] % deck.length]
  state[key] += 1
  return card
}

export function rollDice(state) {
  return [
    1 + Math.floor(rngNext(state) * 6),
    1 + Math.floor(rngNext(state) * 6)
  ]
}

export function applyMove(state, dice) {
  const p = currentPlayer(state)
  if (p.bankrupt) return state
  state.lastDice = dice
  const total = dice[0] + dice[1]
  const from = p.pos
  p.pos = (p.pos + total) % 40
  if (from + total >= 40) {
    gain(state, p, PASS_GO, 'Village Hall harvest dues')
    tickLeases(state, p)
    advanceSeasonMaybe(state)
    if (state.phase === 'over') return state
  }
  const tile = TILES[p.pos]
  log(state, `${p.name} rolls ${dice[0]}+${dice[1]} and reaches ${tile.name}.`, 'roll', { pid: p.id, tileId: tile.id, dice: [dice[0], dice[1]] })
  resolveTile(state, p, tile, total)
  checkWin(state)
  return state
}

function tickLeases(state, p) {
  Object.values(state.farms).forEach((f) => {
    if (f.leasee === p.id) {
      f.leaseTurns -= 1
      if (f.leaseTurns <= 0) {
        f.leasee = null
        f.leaseTurns = 0
        if (f.stage !== 'idle' && f.owner == null) {
          f.stage = 'idle'
          f.crop = null
          f.prepared = false
        }
        log(state, `A lease held by ${p.name} expired.`, 'info', { pid: p.id })
      }
    }
  })
}

function advanceSeasonMaybe(state) {
  state.seasonIndex += 1
  const w = WEATHER[Math.floor(rngNext(state) * WEATHER.length)]
  state.weather = w
  state.marketMod = clamp(state.marketMod + (rngNext(state) * 0.16 - 0.08), 0.7, 1.4)
  Object.keys(state.prices).forEach((cid) => {
    const base = CROPS[cid].price
    const drift = 1 + (rngNext(state) * 0.2 - 0.1)
    state.prices[cid] = Math.round(base * state.marketMod * drift)
  })
  log(state, `${seasonOf(state).name} season. Weather: ${w.name}. ${w.text}`, 'season')
  state.players.forEach((pl) => {
    if (pl.knowHow > 0) pl.knowHow -= 1
    if (pl.enam > 0) pl.enam -= 1
    if (pl.debt > 0) {
      const interest = Math.round(pl.debt * INTEREST)
      pl.debt += interest
      log(state, `${pl.name} accrues Rs ${interest} rural bank interest.`, 'loss', { amount: interest, pid: pl.id })
    }
  })
  if (state.seasonIndex >= (state.maxSeasons || MAX_SEASONS)) finishByNet(state)
}

function resolveTile(state, p, tile, diceTotal) {
  state.pending = null
  if (tile.type === 'start') {
    if (farmsOf(state, p.id).length) {
      state.pending = { kind: 'pickFarm', reason: 'Village labour day — work one field.' }
      state.phase = 'action'
    } else {
      state.phase = 'end'
    }
    return
  }
  if (tile.type === 'kisan') {
    const card = drawCard(state, 'kisan')
    applyCard(state, p, card)
    if (state.phase === 'over') return
    state.pending = { kind: 'card', deck: 'Farmer Card', card }
    state.phase = 'action'
    return
  }
  if (tile.type === 'mandi') {
    const card = drawCard(state, 'mandi')
    applyCard(state, p, card)
    if (state.phase === 'over') return
    state.pending = { kind: 'card', deck: 'Market Prices', card }
    state.phase = 'action'
    return
  }
  if (tile.type === 'tax') {
    const amt = Math.max(tile.amount, Math.round(p.cash * tile.pct))
    forcePay(state, p, amt, tile.name)
    state.phase = 'end'
    return
  }
  if (tile.type === 'mela') {
    const bonus = 400 + Math.floor(rngNext(state) * 900)
    gain(state, p, bonus, 'Farm Fair prize')
    if (rngNext(state) < 0.45) {
      const f = farmsOf(state, p.id).find((x) => x.stage === 'idle' && !x.mortgaged)
      if (f) {
        state.farms[f.id].fertility = clamp(state.farms[f.id].fertility + 0.25, 0.5, 2)
        log(state, `Mela demo plot improved fertility at ${f.tile.name}.`, 'gain', { pid: p.id })
      }
    }
    if (farmsOf(state, p.id).length) {
      state.pending = { kind: 'pickFarm', reason: 'Mela demonstration plot — advance one field.' }
      state.phase = 'action'
    } else {
      state.phase = 'end'
    }
    return
  }
  if (tile.type === 'fci') {
    state.pending = { kind: 'fci' }
    state.phase = 'action'
    return
  }
  if (tile.type === 'nabard') {
    state.pending = { kind: 'nabard' }
    state.phase = 'action'
    return
  }
  if (tile.type === 'infra') {
    handleBuyable(state, p, tile, 'infra', diceTotal)
    return
  }
  if (tile.type === 'utility') {
    handleBuyable(state, p, tile, 'utilities', diceTotal)
    return
  }
  if (tile.type === 'farm') {
    handleFarm(state, p, tile, diceTotal)
  }
}

function handleBuyable(state, p, tile, map, diceTotal) {
  const ownerId = state[map][tile.id]
  if (ownerId == null) {
    state.pending = { kind: 'buyInfra', tileId: tile.id, map }
    state.phase = 'action'
    return
  }
  if (ownerId === p.id) {
    state.phase = 'end'
    return
  }
  const owner = state.players[ownerId]
  let rent = 0
  if (map === 'infra') {
    const owned = TILES.filter((t) => t.type === 'infra' && state.infra[t.id] === ownerId).length
    rent = tile.rent[owned - 1] || tile.rent[0]
  } else {
    const owned = TILES.filter((t) => t.type === 'utility' && state.utilities[t.id] === ownerId).length
    rent = diceTotal * (owned === 2 ? 80 : 40)
  }
  transfer(state, p, owner, rent, `using ${tile.name}`)
  state.phase = 'end'
}

function handleFarm(state, p, tile) {
  const f = state.farms[tile.id]
  if (f.owner == null && f.leasee == null) {
    state.pending = { kind: 'acquire', tileId: tile.id }
    state.phase = 'action'
    return
  }
  if (f.owner === p.id || f.leasee === p.id) {
    state.pending = { kind: 'farmWork', tileId: tile.id }
    state.phase = 'action'
    return
  }
  if (f.leasee != null && f.leasee !== p.id && f.owner == null) {
    const holder = state.players[f.leasee]
    transfer(state, p, holder, Math.round(tile.rent * 0.6), `crossing leased ${tile.name}`)
    state.phase = 'end'
    return
  }
  if (f.owner != null && f.owner !== p.id) {
    const owner = state.players[f.owner]
    let rent = tile.rent
    if (groupOwned(state, f.owner, tile.group)) rent = Math.round(rent * 2.2 * (GROUPS[tile.group].rentMult || 1))
    if (f.stage === 'ripe' || f.stage === 'seeded') rent = Math.round(rent * 1.4)
    if (f.irrigated) rent = Math.round(rent * 1.15)
    if (f.mortgaged) rent = 0
    if (rent > 0) transfer(state, p, owner, rent, `crossing ${tile.name}`)
    state.phase = 'end'
    return
  }
  state.phase = 'end'
}

export function transfer(state, from, to, amount, reason) {
  const a = Math.round(amount)
  if (a <= 0) return
  if (from.cash >= a) {
    from.cash -= a
    to.cash += a
    log(state, `${from.name} pays ${to.name} Rs ${a} for ${reason}.`, 'loss', { amount: a, pid: from.id })
    return
  }
  if (forcePay(state, from, a, reason)) to.cash += a
}

export function forcePay(state, player, amount, reason) {
  if (player.cash >= amount) {
    player.cash -= Math.round(amount)
    log(state, `${player.name} pays Rs ${Math.round(amount)} — ${reason}.`, 'loss', { amount: Math.round(amount), pid: player.id })
    return true
  }
  autoRaise(state, player, amount)
  if (player.cash >= amount) {
    player.cash -= Math.round(amount)
    log(state, `${player.name} pays Rs ${Math.round(amount)} — ${reason}.`, 'loss', { amount: Math.round(amount), pid: player.id })
    return true
  }
  bankrupt(state, player, reason)
  return false
}

function autoRaise(state, player, need) {
  Object.entries(state.farms).forEach(([id, f]) => {
    if (player.cash >= need) return
    if (f.owner === player.id && !f.mortgaged && f.stage === 'idle') {
      f.mortgaged = true
      player.cash += Math.round(TILES[id].price * 0.5)
      log(state, `${player.name} mortgages ${TILES[id].name}.`, 'loss', { pid: player.id })
    }
  })
}

function bankrupt(state, player, reason) {
  player.bankrupt = true
  player.cash = 0
  Object.values(state.farms).forEach((f) => {
    if (f.owner === player.id || f.leasee === player.id) {
      Object.assign(f, createFarmState())
    }
  })
  Object.keys(state.infra).forEach((k) => {
    if (state.infra[k] === player.id) delete state.infra[k]
  })
  Object.keys(state.utilities).forEach((k) => {
    if (state.utilities[k] === player.id) delete state.utilities[k]
  })
  log(state, `${player.name} is insolvent (${reason}). Lands revert to Village Hall.`, 'loss', { pid: player.id })
  const alive = state.players.filter((p) => !p.bankrupt)
  if (alive.length === 1) {
    state.winner = alive[0].id
    state.phase = 'over'
    log(state, `${alive[0].name} is the Harvest King of the board.`, 'gain', { pid: alive[0].id })
  } else if (alive.length === 0) {
    finishByNet(state)
    if (state.phase !== 'over') state.phase = 'over'
  }
}

function applyCard(state, p, card) {
  log(state, `${card.title}: ${card.text}`, 'card', { pid: p.id })
  switch (card.fn) {
    case 'gain':
      gain(state, p, card.amount, card.title)
      break
    case 'pay':
      forcePay(state, p, card.amount, card.title)
      break
    case 'fertility':
      Object.values(state.farms).forEach((f) => {
        if ((f.owner === p.id || f.leasee === p.id) && f.stage === 'seeded') {
          f.fertility = clamp(f.fertility + (card.delta || 1) * 0.2, 0.5, 2.2)
        }
      })
      break
    case 'drought':
      Object.values(state.farms).forEach((f) => {
        if ((f.owner === p.id || f.leasee === p.id) && f.stage === 'seeded' && !f.irrigated) {
          f.fertility = clamp(f.fertility - 0.3, 0.4, 2)
        }
      })
      break
    case 'pest': {
      const seeded = farmsOf(state, p.id).filter((f) => f.stage === 'seeded' || f.stage === 'ripe')
      const fee = seeded.length * card.fee
      if (fee === 0) break
      if (p.cash >= fee) {
        p.cash -= fee
        log(state, `${p.name} sprays pesticide for Rs ${fee}.`, 'loss', { amount: fee, pid: p.id })
      } else {
        seeded.forEach((f) => wipeCrop(state, f.id, 'pests'))
      }
      break
    }
    case 'perFarm': {
      const n = farmsOf(state, p.id).length
      forcePay(state, p, n * card.amount, card.title)
      break
    }
    case 'freePrep':
      p.freePrep = true
      break
    case 'hail': {
      const hit = farmsOf(state, p.id).find((f) => f.stage === 'ripe' || f.stage === 'seeded')
      if (hit) {
        const crop = CROPS[hit.crop]
        if (crop) {
          const loss = Math.round(crop.yield * crop.price * 0.5)
          forcePay(state, p, loss, 'hail damage')
        }
      }
      break
    }
    case 'priceBoost':
      card.groups.forEach((g) => {
        TILES.filter((t) => t.group === g).forEach((t) => {
          t.crops.forEach((cid) => {
            state.prices[cid] = Math.round(state.prices[cid] * (1 + card.pct))
          })
        })
      })
      break
    case 'priceDrop':
      card.crops.forEach((cid) => {
        state.prices[cid] = Math.round(state.prices[cid] * (1 - card.pct))
      })
      break
    case 'ifOwn':
      if (state.utilities[card.tile] === p.id || state.infra[card.tile] === p.id) {
        gain(state, p, card.amount, card.title)
      }
      break
    case 'fromEach':
      state.players.forEach((o) => {
        if (o.id !== p.id && !o.bankrupt) transfer(state, o, p, card.amount, card.title)
      })
      break
    case 'insuranceClaim':
      if (farmsOf(state, p.id).some((f) => f.insured)) gain(state, p, card.amount, 'crop insurance')
      break
    case 'knowHow':
      p.knowHow = 2
      break
    case 'unlessOwn':
      if (state.infra[card.tile] !== p.id) forcePay(state, p, card.amount, card.title)
      break
    case 'organicBonus':
      farmsOf(state, p.id).forEach((f) => {
        if (f.tile.group === 'spice' || f.tile.id === 39) gain(state, p, card.amount, f.tile.name)
      })
      break
    case 'mspHike':
      card.crops.forEach((cid) => {
        state.prices[cid] = Math.round(state.prices[cid] * (1 + card.pct))
      })
      break
    case 'labour':
      if (p.cash >= card.amount) {
        p.cash -= card.amount
        log(state, `${p.name} hires extra labour.`, 'loss', { amount: card.amount, pid: p.id })
      } else {
        p.skipHarvestBonus = true
      }
      break
    case 'market':
      state.marketMod = clamp(state.marketMod * (1 + card.pct), 0.55, 1.6)
      Object.keys(state.prices).forEach((cid) => {
        state.prices[cid] = Math.round(CROPS[cid].price * state.marketMod)
      })
      break
    case 'ifCropField':
      if (farmsOf(state, p.id).some((f) => f.crop && card.crops.includes(f.crop))) {
        gain(state, p, card.amount, card.title)
      }
      break
    case 'priceBoostCrops':
      card.crops.forEach((cid) => {
        state.prices[cid] = Math.round(state.prices[cid] * (1 + card.pct))
      })
      break
    case 'rot':
      farmsOf(state, p.id).forEach((f) => {
        if (f.stage === 'ripe' && rngNext(state) < 0.4) wipeCrop(state, f.id, 'rot')
      })
      break
    case 'enam':
      gain(state, p, 500, 'online market')
      p.enam = 2
      break
    case 'debtCut':
      p.debt = Math.max(0, p.debt - card.amount)
      log(state, `${p.name} debt reduced to Rs ${p.debt}.`, 'gain', { amount: card.amount, pid: p.id })
      break
    default:
      break
  }
}

function wipeCrop(state, tileId, why) {
  const f = state.farms[tileId]
  f.stage = 'idle'
  f.crop = null
  f.growLeft = 0
  f.prepared = false
  f.lastPnl = -200
  log(state, `Crop lost at ${TILES[tileId].name} due to ${why}.`, 'loss', { tileId })
}

export function buyFarm(state, tileId) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  const f = state.farms[tileId]
  if (f.owner != null || p.cash < t.price) return false
  p.cash -= t.price
  f.owner = p.id
  f.leasee = null
  log(state, `${p.name} purchases ${t.name} for Rs ${t.price}.`, 'loss', { amount: t.price, pid: p.id, tileId })
  state.pending = { kind: 'farmWork', tileId }
  state.phase = 'action'
  return true
}

export function leaseFarm(state, tileId) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  const f = state.farms[tileId]
  if (f.owner != null || f.leasee != null || p.cash < t.lease) return false
  p.cash -= t.lease
  f.leasee = p.id
  f.leaseTurns = 3
  log(state, `${p.name} leases ${t.name} for Rs ${t.lease} (3 circuits).`, 'loss', { amount: t.lease, pid: p.id, tileId })
  state.pending = { kind: 'farmWork', tileId }
  state.phase = 'action'
  return true
}

export function buyInfra(state, tileId, map) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  if (state[map][tileId] != null || p.cash < t.price) return false
  p.cash -= t.price
  state[map][tileId] = p.id
  log(state, `${p.name} acquires ${t.name} for Rs ${t.price}.`, 'loss', { amount: t.price, pid: p.id, tileId })
  state.phase = 'end'
  state.pending = null
  return true
}

export function canWork(state, tileId) {
  const p = currentPlayer(state)
  const f = state.farms[tileId]
  if (!f || f.mortgaged) return false
  return f.owner === p.id || f.leasee === p.id
}

export function prepareLand(state, tileId) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  const f = state.farms[tileId]
  if (!canWork(state, tileId) || f.stage !== 'idle') return false
  const cost = p.freePrep ? 0 : t.prepare
  if (p.cash < cost) return false
  p.cash -= cost
  p.freePrep = false
  f.prepared = true
  f.stage = 'prepared'
  f.fertility = clamp(f.fertility + 0.1, 0.5, 2.2)
  log(state, `${p.name} prepares ${t.name}${cost ? ' for Rs ' + cost : ' (Soil Health Card)'}.`, cost ? 'loss' : 'gain', { amount: cost, pid: p.id, tileId })
  state.pending = { kind: 'farmWork', tileId }
  return true
}

export function seedLand(state, tileId, cropId) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  const f = state.farms[tileId]
  const crop = CROPS[cropId]
  if (!canWork(state, tileId) || f.stage !== 'prepared' || !crop) return false
  if (!t.crops.includes(cropId)) return false
  const season = seasonOf(state).id
  const off = crop.season !== season
  const cost = crop.seed + (off ? Math.round(crop.seed * 0.35) : 0)
  if (p.cash < cost) return false
  p.cash -= cost
  f.crop = cropId
  f.stage = 'seeded'
  f.growLeft = crop.grow
  if (off) f.fertility = clamp(f.fertility - 0.15, 0.4, 2)
  log(state, `${p.name} sows ${crop.name} at ${t.name} for Rs ${cost}${off ? ' (off-season surcharge)' : ''}.`, 'loss', { amount: cost, pid: p.id, tileId })
  state.phase = 'end'
  state.pending = null
  return true
}

export function irrigate(state, tileId) {
  const p = currentPlayer(state)
  const f = state.farms[tileId]
  if (!canWork(state, tileId) || f.irrigated) return false
  const ownsWater = state.utilities[12] === p.id || state.utilities[28] === p.id
  const cost = ownsWater ? 400 : 900
  if (p.cash < cost) return false
  p.cash -= cost
  f.irrigated = true
  log(state, `${p.name} irrigates ${TILES[tileId].name} for Rs ${cost}.`, 'loss', { amount: cost, pid: p.id, tileId })
  return true
}

export function insure(state, tileId) {
  const p = currentPlayer(state)
  const f = state.farms[tileId]
  if (!canWork(state, tileId) || f.insured) return false
  const cost = 600
  if (p.cash < cost) return false
  p.cash -= cost
  f.insured = true
  log(state, `${p.name} insures ${TILES[tileId].name} under crop insurance.`, 'loss', { amount: cost, pid: p.id, tileId })
  return true
}

export function tendCrop(state, tileId) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  const f = state.farms[tileId]
  if (!canWork(state, tileId) || f.stage !== 'seeded') return false
  const cost = 180
  if (p.cash < cost) return false
  p.cash -= cost
  f.fertility = clamp(f.fertility + 0.12, 0.5, 2.2)
  log(state, `${p.name} weeds and tends ${CROPS[f.crop].name} at ${t.name} for Rs ${cost}.`, 'loss', { amount: cost, pid: p.id, tileId })
  state.phase = 'end'
  state.pending = null
  return true
}

export function harvest(state, tileId) {
  const p = currentPlayer(state)
  const t = TILES[tileId]
  const f = state.farms[tileId]
  if (!canWork(state, tileId) || f.stage !== 'ripe' || !f.crop) return false
  const crop = CROPS[f.crop]
  const w = state.weather
  let y = crop.yield * f.fertility * w.mod
  if (f.irrigated) y *= 1.2
  else {
    const waterFit = 1 - Math.abs(crop.water - w.water) * 0.5
    y *= clamp(waterFit, 0.45, 1.15)
    y *= 0.7 + crop.drought * 0.3
  }
  if (p.knowHow > 0) y *= 1.12
  if (groupOwned(state, p.id, t.group)) y *= 1.15
  const ownsSeed = state.infra[25] === p.id
  if (ownsSeed) y *= 1.08
  const vol = 1 + (rngNext(state) * 2 - 1) * crop.vol
  y *= vol
  let disaster = false
  if (w.id === 'hail' && (t.soil === 'hill' || t.group === 'orchard') && rngNext(state) < 0.35) {
    y *= 0.4
    disaster = true
    log(state, `Hail shredded part of the ${t.name} harvest.`, 'loss', { tileId })
  }
  if (w.id === 'flood' && t.soil === 'alluvial' && crop.water < 0.7) {
    y *= 0.7
    disaster = true
  }
  if (rngNext(state) < 0.16) {
    disaster = true
    if (f.insured) {
      log(state, `Pests hit ${t.name}; crop insurance covers the loss.`, 'gain', { amount: 800, pid: p.id, tileId })
      y *= 0.9
      p.cash += 800
    } else {
      y *= 0.45
      log(state, `Pests and blight cut the ${t.name} harvest.`, 'loss', { tileId })
    }
  }
  y = Math.max(0, y)
  let price = state.prices[crop.id] * state.marketMod
  if (p.enam > 0) price *= 1.05
  const ownsYard = state.infra[35] === p.id
  if (ownsYard) price *= 1.06
  const ownsTractor = state.infra[5] === p.id
  if (ownsTractor) y *= 1.06
  const ownsCold = state.infra[15] === p.id
  if (!ownsCold && rngNext(state) < 0.12) {
    y *= 0.75
    log(state, `Spoilage without cold storage at ${t.name}.`, 'loss', { tileId })
  }
  if (disaster && f.insured) {
    p.cash += 400
    log(state, `Insurance top-up Rs 400 at ${t.name}.`, 'gain', { amount: 400, pid: p.id, tileId })
  }
  let revenue = Math.round(y * price)
  const costBasis = crop.seed + t.prepare
  if (p.skipHarvestBonus) {
    revenue = Math.round(revenue * 0.85)
    p.skipHarvestBonus = false
  }
  const pnl = revenue - costBasis
  f.lastYield = Math.round(y * 10) / 10
  f.lastPnl = pnl
  p.cash += revenue
  log(state, `${p.name} harvests ${crop.name} at ${t.name}: ${f.lastYield} qtl @ Rs ${Math.round(price)} = Rs ${revenue} (${pnl >= 0 ? 'profit' : 'loss'} Rs ${Math.abs(pnl)}).`, pnl >= 0 ? 'gain' : 'loss', { amount: revenue, pnl, pid: p.id, tileId })
  f.stage = 'idle'
  f.crop = null
  f.prepared = false
  f.growLeft = 0
  f.fertility = clamp(f.fertility - 0.08, 0.5, 2)
  if (f.leasee === p.id && f.leaseTurns <= 1) {
    f.leasee = null
    f.leaseTurns = 0
  }
  state.phase = 'end'
  state.pending = null
  checkWin(state)
  return true
}

export function sellToFci(state) {
  const p = currentPlayer(state)
  const ripe = farmsOf(state, p.id).filter((f) => f.stage === 'ripe' || (f.stage === 'seeded' && f.growLeft <= 0))
  if (!ripe.length) {
    log(state, `${p.name} has no ready harvest for the food warehouse.`, 'info', { pid: p.id })
    state.phase = 'end'
    state.pending = null
    return false
  }
  ripe.forEach((f) => {
    f.stage = 'ripe'
    const crop = CROPS[f.crop]
    const msp = Math.round(state.prices[crop.id] * 1.1)
    const qty = Math.round(crop.yield * f.fertility * 0.9)
    const revenue = qty * msp
    p.cash += revenue
    f.lastYield = qty
    f.lastPnl = revenue - crop.seed
    log(state, `Warehouse lifts ${crop.name} from ${f.tile.name} at support price Rs ${msp} x ${qty} = Rs ${revenue}.`, 'gain', { amount: revenue, pid: p.id, tileId: f.id })
    f.stage = 'idle'
    f.crop = null
    f.prepared = false
  })
  state.phase = 'end'
  state.pending = null
  checkWin(state)
  return true
}

export function takeLoan(state) {
  const p = currentPlayer(state)
  if (p.debt >= LOAN_CAP) return false
  p.debt += LOAN_STEP
  p.cash += LOAN_STEP
  log(state, `${p.name} takes a rural bank crop loan of Rs ${LOAN_STEP}. Debt Rs ${p.debt}.`, 'gain', { amount: LOAN_STEP, pid: p.id })
  return true
}

export function repayLoan(state, amount) {
  const p = currentPlayer(state)
  const a = Math.min(amount, p.debt, p.cash)
  if (a <= 0) return false
  p.cash -= a
  p.debt -= a
  log(state, `${p.name} repays Rs ${a}. Remaining debt Rs ${p.debt}.`, 'loss', { amount: a, pid: p.id })
  return true
}

export function actingSeat(state) {
  if (!state || !state.pending) return state ? state.turn : 0
  if (state.pending.kind === 'auction') return state.pending.actor
  if (state.pending.kind === 'trade') return state.pending.to
  return state.turn
}

function lotLabel(tileId) {
  return TILES[tileId] ? TILES[tileId].name : 'the lot'
}

function lotPrice(tileId) {
  const t = TILES[tileId]
  return t && t.price ? t.price : 500
}

function nextAuctionActor(state, fromId, passed) {
  const n = state.players.length
  for (let i = 1; i <= n; i++) {
    const id = (fromId + i) % n
    const p = state.players[id]
    if (!p || p.bankrupt) continue
    if (passed.includes(id)) continue
    return id
  }
  return null
}

function awardLot(state, pid, tileId, map, price) {
  const p = state.players[pid]
  const t = TILES[tileId]
  if (!p || p.bankrupt || !t || p.cash < price) return false
  p.cash -= price
  if (map) {
    if (state[map][tileId] != null) return false
    state[map][tileId] = pid
  } else {
    const f = state.farms[tileId]
    if (!f || f.owner != null) return false
    f.owner = pid
    f.leasee = null
  }
  log(state, `${p.name} wins ${t.name} at auction for Rs ${price}.`, 'loss', { amount: price, pid, tileId })
  return true
}

function settleAuction(state) {
  const a = state.pending
  if (!a || a.kind !== 'auction') return false
  if (a.highBidder == null || a.highBid <= 0) {
    log(state, `No bid for ${lotLabel(a.tileId)}. It stays with Village Hall.`, 'info', { tileId: a.tileId })
    state.pending = null
    state.phase = 'end'
    return true
  }
  if (!awardLot(state, a.highBidder, a.tileId, a.map, a.highBid)) {
    log(state, `${state.players[a.highBidder].name} cannot pay the auction bid.`, 'info', { pid: a.highBidder })
    state.pending = null
    state.phase = 'end'
    return false
  }
  state.pending = null
  state.phase = 'end'
  return true
}

export function startAuction(state) {
  const pending = state.pending
  if (!pending) return false
  if (pending.kind !== 'acquire' && pending.kind !== 'buyInfra') return false
  const tileId = pending.tileId
  const t = TILES[tileId]
  if (!t) return false
  const map = pending.kind === 'buyInfra' ? pending.map : null
  if (map && state[map][tileId] != null) return false
  if (!map) {
    const f = state.farms[tileId]
    if (!f || f.owner != null) return false
  }
  const alive = state.players.filter((p) => !p.bankrupt)
  if (alive.length < 2) {
    state.pending = null
    state.phase = 'end'
    return true
  }
  const minBid = Math.max(100, Math.round(lotPrice(tileId) * 0.5 / 100) * 100)
  const passed = []
  const actor = nextAuctionActor(state, state.turn, passed)
  state.pending = {
    kind: 'auction',
    tileId,
    map,
    starter: state.turn,
    highBid: 0,
    highBidder: null,
    minBid,
    passed,
    actor
  }
  state.phase = 'action'
  log(state, `${t.name} goes to auction. Opening bid Rs ${minBid}.`, 'info', { tileId })
  return true
}

export function bidAuction(state, amount) {
  const a = state.pending
  if (!a || a.kind !== 'auction') return false
  const p = state.players[a.actor]
  if (!p || p.bankrupt) return false
  if (a.passed.includes(a.actor)) return false
  const bid = Math.round(Number(amount) || 0)
  const floor = a.highBid > 0 ? a.highBid + 100 : a.minBid
  if (bid < floor || bid % 100 !== 0) return false
  if (p.cash < bid) return false
  a.highBid = bid
  a.highBidder = a.actor
  log(state, `${p.name} bids Rs ${bid} on ${lotLabel(a.tileId)}.`, 'info', { amount: bid, pid: p.id, tileId: a.tileId })
  const next = nextAuctionActor(state, a.actor, a.passed)
  if (next == null || next === a.highBidder) return settleAuction(state)
  a.actor = next
  return true
}

export function passAuction(state) {
  const a = state.pending
  if (!a || a.kind !== 'auction') return false
  const p = state.players[a.actor]
  if (!p) return false
  if (!a.passed.includes(a.actor)) a.passed.push(a.actor)
  log(state, `${p.name} passes on ${lotLabel(a.tileId)}.`, 'info', { pid: p.id, tileId: a.tileId })
  const next = nextAuctionActor(state, a.actor, a.passed)
  if (next == null) return settleAuction(state)
  if (a.highBidder != null && next === a.highBidder) {
    const after = nextAuctionActor(state, next, a.passed)
    if (after == null || after === a.highBidder) return settleAuction(state)
  }
  a.actor = next
  return true
}

function ownedFarmId(state, pid, tileId) {
  const f = state.farms[tileId]
  return !!(f && f.owner === pid)
}

export function offerTrade(state, offer) {
  if (!state || state.phase === 'over') return false
  if (state.phase !== 'end' || state.pending) return false
  const from = currentPlayer(state)
  const to = state.players[Number(offer && offer.to)]
  if (!from || !to || from.id === to.id || from.bankrupt || to.bankrupt) return false
  const cashGive = Math.max(0, Math.round(Number(offer.cashGive) || 0))
  const cashTake = Math.max(0, Math.round(Number(offer.cashTake) || 0))
  const landGive = offer.landGive == null || offer.landGive === '' ? null : Number(offer.landGive)
  const landTake = offer.landTake == null || offer.landTake === '' ? null : Number(offer.landTake)
  const debtGive = Math.max(0, Math.round(Number(offer.debtGive) || 0))
  const debtTake = Math.max(0, Math.round(Number(offer.debtTake) || 0))
  if (!cashGive && !cashTake && landGive == null && landTake == null && !debtGive && !debtTake) return false
  if (cashGive && from.cash < cashGive) return false
  if (cashTake && to.cash < cashTake) return false
  if (landGive != null && !ownedFarmId(state, from.id, landGive)) return false
  if (landTake != null && !ownedFarmId(state, to.id, landTake)) return false
  if (debtGive && from.debt < debtGive) return false
  if (debtTake && to.debt < debtTake) return false
  if (debtGive && to.debt + debtGive > LOAN_CAP) return false
  if (debtTake && from.debt + debtTake > LOAN_CAP) return false
  state.pending = {
    kind: 'trade',
    from: from.id,
    to: to.id,
    cashGive,
    cashTake,
    landGive,
    landTake,
    debtGive,
    debtTake
  }
  state.phase = 'action'
  log(state, `${from.name} offers a deal to ${to.name}.`, 'info', { pid: from.id })
  return true
}

function applyTrade(state, deal) {
  const from = state.players[deal.from]
  const to = state.players[deal.to]
  if (deal.cashGive) {
    from.cash -= deal.cashGive
    to.cash += deal.cashGive
  }
  if (deal.cashTake) {
    to.cash -= deal.cashTake
    from.cash += deal.cashTake
  }
  if (deal.landGive != null) {
    state.farms[deal.landGive].owner = to.id
  }
  if (deal.landTake != null) {
    state.farms[deal.landTake].owner = from.id
  }
  if (deal.debtGive) {
    from.debt -= deal.debtGive
    to.debt += deal.debtGive
  }
  if (deal.debtTake) {
    to.debt -= deal.debtTake
    from.debt += deal.debtTake
  }
}

export function acceptTrade(state) {
  const deal = state.pending
  if (!deal || deal.kind !== 'trade') return false
  const from = state.players[deal.from]
  const to = state.players[deal.to]
  if (!from || !to || from.bankrupt || to.bankrupt) return false
  if (deal.cashGive && from.cash < deal.cashGive) return false
  if (deal.cashTake && to.cash < deal.cashTake) return false
  if (deal.landGive != null && !ownedFarmId(state, from.id, deal.landGive)) return false
  if (deal.landTake != null && !ownedFarmId(state, to.id, deal.landTake)) return false
  if (deal.debtGive && from.debt < deal.debtGive) return false
  if (deal.debtTake && to.debt < deal.debtTake) return false
  if (deal.debtGive && to.debt + deal.debtGive > LOAN_CAP) return false
  if (deal.debtTake && from.debt + deal.debtTake > LOAN_CAP) return false
  applyTrade(state, deal)
  log(state, `${to.name} accepts the deal with ${from.name}.`, 'gain', { pid: to.id })
  state.pending = null
  state.phase = 'end'
  checkWin(state)
  return true
}

export function rejectTrade(state) {
  const deal = state.pending
  if (!deal || deal.kind !== 'trade') return false
  const to = state.players[deal.to]
  log(state, `${to ? to.name : 'A farmer'} turns down the deal.`, 'info', { pid: deal.to })
  state.pending = null
  state.phase = 'end'
  return true
}

export function declineAction(state) {
  const pending = state.pending
  if (pending && pending.kind === 'auction') return passAuction(state)
  if (pending && pending.kind === 'trade') return rejectTrade(state)
  if (pending && (pending.kind === 'acquire' || pending.kind === 'buyInfra')) {
    return startAuction(state)
  }
  state.pending = null
  state.phase = 'end'
  return true
}

export function skipTurn(state, reason = 'did not act in time') {
  if (state.phase === 'over') return state
  const pending = state.pending
  if (pending && (pending.kind === 'auction' || pending.kind === 'trade' || pending.kind === 'acquire' || pending.kind === 'buyInfra')) {
    const actor = actingSeat(state)
    const name = state.players[actor] ? state.players[actor].name : currentPlayer(state).name
    log(state, `${name} ${reason}.`, 'info', { pid: actor, skip: true })
    declineAction(state)
    return state
  }
  const p = currentPlayer(state)
  if (pending) declineAction(state)
  log(state, `${p.name} ${reason}. Turn passes.`, 'info', { pid: p.id, skip: true })
  return nextTurn(state)
}

export function nextTurn(state) {
  if (state.phase === 'over') return state
  const alive = state.players.filter((p) => !p.bankrupt)
  if (alive.length <= 1) {
    if (alive.length === 1) {
      state.winner = alive[0].id
      state.phase = 'over'
      log(state, `${alive[0].name} is the Harvest King of the board.`, 'gain', { pid: alive[0].id })
    } else {
      finishByNet(state)
      if (state.phase !== 'over') state.phase = 'over'
    }
    return state
  }
  const n = state.players.length
  for (let i = 0; i < n; i++) {
    state.turn = (state.turn + 1) % n
    if (!state.players[state.turn].bankrupt) break
  }
  if (state.players[state.turn].bankrupt) {
    finishByNet(state)
    return state
  }
  growCrops(state, state.players[state.turn])
  state.phase = 'roll'
  state.pending = null
  state.doubles = 0
  state.labourUsed = false
  return state
}

export function openFarmWork(state, tileId) {
  const p = currentPlayer(state)
  const f = state.farms[tileId]
  if (!f || (f.owner !== p.id && f.leasee !== p.id)) return false
  if (state.pending && state.pending.kind === 'pickFarm') {
    state.pending = { kind: 'farmWork', tileId }
    state.phase = 'action'
    return true
  }
  if (state.phase === 'end' && !state.labourUsed) {
    state.labourUsed = true
    state.pending = { kind: 'farmWork', tileId }
    state.phase = 'action'
    return true
  }
  return false
}

function growCrops(state, p) {
  Object.entries(state.farms).forEach(([id, f]) => {
    if ((f.owner === p.id || f.leasee === p.id) && f.stage === 'seeded') {
      f.growLeft -= 1
      if (f.growLeft <= 0) {
        f.stage = 'ripe'
        log(state, `${CROPS[f.crop].name} is ripe at ${TILES[id].name}.`, 'grow', { pid: p.id, tileId: Number(id) })
      }
    }
  })
}

function checkWin(state) {
  if (state.winner != null) return
  state.players.forEach((p) => {
    if (!p.bankrupt && netWorth(state, p) >= (state.winNet || WIN_NET)) {
      state.winner = p.id
      state.phase = 'over'
      log(state, `${p.name} becomes Harvest King with net worth Rs ${netWorth(state, p)}.`, 'gain', { pid: p.id })
    }
  })
}

function finishByNet(state) {
  let best = null
  let bestV = -Infinity
  state.players.forEach((p) => {
    if (p.bankrupt) return
    const v = netWorth(state, p)
    if (v > bestV) {
      bestV = v
      best = p.id
    }
  })
  if (best != null) {
    state.winner = best
    state.phase = 'over'
    log(state, `Seasons end. ${state.players[best].name} is Harvest King with Rs ${bestV}.`, 'gain', { pid: best })
  }
}

export function unmortgage(state, tileId) {
  const p = currentPlayer(state)
  const f = state.farms[tileId]
  const t = TILES[tileId]
  if (f.owner !== p.id || !f.mortgaged) return false
  const cost = Math.round(t.price * 0.55)
  if (p.cash < cost) return false
  p.cash -= cost
  f.mortgaged = false
  log(state, `${p.name} redeems ${t.name} for Rs ${cost}.`, 'loss', { amount: cost, pid: p.id, tileId })
  return true
}

export { GROUPS, TILES, CROPS, clone }
