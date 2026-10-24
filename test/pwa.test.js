import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CACHE_VERSION, registerPwa } from '../src/pwa.js'

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('CACHE_VERSION matches the service worker', () => {
  assert.match(sw, new RegExp(`const VERSION = '${CACHE_VERSION}'`))
})

test('service worker precaches the shell', () => {
  for (const path of ['/', '/index.html', '/manifest.webmanifest', '/hero.webp', '/icons/icon-192.png', '/icons/icon-512.png']) {
    assert.match(sw, new RegExp(`'${path}'`))
  }
  assert.match(sw, /cacheFirst/)
  assert.match(sw, /networkFirst/)
  assert.match(sw, /isApi/)
})

test('manifest is installable', () => {
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.theme_color, '#0F172A')
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'))
})

test('index.html links the manifest and theme colour', () => {
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/)
  assert.match(html, /name="theme-color" content="#0F172A"/)
  assert.match(html, /rel="apple-touch-icon"/)
})

test('registerPwa is a no-op outside production', () => {
  assert.equal(typeof registerPwa, 'function')
  registerPwa()
})
