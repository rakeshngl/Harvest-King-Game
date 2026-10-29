import { TILES, CROPS, GROUPS } from './data.js'
import { iconHtml } from './icons.js'
import { escapeHtml } from './format.js'
import { actingSeat } from './engine.js'
import { rs } from './view-util.js'

export const PLACE = (() => {
  const m = {}
  m[0] = { c: 11, r: 11 }
  for (let i = 1; i <= 9; i++) m[i] = { c: 11 - i, r: 11 }
  m[10] = { c: 1, r: 11 }
  for (let i = 11; i <= 19; i++) m[i] = { c: 1, r: 11 - (i - 10) }
  m[20] = { c: 1, r: 1 }
  for (let i = 21; i <= 29; i++) m[i] = { c: i - 19, r: 1 }
  m[30] = { c: 11, r: 1 }
  for (let i = 31; i <= 39; i++) m[i] = { c: 11, r: i - 29 }
  return m
})()

export function tileTheme(tile) {
  const group = tile.group ? GROUPS[tile.group] : null
  if (group) {
    return { band: group.color, wash: '#FFFFFF', ink: '#0F172A' }
  }
  const m = {
    start: { band: '#FB923C', wash: '#EA580C', ink: '#FFFFFF' },
    mela: { band: '#4ADE80', wash: '#15803D', ink: '#FFFFFF' },
    fci: { band: '#93C5FD', wash: '#1D4ED8', ink: '#FFFFFF' },
    nabard: { band: '#FCD34D', wash: '#B45309', ink: '#FFFFFF' },
    kisan: { band: '#F9A8D4', wash: '#BE185D', ink: '#FFFFFF' },
    mandi: { band: '#5EEAD4', wash: '#0F766E', ink: '#FFFFFF' },
    tax: { band: '#FCA5A5', wash: '#B91C1C', ink: '#FFFFFF' },
    infra: { band: '#CBD5E1', wash: '#334155', ink: '#FFFFFF' },
    utility: { band: '#7DD3FC', wash: '#0369A1', ink: '#FFFFFF' }
  }
  return m[tile.type] || { band: '#94A3B8', wash: '#FFFFFF', ink: '#0F172A' }
}

export function tileHtml(tile, state) {
  const pos = PLACE[tile.id]
  const theme = tileTheme(tile)
  const farm = tile.type === 'farm' ? state.farms[tile.id] : null
  const ownerId = farm
    ? farm.owner
    : (tile.type === 'infra' ? state.infra[tile.id] : tile.type === 'utility' ? state.utilities[tile.id] : null)
  const owner = ownerId != null ? state.players[ownerId] : null
  const pins = state.players
    .filter((p) => !p.bankrupt && p.pos === tile.id)
    .map((p) => {
      const on = actingSeat(state) === p.id && state.phase !== 'over'
      const letter = (p.name || '?').trim().charAt(0).toUpperCase()
      return `<div class="coin${on ? ' active' : ''}" style="--pc:${p.color}" title="${escapeHtml(p.name)}">${escapeHtml(letter)}</div>`
    })
    .join('')
  const stage = farm && farm.stage !== 'idle'
    ? `<div class="stage-dot ${farm.stage}" title="${farm.stage}${farm.crop ? ' ' + CROPS[farm.crop].name : ''}"></div>`
    : ''
  const ownerBar = owner
    ? `<div class="owner-bar" style="background:${owner.color}"></div>`
    : (farm && farm.leasee != null
      ? `<div class="owner-bar" style="background:${state.players[farm.leasee].color};opacity:.55"></div>`
      : '')
  const price = tile.price ? `<div class="tprice">${rs(tile.price)}</div>` : ''
  const cls = [
    'tile',
    tile.id % 10 === 0 ? 'corner' : '',
    'kind-' + tile.type,
    farm && farm.stage !== 'idle' ? 'has-crop' : ''
  ].filter(Boolean).join(' ')
  return `
    <div class="${cls}" data-tile="${tile.id}" title="${tile.name}${tile.region ? ' · ' + tile.region : ''}" style="grid-column:${pos.c};grid-row:${pos.r};--band:${theme.band};--wash:${theme.wash};--ink:${theme.ink}">
      <div class="band">${iconHtml(tile.icon)}</div>
      <div class="body">
        <div class="tname">${tile.short || tile.name}</div>
        <div class="tsub">${tile.region || ''}</div>
        ${price}
      </div>
      ${ownerBar}${stage}
      <div class="pins">${pins}</div>
    </div>`
}

export function boardTilesHtml(state) {
  return TILES.map((tile) => tileHtml(tile, state)).join('')
}
