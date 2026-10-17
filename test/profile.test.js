import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RECENT_KEEP, blankProfile, normalizeProfile, applyMatch, publicProfile } from '../src/profile.js'

test('blankProfile starts empty and trims name', () => {
  const p = blankProfile('abc', 'A'.repeat(40))
  assert.equal(p.id, 'abc')
  assert.equal(p.name.length, 16)
  assert.equal(p.games, 0)
  assert.deepEqual(p.recent, [])
})

test('applyMatch accumulates wins, insolvencies and best net', () => {
  let p = blankProfile('v1', 'Ravi')
  p = applyMatch(p, { code: 'ABCD', seats: 4, rank: 1, net: 9000, won: true, seasons: 5 })
  p = applyMatch(p, { code: 'WXYZ', seats: 2, rank: 2, net: 4000, won: false, seasons: 3 })
  p = applyMatch(p, { code: 'LMNO', seats: 3, rank: 3, net: -2000, won: false, bankrupt: true, seasons: 8 })
  assert.equal(p.games, 3)
  assert.equal(p.wins, 1)
  assert.equal(p.insolvencies, 1)
  assert.equal(p.bestNet, 9000)
  assert.equal(p.recent.length, 3)
  assert.equal(p.recent[0].code, 'LMNO')
})

test('applyMatch keeps only the most recent matches', () => {
  let p = blankProfile('v2', 'Meera')
  for (let i = 0; i < RECENT_KEEP + 5; i++) {
    p = applyMatch(p, { code: 'C' + i, seats: 2, rank: 1, net: i, won: true, seasons: 1 })
  }
  assert.equal(p.games, RECENT_KEEP + 5)
  assert.equal(p.recent.length, RECENT_KEEP)
  assert.equal(p.recent[0].code, 'C' + (RECENT_KEEP + 4))
})

test('normalizeProfile clamps wins to games and drops junk', () => {
  const p = normalizeProfile({ id: 'v3', name: 'Anand', games: 2, wins: 9, insolvencies: -4, recent: 'nope' })
  assert.equal(p.games, 2)
  assert.equal(p.wins, 2)
  assert.equal(p.insolvencies, 0)
  assert.equal(p.bestNet, 0)
  assert.deepEqual(p.recent, [])
})

test('publicProfile never leaks internal fields', () => {
  const p = applyMatch(blankProfile('v4', 'Kisan'), { code: 'TEST', seats: 2, rank: 1, net: 100, won: true })
  const view = publicProfile(p)
  assert.deepEqual(Object.keys(view).sort(), ['bestNet', 'games', 'id', 'insolvencies', 'name', 'recent', 'wins'])
  assert.equal(view.games, 1)
  assert.equal(view.wins, 1)
})
