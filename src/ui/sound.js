// Synthesised paper and wood sounds. No audio files, off by default, quiet.
import { state } from '../store/state.js'

let ctx = null

function audio() {
  if (!state.settings.sound) return null
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function noiseBuffer(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

// A short burst of filtered noise, shaped like paper.
function papery(ac, when, { dur = 0.05, freq = 2600, q = 0.9, gain = 0.12 } = {}) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, dur + 0.02)
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  src.connect(filter).connect(g).connect(ac.destination)
  src.start(when)
  src.stop(when + dur + 0.02)
}

export function riffle() {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  for (let i = 0; i < 16; i++) papery(ac, t + i * 0.045 + Math.random() * 0.012, { dur: 0.035, freq: 2200 + Math.random() * 1800, gain: 0.05 + Math.random() * 0.04 })
}

export function flipSound() {
  const ac = audio()
  if (!ac) return
  papery(ac, ac.currentTime, { dur: 0.09, freq: 1500, q: 0.7, gain: 0.1 })
}

export function clink() {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  for (const [f, d] of [[1240, 0.12], [1860, 0.08]]) {
    const o = ac.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(g).connect(ac.destination)
    o.start(t)
    o.stop(t + d + 0.02)
  }
}
