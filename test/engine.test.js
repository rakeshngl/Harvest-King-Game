import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGame, harvest, forcePay, buyFarm, prepareLand, seedLand, skipTurn,
  nextTurn, netWorth, applyMove, takeLoan
} from '../src/engine.js'
import { START_CASH, WIN_NET, PASS_GO, WEATHER, TILES, CROPS, INTEREST } from '../src/data.js'

const FAIR = WEATHER.find((w) => w.id === 'normal')

function stubRandom(value) {
  const orig = Math.random
  Math.random = () => value
  return () => { Math.random = orig }
}

function expectedHarvest(state, tileId) {
  const f = state.farms[tileId]
  const t = TILES[tileId]
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
  const restore = stubRandom(0.5)
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
  const restore = stubRandom(0.5)
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
  const restore = stubRandom(0.5)
  s.players[0].pos = 38
  const cash = s.players[0].cash
  applyMove(s, [1, 1])
  restore()
  assert.equal(s.players[0].pos, 0)
  assert.ok(s.players[0].cash >= cash + PASS_GO)
})

test('skipTurn declines a pending prompt and passes the seat', () => {
  const s = createGame(2, ['A', 'B'])
  s.pending = { kind: 'acquire', tileId: 1 }
  s.phase = 'action'
  skipTurn(s)
  assert.equal(s.turn, 1)
  assert.equal(s.phase, 'roll')
  assert.equal(s.pending, null)
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
  const restore = stubRandom(0.5)
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
