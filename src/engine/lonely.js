// Lonely pencils: now and then, a pencil that hasn't come up for three weeks
// takes the place of a similar one in the palette. The line it brings is honest
// about what the app knows: when it was last dealt, nothing more.
import { deltaE } from './color.js'
import { monthName } from './seasons.js'
import { fill } from './templates.js'

const DAY = 86400000
export const LONELY_DAYS = 21
const CHANCE = 0.25
const MAX_DISTANCE = 0.16

export function lonelyCandidates(ctx, exclude = new Set()) {
  const stats = ctx.pencilStats || {}
  const now = ctx.date.getTime()
  const installed = ctx.installedAt ? Date.parse(ctx.installedAt) : null
  const out = []
  for (const p of ctx.pencils) {
    if (p.special === 'blender' || exclude.has(p.code)) continue
    const last = stats[p.code]?.lastDealt ? Date.parse(stats[p.code].lastDealt) : installed
    if (last && now - last >= LONELY_DAYS * DAY) out.push({ p, since: last })
  }
  return out
}

export function lonelyLine(ctx, pencil, since) {
  const lines = ctx.content.lines || {}
  const values = { name: pencil.name, month: monthName(new Date(since)) }
  const bespoke = lines.lonely?.[pencil.code]
  const family = lines.lonelyFamily?.[pencil.family]
  const options = bespoke?.length ? bespoke : family?.length ? family : ['{name} hasn\'t come up since {month}.']
  const tpl = options[Math.floor(since / DAY) % options.length]
  return fill(tpl, values)
}

export function applyLonely(reading, ctx, rng) {
  if (rng() >= CHANCE || reading.palette?.rule) return reading
  const inPalette = new Set(reading.palette.pencils.map((p) => p.code))
  const lonely = lonelyCandidates(ctx, inPalette)
  if (!lonely.length) return reading
  let best = null
  reading.palette.pencils.forEach((slotP, i) => {
    if (slotP.locked) return
    const current = ctx.pencilsByCode.get(slotP.code)
    if (!current) return
    for (const l of lonely) {
      const d = deltaE(current.lab, l.p.lab) + (slotP.slot === 'main' ? 0.04 : 0)
      if (d > MAX_DISTANCE) continue
      // Stay distinct from the rest of the palette.
      const clashes = reading.palette.pencils.some((o, j) => j !== i && deltaE(ctx.pencilsByCode.get(o.code).lab, l.p.lab) < 0.035)
      if (clashes) continue
      if (!best || d < best.d) best = { i, l, d }
    }
  })
  if (!best) return reading
  const { p, since } = best.l
  reading.palette.pencils[best.i] = { ...reading.palette.pencils[best.i], code: p.code }
  reading.lonely = { code: p.code, since: new Date(since).toISOString() }
  reading.text = { ...(reading.text || {}), lonelyLine: lonelyLine(ctx, p, since) }
  return reading
}
