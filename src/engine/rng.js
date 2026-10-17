// Small deterministic random helpers. Every reading is reproducible from its seed.

// mulberry32: tiny, fast, good enough for dealing cards.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hash any string to a 32-bit unsigned seed (cyrb53, folded to 32 bits).
export function hashString(str) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return ((h2 & 0x1fffff) * 4294967296 + (h1 >>> 0)) >>> 0
}

// A random generator derived from a parent seed plus a label, so a swap of one
// card never disturbs the random stream used by the others.
export function subRng(seed, ...labels) {
  return mulberry32(hashString(`${seed}:${labels.join(':')}`))
}

export function newSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1)
    globalThis.crypto.getRandomValues(buf)
    return buf[0]
  }
  return Math.floor(Math.random() * 4294967296) >>> 0
}

export function pick(rng, items) {
  if (!items.length) return undefined
  return items[Math.floor(rng() * items.length)]
}

// Weighted pick. `weightOf` returns a non-negative number; zero means never.
export function weightedPick(rng, items, weightOf) {
  let total = 0
  const weights = items.map((it) => {
    const w = Math.max(0, weightOf(it) || 0)
    total += w
    return w
  })
  if (total <= 0) return undefined
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}

export function shuffle(rng, items) {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
