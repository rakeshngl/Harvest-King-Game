import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createGame, rollDice, applyMove, declineAction, nextTurn, buyFarm
} from '../src/engine.js'

const skipGold = JSON.parse(readFileSync(new URL('./fixtures/golden-skip-42.json', import.meta.url), 'utf8'))
const buyGold = JSON.parse(readFileSync(new URL('./fixtures/golden-buy-42.json', import.meta.url), 'utf8'))

function replay(seed, policy) {
  const s = createGame(2, ['A', 'B'], { seed, seasons: 2, winNet: 999999, preset: 'short' })
  let steps = 0
  while (s.phase !== 'over' && steps < 400) {
    steps += 1
    if (s.phase === 'roll') applyMove(s, rollDice(s))
    else if (s.phase === 'action') {
      const pending = s.pending
      if (policy === 'buy' && pending && pending.kind === 'acquire' && buyFarm(s, pending.tileId)) {
        /* bought */
      } else declineAction(s)
    } else if (s.phase === 'end') nextTurn(s)
    else break
  }
  return s
}

test('seed 42 skip-always matches the golden log and winner', () => {
  const a = replay(42, 'skip')
  const b = replay(42, 'skip')
  assert.equal(a.phase, 'over')
  assert.equal(a.winner, skipGold.winner)
  assert.equal(a.logId, skipGold.logId)
  assert.deepEqual(a.players.map((p) => p.cash), skipGold.cash)
  assert.deepEqual(a.players.map((p) => p.pos), skipGold.pos)
  assert.equal(a.seasonIndex, skipGold.seasonIndex)
  assert.deepEqual(a.lastDice, skipGold.lastDice)
  assert.deepEqual(a.log.map((row) => row.text), skipGold.log)
  assert.deepEqual(a.log.map((row) => row.text), b.log.map((row) => row.text))
  assert.equal(a.winner, b.winner)
})

test('seed 42 buy-always matches the golden winner and farms', () => {
  const a = replay(42, 'buy')
  const b = replay(42, 'buy')
  const farms = Object.entries(a.farms)
    .filter(([, f]) => f.owner != null)
    .map(([id, f]) => [Number(id), f.owner])
  assert.equal(a.phase, 'over')
  assert.equal(a.winner, buyGold.winner)
  assert.equal(a.logId, buyGold.logId)
  assert.deepEqual(a.players.map((p) => p.cash), buyGold.cash)
  assert.deepEqual(a.players.map((p) => p.pos), buyGold.pos)
  assert.equal(a.log[0].text, buyGold.logHead)
  assert.deepEqual(farms, buyGold.farms)
  assert.equal(a.winner, b.winner)
  assert.deepEqual(a.log.map((row) => row.text), b.log.map((row) => row.text))
})

test('a different seed does not replay the skip-always golden', () => {
  const s = replay(43, 'skip')
  assert.notEqual(s.logId, skipGold.logId)
  assert.notDeepEqual(s.log.map((row) => row.text), skipGold.log)
})
