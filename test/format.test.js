import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from '../src/format.js'

test('escapeHtml encodes markup in farmer names', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;')
  assert.equal(escapeHtml(`a&b"c'`), 'a&amp;b&quot;c&#39;')
  assert.equal(escapeHtml(null), '')
})
