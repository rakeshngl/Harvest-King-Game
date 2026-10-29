import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prefersReducedMotion, focusables, trapFocus } from '../src/a11y.js'

function mockNode(attrs = {}) {
  return {
    disabled: !!attrs.disabled,
    tabIndex: attrs.tabIndex ?? 0,
    hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k),
    getAttribute: (k) => (attrs[k] == null ? null : String(attrs[k])),
    focus() { this.focused = true }
  }
}

test('prefersReducedMotion follows matchMedia', () => {
  const prev = globalThis.matchMedia
  globalThis.matchMedia = (q) => ({ matches: String(q).includes('reduce') })
  assert.equal(prefersReducedMotion(), true)
  globalThis.matchMedia = () => ({ matches: false })
  assert.equal(prefersReducedMotion(), false)
  globalThis.matchMedia = prev
})

test('focusables skips disabled, aria-hidden, and negative tabindex', () => {
  const ok = mockNode()
  const root = {
    querySelectorAll: () => [
      mockNode({ disabled: true }),
      mockNode({ 'aria-hidden': 'true' }),
      mockNode({ tabIndex: -1 }),
      ok
    ]
  }
  assert.deepEqual(focusables(root), [ok])
  assert.deepEqual(focusables(null), [])
})

test('trapFocus cycles Tab from last to first', () => {
  const a = mockNode()
  const b = mockNode()
  const root = {
    querySelectorAll: () => [a, b],
    querySelector: () => null,
    contains: (el) => el === a || el === b || el === root,
    addEventListener(type, fn) { this._on = fn },
    removeEventListener() { this._on = null }
  }
  const release = trapFocus(root)
  assert.equal(a.focused, true)
  const e = { key: 'Tab', shiftKey: false, target: b, preventDefault() { this.prevented = true } }
  root._on(e)
  assert.equal(e.prevented, true)
  assert.equal(a.focused, true)
  const back = { key: 'Tab', shiftKey: true, target: a, preventDefault() { this.prevented = true } }
  root._on(back)
  assert.equal(back.prevented, true)
  assert.equal(b.focused, true)
  release()
  assert.equal(root._on, null)
})
