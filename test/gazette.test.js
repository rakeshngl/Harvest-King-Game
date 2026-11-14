import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/engine.js'
import { gazetteFacts, gazetteTemplate } from '../src/gazette.js'
import { gazetteModal } from '../src/hud.js'
import { setLang } from '../src/i18n.js'
import { CROPS } from '../src/data.js'

test('gazette facts read season weather market and leader', () => {
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.prices.onion = CROPS.onion.price + 40
  s.prices.wheat = CROPS.wheat.price - 10
  const facts = gazetteFacts(s)
  assert.equal(facts.seasonId, 'kharif')
  assert.equal(facts.weatherId, 'normal')
  assert.equal(facts.marketMod, 1)
  assert.equal(facts.movers[0].id, 'onion')
  assert.equal(facts.leader.name, 'A')
  assert.ok(facts.leader.net > 0)
})

test('gazette template is English and names the sky', () => {
  setLang('en')
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  const text = gazetteTemplate(gazetteFacts(s))
  assert.match(text, /Monsoon/)
  assert.match(text, /Fair Skies/)
  assert.match(text, /mandi/)
  assert.match(text, /A leads/)
})

test('gazette overlay keeps gazetteok', () => {
  const html = gazetteModal({ text: 'Winter opens under Hail Belt.' })
  assert.match(html, /id="gazetteok"/)
  assert.match(html, /Village gazette/)
  assert.match(html, /Winter opens under Hail Belt/)
  assert.equal(gazetteModal(null), '')
})
