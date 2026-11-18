import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, buyFarm, harvest } from '../src/engine.js'
import { coachFacts, coachTemplate } from '../src/coach.js'
import { landingModal } from '../src/hud.js'
import { setLang } from '../src/i18n.js'

function landingOf(entries, extra = {}) {
  return { pid: 0, tileId: 1, entries, delta: 0, ...extra }
}

test('coach acquire names the unclaimed lot', () => {
  setLang('en')
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.pending = { kind: 'acquire', tileId: 1 }
  const facts = coachFacts(s, landingOf([
    { kind: 'roll', text: 'A rolls 1+1 and reaches Barmer Millet.', meta: { pid: 0, tileId: 1 } }
  ]))
  assert.equal(facts.topic, 'acquire')
  const text = coachTemplate(facts)
  assert.match(text, /Barmer Millet/)
  assert.match(text, /unclaimed/)
  assert.match(text, /List price/)
})

test('coach harvest names crop weather and profit', () => {
  setLang('en')
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.weather = { id: 'normal', name: 'Fair Skies', mod: 1, water: 1, text: '' }
  const facts = coachFacts(s, landingOf([
    { kind: 'gain', text: 'A harvests Pearl Millet at Barmer Millet: 18 qtl @ Rs 55 = Rs 990 (profit Rs 290).', meta: { amount: 990, pnl: 290, pid: 0, tileId: 1 } }
  ], { tileId: 1, delta: 990 }))
  assert.equal(facts.topic, 'harvest')
  assert.equal(facts.cropId, 'bajra')
  const text = coachTemplate(facts)
  assert.match(text, /Pearl Millet/)
  assert.match(text, /Fair Skies/)
  assert.match(text, /Profit/)
})

test('coach rent names belt levy', () => {
  setLang('en')
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.farms[1].owner = 1
  s.farms[3].owner = 1
  const facts = coachFacts(s, landingOf([
    { kind: 'loss', text: 'A pays B Rs 176 for crossing Barmer Millet.', meta: { amount: 176, pid: 0, tileId: 1 } }
  ], { tileId: 1, delta: -176 }))
  assert.equal(facts.topic, 'rent')
  assert.equal(facts.beltRent, true)
  const text = coachTemplate(facts)
  assert.match(text, /Crossing/)
  assert.match(text, /full belt/)
})

test('landing modal keeps the field note', () => {
  setLang('en')
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  const html = landingModal(s, {
    pid: 0,
    tileId: 1,
    entries: [{ kind: 'roll', text: 'A rolls 1+1 and reaches Barmer Millet.' }],
    delta: 0,
    coach: 'Barmer Millet is unclaimed. Buy to keep the belt.'
  }, [])
  assert.match(html, /land-coach/)
  assert.match(html, /Field note/)
  assert.match(html, /Barmer Millet is unclaimed/)
  assert.match(html, /id="landok"/)
})

test('coach harvest after engine harvest still names the crop', () => {
  setLang('en')
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  s.farms[1].owner = 0
  s.farms[1].stage = 'ripe'
  s.farms[1].crop = 'bajra'
  s.farms[1].irrigated = true
  s.phase = 'action'
  s.pending = { kind: 'farmWork', tileId: 1 }
  s._rng = () => 0.5
  harvest(s, 1)
  const row = s.log.find((e) => e.meta && e.meta.pnl != null)
  const facts = coachFacts(s, landingOf([row], { tileId: 1, delta: row.meta.amount }))
  assert.equal(facts.topic, 'harvest')
  assert.equal(facts.cropId, 'bajra')
  assert.equal(s.farms[1].crop, null)
})

test('coach never mutates engine log', () => {
  const s = createGame(2, ['A', 'B'], { seed: 1 })
  buyFarm(s, 1)
  const before = JSON.stringify(s.log)
  coachTemplate(coachFacts(s, landingOf(s.log)))
  assert.equal(JSON.stringify(s.log), before)
})
