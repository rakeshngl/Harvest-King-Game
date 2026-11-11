import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGame, harvest, forcePay, transfer, buyFarm, prepareLand, seedLand, skipTurn,
  nextTurn, netWorth, applyMove, takeLoan, sellToFci, declineAction, bidAuction, passAuction,
  offerTrade, acceptTrade, rejectTrade, actingSeat, finalStandings, presetById, rollDice, LOG_CAP,
  raiseLot, giveUpRaise, mortgageFarm, fireSale, raisableLots, mortgageValue, chooseLabour,
  harvestQuote, readyHarvestLots, irrigate, insure
} from '../src/engine.js'
import { START_CASH, WIN_NET, PASS_GO, WEATHER, WEATHER_WEIGHTS, TILES, CROPS, INTEREST, SEASON_PRESETS, DEFAULT_PRESET, KISAN_CARDS } from '../src/data.js'
import { dailySeed } from '../src/rng.js'

const FAIR = WEATHER.find((w) => w.id === 'normal')

function stubRandom(state, value) {
  const orig = state._rng
  state._rng = () => value
  return () => { state._rng = orig }
}

function soilWeather(t, f, w, y) {
  if (w.id === 'drought' && !f.irrigated) {
    if (t.soil === 'black') return y * 1.1
    if (t.soil === 'red' || t.soil === 'laterite') return y * 0.9
    if (t.soil === 'arid') return y * 0.85
  }
  if (w.id === 'hail' && t.soil === 'hill') return y * 0.85
  return y
}

function expectedHarvest(state, tileId) {
  const f = state.farms[tileId]
  const crop = CROPS[f.crop]
  const w = state.weather
  let y = crop.yield * f.fertility * w.mod
  if (f.irrigated) y *= 1.2
  else {
    y *= Math.max(0.45, Math.min(1.15, 1 - Math.abs(crop.water - w.water) * 0.5))
    y *= 0.7 + crop.drought * 0.3
  }
  y = soilWeather(TILES[tileId], f, w, y)
  const p = state.players[state.turn]
  if (p.organic > 0 && (TILES[tileId].group === 'spice' || tileId === 39)) y *= 1.1
  const vol = 1 + (0.5 * 2 - 1) * crop.vol
  y *= vol
  return Math.round(Math.max(0, y) * state.prices[crop.id])
}

function ripeField(state, tileId, cropId) {
  const f = state.farms[tileId]
  f.owner = state.turn
  f.stage = 'ripe'
  f.crop = cropId
  f.fertility = 1
  f.irrigated = false
  f.insured = false
  return f
}

function kisanCard(id) {
  return KISAN_CARDS.find((c) => c.id === id)
}

function drawKisan(state, id) {
  state.kisan = [kisanCard(id)]
  state.kisanI = 0
  state.players[0].pos = 0
  applyMove(state, [1, 1])
  return state
}

test('new game seats farmers with village cash', () => {
  const s = createGame(2, ['A', 'B'])
  assert.equal(s.players.length, 2)
  assert.equal(s.players[0].cash, START_CASH)
  assert.equal(s.phase, 'roll')
  assert.equal(s.turn, 0)
  assert.equal(s.doubles, undefined)
  assert.equal(netWorth(s, s.players[0]), START_CASH)
})

test('buy prepare sow then harvest pays yield times price', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.weather = FAIR
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  assert.equal(buyFarm(s, 1), true)
  assert.equal(prepareLand(s, 1), true)
  assert.equal(seedLand(s, 1, 'bajra'), true)
  s.farms[1].stage = 'ripe'
  s.farms[1].growLeft = 0
  const revenue = expectedHarvest(s, 1)
  const before = s.players[0].cash
  assert.equal(harvest(s, 1), true)
  restore()
  assert.equal(s.players[0].cash, before + revenue)
  assert.equal(s.farms[1].stage, 'idle')
  assert.equal(s.farms[1].crop, null)
  assert.equal(s.farms[1].irrigated, false)
  assert.equal(s.farms[1].insured, false)
  assert.equal(s.phase, 'end')
})

test('harvest uses listed prices without multiplying marketMod again', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.weather = FAIR
  s.marketMod = 1.2
  s.prices.bajra = Math.round(CROPS.bajra.price * 1.2)
  ripeField(s, 1, 'bajra')
  const revenue = expectedHarvest(s, 1)
  const doubled = Math.round(revenue * s.marketMod)
  const before = s.players[0].cash
  assert.equal(harvest(s, 1), true)
  restore()
  assert.equal(s.players[0].cash, before + revenue)
  assert.notEqual(s.players[0].cash, before + doubled)
})

test('forcePay opens a raise instead of auto-mortgaging idle land', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.players[0].cash = 100
  const ok = forcePay(s, s.players[0], 700, 'Land Revenue')
  assert.equal(ok, false)
  assert.equal(s.pending.kind, 'raise')
  assert.equal(s.pending.pid, 0)
  assert.equal(s.pending.amount, 700)
  assert.equal(s.farms[1].mortgaged, false)
  assert.equal(s.players[0].cash, 100)
  assert.equal(actingSeat(s), 0)
  assert.equal(raiseLot(s, 1), true)
  assert.equal(s.farms[1].mortgaged, true)
  assert.equal(s.players[0].bankrupt, false)
  assert.equal(s.players[0].cash, 0)
  assert.equal(s.pending, null)
  assert.equal(s.phase, 'end')
})

test('forcePay with no assets marks insolvent and crowns the rival', () => {
  const s = createGame(2, ['A', 'B'])
  s.players[0].cash = 40
  const ok = forcePay(s, s.players[0], 800, 'Land Revenue')
  assert.equal(ok, false)
  assert.equal(s.players[0].bankrupt, true)
  assert.equal(s.players[0].cash, 0)
  assert.equal(s.winner, 1)
  assert.equal(s.phase, 'over')
})

test('insolvency returns owned land to the village', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.farms[1].stage = 'prepared'
  s.players[0].cash = 0
  forcePay(s, s.players[0], 800, 'Market Tax')
  assert.equal(s.pending.kind, 'raise')
  giveUpRaise(s)
  assert.equal(s.players[0].bankrupt, true)
  assert.equal(s.farms[1].owner, null)
  assert.equal(s.farms[1].stage, 'idle')
})

test('net worth at WIN_NET after harvest ends the match', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.weather = FAIR
  s.marketMod = 1
  ripeField(s, 1, 'bajra')
  s.players[0].cash = WIN_NET
  harvest(s, 1)
  restore()
  assert.equal(s.winner, 0)
  assert.equal(s.phase, 'over')
})

test('tax takes the greater of the flat fee and the cash percent', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.players[0].pos = 0
  s.players[0].cash = 12000
  applyMove(s, [2, 2])
  restore()
  assert.equal(s.players[0].pos, 4)
  assert.equal(s.players[0].cash, 12000 - 960)
  s.players[0].pos = 0
  s.players[0].cash = 5000
  applyMove(s, [2, 2])
  assert.equal(s.players[0].cash, 5000 - 800)
})

test('passing Village Hall pays harvest dues', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.players[0].pos = 38
  const cash = s.players[0].cash
  applyMove(s, [1, 1])
  restore()
  assert.equal(s.players[0].pos, 0)
  assert.ok(s.players[0].cash >= cash + PASS_GO)
})

test('skipTurn on acquire opens an auction without passing the seat', () => {
  const s = createGame(2, ['A', 'B'])
  s.pending = { kind: 'acquire', tileId: 1 }
  s.phase = 'action'
  skipTurn(s)
  assert.equal(s.turn, 0)
  assert.equal(s.pending.kind, 'auction')
  assert.equal(s.pending.tileId, 1)
  assert.equal(s.phase, 'action')
})

test('walk-on starts an auction and a bid awards the lot', () => {
  const s = createGame(2, ['A', 'B'])
  s.pending = { kind: 'acquire', tileId: 1 }
  s.phase = 'action'
  assert.equal(declineAction(s), true)
  assert.equal(s.pending.kind, 'auction')
  assert.equal(actingSeat(s), 1)
  const floor = s.pending.minBid
  assert.equal(bidAuction(s, floor), true)
  assert.equal(actingSeat(s), 0)
  assert.equal(passAuction(s), true)
  assert.equal(s.farms[1].owner, 1)
  assert.equal(s.players[1].cash, START_CASH - floor)
  assert.equal(s.pending, null)
  assert.equal(s.phase, 'end')
})

test('current player auction win opens farmWork', () => {
  const s = createGame(2, ['A', 'B'])
  s.pending = { kind: 'acquire', tileId: 1 }
  s.phase = 'action'
  declineAction(s)
  assert.equal(passAuction(s), true)
  const floor = s.pending.minBid
  assert.equal(bidAuction(s, floor + 200), true)
  assert.equal(s.farms[1].owner, 0)
  assert.equal(s.players[0].cash, START_CASH - floor - 200)
  assert.equal(s.pending.kind, 'farmWork')
  assert.equal(s.pending.tileId, 1)
  assert.equal(s.phase, 'action')
})

test('infra auction win ends the turn', () => {
  const s = createGame(2, ['A', 'B'])
  s.pending = { kind: 'buyInfra', tileId: 5, map: 'infra' }
  s.phase = 'action'
  declineAction(s)
  assert.equal(passAuction(s), true)
  const floor = s.pending.minBid
  assert.equal(bidAuction(s, floor), true)
  assert.equal(s.infra[5], 0)
  assert.equal(s.pending, null)
  assert.equal(s.phase, 'end')
})

test('all passes leave the lot with Village Hall', () => {
  const s = createGame(2, ['A', 'B'])
  s.pending = { kind: 'acquire', tileId: 1 }
  s.phase = 'action'
  declineAction(s)
  assert.equal(passAuction(s), true)
  assert.equal(passAuction(s), true)
  assert.equal(s.farms[1].owner, null)
  assert.equal(s.pending, null)
  assert.equal(s.phase, 'end')
})

test('trade swaps cash and land after accept', () => {
  const s = createGame(2, ['A', 'B'])
  s.phase = 'end'
  s.farms[1].owner = 0
  s.farms[3].owner = 1
  assert.equal(offerTrade(s, { to: 1, cashGive: 500, landGive: 1, landTake: 3 }), true)
  assert.equal(s.pending.kind, 'trade')
  assert.equal(actingSeat(s), 1)
  assert.equal(acceptTrade(s), true)
  assert.equal(s.farms[1].owner, 1)
  assert.equal(s.farms[3].owner, 0)
  assert.equal(s.players[0].cash, START_CASH - 500)
  assert.equal(s.players[1].cash, START_CASH + 500)
  assert.equal(s.phase, 'end')
})

test('rejectTrade returns to the end phase', () => {
  const s = createGame(2, ['A', 'B'])
  s.phase = 'end'
  s.farms[1].owner = 0
  offerTrade(s, { to: 1, landGive: 1 })
  assert.equal(rejectTrade(s), true)
  assert.equal(s.farms[1].owner, 0)
  assert.equal(s.pending, null)
  assert.equal(s.phase, 'end')
})

test('nextTurn ripens a one-season crop', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 1
  s.farms[1].stage = 'seeded'
  s.farms[1].crop = 'bajra'
  s.farms[1].growLeft = 1
  nextTurn(s)
  assert.equal(s.turn, 1)
  assert.equal(s.farms[1].stage, 'ripe')
})

test('crop loan adds INTEREST when a season ticks', () => {
  const s = createGame(2, ['A', 'B'])
  assert.equal(takeLoan(s), true)
  const debt = s.players[0].debt
  const restore = stubRandom(s, 0.5)
  s.phase = 'end'
  nextTurn(s)
  assert.equal(s.turn, 1)
  assert.equal(s.seasonIndex, 0)
  assert.equal(s.players[0].debt, debt)
  nextTurn(s)
  restore()
  assert.equal(s.turn, 0)
  assert.equal(s.seasonIndex, 1)
  assert.equal(s.players[0].debt, debt + Math.round(debt * INTEREST))
})

test('owned farm counts toward net worth until mortgaged', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  const withLand = netWorth(s, s.players[0])
  assert.equal(withLand, START_CASH + TILES[1].price)
  s.farms[1].mortgaged = true
  assert.equal(netWorth(s, s.players[0]), START_CASH)
})

test('finalStandings ranks by net worth and flags the winner', () => {
  const s = createGame(3, ['A', 'B', 'C'])
  s.phase = 'over'
  s.farms[1].owner = 2
  s.players[1].bankrupt = true
  s.players[1].cash = 0
  s.players[1].debt = 0
  const rows = finalStandings(s)
  assert.equal(rows[2].rank, 1)
  assert.equal(rows[2].won, true)
  assert.equal(rows[0].rank, 2)
  assert.equal(rows[0].won, false)
  assert.equal(rows[1].bankrupt, true)
  assert.equal(rows[1].rank, 3)
})

test('finalStandings honours an explicit winner over raw net worth', () => {
  const s = createGame(2, ['A', 'B'])
  s.phase = 'over'
  s.farms[1].owner = 1
  s.winner = 0
  const rows = finalStandings(s)
  assert.equal(rows[0].won, true)
  assert.equal(rows[1].won, false)
  assert.equal(rows[1].rank, 1)
})

test('createGame stores classic preset by default', () => {
  const s = createGame(2, ['A', 'B'])
  const classic = presetById(DEFAULT_PRESET)
  assert.equal(s.preset, classic.id)
  assert.equal(s.maxSeasons, classic.seasons)
  assert.equal(s.winNet, classic.winNet)
})

test('createGame applies short and long presets', () => {
  for (const p of SEASON_PRESETS) {
    const s = createGame(2, ['A', 'B'], { preset: p.id })
    assert.equal(s.preset, p.id)
    assert.equal(s.maxSeasons, p.seasons)
    assert.equal(s.winNet, p.winNet)
  }
})

test('short preset ends the match after 12 seasons', () => {
  const s = createGame(2, ['A', 'B'], { preset: 'short' })
  s.seasonIndex = 11
  s.turn = 1
  s.phase = 'end'
  const restore = stubRandom(s, 0.5)
  nextTurn(s)
  restore()
  assert.equal(s.phase, 'over')
  assert.equal(s.winner, 0)
})

test('classic preset does not end after 12 seasons', () => {
  const s = createGame(2, ['A', 'B'])
  s.seasonIndex = 11
  s.turn = 1
  s.phase = 'end'
  const restore = stubRandom(s, 0.5)
  nextTurn(s)
  restore()
  assert.notEqual(s.phase, 'over')
  assert.equal(s.seasonIndex, 12)
  assert.equal(s.turn, 0)
})

test('passing Village Hall does not tick the season', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.players[0].pos = 38
  applyMove(s, [1, 1])
  restore()
  assert.equal(s.seasonIndex, 0)
  assert.equal(s.players[0].pos, 0)
})

test('harvest clears irrigation and insurance', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.weather = FAIR
  ripeField(s, 1, 'bajra')
  s.farms[1].irrigated = true
  s.farms[1].insured = true
  assert.equal(harvest(s, 1), true)
  restore()
  assert.equal(s.farms[1].irrigated, false)
  assert.equal(s.farms[1].insured, false)
})

test('irrigation lasts until the crop is cleared', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.farms[1].stage = 'seeded'
  s.farms[1].crop = 'bajra'
  s.farms[1].growLeft = 2
  s.farms[1].irrigated = true
  s.farms[1].insured = true
  s.phase = 'end'
  nextTurn(s)
  assert.equal(s.farms[1].irrigated, true)
  assert.equal(s.farms[1].insured, true)
})

test('idle land cannot be irrigated or insured', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.farms[1].stage = 'idle'
  assert.equal(irrigate(s, 1), false)
  assert.equal(insure(s, 1), false)
  assert.equal(s.farms[1].irrigated, false)
  assert.equal(s.farms[1].insured, false)
  s.farms[1].stage = 'prepared'
  assert.equal(irrigate(s, 1), false)
  assert.equal(insure(s, 1), false)
})

test('seeded land can be irrigated and insured', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.farms[1].stage = 'seeded'
  s.farms[1].crop = 'bajra'
  s.farms[1].growLeft = 1
  const cash = s.players[0].cash
  assert.equal(irrigate(s, 1), true)
  assert.equal(insure(s, 1), true)
  assert.equal(s.farms[1].irrigated, true)
  assert.equal(s.farms[1].insured, true)
  assert.equal(s.players[0].cash, cash - 900 - 600)
})

test('mortgage clears idle irrigation and insurance', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.farms[1].stage = 'idle'
  s.farms[1].irrigated = true
  s.farms[1].insured = true
  assert.equal(mortgageFarm(s, 1), true)
  assert.equal(s.farms[1].irrigated, false)
  assert.equal(s.farms[1].insured, false)
})

test('village lease expiry clears idle irrigation and insurance', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.farms[1].leasee = 0
  s.farms[1].leaseTurns = 1
  s.farms[1].stage = 'idle'
  s.farms[1].irrigated = true
  s.farms[1].insured = true
  s.players[0].pos = 38
  applyMove(s, [1, 1])
  restore()
  assert.equal(s.farms[1].leasee, null)
  assert.equal(s.farms[1].irrigated, false)
  assert.equal(s.farms[1].insured, false)
})

test('sellToFci clears irrigation and insurance', () => {
  const s = createGame(2, ['A', 'B'])
  ripeField(s, 1, 'bajra')
  s.farms[1].irrigated = true
  s.farms[1].insured = true
  assert.equal(sellToFci(s), true)
  assert.equal(s.farms[1].stage, 'idle')
  assert.equal(s.farms[1].crop, null)
  assert.equal(s.farms[1].irrigated, false)
  assert.equal(s.farms[1].insured, false)
})

test('sellToFci uses harvest modifiers minus luck and drops fertility', () => {
  const s = createGame(2, ['A', 'B'])
  s.weather = FAIR
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  ripeField(s, 1, 'bajra')
  s.farms[1].irrigated = true
  const quote = harvestQuote(s, 1, 'fci', 0)
  const open = harvestQuote(s, 1, 'open', 0)
  const before = s.players[0].cash
  assert.equal(sellToFci(s), true)
  assert.equal(s.players[0].cash, before + quote.revenue)
  assert.ok(quote.revenue > open.revenue)
  assert.equal(s.farms[1].fertility, 0.92)
  assert.equal(readyHarvestLots(s, 0).length, 0)
})

test('open harvest quote matches expected yield without luck', () => {
  const s = createGame(2, ['A', 'B'])
  s.weather = FAIR
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  ripeField(s, 1, 'bajra')
  const quote = harvestQuote(s, 1, 'open', 0)
  assert.equal(quote.revenue, expectedHarvest(s, 1))
})

test('black soil holds drought better than red, laterite, or arid', () => {
  const s = createGame(2, ['A', 'B'])
  s.weather = WEATHER.find((w) => w.id === 'drought')
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  function qty(tileId) {
    for (const f of Object.values(s.farms)) f.owner = null
    ripeField(s, tileId, 'bajra')
    return harvestQuote(s, tileId, 'open', 0).qty
  }
  const black = qty(3)
  const red = qty(9)
  const laterite = qty(21)
  const arid = qty(1)
  const alluvial = qty(13)
  assert.ok(black > alluvial)
  assert.ok(red < alluvial)
  assert.equal(red, laterite)
  assert.ok(arid < red)
})

test('irrigation skips drought soil cuts', () => {
  const s = createGame(2, ['A', 'B'])
  s.weather = WEATHER.find((w) => w.id === 'drought')
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  ripeField(s, 3, 'bajra')
  s.farms[3].irrigated = true
  ripeField(s, 9, 'bajra')
  s.farms[9].irrigated = true
  assert.equal(harvestQuote(s, 3, 'open', 0).qty, harvestQuote(s, 9, 'open', 0).qty)
})

test('hill soil takes an extra hail cut', () => {
  const s = createGame(2, ['A', 'B'])
  s.weather = WEATHER.find((w) => w.id === 'hail')
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  ripeField(s, 19, 'bajra')
  const hill = harvestQuote(s, 19, 'open', 0).qty
  ripeField(s, 13, 'bajra')
  const alluvial = harvestQuote(s, 13, 'open', 0).qty
  assert.ok(hill < alluvial)
})

function wrapSeason(state) {
  state.turn = state.players.length - 1
  state.phase = 'end'
  nextTurn(state)
}

test('organic card sets a lasting counter instead of cash', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[21].owner = 0
  s.farms[1].owner = 0
  const before = s.players[0].cash
  drawKisan(s, 'organic')
  assert.equal(s.players[0].organic, 2)
  assert.equal(s.players[0].cash, before)
  assert.equal(s.pending.card.id, 'organic')
})

test('organic premium lifts spice harvest not millet', () => {
  const s = createGame(2, ['A', 'B'])
  s.weather = FAIR
  s.marketMod = 1
  s.prices.bajra = CROPS.bajra.price
  s.prices.spices = CROPS.spices.price
  ripeField(s, 21, 'spices')
  ripeField(s, 1, 'bajra')
  const spice = harvestQuote(s, 21, 'open', 0).qty
  const millet = harvestQuote(s, 1, 'open', 0).qty
  s.players[0].organic = 2
  assert.ok(harvestQuote(s, 21, 'open', 0).qty > spice)
  assert.equal(harvestQuote(s, 1, 'open', 0).qty, millet)
})

test('organic cert adds net worth on spice and Sikkim land', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[21].owner = 0
  s.farms[1].owner = 0
  const base = netWorth(s, s.players[0])
  s.players[0].organic = 2
  assert.equal(netWorth(s, s.players[0]), base + 400)
  s.farms[39].owner = 0
  assert.equal(netWorth(s, s.players[0]), base + 800 + TILES[39].price)
})

test('organic counter ticks down with the season', () => {
  const s = createGame(2, ['A', 'B'], { seasons: 24, winNet: 999999 })
  s.players[0].organic = 2
  const restore = stubRandom(s, 0.5)
  wrapSeason(s)
  restore()
  assert.equal(s.players[0].organic, 1)
})

test('Vidarbha cotton, Shimla hill, Baghpat gangetic', () => {
  assert.equal(TILES[8].group, 'cotton')
  assert.equal(TILES[19].group, 'hill')
  assert.equal(TILES[11].group, 'gangetic')
})

test('season weights cover every weather id', () => {
  for (const season of ['kharif', 'rabi', 'zaid']) {
    const weights = WEATHER_WEIGHTS[season]
    assert.ok(weights)
    for (const w of WEATHER) assert.ok(weights[w.id] > 0)
  }
})

test('a zero roll always picks fair skies', () => {
  const s = createGame(2, ['A', 'B'], { seasons: 24, winNet: 999999 })
  const restore = stubRandom(s, 0)
  wrapSeason(s)
  restore()
  assert.equal(s.weather.id, 'normal')
})

test('kharif leans monsoon, rabi hail, zaid drought', () => {
  const tally = { kharif: {}, rabi: {}, zaid: {} }
  for (const season of Object.keys(tally)) {
    for (const w of WEATHER) tally[season][w.id] = 0
  }
  for (let seed = 1; seed <= 120; seed++) {
    const s = createGame(2, ['A', 'B'], { seed, seasons: 24, winNet: 999999 })
    wrapSeason(s)
    tally.rabi[s.weather.id] += 1
    wrapSeason(s)
    tally.zaid[s.weather.id] += 1
    wrapSeason(s)
    tally.kharif[s.weather.id] += 1
  }
  assert.ok(tally.kharif.monsoon > tally.kharif.hail)
  assert.ok(tally.kharif.monsoon > tally.kharif.drought)
  assert.ok(tally.rabi.hail > tally.rabi.flood)
  assert.ok(tally.rabi.hail > tally.rabi.monsoon)
  assert.ok(tally.zaid.drought > tally.zaid.monsoon)
  assert.ok(tally.zaid.drought > tally.zaid.flood)
})

test('short preset crowns a farmer at the lower winNet', () => {
  const s = createGame(2, ['A', 'B'], { preset: 'short' })
  const restore = stubRandom(s, 0.5)
  s.weather = FAIR
  s.marketMod = 1
  ripeField(s, 1, 'bajra')
  s.players[0].cash = 55000
  harvest(s, 1)
  restore()
  assert.equal(s.winner, 0)
  assert.equal(s.phase, 'over')
})

test('classic winNet is not reached at the short target', () => {
  const s = createGame(2, ['A', 'B'])
  const restore = stubRandom(s, 0.5)
  s.weather = FAIR
  s.marketMod = 1
  ripeField(s, 1, 'bajra')
  s.players[0].cash = 55000
  harvest(s, 1)
  restore()
  assert.equal(s.winner, null)
  assert.notEqual(s.phase, 'over')
})

test('farmer deck reshuffles after a full pass', () => {
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.kisan = [kisanCard('pmkisan'), kisanCard('subsidy')]
  s.kisanI = 0
  s.players[0].pos = 0
  applyMove(s, [1, 1])
  assert.equal(s.kisanI, 1)
  s.phase = 'roll'
  s.pending = null
  s.players[0].pos = 0
  applyMove(s, [1, 1])
  assert.equal(s.kisanI, 2)
  s.phase = 'roll'
  s.pending = null
  s.players[0].pos = 0
  applyMove(s, [1, 1])
  assert.equal(s.kisanI, 1)
  assert.equal(s.kisan.length, 2)
  assert.ok(s.log.some((row) => row.text === 'The Farmer Card deck is shuffled.'))
})

test('market deck reshuffles after a full pass', () => {
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.mandi = s.mandi.slice(0, 2)
  s.mandiI = 0
  s.players[0].pos = 5
  applyMove(s, [1, 1])
  assert.equal(s.mandiI, 1)
  s.phase = 'roll'
  s.pending = null
  s.players[0].pos = 5
  applyMove(s, [1, 1])
  assert.equal(s.mandiI, 2)
  s.phase = 'roll'
  s.pending = null
  s.players[0].pos = 5
  applyMove(s, [1, 1])
  assert.equal(s.mandiI, 1)
  assert.equal(s.mandi.length, 2)
  assert.ok(s.log.some((row) => row.text === 'The Market Prices deck is shuffled.'))
})

test('the same daily seed shuffles the same decks', () => {
  const a = createGame(2, ['A', 'B'], { daily: '2026-10-18' })
  const b = createGame(2, ['A', 'B'], { daily: '2026-10-18' })
  assert.equal(a.daily, '2026-10-18')
  assert.equal(a.seed, dailySeed('2026-10-18'))
  assert.deepEqual(a.kisan.map((c) => c.id), b.kisan.map((c) => c.id))
  assert.deepEqual(a.mandi.map((c) => c.id), b.mandi.map((c) => c.id))
})

test('a different daily seed shuffles a different farmer deck', () => {
  const a = createGame(2, ['A', 'B'], { daily: '2026-10-18' })
  const b = createGame(2, ['A', 'B'], { daily: '2026-10-19' })
  assert.notDeepEqual(a.kisan.map((c) => c.id), b.kisan.map((c) => c.id))
})

test('transfer after a mortgage pays the owner the full rent', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.players[0].cash = 500
  s.players[1].cash = 100
  transfer(s, s.players[0], s.players[1], 1000, 'crossing Barmer Millet')
  assert.equal(s.pending.kind, 'raise')
  assert.equal(s.pending.to, 1)
  assert.equal(raiseLot(s, 1), true)
  assert.equal(s.players[0].bankrupt, false)
  assert.equal(s.farms[1].mortgaged, true)
  assert.equal(s.players[0].cash, 100)
  assert.equal(s.players[1].cash, 1100)
})

test('transfer that bankrupts the payer does not credit the owner', () => {
  const s = createGame(2, ['A', 'B'])
  s.players[0].cash = 40
  s.players[1].cash = 500
  transfer(s, s.players[0], s.players[1], 800, 'crossing Barmer Millet')
  assert.equal(s.players[0].bankrupt, true)
  assert.equal(s.players[1].cash, 500)
})

test('sellToFci crowns a farmer who crosses winNet', () => {
  const s = createGame(2, ['A', 'B'])
  ripeField(s, 1, 'bajra')
  s.players[0].cash = WIN_NET
  assert.equal(sellToFci(s), true)
  assert.equal(s.winner, 0)
  assert.equal(s.phase, 'over')
})

test('numeric seeds replay the same harvest luck', () => {
  const a = createGame(2, ['A', 'B'], { seed: 42 })
  const b = createGame(2, ['A', 'B'], { seed: 42 })
  ripeField(a, 1, 'bajra')
  ripeField(b, 1, 'bajra')
  a.weather = FAIR
  b.weather = FAIR
  a.marketMod = 1
  b.marketMod = 1
  harvest(a, 1)
  harvest(b, 1)
  assert.equal(a.players[0].cash, b.players[0].cash)
  assert.equal(a.farms[1].lastYield, b.farms[1].lastYield)
})

test('mortgageFarm can pledge a ripe field and wipes the crop', () => {
  const s = createGame(2, ['A', 'B'])
  ripeField(s, 1, 'bajra')
  const before = s.players[0].cash
  assert.equal(mortgageFarm(s, 1), true)
  assert.equal(s.farms[1].mortgaged, true)
  assert.equal(s.farms[1].stage, 'idle')
  assert.equal(s.farms[1].crop, null)
  assert.equal(s.players[0].cash, before + mortgageValue(1))
})

test('fire-sale returns a yard to the village', () => {
  const s = createGame(2, ['A', 'B'])
  s.infra[5] = 0
  s.players[0].cash = 0
  assert.deepEqual(raisableLots(s, 0).map((l) => l.tileId), [5])
  assert.equal(fireSale(s, 5), true)
  assert.equal(s.infra[5], undefined)
  assert.equal(s.players[0].cash, mortgageValue(5))
})

test('skipTurn on a raise gives up the lands', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.players[0].cash = 0
  forcePay(s, s.players[0], 800, 'Land Revenue')
  assert.equal(s.pending.kind, 'raise')
  skipTurn(s)
  assert.equal(s.players[0].bankrupt, true)
  assert.equal(s.farms[1].owner, null)
  assert.equal(s.winner, 1)
})

test('hail uses live prices and leaves the crop', () => {
  const s = createGame(2, ['A', 'B'])
  ripeField(s, 1, 'bajra')
  s.prices.bajra = 80
  const before = s.players[0].cash
  const loss = Math.round(CROPS.bajra.yield * 80 * 0.5)
  drawKisan(s, 'hail')
  assert.equal(s.players[0].cash, before - loss)
  assert.equal(s.farms[1].stage, 'ripe')
  assert.equal(s.farms[1].crop, 'bajra')
  assert.equal(s.pending.kind, 'card')
  assert.equal(s.pending.card.id, 'hail')
})

test('pest charges uninsured fields through forcePay and skips insured', () => {
  const s = createGame(2, ['A', 'B'])
  ripeField(s, 1, 'bajra')
  ripeField(s, 3, 'jowar')
  s.farms[3].insured = true
  const before = s.players[0].cash
  drawKisan(s, 'pest')
  assert.equal(s.players[0].cash, before - 700)
  assert.equal(s.farms[1].stage, 'ripe')
  assert.equal(s.farms[3].stage, 'ripe')
  assert.ok(s.log.some((e) => /Crop insurance covers 1 field against pests/.test(e.text)))
})

test('pest with short cash opens a raise instead of wiping the crop', () => {
  const s = createGame(2, ['A', 'B'])
  ripeField(s, 1, 'bajra')
  s.players[0].cash = 100
  drawKisan(s, 'pest')
  assert.equal(s.pending.kind, 'raise')
  assert.equal(s.farms[1].stage, 'ripe')
  assert.equal(s.farms[1].crop, 'bajra')
})

test('labour shortage is a hire-or-skip choice', () => {
  const s = createGame(2, ['A', 'B'])
  const before = s.players[0].cash
  drawKisan(s, 'labour')
  assert.equal(s.pending.kind, 'labour')
  assert.equal(s.pending.amount, 600)
  assert.equal(s.players[0].cash, before)
  assert.equal(chooseLabour(s, true), true)
  assert.equal(s.players[0].cash, before - 600)
  assert.equal(s.pending.kind, 'card')
  assert.equal(s.players[0].skipHarvestBonus, false)

  const t = createGame(2, ['A', 'B'])
  ripeField(t, 1, 'bajra')
  t.weather = FAIR
  t.marketMod = 1
  t.prices.bajra = CROPS.bajra.price
  drawKisan(t, 'labour')
  assert.equal(chooseLabour(t, false), true)
  assert.equal(t.players[0].skipHarvestBonus, true)
  assert.equal(t.pending.kind, 'card')
  const restore = stubRandom(t, 0.5)
  const expected = Math.round(expectedHarvest(t, 1) * 0.85)
  const cash = t.players[0].cash
  assert.equal(harvest(t, 1), true)
  restore()
  assert.equal(t.players[0].cash, cash + expected)
  assert.equal(t.players[0].skipHarvestBonus, false)
})

test('farm diary keeps the newest LOG_CAP entries', () => {
  const s = createGame(4, ['A', 'B', 'C', 'D'], { seed: 1, seasons: 24, winNet: 999999 })
  let steps = 0
  while (s.phase !== 'over' && steps < 5000) {
    steps += 1
    if (s.phase === 'roll') applyMove(s, rollDice(s))
    else if (s.phase === 'action') {
      if (s.pending && s.pending.kind === 'raise') {
        const lots = raisableLots(s, s.pending.pid)
        if (lots[0]) raiseLot(s, lots[0].tileId)
        else declineAction(s)
      } else declineAction(s)
    } else if (s.phase === 'end') nextTurn(s)
    else break
  }
  assert.equal(s.phase, 'over')
  assert.ok(s.logId > LOG_CAP)
  assert.equal(s.log.length, LOG_CAP)
  assert.equal(s.log[0].id, s.logId)
  assert.equal(s.log[s.log.length - 1].id, s.logId - LOG_CAP + 1)
})
