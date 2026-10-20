import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashString, todayKey, dailySeed, dailyCode, rngNext } from '../src/rng.js'

test('hashString is stable', () => {
  assert.equal(hashString('harvest-king:2026-10-18'), hashString('harvest-king:2026-10-18'))
  assert.notEqual(hashString('a'), hashString('b'))
})

test('dailySeed and dailyCode follow the IST date', () => {
  assert.equal(dailySeed('2026-10-18'), hashString('harvest-king:2026-10-18'))
  assert.equal(dailyCode('2026-10-18'), 'D261018')
  assert.equal(todayKey(Date.UTC(2026, 9, 18, 0, 0, 0)), '2026-10-18')
})

test('rngNext is deterministic from a seed', () => {
  const a = { rng: 42 }
  const b = { rng: 42 }
  const seqA = [rngNext(a), rngNext(a), rngNext(a)]
  const seqB = [rngNext(b), rngNext(b), rngNext(b)]
  assert.deepEqual(seqA, seqB)
  assert.ok(seqA.every((n) => n >= 0 && n < 1))
})
