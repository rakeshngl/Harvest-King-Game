import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/engine.js'
import { chooseAction } from '../src/ai.js'

function cpuGame(persona = 'landlord') {
  const s = createGame(2, ['A', 'B'], { cpu: [true, false], persona: [persona, null], seed: 1 })
  s._rng = () => 0.99
  return s
}

test('chooseAction buys a cheap farm when cash is fat', () => {
  const s = cpuGame('landlord')
  s.phase = 'action'
  s.pending = { kind: 'acquire', tileId: 1 }
  assert.equal(chooseAction(s, 'hard').type, 'buy')
})

test('chooseAction skips a farm when cash cannot cover it', () => {
  const s = cpuGame('thrifty')
  s.players[0].cash = 50
  s.phase = 'action'
  s.pending = { kind: 'acquire', tileId: 1 }
  assert.equal(chooseAction(s, 'hard').type, 'skip')
})

test('chooseAction bids on an open village auction', () => {
  const s = cpuGame('landlord')
  s.phase = 'action'
  s.pending = {
    kind: 'auction', tileId: 1, map: null, starter: 0, highBid: 0, highBidder: null,
    minBid: 600, passed: [], actor: 0
  }
  const act = chooseAction(s, 'hard')
  assert.equal(act.type, 'bid')
  assert.ok(act.amount >= 600)
  assert.equal(act.amount % 100, 0)
})

test('chooseAction skips extra labour when monsoon cash is short', () => {
  const s = cpuGame('landlord')
  s.phase = 'end'
  s.pending = null
  s.labourUsed = false
  s.farms[1].owner = 0
  s.players[0].cash = 100
  assert.equal(chooseAction(s, 'hard').type, 'endTurn')
})

test('chooseAction offers cash for a rival belt closer', () => {
  const s = cpuGame('landlord')
  s.phase = 'end'
  s.pending = null
  s.labourUsed = true
  s.farms[1].owner = 0
  s.farms[3].owner = 1
  const act = chooseAction(s, 'hard')
  assert.equal(act.type, 'offer')
  assert.equal(act.to, 1)
  assert.equal(act.landTake, 3)
  assert.ok(act.cashGive >= 100)
})

function tradePending(s, extra) {
  s.phase = 'action'
  s.pending = {
    kind: 'trade', from: 1, to: 0,
    cashGive: 0, cashTake: 0, landGive: null, landTake: null,
    debtGive: 0, debtTake: 0,
    ...extra
  }
}

test('chooseAction rejects a cheap grab of CPU land', () => {
  const s = cpuGame('landlord')
  s.farms[3].owner = 0
  tradePending(s, { cashGive: 100, landTake: 3 })
  assert.equal(chooseAction(s, 'hard').type, 'reject')
})

test('chooseAction accepts fat cash for idle land', () => {
  const s = cpuGame('landlord')
  s.farms[3].owner = 0
  tradePending(s, { cashGive: 12000, landTake: 3 })
  assert.equal(chooseAction(s, 'hard').type, 'accept')
})

test('chooseAction accepts a belt closer even without cash', () => {
  const s = cpuGame('landlord')
  s.farms[1].owner = 0
  s.farms[3].owner = 1
  tradePending(s, { landGive: 3 })
  assert.equal(chooseAction(s, 'hard').type, 'accept')
})

test('chooseAction bids more for a ripe irrigated closer', () => {
  function offer(ripe) {
    const s = cpuGame('landlord')
    s.phase = 'end'
    s.pending = null
    s.labourUsed = true
    s.farms[1].owner = 0
    s.farms[3].owner = 1
    if (ripe) {
      s.farms[3].stage = 'ripe'
      s.farms[3].crop = 'jowar'
      s.farms[3].irrigated = true
    }
    return chooseAction(s, 'hard')
  }
  const idle = offer(false)
  const ripe = offer(true)
  assert.equal(idle.type, 'offer')
  assert.equal(ripe.type, 'offer')
  assert.equal(ripe.landTake, 3)
  assert.ok(ripe.cashGive > idle.cashGive)
})
