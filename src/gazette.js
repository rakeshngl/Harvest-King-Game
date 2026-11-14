import { CROPS } from './data.js'
import { netWorth, seasonOf } from './engine.js'
import { t } from './i18n.js'
import { cropName, seasonName, weatherName } from './names.js'
import { rs } from './view-util.js'

export function gazetteFacts(state) {
  const season = seasonOf(state)
  const weather = state.weather || {}
  const movers = Object.keys(state.prices || {}).map((id) => {
    const crop = CROPS[id]
    const base = crop ? crop.price : 0
    const now = state.prices[id]
    return { id, name: crop ? crop.name : id, delta: now - base, now }
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const alive = (state.players || []).filter((p) => !p.bankrupt)
  const leader = alive.slice().sort((a, b) => netWorth(state, b) - netWorth(state, a))[0]
  return {
    seasonId: season.id,
    seasonName: season.name,
    weatherId: weather.id,
    weatherName: weather.name,
    weatherText: weather.text,
    marketMod: Number(Number(state.marketMod || 1).toFixed(2)),
    seasonN: (state.seasonIndex || 0) + 1,
    maxSeasons: state.maxSeasons,
    movers: movers.slice(0, 2).map((m) => ({ id: m.id, name: m.name, delta: m.delta })),
    leader: leader ? { name: leader.name, net: Math.round(netWorth(state, leader)) } : null
  }
}

export function gazetteTemplate(facts) {
  const season = seasonName(facts.seasonId) || facts.seasonName || ''
  const weather = weatherName(facts.weatherId) || facts.weatherName || ''
  const head = t('gazetteSky', season, weather)
  const market = t('gazetteMarket', Number(facts.marketMod || 1).toFixed(2))
  const top = facts.movers && facts.movers[0]
  let cropLine = t('gazetteSteady')
  if (top && top.delta) {
    const name = cropName(top.id) || top.name
    cropLine = top.delta > 0 ? t('gazetteUp', name) : t('gazetteDown', name)
  }
  const lead = facts.leader ? t('gazetteLead', facts.leader.name, rs(facts.leader.net)) : ''
  return [head, market, cropLine, lead].filter(Boolean).join(' ')
}
