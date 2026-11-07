import { describe, test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:net'
import { COOKIE, SEAT_COOKIE, pack } from '../server/visitor.js'

const VISITOR_SECRET = 'http-test-secret'
const dataDir = mkdtempSync(join(tmpdir(), 'hk-http-'))
const PORT = await freePort()
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: dataDir,
    DRAIN_MS: '3',
    TURN_MS: '90',
    TRUST_PROXY: '0',
    VISITOR_SECRET
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

let stdout = ''
child.stdout.setEncoding('utf8')
child.stdout.on('data', (chunk) => { stdout += chunk })
child.stderr.setEncoding('utf8')
child.stderr.on('data', (chunk) => { stdout += chunk })

after(() => {
  if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL')
})

await waitHealth()

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
    s.on('error', reject)
  })
}

async function waitHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`)
      if (res.ok) return
    } catch { /* not up */ }
    await delay(50)
  }
  throw new Error('server did not become healthy\n' + stdout)
}

async function api(method, path, body, cookie, seatToken) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  if (seatToken) headers['X-Seat-Token'] = seatToken
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await res.json()
  const cookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : [])
  return { status: res.status, json, cookies }
}

function cookiePair(setCookies, name = COOKIE) {
  const row = (setCookies || []).find((c) => String(c).startsWith(name + '='))
  return row ? String(row).split(';')[0] : ''
}

describe('http api', { concurrency: false }, () => {
test('health reports persist and sse', async () => {
  const { status, json } = await api('GET', '/api/health')
  assert.equal(status, 200)
  assert.equal(json.ok, true)
  assert.equal(json.draining, false)
  assert.equal(json.transport, 'sse')
})

test('create join start and action drive a seeded table', async () => {
  const created = await api('POST', '/api/create', { name: 'A', visitor: 'http-a' })
  assert.equal(created.status, 200)
  assert.equal(created.json.you, 0)
  assert.ok(created.json.code)
  assert.ok(created.json.token)
  const code = created.json.code
  const hostTok = created.json.token

  const joined = await api('POST', '/api/join', { code, name: 'B', visitor: 'http-b' })
  assert.equal(joined.status, 200)
  assert.equal(joined.json.you, 1)
  assert.equal(joined.json.players.length, 2)
  const guestTok = joined.json.token

  const missing = await api('POST', '/api/join', { code: 'ZZZZ', name: 'Ghost' })
  assert.equal(missing.status, 404)

  const guestStart = await api('POST', '/api/start', { code, token: guestTok })
  assert.equal(guestStart.status, 403)

  const started = await api('POST', '/api/start', { code, token: hostTok })
  assert.equal(started.status, 200)
  assert.equal(started.json.started, true)
  assert.equal(started.json.state.phase, 'roll')
  assert.equal(started.json.state.turn, 0)

  const guestRoll = await api('POST', '/api/action', { code, token: guestTok, action: { type: 'roll' } })
  assert.equal(guestRoll.status, 400)
  assert.equal(guestRoll.json.error, 'Not your turn')

  const rolled = await api('POST', '/api/action', { code, token: hostTok, action: { type: 'roll' } })
  assert.equal(rolled.status, 200)
  assert.ok(Array.isArray(rolled.json.rolled))
  assert.equal(rolled.json.rolled.length, 2)
  assert.ok(rolled.json.state.phase === 'action' || rolled.json.state.phase === 'end')

  if (rolled.json.state.phase === 'action') {
    const skipped = await api('POST', '/api/action', { code, token: hostTok, action: { type: 'skip' } })
    assert.equal(skipped.status, 200)
  }

  const seatCookie = cookiePair(created.cookies, SEAT_COOKIE)
  assert.ok(seatCookie.startsWith(SEAT_COOKIE + '='))
  assert.equal(seatCookie, `${SEAT_COOKIE}=${hostTok}`)

  const leaked = await api('GET', `/api/session?code=${code}&token=${hostTok}`)
  assert.equal(leaked.status, 404)

  const session = await api('GET', `/api/session?code=${code}`, null, seatCookie)
  assert.equal(session.status, 200)
  assert.equal(session.json.code, code)

  const viaHeader = await api('GET', `/api/session?code=${code}`, null, null, hostTok)
  assert.equal(viaHeader.status, 200)
  assert.equal(viaHeader.json.code, code)

  const ac = new AbortController()
  const events = await fetch(`http://127.0.0.1:${PORT}/api/events?code=${code}`, {
    headers: { Cookie: seatCookie },
    signal: ac.signal
  })
  assert.equal(events.status, 200)
  assert.match(String(events.headers.get('content-type') || ''), /text\/event-stream/)
  ac.abort()

  const eventsLeak = await api('GET', `/api/events?code=${code}&token=${hostTok}`)
  assert.equal(eventsLeak.status, 404)
})

test('cpu seats persist without tokens and stats write atomically', async () => {
  const created = await api('POST', '/api/create', { name: 'Host', visitor: 'persist-a' })
  assert.equal(created.status, 200)
  const code = created.json.code
  const hostTok = created.json.token
  const onDisk = JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8'))
  assert.ok(onDisk.rooms.some((r) => r.code === code))

  const cpu = await api('POST', '/api/cpu', { code, token: hostTok })
  assert.equal(cpu.status, 200)
  assert.ok(cpu.json.players.some((p) => p.cpu))
  await delay(400)
  const saved = JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8'))
  const room = saved.rooms.find((r) => r.code === code)
  assert.ok(room)
  const bot = room.players.find((p) => p.cpu)
  assert.ok(bot)
  assert.equal(bot.token, '')
  const human = room.players.find((p) => !p.cpu)
  assert.ok(human.token)

  const presence = await api('POST', '/api/presence', { playing: false })
  assert.equal(presence.status, 200)
  assert.ok(presence.json.visits >= 1)
  const minted = cookiePair(presence.cookies)
  assert.ok(minted.startsWith(COOKIE + '='))
  const stats = JSON.parse(readFileSync(join(dataDir, 'stats.json'), 'utf8'))
  assert.ok(stats.visits >= 1)
  assert.ok(stats.ids.includes(minted.slice(COOKIE.length + 1).split('.')[0]))
  assert.equal(existsSync(join(dataDir, 'stats.json.tmp')), false)
})

test('HMAC visitor cookie proves possession', async () => {
  const id = 'ab'.repeat(16)
  const cookie = `${COOKIE}=${pack(id, VISITOR_SECRET)}`
  const mine = await api('GET', '/api/profile?visitor=stolen', null, cookie)
  assert.equal(mine.status, 200)
  assert.equal(mine.json.id, id)
  assert.equal(mine.cookies.length, 0)

  const spoof = await api('GET', '/api/profile?visitor=' + id)
  assert.equal(spoof.status, 200)
  assert.notEqual(spoof.json.id, id)
  assert.ok(cookiePair(spoof.cookies).startsWith(COOKIE + '='))

  const forged = await api('GET', '/api/profile', null, `${COOKIE}=${id}.${'00'.repeat(32)}`)
  assert.equal(forged.status, 200)
  assert.notEqual(forged.json.id, id)
  assert.ok(cookiePair(forged.cookies).startsWith(COOKIE + '='))

  const presence = await api('POST', '/api/presence', { visitor: 'stat-a', playing: true }, cookie)
  assert.equal(presence.status, 200)
  const stats = JSON.parse(readFileSync(join(dataDir, 'stats.json'), 'utf8'))
  assert.ok(stats.ids.includes(id))
  assert.equal(stats.ids.includes('stat-a'), false)
})

test('rematch is host-only after the match ends', async () => {
  const created = await api('POST', '/api/create', { name: 'A', visitor: 'rematch-a' })
  assert.equal(created.status, 200)
  const code = created.json.code
  const hostTok = created.json.token
  const joined = await api('POST', '/api/join', { code, name: 'B', visitor: 'rematch-b' })
  assert.equal(joined.status, 200)
  const guestTok = joined.json.token
  const started = await api('POST', '/api/start', { code, token: hostTok })
  assert.equal(started.status, 200)
  assert.equal(started.json.state.phase, 'roll')

  const guestLive = await api('POST', '/api/rematch', { code, token: guestTok })
  assert.equal(guestLive.status, 403)

  const hostLive = await api('POST', '/api/rematch', { code, token: hostTok })
  assert.equal(hostLive.status, 400)
  assert.match(hostLive.json.error, /Finish the match/)
})

test('SIGTERM drains then health is 503', async () => {
  const before = await api('GET', '/api/health')
  assert.equal(before.json.draining, false)
  child.kill('SIGTERM')
  let drained = false
  for (let i = 0; i < 40; i++) {
    try {
      const { status, json } = await api('GET', '/api/health')
      if (status === 503 && json.draining) {
        drained = true
        break
      }
    } catch {
      drained = true
      break
    }
    await delay(50)
  }
  assert.equal(drained, true)
  const closed = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 4000)
    child.once('exit', () => {
      clearTimeout(t)
      resolve(true)
    })
  })
  assert.equal(closed, true)
})
})
