import { describe, it, expect } from 'vitest'
import { dealReading, swapCard, repaint, swapPencil, toggleLock, newPicture, dealChoices } from '../../src/engine/reading.js'
import { subjectFitsPlace, whenFitsPlace } from '../../src/engine/compat.js'
import { preparePencils, dealPalette, anchorFor } from '../../src/engine/harmony.js'
import { mulberry32 } from '../../src/engine/rng.js'
import { ctxFor, fixtureContent, tinOf, allPencils } from './fixtures.js'

const by = (id) => fixtureContent.byId.get(id)

describe('dealReading', () => {
  it('is reproducible from its seed', () => {
    const a = dealReading(ctxFor(), { spread: 'evening', seed: 123 })
    const b = dealReading(ctxFor(), { spread: 'evening', seed: 123 })
    expect(a).toEqual(b)
  })

  it('deals compatible cards for every spread across many seeds', () => {
    for (const spread of ['quick', 'evening', 'big']) {
      for (let seed = 0; seed < 300; seed++) {
        const ctx = ctxFor()
        const r = dealReading(ctx, { spread, seed })
        const who = by(r.cards.who)
        expect(who).toBeTruthy()
        expect(r.text.sentence).toMatch(/^[A-Z].*[.]$/)
        expect(r.text.sentence).not.toMatch(/\{|\}|undefined|null|\s{2}/)
        if (spread !== 'quick') {
          const where = by(r.cards.where)
          const when = by(r.cards.when)
          const twist = r.cards.twist && by(r.cards.twist)
          expect(subjectFitsPlace(who, where, r.season, { ignoreScale: twist?.effects?.scale === 'any' })).toBe(true)
          expect(whenFitsPlace(when, where, r.season)).toBe(true)
        }
        if (spread === 'big') expect(r.cards.twist).toBeTruthy()
      }
    }
  })

  it('never deals out-of-season cards', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = dealReading(ctxFor({ date: new Date('2026-01-10T10:00:00') }), { spread: 'evening', seed })
      expect(r.cards.who).not.toBe('fur-swallow')
      expect(r.cards.who).not.toBe('leaf-conker')
    }
    const summer = new Set()
    for (let seed = 0; seed < 300; seed++) summer.add(dealReading(ctxFor({ date: new Date('2026-07-10T10:00:00') }), { spread: 'evening', seed }).cards.when)
    expect(summer.has('when-frost')).toBe(false)
  })

  it('only deals pencils from the tin, distinct, never the blender', () => {
    const tin12 = tinOf('12')
    const codes = new Set(tin12.map((p) => p.code))
    for (let seed = 0; seed < 200; seed++) {
      const r = dealReading(ctxFor({ pencils: tin12 }), { spread: 'big', seed })
      const dealt = r.palette.pencils.map((p) => p.code)
      dealt.forEach((c) => expect(codes.has(c)).toBe(true))
      expect(new Set(dealt).size).toBe(dealt.length)
      expect(dealt).not.toContain('PC1077')
    }
  })

  it('fills the first mark with a dealt pencil name', () => {
    const ctx = ctxFor()
    for (let seed = 0; seed < 50; seed++) {
      const r = dealReading(ctx, { spread: 'evening', seed })
      const names = r.palette.pencils.map((p) => ctx.pencilsByCode.get(p.code).name)
      expect(names.some((n) => r.text.firstMark.includes(n))).toBe(true)
    }
  })

  it('works with a tiny tin', () => {
    const tiny = preparePencils(allPencils.filter((p) => ['PC901', 'PC938'].includes(p.code)))
    const r = dealReading(ctxFor({ pencils: tiny }), { spread: 'big', seed: 9 })
    expect(r.palette.pencils.length).toBeGreaterThanOrEqual(1)
    expect(r.palette.pencils.length).toBeLessThanOrEqual(2)
    expect(r.text.smallTin).toBeTruthy()
  })

  it('avoids recently dealt cards', () => {
    const history = { recent: [{ cards: { who: 'fur-robin' } }, { cards: { who: 'fur-wren' } }] }
    let robin = 0
    for (let seed = 0; seed < 200; seed++) if (dealReading(ctxFor({ history }), { spread: 'quick', seed }).cards.who === 'fur-robin') robin++
    expect(robin).toBe(0)
  })

  it('brings back old friends once she has sealed three cards', () => {
    const seals = ['fur-robin', 'hearth-teapot', 'fur-wren'].map((cardId, i) => ({ cardId, createdAt: `2026-0${i + 3}-01T10:00:00Z` }))
    let friends = 0
    for (let seed = 0; seed < 600; seed++) {
      const r = dealReading(ctxFor({ history: { seals } }), { spread: 'evening', seed })
      if (r.oldFriend) {
        friends++
        expect(r.text.opener).toMatch(/^An old friend: your \w+ from (March|April|May)\.$/)
        expect(r.text.sentence).toMatch(/the (robin|teapot|wren)/i)
      }
    }
    expect(friends).toBeGreaterThan(40)
    expect(friends).toBeLessThan(200)
  })

  it('deals a page of small things', () => {
    const r = dealReading(ctxFor(), { spread: 'small', seed: 4 })
    expect(r.cards.theme).toBe('theme-rain')
    expect(r.slots).toHaveLength(6)
    expect(r.text.sentence).toBe('Small things from a rainy Sunday.')
    expect(r.palette.pencils.length).toBeGreaterThanOrEqual(4)
    const four = dealReading(ctxFor({ settings: { smallCount: 4 } }), { spread: 'small', seed: 4 })
    expect(four.slots).toHaveLength(4)
  })

  it('applies the Moon twist palette', () => {
    let seen = false
    for (let seed = 0; seed < 300 && !seen; seed++) {
      const r = dealReading(ctxFor(), { spread: 'big', seed })
      if (r.cards.twist === 'twist-moon') {
        seen = true
        expect(r.palette.pencils.map((p) => p.code).sort()).toEqual(['PC901', 'PC938'])
        expect(r.palette.paper).toBe('dark')
        expect(r.text.paperLine).toBeTruthy()
      }
    }
    expect(seen).toBe(true)
  })

  it('never deals the Mirror twist without seals', () => {
    for (let seed = 0; seed < 200; seed++) expect(dealReading(ctxFor(), { spread: 'big', seed }).cards.twist).not.toBe('twist-mirror')
  })
})

describe('swaps', () => {
  it('swapping one card keeps the others', () => {
    const ctx = ctxFor()
    let checked = 0
    for (let seed = 0; seed < 100; seed++) {
      const r = dealReading(ctx, { spread: 'evening', seed })
      const s = swapCard(r, ctx, 'when')
      if (s.cards.when !== r.cards.when) {
        checked++
        expect(s.cards.who).toBe(r.cards.who)
        expect(s.cards.where).toBe(r.cards.where)
        expect(s.palette.pencils.find((p) => p.slot === 'main')?.code).toBe(r.palette.pencils.find((p) => p.slot === 'main')?.code)
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('swapping who keeps place when it fits', () => {
    const ctx = ctxFor()
    for (let seed = 0; seed < 100; seed++) {
      const r = dealReading(ctx, { spread: 'evening', seed })
      const s = swapCard(r, ctx, 'who')
      expect(subjectFitsPlace(by(s.cards.who), by(s.cards.where), s.season, { ignoreScale: !!s.cards.twist })).toBe(true)
      expect(s.text.sentence).not.toMatch(/\{|undefined/)
    }
  })

  it('repaint keeps the cards and locked pencils', () => {
    const ctx = ctxFor({ set: '150' })
    const r = toggleLock(dealReading(ctx, { spread: 'evening', seed: 77 }), 0)
    const p = repaint(r, ctx)
    expect(p.cards).toEqual(r.cards)
    expect(p.palette.pencils[0].code).toBe(r.palette.pencils[0].code)
    expect(p.palette.pencils[0].locked).toBe(true)
  })

  it('swapPencil changes only that pencil', () => {
    const ctx = ctxFor({ set: '150' })
    const r = dealReading(ctx, { spread: 'evening', seed: 5 })
    const s = swapPencil(r, ctx, 1)
    expect(s.palette.pencils[1].code).not.toBe(r.palette.pencils[1].code)
    expect(s.palette.pencils[0].code).toBe(r.palette.pencils[0].code)
    expect(s.palette.pencils.length).toBe(r.palette.pencils.length)
  })

  it('new picture keeps the same colours', () => {
    const ctx = ctxFor()
    const r = dealReading(ctx, { spread: 'evening', seed: 11 })
    const n = newPicture(r, ctx)
    expect(n.palette.pencils.map((p) => p.code).sort()).toEqual(r.palette.pencils.map((p) => p.code).sort())
  })

  it('deals three distinct choices', () => {
    const choices = dealChoices(ctxFor(), { spread: 'evening', seed: 3 })
    expect(choices).toHaveLength(3)
    expect(new Set(choices.map((c) => c.cards.who)).size).toBe(3)
  })
})

describe('harmony', () => {
  it('includes a dark, prefers chromatic darks over black', () => {
    const pencils = tinOf('24')
    let black = 0
    for (let seed = 0; seed < 200; seed++) {
      const out = dealPalette({
        pencils,
        slots: [
          { key: 'main', kind: 'main', anchor: anchorFor('#C98A3E'), role: 'm' },
          { key: 'dark', kind: 'dark', role: 'd' },
          { key: 'light', kind: 'light', role: 'l' },
        ],
        mood: 'cool',
        rng: mulberry32(seed),
      })
      const dark = out.pencils.find((p) => p.slot === 'dark')
      expect(dark).toBeTruthy()
      const L = pencils.find((p) => p.code === dark.code).lch.L
      expect(L).toBeLessThan(0.5)
      if (dark.code === 'PC935') black++
    }
    expect(black).toBe(0)
  })
  it('snaps the main colour to the nearest owned pencil', () => {
    const pencils = tinOf('150')
    const out = dealPalette({ pencils, slots: [{ key: 'main', kind: 'main', anchor: anchorFor('#2A3F63'), role: 'm' }], mood: 'cool', rng: mulberry32(1) })
    const p = pencils.find((x) => x.code === out.pencils[0].code)
    expect(p.family).toBe('blue')
  })
})

describe('harmony details', () => {
  const slots = (mainHex) => [
    { key: 'main', kind: 'main', anchor: anchorFor(mainHex), role: 'm' },
    { key: 'dark', kind: 'dark', role: 'd' },
    { key: 'light', kind: 'light', role: 'l' },
  ]
  it('picks White or a near-white for highlights, never a bright colour', () => {
    const pencils = tinOf('48')
    for (let seed = 0; seed < 300; seed++) {
      for (const mood of ['cool', 'muted', 'bright', 'dark', 'warm']) {
        const out = dealPalette({ pencils, slots: slots('#8C6B47'), mood, rng: mulberry32(seed) })
        const light = out.pencils.find((p) => p.slot === 'light')
        if (!light) continue
        const p = pencils.find((x) => x.code === light.code)
        expect(p.lch.C).toBeLessThan(mood === 'warm' ? 0.08 : 0.05)
      }
    }
  })
  it('keeps Black as the main colour of a black subject', () => {
    const pencils = tinOf('48')
    const out = dealPalette({ pencils, slots: slots('#24201E'), mood: 'muted', rng: mulberry32(2) })
    expect(out.pencils.find((p) => p.slot === 'main').code).toBe('PC935')
  })
  it('never deals metallics for an ordinary subject', () => {
    const pencils = tinOf('48')
    for (let seed = 0; seed < 200; seed++) {
      const out = dealPalette({ pencils, slots: slots('#A9ABAE'), mood: 'cool', rng: mulberry32(seed) })
      out.pencils.forEach((p) => expect(['PC949', 'PC950']).not.toContain(p.code))
    }
  })
})
