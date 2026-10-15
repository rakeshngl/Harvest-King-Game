const MUTE_KEY = 'hk-mute'
const MUSIC_KEY = 'hk-music'

let ctx = null
let master = null
let musicGain = null
let muted = false
let musicOn = true

try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
  const savedMusic = localStorage.getItem(MUSIC_KEY)
  if (savedMusic != null) musicOn = savedMusic === '1'
} catch {
  /* ignore */
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = !!value
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
  if (master) master.gain.value = muted ? 0 : 0.45
  return muted
}

export function toggleMute() {
  return setMuted(!muted)
}

export function isMusicOn() {
  return musicOn
}

export function setMusicOn(value) {
  musicOn = !!value
  try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0') } catch { /* ignore */ }
  applyMusicGain()
  if (musicOn) startMusic()
  else stopMusic()
  return musicOn
}

export function toggleMusic() {
  return setMusicOn(!musicOn)
}

function applyMusicGain() {
  if (!musicGain) return
  musicGain.gain.value = musicOn ? MUSIC_LEVEL : 0
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.45
    master.connect(ctx.destination)
    musicGain = ctx.createGain()
    musicGain.gain.value = musicOn ? MUSIC_LEVEL : 0
    musicGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    try { ctx.resume() } catch { /* ignore */ }
  }
  return ctx
}

function audio() {
  if (muted) return null
  return ensureCtx()
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

const MUSIC_LEVEL = 0.16
const LOOKAHEAD = 0.6
const TICK_MS = 250

const SCALES = {
  kharif: { root: 196, notes: [0, 3, 5, 7, 10], step: 0.46, wave: 'sine', pad: [0, 7, 12] },
  rabi: { root: 220, notes: [0, 2, 4, 7, 9], step: 0.4, wave: 'triangle', pad: [0, 4, 7] },
  zaid: { root: 247, notes: [0, 2, 4, 7, 11], step: 0.34, wave: 'triangle', pad: [0, 7, 10] }
}

const BAD_WEATHER = ['drought', 'flood', 'hail']

let musicPlaying = false
let musicTimer = 0
let musicStep = 0
let nextNoteTime = 0
let theme = { season: 'rabi', weather: 'normal' }
let padNodes = []

function freqOf(root, semis) {
  return root * Math.pow(2, semis / 12)
}

function scaleFor() {
  const base = SCALES[theme.season] || SCALES.rabi
  if (BAD_WEATHER.includes(theme.weather)) {
    return { ...base, root: base.root * Math.pow(2, -2 / 12), step: base.step * 1.18 }
  }
  return base
}

function pluck(freq, when, dur, wave) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = wave
  osc.frequency.setValueAtTime(freq, when)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.09, when + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g)
  g.connect(musicGain)
  osc.start(when)
  osc.stop(when + dur + 0.05)
}

function scheduleMusic() {
  if (!musicPlaying || !ctx) return
  const scale = scaleFor()
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    const deg = scale.notes[musicStep % scale.notes.length]
    const octave = musicStep % 8 < 4 ? 12 : 0
    pluck(freqOf(scale.root, deg + octave), nextNoteTime, scale.step * 1.4, scale.wave)
    if (musicStep % 4 === 0) {
      pluck(freqOf(scale.root, scale.pad[0] - 12), nextNoteTime, scale.step * 2.4, 'sine')
    }
    musicStep += 1
    nextNoteTime += scale.step
  }
}

function startPad() {
  stopPad()
  if (!ctx || !musicGain) return
  const scale = scaleFor()
  scale.pad.forEach((semi) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freqOf(scale.root, semi - 12)
    g.gain.value = 0.02
    osc.connect(g)
    g.connect(musicGain)
    osc.start()
    padNodes.push({ osc, g })
  })
}

function stopPad() {
  padNodes.forEach(({ osc, g }) => {
    try {
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3)
      osc.stop(ctx.currentTime + 0.6)
    } catch {
      /* ignore */
    }
  })
  padNodes = []
}

export function startMusic() {
  if (musicPlaying || !musicOn) return
  if (!ensureCtx()) return
  musicPlaying = true
  musicStep = 0
  nextNoteTime = ctx.currentTime + 0.1
  startPad()
  scheduleMusic()
  musicTimer = window.setInterval(scheduleMusic, TICK_MS)
}

export function stopMusic() {
  if (!musicPlaying) return
  musicPlaying = false
  if (musicTimer) {
    window.clearInterval(musicTimer)
    musicTimer = 0
  }
  stopPad()
}

export function setMusicScene(season, weather) {
  if (theme.season === season && theme.weather === weather) return
  theme = { season: season || 'rabi', weather: weather || 'normal' }
  if (!musicPlaying) return
  stopPad()
  musicStep = 0
  startPad()
}
