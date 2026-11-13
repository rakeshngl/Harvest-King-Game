import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { CACHE_VERSION } from '../src/pwa.js'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const roadmap = readFileSync(new URL('../public/roadmap.html', import.meta.url), 'utf8')
const fontsCss = readFileSync(new URL('../public/fonts.css', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const fontsDir = new URL('../public/fonts/', import.meta.url)

test('index and roadmap load local fonts.css, not Google Fonts', () => {
  assert.match(html, /href="\/fonts\.css"/)
  assert.match(roadmap, /href="\/fonts\.css"/)
  for (const src of [html, roadmap, fontsCss]) {
    assert.doesNotMatch(src, /fonts\.googleapis\.com/)
    assert.doesNotMatch(src, /fonts\.gstatic\.com/)
  }
})

test('self-hosted faces cover Mukta, Cinzel and Tiro', () => {
  for (const family of ['Cinzel', 'Mukta', 'Mukta Malar', 'Tiro Devanagari Hindi', 'Tiro Tamil']) {
    assert.match(fontsCss, new RegExp(`font-family: '${family}'`))
  }
  const files = readdirSync(fontsDir).filter((name) => name.endsWith('.woff2'))
  assert.ok(files.length >= 20)
  const urls = [...fontsCss.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map((m) => m[1])
  assert.ok(urls.length >= 20)
  for (const url of urls) {
    const name = url.slice('/fonts/'.length)
    assert.ok(existsSync(new URL(name, fontsDir)), url)
  }
})

test('PWA shell caches local fonts', () => {
  assert.equal(CACHE_VERSION, 'hk-shell-4')
  assert.match(sw, /'\/fonts\.css'/)
  assert.match(sw, /startsWith\('\/fonts\/'\)/)
  assert.match(sw, /fontRe/)
})
