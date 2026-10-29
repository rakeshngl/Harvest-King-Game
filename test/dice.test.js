import { test } from 'node:test'
import assert from 'node:assert/strict'
import { animateDice } from '../src/dice.js'

test('animateDice skips spin when reduced motion is on', () => {
  const prevMedia = globalThis.matchMedia
  const prevDoc = globalThis.document
  globalThis.matchMedia = () => ({ matches: true })
  globalThis.document = { getElementById: () => null }
  let done = false
  animateDice(2, 5, () => { done = true })
  assert.equal(done, true)
  globalThis.matchMedia = prevMedia
  globalThis.document = prevDoc
})
