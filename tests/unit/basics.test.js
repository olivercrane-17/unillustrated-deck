import { describe, it, expect } from 'vitest'
import { mulberry32, hashString, subRng, weightedPick, shuffle } from '../../src/engine/rng.js'
import { hexToOklab, hexToOklch, deltaE, hueDistance, inkOn, rgbToHex, hexToRgb } from '../../src/engine/color.js'
import { hemisphereFromTimeZone, seasonFor, timeOfDayFor, monthName } from '../../src/engine/seasons.js'
import { subjectFitsPlace, whenFitsPlace, doingFits } from '../../src/engine/compat.js'
import { fill, tidy, capitalise } from '../../src/engine/templates.js'
import { fixtureContent } from './fixtures.js'

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 5 }, () => a())
    const ys = Array.from({ length: 5 }, () => b())
    expect(xs).toEqual(ys)
    xs.forEach((x) => expect(x).toBeGreaterThanOrEqual(0) && expect(x).toBeLessThan(1))
  })
  it('sub streams differ by label but repeat for the same label', () => {
    expect(subRng(7, 'who', 0)()).toBe(subRng(7, 'who', 0)())
    expect(subRng(7, 'who', 0)()).not.toBe(subRng(7, 'who', 1)())
    expect(hashString('a')).not.toBe(hashString('b'))
  })
  it('weightedPick never picks zero-weight items', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 500; i++) expect(weightedPick(rng, ['a', 'b', 'c'], (x) => (x === 'b' ? 0 : 1))).not.toBe('b')
    expect(weightedPick(rng, ['a'], () => 0)).toBeUndefined()
  })
  it('shuffle keeps every item', () => {
    const out = shuffle(mulberry32(3), [1, 2, 3, 4, 5])
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('colour', () => {
  it('converts white and black to OKLab extremes', () => {
    expect(hexToOklab('#FFFFFF').L).toBeCloseTo(1, 3)
    expect(hexToOklab('#000000').L).toBeCloseTo(0, 3)
    expect(hexToOklch('#808080').C).toBeLessThan(0.001)
  })
  it('round trips hex', () => {
    expect(rgbToHex(hexToRgb('#2a3f63'))).toBe('#2A3F63')
  })
  it('measures perceptual distance', () => {
    const red = hexToOklab('#D43F44')
    const red2 = hexToOklab('#D84446')
    const blue = hexToOklab('#2A3F63')
    expect(deltaE(red, red2)).toBeLessThan(0.03)
    expect(deltaE(red, blue)).toBeGreaterThan(0.2)
  })
  it('hue distance wraps', () => {
    expect(hueDistance(350, 10)).toBe(20)
    expect(hueDistance(0, 180)).toBe(180)
  })
  it('chooses readable ink', () => {
    expect(inkOn('#FFFFFF')).toBe('#2A211C')
    expect(inkOn('#222021')).toBe('#FBF6EA')
  })
})

describe('seasons', () => {
  it('detects the southern hemisphere from the time zone', () => {
    expect(hemisphereFromTimeZone('Europe/London')).toBe('north')
    expect(hemisphereFromTimeZone('Australia/Sydney')).toBe('south')
    expect(hemisphereFromTimeZone('Pacific/Auckland')).toBe('south')
    expect(hemisphereFromTimeZone('America/Argentina/Buenos_Aires')).toBe('south')
    expect(hemisphereFromTimeZone('America/New_York')).toBe('north')
    expect(hemisphereFromTimeZone(undefined)).toBe('north')
  })
  it('maps months to seasons and flips them in the south', () => {
    expect(seasonFor(new Date('2026-10-17T12:00:00'), 'north')).toBe('autumn')
    expect(seasonFor(new Date('2026-10-17T12:00:00'), 'south')).toBe('spring')
    expect(seasonFor(new Date('2026-01-05T12:00:00'), 'north')).toBe('winter')
    expect(seasonFor(new Date('2026-07-05T12:00:00'), 'south')).toBe('winter')
  })
  it('names the time of day', () => {
    expect(timeOfDayFor(new Date('2026-10-17T06:00:00'))).toBe('dawn')
    expect(timeOfDayFor(new Date('2026-10-17T09:00:00'))).toBe('morning')
    expect(timeOfDayFor(new Date('2026-10-17T14:00:00'))).toBe('afternoon')
    expect(timeOfDayFor(new Date('2026-10-17T19:00:00'))).toBe('dusk')
    expect(timeOfDayFor(new Date('2026-10-17T23:30:00'))).toBe('night')
    expect(monthName('2026-03-04T10:00:00')).toBe('March')
  })
})

describe('compatibility', () => {
  const by = (id) => fixtureContent.byId.get(id)
  it('respects habitats and scale', () => {
    expect(subjectFitsPlace(by('fur-robin'), by('where-hedge'), 'autumn')).toBe(true)
    expect(subjectFitsPlace(by('fur-heron'), by('where-cup'), 'autumn')).toBe(false)
    expect(subjectFitsPlace(by('fur-robin'), by('where-cup'), 'autumn')).toBe(false)
    expect(subjectFitsPlace(by('hearth-bun'), by('where-cup'), 'autumn')).toBe(true)
    expect(subjectFitsPlace(by('hearth-teapot'), by('where-cup'), 'autumn', { ignoreScale: true })).toBe(true)
  })
  it('respects seasons, and ignores them when asked', () => {
    expect(subjectFitsPlace(by('fur-swallow'), by('where-pond'), 'winter')).toBe(false)
    expect(subjectFitsPlace(by('fur-swallow'), by('where-pond'), 'summer')).toBe(true)
    expect(subjectFitsPlace(by('fur-swallow'), by('where-pond'), null)).toBe(true)
  })
  it('matches scope between doing, place and hour', () => {
    expect(doingFits({ t: 'x', scope: 'outdoor' }, 'indoor', 'autumn')).toBe(false)
    expect(doingFits({ t: 'x', scope: 'outdoor' }, 'threshold', 'autumn')).toBe(true)
    expect(doingFits({ t: 'x', scope: 'outdoor' }, undefined, 'autumn')).toBe(false)
    expect(doingFits({ t: 'x', scope: 'any', seasons: ['winter'] }, 'indoor', 'autumn')).toBe(false)
    expect(whenFitsPlace(by('when-stars'), by('where-table'), 'autumn')).toBe(false)
    expect(whenFitsPlace(by('when-stars'), by('where-sill'), 'autumn')).toBe(true)
    expect(whenFitsPlace(by('when-frost'), by('where-sill'), 'summer')).toBe(false)
  })
})

describe('templates', () => {
  it('fills and capitalises slots', () => {
    expect(fill('{When}, {subject} {doing}.', { when: 'at dusk', subject: 'a fox', doing: 'is yawning' })).toBe('At dusk, a fox is yawning.')
    expect(() => fill('{missing}', {})).toThrow(/Unfilled/)
    expect(capitalise('abc')).toBe('Abc')
    expect(tidy('A  fox ,  yawning..')).toBe('A fox, yawning.')
  })
})
