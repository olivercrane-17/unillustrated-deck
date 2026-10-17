// Colour maths in OKLab / OKLCH, which tracks how different two colours look
// far better than RGB distance does.

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) throw new Error(`Bad hex colour: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

const toLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function oklabToOklch({ L, a, b }) {
  const C = Math.hypot(a, b)
  let h = (Math.atan2(b, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h }
}

export function hexToOklch(hex) {
  return oklabToOklch(hexToOklab(hex))
}

// Perceptual distance. About 0.02 is a just-noticeable difference.
export function deltaE(p, q) {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b)
}

// Shortest distance between two hues in degrees (0..180).
export function hueDistance(h1, h2) {
  const d = Math.abs((((h1 - h2) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}

// Warm hues: reds, oranges, yellows, warm browns.
export function isWarmHue(h) {
  return h <= 110 || h >= 330
}

// Cool hues: greens through blues and violets.
export function isCoolHue(h) {
  return h >= 150 && h <= 320
}

// Relative luminance for choosing readable text on top of a swatch.
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function inkOn(hex) {
  return luminance(hex) > 0.36 ? '#2A211C' : '#FBF6EA'
}
