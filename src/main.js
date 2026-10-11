import { TILES, CROPS, GROUPS, PLAYER_PALETTE, WIN_NET, MAX_SEASONS, LOAN_STEP, LOAN_CAP } from './data.js'
import { iconHtml } from './icons.js'
import { diceHtml, animateDice, setDiceFace } from './dice.js'
import {
  createGame, currentPlayer, netWorth, farmsOf, seasonOf, applyMove, rollDice,
  buyFarm, leaseFarm, buyInfra, prepareLand, seedLand, irrigate, insure,
  harvest, tendCrop, sellToFci, takeLoan, repayLoan, declineAction, nextTurn,
  unmortgage, openFarmWork
} from './engine.js'
import {
  createRoom, joinRoom, startRoom, sendAction, waitSnapshot, openEventStream,
  kickSeat, passHost, addCpu, loadSession, saveSession, savedSeat, savedSeats, forgetSeat, pingPresence, fetchLobby
} from './net.js'
import { PERSONAS, CPU_NAMES, chooseAction, describeAction } from './ai.js'
import { t, setLang, currentLang, LANGS } from './i18n.js'

const app = document.getElementById('app')

const PLACE = (() => {
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

let screen = 'lobby'
let state = null
let rolling = false
let inspectId = null
let session = loadSession()
let room = null
let seq = 0
let lastRollSeq = 0
let pollOn = false
let eventSource = null
let landingQueue = []
let notice = ''
let seenLogId = 0
let landing = null
let cpuBusy = false
let cpuNote = ''
let cpuGuard = 0
let cpuGen = 0
let humanSeat = 0
let cpuDifficulty = 'normal'
let draftName = ''
let diaryPage = 0
const DIARY_PAGE = 20
let hallStats = { visits: 0, online: 0, playing: 0 }
let clockTimer = 0
let openTables = []
let visitorId = ''
let presenceOn = false

function visitorKey() {
  try {
    let id = localStorage.getItem('hk-visitor')
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + '-' + Math.random().toString(16).slice(2))
      localStorage.setItem('hk-visitor', id)
    }
    return id
  } catch {
    return 'anon-' + Date.now()
  }
}

function fmtCount(n) {
  return Number(n || 0).toLocaleString('en-IN')
}

function langToggleHtml() {
  return `<div class="lang-toggle" id="langtoggle">${LANGS.map((l) =>
    `<button class="count-btn${currentLang() === l.id ? ' on' : ''}" data-lang="${l.id}">${l.label}</button>`
  ).join('')}</div>`
}

function bindLang() {
  document.documentElement.lang = currentLang()
  const root = document.getElementById('langtoggle')
  if (!root) return
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]')
    if (!b) return
    setLang(b.getAttribute('data-lang'))
    render()
  })
}

function statsHtml() {
  return `
    <div class="hall-stats">
      <div class="stat">
        <b>${fmtCount(hallStats.visits)}</b>
        <span>${t('visited')}</span>
      </div>
      <div class="stat">
        <b>${fmtCount(hallStats.online)}</b>
        <span>${t('present')}</span>
      </div>
      <div class="stat">
        <b>${fmtCount(hallStats.playing)}</b>
        <span>${t('playing')}</span>
      </div>
    </div>`
}

async function pulsePresence() {
  if (!visitorId) visitorId = visitorKey()
  const playing = screen === 'game' || screen === 'waiting'
  try {
    hallStats = await pingPresence(visitorId, playing)
    paintHallStats()
    if (screen === 'lobby' && !state) {
      openTables = await fetchLobby()
      paintOpenTables()
    }
  } catch {
    /* ignore */
  }
}

function paintHallStats() {
  const root = document.querySelector('.hall-stats')
  if (!root) return
  const nums = root.querySelectorAll('b')
  if (nums[0]) nums[0].textContent = fmtCount(hallStats.visits)
  if (nums[1]) nums[1].textContent = fmtCount(hallStats.online)
  if (nums[2]) nums[2].textContent = fmtCount(hallStats.playing)
}

function startPresence() {
  if (presenceOn) return
  presenceOn = true
  pulsePresence()
  setInterval(pulsePresence, 12000)
}

function rs(n) {
  return t('rs') + Math.round(n).toLocaleString('en-IN')
}

function logIdOf(e) {
  return typeof e === 'string' ? 0 : (e.id || 0)
}

function syncLog() {
  seenLogId = (state && state.log ? state.log : []).reduce((m, e) => Math.max(m, logIdOf(e)), 0)
}

function cashDelta(entries, pid, prevCash) {
  const player = state && state.players[pid]
  const after = player ? player.cash : null
  const before = prevCash && prevCash[pid] != null ? prevCash[pid] : null
  if (before != null && after != null) return after - before
  let delta = 0
  let any = false
  entries.forEach((e) => {
    if (e.meta && e.meta.pid === pid && typeof e.meta.amount === 'number') {
      any = true
      delta += e.kind === 'loss' ? -e.meta.amount : e.kind === 'gain' ? e.meta.amount : 0
    }
  })
  return any ? delta : null
}

function landingsFromLog(log, fromId, prevCash) {
  const fresh = (log || []).filter((e) => typeof e !== 'string' && e.id > fromId)
  if (!fresh.length) return { seen: fromId, items: [] }
  const seen = fresh.reduce((m, e) => Math.max(m, logIdOf(e)), fromId)
  const chrono = fresh.slice().sort((a, b) => a.id - b.id)
  const items = []
  let bucket = []
  chrono.forEach((e) => {
    if (e.kind === 'roll' && bucket.length) {
      items.push(bucket)
      bucket = []
    }
    bucket.push(e)
  })
  if (bucket.length) items.push(bucket)
  return {
    seen,
    items: items.filter((group) => group.some((e) => e.kind === 'roll')).map((group) => {
      const roll = group.find((e) => e.kind === 'roll')
      const meta = (roll && roll.meta) || {}
      const pid = meta.pid != null ? meta.pid : 0
      const player = state && state.players[pid]
      return {
        pid,
        tileId: meta.tileId != null ? meta.tileId : (player ? player.pos : 0),
        entries: group,
        delta: cashDelta(group, pid, prevCash)
      }
    })
  }
}

function captureLanding(prevCash, opts = {}) {
  if (!state) return
  const replay = !!opts.replay
  const { seen, items } = landingsFromLog(state.log, seenLogId, prevCash)
  seenLogId = seen
  if (!items.length) return
  diaryPage = 0
  if (replay && items.length > 1) {
    landingQueue = items.slice(1)
    landing = items[0]
    landing.queued = items.length
    return
  }
  landingQueue = []
  landing = items[items.length - 1]
}

function diaryRow(e) {
  const kind = typeof e === 'string' ? 'info' : (e.kind || 'info')
  const text = typeof e === 'string' ? e : e.text
  return `<div class="log-line ${kind}"><span class="dot"></span><span class="txt">${text}</span></div>`
}

function diaryPages() {
  const total = (state && state.log ? state.log.length : 0)
  return Math.max(1, Math.ceil(total / DIARY_PAGE))
}

function clampDiaryPage() {
  const pages = diaryPages()
  if (diaryPage > pages - 1) diaryPage = pages - 1
  if (diaryPage < 0) diaryPage = 0
}

function diaryPanel() {
  const log = state.log || []
  clampDiaryPage()
  const pages = diaryPages()
  const start = diaryPage * DIARY_PAGE
  const slice = log.slice(start, start + DIARY_PAGE)
  const from = log.length ? start + 1 : 0
  const to = Math.min(start + slice.length, log.length)
  return `
    <div class="panel diary-panel">
      <h3>${t('diary')}</h3>
      <div class="diary-meta">${log.length ? t('of', from, to, log.length) : t('noEvents')}</div>
      <div class="log">${slice.length ? slice.map(diaryRow).join('') : '<p class="pcash">' + t('books') + '</p>'}</div>
      <div class="diary-pager">
        <button class="ghost" id="diaryprev" ${diaryPage <= 0 ? 'disabled' : ''}>${t('newer')}</button>
        <span>${t('page', diaryPage + 1, pages)}</span>
        <button class="ghost" id="diarynext" ${diaryPage >= pages - 1 ? 'disabled' : ''}>${t('older')}</button>
      </div>
    </div>`
}

function online() {
  return !!(session && session.token)
}

function mySeat() {
  if (online()) return session.you
  if (!state) return 0
  if (state.players.some((p) => p.cpu)) return humanSeat
  return state.turn
}

function isCpuTurn() {
  if (!state || online()) return false
  if (state.phase === 'over') return false
  const p = state.players[state.turn]
  return !!(p && p.cpu && !p.bankrupt)
}

function isMyTurn() {
  if (!state) return false
  if (state.phase === 'over') return false
  if (state.players[state.turn]?.bankrupt) return false
  if (landing) return false
  if (online()) return !session.spectator && session.you === state.turn
  if (state.players.some((p) => p.cpu)) {
    return !state.players[state.turn].cpu && state.turn === humanSeat
  }
  return true
}

function closeEvents() {
  pollOn = false
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function turnLeftMs() {
  if (!online() || !room || !room.turnEndsAt || !state || state.phase === 'over') return 0
  return Math.max(0, room.turnEndsAt - Date.now())
}

function paintClock() {
  const el = document.getElementById('turnclock')
  if (!el) return
  const ms = turnLeftMs()
  if (!ms) {
    el.hidden = true
    el.textContent = ''
    return
  }
  const s = Math.ceil(ms / 1000)
  el.hidden = false
  el.textContent = isMyTurn() ? t('clockMine', s) : t('clockWait', s)
  el.classList.toggle('urgent', s <= 15)
}

function startClock() {
  if (clockTimer) return
  clockTimer = setInterval(paintClock, 250)
}

function stopClock() {
  if (!clockTimer) return
  clearInterval(clockTimer)
  clockTimer = 0
}

function leaveSession(opts = {}) {
  const code = session && session.code
  stopClock()
  closeEvents()
  session = null
  room = null
  state = null
  seq = 0
  lastRollSeq = 0
  inspectId = null
  rolling = false
  screen = 'lobby'
  seenLogId = 0
  diaryPage = 0
  landing = null
  landingQueue = []
  cpuBusy = false
  cpuNote = ''
  cpuGuard = 0
  cpuGen += 1
  humanSeat = 0
  saveSession(null)
  if (opts.forget !== false && code) forgetSeat(code)
}

function enterOnline(snap, extra = {}) {
  session = {
    code: snap.code,
    token: snap.token,
    you: snap.you,
    spectator: !!snap.spectator,
    name: extra.name || (session && session.name) || ''
  }
  saveSession(session)
  applySnap(snap)
  watchEvents()
}

async function resumeSeat(code, token, name) {
  const snap = await joinRoom(code, name || '', { token })
  enterOnline(snap, { name: name || (snap.players && snap.players[snap.you] && snap.players[snap.you].name) })
  return snap
}

function applySnap(snap, opts = {}) {
  if (snap.kicked) {
    leaveSession()
    notice = t('kicked')
    render()
    return
  }
  seq = snap.seq
  room = snap
  session = { ...session, code: snap.code, you: snap.you, spectator: !!snap.spectator }
  saveSession(session)
  if (snap.draining) notice = t('draining')
  if (snap.started && snap.state) {
    const diceChanged = !opts.fromSelfRoll && snap.rollSeq > lastRollSeq
    const skipped = !opts.fromSelfRoll && snap.rollSeq > lastRollSeq + 1
    lastRollSeq = snap.rollSeq
    const prevCash = state ? state.players.map((p) => p.cash) : null
    const prevTurn = state ? state.turn : null
    const firstLook = !state
    state = snap.state
    screen = 'game'
    if (prevTurn != null && prevTurn !== state.turn) {
      landing = null
      landingQueue = []
    }
    if (opts.capture) {
      captureLanding(prevCash)
    } else if (firstLook) {
      syncLog()
    } else if (diceChanged && snap.lastDice) {
      rolling = true
      render()
      animateDice(snap.lastDice[0], snap.lastDice[1], () => {
        rolling = false
        captureLanding(prevCash, { replay: skipped })
        render()
      })
      return
    } else {
      syncLog()
    }
  } else {
    state = null
    screen = 'waiting'
    syncLog()
  }
  render()
}

function watchEvents() {
  if (!session || eventSource) return
  pollOn = true
  eventSource = openEventStream(session, {
    onSnapshot(snap) {
      if (!pollOn) return
      if (snap.kicked) {
        applySnap(snap)
        return
      }
      notice = ''
      if (snap.seq !== seq || snap.started !== (screen === 'game') || screen === 'waiting') {
        applySnap(snap)
      }
    },
    onError() {
      if (!pollOn) return
      notice = t('reconnect')
      render()
    }
  })
}

function scheduleCpu() {
  if (online() || cpuBusy || rolling || !state) return
  if (screen !== 'game' || state.phase === 'over') return
  if (landing) return
  if (state.players[state.turn]?.bankrupt) {
    nextTurn(state)
    render()
    return
  }
  if (!isCpuTurn()) return
  cpuBusy = true
  const gen = cpuGen
  setTimeout(() => {
    if (gen !== cpuGen) return
    cpuStep()
  }, 720)
}

function cpuStep() {
  if (!state || online() || screen !== 'game' || state.phase === 'over') {
    cpuBusy = false
    return
  }
  if (landing || rolling) {
    cpuBusy = false
    return
  }
  if (!isCpuTurn()) {
    cpuBusy = false
    return
  }
  inspectId = null
  cpuGuard += 1
  if (cpuGuard > 24) {
    cpuNote = (currentPlayer(state)?.name || 'Computer') + ' ends the turn.'
    if (state.phase === 'action') declineAction(state)
    if (state.phase === 'end' || state.phase === 'roll') nextTurn(state)
    cpuGuard = 0
    cpuBusy = false
    render()
    return
  }
  const action = chooseAction(state, cpuDifficulty)
  cpuNote = describeAction(state, action)
  applyCpuAction(action)
}

function applyCpuAction(action) {
  const pending = state.pending
  const tileId = action.tileId != null ? action.tileId : (pending && pending.tileId)
  const map = pending && pending.map
  if (action.type === 'roll') {
    cpuGuard = 0
    rolling = true
    const dice = rollDice()
    const prevCash = state.players.map((p) => p.cash)
    render()
    const gen = cpuGen
    animateDice(dice[0], dice[1], () => {
      if (gen !== cpuGen || !state) return
      applyMove(state, dice)
      rolling = false
      cpuBusy = false
      captureLanding(prevCash)
      render()
    })
    return
  }
  let ok = true
  if (action.type === 'buy') ok = tileId != null && buyFarm(state, tileId)
  else if (action.type === 'lease') ok = tileId != null && leaseFarm(state, tileId)
  else if (action.type === 'buyinfra') ok = !!(map && tileId != null && buyInfra(state, tileId, map))
  else if (action.type === 'prepare') ok = tileId != null && prepareLand(state, tileId)
  else if (action.type === 'seed') ok = tileId != null && !!action.crop && seedLand(state, tileId, action.crop)
  else if (action.type === 'harvest') ok = tileId != null && harvest(state, tileId)
  else if (action.type === 'tend') ok = tileId != null && tendCrop(state, tileId)
  else if (action.type === 'irrigate') ok = tileId != null && irrigate(state, tileId)
  else if (action.type === 'insure') ok = tileId != null && insure(state, tileId)
  else if (action.type === 'unmortgage') ok = tileId != null && unmortgage(state, tileId)
  else if (action.type === 'fci') ok = sellToFci(state)
  else if (action.type === 'loan') {
    takeLoan(state)
    declineAction(state)
  } else if (action.type === 'repay') {
    repayLoan(state, LOAN_STEP)
    declineAction(state)
  } else if (action.type === 'work') {
    ok = openFarmWork(state, action.tileId)
    if (!ok && state.phase === 'end') nextTurn(state)
    else if (!ok) declineAction(state)
  } else if (action.type === 'skip') declineAction(state)
  else if (action.type === 'endTurn') {
    nextTurn(state)
    cpuNote = ''
    cpuGuard = 0
  } else if (state.phase === 'action') declineAction(state)
  else if (state.phase === 'end') nextTurn(state)

  if (!ok && action.type !== 'work' && action.type !== 'fci' && state.phase === 'action') {
    declineAction(state)
  }
  cpuBusy = false
  render()
}

function render() {
  document.documentElement.lang = currentLang()
  if (screen === 'lobby' && !state) {
    app.innerHTML = lobbyHtml()
    bindLobby()
    bindLang()
    return
  }
  if (screen === 'waiting') {
    app.innerHTML = waitingHtml()
    bindWaiting()
    bindLang()
    return
  }
  app.innerHTML = gameHtml()
  bindGame()
  bindLang()
  if (state) setDiceFace(state.lastDice[0], state.lastDice[1])
  if (online() && state && state.phase !== 'over') {
    startClock()
    paintClock()
  } else {
    stopClock()
  }
  scheduleCpu()
}

function lobbyHtml() {
  return `
  <div class="lobby">
    <header class="lobby-hero">
      <img src="/hero.webp" alt="Harvest King — Indian Farming Board Game" />
      <div class="hero-fade"></div>
    </header>
    <main class="lobby-table">
      ${langToggleHtml()}
      ${notice ? `<p class="notice">${notice}</p>` : ''}
      ${statsHtml()}
      <div class="farmer-bar">
        <div>
          <div class="en">${t('takeSeat')}</div>
          <p>${t('takeSeatHint')}</p>
        </div>
        <input id="myname" maxlength="16" placeholder="${t('farmerName')}" value="${draftName}" required />
      </div>
      ${resumeTablesHtml()}
      <div id="opentables">${openTablesHtml()}</div>
      <div class="mode-grid">
        <article class="mode-card mode-online">
          <div class="mode-kicker">${t('onlineTable')}</div>
          <h2>${t('playFriends')}</h2>
          <p>${t('playFriendsHint')}</p>
          <input id="roompass" maxlength="24" placeholder="${t('password')}" />
          <button class="primary" id="create">${t('create')}</button>
          <div class="mode-split">${t('orJoin')}</div>
          <div class="names">
            <input id="joincode" maxlength="6" placeholder="ABCD" />
            <button class="primary" id="join">${t('join')}</button>
            <button class="ghost" id="watch">${t('watch')}</button>
          </div>
        </article>
        <article class="mode-card mode-cpu">
          <div class="mode-kicker">${t('solo')}</div>
          <h2>${t('vsCpu')}</h2>
          <p>${t('vsCpuHint')}</p>
          <div class="count-row" id="cpucounts">
            ${[2, 3, 4].map((n) => `<button class="count-btn${n === 2 ? ' on' : ''}" data-cpu="${n}">${n === 2 ? t('rival1') : t('rivalsN', n - 1)}</button>`).join('')}
          </div>
          <div class="count-row" id="cpudiff">
            ${['easy', 'normal', 'hard'].map((d) => `<button class="count-btn${d === 'normal' ? ' on' : ''}" data-diff="${d}">${t(d)}</button>`).join('')}
          </div>
          <button class="primary" id="vscpu">${t('playVsCpu')}</button>
        </article>
        <article class="mode-card mode-local">
          <div class="mode-kicker">${t('oneDevice')}</div>
          <h2>${t('passPlay')}</h2>
          <p>${t('passPlayHint')}</p>
          <div class="count-row" id="counts">
            ${[2, 3, 4].map((n) => `<button class="count-btn${n === 2 ? ' on' : ''}" data-n="${n}">${t('farmersN', n)}</button>`).join('')}
          </div>
          <div class="names" id="names">${nameInputs(2)}</div>
          <button class="primary" id="start">${t('passPlayBtn')}</button>
        </article>
      </div>
      <section class="guide">
        <header class="guide-head">
          <div class="en">${t('handbook')}</div>
          <h2>${t('howKing')}</h2>
          <p>${t('howKingLead')}</p>
        </header>
        <div class="guide-grid">
          <article class="guide-card">
            <div class="guide-num">01</div>
            <h3>${t('g1t')}</h3>
            <p>${t('g1')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">02</div>
            <h3>${t('g2t')}</h3>
            <p>${t('g2')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">03</div>
            <h3>${t('g3t')}</h3>
            <p>${t('g3')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">04</div>
            <h3>${t('g4t')}</h3>
            <p>${t('g4')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">05</div>
            <h3>${t('g5t')}</h3>
            <p>${t('g5')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">06</div>
            <h3>${t('g6t')}</h3>
            <p>${t('g6')}</p>
          </article>
        </div>
        <div class="guide-strip">
          <div>
            <h4>${t('seasons')}</h4>
            <p>${t('seasonsP')}</p>
          </div>
          <div>
            <h4>${t('weather')}</h4>
            <p>${t('weatherP')}</p>
          </div>
          <div>
            <h4>${t('bank')}</h4>
            <p>${t('bankP')}</p>
          </div>
          <div>
            <h4>${t('infra')}</h4>
            <p>${t('infraP')}</p>
          </div>
        </div>
      </section>
    </main>
  </div>`
}

function openTablesHtml() {
  if (!openTables.length) {
    return `
      <article class="mode-card">
        <div class="mode-kicker">${t('hall')}</div>
        <h2>${t('openTables')}</h2>
        <p>${t('noOpen')}</p>
      </article>`
  }
  return `
      <article class="mode-card">
        <div class="mode-kicker">${t('hall')}</div>
        <h2>${t('openTables')}</h2>
        <p>${t('openHint')}</p>
        ${openTables.map((table) => `
          <div class="names">
            <span class="session-code" style="font-size:20px;padding:8px 12px">${table.code}</span>
            <span class="pcash">${table.seats}/4 · ${t('hostOf')} ${table.host}</span>
            <button class="primary" data-halljoin="${table.code}">${t('sit')}</button>
          </div>`).join('')}
      </article>`
}

function paintOpenTables() {
  const root = document.getElementById('opentables')
  if (!root) return
  root.innerHTML = openTablesHtml()
  bindOpenTables()
}

function bindOpenTables() {
  document.querySelectorAll('[data-halljoin]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-halljoin')
      const name = requireFarmerName()
      if (!name) return
      try {
        notice = ''
        const seat = savedSeat(code)
        if (seat && seat.token) {
          await resumeSeat(code, seat.token, seat.name || name)
          return
        }
        const snap = await joinRoom(code, name)
        enterOnline(snap, { name })
      } catch (err) {
        notice = err.message
        render()
      }
    })
  })
}

function resumeTablesHtml() {
  const seats = savedSeats()
  const codes = Object.keys(seats)
  if (!codes.length) return ''
  return `
      <article class="mode-card">
        <div class="mode-kicker">${t('thisDevice')}</div>
        <h2>${t('resumeTitle')}</h2>
        <p>${t('resumeHint')}</p>
        ${codes.map((code) => {
          const s = seats[code]
          const who = s.spectator ? t('watcher') : (s.name || t('farmer'))
          return `<div class="names">
            <span class="session-code" style="font-size:20px;padding:8px 12px">${code}</span>
            <button class="primary" data-resume="${code}">${t('resumeWho', who)}</button>
            <button class="ghost" data-forget="${code}">${t('forget')}</button>
          </div>`
        }).join('')}
      </article>`
}

function nameInputs(n) {
  return Array.from({ length: n }, (_, i) => {
    const pal = PLAYER_PALETTE[i]
    return `<input data-i="${i}" maxlength="16" placeholder="${pal.name}" style="border-color:${pal.color}" />`
  }).join('')
}

function startLocalGame(n, list, opts = {}) {
  session = null
  saveSession(null)
  humanSeat = 0
  cpuBusy = false
  cpuNote = ''
  cpuGuard = 0
  cpuGen += 1
  inspectId = null
  landing = null
  diaryPage = 0
  notice = ''
  state = createGame(n, list, opts)
  screen = 'game'
  syncLog()
  render()
}

function requireFarmerName() {
  const el = document.getElementById('myname')
  const name = (el ? el.value : draftName).trim()
  draftName = name
  if (name) {
    notice = ''
    return name
  }
  notice = t('needName')
  render()
  const again = document.getElementById('myname')
  if (again) again.focus()
  return ''
}

function bindLobby() {
  let n = 2
  let cpuN = 2
  let diff = 'normal'
  const counts = document.getElementById('counts')
  const names = document.getElementById('names')
  const myname = document.getElementById('myname')
  if (myname) {
    myname.addEventListener('input', () => {
      draftName = myname.value
    })
  }
  counts.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]')
    if (!b) return
    n = Number(b.dataset.n)
    counts.querySelectorAll('.count-btn').forEach((x) => x.classList.toggle('on', x === b))
    names.innerHTML = nameInputs(n)
  })
  const cpuCounts = document.getElementById('cpucounts')
  cpuCounts.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cpu]')
    if (!b) return
    cpuN = Number(b.dataset.cpu)
    cpuCounts.querySelectorAll('.count-btn').forEach((x) => x.classList.toggle('on', x === b))
  })
  const cpuDiff = document.getElementById('cpudiff')
  cpuDiff.addEventListener('click', (e) => {
    const b = e.target.closest('[data-diff]')
    if (!b) return
    diff = b.dataset.diff
    cpuDiff.querySelectorAll('.count-btn').forEach((x) => x.classList.toggle('on', x === b))
  })
  document.getElementById('vscpu').addEventListener('click', () => {
    const you = requireFarmerName()
    if (!you) return
    cpuDifficulty = diff
    const list = [you]
    const flags = [false]
    const persona = [null]
    for (let i = 1; i < cpuN; i++) {
      const per = PERSONAS[(i - 1) % PERSONAS.length]
      list.push(CPU_NAMES[per.id] || per.name)
      flags.push(true)
      persona.push(per.id)
    }
    startLocalGame(cpuN, list, { cpu: flags, persona })
  })
  document.getElementById('start').addEventListener('click', () => {
    const you = requireFarmerName()
    if (!you) return
    const list = [...names.querySelectorAll('input')].map((i, idx) => {
      const typed = i.value.trim()
      if (idx === 0) return you
      return typed || PLAYER_PALETTE[idx].name
    })
    startLocalGame(n, list)
  })
  document.getElementById('create').addEventListener('click', async () => {
    const name = requireFarmerName()
    if (!name) return
    try {
      notice = ''
      const password = (document.getElementById('roompass').value || '').trim()
      const snap = await createRoom(name, { password })
      enterOnline(snap, { name })
    } catch (err) {
      notice = err.message
      render()
    }
  })
  document.getElementById('join').addEventListener('click', async () => {
    const code = document.getElementById('joincode').value.trim()
    const seat = savedSeat(code)
    try {
      notice = ''
      if (seat && seat.token) {
        await resumeSeat(code, seat.token, seat.name)
        return
      }
      const name = requireFarmerName()
      if (!name) return
      const password = (document.getElementById('roompass').value || '').trim()
      const snap = await joinRoom(code, name, { password })
      enterOnline(snap, { name })
    } catch (err) {
      if (seat) forgetSeat(code)
      notice = err.message
      render()
    }
  })
  document.getElementById('watch').addEventListener('click', async () => {
    const code = document.getElementById('joincode').value.trim()
    const seat = savedSeat(code)
    const name = (document.getElementById('myname').value || '').trim().slice(0, 16) || t('watcher')
    try {
      notice = ''
      if (seat && seat.token && seat.spectator) {
        await resumeSeat(code, seat.token, seat.name || name)
        return
      }
      const password = (document.getElementById('roompass').value || '').trim()
      const snap = await joinRoom(code, name, { watch: true, password })
      enterOnline(snap, { name })
    } catch (err) {
      notice = err.message
      render()
    }
  })
  document.querySelectorAll('[data-resume]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-resume')
      const seat = savedSeat(code)
      if (!seat) return
      try {
        notice = ''
        await resumeSeat(code, seat.token, seat.name)
      } catch (err) {
        forgetSeat(code)
        notice = err.message
        render()
      }
    })
  })
  document.querySelectorAll('[data-forget]').forEach((btn) => {
    btn.addEventListener('click', () => {
      forgetSeat(btn.getAttribute('data-forget'))
      render()
    })
  })
  bindOpenTables()
  fetchLobby().then((tables) => {
    openTables = tables
    paintOpenTables()
  }).catch(() => {})
}

function waitingHtml() {
  const players = (room && room.players) || []
  const hostSeat = room && Number.isInteger(room.hostSeat) ? room.hostSeat : 0
  const host = session && session.you === hostSeat
  const pal = PLAYER_PALETTE[session.you] || PLAYER_PALETTE[0]
  const share = location.origin + location.pathname + '?join=' + (session ? session.code : '')
  return `
  <div class="lobby">
    <div class="lobby-card">
      ${langToggleHtml()}
      <div class="en">${t('waiting')}</div>
      <h1>${t('room')} ${session ? session.code : ''}</h1>
      <p class="lead">${t('waitingLead', !!(room && room.locked), pal.name, host)}</p>
      <div class="session-code">${session ? session.code : ''}</div>
      <p class="pcash" style="margin:8px 0 16px;word-break:break-all">${share}</p>
      <div class="waiting-list">
        ${players.map((p) => `
          <div class="player-card${p.seat === session.you ? ' turn' : ''}">
            <div class="swatch" style="background:${PLAYER_PALETTE[p.seat].color}"></div>
            <div>
              <div class="pname">${p.name}${p.cpu ? ' · ' + t('computer') : ''}${p.seat === hostSeat ? ' · ' + t('hostTag') : ''}${p.seat === session.you ? ' · ' + t('youTag') : ''}${!p.cpu && !p.connected ? ' · ' + t('away') : ''}</div>
              <div class="pcash">${p.cpu ? (PERSONAS.find((x) => x.id === p.persona)?.name || t('cpu')) : (p.connected ? t('seated') : t('away'))}</div>
              ${host && p.seat !== session.you ? `<div class="names" style="margin-top:8px">
                <button class="ghost" data-kick="${p.seat}">${t('remove')}</button>
                ${p.cpu ? '' : `<button class="ghost" data-host="${p.seat}">${t('makeHost')}</button>`}
              </div>` : ''}
            </div>
          </div>`).join('')}
        ${Array.from({ length: 4 - players.length }, (_, i) => `
          <div class="player-card" style="opacity:.45">
            <div class="swatch" style="background:#ccc"></div>
            <div class="pname">${t('openSeat', players.length + i + 1)}</div>
          </div>`).join('')}
      </div>
      ${notice ? `<p class="notice">${notice}</p>` : ''}
      <div class="actions">
        ${host && players.length < 4 ? `<div class="count-row" id="onlinediff">
          ${['easy', 'normal', 'hard'].map((d) => `<button class="count-btn${d === (room.cpuDifficulty || 'normal') ? ' on' : ''}" data-onlinediff="${d}">${t(d)}</button>`).join('')}
        </div>
        <button class="ghost" id="addcpu">${t('addCpu')}</button>` : ''}
        ${host ? `<button class="primary" id="opengame" ${players.length < 2 ? 'disabled' : ''}>${t('startGame')}</button>` : '<p class="pcash">' + t('waitHost') + '</p>'}
        <button class="ghost" id="leave">${t('leave')}</button>
      </div>
    </div>
  </div>`
}

function bindWaiting() {
  const leave = document.getElementById('leave')
  if (leave) leave.addEventListener('click', () => {
    leaveSession({ forget: false })
    notice = t('seatKept')
    render()
  })
  const open = document.getElementById('opengame')
  if (open) {
    open.addEventListener('click', async () => {
      try {
        notice = ''
        const snap = await startRoom(session)
        applySnap(snap)
      } catch (err) {
        notice = err.message
        render()
      }
    })
  }
  const add = document.getElementById('addcpu')
  if (add) {
    add.addEventListener('click', async () => {
      try {
        notice = ''
        const on = document.querySelector('#onlinediff .count-btn.on')
        const snap = await addCpu(session, on ? on.getAttribute('data-onlinediff') : 'normal')
        applySnap(snap)
      } catch (err) {
        notice = err.message
        render()
      }
    })
  }
  const diffs = document.getElementById('onlinediff')
  if (diffs) {
    diffs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-onlinediff]')
      if (!b) return
      diffs.querySelectorAll('.count-btn').forEach((x) => x.classList.toggle('on', x === b))
    })
  }
  document.querySelectorAll('[data-kick]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        notice = ''
        const snap = await kickSeat(session, Number(btn.getAttribute('data-kick')))
        applySnap(snap)
      } catch (err) {
        notice = err.message
        render()
      }
    })
  })
  document.querySelectorAll('[data-host]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        notice = ''
        const snap = await passHost(session, Number(btn.getAttribute('data-host')))
        applySnap(snap)
      } catch (err) {
        notice = err.message
        render()
      }
    })
  })
}

async function netAct(action) {
  if (!online()) return false
  if (!isMyTurn()) return true
  try {
    notice = ''
    const snap = await sendAction(session, action)
    if (action.type === 'roll' && snap.rolled) {
      lastRollSeq = snap.rollSeq
      rolling = true
      render()
      animateDice(snap.rolled[0], snap.rolled[1], () => {
        rolling = false
        applySnap(snap, { fromSelfRoll: true, capture: true })
      })
      return true
    }
    applySnap(snap)
    return true
  } catch (err) {
    notice = err.message
    rolling = false
    render()
    return true
  }
}

function gameHtml() {
  const p = currentPlayer(state)
  const season = seasonOf(state)
  const mine = isMyTurn()
  const me = state.players[mySeat()]
  return `
  <div class="game-shell">
    <div class="board-wrap">
      <div class="topbar">
        <div>
          <div class="brand">Harvest King</div>
          <div class="en" style="letter-spacing:.2em;font-size:10px">${t('farming')}${online() ? ' · ' + session.code : ''}</div>
        </div>
        <div class="meta">
          ${langToggleHtml()}
          <span class="chip s">${season.name} · ${season.hint}</span>
          <span class="chip g">${state.weather.name}</span>
          <span class="chip n">${t('seasonN', state.seasonIndex + 1, MAX_SEASONS)}</span>
          <span class="chip">${t('marketX', state.marketMod.toFixed(2))}</span>
          ${online() ? `<span class="chip">${session.spectator ? t('watching') : t('youName', me ? me.name : '')}</span>` : (state.players.some((x) => x.cpu) ? '<span class="chip">' + t('vsCpuChip') + '</span>' : '')}
        </div>
      </div>
      <div class="board-stage">
        <div class="board">
          ${TILES.map(tileHtml).join('')}
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
      <div class="panel">
        <h3>${t('farmers')}</h3>
        ${state.players.map(playerCard).join('')}
      </div>
      <div class="panel">
        <h3>${t('yourFields')}</h3>
        ${fieldsPanel()}
      </div>
      <div class="panel dice-panel">
        <h3>${state.phase === 'over' ? t('gameOver') : (mine ? t('yourTurn', p.name) : t('toAct', p.name, p.cpu))}</h3>
        ${diceHtml()}
        <button class="roll-btn" id="roll" ${!mine || state.phase !== 'roll' || rolling ? 'disabled' : ''}>${mine ? t('roll') : (p.cpu ? t('cpuRolling') : t('waitingAct'))}</button>
        <button class="ghost" id="endturn" ${!mine || state.phase !== 'end' ? 'disabled' : ''}>${t('endTurn')}</button>
        ${mine && state.phase === 'end' && !state.labourUsed && farmsOf(state, mySeat()).length
          ? '<div class="tsub" style="font-size:12px;text-align:center">' + t('extraLabour') + '</div>'
          : ''}
        ${cpuNote ? `<p class="cpu-note">${cpuNote}</p>` : ''}
        ${notice ? `<p class="notice">${notice}</p>` : ''}
        ${online() && state.phase !== 'over' ? '<div class="turn-clock" id="turnclock" hidden></div>' : ''}
        <button class="ghost" id="leavegame">${online() ? t('leaveSession') : t('leaveTable')}</button>
      </div>
      <div class="panel">
        <h3>${t('prices')}</h3>
        <div class="prices">
          ${Object.values(CROPS).slice(0, 12).map((c) =>
            `<span><b>${c.name}</b> ${rs(state.prices[c.id])}</span>`
          ).join('')}
        </div>
      </div>
      ${diaryPanel()}
    </div>
  </div>
  ${modalHtml()}`
}

function fieldsPanel() {
  const seat = mySeat()
  const list = farmsOf(state, seat)
  if (!list.length) return '<p class="pcash">' + t('noLand') + '</p>'
  const canWork = isMyTurn() && ((state.phase === 'end' && !state.labourUsed) || (state.pending && state.pending.kind === 'pickFarm'))
  return list.map((f) => {
    const crop = f.crop ? CROPS[f.crop].name : t('fallow')
    return `<button class="seed-btn" data-work="${f.id}" ${canWork && !f.mortgaged ? '' : 'disabled'} style="width:100%;margin-bottom:4px">
      <b>${f.tile.name}</b> · ${f.stage} · ${crop}
    </button>`
  }).join('')
}

function playerCard(p) {
  const nw = netWorth(state, p)
  const on = state.turn === p.id && state.phase !== 'over'
  const you = (online() && p.id === session.you) || (!online() && state.players.some((x) => x.cpu) && p.id === humanSeat)
  const persona = p.persona ? PERSONAS.find((x) => x.id === p.persona) : null
  const tag = p.cpu ? (persona ? persona.name : t('cpu')) : (you ? t('tagYou') : '')
  return `
    <div class="player-card${on ? ' turn' : ''}${p.bankrupt ? ' out' : ''}">
      <div class="swatch" style="background:${p.color}"></div>
      <div>
        <div class="pname">${p.name}${tag ? ' · ' + tag : ''}${state.winner === p.id ? ' · ' + t('harvestKing') : ''}</div>
        <div class="pcash">${rs(p.cash)} · ${t('debt')} ${rs(p.debt)}</div>
      </div>
      <div class="pnet">${rs(nw)}</div>
    </div>`
}

function tileTheme(t) {
  const group = t.group ? GROUPS[t.group] : null
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
  return m[t.type] || { band: '#94A3B8', wash: '#FFFFFF', ink: '#0F172A' }
}

function tileHtml(t) {
  const pos = PLACE[t.id]
  const theme = tileTheme(t)
  const farm = t.type === 'farm' ? state.farms[t.id] : null
  const ownerId = farm
    ? farm.owner
    : (t.type === 'infra' ? state.infra[t.id] : t.type === 'utility' ? state.utilities[t.id] : null)
  const owner = ownerId != null ? state.players[ownerId] : null
  const pins = state.players
    .filter((p) => !p.bankrupt && p.pos === t.id)
    .map((p) => {
      const on = state.turn === p.id && state.phase !== 'over'
      const letter = (p.name || '?').trim().charAt(0).toUpperCase()
      return `<div class="coin${on ? ' active' : ''}" style="--pc:${p.color}" title="${p.name}">${letter}</div>`
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
  const price = t.price ? `<div class="tprice">${rs(t.price)}</div>` : ''
  const cls = [
    'tile',
    t.id % 10 === 0 ? 'corner' : '',
    'kind-' + t.type,
    farm && farm.stage !== 'idle' ? 'has-crop' : ''
  ].filter(Boolean).join(' ')
  return `
    <div class="${cls}" data-tile="${t.id}" title="${t.name}${t.region ? ' · ' + t.region : ''}" style="grid-column:${pos.c};grid-row:${pos.r};--band:${theme.band};--wash:${theme.wash};--ink:${theme.ink}">
      <div class="band">${iconHtml(t.icon)}</div>
      <div class="body">
        <div class="tname">${t.short || t.name}</div>
        <div class="tsub">${t.region || ''}</div>
        ${price}
      </div>
      ${ownerBar}${stage}
      <div class="pins">${pins}</div>
    </div>`
}

function modalHtml() {
  if (state.phase === 'over') {
    const w = state.players[state.winner]
    return `
      <div class="modal-back">
        <div class="modal win">
          <div class="tag">${t('villageDeclares')}</div>
          <h2>${w ? t('isKing', w.name) : t('landKing')}</h2>
          <p>${t('granaries', w ? rs(netWorth(state, w)) : '')}</p>
          <button class="primary" id="again">${t('playAgain')}</button>
        </div>
      </div>`
  }
  if (landing) return landingModal()
  if (inspectId != null) return inspectModal(inspectId)
  if (!isMyTurn()) return ''
  if (state.phase === 'action' && state.pending) return actionModal(state.pending)
  return ''
}

function landingModal() {
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
    <div class="modal-back">
      <div class="modal landing">
        <div class="land-tag" style="color:${player.color}">
          <span class="pin" style="--pc:${player.color}"></span>${player.name} ${t('landsOn')}
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

function actionModal(pending) {
  const p = currentPlayer(state)
  if (pending.kind === 'acquire') {
    const tile = TILES[pending.tileId]
    return wrapModal(`
      <h2>${tile.name}</h2>
      <p>${t('mustOwn', tile.region, GROUPS[tile.group].name, tile.soil)}</p>
      <div class="farm-meta">${t('farmMeta', rs(tile.price), rs(tile.lease), rs(tile.prepare), tile.crops.map((c) => CROPS[c].name).join(', ')).replace('\n', '<br/>')}</div>
      <div class="actions">
        <button class="work-btn gold" data-act="buy" ${p.cash < tile.price ? 'disabled' : ''}>${t('buyLand')}</button>
        <button class="work-btn alt" data-act="lease" ${p.cash < tile.lease ? 'disabled' : ''}>${t('leaseLand')}</button>
        <button class="ghost" data-act="skip">${t('walkOn')}</button>
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
  if (pending.kind === 'farmWork') return farmWorkModal(pending.tileId)
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

function farmWorkModal(tileId) {
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

function wrapModal(inner) {
  return `<div class="modal-back"><div class="modal">${inner}</div></div>`
}

function bindGame() {
  const roll = document.getElementById('roll')
  const end = document.getElementById('endturn')
  const again = document.getElementById('again')
  const leave = document.getElementById('leavegame')
  const landok = document.getElementById('landok')
  if (landok) {
    landok.addEventListener('click', () => {
      landing = landingQueue.shift() || null
      render()
    })
  }
  if (again) {
    again.addEventListener('click', () => {
      leaveSession()
      notice = ''
      render()
    })
  }
  if (leave) {
    leave.addEventListener('click', () => {
      leaveSession({ forget: false })
      notice = t('seatKept')
      render()
    })
  }
  if (roll) {
    roll.addEventListener('click', async () => {
      if (rolling || !isMyTurn() || state.phase !== 'roll') return
      if (await netAct({ type: 'roll' })) return
      rolling = true
      roll.disabled = true
      const dice = rollDice()
      const prevCash = state.players.map((p) => p.cash)
      animateDice(dice[0], dice[1], () => {
        applyMove(state, dice)
        rolling = false
        captureLanding(prevCash)
        render()
      })
    })
  }
  if (end) {
    end.addEventListener('click', async () => {
      if (!isMyTurn()) return
      if (await netAct({ type: 'endTurn' })) return
      nextTurn(state)
      render()
    })
  }
  const diaryPrev = document.getElementById('diaryprev')
  const diaryNext = document.getElementById('diarynext')
  if (diaryPrev) {
    diaryPrev.addEventListener('click', () => {
      if (diaryPage <= 0) return
      diaryPage -= 1
      render()
    })
  }
  if (diaryNext) {
    diaryNext.addEventListener('click', () => {
      if (diaryPage >= diaryPages() - 1) return
      diaryPage += 1
      render()
    })
  }
  document.querySelectorAll('[data-tile]').forEach((el) => {
    el.addEventListener('click', () => inspectTile(Number(el.dataset.tile)))
  })
  document.querySelectorAll('[data-work]').forEach((el) => {
    el.addEventListener('click', () => workField(Number(el.dataset.work)))
  })
  const back = document.querySelector('.modal-back')
  if (back && state.phase !== 'over') {
    back.addEventListener('click', (e) => {
      if (e.target === back && inspectId != null) {
        inspectId = null
        render()
      }
    })
    back.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => handleAct(btn.dataset.act))
    })
    back.querySelectorAll('[data-seed]').forEach((btn) => {
      btn.addEventListener('click', () => sow(btn.dataset.seed))
    })
    back.querySelectorAll('[data-work]').forEach((el) => {
      el.addEventListener('click', () => workField(Number(el.dataset.work)))
    })
  }
}

async function workField(id) {
  if (!isMyTurn()) return
  if (await netAct({ type: 'work', tileId: id })) return
  if (openFarmWork(state, id) || (state.pending && state.pending.kind === 'farmWork')) render()
}

async function sow(crop) {
  if (!isMyTurn()) return
  if (await netAct({ type: 'seed', crop })) return
  seedLand(state, state.pending.tileId, crop)
  render()
}

async function handleAct(act) {
  if (act === 'skip') {
    if (inspectId != null) {
      inspectId = null
      render()
      return
    }
    if (await netAct({ type: 'skip' })) return
    declineAction(state)
    render()
    return
  }
  if (!isMyTurn()) return
  if (await netAct({ type: act })) return
  const pending = state.pending
  if (act === 'buy') buyFarm(state, pending.tileId)
  if (act === 'lease') leaseFarm(state, pending.tileId)
  if (act === 'buyinfra') buyInfra(state, pending.tileId, pending.map)
  if (act === 'prepare') prepareLand(state, pending.tileId)
  if (act === 'tend') tendCrop(state, pending.tileId)
  if (act === 'harvest') harvest(state, pending.tileId)
  if (act === 'irrigate') irrigate(state, pending.tileId)
  if (act === 'insure') insure(state, pending.tileId)
  if (act === 'unmortgage') unmortgage(state, pending.tileId)
  if (act === 'fci') sellToFci(state)
  if (act === 'loan') {
    takeLoan(state)
    declineAction(state)
  }
  if (act === 'repay') {
    repayLoan(state, LOAN_STEP)
    declineAction(state)
  }
  render()
}

function inspectModal(id) {
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

function inspectTile(id) {
  if (state.phase === 'over') return
  if (isMyTurn() && state.pending && state.pending.kind === 'pickFarm') {
    workField(id)
    return
  }
  if (isMyTurn() && state.phase === 'end' && !state.labourUsed) {
    workField(id)
    return
  }
  if (isMyTurn() && state.phase === 'action') return
  inspectId = id
  render()
}

async function boot() {
  const params = new URLSearchParams(location.search)
  const joinCode = (params.get('join') || '').toUpperCase()
  if (session && session.token) {
    try {
      const snap = await waitSnapshot(session)
      applySnap(snap)
      watchEvents()
      startPresence()
      return
    } catch (err) {
      const msg = String(err && err.message || '')
      try {
        await resumeSeat(session.code, session.token, session.name)
        startPresence()
        return
      } catch {
        if (/not found|lost/i.test(msg)) leaveSession()
        else leaveSession({ forget: false })
      }
    }
  }
  if (joinCode) {
    const seat = savedSeat(joinCode)
    if (seat && seat.token) {
      try {
        await resumeSeat(joinCode, seat.token, seat.name)
        startPresence()
        return
      } catch {
        forgetSeat(joinCode)
      }
    }
    screen = 'lobby'
    render()
    const input = document.getElementById('joincode')
    if (input) input.value = joinCode
    startPresence()
    return
  }
  render()
  startPresence()
}

boot()
