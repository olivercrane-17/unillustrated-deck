import { describe, it, expect } from 'vitest'
import {
  FAMILY_GROUPS, groupPencils, matchesQuery, passesFilter, countLine, canDeal, setTicked, presetNeedsConfirm,
  variantNeedsAnswer, variantApplies, chooseVariant, ownedInOrder, toInputHex,
} from '../../src/ui/tin-helpers.js'
import pencils from '../../src/data/pencils.json'
import sets from '../../src/data/sets.json'
import { hexToOklab } from '../../src/engine/color.js'

const purple = sets['48'].variants.find((v) => v.id === 'purple')
const lightness = (p) => hexToOklab(p.hex).L

describe('grouping the catalogue', () => {
  const groups = groupPencils(pencils, { lightness })

  it('puts families in tin order, with black and white together', () => {
    expect(groups.map((g) => g.label)).toEqual(['Reds', 'Oranges', 'Yellows', 'Greens', 'Blues', 'Purples', 'Pinks', 'Browns', 'Greys', 'Black and white', 'Metallics'])
    const bw = groups.find((g) => g.key === 'bw').pencils.map((p) => p.code)
    expect(bw).toEqual(expect.arrayContaining(['PC935', 'PC938', 'PC1077']))
  })

  it('keeps every pencil exactly once', () => {
    const codes = groups.flatMap((g) => g.pencils.map((p) => p.code))
    expect(codes).toHaveLength(pencils.length)
    expect(new Set(codes).size).toBe(pencils.length)
  })

  it('runs light to dark within a family', () => {
    const reds = groups.find((g) => g.key === 'reds').pencils.map(lightness)
    expect(reds).toEqual([...reds].sort((a, b) => b - a))
  })

  it('keeps numbered series together in step order', () => {
    const greys = groups.find((g) => g.key === 'greys').pencils.map((p) => p.name)
    const warm = greys.filter((n) => n.startsWith('Warm Grey'))
    expect(warm).toEqual(['Warm Grey 10%', 'Warm Grey 20%', 'Warm Grey 30%', 'Warm Grey 50%', 'Warm Grey 70%', 'Warm Grey 90%'])
    const first = greys.indexOf('Warm Grey 10%')
    expect(greys.slice(first, first + warm.length)).toEqual(warm)
    expect(greys[0]).toBe('Slate Grey')
  })

  it('collects unknown families at the end rather than losing them', () => {
    const out = groupPencils([{ code: 'X1', name: 'Mystery', hex: '#123456', family: 'nebula' }, pencils[0]])
    expect(out.at(-1)).toMatchObject({ key: 'other' })
    expect(out.at(-1).pencils[0].code).toBe('X1')
  })

  it('has a label for every family in the catalogue', () => {
    const known = new Set(FAMILY_GROUPS.flatMap((g) => g.families))
    for (const p of pencils) expect(known.has(p.family), p.family).toBe(true)
  })
})

describe('search', () => {
  const tuscan = { code: 'PC937', name: 'Tuscan Red', family: 'red' }
  const grey = { code: 'PC1050', name: 'Warm Grey 10%', family: 'grey' }
  it('matches names, codes and families, forgivingly', () => {
    expect(matchesQuery(tuscan, '')).toBe(true)
    expect(matchesQuery(tuscan, 'tuscan')).toBe(true)
    expect(matchesQuery(tuscan, '937')).toBe(true)
    expect(matchesQuery(tuscan, 'pc 937')).toBe(true)
    expect(matchesQuery(tuscan, 'PC937')).toBe(true)
    expect(matchesQuery(tuscan, 'red')).toBe(true)
    expect(matchesQuery(tuscan, 'blue')).toBe(false)
    expect(matchesQuery(grey, 'warm gray')).toBe(true)
    expect(matchesQuery({ code: 'PC1077', name: 'Colorless Blender', family: 'white' }, 'colourless')).toBe(true)
  })
  it('filters by tin and stars', () => {
    const sets = { owned: new Set(['A']), starred: new Set(['B']) }
    expect(passesFilter('A', 'all', sets)).toBe(true)
    expect(passesFilter('A', 'owned', sets)).toBe(true)
    expect(passesFilter('B', 'owned', sets)).toBe(false)
    expect(passesFilter('B', 'starred', sets)).toBe(true)
  })
})

describe('counting and dealing', () => {
  it('says the count plainly', () => {
    expect(countLine(48)).toBe('48 pencils in your tin')
    expect(countLine(1)).toBe('1 pencil in your tin')
    expect(countLine(0)).toBe('No pencils in your tin yet')
  })
  it('needs one real colour to deal; the blender alone is not enough', () => {
    expect(canDeal([], pencils)).toBe(false)
    expect(canDeal(['PC1077'], pencils)).toBe(false)
    expect(canDeal(['PC1077', 'PC937'], pencils)).toBe(true)
    expect(canDeal(['NOPE'], pencils)).toBe(false)
  })
})

describe('ticking', () => {
  it('ticks and unticks a set of codes without touching the rest', () => {
    expect(setTicked(['A', 'B'], ['C', 'D'], true).sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(setTicked(['A', 'B', 'C'], ['B', 'C', 'Z'], false)).toEqual(['A'])
  })
  it('only asks before a preset replaces a hand-ticked tin', () => {
    expect(presetNeedsConfirm({ preset: 'custom' }, '24')).toBe(true)
    expect(presetNeedsConfirm({ preset: 'custom' }, 'none')).toBe(true)
    expect(presetNeedsConfirm({ preset: '48' }, '24')).toBe(false)
    expect(presetNeedsConfirm({ preset: 'none' }, '12')).toBe(false)
  })
})

describe('which purple?', () => {
  it('the 48 box carries the purple question', () => {
    expect(purple.options).toEqual(['PC956', 'PC1104', 'PC1026'])
    expect(purple.options).toContain(purple.default)
  })

  it('asks a fresh 48 tin, and stops once answered', () => {
    const tin = { preset: '48', owned: [...sets['48'].codes] }
    expect(variantNeedsAnswer(tin, purple, '48')).toBe(true)
    expect(variantNeedsAnswer({ ...tin, variantAnswers: { purple: 'PC956' } }, purple, '48')).toBe(false)
  })

  it('asks a hand-ticked tin holding one of the options, but not one holding several', () => {
    expect(variantNeedsAnswer({ preset: 'custom', owned: ['PC1104', 'PC937'] }, purple, '48')).toBe(true)
    expect(variantNeedsAnswer({ preset: 'custom', owned: ['PC937'] }, purple, '48')).toBe(false)
    expect(variantNeedsAnswer({ preset: '150', owned: [...sets['150'].codes] }, purple, '48')).toBe(false)
    expect(variantNeedsAnswer({ preset: '24', owned: [...sets['24'].codes] }, purple, '48')).toBe(false)
  })

  it('knows when the answer is worth showing', () => {
    expect(variantApplies({ preset: '48', owned: [] }, purple, '48')).toBe(true)
    expect(variantApplies({ preset: 'custom', owned: ['PC956'] }, purple, '48')).toBe(true)
    expect(variantApplies({ preset: '12', owned: [...sets['12'].codes] }, purple, '48')).toBe(false)
  })

  it('swaps in the chosen purple and drops the other options', () => {
    const owned = [...sets['48'].codes]
    const lilac = chooseVariant(owned, purple, 'PC956')
    expect(lilac).toContain('PC956')
    expect(lilac).not.toContain('PC1104')
    expect(lilac).not.toContain('PC1026')
    expect(lilac).toHaveLength(owned.length)
    // choosing what is already there changes nothing
    expect(chooseVariant(owned, purple, 'PC1104').sort()).toEqual(owned.slice().sort())
  })
})

describe('the swatch chart and colour input', () => {
  it('lists only owned pencils, in group order, skipping empty families', () => {
    const groups = groupPencils(pencils, { lightness })
    const out = ownedInOrder(groups, ['PC935', 'PC937', 'PC901'])
    expect(out.map((g) => g.label)).toEqual(['Reds', 'Blues', 'Black and white'])
    expect(out.flatMap((g) => g.pencils.map((p) => p.code))).toEqual(['PC937', 'PC901', 'PC935'])
    expect(ownedInOrder(groups, [])).toEqual([])
  })
  it('gives the colour input the lowercase hex it wants', () => {
    expect(toInputHex('#823E3E')).toBe('#823e3e')
    expect(toInputHex('823e3e')).toBe('#823e3e')
    expect(toInputHex('rubbish')).toBe('#999999')
  })
})
