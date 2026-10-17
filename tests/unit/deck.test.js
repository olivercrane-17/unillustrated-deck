import { describe, it, expect } from 'vitest'
import { shortDate, longDate, faceOf, groupDrawn, restOfDeck, matchesQuery, tiltOf, DECK_SUITS } from '../../src/ui/deck.js'
import { recentReadings, shownReadings, canCarryOn, leadCardId, STATUS_LABELS, RECENT_LIMIT } from '../../src/ui/readings.js'
import { fullDate, shareFileName, coverRect, wrapWords, fitTitle, layoutShare, PHOTO_RATIO } from '../../src/ui/share.js'

const card = (id, title, extra = {}) => ({ id, title, suit: id.split('-')[0] === 'theme' ? undefined : id.split('-')[0], a: title.replace(/^The /, 'a ').toLowerCase(), phrases: [], ...extra })
const byIdOf = (cards) => new Map(cards.map((c) => [c.id, c]))
const seal = (id, cardId, createdAt, extra = {}) => ({ id, cardId, createdAt, kind: 'photo', imageId: id, isFace: false, ...extra })

describe('deck dates', () => {
  const now = new Date(2026, 9, 17, 20, 0)
  it('writes short dates, adding the year only when it differs', () => {
    expect(shortDate(new Date(2026, 9, 17, 9).toISOString(), now)).toBe('17 Oct')
    expect(shortDate(new Date(2025, 2, 3).toISOString(), now)).toBe('3 Mar 2025')
    expect(shortDate('not a date', now)).toBe('')
  })
  it('says today and yesterday, then the weekday', () => {
    expect(longDate(new Date(2026, 9, 17, 8).toISOString(), now)).toBe('Today')
    expect(longDate(new Date(2026, 9, 16, 23).toISOString(), now)).toBe('Yesterday')
    expect(longDate(new Date(2026, 9, 10).toISOString(), now)).toBe('Saturday 10 October')
    expect(longDate(new Date(2024, 11, 25).toISOString(), now)).toBe('25 December 2024')
  })
  it('handles yesterday across a month boundary', () => {
    expect(longDate(new Date(2026, 8, 30, 12).toISOString(), new Date(2026, 9, 1, 9))).toBe('Yesterday')
  })
})

describe('your deck', () => {
  const cards = [
    card('fur-robin', 'The Robin'),
    card('fur-wren', 'The Wren'),
    card('leaf-conker', 'The Conker', { phrases: ['polished like a chestnut horse'] }),
    card('hearth-teapot', 'The Teapot'),
    card('theme-rainy-sunday', 'A Rainy Sunday', { of: 'from a rainy Sunday' }),
    card('where-windowsill', 'The Warmest Windowsill', { suit: undefined }),
  ]
  const byId = byIdOf(cards)

  it('picks the chosen face, else the latest photo, never a tick', () => {
    const list = [seal('a', 'fur-robin', '2026-01-01'), seal('b', 'fur-robin', '2026-02-01'), seal('c', 'fur-robin', '2026-03-01', { kind: 'tick', imageId: null })]
    expect(faceOf(list).id).toBe('b')
    expect(faceOf([...list.slice(0, 1).map((s) => ({ ...s, isFace: true })), list[1]]).id).toBe('a')
    expect(faceOf([list[2]])).toBeNull()
  })

  it('groups each drawn card once, by suit in deck order, newest first', () => {
    const seals = [
      seal('1', 'leaf-conker', '2026-01-05'),
      seal('2', 'fur-robin', '2026-01-01'),
      seal('3', 'fur-wren', '2026-02-01', { kind: 'tick', imageId: null }),
      seal('4', 'fur-robin', '2026-03-01'),
      seal('5', 'theme-rainy-sunday', '2026-01-02'),
      seal('6', 'fur-gone', '2026-01-02'),
    ]
    const groups = groupDrawn(seals, byId)
    expect(groups.map((g) => g.suit)).toEqual(['fur', 'leaf', 'theme'])
    expect(groups[0].label).toBe('Fur & Feather')
    expect(groups[0].entries.map((e) => e.card.id)).toEqual(['fur-robin', 'fur-wren'])
    const robin = groups[0].entries[0]
    expect(robin.seals.map((s) => s.id)).toEqual(['4', '2'])
    expect(robin.latest.id).toBe('4')
    expect(robin.face.id).toBe('4')
    expect(groups[0].entries[1].face).toBeNull()
    expect(groups.flatMap((g) => g.entries).some((e) => e.card.id === 'fur-gone')).toBe(false)
  })

  it('never puts a place, an hour or a twist in the deck', () => {
    expect(DECK_SUITS).toEqual(['fur', 'leaf', 'hearth', 'theme'])
    const rest = restOfDeck(cards, [])
    expect(rest.flatMap((g) => g.cards).some((c) => c.id.startsWith('where-'))).toBe(false)
  })

  it('lists the rest of the deck without her drawn cards, alphabetically ignoring "The"', () => {
    const more = [...cards, card('fur-badger', 'The Badger'), card('fur-apple-hen', 'An Apple Hen')]
    const rest = restOfDeck(more, new Set(['fur-robin', 'hearth-teapot']))
    expect(rest.map((g) => g.suit)).toEqual(['fur', 'leaf', 'theme'])
    expect(rest[0].cards.map((c) => c.id)).toEqual(['fur-apple-hen', 'fur-badger', 'fur-wren'])
    expect(rest.flatMap((g) => g.cards).some((c) => c.id === 'fur-robin')).toBe(false)
  })

  it('searches titles, nouns and phrases, every word, ignoring case and accents', () => {
    const conker = byId.get('leaf-conker')
    expect(matchesQuery(conker, '')).toBe(true)
    expect(matchesQuery(conker, 'CONK')).toBe(true)
    expect(matchesQuery(conker, 'polished chestnut')).toBe(true)
    expect(matchesQuery(conker, 'polished teapot')).toBe(false)
    expect(matchesQuery({ title: 'The Café Table', phrases: [] }, 'cafe')).toBe(true)
    expect(matchesQuery(byId.get('theme-rainy-sunday'), 'sunday')).toBe(true)
  })

  it('gives each card a small, stable tilt', () => {
    expect(tiltOf('fur-robin')).toBe(tiltOf('fur-robin'))
    for (const id of ['a', 'b', 'fur-robin', 'leaf-conker', 'hearth-teapot']) {
      expect(Math.abs(Number(tiltOf(id)))).toBeLessThanOrEqual(1.2)
    }
  })
})

describe('recent readings', () => {
  const r = (id, createdAt, status = 'dealt', cards = { who: 'fur-robin' }) => ({ id, createdAt, status, cards })
  it('keeps the newest, at most twenty', () => {
    const list = Array.from({ length: 30 }, (_, i) => r(`r${i}`, new Date(2026, 0, i + 1).toISOString()))
    const recent = recentReadings(list)
    expect(RECENT_LIMIT).toBe(20)
    expect(recent).toHaveLength(20)
    expect(recent[0].id).toBe('r29')
    expect(recent[19].id).toBe('r10')
    expect(list[0].id).toBe('r0')
  })
  it('lists every drawing in progress first, then finished ones and at most five never started', () => {
    const day = (i) => new Date(2026, 0, i + 1).toISOString()
    const list = [
      r('old-drawing', day(0), 'drawing'),
      ...Array.from({ length: 12 }, (_, i) => r(`idea${i}`, day(10 + i))),
      r('drawn', day(23), 'drawn'),
      r('sealed', day(24), 'sealed'),
      r('drawing', day(25), 'drawing'),
      ...Array.from({ length: 10 }, (_, i) => r(`new${i}`, day(30 + i))),
    ]
    const ids = shownReadings(list, { currentId: 'idea11' }).map((x) => x.id)
    expect(ids.slice(0, 2)).toEqual(['drawing', 'old-drawing'])
    expect(ids).toContain('drawn')
    expect(ids).toContain('sealed')
    expect(ids.filter((id) => id.startsWith('new'))).toEqual(['new9', 'new8', 'new7', 'new6', 'new5'])
    // the one on the table always stays
    expect(ids).toContain('idea11')
    expect(ids).not.toContain('idea0')
  })
  it('only offers to carry on what is still in progress', () => {
    expect(canCarryOn(r('a', '', 'dealt'))).toBe(true)
    expect(canCarryOn(r('a', '', 'drawing'))).toBe(true)
    expect(canCarryOn(r('a', '', 'drawn'))).toBe(false)
    expect(canCarryOn(r('a', '', 'sealed'))).toBe(false)
  })
  it('names the subject, or the theme for a page of small things', () => {
    expect(leadCardId(r('a', '', 'dealt', { who: 'fur-robin', where: 'where-x' }))).toBe('fur-robin')
    expect(leadCardId(r('a', '', 'dealt', { theme: 'theme-rainy-sunday' }))).toBe('theme-rainy-sunday')
    expect(leadCardId({})).toBeNull()
    expect(Object.values(STATUS_LABELS)).toEqual(['Dealt', 'Drawing', 'Drawn', 'Sealed'])
  })
})

describe('share a card', () => {
  it('writes the date in full', () => {
    expect(fullDate(new Date(2026, 9, 17, 12).toISOString())).toBe('17 October 2026')
    expect(fullDate('nope')).toBe('')
  })
  it('makes a tidy file name', () => {
    expect(shareFileName('The Hedgehog', new Date(2026, 9, 7, 12).toISOString())).toBe('the-hedgehog-2026-10-07.png')
    expect(shareFileName('Fish & Chips, Café-style!', new Date(2026, 0, 1, 12).toISOString())).toBe('fish-and-chips-cafe-style-2026-01-01.png')
    expect(shareFileName('', 'nope')).toBe('my-card.png')
  })
  it('crops like object-fit: cover, centred', () => {
    expect(coverRect(1000, 1000, 400, 500)).toEqual({ sx: 100, sy: 0, sw: 800, sh: 1000 })
    const tall = coverRect(400, 1000, 400, 500)
    expect(tall.sx).toBe(0)
    expect(tall.sw).toBe(400)
    expect(tall.sh).toBe(500)
    expect(tall.sy).toBe(250)
  })
  it('wraps words greedily and keeps long words whole', () => {
    const measure = (t) => t.length * 10
    expect(wrapWords('The Fairy Ring', 100, measure)).toEqual(['The Fairy', 'Ring'])
    expect(wrapWords('The Bladderwrack', 60, measure)).toEqual(['The', 'Bladderwrack'])
    expect(wrapWords('  ', 60, measure)).toEqual([])
  })
  it('fits a title on one line when it can, else two', () => {
    const measureAt = (size) => (t) => t.length * size * 0.6
    const one = fitTitle('The Robin', 600, measureAt, { big: 80, small: 65, min: 40 })
    expect(one.lines).toEqual(['The Robin'])
    expect(one.size).toBe(80)
    const two = fitTitle('The Horse Chestnut Leaf', 600, measureAt, { big: 80, small: 65, min: 40 })
    expect(two.lines).toHaveLength(2)
    two.lines.forEach((l) => expect(measureAt(two.size)(l)).toBeLessThanOrEqual(600))
    const squeezed = fitTitle('A Very Long Title Indeed That Will Not Fit Anywhere At All', 300, measureAt, { big: 80, small: 65, min: 20 })
    expect(squeezed.lines.length).toBeLessThanOrEqual(2)
    expect(fitTitle('Same', 600, measureAt, { big: 70, small: 70, min: 40 }).lines).toEqual(['Same'])
  })
  it('lays the card out inside its frame, the photo at 5:8, nothing overlapping', () => {
    for (const titleLines of [1, 2]) {
      for (const hasFrom of [false, true]) {
        const L = layoutShare({ cw: 760, ch: 1216, titleLines, hasDate: true, hasFrom })
        expect(PHOTO_RATIO).toBe(5 / 8)
        expect(L.photo.w / L.photo.h).toBeCloseTo(PHOTO_RATIO, 5)
        expect(L.photo.x).toBeGreaterThan(0)
        expect(L.photo.x + L.photo.w).toBeLessThan(760)
        expect(L.label).toBeLessThan(L.photo.y)
        expect(L.photo.y + L.photo.h).toBeLessThan(L.titles[0] - L.titleSize * 0.78)
        expect(L.titles).toHaveLength(titleLines)
        expect(L.date).toBeGreaterThan(L.titles[titleLines - 1])
        if (hasFrom) expect(L.from).toBeGreaterThan(L.date)
        expect(L.bottom).toBeLessThanOrEqual(1216 - 760 * 0.13 + 0.5)
      }
    }
  })
})
