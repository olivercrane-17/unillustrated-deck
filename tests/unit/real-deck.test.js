// Engine rules checked against the real card deck, where the fixtures are
// too small to show them.
import { describe, it, expect } from 'vitest'
import { dealReading, newPicture } from '../../src/engine/reading.js'
import { canDealMono, anchorFor } from '../../src/engine/harmony.js'
import { hueDistance } from '../../src/engine/color.js'
import { content } from '../../src/data/content.js'
import { ctxFor } from './fixtures.js'

const by = (id) => content.byId.get(id)
const DATES = ['2026-01-12T20:00:00', '2026-04-12T10:00:00', '2026-07-12T15:00:00', '2026-10-12T21:00:00']

function deals(set, spread, n, extra = {}) {
  const out = []
  for (const iso of DATES) {
    const ctx = ctxFor({ content, set, date: new Date(iso) })
    for (let seed = 0; seed < n; seed++) out.push({ ctx, r: dealReading(ctx, { spread, seed: seed * 7919 + 13, ...extra }) })
  }
  return out
}

describe('palette twists on the real deck', () => {
  it('Moonlight comes with a moonlit hour, not lamplight or a sunset', () => {
    const moon = by('twist-moon')
    const all = deals('48', 'big', 60, { fixedTwist: moon })
    const unlit = all.filter(({ r }) => !by(r.cards.when).moonlit)
    expect(unlit.length / all.length).toBeLessThan(0.05)
  })

  it('One Colour Family deals a light, a middle and a dark of one colour', () => {
    const mono = by('twist-single-skein')
    for (const set of ['12', '24', '48', '150']) {
      const ctx = ctxFor({ content, set })
      if (!canDealMono(ctx.pencils)) continue
      for (const { ctx: c, r } of deals(set, 'big', 25, { fixedTwist: mono })) {
        const ps = r.palette.pencils.map((p) => c.pencilsByCode.get(p.code))
        expect(ps.length, `${set} ${r.seed}`).toBe(3)
        for (const p of ps) expect(p.lch.C).toBeGreaterThanOrEqual(0.03)
        for (const p of ps) expect(hueDistance(p.lch.h, ps[0].lch.h)).toBeLessThan(32)
      }
    }
  })

  it('Three Pencils keeps a shadow pencil', () => {
    const three = by('twist-three-pencils-only')
    for (const { r } of deals('48', 'big', 15, { fixedTwist: three })) {
      expect(r.palette.pencils).toHaveLength(3)
      expect(r.palette.pencils.some((p) => p.slot === 'dark')).toBe(true)
    }
  })

  it('Opposite Colours never names a shadow pencil it did not deal', () => {
    const opp = by('twist-opposites')
    for (const { ctx, r } of deals('48', 'big', 15, { fixedTwist: opp })) {
      const names = r.palette.pencils.map((p) => ctx.pencilsByCode.get(p.code).name)
      const named = ctx.pencils.filter((p) => r.text.firstMark.includes(p.name)).map((p) => p.name)
      for (const n of named) expect(names.some((m) => m.includes(n) || n.includes(m)), r.text.firstMark).toBe(true)
    }
  })
})

describe('pencil roles on the real deck', () => {
  it('after New picture, the shadow pencil is dark and the highlight pencil is light', () => {
    for (const { ctx, r } of deals('48', 'evening', 30)) {
      const fresh = newPicture(r, ctx)
      for (const p of fresh.palette.pencils) {
        const lch = ctx.pencilsByCode.get(p.code).lch
        if (p.slot === 'dark') expect(lch.L).toBeLessThan(0.5)
        if (p.slot === 'light') expect(lch.L).toBeGreaterThan(0.84)
      }
    }
  })

  it('a white companion gets a pale pencil or none', () => {
    let checked = 0
    for (const { ctx, r } of deals('48', 'big', 80)) {
      const also = r.cards.also && by(r.cards.also)
      const slot = r.palette.pencils.find((p) => p.slot === 'also')
      if (!also || !slot) continue
      const target = ctx.pencilsByCode.get(slot.code)
      const { lch } = anchorFor(also.colours[0])
      if (!(lch.L > 0.85 && lch.C < 0.05)) continue
      checked++
      expect(target.lch.L, `${also.id} got ${target.name}`).toBeGreaterThan(0.84)
    }
    expect(checked).toBeGreaterThan(0)
  })
})
