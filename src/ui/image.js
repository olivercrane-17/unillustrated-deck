// Pure image and crop maths for the seal flow. No DOM in here.
//
// The crop view lives in output pixels: the frame is always 750 x 1200 (5:8)
// whatever size it is drawn on screen, so a phone rotation never moves the
// crop and the final render needs no conversion. A view is
// { scale, x, y }: the photo is drawn `scale` times its natural size with its
// top-left corner at (x, y) inside the frame.

export const FRAME_RATIO = 5 / 8
export const OUTPUT = {
  image: { width: 750, height: 1200 },
  thumb: { width: 225, height: 360 },
}
export const JPEG_QUALITY = 0.85
export const CREAM = '#F3EAD7'
export const FRAME = OUTPUT.image
// How far past "fills the frame" she can zoom in.
export const MAX_ZOOM = 5
// Long edge of the on-screen preview copy (the full photo is kept for sealing).
export const PREVIEW_EDGE = 2048

const EPS = 1e-6

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Scale at which the photo fills the frame with nothing left over. */
export function coverScale(img, frame = FRAME) {
  return Math.max(frame.width / img.width, frame.height / img.height)
}

/** Scale at which the whole photo fits inside the frame. */
export function containScale(img, frame = FRAME) {
  return Math.min(frame.width / img.width, frame.height / img.height)
}

/** Zoom runs from "the whole drawing" up to MAX_ZOOM times "fills the frame". */
export function scaleLimits(img, frame = FRAME) {
  const contain = containScale(img, frame)
  const cover = coverScale(img, frame)
  return { min: contain, max: cover * MAX_ZOOM, contain, cover }
}

/** Centred rect for a scale, in frame pixels. */
export function centredRect(img, frame, scale) {
  const width = img.width * scale
  const height = img.height * scale
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height }
}

export const coverRect = (img, frame = FRAME) => centredRect(img, frame, coverScale(img, frame))
export const containRect = (img, frame = FRAME) => centredRect(img, frame, containScale(img, frame))

// Along one axis: if the photo is bigger than the frame it must cover it
// edge to edge; if it is smaller it sits in the middle on cream.
function clampAxis(pos, size, frameSize) {
  if (size <= frameSize + EPS) return (frameSize - size) / 2
  return clamp(pos, frameSize - size, 0)
}

/** Keep a view inside its zoom limits and stop the photo leaving gaps. */
export function clampView(view, img, frame = FRAME) {
  const { min, max } = scaleLimits(img, frame)
  const scale = clamp(view.scale, min, max)
  return {
    scale,
    x: clampAxis(view.x, img.width * scale, frame.width),
    y: clampAxis(view.y, img.height * scale, frame.height),
  }
}

export function fitView(img, frame = FRAME) {
  const r = containRect(img, frame)
  return { scale: containScale(img, frame), x: r.x, y: r.y }
}

export function coverView(img, frame = FRAME) {
  const r = coverRect(img, frame)
  return { scale: coverScale(img, frame), x: r.x, y: r.y }
}

/** True while the whole photo is in view (the "Fit the whole drawing" state). */
export function isWhole(view, img, frame = FRAME) {
  return view.scale <= containScale(img, frame) * (1 + 1e-3)
}

export function panBy(view, dx, dy, img, frame = FRAME) {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, img, frame)
}

/** Zoom by `factor`, keeping the photo point under `point` where it is. */
export function zoomAt(view, factor, point, img, frame = FRAME) {
  const { min, max } = scaleLimits(img, frame)
  const scale = clamp(view.scale * factor, min, max)
  const k = scale / view.scale
  return clampView({
    scale,
    x: point.x - (point.x - view.x) * k,
    y: point.y - (point.y - view.y) * k,
  }, img, frame)
}

export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Two fingers moved from `prev` to `next`: pan with their midpoint and zoom with their spread. */
export function pinchView(view, prev, next, img, frame = FRAME) {
  const pm = midpoint(prev[0], prev[1])
  const nm = midpoint(next[0], next[1])
  const pd = distance(prev[0], prev[1])
  const factor = pd > 0 ? distance(next[0], next[1]) / pd : 1
  const moved = { ...view, x: view.x + nm.x - pm.x, y: view.y + nm.y - pm.y }
  return zoomAt(moved, factor, nm, img, frame)
}

/** Mouse wheel to zoom factor: smooth for trackpads, a sensible step for wheels. */
export function wheelFactor(deltaY, deltaMode = 0) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  return Math.exp(-clamp(px, -200, 200) * 0.0022)
}

/**
 * The part of the photo that lands inside the frame, as drawImage's nine
 * arguments: source rect (photo pixels) and destination rect (frame pixels).
 * Null if nothing is visible.
 */
export function visibleRects(view, img, frame = FRAME) {
  const left = Math.max(0, view.x)
  const top = Math.max(0, view.y)
  const right = Math.min(frame.width, view.x + img.width * view.scale)
  const bottom = Math.min(frame.height, view.y + img.height * view.scale)
  if (right - left <= EPS || bottom - top <= EPS) return null
  return {
    sx: (left - view.x) / view.scale,
    sy: (top - view.y) / view.scale,
    sw: (right - left) / view.scale,
    sh: (bottom - top) / view.scale,
    dx: left,
    dy: top,
    dw: right - left,
    dh: bottom - top,
  }
}

/**
 * Halve the width until the next halving would pass the target, so big
 * downscales stay sharp. Returns the intermediate widths (maybe none).
 */
export function downscaleSteps(from, to) {
  const steps = []
  let w = from
  while (w / 2 > to) {
    w = Math.round(w / 2)
    steps.push(w)
  }
  return steps
}

/** A size for the on-screen preview copy: never bigger than the photo. */
export function previewSize(img, maxEdge = PREVIEW_EDGE) {
  const k = Math.min(1, maxEdge / Math.max(img.width, img.height))
  return { width: Math.max(1, Math.round(img.width * k)), height: Math.max(1, Math.round(img.height * k)) }
}

/** Largest 5:8 box inside the space available, in whole pixels. */
export function frameSize(maxWidth, maxHeight) {
  const width = Math.max(0, Math.floor(Math.min(maxWidth, maxHeight * FRAME_RATIO)))
  return { width, height: Math.round(width / FRAME_RATIO) }
}

// ---------------------------------------------------------------------------
// Storage: photos are the heavy part of her deck.

export const LOW_SPACE_BYTES = 10 * 1024 * 1024
const DAY = 24 * 60 * 60 * 1000
export const NUDGE_EVERY_DAYS = 30
export const NUDGE_AFTER_PHOTOS = 5

/** From navigator.storage.estimate(): is there under ~10 MB left? Unknown counts as fine. */
export function spaceIsLow(estimate) {
  const quota = Number(estimate?.quota)
  if (!Number.isFinite(quota) || quota <= 0) return false
  return quota - (Number(estimate.usage) || 0) < LOW_SPACE_BYTES
}

/**
 * The gentle backup reminder: from the 5th photo seal, at most once every
 * 30 days, and never when she has saved a copy since the last reminder or
 * within the last 30 days.
 */
export function shouldNudgeBackup({ photoSeals, lastBackupAt, backupNudgeAt, now = Date.now() }) {
  if (photoSeals < NUDGE_AFTER_PHOTOS) return false
  const t = (v) => (v ? Date.parse(v) : NaN)
  const nudged = t(backupNudgeAt)
  const backedUp = t(lastBackupAt)
  const gap = NUDGE_EVERY_DAYS * DAY
  if (Number.isFinite(nudged) && now - nudged < gap) return false
  if (Number.isFinite(backedUp) && now - backedUp < gap) return false
  return true
}
