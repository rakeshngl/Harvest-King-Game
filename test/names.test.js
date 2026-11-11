import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TILES, CROPS, GROUPS, SEASONS, WEATHER, KISAN_CARDS, MANDI_CARDS } from '../src/data.js'
import { setLang } from '../src/i18n.js'
import {
  tileName, tileShort, tileRegion, tileSub, cropName, groupName, seasonName, seasonHint,
  weatherName, weatherText, cardTitle, cardText, deckName, stageName, soilName,
  reasonText, diaryDisplay, localizeNames
} from '../src/names.js'
import { createGame } from '../src/engine.js'
import { tileHtml } from '../src/board.js'
import { diaryRow, actionModal, inspectModal, fieldsPanel } from '../src/hud.js'

function withLang(id, fn) {
  setLang(id)
  try {
    return fn()
  } finally {
    setLang('en')
  }
}

test('English names match data.js', () => {
  withLang('en', () => {
    TILES.forEach((tile) => {
      assert.equal(tileName(tile), tile.name)
      assert.equal(tileShort(tile), tile.short || tile.name)
      assert.equal(tileRegion(tile), tile.region || '')
    })
    Object.values(CROPS).forEach((c) => assert.equal(cropName(c.id), c.name))
    Object.entries(GROUPS).forEach(([id, g]) => assert.equal(groupName(id), g.name))
    SEASONS.forEach((s) => {
      assert.equal(seasonName(s), s.name)
      assert.equal(seasonHint(s), s.hint)
    })
    WEATHER.forEach((w) => {
      assert.equal(weatherName(w), w.name)
      assert.equal(weatherText(w), w.text)
    })
    KISAN_CARDS.forEach((c) => {
      assert.equal(cardTitle(c), c.title)
      assert.equal(cardText(c), c.text)
    })
    MANDI_CARDS.forEach((c) => {
      assert.equal(cardTitle(c), c.title)
      assert.equal(cardText(c), c.text)
    })
    assert.equal(stageName('idle'), 'idle')
    assert.equal(soilName('alluvial'), 'alluvial')
    assert.equal(deckName('Farmer Card'), TILES[2].name)
    assert.equal(deckName('Market Prices'), TILES[7].name)
    assert.match(TILES[4].sub, /greater of/)
    assert.match(TILES[38].sub, /greater of/)
    const ban = KISAN_CARDS.find((c) => c.id === 'ban')
    assert.match(ban.text, /Spice panic/)
    assert.doesNotMatch(ban.text, /onion/i)
    assert.doesNotMatch(cardText(ban), /onion|प्याज|வெங்காயம்/i)
    const flood = WEATHER.find((w) => w.id === 'flood')
    assert.match(flood.text, /alluvial/i)
    assert.doesNotMatch(flood.text, /orchard/i)
    assert.doesNotMatch(weatherText(flood), /orchard|बाग|தோட்ட/i)
  })
})

test('Hindi and Tamil translate tiles, crops, cards, weather, stages', () => {
  withLang('hi', () => {
    assert.equal(tileName(TILES[0]), 'ग्राम सभा')
    assert.equal(tileName(TILES[1]), 'बाड़मेर बाजरा')
    assert.equal(tileShort(TILES[1]), 'बाड़मेर')
    assert.equal(tileRegion(TILES[1]), 'राजस्थान')
    assert.equal(cropName('wheat'), 'गेहूँ')
    assert.equal(groupName('gangetic'), 'गंगा मैदान')
    assert.equal(seasonName('kharif'), 'मानसून')
    assert.equal(weatherName({ id: 'drought' }), 'सूखा')
    assert.match(weatherText({ id: 'normal' }), /औसत/)
    assert.equal(cardTitle(KISAN_CARDS[0]), 'किसान सहायता राशि')
    assert.equal(cardTitle(MANDI_CARDS[0]), 'त्योहार माँग')
    assert.equal(stageName('ripe'), 'पका')
    assert.equal(soilName('black'), 'काली')
    assert.equal(deckName('Farmer Card'), 'किसान पत्ता')
    assert.equal(reasonText('Village labour day — work one field.'), 'ग्राम श्रम दिवस — एक खेत पर काम करें।')
    assert.equal(reasonText('hail damage'), 'ओला क्षति')
    assert.equal(reasonText('crossing Barmer Millet'), 'बाड़मेर बाजरा पार करते')
    assert.equal(reasonText('crossing leased Barmer Millet'), 'पट्टे वाले बाड़मेर बाजरा पार करते')
    assert.match(tileSub(TILES[4]), /जो अधिक हो/)
    assert.match(tileSub(TILES[38]), /जो अधिक हो/)
    const ban = KISAN_CARDS.find((c) => c.id === 'ban')
    assert.match(cardText(ban), /मसाला/)
    assert.doesNotMatch(cardText(ban), /प्याज/)
    assert.match(weatherText({ id: 'flood' }), /जलोढ़/)
    assert.doesNotMatch(weatherText({ id: 'flood' }), /बाग/)
  })
  withLang('ta', () => {
    assert.equal(tileName(TILES[23]), 'தஞ்சாவூர் நெல்')
    assert.equal(cropName('rice'), 'நெல்')
    assert.equal(weatherName({ id: 'monsoon' }), 'நல்ல பருவமழை')
    assert.equal(stageName('seeded'), 'விதைத்த')
    assert.equal(deckName('Market Prices'), 'சந்தை விலை')
    assert.match(tileSub(TILES[4]), /எது அதிகமோ/)
    assert.match(tileSub(TILES[38]), /எது அதிகமோ/)
    const ban = KISAN_CARDS.find((c) => c.id === 'ban')
    assert.match(cardText(ban), /மசாலா/)
    assert.doesNotMatch(cardText(ban), /வெங்காயம்/)
    assert.match(weatherText({ id: 'flood' }), /வண்டல்/)
    assert.doesNotMatch(weatherText({ id: 'flood' }), /தோட்ட/)
  })
})

test('Hindi and Tamil packs cover every tile, crop, group, season, weather and card', () => {
  ;['hi', 'ta'].forEach((lang) => {
    withLang(lang, () => {
      TILES.forEach((tile) => {
        assert.ok(tileName(tile))
        assert.notEqual(tileName(tile), tile.name)
      })
      Object.keys(CROPS).forEach((id) => assert.notEqual(cropName(id), CROPS[id].name))
      Object.keys(GROUPS).forEach((id) => assert.notEqual(groupName(id), GROUPS[id].name))
      SEASONS.forEach((s) => assert.notEqual(seasonName(s), s.name))
      WEATHER.forEach((w) => assert.notEqual(weatherName(w), w.name))
      KISAN_CARDS.forEach((c) => assert.notEqual(cardTitle(c), c.title))
      MANDI_CARDS.forEach((c) => assert.notEqual(cardTitle(c), c.title))
    })
  })
})

test('diary display localizes names without changing engine log text', () => {
  const state = createGame(2, ['A', 'B'], { seed: 1 })
  const english = state.log[0].text
  assert.match(english, /Village Hall/)
  withLang('hi', () => {
    assert.match(diaryDisplay(state.log[0]), /ग्राम सभा/)
    assert.equal(state.log[0].text, english)
    assert.match(diaryRow(state.log[0]), /ग्राम सभा/)
  })
  withLang('en', () => {
    assert.equal(diaryDisplay(state.log[0]), english)
  })
  assert.equal(localizeNames('Pearl Millet at Barmer Millet'), 'Pearl Millet at Barmer Millet')
  withLang('hi', () => {
    assert.equal(localizeNames('Pearl Millet at Barmer Millet'), 'बाजरा at बाड़मेर बाजरा')
  })
})

test('board and hud use translated names', () => {
  const state = createGame(2, ['A', 'B'], { seed: 1 })
  state.farms[1].owner = 0
  state.farms[1].stage = 'ripe'
  state.farms[1].crop = 'bajra'
  withLang('hi', () => {
    const tile = tileHtml(TILES[1], state)
    assert.match(tile, /बाड़मेर/)
    assert.match(tile, /राजस्थान/)
    assert.match(tile, /aria-label="बाड़मेर बाजरा · राजस्थान"/)
    const fields = fieldsPanel(state, 0, false)
    assert.match(fields, /बाड़मेर बाजरा/)
    assert.match(fields, /पका/)
    assert.match(fields, /बाजरा/)
    const inspect = inspectModal(state, 1)
    assert.match(inspect, /बाड़मेर बाजरा/)
    assert.match(inspect, /शुष्क पट्टी/)
    state.pending = { kind: 'card', deck: 'Farmer Card', card: KISAN_CARDS[0] }
    const card = actionModal(state, state.pending, true)
    assert.match(card, /किसान पत्ता/)
    assert.match(card, /किसान सहायता राशि/)
  })
})
