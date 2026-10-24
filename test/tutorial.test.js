import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TUTORIAL_KEY, TUTORIAL_STEPS, loadTutorialSeen, saveTutorialSeen, clampTutorialStep
} from '../src/tutorial.js'

function mockStore() {
  const map = new Map()
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) }
  }
  return map
}

test('tutorial has six farming-cycle steps', () => {
  assert.equal(TUTORIAL_STEPS.length, 6)
  assert.deepEqual(TUTORIAL_STEPS.map((s) => s.id), ['goal', 'land', 'sow', 'harvest', 'labour', 'win'])
  assert.ok(TUTORIAL_STEPS.every((s) => s.icon && s.title && s.body))
})

test('unseen until saveTutorialSeen', () => {
  mockStore()
  assert.equal(loadTutorialSeen(), false)
  saveTutorialSeen()
  assert.equal(loadTutorialSeen(), true)
  assert.equal(globalThis.localStorage.getItem(TUTORIAL_KEY), '1')
})

test('clampTutorialStep stays in range', () => {
  assert.equal(clampTutorialStep(-2), 0)
  assert.equal(clampTutorialStep(0), 0)
  assert.equal(clampTutorialStep(3), 3)
  assert.equal(clampTutorialStep(99), TUTORIAL_STEPS.length - 1)
  assert.equal(clampTutorialStep(NaN), 0)
})
