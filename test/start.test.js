import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { forwardSignals, startDev } from '../start.mjs'
import config from '../vite.config.js'

function mockChild({ dead = false } = {}) {
  const child = {
    killed: false,
    exitCode: dead ? 0 : null,
    signalCode: null,
    _exit: null,
    kill(sig) {
      this.killed = true
      this._sig = sig
      const fn = this._exit
      this.exitCode = 0
      if (fn) fn()
    },
    once(ev, fn) {
      if (ev === 'exit') this._exit = fn
    },
    on(ev, fn) {
      if (ev === 'exit') this._onExit = fn
    }
  }
  return child
}

test('preview and server share the /api proxy', () => {
  assert.deepEqual(config.server.proxy, config.preview.proxy)
  assert.equal(config.preview.proxy['/api'].target, 'http://localhost:3001')
  assert.equal(config.preview.proxy['/api'].timeout, 0)
  assert.equal(config.preview.proxy['/api'].changeOrigin, true)
})

test('forwardSignals kills live children on SIGTERM then exits 0', () => {
  const a = mockChild()
  const b = mockChild()
  const handlers = {}
  let code
  forwardSignals([a, b], (sig, fn) => { handlers[sig] = fn }, (c) => { code = c })
  handlers.SIGTERM()
  assert.equal(a._sig, 'SIGTERM')
  assert.equal(b._sig, 'SIGTERM')
  assert.equal(code, 0)
})

test('forwardSignals forwards SIGINT and ignores a second signal', () => {
  const a = mockChild()
  const handlers = {}
  let exits = 0
  const gate = forwardSignals([a], (sig, fn) => { handlers[sig] = fn }, () => { exits += 1 })
  handlers.SIGINT()
  handlers.SIGINT()
  assert.equal(a._sig, 'SIGINT')
  assert.equal(exits, 1)
  assert.equal(gate.shutting, true)
})

test('forwardSignals exits 0 when every child is already dead', () => {
  const dead = mockChild({ dead: true })
  const handlers = {}
  let code
  forwardSignals([dead], (sig, fn) => { handlers[sig] = fn }, (c) => { code = c })
  handlers.SIGTERM()
  assert.equal(dead.killed, false)
  assert.equal(code, 0)
})

test('startDev spawns the API then Vite', () => {
  const spawned = []
  const kids = [mockChild(), mockChild()]
  startDev({
    spawnFn: (cmd, args) => {
      spawned.push([cmd, ...args])
      return kids[spawned.length - 1]
    },
    on() {},
    exit() {}
  })
  assert.deepEqual(spawned[0], ['node', 'server/index.js'])
  assert.deepEqual(spawned[1], ['npx', 'vite', '--host', '0.0.0.0', '--port', '5173'])
})

test('start.mjs only boots when run as the main module', () => {
  const src = readFileSync(new URL('../start.mjs', import.meta.url), 'utf8')
  assert.match(src, /fileURLToPath/)
  assert.match(src, /startDev\(\)/)
})
