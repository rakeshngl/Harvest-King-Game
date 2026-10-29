import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/engine.js'
import { chromeToggleHtml, tutorialHtml } from '../src/chrome.js'
import { lobbyHtml, waitingHtml, nameInputs } from '../src/lobby.js'
import { boardTilesHtml, tileHtml } from '../src/board.js'
import { gameHtml } from '../src/hud.js'
import { TILES } from '../src/data.js'

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
  assert.match(nameInputs(2), /data-i="0"/)
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
  assert.match(tile, /data-tile="1"/)
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
