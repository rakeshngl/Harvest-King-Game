import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setMuted, isMuted, setMusicOn, isMusicOn, startMusic, stopMusic } from '../src/sound.js'

function fakeAudio() {
  const destination = { id: 'destination' }
  const nodes = []
  class Gain {
    constructor() {
      this.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }
      this.connected = []
      nodes.push(this)
    }
    connect(n) {
      this.connected.push(n)
      return n
    }
  }
  class Osc {
    constructor() {
      this.type = 'sine'
      this.frequency = { value: 0, setValueAtTime() {} }
    }
    connect() { return this }
    start() {}
    stop() {}
  }
  class Ctx {
    constructor() {
      this.destination = destination
      this.currentTime = 0
      this.state = 'running'
      this.sampleRate = 44100
    }
    createGain() { return new Gain() }
    createOscillator() { return new Osc() }
    resume() {}
  }
  return { Ctx, destination, nodes }
}

test('Sound off zeros the master bus that music feeds', () => {
  const prevWin = globalThis.window
  const { Ctx, destination, nodes } = fakeAudio()
  const timers = []
  globalThis.window = {
    AudioContext: Ctx,
    setInterval(fn) { timers.push(fn); return timers.length },
    clearInterval() {}
  }
  setMusicOn(true)
  setMuted(false)
  startMusic()
  const master = nodes[0]
  const music = nodes[1]
  assert.ok(master)
  assert.ok(music)
  assert.deepEqual(master.connected, [destination])
  assert.deepEqual(music.connected, [master])
  assert.equal(isMusicOn(), true)
  setMuted(true)
  assert.equal(isMuted(), true)
  assert.equal(master.gain.value, 0)
  assert.ok(music.gain.value > 0)
  setMuted(false)
  assert.equal(master.gain.value, 0.45)
  stopMusic()
  setMuted(false)
  globalThis.window = prevWin
})
