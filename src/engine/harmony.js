// The Tin card: deal a small palette from the pencils she actually owns.
// All comparisons happen in OKLab / OKLCH.
import { hexToOklab, oklabToOklch, deltaE, hueDistance, isWarmHue, isCoolHue } from './color.js'

export const WHITE = 'PC938'
export const BLACK = 'PC935'
export const INDIGO = 'PC901'
export const DARK_BROWN = 'PC946'
export const SEPIA = 'PC948'

// Attach colour coordinates to pencils, honouring her swatch corrections.
export function preparePencils(pencils, overrides = {}) {
  return pencils.map((p) => {
    const hex = overrides[p.code] || p.hex
    const lab = hexToOklab(hex)
    return { ...p, hex, lab, lch: oklabToOklch(lab) }
  })
}

export function anchorFor(hex) {
  const lab = hexToOklab(hex)
  return { hex, lab, lch: oklabToOklch(lab) }
}

// Metallics read as flat grey or mustard on paper, so they are only dealt for
// subjects that really are metal.
const isDealable = (p, allowMetallic) => p.special !== 'blender' && (allowMetallic || p.special !== 'metallic')
const isWhiteish = (p) => p.lch.L > 0.93 && p.lch.C < 0.04
const isBlack = (p) => p.code === BLACK || (p.lch.L < 0.26 && p.lch.C < 0.02)

// Pick among the best few candidates so palettes vary without going off-key.
function pickTop(rng, scored, k = 3) {
  const sorted = scored.slice().sort((x, y) => x.score - y.score)
  const top = sorted.slice(0, Math.min(k, sorted.length))
  if (!top.length) return undefined
  // Only consider runners-up that are nearly as good as the best.
  const best = top[0].score
  const close = top.filter((t) => t.score <= best + 0.06)
  const weights = [0.62, 0.26, 0.12]
  let total = 0
  close.forEach((_, i) => (total += weights[i]))
  let r = rng() * total
  for (let i = 0; i < close.length; i++) {
    r -= weights[i]
    if (r < 0) return close[i].p
  }
  return close[0].p
}

function moodPenalty(p, mood) {
  const { C, L } = p.lch
  switch (mood) {
    case 'muted': return 0.5 * Math.max(0, C - 0.11)
    case 'bright': return 0.4 * Math.max(0, 0.09 - C)
    case 'dark': return 0.25 * Math.max(0, L - 0.7)
    default: return 0
  }
}

// Scorers for each role. Lower is better.
function scoreMain(p, ctx) {
  let s = deltaE(p.lab, ctx.subjectAnchor.lab) + moodPenalty(p, ctx.mood) * 0.5
  if (isBlack(p) && ctx.subjectAnchor.lch.L > 0.3) s += 0.5
  return s
}

function scoreAnchor(anchor) {
  return (p, ctx) => {
    let s = deltaE(p.lab, anchor.lab) + moodPenalty(p, ctx.mood) * 0.5
    if (isBlack(p) && anchor.lch.L > 0.3) s += 0.5
    return s
  }
}

function darkHueTarget(ctx) {
  const mainH = ctx.main?.lch.h ?? 40
  switch (ctx.mood) {
    case 'cool':
    case 'dark': return 268
    case 'warm': return isWarmHue(mainH) ? mainH : 40
    default: return mainH
  }
}

function scoreDark(p, ctx) {
  const { L, C, h } = p.lch
  let s = Math.max(0, L - 0.4) * 3 // must be genuinely dark
  s += (L - 0.2) * 0.35 // darker is a little better
  if (C > 0.025) s += (hueDistance(h, darkHueTarget(ctx)) / 180) * 0.45
  else s += 0.18 // greys are allowed but chromatic darks are livelier
  if (isBlack(p)) s += 0.55 // black flattens coloured pencil work; rarely deal it
  if (ctx.mood === 'muted') s += Math.max(0, C - 0.09) * 0.8
  return s
}

// Highlights want White or a near-white; a bright yellow is not a highlight.
function scoreLight(p, ctx) {
  const { L, C } = p.lch
  let s = Math.max(0, 0.9 - L) * 3
  if (p.code === WHITE) s -= 0.08
  s += C * (ctx.mood === 'warm' ? 1.2 : 2.4)
  if (ctx.mood === 'warm' && C > 0.02 && !isWarmHue(p.lch.h)) s += 0.2
  return s
}

function scoreComplement(p, ctx) {
  const target = ((ctx.main?.lch.h ?? 0) + 180) % 360
  const { C, L } = p.lch
  return (hueDistance(p.lch.h, target) / 180) + Math.max(0, 0.08 - C) * 4 + Math.max(0, 0.3 - L) + (isBlack(p) ? 1 : 0)
}

const SCORERS = {
  main: scoreMain,
  dark: scoreDark,
  light: scoreLight,
  complement: scoreComplement,
}

// Twist rules restrict the pool before dealing.
function poolForRule(pool, rule) {
  switch (rule) {
    case 'warm':
    case 'hearthfire': return pool.filter((p) => p.lch.C < 0.03 || isWarmHue(p.lch.h))
    case 'cool': return pool.filter((p) => p.lch.C < 0.03 || isCoolHue(p.lch.h))
    default: return pool
  }
}

function nearestTo(pool, hex, exclude = new Set()) {
  const a = anchorFor(hex)
  let best
  let bestD = Infinity
  for (const p of pool) {
    if (exclude.has(p.code)) continue
    const d = deltaE(p.lab, a.lab)
    if (d < bestD) { best = p; bestD = d }
  }
  return best
}

/**
 * Deal a palette.
 * @param {object} o
 * @param {Array} o.pencils   prepared owned pencils
 * @param {Array} o.slots     ordered role slots: { key, kind, anchor?, role }
 *                            kind is 'anchor' | 'main' | 'dark' | 'light' | 'complement'
 * @param {string} o.mood
 * @param {string} [o.rule]   twist palette rule
 * @param {object} [o.keep]   { slotKey: code } pencils that must stay
 * @param {Array}  [o.avoid]  codes to skip if anything else will do
 * @param {boolean} [o.allowMetallic]
 * @param {function} o.rng
 * @returns {{ pencils: Array<{code, slot, role}>, bareLights: boolean, relaxed: number }}
 */
export function dealPalette({ pencils, slots, mood, rule, keep = {}, avoid = [], allowMetallic = false, rng }) {
  const avoidSet = new Set(avoid)
  let owned = pencils.filter((p) => isDealable(p, allowMetallic))
  if (!owned.length) owned = pencils.filter((p) => p.special !== 'blender')
  const byCode = new Map(owned.map((p) => [p.code, p]))
  let pool = poolForRule(owned, rule)
  if (pool.length < Math.min(slots.length, 2)) pool = owned

  // Special fixed palettes from twists.
  const fixed = fixedPalette(rule, owned)
  if (fixed) return fixed

  const chosen = [] // { p, slot }
  const used = new Set()
  for (const slot of slots) {
    const kept = keep[slot.key] && byCode.get(keep[slot.key])
    if (kept) { chosen.push({ p: kept, slot }); used.add(kept.code) }
  }

  const ctx = { mood, main: chosen.find((c) => c.slot.kind === 'main')?.p }
  if (slots[0]) ctx.subjectAnchor = slots.find((s) => s.kind === 'main')?.anchor || slots[0].anchor
  let relaxed = 0

  for (const slot of slots) {
    if (chosen.some((c) => c.slot.key === slot.key)) continue
    if (used.size >= owned.length) break
    const scorer = slot.kind === 'anchor' ? scoreAnchor(slot.anchor) : SCORERS[slot.kind]
    if (!scorer || (slot.kind === 'main' && !ctx.subjectAnchor)) continue
    // Light slot: white is the classic burnisher, but skip it if the subject is
    // itself white, and allow "leave the paper bare" when nothing light is owned.
    let candidates = pool.filter((p) => !used.has(p.code) && !avoidSet.has(p.code))
    if (!candidates.length) candidates = pool.filter((p) => !used.has(p.code))
    if (!candidates.length) candidates = owned.filter((p) => !used.has(p.code))
    if (slot.kind === 'light') {
      candidates = candidates.filter((p) => p.lch.L > 0.84)
      if (!candidates.length) continue
    }
    if (slot.kind === 'dark') {
      const darks = candidates.filter((p) => p.lch.L < 0.5)
      if (darks.length) candidates = darks
    }
    if (rule === 'mono' && ctx.main) {
      const family = candidates.filter((p) => p.lch.C < 0.03 || hueDistance(p.lch.h, ctx.main.lch.h) < 32)
      if (family.length) candidates = family
    }
    // Keep chosen pencils visibly distinct, relaxing if the tin is small.
    let picked
    for (const sep of [0.085, 0.06, 0.035, 0]) {
      const spaced = candidates.filter((p) => chosen.every((c) => deltaE(c.p.lab, p.lab) >= sep))
      if (spaced.length) {
        picked = pickTop(rng, spaced.map((p) => ({ p, score: scorer(p, ctx) })))
        if (sep < 0.085) relaxed++
        break
      }
    }
    if (!picked) continue
    chosen.push({ p: picked, slot })
    used.add(picked.code)
    if (slot.kind === 'main') ctx.main = picked
  }

  // Never deal Black as the shadow pencil alongside White unless a twist asked
  // for it (a black subject, like a blackbird, may still have Black as its main).
  const hasWhite = chosen.some((c) => c.p.code === WHITE)
  const blackIdx = chosen.findIndex((c) => isBlack(c.p) && c.slot.kind === 'dark')
  if (hasWhite && blackIdx >= 0 && !rule) {
    const alt = owned
      .filter((p) => !used.has(p.code) && !isBlack(p) && p.lch.L < 0.45)
      .sort((x, y) => scoreDark(x, ctx) - scoreDark(y, ctx))[0]
    if (alt && !keep[chosen[blackIdx].slot.key]) {
      used.delete(chosen[blackIdx].p.code)
      chosen[blackIdx] = { p: alt, slot: chosen[blackIdx].slot }
      used.add(alt.code)
    }
  }

  // Order by slot order for display.
  const order = new Map(slots.map((s, i) => [s.key, i]))
  chosen.sort((x, y) => order.get(x.slot.key) - order.get(y.slot.key))
  const bareLights = !chosen.some((c) => c.p.lch.L > 0.84)
  return {
    pencils: chosen.map((c) => ({ code: c.p.code, slot: c.slot.key, role: c.slot.role })),
    bareLights,
    relaxed,
  }
}

function fixedPalette(rule, owned) {
  const pickNear = (hex, exclude) => nearestTo(owned, hex, exclude)
  if (rule === 'moon') {
    const dark = owned.find((p) => p.code === INDIGO) || pickNear('#2A3F63')
    const light = owned.find((p) => p.code === WHITE) || pickNear('#FFFFFF', new Set([dark?.code]))
    return fixedResult([
      dark && { code: dark.code, slot: 'dark', role: 'for everything in shadow' },
      light && light.code !== dark?.code && { code: light.code, slot: 'light', role: 'for the moonlight, pressed in hard' },
    ])
  }
  if (rule === 'sepia') {
    const dark = owned.find((p) => p.code === DARK_BROWN) || pickNear('#5C4335')
    const light = owned.find((p) => p.code === WHITE) || pickNear('#FFFFFF', new Set([dark?.code]))
    return fixedResult([
      dark && { code: dark.code, slot: 'dark', role: 'for every line and shadow' },
      light && light.code !== dark?.code && { code: light.code, slot: 'light', role: 'for the highlights on the tan paper' },
    ])
  }
  return null
}

function fixedResult(list) {
  const pencils = list.filter(Boolean)
  return { pencils, bareLights: !pencils.some((p) => p.slot === 'light'), relaxed: 0 }
}

// Re-fit an existing set of pencils to new role slots (for "new picture, same
// colours"): each slot takes the remaining pencil that suits it best.
export function refitRoles({ pencils, codes, slots, mood }) {
  const byCode = new Map(pencils.map((p) => [p.code, p]))
  const remaining = codes.map((c) => byCode.get(c)).filter(Boolean)
  const out = []
  const ctx = { mood, subjectAnchor: slots.find((s) => s.kind === 'main')?.anchor }
  for (const slot of slots) {
    if (!remaining.length) break
    const scorer = slot.kind === 'anchor' ? scoreAnchor(slot.anchor) : SCORERS[slot.kind]
    if (!scorer || (slot.kind === 'main' && !ctx.subjectAnchor)) continue
    let bestIdx = 0
    let best = Infinity
    remaining.forEach((p, i) => {
      const s = scorer(p, ctx)
      if (s < best) { best = s; bestIdx = i }
    })
    const [p] = remaining.splice(bestIdx, 1)
    out.push({ code: p.code, slot: slot.key, role: slot.role })
    if (slot.kind === 'main') ctx.main = p
  }
  for (const p of remaining) out.push({ code: p.code, slot: 'extra', role: 'for wherever it wants to go' })
  return out
}
