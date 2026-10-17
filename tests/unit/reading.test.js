import { describe, it, expect } from 'vitest'
import { dealReading, swapCard, repaint, swapPencil, toggleLock, newPicture, dealChoices, indexContent } from '../../src/engine/reading.js'
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

describe('final review fixes', () => {
  it('weather hours need a window indoors; indoor hours stay indoors', async () => {
    const { whenFitsPlace } = await import('../../src/engine/compat.js')
    const cooker = { scope: 'indoor', seasons: ['spring', 'summer', 'autumn', 'winter'] }
    const bay = { ...cooker, window: true }
    const porch = { ...cooker, scope: 'threshold' }
    const mist = { scope: 'any', sky: true, seasons: ['spring', 'summer', 'autumn', 'winter'] }
    const kettle = { scope: 'indoor', seasons: ['spring', 'summer', 'autumn', 'winter'] }
    expect(whenFitsPlace(mist, cooker, 'spring')).toBe(false)
    expect(whenFitsPlace(mist, bay, 'spring')).toBe(true)
    expect(whenFitsPlace(mist, porch, 'spring')).toBe(true)
    expect(whenFitsPlace(kettle, porch, 'spring')).toBe(false)
    expect(whenFitsPlace(kettle, cooker, 'spring')).toBe(true)
  })

  it('drops the Light line under a palette twist', () => {
    let seen = 0
    for (let seed = 0; seed < 300; seed++) {
      const r = dealReading(ctxFor(), { spread: 'big', seed })
      if (r.palette.rule) {
        seen++
        expect(r.text.brief.some((l) => l.key === 'light')).toBe(false)
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('never deals a strongly coloured pencil as the highlight', () => {
    const pencils = tinOf('48')
    for (let seed = 0; seed < 300; seed++) {
      const out = dealPalette({
        pencils,
        slots: [
          { key: 'main', kind: 'main', anchor: anchorFor('#F2E6CF'), role: 'm' },
          { key: 'dark', kind: 'dark', role: 'd' },
          { key: 'light', kind: 'light', role: 'l' },
        ],
        mood: 'bright',
        rng: mulberry32(seed),
      })
      const light = out.pencils.find((p) => p.slot === 'light')
      if (light) expect(pencils.find((p) => p.code === light.code).lch.C).toBeLessThan(0.06)
    }
  })

  it('a lonely-pencil note goes when its pencil leaves the palette', () => {
    const ctx = ctxFor()
    const r = dealReading(ctx, { spread: 'evening', seed: 3 })
    r.lonely = { code: 'PC999', since: '2026-01-01T00:00:00Z' }
    r.text.lonelyLine = 'Nobody has seen PC999 for ages.'
    const s = swapCard(r, ctx, 'when')
    expect(s.text.lonelyLine).toBe('')
  })

  it('new picture keeps a palette twist and its pencils', () => {
    const ctx = ctxFor()
    let checked = 0
    for (let seed = 0; seed < 300 && checked < 5; seed++) {
      const r = dealReading(ctx, { spread: 'big', seed })
      if (r.cards.twist !== 'twist-moon') continue
      checked++
      const n = newPicture(r, ctx)
      expect(n.cards.twist).toBe('twist-moon')
      expect(n.palette.pencils.map((p) => p.code).sort()).toEqual(['PC901', 'PC938'])
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('names reds as red, not reddish brown', async () => {
    const { colourName } = await import('../../src/engine/color.js')
    expect(colourName('#C3302C')).toBe('red')
    expect(colourName('#B8463C')).toBe('red')
    expect(colourName('#E8A39B')).toBe('pink')
    expect(colourName('#C98A3E')).toBe('golden brown')
  })
})

describe('correctness review fixes', () => {
  const seals = ['fur-robin', 'hearth-teapot', 'fur-wren'].map((cardId, i) => ({ cardId, createdAt: `2026-0${i + 3}-01T10:00:00Z` }))

  it('swapping the twist to the Mirror keeps the whole reading compatible', () => {
    const ctx = ctxFor({ history: { seals } })
    let mirrors = 0
    for (let seed = 0; seed < 300; seed++) {
      let r = dealReading(ctx, { spread: 'big', seed })
      for (let k = 0; k < 4; k++) {
        r = swapCard(r, ctx, 'twist')
        if (r.cards.twist !== 'twist-mirror') continue
        mirrors++
        const twist = by(r.cards.twist)
        expect(r.oldFriend).toBeTruthy()
        expect(subjectFitsPlace(by(r.cards.who), by(r.cards.where), r.season, { ignoreScale: twist?.effects?.scale === 'any' })).toBe(true)
        expect(whenFitsPlace(by(r.cards.when), by(r.cards.where), r.season)).toBe(true)
      }
    }
    expect(mirrors).toBeGreaterThan(0)
  })

  it('never deals the Mirror when no sealed card fits the season', () => {
    const autumnOnly = [{ cardId: 'leaf-conker', createdAt: '2026-10-01T10:00:00Z' }]
    const ctx = ctxFor({ history: { seals: autumnOnly }, date: new Date('2026-04-10T10:00:00') })
    for (let seed = 0; seed < 200; seed++) expect(dealReading(ctx, { spread: 'big', seed }).cards.twist).not.toBe('twist-mirror')
  })

  it('a kept pencil survives New picture and the edits after it', () => {
    const ctx = ctxFor({ set: '150' })
    for (let seed = 0; seed < 60; seed++) {
      let r = dealReading(ctx, { spread: 'evening', seed })
      // Moonlight and Brown and White have no Keep buttons.
      if (r.palette.fixed) continue
      r = toggleLock(r, 0)
      const kept = r.palette.pencils[0].code
      r = newPicture(r, ctx)
      expect(r.palette.pencils.some((p) => p.code === kept && p.locked)).toBe(true)
      r = swapPencil(r, ctx, r.palette.pencils.findIndex((p) => !p.locked))
      expect(r.palette.pencils.some((p) => p.code === kept)).toBe(true)
      r = repaint(r, ctx)
      expect(r.palette.pencils.some((p) => p.code === kept)).toBe(true)
    }
  })
})

describe('accent pencil', () => {
  // Every subject gets a blue accent and a first mark that names it.
  const accentContent = (marks) => {
    const { byId, ...raw } = fixtureContent
    const subjects = raw.subjects.map((c) => ({ ...c, accent: '#2B6CB0', roles: { ...c.roles, accent: 'for the blue cap' }, firstMark: marks }))
    return indexContent({ ...raw, subjects })
  }

  it('names the subject\'s own accent pencil, never the Also card\'s', () => {
    const ctx = ctxFor({ set: '150', content: accentContent(['Start with the blue cap in {accent}.']) })
    let withAlso = 0
    for (const spread of ['quick', 'evening', 'big']) {
      for (let seed = 0; seed < 150; seed++) {
        const r = dealReading(ctx, { spread, seed })
        if (r.palette.rule) continue
        const accent = r.palette.pencils.find((p) => p.slot === 'accent')
        expect(accent, `${spread} ${seed}`).toBeTruthy()
        expect(r.text.firstMark).toBe(`Start with the blue cap in ${ctx.pencilsByCode.get(accent.code).name}.`)
        if (r.cards.also) {
          withAlso++
          expect(r.palette.pencils.find((p) => p.slot === 'also')?.role).toMatch(/^for the /)
        }
      }
    }
    expect(withAlso).toBeGreaterThan(0)
  })

  it('falls back to a first mark without {accent} when a twist leaves the accent out', () => {
    const ctx = ctxFor({ set: '150', content: accentContent(['Start with the blue cap in {accent}.', 'Start with the eye in {dark}.']) })
    let ruled = 0
    for (let seed = 0; seed < 300; seed++) {
      const r = dealReading(ctx, { spread: 'big', seed })
      if (r.palette.pencils.some((p) => p.slot === 'accent')) continue
      ruled++
      expect(r.text.firstMark).toMatch(/^Start with the eye in /)
    }
    expect(ruled).toBeGreaterThan(0)
  })
})

describe('hours and palette names', () => {
  it('an hour with a places list only fits those places', () => {
    const kettle = { id: 'when-kettle', seasons: ['autumn'], scope: 'indoor', places: ['where-kitchen'] }
    expect(whenFitsPlace(kettle, { id: 'where-kitchen', scope: 'indoor', seasons: ['autumn'] }, 'autumn')).toBe(true)
    expect(whenFitsPlace(kettle, { id: 'where-attic', scope: 'indoor', seasons: ['autumn'] }, 'autumn')).toBe(false)
  })

  it('a timed palette name never turns up on a page with no hour', () => {
    const { byId, ...raw } = fixtureContent
    const content = indexContent({ ...raw, palettes: Object.fromEntries(Object.keys(raw.palettes).map((k) => [k, [{ name: 'Owl Light', times: ['night'] }, 'Pencil Box']])) })
    const ctx = ctxFor({ content })
    for (let seed = 0; seed < 80; seed++) {
      expect(dealReading(ctx, { spread: 'quick', seed }).palette.name).toBe('Pencil Box')
      expect(dealReading(ctx, { spread: 'small', seed }).palette.name).toBe('Pencil Box')
    }
  })
})

describe('final verification fixes', () => {
  it('a leftover pencil stays when she swaps a different one', () => {
    const ctx = ctxFor({ set: '150' })
    let checked = 0
    for (const spread of ['evening', 'big']) {
      for (let seed = 0; seed < 120; seed++) {
        const r = newPicture(dealReading(ctx, { spread, seed }), ctx)
        const extra = r.palette.pencils.findIndex((p) => p.slot.startsWith('extra'))
        if (extra < 0) continue
        const other = r.palette.pencils.findIndex((_, i) => i !== extra)
        checked++
        expect(swapPencil(r, ctx, other).palette.pencils.some((p) => p.code === r.palette.pencils[extra].code)).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('a kept metallic stays kept through a repaint', () => {
    const ctx = ctxFor({ set: '150' })
    let seed = 0
    while (dealReading(ctx, { spread: 'evening', seed }).palette.rule) seed++
    const r = dealReading(ctx, { spread: 'evening', seed })
    r.palette.pencils[0] = { ...r.palette.pencils[0], code: 'PC950', locked: true }
    const after = repaint(r, ctx)
    expect(after.palette.pencils.some((p) => p.code === 'PC950' && p.locked)).toBe(true)
  })

  it('a fixed palette never shows a kept mark', () => {
    const ctx = ctxFor({ set: '150' })
    for (let seed = 0; seed < 80; seed++) {
      let r = dealReading(ctx, { spread: 'big', seed })
      r = toggleLock(r, 0)
      r = swapCard(r, ctx, 'twist')
      if (r.palette.fixed) expect(r.palette.pencils.some((p) => p.locked)).toBe(false)
    }
  })

  it('a reading saved before the Also slot is upgraded on its first edit', () => {
    const ctx = ctxFor({ set: '150' })
    let upgraded = 0
    for (let seed = 0; seed < 80; seed++) {
      const r = dealReading(ctx, { spread: 'big', seed })
      if (!r.cards.also || !r.palette.pencils.some((p) => p.slot === 'also')) continue
      const old = JSON.parse(JSON.stringify(r))
      old.v = 1
      old.palette.pencils = old.palette.pencils.filter((p) => p.slot !== 'accent').map((p) => (p.slot === 'also' ? { ...p, slot: 'accent' } : p))
      const alsoCode = old.palette.pencils.find((p) => p.slot === 'accent').code
      const after = toggleLock(old, 0)
      expect(after.v).toBe(2)
      expect(after.palette.pencils.find((p) => p.code === alsoCode).slot).toBe('also')
      upgraded++
    }
    expect(upgraded).toBeGreaterThan(0)
  })

  it('old friends in a quick doodle are in season', () => {
    const seals = [{ cardId: 'leaf-conker', createdAt: '2025-10-01T10:00:00Z' }, { cardId: 'fur-robin', createdAt: '2025-10-02T10:00:00Z' }, { cardId: 'fur-wren', createdAt: '2025-10-03T10:00:00Z' }]
    const ctx = ctxFor({ history: { seals }, date: new Date('2026-04-18T10:00:00') })
    for (let seed = 0; seed < 300; seed++) expect(dealReading(ctx, { spread: 'quick', seed }).cards.who).not.toBe('leaf-conker')
  })
})
