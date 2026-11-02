import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COOKIE, mintId, pack, unpack, parseCookies } from '../server/visitor.js'

const SECRET = 'unit-secret'

test('pack round-trips a minted id', () => {
  const id = mintId()
  assert.match(id, /^[0-9a-f]{32}$/)
  assert.equal(unpack(pack(id, SECRET), SECRET), id)
})

test('unpack rejects a forged signature', () => {
  const id = mintId()
  const raw = pack(id, SECRET)
  const bad = raw.slice(0, -2) + (raw.endsWith('aa') ? 'bb' : 'aa')
  assert.equal(unpack(bad, SECRET), null)
  assert.equal(unpack(pack(id, 'other'), SECRET), null)
  assert.equal(unpack(id, SECRET), null)
  assert.equal(unpack('', SECRET), null)
})

test('parseCookies reads hk-vid', () => {
  const id = mintId()
  const raw = pack(id, SECRET)
  const got = parseCookies(`a=1; ${COOKIE}=${raw}; b=two`)
  assert.equal(got[COOKIE], raw)
  assert.equal(got.a, '1')
})
