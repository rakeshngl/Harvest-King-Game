import { TILES, CROPS, GROUPS, MAX_SEASONS, LOAN_STEP, LOAN_CAP } from './data.js'
import { t } from './i18n.js'
import { escapeHtml } from './format.js'
import { iconHtml } from './icons.js'
import { diceHtml } from './dice.js'
import { currentPlayer, netWorth, farmsOf, seasonOf, actingSeat } from './engine.js'
import { PERSONAS } from './ai.js'
import { chromeToggleHtml, offlineBannerHtml } from './chrome.js'
import { boardTilesHtml } from './board.js'
import { rs } from './view-util.js'

export const DIARY_PAGE = 20

export function diaryRow(e) {
  const kind = typeof e === 'string' ? 'info' : (e.kind || 'info')
  const text = typeof e === 'string' ? e : e.text
  return `<div class="log-line ${kind}"><span class="dot"></span><span class="txt">${escapeHtml(text)}</span></div>`
}

export function diaryPages(state) {
  const total = (state && state.log ? state.log.length : 0)
  return Math.max(1, Math.ceil(total / DIARY_PAGE))
}

export function diaryPanel(state, diaryPage) {
  const log = state.log || []
  const pages = diaryPages(state)
  const page = Math.max(0, Math.min(diaryPage, pages - 1))
  const start = page * DIARY_PAGE
  const slice = log.slice(start, start + DIARY_PAGE)
  const from = log.length ? start + 1 : 0
  const to = Math.min(start + slice.length, log.length)
  return `
    <div class="panel diary-panel">
      <h3>${t('diary')}</h3>
      <div class="diary-meta">${log.length ? t('of', from, to, log.length) : t('noEvents')}</div>
      <div class="log">${slice.length ? slice.map(diaryRow).join('') : '<p class="pcash">' + t('books') + '</p>'}</div>
      <div class="diary-pager">
        <button class="ghost" id="diaryprev" ${page <= 0 ? 'disabled' : ''}>${t('newer')}</button>
        <span>${t('page', page + 1, pages)}</span>
        <button class="ghost" id="diarynext" ${page >= pages - 1 ? 'disabled' : ''}>${t('older')}</button>
      </div>
    </div>`
}

export function playerCard(p, state, { online, session, humanSeat }) {
  const nw = netWorth(state, p)
  const on = state.turn === p.id && state.phase !== 'over'
  const you = (online && p.id === session.you) || (!online && state.players.some((x) => x.cpu) && p.id === humanSeat)
  const persona = p.persona ? PERSONAS.find((x) => x.id === p.persona) : null
  const tag = p.cpu ? (persona ? persona.name : t('cpu')) : (you ? t('tagYou') : '')
  return `
    <div class="player-card${on ? ' turn' : ''}${p.bankrupt ? ' out' : ''}">
      <div class="swatch" style="background:${p.color}"></div>
      <div>
        <div class="pname">${escapeHtml(p.name)}${tag ? ' · ' + escapeHtml(tag) : ''}${state.winner === p.id ? ' · ' + t('harvestKing') : ''}</div>
        <div class="pcash">${rs(p.cash)} · ${t('debt')} ${rs(p.debt)}</div>
      </div>
      <div class="pnet">${rs(nw)}</div>
    </div>`
}

export function fieldsPanel(state, seat, canWork) {
  const list = farmsOf(state, seat)
  if (!list.length) return '<p class="pcash">' + t('noLand') + '</p>'
  return list.map((f) => {
    const crop = f.crop ? CROPS[f.crop].name : t('fallow')
    return `<button class="seed-btn" data-work="${f.id}" ${canWork && !f.mortgaged ? '' : 'disabled'} style="width:100%;margin-bottom:4px">
      <b>${f.tile.name}</b> · ${f.stage} · ${crop}
    </button>`
  }).join('')
}

export function ownedLandOptions(state, pid, selected) {
  return farmsOf(state, pid)
    .filter((f) => f.owner === pid)
    .map((f) => `<option value="${f.id}"${String(selected) === String(f.id) ? ' selected' : ''}>${f.tile.name}</option>`)
    .join('')
}

export function tradePanel(state, { me, mine, tradeOpen, tradeDraft }) {
  const others = state.players.filter((p) => p.id !== me && !p.bankrupt)
  if (!others.length) return ''
  if (!tradeOpen) {
    return `
    <div class="trade-box">
      <button class="primary" id="tradeopen" ${mine ? '' : 'disabled'}>${t('makeADeal')}</button>
    </div>`
  }
  const to = tradeDraft.to === '' ? others[0].id : Number(tradeDraft.to)
  return `
    <div class="trade-box">
      <h4>${t('trade')}</h4>
      <p class="pcash">${t('tradeHint')}</p>
      <label>${t('tradeWith')}
        <select id="tradeto"${mine ? '' : ' disabled'}>
           ${others.map((p) => `<option value="${p.id}"${p.id === to ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </label>
      <label>${t('youPay')}
        <input id="tradecashgive" type="number" min="0" step="100" value="${tradeDraft.cashGive}"${mine ? '' : ' disabled'} />
      </label>
      <label>${t('youAsk')}
        <input id="tradecashtake" type="number" min="0" step="100" value="${tradeDraft.cashTake}"${mine ? '' : ' disabled'} />
      </label>
      <label>${t('youGiveLand')}
        <select id="tradelandgive"${mine ? '' : ' disabled'}>
          <option value="">${t('noLandDeal')}</option>
          ${ownedLandOptions(state, me, tradeDraft.landGive)}
        </select>
      </label>
      <label>${t('youWantLand')}
        <select id="tradelandtake"${mine ? '' : ' disabled'}>
          <option value="">${t('noLandDeal')}</option>
          ${ownedLandOptions(state, to, tradeDraft.landTake)}
        </select>
      </label>
      <label>${t('youGiveDebt')}
        <input id="tradedebtgive" type="number" min="0" step="100" value="${tradeDraft.debtGive}"${mine ? '' : ' disabled'} />
      </label>
      <label>${t('youTakeDebt')}
        <input id="tradedebttake" type="number" min="0" step="100" value="${tradeDraft.debtTake}"${mine ? '' : ' disabled'} />
      </label>
      <div class="trade-acts">
        <button class="primary" id="tradeoffer" ${mine ? '' : 'disabled'}>${t('offerDeal')}</button>
        <button class="ghost" id="tradecancel">${t('cancelTrade')}</button>
      </div>
    </div>`
}

export function playHeadline(state, mine) {
  const pending = state.pending
  if (pending && pending.kind === 'auction') {
    const actor = state.players[pending.actor]
    return t('auctionHead', actor ? actor.name : '')
  }
  if (pending && pending.kind === 'trade') {
    const to = state.players[pending.to]
    return t('tradeHead', to ? to.name : '')
  }
  const p = currentPlayer(state)
  return mine ? t('yourTurn', p.name) : t('toAct', p.name, p.cpu)
}

export function wrapModal(inner) {
  return `<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${inner}</div></div>`
}

export function landingModal(state, landing, landingQueue) {
  const player = state.players[landing.pid] || currentPlayer(state)
  const tile = TILES[landing.tileId]
  const delta = landing.delta
  const netCls = delta == null || delta === 0 ? 'flat' : delta > 0 ? 'gain' : 'loss'
  const netTxt = delta == null
    ? t('settled')
    : delta === 0
      ? t('noCash')
      : (delta > 0 ? '+' : '-') + rs(Math.abs(delta))
  const sub = tile ? (tile.region || tile.sub || (tile.group ? GROUPS[tile.group].name : '')) : ''
  return `
    <div class="modal-back" role="dialog" aria-modal="true">
      <div class="modal landing">
        <div class="land-tag" style="color:${player.color}">
          <span class="pin" style="--pc:${player.color}"></span>${escapeHtml(player.name)} ${t('landsOn')}
        </div>
        <div class="land-head">
          <div class="land-icon" style="border-color:${player.color}">${tile ? iconHtml(tile.icon) : ''}</div>
          <div>
            <h2>${tile ? tile.name : t('theBoard')}</h2>
            <p class="land-sub">${sub}</p>
          </div>
        </div>
        <div class="land-events">${landing.entries.map(diaryRow).join('')}</div>
        <div class="land-net ${netCls}">${netTxt}</div>
         <div class="actions"><button class="primary" id="landok">${landingQueue.length ? t('nextLand', landingQueue.length) : t('continue')}</button></div>
      </div>
    </div>`
}

function auctionModal(state, pending, mine) {
  const tile = TILES[pending.tileId]
  const actor = state.players[pending.actor]
  const bidder = pending.highBidder != null ? state.players[pending.highBidder] : null
  const floor = pending.highBid > 0 ? pending.highBid + 100 : pending.minBid
  const canBid = mine && actor && actor.cash >= floor
  return wrapModal(`
    <h2>${t('auction')}</h2>
    <p>${t('auctionLot', tile ? tile.name : '', rs(pending.minBid))}</p>
    <div class="farm-meta">
      ${bidder ? t('highBid', escapeHtml(bidder.name), rs(pending.highBid)) : t('noBids')}
      <br/>${t('toBid', actor ? escapeHtml(actor.name) : '', rs(floor))}
    </div>
    ${mine ? `<div class="actions">
      <button class="work-btn gold" data-act="bid" ${canBid ? '' : 'disabled'}>${t('bidNow', rs(floor))}</button>
      <button class="ghost" data-act="passbid">${t('passBid')}</button>
    </div>` : `<p class="pcash">${t('waitingBid')}</p>`}`)
}

function tradeLine(n, landId) {
  const bits = []
  if (n) bits.push(rs(n))
  if (landId != null && TILES[landId]) bits.push(TILES[landId].name)
  return bits.length ? bits.join(' · ') : t('nothing')
}

function tradeModal(state, pending, mine) {
  const from = state.players[pending.from]
  const to = state.players[pending.to]
  return wrapModal(`
    <h2>${t('trade')}</h2>
    <p>${t('tradeOffer', from ? escapeHtml(from.name) : '', to ? escapeHtml(to.name) : '')}</p>
    <div class="farm-meta">
      ${t('theyGive')}: ${tradeLine(pending.cashGive, pending.landGive)}${pending.debtGive ? ' · ' + t('debt') + ' ' + rs(pending.debtGive) : ''}<br/>
      ${t('theyAsk')}: ${tradeLine(pending.cashTake, pending.landTake)}${pending.debtTake ? ' · ' + t('debt') + ' ' + rs(pending.debtTake) : ''}
    </div>
    ${mine ? `<div class="actions">
      <button class="work-btn gold" data-act="accept">${t('acceptDeal')}</button>
      <button class="ghost" data-act="reject">${t('rejectDeal')}</button>
    </div>` : `<p class="pcash">${t('waitingDeal')}</p>`}`)
}

function farmWorkModal(state, tileId) {
  const tile = TILES[tileId]
  const f = state.farms[tileId]
  const p = currentPlayer(state)
  const season = seasonOf(state).id
  let body = `
    <h2>${tile.name}</h2>
    <div class="farm-meta">
      ${t('stage')}: <b>${f.stage}</b>${f.crop ? ' · ' + CROPS[f.crop].name : ''}
      · Fertility ${(f.fertility * 100).toFixed(0)}%
      · ${f.irrigated ? t('irrigated') : t('rainfed')}
      · ${f.insured ? t('insured') : t('uninsured')}
      ${f.leasee === p.id ? ' · ' + t('leaseLeft', f.leaseTurns) : ''}
      ${f.lastPnl ? '<br/>' + t('lastHarvest', rs(f.lastPnl)) : ''}
    </div>`
  const acts = []
  if (f.mortgaged) {
    body += `<p>${t('mortgaged')}</p>`
    acts.push(`<button class="work-btn gold" data-act="unmortgage">${t('redeem', rs(Math.round(tile.price * 0.55)))}</button>`)
  } else {
    if (f.stage === 'idle') {
      acts.push(`<button class="work-btn gold" data-act="prepare" ${p.cash < tile.prepare && !p.freePrep ? 'disabled' : ''}>${t('prepare')} ${p.freePrep ? t('free') : rs(tile.prepare)}</button>`)
    }
    if (f.stage === 'prepared') {
      body += `<p>${t('chooseSeed')}</p><div class="crops">`
      body += tile.crops.map((cid) => {
        const c = CROPS[cid]
        const off = c.season !== season
        const cost = c.seed + (off ? Math.round(c.seed * 0.35) : 0)
        return `<button class="seed-btn${off ? ' off' : ''}" data-seed="${cid}" ${p.cash < cost ? 'disabled' : ''}>
          <b>${c.name}</b> · ${c.season}${off ? ' · ' + t('offSeason') : ''}<br/>${t('seedCost', rs(cost), c.yield, c.grow)}
        </button>`
      }).join('')
      body += `</div>`
    }
    if (f.stage === 'seeded') {
      acts.push(`<button class="work-btn alt" data-act="tend">${t('tend')} (${t('toRipe', f.growLeft)})</button>`)
    }
    if (f.stage === 'ripe') {
      acts.push(`<button class="work-btn alt" data-act="harvest">${t('harvestNow')}</button>`)
    }
    if (!f.irrigated) acts.push(`<button class="work-btn" data-act="irrigate">${t('irrigate')} ${rs((state.utilities[12] === p.id || state.utilities[28] === p.id) ? 400 : 900)}</button>`)
    if (!f.insured) acts.push(`<button class="work-btn" data-act="insure">${t('insure')} ${rs(600)}</button>`)
  }
  acts.push(`<button class="ghost" data-act="skip">${t('skipField')}</button>`)
  return wrapModal(body + `<div class="actions">${acts.join('')}</div>`)
}

export function actionModal(state, pending, mine) {
  const p = currentPlayer(state)
  if (pending.kind === 'auction') return auctionModal(state, pending, mine)
  if (pending.kind === 'trade') return tradeModal(state, pending, mine)
  if (pending.kind === 'acquire') {
    const tile = TILES[pending.tileId]
    return wrapModal(`
      <h2>${tile.name}</h2>
      <p>${t('mustOwn', tile.region, GROUPS[tile.group].name, tile.soil)}</p>
      <div class="farm-meta">${t('farmMeta', rs(tile.price), rs(tile.lease), rs(tile.prepare), tile.crops.map((c) => CROPS[c].name).join(', ')).replace('\n', '<br/>')}</div>
      <div class="actions">
        <button class="work-btn gold" data-act="buy" ${p.cash < tile.price ? 'disabled' : ''}>${t('buyLand')}</button>
        <button class="work-btn alt" data-act="lease" ${p.cash < tile.lease ? 'disabled' : ''}>${t('leaseLand')}</button>
        <button class="ghost" data-act="skip">${t('sendAuction')}</button>
      </div>`)
  }
  if (pending.kind === 'buyInfra') {
    const tile = TILES[pending.tileId]
    return wrapModal(`
      <h2>${tile.name}</h2>
      <p>${tile.sub}. ${t('infraHint')}</p>
      <div class="actions">
        <button class="work-btn gold" data-act="buyinfra" ${p.cash < tile.price ? 'disabled' : ''}>${t('buyFor', rs(tile.price))}</button>
        <button class="ghost" data-act="skip">${t('pass')}</button>
      </div>`)
  }
  if (pending.kind === 'farmWork') return farmWorkModal(state, pending.tileId)
  if (pending.kind === 'fci') {
    const ready = farmsOf(state, p.id).filter((f) => f.stage === 'ripe' || (f.stage === 'seeded' && f.growLeft <= 0))
    return wrapModal(`
      <h2>${t('warehouse')}</h2>
      <p>${t('warehouseP', ready.length)}</p>
      <div class="actions">
        <button class="work-btn alt" data-act="fci" ${ready.length ? '' : 'disabled'}>${t('sellWh')}</button>
        <button class="ghost" data-act="skip">${t('keepGrain')}</button>
      </div>`)
  }
  if (pending.kind === 'nabard') {
    return wrapModal(`
      <h2>${t('ruralBank')}</h2>
      <p>${t('ruralBankP', rs(LOAN_STEP), rs(LOAN_CAP), rs(p.debt))}</p>
      <div class="actions">
        <button class="work-btn gold" data-act="loan" ${p.debt >= LOAN_CAP ? 'disabled' : ''}>${t('takeLoan')}</button>
        <button class="work-btn" data-act="repay" ${p.debt <= 0 || p.cash <= 0 ? 'disabled' : ''}>${t('repay')} ${rs(Math.min(p.debt, p.cash, LOAN_STEP))}</button>
        <button class="ghost" data-act="skip">${t('leaveDesk')}</button>
      </div>`)
  }
  if (pending.kind === 'card') {
    return wrapModal(`
      <h2>${pending.deck}</h2>
      <p><b>${pending.card.title}</b><br/>${pending.card.text}</p>
      <div class="actions"><button class="primary" data-act="skip">${t('continue')}</button></div>`)
  }
  if (pending.kind === 'pickFarm') {
    const list = farmsOf(state, p.id)
    return wrapModal(`
      <h2>${t('chooseField')}</h2>
      <p>${pending.reason}</p>
      <div class="crops">
        ${list.map((f) => `<button class="seed-btn" data-work="${f.id}"><b>${f.tile.name}</b><br/>${f.stage}${f.crop ? ' · ' + CROPS[f.crop].name : ''}</button>`).join('')}
      </div>
      <div class="actions"><button class="ghost" data-act="skip">${t('skipField')}</button></div>`)
  }
  return ''
}

export function inspectModal(state, id) {
  const tile = TILES[id]
  const f = state.farms[id]
  let extra = ''
  if (tile.type === 'farm' && f) {
    const who = f.owner != null
      ? state.players[f.owner].name
      : (f.leasee != null ? t('leasedBy', state.players[f.leasee].name) : t('villageHall'))
    extra = `<div class="farm-meta">${t('owner')}: ${who}<br/>
      ${t('stage')} ${f.stage}${f.crop ? ' · ' + CROPS[f.crop].name : ''} · Fertility ${(f.fertility * 100).toFixed(0)}%</div>`
  }
  return wrapModal(`
    <h2>${tile.name}</h2>
    <p>${tile.region || tile.sub || ''} ${tile.group ? '· ' + GROUPS[tile.group].name : ''}</p>
    ${extra}
    <div class="actions"><button class="ghost" data-act="skip">${t('close')}</button></div>`)
}

export function modalHtml(state, { landing, landingQueue, inspectId, isMyTurn, netWorthFn }) {
  if (state.phase === 'over') {
    const w = state.players[state.winner]
    return `
      <div class="modal-back" role="dialog" aria-modal="true">
        <div class="modal win">
          <div class="tag">${t('villageDeclares')}</div>
          <h2>${w ? t('isKing', escapeHtml(w.name)) : t('landKing')}</h2>
          <p>${t('granaries', w ? rs(netWorthFn(state, w)) : '')}</p>
          <button class="primary" id="again">${t('playAgain')}</button>
        </div>
      </div>`
  }
  if (landing) return landingModal(state, landing, landingQueue)
  if (state.phase === 'action' && state.pending && (state.pending.kind === 'auction' || state.pending.kind === 'trade')) {
    return actionModal(state, state.pending, isMyTurn)
  }
  if (inspectId != null) return inspectModal(state, inspectId)
  if (!isMyTurn) return ''
  if (state.phase === 'action' && state.pending) return actionModal(state, state.pending, isMyTurn)
  return ''
}

export function gameHtml(state, ctx) {
  const p = currentPlayer(state)
  const season = seasonOf(state)
  const mine = ctx.isMyTurn && actingSeat(state) === state.turn
  const me = state.players[ctx.mySeat]
  const canWork = ctx.isMyTurn && ((state.phase === 'end' && !state.labourUsed) || (state.pending && state.pending.kind === 'pickFarm'))
  return `
  <div class="game-shell">
    <div class="board-wrap">
      ${offlineBannerHtml(ctx.lineOn)}
      <div class="topbar">
        <div>
          <div class="brand">Harvest King</div>
          <div class="en" style="letter-spacing:.2em;font-size:10px">${t('farming')}${ctx.online ? ' · ' + ctx.session.code : ''}</div>
        </div>
        <div class="meta">
          ${chromeToggleHtml()}
          <span class="chip s">${season.name} · ${season.hint}</span>
          <span class="chip g">${state.weather.name}</span>
          <span class="chip n">${t('seasonN', Math.min(state.seasonIndex + 1, state.maxSeasons || MAX_SEASONS), state.maxSeasons || MAX_SEASONS)}</span>
          ${state.daily ? `<span class="chip">${t('daily')} ${state.daily}</span>` : ''}
          <span class="chip">${t('marketX', state.marketMod.toFixed(2))}</span>
          ${ctx.online ? `<span class="chip">${ctx.session.spectator ? t('watching') : t('youName', me ? escapeHtml(me.name) : '')}</span>` : (state.players.some((x) => x.cpu) ? '<span class="chip">' + t('vsCpuChip') + '</span>' : '')}
        </div>
      </div>
      <div class="board-stage">
        <div class="board">
          ${boardTilesHtml(state)}
          <div class="center">
            <div class="center-inner">
              <div class="chakra">${iconHtml('chakra')}</div>
              <div class="tag">${t('indianFarming')}</div>
              <h2>Harvest King</h2>
              <div class="wx">${state.weather.name}<br/>${state.weather.text}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="side">
      <div class="panel play-dock dice-panel">
        <h3>${state.phase === 'over' ? t('gameOver') : playHeadline(state, mine)}</h3>
        ${diceHtml()}
        <div class="play-acts">
          <button class="roll-btn" id="roll" ${!mine || state.phase !== 'roll' || ctx.rolling ? 'disabled' : ''}>${mine ? t('roll') : (p.cpu ? t('cpuRolling') : t('waitingAct'))}</button>
          <button class="ghost" id="endturn" ${!mine || state.phase !== 'end' ? 'disabled' : ''}>${t('endTurn')}</button>
        </div>
        ${mine && state.phase === 'end' && !state.labourUsed && farmsOf(state, ctx.mySeat).length
          ? '<div class="tsub labour-hint">' + t('extraLabour') + '</div>'
          : ''}
        ${ctx.cpuNote ? `<p class="cpu-note">${escapeHtml(ctx.cpuNote)}</p>` : ''}
        ${ctx.notice ? `<p class="notice">${escapeHtml(ctx.notice)}</p>` : ''}
        ${ctx.online && state.phase !== 'over' ? '<div class="turn-clock" id="turnclock" hidden></div>' : ''}
        <button class="ghost" id="leavegame">${ctx.online ? t('leaveSession') : t('leaveTable')}</button>
      </div>
      <div class="side-tabs" role="tablist">
        ${[['farmers', t('farmers')], ['fields', t('yourFields')], ['prices', t('prices')], ['diary', t('diary')]].map(([id, label]) =>
          `<button type="button" class="count-btn${ctx.sideTab === id ? ' on' : ''}" data-sidetab="${id}" role="tab" aria-selected="${ctx.sideTab === id ? 'true' : 'false'}">${label}</button>`
        ).join('')}
      </div>
      <div class="side-pane${ctx.sideTab === 'farmers' ? ' on' : ''}" data-pane="farmers">
        <div class="panel">
          <h3>${t('farmers')}</h3>
          ${state.players.map((pl) => playerCard(pl, state, ctx)).join('')}
          ${tradePanel(state, { me: ctx.mySeat, mine: ctx.isMyTurn && state.phase === 'end' && !state.pending && actingSeat(state) === ctx.mySeat, tradeOpen: ctx.tradeOpen, tradeDraft: ctx.tradeDraft })}
        </div>
      </div>
      <div class="side-pane${ctx.sideTab === 'fields' ? ' on' : ''}" data-pane="fields">
        <div class="panel">
          <h3>${t('yourFields')}</h3>
          ${fieldsPanel(state, ctx.mySeat, canWork)}
        </div>
      </div>
      <div class="side-pane${ctx.sideTab === 'prices' ? ' on' : ''}" data-pane="prices">
        <div class="panel">
          <h3>${t('prices')}</h3>
          <div class="prices">
            ${Object.values(CROPS).slice(0, 12).map((c) =>
              `<span><b>${c.name}</b> ${rs(state.prices[c.id])}</span>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="side-pane${ctx.sideTab === 'diary' ? ' on' : ''}" data-pane="diary">
        ${diaryPanel(state, ctx.diaryPage)}
      </div>
    </div>
  </div>
  ${modalHtml(state, { landing: ctx.landing, landingQueue: ctx.landingQueue, inspectId: ctx.inspectId, isMyTurn: ctx.isMyTurn, netWorthFn: netWorth })}`
}
