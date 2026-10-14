const MUTE_KEY = 'hk-mute'

let ctx = null
let master = null
let muted = false

try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  /* ignore */
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = !!value
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (muted && ctx) {
    try { ctx.suspend() } catch { /* ignore */ }
  } else if (!muted && ctx) {
    try { ctx.resume() } catch { /* ignore */ }
  }
  return muted
}

export function toggleMute() {
  return setMuted(!muted)
}

function audio() {
  if (muted) return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.45
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    try { ctx.resume() } catch { /* ignore */ }
  }
  return ctx
}

function tone({ freq, dur, type = 'sine', gain = 0.2, at = 0, slideTo }) {
  const c = audio()
  if (!c) return
  const start = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(start)
  osc.stop(start + dur + 0.04)
}

function noise({ dur, gain = 0.2, at = 0, freq = 1600, q = 0.9 }) {
  const c = audio()
  if (!c) return
  const start = c.currentTime + at
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(start)
  src.stop(start + dur + 0.02)
}

const CUES = {
  click() {
    tone({ freq: 440, dur: 0.05, type: 'triangle', gain: 0.07 })
  },
  dice() {
    for (let i = 0; i < 6; i++) {
      noise({ dur: 0.045, gain: 0.14, at: i * 0.055, freq: 1300 + i * 240, q: 1.2 })
    }
  },
  coin() {
    tone({ freq: 988, dur: 0.1, type: 'triangle', gain: 0.15 })
    tone({ freq: 1319, dur: 0.14, type: 'triangle', gain: 0.13, at: 0.07 })
  },
  loss() {
    tone({ freq: 240, dur: 0.3, type: 'sawtooth', gain: 0.13, slideTo: 120 })
  },
  harvest() {
    ;[523, 659, 784, 1047].forEach((f, i) => {
      tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.12, at: i * 0.08 })
    })
  },
  card() {
    tone({ freq: 660, dur: 0.12, type: 'sine', gain: 0.09 })
    tone({ freq: 880, dur: 0.16, type: 'sine', gain: 0.08, at: 0.06 })
  },
  insolvent() {
    tone({ freq: 300, dur: 0.3, type: 'sawtooth', gain: 0.14, slideTo: 90 })
    tone({ freq: 200, dur: 0.4, type: 'square', gain: 0.08, at: 0.18, slideTo: 70 })
  },
  win() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.15, at: i * 0.11 })
    })
  }
}

export function playCue(name) {
  if (muted) return
  const cue = CUES[name]
  if (!cue) return
  try {
    cue()
  } catch {
    /* ignore */
  }
}
