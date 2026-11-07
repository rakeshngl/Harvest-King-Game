import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/engine.js'
import { chromeToggleHtml, tutorialHtml } from '../src/chrome.js'
import { lobbyHtml, waitingHtml, nameInputs } from '../src/lobby.js'
import { boardTilesHtml, tileHtml } from '../src/board.js'
import { gameHtml, wrapModal, actionModal, winModal } from '../src/hud.js'
import { TILES, CROPS } from '../src/data.js'

test('chrome and tutorial markup keep their ids', () => {
  assert.match(chromeToggleHtml(), /id="langtoggle"/)
  assert.match(chromeToggleHtml(), /id="helptoggle"/)
  assert.match(tutorialHtml(true, 0), /id="tutorial"/)
  assert.equal(tutorialHtml(false, 0), '')
})

test('lobby and waiting screens keep create/join/start controls', () => {
  const html = lobbyHtml({
    lineOn: true,
    notice: '',
    hallStats: { visits: 0, online: 0, playing: 0 },
    draftName: 'A',
    openTables: [],
    myProfile: null,
    local: null,
    presetChoice: 'classic',
    seats: {}
  })
  assert.match(html, /id="create"/)
  assert.match(html, /id="join"/)
  assert.match(html, /id="myname"/)
  assert.match(html, /for="myname"/)
  assert.match(html, /for="roompass"/)
  assert.match(html, /for="joincode"/)
  assert.match(nameInputs(2), /data-i="0"/)
  assert.match(nameInputs(2), /for="pname0"/)
  assert.match(nameInputs(2), /for="pname1"/)
  const waiting = waitingHtml({
    lineOn: true,
    notice: '',
    room: { players: [{ seat: 0, name: 'A', connected: true }], hostSeat: 0, preset: 'classic' },
    session: { you: 0, code: 'ABCD' }
  })
  assert.match(waiting, /id="opengame"/)
  assert.match(waiting, /ABCD/)
})

test('board and game hud keep tile and roll controls', () => {
  const state = createGame(2, ['A', 'B'], { seed: 1 })
  const tile = tileHtml(TILES[1], state)
  assert.match(tile, /<button type="button"/)
  assert.match(tile, /data-tile="1"/)
  assert.match(tile, /aria-label="/)
  assert.match(boardTilesHtml(state), /data-tile="0"/)
  const html = gameHtml(state, {
    lineOn: true,
    notice: '',
    cpuNote: '',
    rolling: false,
    online: false,
    session: null,
    mySeat: 0,
    isMyTurn: true,
    humanSeat: 0,
    sideTab: 'farmers',
    diaryPage: 0,
    tradeOpen: false,
    tradeDraft: { to: '', cashGive: '', cashTake: '', landGive: '', landTake: '', debtGive: '', debtTake: '' },
    landing: null,
    landingQueue: [],
    inspectId: null
  })
  assert.match(html, /id="roll"/)
  assert.match(html, /id="endturn"/)
  assert.match(html, /id="leavegame"/)
})

test('prices panel lists every crop', () => {
  const state = createGame(2, ['A', 'B'], { seed: 1 })
  const html = gameHtml(state, {
    lineOn: true,
    notice: '',
    cpuNote: '',
    rolling: false,
    online: false,
    session: null,
    mySeat: 0,
    isMyTurn: true,
    humanSeat: 0,
    sideTab: 'prices',
    diaryPage: 0,
    tradeOpen: false,
    tradeDraft: { to: '', cashGive: '', cashTake: '', landGive: '', landTake: '', debtGive: '', debtTake: '' },
    landing: null,
    landingQueue: [],
    inspectId: null
  })
  assert.equal(Object.keys(CROPS).length, 18)
  Object.values(CROPS).forEach((c) => {
    assert.match(html, new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })
})

test('labour shortage modal offers hire or skip', () => {
  const state = createGame(2, ['A', 'B'], { seed: 1 })
  state.pending = { kind: 'labour', amount: 600, card: { id: 'labour', title: 'Labour Shortage', text: 'Pay Rs 600 or skip your next harvest bonus.' } }
  const html = actionModal(state, state.pending, true)
  assert.match(html, /data-act="labourpay"/)
  assert.match(html, /data-act="labourskip"/)
  assert.match(html, /Hire labour/)
})

test('wrapModal is a labelled dialog', () => {
  assert.match(wrapModal('<h2>Hi</h2>'), /role="dialog"/)
  assert.match(wrapModal('<h2>Hi</h2>'), /aria-modal="true"/)
})

test('raise modal lists lots to mortgage or fire-sale', () => {
  const state = createGame(2, ['A', 'B'], { seed: 1 })
  state.farms[1].owner = 0
  state.infra[5] = 0
  state.pending = { kind: 'raise', pid: 0, amount: 2000, reason: 'Land Revenue', to: null, after: { type: 'end' } }
  const html = actionModal(state, state.pending, true)
  assert.match(html, /data-raise="1"/)
  assert.match(html, /data-raise="5"/)
  assert.match(html, /data-act="giveup"/)
})

test('win modal lists standings and a rematch control', () => {
  const state = createGame(3, ['A', 'B', 'C'], { seed: 1 })
  state.phase = 'over'
  state.winner = 0
  state.players[2].bankrupt = true
  state.players[2].cash = 0
  const html = winModal(state, { online: false })
  assert.match(html, /class="standings"/)
  assert.match(html, /id="again"/)
  assert.match(html, /id="tolobby"/)
  assert.match(html, /A/)
  assert.match(html, /B/)
  assert.match(html, /C/)
  const guest = winModal(state, { online: true, session: { you: 1, spectator: false }, hostSeat: 0 })
  assert.doesNotMatch(guest, /id="again"/)
  assert.match(guest, /id="tolobby"/)
})
