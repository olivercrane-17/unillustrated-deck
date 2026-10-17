import { describe, it, expect } from 'vitest'
import {
  FRAME, OUTPUT, FRAME_RATIO, MAX_ZOOM, coverScale, containScale, scaleLimits, coverRect, containRect, clampView,
  fitView, coverView, isWhole, panBy, zoomAt, pinchView, wheelFactor, visibleRects, downscaleSteps, previewSize,
  frameSize, spaceIsLow, shouldNudgeBackup, LOW_SPACE_BYTES,
} from '../../src/ui/image.js'

const wide = { width: 4000, height: 3000 }
const portrait = { width: 3000, height: 4000 }
const exact = { width: 500, height: 800 }

// Does the photo cover the whole frame with no gaps?
function covers(view, img, frame = FRAME) {
  return view.x <= 1e-6 && view.y <= 1e-6 &&
    view.x + img.width * view.scale >= frame.width - 1e-6 &&
    view.y + img.height * view.scale >= frame.height - 1e-6
}

describe('output sizes', () => {
  it('are 5:8 for the image and the thumbnail', () => {
    expect(OUTPUT.image).toEqual({ width: 750, height: 1200 })
    expect(OUTPUT.thumb).toEqual({ width: 225, height: 360 })
    expect(OUTPUT.image.width / OUTPUT.image.height).toBeCloseTo(FRAME_RATIO)
    expect(OUTPUT.thumb.width / OUTPUT.thumb.height).toBeCloseTo(FRAME_RATIO)
  })
})

describe('cover and contain', () => {
  it('cover fills the frame, contain fits inside it', () => {
    const c = coverRect(wide)
    expect(c.height).toBeCloseTo(1200)
    expect(c.width).toBeGreaterThan(750)
    expect(c.x).toBeCloseTo((750 - c.width) / 2)
    const f = containRect(wide)
    expect(f.width).toBeCloseTo(750)
    expect(f.height).toBeLessThan(1200)
    expect(f.y).toBeCloseTo((1200 - f.height) / 2)
  })
  it('photos taller than 5:8 cover by width; 3:4 portraits still cover by height', () => {
    const tall = { width: 1000, height: 2000 }
    expect(coverRect(tall).width).toBeCloseTo(750)
    expect(containRect(tall).height).toBeCloseTo(1200)
    expect(coverRect(portrait).height).toBeCloseTo(1200)
    expect(containRect(portrait).width).toBeCloseTo(750)
  })
  it('a 5:8 photo needs no letterbox at all', () => {
    expect(coverScale(exact)).toBeCloseTo(containScale(exact))
    expect(containRect(exact)).toEqual({ x: 0, y: 0, width: 750, height: 1200 })
  })
})

describe('zoom limits', () => {
  it('run from the whole drawing to MAX_ZOOM times cover', () => {
    const l = scaleLimits(wide)
    expect(l.min).toBeCloseTo(containScale(wide))
    expect(l.max).toBeCloseTo(coverScale(wide) * MAX_ZOOM)
  })
  it('zooming never passes the limits', () => {
    let v = fitView(wide)
    for (let i = 0; i < 40; i++) v = zoomAt(v, 1.5, { x: 375, y: 600 }, wide)
    expect(v.scale).toBeCloseTo(scaleLimits(wide).max)
    for (let i = 0; i < 80; i++) v = zoomAt(v, 0.5, { x: 10, y: 10 }, wide)
    expect(v.scale).toBeCloseTo(scaleLimits(wide).min)
    expect(isWhole(v, wide)).toBe(true)
  })
})

describe('clamping the pan', () => {
  it('a covering photo can never be dragged off an edge', () => {
    const v0 = coverView(wide)
    for (const [dx, dy] of [[5000, 0], [-5000, 0], [0, 5000], [0, -5000], [999, -999]]) {
      const v = panBy(v0, dx, dy, wide)
      expect(covers(v, wide)).toBe(true)
    }
  })
  it('stays covering after zooming in anywhere, including near corners', () => {
    let v = coverView(portrait)
    for (const p of [{ x: 0, y: 0 }, { x: 750, y: 1200 }, { x: 700, y: 30 }]) {
      v = zoomAt(v, 2.3, p, portrait)
      expect(covers(v, portrait)).toBe(true)
      v = panBy(v, -3000, 4000, portrait)
      expect(covers(v, portrait)).toBe(true)
    }
  })
  it('a fitted photo sits in the middle and cannot be dragged', () => {
    const v = fitView(wide)
    expect(panBy(v, 200, 300, wide)).toEqual(v)
    expect(v.x).toBeCloseTo(0)
    expect(v.y).toBeGreaterThan(0)
  })
  it('between fit and cover, the loose axis is centred and the tight one covers', () => {
    const { contain, cover } = scaleLimits(wide)
    const v = clampView({ scale: (contain + cover) / 2, x: 999, y: -999 }, wide)
    expect(v.x).toBeCloseTo(0)
    expect(v.y).toBeCloseTo((1200 - wide.height * v.scale) / 2)
    expect(v.y).toBeGreaterThan(0)
  })
})

describe('zooming about a point', () => {
  it('keeps the point under the finger fixed when there is room', () => {
    const v0 = coverView(wide)
    const p = { x: 375, y: 600 }
    const before = { x: (p.x - v0.x) / v0.scale, y: (p.y - v0.y) / v0.scale }
    const v = zoomAt(v0, 2, p, wide)
    const after = { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(v.scale).toBeCloseTo(v0.scale * 2)
  })
  it('the whole-drawing state follows the scale', () => {
    expect(isWhole(fitView(wide), wide)).toBe(true)
    expect(isWhole(coverView(wide), wide)).toBe(false)
    expect(isWhole(coverView(exact), exact)).toBe(true)
  })
})

describe('pinch', () => {
  it('spreading two fingers zooms in about their midpoint', () => {
    const v0 = coverView(wide)
    const prev = [{ x: 300, y: 600 }, { x: 450, y: 600 }]
    const next = [{ x: 225, y: 600 }, { x: 525, y: 600 }]
    const v = pinchView(v0, prev, next, wide)
    expect(v.scale).toBeCloseTo(v0.scale * 2)
    expect(covers(v, wide)).toBe(true)
  })
  it('moving both fingers together pans', () => {
    const v0 = zoomAt(coverView(wide), 2, { x: 375, y: 600 }, wide)
    const prev = [{ x: 300, y: 600 }, { x: 400, y: 600 }]
    const next = [{ x: 340, y: 620 }, { x: 440, y: 620 }]
    const v = pinchView(v0, prev, next, wide)
    expect(v.scale).toBeCloseTo(v0.scale)
    expect(v.x - v0.x).toBeCloseTo(40)
    expect(v.y - v0.y).toBeCloseTo(20)
  })
  it('two fingers on the same spot do not explode', () => {
    const v0 = coverView(wide)
    const p = { x: 100, y: 100 }
    expect(pinchView(v0, [p, p], [p, p], wide)).toEqual(clampView(v0, wide))
  })
})

describe('wheel', () => {
  it('scrolling up zooms in, down zooms out, and big jumps are tamed', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1)
    expect(wheelFactor(100)).toBeLessThan(1)
    expect(wheelFactor(0)).toBe(1)
    expect(wheelFactor(100000)).toBeCloseTo(wheelFactor(200))
    expect(wheelFactor(3, 1)).toBeCloseTo(wheelFactor(48))
  })
})

describe('visible rects', () => {
  it('a covering view crops the source and fills the frame', () => {
    const r = visibleRects(coverView(wide), wide)
    expect(r.dx).toBeCloseTo(0)
    expect(r.dy).toBeCloseTo(0)
    expect(r.dw).toBeCloseTo(750)
    expect(r.dh).toBeCloseTo(1200)
    expect(r.sh).toBeCloseTo(3000)
    expect(r.sw).toBeCloseTo(3000 * FRAME_RATIO)
    expect(r.sx).toBeCloseTo((4000 - r.sw) / 2)
  })
  it('a fitted view draws the whole source into a letterboxed band', () => {
    const r = visibleRects(fitView(wide), wide)
    expect(r).toMatchObject({ sx: 0, sy: 0 })
    expect(r.sw).toBeCloseTo(4000)
    expect(r.sh).toBeCloseTo(3000)
    expect(r.dw).toBeCloseTo(750)
    expect(r.dh).toBeCloseTo(562.5)
    expect(r.dy).toBeCloseTo((1200 - 562.5) / 2)
  })
  it('returns null when nothing is in the frame', () => {
    expect(visibleRects({ scale: 0.1, x: 2000, y: 0 }, wide)).toBeNull()
  })
})

describe('downscaling', () => {
  it('halves until the next halving would pass the target', () => {
    expect(downscaleSteps(4000, 750)).toEqual([2000, 1000])
    expect(downscaleSteps(1400, 750)).toEqual([])
    expect(downscaleSteps(750, 225)).toEqual([375])
    expect(downscaleSteps(200, 750)).toEqual([])
  })
  it('the preview copy is capped but never upscaled', () => {
    expect(previewSize({ width: 8000, height: 6000 }, 2000)).toEqual({ width: 2000, height: 1500 })
    expect(previewSize({ width: 800, height: 600 }, 2000)).toEqual({ width: 800, height: 600 })
  })
  it('frame size is the largest 5:8 box in the space', () => {
    expect(frameSize(360, 2000)).toEqual({ width: 360, height: 576 })
    expect(frameSize(1000, 480)).toEqual({ width: 300, height: 480 })
  })
})

describe('storage', () => {
  it('warns only when under about 10 MB is free', () => {
    expect(spaceIsLow({ quota: 100 * 1024 * 1024, usage: 95 * 1024 * 1024 })).toBe(true)
    expect(spaceIsLow({ quota: 100 * 1024 * 1024, usage: 10 * 1024 * 1024 })).toBe(false)
    expect(spaceIsLow({ quota: LOW_SPACE_BYTES * 3, usage: 0 })).toBe(false)
    expect(spaceIsLow(undefined)).toBe(false)
    expect(spaceIsLow({})).toBe(false)
  })
})

describe('backup nudge', () => {
  const day = 24 * 60 * 60 * 1000
  const now = Date.parse('2026-10-17T12:00:00Z')
  const ago = (d) => new Date(now - d * day).toISOString()
  it('waits for the fifth photo', () => {
    expect(shouldNudgeBackup({ photoSeals: 4, now })).toBe(false)
    expect(shouldNudgeBackup({ photoSeals: 5, now })).toBe(true)
  })
  it('comes at most once every 30 days', () => {
    expect(shouldNudgeBackup({ photoSeals: 9, backupNudgeAt: ago(3), now })).toBe(false)
    expect(shouldNudgeBackup({ photoSeals: 9, backupNudgeAt: ago(31), now })).toBe(true)
    expect(shouldNudgeBackup({ photoSeals: 9, backupNudgeAt: ago(31), lastBackupAt: ago(40), now })).toBe(true)
  })
  it('stays quiet when she has saved a copy since the last nudge', () => {
    expect(shouldNudgeBackup({ photoSeals: 9, backupNudgeAt: ago(40), lastBackupAt: ago(10), now })).toBe(false)
    expect(shouldNudgeBackup({ photoSeals: 5, lastBackupAt: ago(2), now })).toBe(false)
  })
})
