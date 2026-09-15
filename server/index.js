import http from 'node:http'
import crypto from 'node:crypto'
import {
  createGame, applyMove, rollDice, buyFarm, leaseFarm, buyInfra, prepareLand,
  seedLand, irrigate, insure, harvest, tendCrop, sellToFci, takeLoan, repayLoan,
  declineAction, nextTurn, unmortgage, openFarmWork
} from '../src/engine.js'
import { LOAN_STEP } from '../src/data.js'

const PORT = 3001
const rooms = new Map()
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function code() {
  let c = ''
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return rooms.has(c) ? code() : c
}

function token() {
  return crypto.randomBytes(16).toString('hex')
}

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}'
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function snapshot(room, seat) {
  return {
    seq: room.seq,
    started: room.started,
    code: room.code,
    hostSeat: 0,
    you: seat,
    players: room.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      connected: Date.now() - p.seen < 20000
    })),
    state: room.state,
    lastDice: room.lastDice,
    rollSeq: room.rollSeq
  }
}

function bump(room) {
  room.seq += 1
  const waiters = room.waiters.splice(0)
  waiters.forEach((w) => w.resolve(true))
}

function playerByToken(room, tok) {
  return room.players.find((p) => p.token === tok)
}

function applyAction(room, seat, action) {
  const state = room.state
  if (!state) return { error: 'Game has not started' }
  if (state.phase === 'over') return { error: 'The game is over' }
  if (state.turn !== seat) return { error: 'Not your turn' }
  if (state.players[seat].bankrupt) return { error: 'You are insolvent' }

  const pending = state.pending
  switch (action.type) {
    case 'roll': {
      if (state.phase !== 'roll') return { error: 'Cannot roll now' }
      const dice = rollDice()
      applyMove(state, dice)
      room.lastDice = dice
      room.rollSeq += 1
      return { ok: true, rolled: dice }
    }
    case 'endTurn':
      if (state.phase !== 'end') return { error: 'Cannot end turn now' }
      nextTurn(state)
      return { ok: true }
    case 'skip':
      if (state.phase !== 'action') return { error: 'Nothing to skip' }
      declineAction(state)
      return { ok: true }
    case 'buy':
      if (!pending || pending.kind !== 'acquire') return { error: 'No land to buy' }
      if (!buyFarm(state, pending.tileId)) return { error: 'Cannot buy' }
      return { ok: true }
    case 'lease':
      if (!pending || pending.kind !== 'acquire') return { error: 'No land to lease' }
      if (!leaseFarm(state, pending.tileId)) return { error: 'Cannot lease' }
      return { ok: true }
    case 'buyinfra':
      if (!pending || pending.kind !== 'buyInfra') return { error: 'No yard to buy' }
      if (!buyInfra(state, pending.tileId, pending.map)) return { error: 'Cannot buy' }
      return { ok: true }
    case 'prepare':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!prepareLand(state, pending.tileId)) return { error: 'Cannot prepare' }
      return { ok: true }
    case 'tend':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!tendCrop(state, pending.tileId)) return { error: 'Cannot tend' }
      return { ok: true }
    case 'harvest':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!harvest(state, pending.tileId)) return { error: 'Cannot harvest' }
      return { ok: true }
    case 'irrigate':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!irrigate(state, pending.tileId)) return { error: 'Cannot irrigate' }
      return { ok: true }
    case 'insure':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!insure(state, pending.tileId)) return { error: 'Cannot insure' }
      return { ok: true }
    case 'unmortgage':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!unmortgage(state, pending.tileId)) return { error: 'Cannot redeem' }
      return { ok: true }
    case 'fci':
      if (!sellToFci(state)) return { error: 'The warehouse has no grain from you' }
      return { ok: true }
    case 'loan':
      if (!takeLoan(state)) return { error: 'Loan refused' }
      declineAction(state)
      return { ok: true }
    case 'repay':
      if (!repayLoan(state, LOAN_STEP)) return { error: 'Nothing to repay' }
      declineAction(state)
      return { ok: true }
    case 'seed':
      if (!pending || pending.kind !== 'farmWork') return { error: 'No field selected' }
      if (!seedLand(state, pending.tileId, action.crop)) return { error: 'Cannot sow' }
      return { ok: true }
    case 'work': {
      const id = Number(action.tileId)
      if (!openFarmWork(state, id)) return { error: 'Cannot work that field' }
      return { ok: true }
    }
    default:
      return { error: 'Unknown action' }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    })
    res.end()
    return
  }

  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/api/health') {
      json(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && path === '/api/create') {
      const body = await readBody(req)
      const name = String(body.name || '').trim().slice(0, 16) || 'Saffron'
      const room = {
        code: code(),
        started: false,
        seq: 1,
        rollSeq: 0,
        lastDice: [1, 1],
        state: null,
        waiters: [],
        players: []
      }
      room.players.push({ seat: 0, name, token: token(), seen: Date.now() })
      rooms.set(room.code, room)
      json(res, 200, { ...snapshot(room, 0), token: room.players[0].token })
      return
    }

    if (req.method === 'POST' && path === '/api/join') {
      const body = await readBody(req)
      const room = rooms.get(String(body.code || '').toUpperCase())
      if (!room) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      if (room.started) {
        json(res, 400, { error: 'This session has already begun' })
        return
      }
      if (room.players.length >= 4) {
        json(res, 400, { error: 'Session is full (4 farmers)' })
        return
      }
      const name = String(body.name || '').trim().slice(0, 16) || `Farmer ${room.players.length + 1}`
      const p = { seat: room.players.length, name, token: token(), seen: Date.now() }
      room.players.push(p)
      bump(room)
      json(res, 200, { ...snapshot(room, p.seat), token: p.token })
      return
    }

    if (req.method === 'POST' && path === '/api/start') {
      const body = await readBody(req)
      const room = rooms.get(String(body.code || '').toUpperCase())
      const p = room && playerByToken(room, body.token)
      if (!room || !p) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      if (p.seat !== 0) {
        json(res, 403, { error: 'Only the host may start the game' })
        return
      }
      if (room.started) {
        json(res, 200, snapshot(room, p.seat))
        return
      }
      if (room.players.length < 2) {
        json(res, 400, { error: 'Need at least 2 farmers' })
        return
      }
      room.state = createGame(room.players.length, room.players.map((x) => x.name))
      room.started = true
      room.lastDice = room.state.lastDice
      bump(room)
      json(res, 200, snapshot(room, p.seat))
      return
    }

    if (req.method === 'POST' && path === '/api/action') {
      const body = await readBody(req)
      const room = rooms.get(String(body.code || '').toUpperCase())
      const p = room && playerByToken(room, body.token)
      if (!room || !p) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      p.seen = Date.now()
      const result = applyAction(room, p.seat, body.action || {})
      if (result.error) {
        json(res, 400, { error: result.error, ...snapshot(room, p.seat) })
        return
      }
      bump(room)
      json(res, 200, { ...snapshot(room, p.seat), rolled: result.rolled || null })
      return
    }

    if (req.method === 'GET' && path === '/api/session') {
      const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase())
      const tok = url.searchParams.get('token') || ''
      const p = room && playerByToken(room, tok)
      if (!room || !p) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      p.seen = Date.now()
      const since = Number(url.searchParams.get('seq') || 0)
      if (room.seq > since) {
        json(res, 200, snapshot(room, p.seat))
        return
      }
      const timer = setTimeout(() => {
        room.waiters = room.waiters.filter((w) => w !== waiter)
        json(res, 200, snapshot(room, p.seat))
      }, 20000)
      const waiter = {
        resolve: () => {
          clearTimeout(timer)
          json(res, 200, snapshot(room, p.seat))
        }
      }
      room.waiters.push(waiter)
      req.on('close', () => {
        clearTimeout(timer)
        room.waiters = room.waiters.filter((w) => w !== waiter)
      })
      return
    }

    json(res, 404, { error: 'Not found' })
  } catch {
    json(res, 400, { error: 'Bad request' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Harvest King session server on http://localhost:${PORT}`)
})
