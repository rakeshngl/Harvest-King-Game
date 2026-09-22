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
  createRoom, joinRoom, startRoom, sendAction, waitSnapshot,
  loadSession, saveSession
} from './net.js'
import { PERSONAS, CPU_NAMES, chooseAction, describeAction } from './ai.js'

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

function rs(n) {
  return 'Rs ' + Math.round(n).toLocaleString('en-IN')
}

function logIdOf(e) {
  return typeof e === 'string' ? 0 : (e.id || 0)
}

function syncLog() {
  seenLogId = (state && state.log ? state.log : []).reduce((m, e) => Math.max(m, logIdOf(e)), 0)
}

function captureLanding(prevCash) {
  if (!state) return
  const fresh = (state.log || []).filter((e) => typeof e !== 'string' && e.id > seenLogId)
  if (!fresh.length) return
  seenLogId = fresh.reduce((m, e) => Math.max(m, logIdOf(e)), seenLogId)
  const roll = fresh.find((e) => e.kind === 'roll')
  if (!roll) return
  const meta = roll.meta || {}
  const pid = meta.pid != null ? meta.pid : state.turn
  const player = state.players[pid]
  const tileId = meta.tileId != null ? meta.tileId : (player ? player.pos : 0)
  const before = prevCash && prevCash[pid] != null ? prevCash[pid] : null
  const after = player ? player.cash : null
  landing = {
    pid,
    tileId,
    entries: fresh.slice().reverse(),
    delta: before != null && after != null ? after - before : null
  }
}

function diaryRow(e) {
  const kind = typeof e === 'string' ? 'info' : (e.kind || 'info')
  const text = typeof e === 'string' ? e : e.text
  return `<div class="log-line ${kind}"><span class="dot"></span><span class="txt">${text}</span></div>`
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
  if (online()) return session.you === state.turn
  if (state.players.some((p) => p.cpu)) {
    return !state.players[state.turn].cpu && state.turn === humanSeat
  }
  return true
}

function leaveSession() {
  pollOn = false
  session = null
  room = null
  state = null
  seq = 0
  lastRollSeq = 0
  inspectId = null
  rolling = false
  screen = 'lobby'
  seenLogId = 0
  landing = null
  cpuBusy = false
  cpuNote = ''
  cpuGuard = 0
  cpuGen += 1
  humanSeat = 0
  saveSession(null)
}

function applySnap(snap, opts = {}) {
  seq = snap.seq
  room = snap
  session = { ...session, code: snap.code, you: snap.you }
  saveSession(session)
  if (snap.started && snap.state) {
    const diceChanged = !opts.fromSelfRoll && snap.rollSeq > lastRollSeq
    lastRollSeq = snap.rollSeq
    const prevCash = state ? state.players.map((p) => p.cash) : null
    state = snap.state
    screen = 'game'
    if (diceChanged && snap.lastDice) {
      rolling = true
      render()
      animateDice(snap.lastDice[0], snap.lastDice[1], () => {
        rolling = false
        captureLanding(prevCash)
        render()
      })
      return
    }
    if (opts.capture) captureLanding(prevCash)
    else syncLog()
  } else {
    state = null
    screen = 'waiting'
    syncLog()
  }
  render()
}

async function pollLoop() {
  if (pollOn) return
  pollOn = true
  while (pollOn && session) {
    try {
      const snap = await waitSnapshot(session, seq)
      if (!pollOn) return
      if (snap.seq !== seq || snap.started !== (screen === 'game')) {
        applySnap(snap)
      } else if (screen === 'waiting') {
        room = snap
        render()
      }
    } catch (err) {
      if (!pollOn) return
      notice = err.message || 'Connection lost'
      if (/not found|lost/i.test(notice)) {
        leaveSession()
        render()
        return
      }
      render()
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
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
  if (screen === 'lobby' && !state) {
    app.innerHTML = lobbyHtml()
    bindLobby()
    return
  }
  if (screen === 'waiting') {
    app.innerHTML = waitingHtml()
    bindWaiting()
    return
  }
  app.innerHTML = gameHtml()
  bindGame()
  if (state) setDiceFace(state.lastDice[0], state.lastDice[1])
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
      ${notice ? `<p class="notice">${notice}</p>` : ''}
      <div class="farmer-bar">
        <div>
          <div class="en">Take a seat</div>
          <p>Choose a farmer name, then pick how you want to play.</p>
        </div>
        <input id="myname" maxlength="16" placeholder="Your farmer name" value="${draftName}" required />
      </div>
      <div class="mode-grid">
        <article class="mode-card mode-online">
          <div class="mode-kicker">Online table</div>
          <h2>Play with friends</h2>
          <p>Create a room, share a 4-letter code, and farm together from any browser. Two to four seats. Host starts the match.</p>
          <button class="primary" id="create">Create session</button>
          <div class="mode-split">or join with a code</div>
          <div class="names">
            <input id="joincode" maxlength="6" placeholder="ABCD" />
            <button class="primary" id="join">Join</button>
          </div>
        </article>
        <article class="mode-card mode-cpu">
          <div class="mode-kicker">Solo campaign</div>
          <h2>Vs computer</h2>
          <p>You farm. Scripted rivals — Thrifty, Landlord, Gambler, Banker — buy, sow and harvest on their own turns.</p>
          <div class="count-row" id="cpucounts">
            ${[2, 3, 4].map((n) => `<button class="count-btn${n === 2 ? ' on' : ''}" data-cpu="${n}">${n === 2 ? '1 rival' : (n - 1) + ' rivals'}</button>`).join('')}
          </div>
          <div class="count-row" id="cpudiff">
            ${['easy', 'normal', 'hard'].map((d) => `<button class="count-btn${d === 'normal' ? ' on' : ''}" data-diff="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
          </div>
          <button class="primary" id="vscpu">Play vs computer</button>
        </article>
        <article class="mode-card mode-local">
          <div class="mode-kicker">One device</div>
          <h2>Pass and play</h2>
          <p>Hand the tablet around the table. Name every farmer, then take turns on the same screen.</p>
          <div class="count-row" id="counts">
            ${[2, 3, 4].map((n) => `<button class="count-btn${n === 2 ? ' on' : ''}" data-n="${n}">${n} farmers</button>`).join('')}
          </div>
          <div class="names" id="names">${nameInputs(2)}</div>
          <button class="primary" id="start">Pass-and-play</button>
        </article>
      </div>
      <section class="guide">
        <header class="guide-head">
          <div class="en">Village handbook</div>
          <h2>How to become Harvest King</h2>
          <p>A farming cycle on a 40-tile board. Two to four farmers. First to Rs 75,000 net worth — or the richest after 18 seasons — takes the crown.</p>
        </header>
        <div class="guide-grid">
          <article class="guide-card">
            <div class="guide-num">01</div>
            <h3>Claim the land</h3>
            <p>Buy or lease a plot before any work. Lease lasts three circuits and is cheaper. Owning a full regional belt doubles rent and lifts harvest yield.</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">02</div>
            <h3>Prepare, then sow</h3>
            <p>Idle fields must be prepared. Then sow a crop the belt supports. Off-season seed costs 35% extra and dents fertility. Match monsoon, winter, or summer.</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">03</div>
            <h3>Grow and harvest</h3>
            <p>Crops ripen over turns. Weather, pests, irrigation and market prices decide profit or loss. Irrigate, insure or tend before you cut the crop.</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">04</div>
            <h3>One labour a turn</h3>
            <p>After you land, you may work one owned field — prepare, sow, tend or harvest — then end the turn. Village Hall and the Farm Fair can grant extra labour.</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">05</div>
            <h3>Read every landing</h3>
            <p>Dice, cards, tax and cash changes appear in a pop-up, then the Farm diary. Vs computer waits on Continue so you see the rival's tile before they act.</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">06</div>
            <h3>Table manners</h3>
            <p>Online: only the farmer whose turn it is can roll and act. Pass-and-play shares one screen. Vs computer rivals use the same legal moves as you.</p>
          </article>
        </div>
        <div class="guide-strip">
          <div>
            <h4>Seasons</h4>
            <p>Monsoon, Winter, Summer. Eighteen seasons, then the richest farmer wins.</p>
          </div>
          <div>
            <h4>Weather</h4>
            <p>Fair skies, monsoon, drought, flood or hail. Water-loving crops need canals or a good rain.</p>
          </div>
          <div>
            <h4>Rural bank</h4>
            <p>Crop loans in Rs 3,000 steps, cap Rs 9,000, 12% interest each new season.</p>
          </div>
          <div>
            <h4>Infrastructure</h4>
            <p>Tractor, cold store, seed bank, market yard, canal and borewell lift yield or cut costs.</p>
          </div>
        </div>
      </section>
    </main>
  </div>`
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
  notice = 'Choose a farmer name, then pick how you want to play.'
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
      const snap = await createRoom(name)
      session = { code: snap.code, token: snap.token, you: snap.you }
      saveSession(session)
      applySnap(snap)
      pollLoop()
    } catch (err) {
      notice = err.message
      render()
    }
  })
  document.getElementById('join').addEventListener('click', async () => {
    const name = requireFarmerName()
    if (!name) return
    const code = document.getElementById('joincode').value.trim()
    try {
      notice = ''
      const snap = await joinRoom(code, name)
      session = { code: snap.code, token: snap.token, you: snap.you }
      saveSession(session)
      applySnap(snap)
      pollLoop()
    } catch (err) {
      notice = err.message
      render()
    }
  })
}

function waitingHtml() {
  const players = (room && room.players) || []
  const host = session && session.you === 0
  const share = location.origin + location.pathname + '?join=' + (session ? session.code : '')
  return `
  <div class="lobby">
    <div class="lobby-card">
      <div class="en">Waiting in the lobby</div>
      <h1>Room ${session ? session.code : ''}</h1>
      <p class="lead">Share this code or link. Need 2 farmers to begin, 4 at most. You are the ${PLAYER_PALETTE[session.you].name} pin.</p>
      <div class="session-code">${session ? session.code : ''}</div>
      <p class="pcash" style="margin:8px 0 16px;word-break:break-all">${share}</p>
      <div class="waiting-list">
        ${players.map((p) => `
          <div class="player-card${p.seat === session.you ? ' turn' : ''}">
            <div class="swatch" style="background:${PLAYER_PALETTE[p.seat].color}"></div>
            <div>
              <div class="pname">${p.name}${p.seat === 0 ? ' · host' : ''}${p.seat === session.you ? ' · you' : ''}</div>
              <div class="pcash">${p.connected ? 'seated' : 'away'}</div>
            </div>
          </div>`).join('')}
        ${Array.from({ length: 4 - players.length }, (_, i) => `
          <div class="player-card" style="opacity:.45">
            <div class="swatch" style="background:#ccc"></div>
            <div class="pname">Open seat ${players.length + i + 1}</div>
          </div>`).join('')}
      </div>
      ${notice ? `<p class="notice">${notice}</p>` : ''}
      <div class="actions">
        ${host ? `<button class="primary" id="opengame" ${players.length < 2 ? 'disabled' : ''}>Start game</button>` : '<p class="pcash">Waiting for the host to start the game.</p>'}
        <button class="ghost" id="leave">Leave</button>
      </div>
    </div>
  </div>`
}

function bindWaiting() {
  const leave = document.getElementById('leave')
  if (leave) leave.addEventListener('click', () => {
    leaveSession()
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
          <div class="en" style="letter-spacing:.2em;font-size:10px">INDIAN FARMING${online() ? ' · ' + session.code : ''}</div>
        </div>
        <div class="meta">
          <span class="chip s">${season.name} · ${season.hint}</span>
          <span class="chip g">${state.weather.name}</span>
          <span class="chip n">Season ${state.seasonIndex + 1}/${MAX_SEASONS}</span>
          <span class="chip">Market x${state.marketMod.toFixed(2)}</span>
          ${online() ? `<span class="chip">You: ${me ? me.name : ''}</span>` : (state.players.some((x) => x.cpu) ? '<span class="chip">You vs computer</span>' : '')}
        </div>
      </div>
      <div class="board-stage">
        <div class="board">
          ${TILES.map(tileHtml).join('')}
          <div class="center">
            <div class="center-inner">
              <div class="chakra">${iconHtml('chakra')}</div>
              <div class="tag">Indian Farming</div>
              <h2>Harvest King</h2>
              <div class="wx">${state.weather.name}<br/>${state.weather.text}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="side">
      <div class="panel">
        <h3>Farmers</h3>
        ${state.players.map(playerCard).join('')}
      </div>
      <div class="panel">
        <h3>Your fields</h3>
        ${fieldsPanel()}
      </div>
      <div class="panel dice-panel">
        <h3>${state.phase === 'over' ? 'Game over' : (mine ? p.name + ' — your turn' : p.name + (p.cpu ? ' (computer)' : '') + ' to act')}</h3>
        ${diceHtml()}
        <button class="roll-btn" id="roll" ${!mine || state.phase !== 'roll' || rolling ? 'disabled' : ''}>${mine ? 'Roll the dice' : (p.cpu ? 'Computer rolling' : 'Waiting')}</button>
        <button class="ghost" id="endturn" ${!mine || state.phase !== 'end' ? 'disabled' : ''}>End turn</button>
        ${mine && state.phase === 'end' && !state.labourUsed && farmsOf(state, mySeat()).length
          ? '<div class="tsub" style="font-size:12px;text-align:center">Extra labour: work one owned field before ending.</div>'
          : ''}
        ${cpuNote ? `<p class="cpu-note">${cpuNote}</p>` : ''}
        ${notice ? `<p class="notice">${notice}</p>` : ''}
        <button class="ghost" id="leavegame">${online() ? 'Leave session' : 'Leave table'}</button>
      </div>
      <div class="panel">
        <h3>Market prices</h3>
        <div class="prices">
          ${Object.values(CROPS).slice(0, 12).map((c) =>
            `<span><b>${c.name}</b> ${rs(state.prices[c.id])}</span>`
          ).join('')}
        </div>
      </div>
      <div class="panel">
        <h3>Farm diary</h3>
        <div class="log">${state.log.slice(0, 12).map(diaryRow).join('')}</div>
      </div>
    </div>
  </div>
  ${modalHtml()}`
}

function fieldsPanel() {
  const seat = mySeat()
  const list = farmsOf(state, seat)
  if (!list.length) return '<p class="pcash">No land yet. Buy or lease a plot you land on.</p>'
  const canWork = isMyTurn() && ((state.phase === 'end' && !state.labourUsed) || (state.pending && state.pending.kind === 'pickFarm'))
  return list.map((f) => {
    const crop = f.crop ? CROPS[f.crop].name : 'fallow'
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
  const tag = p.cpu ? (persona ? persona.name : 'CPU') : (you ? 'you' : '')
  return `
    <div class="player-card${on ? ' turn' : ''}${p.bankrupt ? ' out' : ''}">
      <div class="swatch" style="background:${p.color}"></div>
      <div>
        <div class="pname">${p.name}${tag ? ' · ' + tag : ''}${state.winner === p.id ? ' · Harvest King' : ''}</div>
        <div class="pcash">${rs(p.cash)} · debt ${rs(p.debt)}</div>
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
          <div class="tag">The village declares</div>
          <h2>${w ? w.name : 'The land'} is Harvest King</h2>
          <p>Net worth ${w ? rs(netWorth(state, w)) : ''}. The granaries are full.</p>
          <button class="primary" id="again">Play again</button>
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
    ? 'Settled'
    : delta === 0
      ? 'No cash change'
      : (delta > 0 ? '+' : '-') + rs(Math.abs(delta))
  const sub = tile ? (tile.region || tile.sub || (tile.group ? GROUPS[tile.group].name : '')) : ''
  return `
    <div class="modal-back">
      <div class="modal landing">
        <div class="land-tag" style="color:${player.color}">
          <span class="pin" style="--pc:${player.color}"></span>${player.name} lands on
        </div>
        <div class="land-head">
          <div class="land-icon" style="border-color:${player.color}">${tile ? iconHtml(tile.icon) : ''}</div>
          <div>
            <h2>${tile ? tile.name : 'the board'}</h2>
            <p class="land-sub">${sub}</p>
          </div>
        </div>
        <div class="land-events">${landing.entries.map(diaryRow).join('')}</div>
        <div class="land-net ${netCls}">${netTxt}</div>
        <div class="actions"><button class="primary" id="landok">Continue</button></div>
      </div>
    </div>`
}

function actionModal(pending) {
  const p = currentPlayer(state)
  if (pending.kind === 'acquire') {
    const t = TILES[pending.tileId]
    return wrapModal(`
      <h2>${t.name}</h2>
      <p>${t.region} · ${GROUPS[t.group].name}. Soil ${t.soil}. You must own or lease before preparing and sowing.</p>
      <div class="farm-meta">Buy ${rs(t.price)} · Lease ${rs(t.lease)} for 3 circuits · Prepare ${rs(t.prepare)}<br/>Crops: ${t.crops.map((c) => CROPS[c].name).join(', ')}</div>
      <div class="actions">
        <button class="work-btn gold" data-act="buy" ${p.cash < t.price ? 'disabled' : ''}>Purchase land</button>
        <button class="work-btn alt" data-act="lease" ${p.cash < t.lease ? 'disabled' : ''}>Lease land</button>
        <button class="ghost" data-act="skip">Walk on</button>
      </div>`)
  }
  if (pending.kind === 'buyInfra') {
    const t = TILES[pending.tileId]
    return wrapModal(`
      <h2>${t.name}</h2>
      <p>${t.sub}. Infrastructure shifts every harvest around the board.</p>
      <div class="actions">
        <button class="work-btn gold" data-act="buyinfra" ${p.cash < t.price ? 'disabled' : ''}>Buy for ${rs(t.price)}</button>
        <button class="ghost" data-act="skip">Pass</button>
      </div>`)
  }
  if (pending.kind === 'farmWork') return farmWorkModal(pending.tileId)
  if (pending.kind === 'fci') {
    const ready = farmsOf(state, p.id).filter((f) => f.stage === 'ripe' || (f.stage === 'seeded' && f.growLeft <= 0))
    return wrapModal(`
      <h2>Food Warehouse</h2>
      <p>The food warehouse will lift ripe grain at a 10% support-price premium. Ready lots: ${ready.length}.</p>
      <div class="actions">
        <button class="work-btn alt" data-act="fci" ${ready.length ? '' : 'disabled'}>Sell to warehouse</button>
        <button class="ghost" data-act="skip">Keep grain</button>
      </div>`)
  }
  if (pending.kind === 'nabard') {
    return wrapModal(`
      <h2>Rural Bank</h2>
      <p>Crop loan ${rs(LOAN_STEP)}. Cap ${rs(LOAN_CAP)}. Interest 12% each new season. Your debt ${rs(p.debt)}.</p>
      <div class="actions">
        <button class="work-btn gold" data-act="loan" ${p.debt >= LOAN_CAP ? 'disabled' : ''}>Take loan</button>
        <button class="work-btn" data-act="repay" ${p.debt <= 0 || p.cash <= 0 ? 'disabled' : ''}>Repay ${rs(Math.min(p.debt, p.cash, LOAN_STEP))}</button>
        <button class="ghost" data-act="skip">Leave desk</button>
      </div>`)
  }
  if (pending.kind === 'card') {
    return wrapModal(`
      <h2>${pending.deck}</h2>
      <p><b>${pending.card.title}</b><br/>${pending.card.text}</p>
      <div class="actions"><button class="primary" data-act="skip">Continue</button></div>`)
  }
  if (pending.kind === 'pickFarm') {
    const list = farmsOf(state, p.id)
    return wrapModal(`
      <h2>Choose a field</h2>
      <p>${pending.reason}</p>
      <div class="crops">
        ${list.map((f) => `<button class="seed-btn" data-work="${f.id}"><b>${f.tile.name}</b><br/>${f.stage}${f.crop ? ' · ' + CROPS[f.crop].name : ''}</button>`).join('')}
      </div>
      <div class="actions"><button class="ghost" data-act="skip">Skip labour</button></div>`)
  }
  return ''
}

function farmWorkModal(tileId) {
  const t = TILES[tileId]
  const f = state.farms[tileId]
  const p = currentPlayer(state)
  const season = seasonOf(state).id
  let body = `
    <h2>${t.name}</h2>
    <div class="farm-meta">
      Stage: <b>${f.stage}</b>${f.crop ? ' · ' + CROPS[f.crop].name : ''}
      · Fertility ${(f.fertility * 100).toFixed(0)}%
      · ${f.irrigated ? 'Irrigated' : 'Rainfed'}
      · ${f.insured ? 'Insured' : 'Uninsured'}
      ${f.leasee === p.id ? ' · Lease ' + f.leaseTurns + ' left' : ''}
      ${f.lastPnl ? '<br/>Last harvest P/L ' + rs(f.lastPnl) : ''}
    </div>`
  const acts = []
  if (f.mortgaged) {
    body += `<p>This plot is mortgaged to the rural bank and cannot be worked.</p>`
    acts.push(`<button class="work-btn gold" data-act="unmortgage">Redeem ${rs(Math.round(t.price * 0.55))}</button>`)
  } else {
    if (f.stage === 'idle') {
      acts.push(`<button class="work-btn gold" data-act="prepare" ${p.cash < t.prepare && !p.freePrep ? 'disabled' : ''}>Prepare land ${p.freePrep ? '(free)' : rs(t.prepare)}</button>`)
    }
    if (f.stage === 'prepared') {
      body += `<p>Choose a seed. Off-season crops carry a 35% surcharge and stress the soil.</p><div class="crops">`
      body += t.crops.map((cid) => {
        const c = CROPS[cid]
        const off = c.season !== season
        const cost = c.seed + (off ? Math.round(c.seed * 0.35) : 0)
        return `<button class="seed-btn${off ? ' off' : ''}" data-seed="${cid}" ${p.cash < cost ? 'disabled' : ''}>
          <b>${c.name}</b> · ${c.season}${off ? ' · off-season' : ''}<br/>Seed ${rs(cost)} · ~${c.yield} qtl · ${c.grow} grow
        </button>`
      }).join('')
      body += `</div>`
    }
    if (f.stage === 'seeded') {
      acts.push(`<button class="work-btn alt" data-act="tend">Tend crop (${f.growLeft} to ripe)</button>`)
    }
    if (f.stage === 'ripe') {
      acts.push(`<button class="work-btn alt" data-act="harvest">Harvest now</button>`)
    }
    if (!f.irrigated) acts.push(`<button class="work-btn" data-act="irrigate">Irrigate ${rs((state.utilities[12] === p.id || state.utilities[28] === p.id) ? 400 : 900)}</button>`)
    if (!f.insured) acts.push(`<button class="work-btn" data-act="insure">Insure crop ${rs(600)}</button>`)
  }
  acts.push(`<button class="ghost" data-act="skip">Leave field</button>`)
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
      landing = null
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
      leaveSession()
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
  const t = TILES[id]
  const f = state.farms[id]
  let extra = ''
  if (t.type === 'farm' && f) {
    extra = `<div class="farm-meta">Owner: ${f.owner != null ? state.players[f.owner].name : (f.leasee != null ? 'leased by ' + state.players[f.leasee].name : 'Village Hall')}<br/>
      Stage ${f.stage}${f.crop ? ' · ' + CROPS[f.crop].name : ''} · Fertility ${(f.fertility * 100).toFixed(0)}%</div>`
  }
  return wrapModal(`
    <h2>${t.name}</h2>
    <p>${t.region || t.sub || ''} ${t.group ? '· ' + GROUPS[t.group].name : ''}</p>
    ${extra}
    <div class="actions"><button class="ghost" data-act="skip">Close</button></div>`)
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
      const snap = await waitSnapshot(session, 0)
      applySnap(snap)
      pollLoop()
      return
    } catch {
      leaveSession()
    }
  }
  if (joinCode) {
    screen = 'lobby'
    render()
    const input = document.getElementById('joincode')
    if (input) input.value = joinCode
    return
  }
  render()
}

boot()
