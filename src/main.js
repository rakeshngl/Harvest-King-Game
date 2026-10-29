import { PLAYER_PALETTE, LOAN_STEP, DEFAULT_PRESET } from './data.js'
import { animateDice, setDiceFace } from './dice.js'
import {
  createGame, currentPlayer, applyMove, rollDice,
  buyFarm, leaseFarm, buyInfra, prepareLand, seedLand, irrigate, insure,
  harvest, tendCrop, sellToFci, takeLoan, repayLoan, declineAction, nextTurn,
  unmortgage, openFarmWork, actingSeat, bidAuction, passAuction, offerTrade,
  acceptTrade, rejectTrade, finalStandings, presetById, seasonOf
} from './engine.js'
import { blankProfile, applyMatch } from './profile.js'
import {
  createRoom, joinRoom, startRoom, sendAction, waitSnapshot, openEventStream,
  kickSeat, passHost, setPreset, addCpu, loadSession, saveSession, savedSeat, savedSeats, forgetSeat, pingPresence, fetchLobby, fetchProfile
} from './net.js'
import { PERSONAS, CPU_NAMES, chooseAction, describeAction } from './ai.js'
import { t, setLang, currentLang } from './i18n.js'
import { playCue, isMuted, toggleMute, toggleMusic, startMusic, stopMusic, setMusicScene } from './sound.js'
import { fmtCount } from './format.js'
import { todayKey, dailyCode } from './rng.js'
import { registerPwa } from './pwa.js'
import { TUTORIAL_STEPS, loadTutorialSeen, saveTutorialSeen, clampTutorialStep } from './tutorial.js'
import { tutorialHtml } from './chrome.js'
import { lobbyHtml as lobbyView, waitingHtml as waitingView, openTablesHtml, profileHtml, nameInputs } from './lobby.js'
import { gameHtml as gameView, diaryPages } from './hud.js'

const app = document.getElementById('app')

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
let presetChoice = DEFAULT_PRESET
let draftName = ''
let diaryPage = 0
let wasOver = false
let hallStats = { visits: 0, online: 0, playing: 0 }
let clockTimer = 0
let openTables = []
let visitorId = ''
let myProfile = null
let profileSeq = 0
let presenceOn = false
let lineOn = typeof navigator === 'undefined' || navigator.onLine !== false
let sideTab = 'farmers'
let tradeDraft = { to: '', cashGive: '', cashTake: '', landGive: '', landTake: '', debtGive: '', debtTake: '' }
let tradeOpen = false
let tutorialOn = !loadTutorialSeen()
let tutorialStep = 0

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

function myVisitor() {
  if (!visitorId) visitorId = visitorKey()
  return visitorId
}

async function loadProfile() {
  const seqNow = ++profileSeq
  try {
    const data = await fetchProfile(myVisitor())
    if (seqNow !== profileSeq) return
    myProfile = data
    paintProfile()
  } catch {
    /* ignore */
  }
}

function closeTutorial() {
  tutorialOn = false
  tutorialStep = 0
  saveTutorialSeen()
}

function bindTutorial() {
  const root = document.getElementById('tutorial')
  if (!root) return
  const skip = document.getElementById('tutskip')
  const next = document.getElementById('tutnext')
  const back = document.getElementById('tutback')
  if (skip) skip.addEventListener('click', () => { closeTutorial(); render() })
  if (next) {
    next.addEventListener('click', () => {
      if (tutorialStep >= TUTORIAL_STEPS.length - 1) closeTutorial()
      else tutorialStep = clampTutorialStep(tutorialStep + 1)
      render()
    })
  }
  if (back) {
    back.addEventListener('click', () => {
      tutorialStep = clampTutorialStep(tutorialStep - 1)
      render()
    })
  }
  root.querySelectorAll('[data-tutstep]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tutorialStep = clampTutorialStep(Number(btn.getAttribute('data-tutstep')))
      render()
    })
  })
}

function finishPaint() {
  bindLang()
  if (tutorialOn) {
    app.insertAdjacentHTML('beforeend', tutorialHtml(tutorialOn, tutorialStep))
    bindTutorial()
  }
  maybePlayWin()
}

function bindLang() {
  document.documentElement.lang = currentLang()
  const root = document.getElementById('langtoggle')
  if (root) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lang]')
      if (!b) return
      setLang(b.getAttribute('data-lang'))
      render()
    })
  }
  const sound = document.getElementById('soundtoggle')
  if (sound) {
    sound.addEventListener('click', () => {
      toggleMute()
      if (!isMuted()) playCue('coin')
      render()
    })
  }
  const music = document.getElementById('musictoggle')
  if (music) {
    music.addEventListener('click', () => {
      toggleMusic()
      render()
    })
  }
  const help = document.getElementById('helptoggle')
  if (help) {
    help.addEventListener('click', () => {
      tutorialStep = 0
      tutorialOn = true
      render()
    })
  }
}

function syncMusic() {
  const inGame = (screen === 'game') && !!state && state.phase !== 'over'
  if (!inGame) {
    stopMusic()
    return
  }
  setMusicScene(seasonOf(state).id, state.weather.id)
  startMusic()
}

function localRecord() {
  try {
    return JSON.parse(localStorage.getItem('hk-record') || 'null')
  } catch {
    return null
  }
}

function saveLocalRecord(prof) {
  try {
    localStorage.setItem('hk-record', JSON.stringify(prof))
  } catch {
    /* ignore */
  }
}

function recordLocalResult() {
  if (!state || state.phase !== 'over' || online()) return
  const mine = humanSeat
  const rows = finalStandings(state)
  const row = rows.find((r) => r.id === mine)
  if (!row) return
  const prof = applyMatch(localRecord() || blankProfile(myVisitor(), draftName), {
    at: Date.now(),
    code: state.daily ? dailyCode(state.daily) : 'LOCAL',
    seats: state.players.length,
    rank: row.rank,
    net: row.net,
    won: row.won,
    bankrupt: row.bankrupt,
    name: draftName,
    seasons: (state.seasonIndex || 0) + 1
  })
  saveLocalRecord(prof)
}

function paintProfile() {
  const root = document.getElementById('myrecord')
  if (root) root.innerHTML = profileHtml(myProfile, localRecord())
}

async function pulsePresence() {
  const playing = screen === 'game' || screen === 'waiting'
  try {
    hallStats = await pingPresence(myVisitor(), playing)
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

function watchLine() {
  if (typeof window === 'undefined') return
  const paint = () => {
    const next = navigator.onLine !== false
    if (next === lineOn) return
    lineOn = next
    render()
  }
  window.addEventListener('online', paint)
  window.addEventListener('offline', paint)
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
    cueForLanding(landing)
    return
  }
  landingQueue = []
  landing = items[items.length - 1]
  cueForLanding(landing)
}

function cueForLanding(item) {
  if (!item || !item.entries) return
  const text = item.entries.map((e) => (typeof e === 'string' ? e : e.text || '')).join(' ')
  if (text.includes('insolvent')) {
    playCue('insolvent')
    return
  }
  if (text.includes('harvests')) {
    playCue('harvest')
    return
  }
  if (item.delta != null && item.delta > 0) {
    playCue('coin')
    return
  }
  if (item.delta != null && item.delta < 0) playCue('loss')
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
  const p = state.players[actingSeat(state)]
  return !!(p && p.cpu && !p.bankrupt)
}

function isMyTurn() {
  if (!state) return false
  if (state.phase === 'over') return false
  const actor = actingSeat(state)
  if (state.players[actor]?.bankrupt) return false
  if (landing) return false
  if (online()) return !session.spectator && session.you === actor
  if (state.players.some((p) => p.cpu)) {
    return !state.players[actor].cpu
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
  loadProfile()
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
  const snap = await joinRoom(code, name || '', { token, visitor: visitorKey() })
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
      playCue('dice')
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
  if (state.players[actingSeat(state)]?.bankrupt) {
    if (state.pending) declineAction(state)
    else nextTurn(state)
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
    const dice = rollDice(state)
    const prevCash = state.players.map((p) => p.cash)
    render()
    const gen = cpuGen
    playCue('dice')
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
  } else if (action.type === 'bid') ok = bidAuction(state, action.amount)
  else if (action.type === 'passbid') ok = passAuction(state)
  else if (action.type === 'accept') ok = acceptTrade(state)
  else if (action.type === 'reject') ok = rejectTrade(state)
  else if (action.type === 'offer') ok = offerTrade(state, action.offer || action)
  else if (action.type === 'skip') declineAction(state)
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

function maybePlayWin() {
  const over = !!(state && state.phase === 'over')
  if (over && !wasOver) {
    recordLocalResult()
    playCue('win')
  }
  wasOver = over
}

function lobbyHtml() {
  return lobbyView({
    lineOn,
    notice,
    hallStats,
    draftName,
    openTables,
    myProfile,
    local: localRecord(),
    presetChoice,
    seats: savedSeats()
  })
}

function waitingHtml() {
  return waitingView({ lineOn, notice, room, session })
}

function gameHtml() {
  return gameView(state, {
    lineOn,
    notice,
    cpuNote,
    rolling,
    online: online(),
    session,
    mySeat: mySeat(),
    isMyTurn: isMyTurn(),
    humanSeat,
    sideTab,
    diaryPage,
    tradeOpen,
    tradeDraft,
    landing,
    landingQueue,
    inspectId
  })
}

function render() {
  document.documentElement.lang = currentLang()
  syncMusic()
  if (screen === 'lobby' && !state) {
    app.innerHTML = lobbyHtml()
    bindLobby()
    finishPaint()
    return
  }
  if (screen === 'waiting') {
    app.innerHTML = waitingHtml()
    bindWaiting()
    finishPaint()
    return
  }
  app.innerHTML = gameHtml()
  bindGame()
  finishPaint()
  if (state) setDiceFace(state.lastDice[0], state.lastDice[1])
  if (online() && state && state.phase !== 'over') {
    startClock()
    paintClock()
  } else {
    stopClock()
  }
  scheduleCpu()
}

function paintOpenTables() {
  const root = document.getElementById('opentables')
  if (!root) return
  root.innerHTML = openTablesHtml(openTables)
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
        const snap = await joinRoom(code, name, { visitor: visitorKey() })
        enterOnline(snap, { name })
      } catch (err) {
        notice = err.message
        render()
      }
    })
  })
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
  state = createGame(n, list, { ...opts, preset: opts.preset || presetChoice })
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
  const presets = document.getElementById('presets')
  if (presets) {
    presets.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]')
      if (!b) return
      presetChoice = presetById(b.getAttribute('data-preset')).id
      presets.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('on', x === b))
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
  document.getElementById('daily').addEventListener('click', () => {
    const you = requireFarmerName()
    if (!you) return
    cpuDifficulty = 'normal'
    const per = PERSONAS[0]
    startLocalGame(2, [you, CPU_NAMES[per.id] || per.name], {
      cpu: [false, true],
      persona: [null, per.id],
      daily: todayKey(),
      preset: 'classic'
    })
  })
  document.getElementById('create').addEventListener('click', async () => {
    const name = requireFarmerName()
    if (!name) return
    try {
      notice = ''
      const password = (document.getElementById('roompass').value || '').trim()
      const snap = await createRoom(name, { password, visitor: visitorKey(), preset: presetChoice })
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
      const snap = await joinRoom(code, name, { password, visitor: visitorKey() })
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
      const snap = await joinRoom(code, name, { watch: true, password, visitor: visitorKey() })
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
  loadProfile()
  fetchLobby().then((tables) => {
    openTables = tables
    paintOpenTables()
  }).catch(() => {})
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
  const onlinePreset = document.getElementById('onlinepreset')
  if (onlinePreset) {
    onlinePreset.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-onlinepreset]')
      if (!b) return
      try {
        notice = ''
        const snap = await setPreset(session, b.getAttribute('data-onlinepreset'))
        applySnap(snap)
      } catch (err) {
        notice = err.message
        render()
      }
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
      playCue('dice')
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

function bindGame() {
  const roll = document.getElementById('roll')
  const end = document.getElementById('endturn')
  const again = document.getElementById('again')
  const leave = document.getElementById('leavegame')
  const landok = document.getElementById('landok')
  if (landok) {
    landok.addEventListener('click', () => {
      landing = landingQueue.shift() || null
      cueForLanding(landing)
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
      const dice = rollDice(state)
      const prevCash = state.players.map((p) => p.cash)
      playCue('dice')
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
  document.querySelectorAll('[data-sidetab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sideTab = btn.getAttribute('data-sidetab')
      render()
    })
  })
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
      if (diaryPage >= diaryPages(state) - 1) return
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
  bindTradeForm()
}

function readTradeDraft() {
  const toEl = document.getElementById('tradeto')
  const giveEl = document.getElementById('tradecashgive')
  const takeEl = document.getElementById('tradecashtake')
  const landGiveEl = document.getElementById('tradelandgive')
  const landTakeEl = document.getElementById('tradelandtake')
  const debtGiveEl = document.getElementById('tradedebtgive')
  const debtTakeEl = document.getElementById('tradedebttake')
  if (toEl) tradeDraft.to = toEl.value
  if (giveEl) tradeDraft.cashGive = giveEl.value
  if (takeEl) tradeDraft.cashTake = takeEl.value
  if (landGiveEl) tradeDraft.landGive = landGiveEl.value
  if (landTakeEl) tradeDraft.landTake = landTakeEl.value
  if (debtGiveEl) tradeDraft.debtGive = debtGiveEl.value
  if (debtTakeEl) tradeDraft.debtTake = debtTakeEl.value
}

function bindTradeForm() {
  const openBtn = document.getElementById('tradeopen')
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (!isMyTurn()) return
      tradeOpen = true
      render()
    })
  }
  const cancelBtn = document.getElementById('tradecancel')
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      readTradeDraft()
      tradeOpen = false
      render()
    })
  }
  const offer = document.getElementById('tradeoffer')
  const toEl = document.getElementById('tradeto')
  if (toEl) {
    toEl.addEventListener('change', () => {
      readTradeDraft()
      tradeDraft.landTake = ''
      render()
    })
  }
  ;['tradecashgive', 'tradecashtake', 'tradelandgive', 'tradelandtake', 'tradedebtgive', 'tradedebttake'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('change', readTradeDraft)
  })
  if (offer) {
    offer.addEventListener('click', async () => {
      if (!isMyTurn() || state.phase !== 'end' || state.pending) return
      readTradeDraft()
      const payload = {
        type: 'offer',
        to: Number(tradeDraft.to),
        cashGive: Number(tradeDraft.cashGive) || 0,
        cashTake: Number(tradeDraft.cashTake) || 0,
        landGive: tradeDraft.landGive === '' ? null : Number(tradeDraft.landGive),
        landTake: tradeDraft.landTake === '' ? null : Number(tradeDraft.landTake),
        debtGive: Number(tradeDraft.debtGive) || 0,
        debtTake: Number(tradeDraft.debtTake) || 0
      }
      tradeOpen = false
      if (await netAct(payload)) return
      offerTrade(state, payload)
      render()
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
  if (act === 'bid') {
    if (!isMyTurn()) return
    const a = state.pending
    const floor = a && a.highBid > 0 ? a.highBid + 100 : (a ? a.minBid : 0)
    if (await netAct({ type: 'bid', amount: floor })) return
    bidAuction(state, floor)
    render()
    return
  }
  if (act === 'passbid') {
    if (!isMyTurn()) return
    if (await netAct({ type: 'passbid' })) return
    passAuction(state)
    render()
    return
  }
  if (act === 'accept') {
    if (!isMyTurn()) return
    if (await netAct({ type: 'accept' })) return
    acceptTrade(state)
    render()
    return
  }
  if (act === 'reject') {
    if (!isMyTurn()) return
    if (await netAct({ type: 'reject' })) return
    rejectTrade(state)
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

watchLine()
registerPwa()
boot()
