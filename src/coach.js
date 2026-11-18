import { TILES, CROPS } from './data.js'
import { groupOwned, seasonOf } from './engine.js'
import { t } from './i18n.js'
import { cropName, tileName, weatherName } from './names.js'
import { rs } from './view-util.js'

function textsOf(landing) {
  return (landing.entries || []).map((e) => (typeof e === 'string' ? e : (e && e.text) || ''))
}

function joinedText(landing) {
  return textsOf(landing).join(' ')
}

function harvestMeta(landing) {
  return (landing.entries || []).find((e) => e && e.meta && e.meta.pnl != null) || null
}

function cropFromText(blob) {
  const list = Object.values(CROPS).sort((a, b) => b.name.length - a.name.length)
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    if (blob.includes('harvests ' + c.name) || blob.includes('Warehouse lifts ' + c.name)) return c.id
  }
  return null
}

export function coachFacts(state, landing) {
  if (!state || !landing) return null
  const tile = TILES[landing.tileId] || null
  const pending = state.pending
  const blob = joinedText(landing)
  const weather = state.weather || {}
  const season = seasonOf(state)
  const farm = tile && tile.type === 'farm' ? state.farms[tile.id] : null
  const harvest = harvestMeta(landing)
  let topic = 'land'
  if (/insolvent/.test(blob)) topic = 'insolvent'
  else if (/harvests /.test(blob) || /Warehouse lifts/.test(blob)) topic = 'harvest'
  else if (/goes to auction/.test(blob) || /wins .+ at auction/.test(blob)) topic = 'auction'
  else if (/crossing leased/.test(blob) || /crossing /.test(blob) || /using /.test(blob)) topic = 'rent'
  else if (tile && tile.type === 'tax') topic = 'tax'
  else if (pending && pending.kind === 'acquire') topic = 'acquire'
  else if (pending && pending.kind === 'farmWork') topic = 'ownFarm'
  else if (pending && pending.kind === 'buyInfra') topic = 'infra'
  else if (pending && pending.kind === 'fci') topic = 'warehouse'
  else if (pending && pending.kind === 'nabard') topic = 'bank'
  else if (pending && pending.kind === 'card') topic = 'card'
  else if (tile && tile.type === 'start') topic = 'go'
  else if (tile && tile.type === 'mela') topic = 'mela'
  else if (tile && (tile.type === 'kisan' || tile.type === 'mandi')) topic = 'card'
  const ownerId = farm ? farm.owner : null
  return {
    topic,
    tileId: tile ? tile.id : landing.tileId,
    tileType: tile ? tile.type : '',
    tileName: tile ? tile.name : '',
    group: tile && tile.group ? tile.group : '',
    delta: landing.delta == null ? null : landing.delta,
    weatherId: weather.id,
    weatherName: weather.name,
    seasonId: season.id,
    cropId: cropFromText(blob) || (farm && farm.crop) || null,
    pnl: harvest && harvest.meta ? harvest.meta.pnl : null,
    irrigated: !!(farm && farm.irrigated) || /irrigates /.test(blob),
    insured: /crop insurance/.test(blob) || /Insurance top-up/.test(blob) || !!(farm && farm.insured),
    hail: /Hail shredded/.test(blob),
    pests: /Pests /.test(blob),
    spoilage: /Spoilage without cold storage/.test(blob),
    beltRent: !!(farm && ownerId != null && groupOwned(state, ownerId, tile.group)),
    cropRent: !!(farm && (farm.stage === 'ripe' || farm.stage === 'seeded')),
    mortgaged: !!(farm && farm.mortgaged),
    listPrice: tile && tile.price ? tile.price : null
  }
}

export function coachTemplate(facts) {
  if (!facts) return ''
  const tile = tileName(TILES[facts.tileId]) || facts.tileName || ''
  const weather = weatherName(facts.weatherId) || facts.weatherName || ''
  const crop = cropName(facts.cropId) || (facts.cropId && CROPS[facts.cropId] ? CROPS[facts.cropId].name : '') || tile
  const bits = []
  if (facts.topic === 'harvest') {
    bits.push(t('coachHarvest', crop, weather))
    if (facts.irrigated) bits.push(t('coachIrrigated'))
    if (facts.hail) bits.push(t('coachHail'))
    if (facts.pests && facts.insured) bits.push(t('coachInsured'))
    else if (facts.pests) bits.push(t('coachPests'))
    if (facts.spoilage) bits.push(t('coachSpoilage'))
    if (facts.pnl != null) bits.push(facts.pnl >= 0 ? t('coachProfit', rs(facts.pnl)) : t('coachLossNote', rs(Math.abs(facts.pnl))))
  } else if (facts.topic === 'rent') {
    bits.push(t('coachRent', tile))
    if (facts.beltRent) bits.push(t('coachBeltRent'))
    if (facts.cropRent) bits.push(t('coachCropRent'))
    if (facts.mortgaged) bits.push(t('coachMortgageRent'))
  } else if (facts.topic === 'tax') {
    bits.push(t('coachTax'))
  } else if (facts.topic === 'acquire') {
    bits.push(t('coachAcquire', tile))
    if (facts.listPrice) bits.push(t('coachList', rs(facts.listPrice)))
  } else if (facts.topic === 'ownFarm') {
    bits.push(t('coachOwn', tile))
  } else if (facts.topic === 'infra') {
    bits.push(t('coachInfra', tile))
  } else if (facts.topic === 'auction') {
    bits.push(t('coachAuction', tile))
    if (facts.listPrice) bits.push(t('coachList', rs(facts.listPrice)))
  } else if (facts.topic === 'warehouse') {
    bits.push(t('coachWarehouse'))
  } else if (facts.topic === 'bank') {
    bits.push(t('coachBank'))
  } else if (facts.topic === 'card') {
    bits.push(t('coachCard'))
  } else if (facts.topic === 'go') {
    bits.push(t('coachGo'))
  } else if (facts.topic === 'mela') {
    bits.push(t('coachMela'))
  } else if (facts.topic === 'insolvent') {
    bits.push(t('coachInsolvent'))
  } else {
    bits.push(t('coachLand', tile || t('theBoard')))
  }
  return bits.filter(Boolean).join(' ')
}
