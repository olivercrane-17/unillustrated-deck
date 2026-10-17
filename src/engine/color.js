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

// A rough everyday colour word ("golden brown", "pale blue", "cream") for a
// hex colour, so a card can say what the thing looks like at a glance.
// Bands are tuned by eye in OKLCH against real subject colours.
export function colourName(hex) {
  const { L, C, h } = hexToOklch(hex)
  if (C < 0.035) {
    if (L > 0.95) return 'white'
    if (L > 0.86) return C > 0.012 && h > 40 && h < 110 ? 'cream' : 'off-white'
    if (L > 0.68) return 'pale grey'
    if (L > 0.45) return 'grey'
    if (L > 0.3) return 'dark grey'
    return 'black'
  }
  if (h < 35 || h >= 350) {
    if (C >= 0.15) return L < 0.45 ? 'dark red' : 'red'
    if (L >= 0.68) return L > 0.86 ? 'pale pink' : 'pink'
    return L < 0.42 ? 'dark brown' : 'reddish brown'
  }
  if (h < 55) {
    if (L >= 0.72) return C < 0.1 ? 'peach' : 'apricot'
    if (C >= 0.13) return 'rusty orange'
    return L < 0.34 ? 'dark brown' : 'chestnut'
  }
  if (h < 80) {
    if (C >= 0.13 && L >= 0.58) return 'orange'
    if (C >= 0.09) return L < 0.5 ? 'brown' : 'golden brown'
    if (L > 0.8) return 'sand'
    return L < 0.45 ? 'dark brown' : 'brown'
  }
  if (h < 110) {
    if (L >= 0.85 && C < 0.08) return 'cream'
    if (C >= 0.12 && L >= 0.75) return 'yellow'
    if (C >= 0.08) return 'mustard'
    return L > 0.7 ? 'sand' : 'olive brown'
  }
  if (h < 150) {
    if (L >= 0.78) return 'pale green'
    if (L < 0.42) return 'dark green'
    if (C >= 0.12 && h < 125) return 'lime green'
    if (C < 0.09) return L < 0.6 ? 'moss green' : 'sage green'
    return 'green'
  }
  if (h < 200) {
    if (L >= 0.78) return h < 175 ? 'pale green' : 'pale teal'
    if (L < 0.42) return 'dark green'
    return h < 175 ? 'green' : 'teal'
  }
  if (h < 275) {
    if (L >= 0.78) return 'pale blue'
    if (L < 0.42) return 'navy blue'
    return 'blue'
  }
  if (h < 330) {
    if (L >= 0.7) return 'lilac'
    return L < 0.4 ? 'dark purple' : 'purple'
  }
  if (L >= 0.65) return 'pink'
  return C >= 0.15 ? 'magenta' : 'plum'
}
