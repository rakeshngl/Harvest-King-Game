import { describe, test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:net'

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
    TRUST_PROXY: '0'
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

async function api(method, path, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await res.json()
  return { status: res.status, json }
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

  const session = await api('GET', `/api/session?code=${code}&token=${hostTok}`)
  assert.equal(session.status, 200)
  assert.equal(session.json.code, code)
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

  const presence = await api('POST', '/api/presence', { visitor: 'stat-a' })
  assert.equal(presence.status, 200)
  assert.ok(presence.json.visits >= 1)
  const stats = JSON.parse(readFileSync(join(dataDir, 'stats.json'), 'utf8'))
  assert.ok(stats.visits >= 1)
  assert.ok(stats.ids.includes('stat-a'))
  assert.equal(existsSync(join(dataDir, 'stats.json.tmp')), false)
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
