import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  createGame, applyMove, rollDice, buyFarm, leaseFarm, buyInfra, prepareLand,
  seedLand, irrigate, insure, harvest, tendCrop, sellToFci, takeLoan, repayLoan,
  declineAction, nextTurn, unmortgage, openFarmWork
} from '../src/engine.js'
import { LOAN_STEP } from '../src/data.js'

const PORT = Number(process.env.PORT) || 3001
const rooms = new Map()
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ONLINE_MS = 25000
const DATA_DIR = path.join(process.cwd(), 'data')
const STATS_FILE = path.join(DATA_DIR, 'stats.json')
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json')
const KEEP_OVER_MS = 24 * 60 * 60 * 1000
const KEEP_WAIT_MS = 6 * 60 * 60 * 1000
const KEEP_IDLE_MS = 48 * 60 * 60 * 1000
const CREATE_LIMIT = 8
const JOIN_LIMIT = 20
const RATE_WINDOW_MS = 10 * 60 * 1000
const presence = new Map()
const rateBuckets = new Map()
let persistOk = true

function loadStats() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'))
    return {
      visits: Number(raw.visits) || 0,
      ids: Array.isArray(raw.ids) ? raw.ids.slice(0, 20000) : []
    }
  } catch {
    return { visits: 0, ids: [] }
  }
}

const statsStore = loadStats()
const knownVisitors = new Set(statsStore.ids)

function saveStats() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(STATS_FILE, JSON.stringify({
      visits: statsStore.visits,
      ids: [...knownVisitors].slice(-20000)
    }))
  } catch {
    /* ignore */
  }
}

function serializableRoom(room) {
  return {
    code: room.code,
    started: room.started,
    seq: room.seq,
    rollSeq: room.rollSeq,
    lastDice: room.lastDice,
    state: room.state,
    players: room.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      token: p.token,
      seen: p.seen
    })),
    spectators: (room.spectators || []).map((p) => ({
      seat: -1,
      name: p.name,
      token: p.token,
      seen: p.seen,
      spectator: true
    })),
    updatedAt: room.updatedAt || Date.now()
  }
}

function shouldKeepRoom(room, now) {
  const updated = Number(room.updatedAt) || 0
  const over = !!(room.state && room.state.phase === 'over')
  if (over) return now - updated <= KEEP_OVER_MS
  if (!room.started) return now - updated <= KEEP_WAIT_MS
  return now - updated <= KEEP_IDLE_MS
}

function pruneRooms(now = Date.now()) {
  rooms.forEach((room, code) => {
    if (!shouldKeepRoom(room, now)) rooms.delete(code)
  })
}

function saveRooms() {
  try {
    pruneRooms()
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const now = Date.now()
    const payload = {
      savedAt: now,
      rooms: [...rooms.values()].map(serializableRoom)
    }
    const tmp = `${ROOMS_FILE}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(payload))
    fs.renameSync(tmp, ROOMS_FILE)
    persistOk = true
  } catch {
    persistOk = false
  }
}

function loadRooms() {
  try {
    const raw = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'))
    const list = Array.isArray(raw.rooms) ? raw.rooms : []
    const now = Date.now()
    list.forEach((r) => {
      if (!r || !r.code) return
      if (!shouldKeepRoom(r, now)) return
      rooms.set(String(r.code).toUpperCase(), {
        code: String(r.code).toUpperCase(),
        started: !!r.started,
        seq: Number(r.seq) || 1,
        rollSeq: Number(r.rollSeq) || 0,
        lastDice: Array.isArray(r.lastDice) ? r.lastDice : [1, 1],
        state: r.state || null,
        waiters: [],
        streams: [],
        players: Array.isArray(r.players) ? r.players.map((p) => ({
          seat: Number(p.seat),
          name: String(p.name || 'Farmer').slice(0, 16),
          token: String(p.token || ''),
          seen: Number(p.seen) || 0
        })) : [],
        spectators: Array.isArray(r.spectators) ? r.spectators.map((p) => ({
          seat: -1,
          name: String(p.name || 'Watcher').slice(0, 16),
          token: String(p.token || ''),
          seen: Number(p.seen) || 0,
          spectator: true
        })) : [],
        updatedAt: Number(r.updatedAt) || now
      })
    })
  } catch {
    /* empty store */
  }
}

loadRooms()

function prunePresence(now = Date.now()) {
  presence.forEach((p, id) => {
    if (now - p.seen > ONLINE_MS) presence.delete(id)
  })
}

function publicStats() {
  prunePresence()
  let online = 0
  let playing = 0
  presence.forEach((p) => {
    online += 1
    if (p.playing) playing += 1
  })
  return { visits: statsStore.visits, online, playing }
}

function touchPresence(visitor, playing) {
  const id = String(visitor || '').slice(0, 64)
  if (!id) return publicStats()
  const now = Date.now()
  presence.set(id, { seen: now, playing: !!playing })
  if (!knownVisitors.has(id)) {
    knownVisitors.add(id)
    statsStore.visits += 1
    saveStats()
  }
  return publicStats()
}

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

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || req.socket.remoteAddress || 'unknown'
}

function rateLimited(key, limit) {
  const now = Date.now()
  let bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    bucket = { start: now, n: 0 }
    rateBuckets.set(key, bucket)
  }
  bucket.n += 1
  return bucket.n > limit
}

function snapshot(room, seat) {
  return {
    seq: room.seq,
    started: room.started,
    code: room.code,
    hostSeat: 0,
    you: seat,
    spectator: seat < 0,
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

function writeSse(res, event, body) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(body)}\n\n`)
  } catch {
    /* closed */
  }
}

function bump(room) {
  room.seq += 1
  room.updatedAt = Date.now()
  const waiters = (room.waiters || []).splice(0)
  waiters.forEach((w) => w.resolve(true))
  const live = []
  ;(room.streams || []).forEach((s) => {
    writeSse(s.res, 'snapshot', snapshot(room, s.seat))
    live.push(s)
  })
  room.streams = live
  saveRooms()
}

function memberByToken(room, tok) {
  return room.players.find((p) => p.token === tok)
    || (room.spectators || []).find((p) => p.token === tok)
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
      json(res, 200, {
        ok: true,
        rooms: rooms.size,
        persist: persistOk,
        transport: 'sse'
      })
      return
    }

    if (req.method === 'GET' && path === '/api/stats') {
      json(res, 200, publicStats())
      return
    }

    if (req.method === 'POST' && path === '/api/presence') {
      const body = await readBody(req)
      json(res, 200, touchPresence(body.visitor, body.playing))
      return
    }

    if (req.method === 'POST' && path === '/api/create') {
      if (rateLimited(`create:${clientIp(req)}`, CREATE_LIMIT)) {
        json(res, 429, { error: 'Too many rooms from this network. Wait a few minutes.' })
        return
      }
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
        streams: [],
        spectators: [],
        players: []
      }
      room.players.push({ seat: 0, name, token: token(), seen: Date.now() })
      room.updatedAt = Date.now()
      rooms.set(room.code, room)
      saveRooms()
      json(res, 200, { ...snapshot(room, 0), token: room.players[0].token })
      return
    }

    if (req.method === 'POST' && path === '/api/join') {
      if (rateLimited(`join:${clientIp(req)}`, JOIN_LIMIT)) {
        json(res, 429, { error: 'Too many join attempts. Wait a few minutes.' })
        return
      }
      const body = await readBody(req)
      const room = rooms.get(String(body.code || '').toUpperCase())
      if (!room) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      const watch = !!body.watch || !!body.spectator
      if (room.started || watch) {
        if (!room.started) {
          json(res, 400, { error: 'This session has not begun' })
          return
        }
        room.spectators = room.spectators || []
        if (room.spectators.length >= 12) {
          json(res, 400, { error: 'Too many watchers on this table' })
          return
        }
        const name = String(body.name || '').trim().slice(0, 16) || 'Watcher'
        const p = { seat: -1, name, token: token(), seen: Date.now(), spectator: true }
        room.spectators.push(p)
        bump(room)
        json(res, 200, { ...snapshot(room, -1), token: p.token })
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
      const member = room && memberByToken(room, body.token)
      if (!room || !member) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      if (member.spectator || member.seat < 0) {
        json(res, 403, { error: 'Watchers cannot act' })
        return
      }
      const p = member
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
      const p = room && memberByToken(room, tok)
      if (!room || !p) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      p.seen = Date.now()
      json(res, 200, snapshot(room, p.seat))
      return
    }

    if (req.method === 'GET' && path === '/api/events') {
      const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase())
      const tok = url.searchParams.get('token') || ''
      const p = room && memberByToken(room, tok)
      if (!room || !p) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      p.seen = Date.now()
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      })
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
      room.streams = room.streams || []
      const stream = { res, seat: p.seat }
      room.streams.push(stream)
      writeSse(res, 'snapshot', snapshot(room, p.seat))
      const ping = setInterval(() => {
        try { res.write(': ping\n\n') } catch { /* closed */ }
      }, 15000)
      req.on('close', () => {
        clearInterval(ping)
        room.streams = (room.streams || []).filter((s) => s !== stream)
      })
      return
    }

    json(res, 404, { error: 'Not found' })
  } catch {
    json(res, 400, { error: 'Bad request' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Harvest King session server on http://localhost:${PORT} (${rooms.size} rooms restored)`)
})

function shutdown() {
  saveRooms()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
