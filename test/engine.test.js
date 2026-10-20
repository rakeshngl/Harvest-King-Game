import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGame, harvest, forcePay, buyFarm, prepareLand, seedLand, skipTurn,
  nextTurn, netWorth, applyMove, takeLoan, declineAction, bidAuction, passAuction,
  offerTrade, acceptTrade, rejectTrade, actingSeat, finalStandings, presetById
} from '../src/engine.js'
import { START_CASH, WIN_NET, PASS_GO, WEATHER, TILES, CROPS, INTEREST, SEASON_PRESETS, DEFAULT_PRESET } from '../src/data.js'
import { dailySeed } from '../src/rng.js'

const FAIR = WEATHER.find((w) => w.id === 'normal')

function stubRandom(state, value) {
  const orig = state._rng
  state._rng = () => value
  return () => { state._rng = orig }
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
  const vol = 1 + (0.5 * 2 - 1) * crop.vol
  y *= vol
  return Math.round(Math.max(0, y) * state.prices[crop.id] * state.marketMod)
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

test('new game seats farmers with village cash', () => {
  const s = createGame(2, ['A', 'B'])
  assert.equal(s.players.length, 2)
  assert.equal(s.players[0].cash, START_CASH)
  assert.equal(s.phase, 'roll')
  assert.equal(s.turn, 0)
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
  assert.equal(s.phase, 'end')
})

test('forcePay mortgages idle land before insolvency', () => {
  const s = createGame(2, ['A', 'B'])
  s.farms[1].owner = 0
  s.players[0].cash = 100
  const ok = forcePay(s, s.players[0], 700, 'Land Revenue')
  assert.equal(ok, true)
  assert.equal(s.farms[1].mortgaged, true)
  assert.equal(s.players[0].bankrupt, false)
  assert.equal(s.players[0].cash, 0)
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
  s.players[0].pos = 38
  applyMove(s, [1, 1])
  restore()
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
  s.players[0].pos = 38
  s.seasonIndex = 11
  const restore = stubRandom(s, 0.5)
  applyMove(s, [1, 1])
  restore()
  assert.equal(s.phase, 'over')
  assert.equal(s.winner, 0)
})

test('classic preset does not end after 12 seasons', () => {
  const s = createGame(2, ['A', 'B'])
  s.players[0].pos = 38
  s.seasonIndex = 11
  const restore = stubRandom(s, 0.5)
  applyMove(s, [1, 1])
  restore()
  assert.notEqual(s.phase, 'over')
  assert.equal(s.seasonIndex, 12)
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
