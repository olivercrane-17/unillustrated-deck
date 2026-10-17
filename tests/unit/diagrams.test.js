// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  DIAGRAMS, FRAME_IDS, chooseFrame, diagramSvg, blobPath,
  newTimer, pauseTimer, resumeTimer, timerStatus, timerElapsed, ringOffset, ringSvg, RING_C, TIMER_MINUTES,
} from '../../src/ui/diagrams.js'

const parse = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml')
const byIdOf = (cards) => new Map(cards.map((c) => [c.id, c]))

describe('composition diagrams', () => {
  it('has all ten frames from the content spec, each with a title and a caption', () => {
    expect(FRAME_IDS.sort()).toEqual(['close-crop', 'from-above', 'low-horizon', 'postage-stamp', 'sampler', 'tall-strip', 'thirds', 'three-studies', 'vignette', 'window'])
    for (const { title, caption } of Object.values(DIAGRAMS)) {
      expect(title.length).toBeGreaterThan(3)
      expect(caption).toMatch(/^[A-Z].+\.$/)
      expect(caption.length).toBeLessThan(100)
      expect(`${title} ${caption}`).not.toMatch(/—|delve|tapestry|crucial|seamless|vibrant|magical|journey/i)
    }
  })

  it('draws every frame as well-formed SVG with a wobble filter', () => {
    for (const id of FRAME_IDS) {
      const svg = diagramSvg(id)
      const doc = parse(svg)
      expect(doc.querySelector('parsererror')).toBeNull()
      const root = doc.documentElement
      expect(root.getAttribute('class')).toContain(`diagram-${id}`)
      expect(root.getAttribute('aria-hidden')).toBe('true')
      expect(root.querySelector('feTurbulence')).not.toBeNull()
      expect(root.querySelector('feDisplacementMap')).not.toBeNull()
      expect(root.querySelector('.dg-subject')).not.toBeNull()
      expect(svg).not.toMatch(/NaN|undefined/)
    }
  })

  it('gives each drawing its own filter and clip ids', () => {
    const ids = (svg) => [...parse(svg).querySelectorAll('[id]')].map((el) => el.id)
    const a = ids(diagramSvg('close-crop'))
    const b = ids(diagramSvg('close-crop'))
    expect(a.length).toBe(2)
    expect(a.some((id) => b.includes(id))).toBe(false)
    const svg = diagramSvg('thirds')
    const filterId = parse(svg).querySelector('filter').id
    expect(svg).toContain(`url(#${filterId})`)
  })

  it('falls back to thirds for an unknown frame', () => {
    expect(diagramSvg('nonsense')).toContain('diagram-thirds')
  })

  it('tints the subject with a pencil colour but refuses anything that is not a hex', () => {
    expect(diagramSvg('vignette', { tint: '#8C6A47' })).toContain('fill="#8C6A47"')
    const sneaky = diagramSvg('vignette', { tint: '"/><script>alert(1)</script>' })
    expect(sneaky).not.toContain('<script')
    expect(parse(sneaky).querySelector('parsererror')).toBeNull()
  })

  it('draws a sampler cell per small thing and ticks the done ones', () => {
    const cells = (svg) => parse(svg).querySelectorAll('rect[rx="3"]').length
    expect(cells(diagramSvg('sampler', { count: 4 }))).toBe(4)
    expect(cells(diagramSvg('sampler', { count: 6 }))).toBe(6)
    expect(cells(diagramSvg('sampler'))).toBe(6)
    const ticked = parse(diagramSvg('sampler', { count: 6, done: [0, 4] }))
    expect(ticked.querySelectorAll('.dg-tick').length).toBe(2)
    expect([...ticked.querySelectorAll('.dg-num')].map((n) => n.textContent)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('makes closed, deterministic blobs', () => {
    const d = blobPath(50, 50, 10, 3)
    expect(d).toMatch(/^M[\d.]+ [\d.]+ (C[\d. ]+ ?)+Z$/)
    expect(blobPath(50, 50, 10, 3)).toBe(d)
    expect(blobPath(50, 50, 10, 4)).not.toBe(d)
  })
})

describe('chooseFrame', () => {
  const where = { id: 'where-sill', frames: ['window', 'close-crop', 'thirds'] }
  const twist = { id: 'twist-stamp', effects: { frame: 'postage-stamp' } }
  const plainTwist = { id: 'twist-lantern', effects: {} }
  const byId = byIdOf([where, twist, plainTwist, { id: 'where-none', frames: [] }, { id: 'where-typo', frames: ['windwo'] }])

  it("uses the twist's frame first", () => {
    expect(chooseFrame({ spread: 'big', seed: 5, cards: { where: 'where-sill', twist: 'twist-stamp' } }, byId)).toBe('postage-stamp')
  })

  it("otherwise picks from the Where card's frames by seed, and stays put", () => {
    const r = (seed) => ({ spread: 'evening', seed, cards: { where: 'where-sill', twist: 'twist-lantern' } })
    expect(chooseFrame(r(0), byId)).toBe('window')
    expect(chooseFrame(r(1), byId)).toBe('close-crop')
    expect(chooseFrame(r(5), byId)).toBe('thirds')
    expect(chooseFrame(r(4000000000), byId)).toBe(chooseFrame(r(4000000000), byId))
    const seen = new Set(Array.from({ length: 30 }, (_, s) => chooseFrame(r(s), byId)))
    expect([...seen].sort()).toEqual(['close-crop', 'thirds', 'window'])
  })

  it('falls back to a spread default', () => {
    expect(chooseFrame({ spread: 'quick', seed: 1, cards: { who: 'fur-x' } }, byId)).toBe('vignette')
    expect(chooseFrame({ spread: 'small', seed: 1, cards: { theme: 'theme-x' } }, byId)).toBe('sampler')
    expect(chooseFrame({ spread: 'evening', seed: 1, cards: { where: 'where-none' } }, byId)).toBe('thirds')
    expect(chooseFrame({ spread: 'evening', seed: 1, cards: { where: 'where-typo' } }, byId)).toBe('thirds')
    expect(chooseFrame({ spread: 'evening', seed: 1, cards: { where: 'where-gone' } }, byId)).toBe('thirds')
  })
})

describe('a quick doodle follows its Frame line', () => {
  const quick = (framing) => chooseFrame({ spread: 'quick', seed: 1, cards: { who: 'fur-x' }, text: { framing } }, byIdOf([]))
  it('plain paper, the middle or space round it is a vignette', () => {
    expect(quick('Only the blue tit, about life size, with plain paper round it.')).toBe('vignette')
    expect(quick('Only the wren, very small, in the middle of a big white page.')).toBe('vignette')
    expect(quick('Only the snail, close up, with no background.')).toBe('vignette')
    expect(quick('Just the three ducklings, close together, with plain paper round them.')).toBe('vignette')
  })
  it('close up, filling the page or off the edges is a close crop', () => {
    expect(quick('Just the goldfinch, close up, so every colour shows.')).toBe('close-crop')
    expect(quick('Only the dormouse, drawn big enough to fill the page.')).toBe('close-crop')
    expect(quick('Only the kitten’s face, drawn so big that the whiskers run off the page.')).toBe('close-crop')
    expect(quick('Only the spiral, close enough to follow it all the way to the middle.')).toBe('close-crop')
  })
  it('anything else is a vignette', () => {
    expect(quick('Just the kettle, with one curved shine across its round belly.')).toBe('vignette')
    expect(quick(undefined)).toBe('vignette')
  })
})

describe('gentle timer', () => {
  const MIN = 60000

  it('offers 10, 20 and 45 minutes', () => {
    expect(TIMER_MINUTES).toEqual([10, 20, 45])
  })

  it('counts down from the start time', () => {
    const t = newTimer(20, 0)
    expect(timerStatus(t, 0)).toMatchObject({ progress: 0, minutesLeft: 20, done: false, paused: false })
    expect(timerStatus(t, 5 * MIN)).toMatchObject({ progress: 0.25, minutesLeft: 15 })
    expect(timerStatus(t, 5 * MIN + 1).minutesLeft).toBe(15)
    expect(timerStatus(t, 19 * MIN + 30000).minutesLeft).toBe(1)
  })

  it('finishes quietly and never runs past the end', () => {
    const t = newTimer(10, 0)
    const s = timerStatus(t, 60 * MIN)
    expect(s).toMatchObject({ done: true, paused: false, progress: 1, left: 0, minutesLeft: 0 })
    expect(timerElapsed(t, 60 * MIN)).toBe(10 * MIN)
  })

  it('pauses and carries on without losing or gaining time', () => {
    let t = newTimer(10, 0)
    t = pauseTimer(t, 3 * MIN)
    expect(timerStatus(t, 9 * MIN)).toMatchObject({ paused: true, minutesLeft: 7 })
    expect(pauseTimer(t, 9 * MIN)).toBe(t)
    t = resumeTimer(t, 9 * MIN)
    expect(timerStatus(t, 11 * MIN)).toMatchObject({ paused: false, minutesLeft: 5 })
    expect(resumeTimer(t, 12 * MIN)).toBe(t)
    expect(timerStatus(t, 16 * MIN).done).toBe(true)
  })

  it('does not resume a finished timer', () => {
    const t = pauseTimer(newTimer(10, 0), 11 * MIN)
    expect(timerStatus(t, 20 * MIN).done).toBe(true)
    expect(resumeTimer(t, 20 * MIN)).toBe(t)
  })

  it('maps progress to the ring stroke', () => {
    expect(ringOffset(0)).toBeCloseTo(RING_C, 0)
    expect(ringOffset(1)).toBe(0)
    expect(ringOffset(0.5)).toBeCloseTo(RING_C / 2, 0)
    expect(ringOffset(-1)).toBeCloseTo(RING_C, 0)
    expect(ringOffset(7)).toBe(0)
    expect(ringOffset(NaN)).toBeCloseTo(RING_C, 0)
    expect(parse(ringSvg(0.3)).querySelector('parsererror')).toBeNull()
  })
})
