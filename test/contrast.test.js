import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isContrastOn, setContrastOn, toggleContrast } from '../src/contrast.js'
import { chromeToggleHtml } from '../src/chrome.js'
import { setLang } from '../src/i18n.js'

test('contrast defaults off and persists through toggle', () => {
  setContrastOn(false)
  assert.equal(isContrastOn(), false)
  assert.equal(toggleContrast(), true)
  assert.equal(isContrastOn(), true)
  assert.equal(toggleContrast(), false)
})

test('chrome contrast toggle keeps its id', () => {
  setContrastOn(false)
  setLang('en')
  const html = chromeToggleHtml()
  assert.match(html, /id="contrasttoggle"/)
  assert.match(html, /High contrast off/)
  setContrastOn(true)
  assert.match(chromeToggleHtml(), /High contrast on/)
  setContrastOn(false)
})

test('high-contrast tokens live on html.contrast', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(css, /html\.contrast/)
  assert.match(css, /--ink: #000000/)
  assert.match(css, /--panel: #FFFFFF/)
})
