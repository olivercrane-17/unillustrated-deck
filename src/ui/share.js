// Share a card: the sealed card drawn onto a canvas (cream stock, gilt frame,
// her photo, the title and the date) as a PNG for the share sheet, or saved
// to the device when sharing files isn't possible.
import { h, raw } from './h.js'
import { suitOf } from './card.js'
import { EMBLEMS, CORNER, ICONS, SUIT_LABELS } from './ornaments.js'
import { state, content, imageUrl, faceSealFor } from '../store/state.js'
import { mulberry32 } from '../engine/rng.js'
import { openSheet, toast } from './feedback.js'

export const SHARE_W = 1080
export const SHARE_H = 1350
const CARD_W = 760
const CARD_H = CARD_W * 8 / 5
// Sealed photos are cropped 5:8, like the card itself.
export const PHOTO_RATIO = 5 / 8

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)

/** "17 October 2026" */
export function fullDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "the-hedgehog-2026-10-17.png" */
export function shareFileName(title, iso) {
  const slug = String(title || 'my-card').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-card'
  const d = new Date(iso)
  const day = Number.isNaN(d.getTime()) ? '' : `-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${slug}${day}.png`
}

/** The source rectangle that fills (dw x dh) from (sw x sh) without stretching, like object-fit: cover. */
export function coverRect(sw, sh, dw, dh) {
  const scale = Math.max(dw / sw, dh / sh)
  const w = dw / scale
  const hgt = dh / scale
  return { sx: (sw - w) / 2, sy: (sh - hgt) / 2, sw: w, sh: hgt }
}

/** Greedy word wrap. `measure(text)` returns a width. */
export function wrapWords(text, maxWidth, measure) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (line && measure(next) > maxWidth) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Choose a title size and its lines: one line from `big` down to `small` if it
 * fits, otherwise two lines, shrinking until they fit. `measureAt(size)`
 * returns a measure function for that size.
 */
export function fitTitle(title, maxWidth, measureAt, { big, small, min }) {
  const step = Math.max((big - small) / 3, 1)
  for (let size = big; size >= small - 0.01; size -= step) {
    const m = measureAt(size)
    if (m(title) <= maxWidth) return { size, lines: [String(title)] }
  }
  let size = Math.min(big, small * 1.1)
  let lines = []
  while (size > min) {
    const m = measureAt(size)
    lines = wrapWords(title, maxWidth, m)
    if (lines.length <= 2 && lines.every((l) => m(l) <= maxWidth)) return { size, lines }
    size *= 0.93
  }
  const m = measureAt(min)
  lines = wrapWords(title, maxWidth, m)
  return { size: min, lines: lines.length > 2 ? [lines[0], lines.slice(1).join(' ')] : lines }
}

/**
 * Lay the card out top to bottom: label, photo, title, date, "from the deck
 * of". The photo gives way if the words need the room. Values are offsets
 * from the card's top-left corner; text values are baselines.
 */
export function layoutShare({ cw = CARD_W, ch = CARD_H, titleLines = 1, titleSize = cw * 0.105, hasDate = true, hasFrom = false } = {}) {
  const labelSize = cw * 0.058
  const dateSize = cw * 0.085
  const fromSize = cw * 0.04
  const top = cw * 0.135
  const bottom = ch - cw * 0.13
  const titleLead = titleSize * 1.06
  const gaps = { label: cw * 0.05, photo: cw * 0.07, title: cw * 0.018, date: cw * 0.012 }
  const words = labelSize * 1.1 + gaps.label + gaps.photo + titleLines * titleLead
    + (hasDate ? gaps.title + dateSize : 0) + (hasFrom ? gaps.date + fromSize * 1.3 : 0)
  const maxPhotoW = cw * 0.56
  const photoH = Math.max(cw * 0.3, Math.min(maxPhotoW / PHOTO_RATIO, bottom - top - words))
  const photoW = photoH * PHOTO_RATIO
  const total = words + photoH
  let y = top + Math.max(0, (bottom - top - total) / 2)
  const out = { cw, ch, labelSize, titleSize, dateSize, fromSize }
  out.label = y + labelSize * 0.85
  y += labelSize * 1.1 + gaps.label
  out.photo = { x: (cw - photoW) / 2, y, w: photoW, h: photoH }
  y += photoH + gaps.photo
  out.titles = []
  for (let i = 0; i < titleLines; i++) {
    out.titles.push(y + titleSize * 0.78)
    y += titleLead
  }
  if (hasDate) {
    y += gaps.title
    out.date = y + dateSize * 0.72
    y += dateSize
  }
  if (hasFrom) {
    y += gaps.date
    out.from = y + fromSize * 0.95
    y += fromSize * 1.3
  }
  out.bottom = y
  return out
}

// ---------------------------------------------------------------------------
// Drawing

function tokens() {
  const css = getComputedStyle(document.documentElement)
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback
  return {
    paper: v('--paper', '#f3ead7'),
    paperShade: v('--paper-shade', '#e8dcc3'),
    ink: v('--ink', '#2a211c'),
    inkSoft: v('--ink-soft', '#54463b'),
    inkFaint: v('--ink-faint', '#7d6d5c'),
    giltDark: v('--gilt-dark', '#9c7330'),
    giltLight: v('--gilt-light', '#e8cb7e'),
    giltMid: v('--gilt-mid', '#c9a253'),
    giltDeep: v('--gilt-deep', '#a57b33'),
    display: v('--font-display', "'Cormorant SC', Georgia, serif"),
    body: v('--font-body', "'Lora', Georgia, serif"),
    hand: v('--font-hand', "'Caveat', cursive"),
    suit: (s) => v(`--suit-${s}`, '#6b4a2f'),
    // The share picture always lies on the green felt, whichever table is set.
    felt: '#24382e',
    feltRaised: '#2c4338',
    feltDeep: '#1a2a22',
  }
}

async function fontsReady(t) {
  if (!document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`700 80px ${t.display}`, 'The'),
      document.fonts.load(`600 40px ${t.display}`, 'The'),
      document.fonts.load(`500 60px ${t.hand}`, '17 Oct'),
      document.fonts.load(`italic 400 30px ${t.body}`, 'from'),
    ])
    await document.fonts.ready
  } catch { /* draw with whatever has loaded */ }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = src
  })
}

function svgImage(svg, color, size) {
  const src = svg
    .replaceAll('currentColor', color)
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" `)
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`)
}

function noise(size, seed, [r, g, b], maxAlpha) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')
  const data = x.createImageData(size, size)
  const rng = mulberry32(seed)
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = r
    data.data[i + 1] = g
    data.data[i + 2] = b
    data.data[i + 3] = Math.round(rng() * rng() * maxAlpha)
  }
  x.putImageData(data, 0, 0)
  return c
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, hgt, r)
  else {
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + hgt, r)
    ctx.arcTo(x + w, y + hgt, x, y + hgt, r)
    ctx.arcTo(x, y + hgt, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
}

function gilt(ctx, t, x, y, w, hgt) {
  const g = ctx.createLinearGradient(x, y, x + w, y + hgt)
  g.addColorStop(0, t.giltDark)
  g.addColorStop(0.22, t.giltLight)
  g.addColorStop(0.36, t.giltMid)
  g.addColorStop(0.5, t.giltLight)
  g.addColorStop(0.68, t.giltDeep)
  g.addColorStop(0.84, t.giltLight)
  g.addColorStop(1, t.giltDeep)
  return g
}

function spaced(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

/** Draw the card to a canvas and return it as a PNG Blob. */
export async function renderShareCard({ card, seal, backName = '' }) {
  const t = tokens()
  await fontsReady(t)
  const suit = suitOf(card)
  const suitColour = t.suit(suit)
  const cw = CARD_W
  const ch = CARD_H
  const x0 = (SHARE_W - cw) / 2
  const y0 = 44
  const s = cw / 300 // card.css is tuned for a 300px card

  const canvas = document.createElement('canvas')
  canvas.width = SHARE_W
  canvas.height = SHARE_H
  const ctx = canvas.getContext('2d')

  // The felt
  const felt = ctx.createRadialGradient(SHARE_W / 2, SHARE_H * 0.32, 0, SHARE_W / 2, SHARE_H * 0.32, SHARE_H * 0.85)
  felt.addColorStop(0, t.feltRaised)
  felt.addColorStop(0.55, t.felt)
  felt.addColorStop(1, t.feltDeep)
  ctx.fillStyle = felt
  ctx.fillRect(0, 0, SHARE_W, SHARE_H)
  ctx.fillStyle = ctx.createPattern(noise(220, 7, [230, 242, 217], 34), 'repeat')
  ctx.fillRect(0, 0, SHARE_W, SHARE_H)

  // The card stock, with a soft shadow on the felt
  const R = 10 * s
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)'
  ctx.shadowBlur = 54
  ctx.shadowOffsetY = 24
  roundRect(ctx, x0, y0, cw, ch, R)
  ctx.fillStyle = t.paper
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, x0, y0, cw, ch, R)
  ctx.clip()
  const stock = ctx.createRadialGradient(x0 + cw / 2, y0 + ch * 0.35, 0, x0 + cw / 2, y0 + ch * 0.35, ch * 0.72)
  stock.addColorStop(0, '#fbf5e6')
  stock.addColorStop(0.6, t.paper)
  stock.addColorStop(1, t.paperShade)
  ctx.fillStyle = stock
  ctx.fillRect(x0, y0, cw, ch)
  ctx.fillStyle = ctx.createPattern(noise(180, 11, [82, 64, 43], 40), 'repeat')
  ctx.fillRect(x0, y0, cw, ch)
  ctx.restore()

  // The gilt frame, the suit rule and the corner curls
  const fi = cw * 0.045
  const ft = Math.max(4, cw * 0.014)
  // two rounded rectangles filled even-odd make the frame
  const ring = new Path2D()
  addRoundRect(ring, x0 + fi, y0 + fi, cw - 2 * fi, ch - 2 * fi, R - 3 * s)
  addRoundRect(ring, x0 + fi + ft, y0 + fi + ft, cw - 2 * (fi + ft), ch - 2 * (fi + ft), Math.max(2, R - 3 * s - ft))
  ctx.fillStyle = gilt(ctx, t, x0, y0, cw, ch)
  ctx.fill(ring, 'evenodd')

  const ri = cw * 0.085
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = suitColour
  ctx.lineWidth = Math.max(1.5, s)
  roundRect(ctx, x0 + ri, y0 + ri, cw - 2 * ri, ch - 2 * ri, Math.max(2, R - 5 * s))
  ctx.stroke()
  ctx.restore()

  const cs = cw * 0.15
  const ci = cw * 0.065
  try {
    const corner = await svgImage(CORNER, t.giltDark, 120)
    for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      ctx.save()
      ctx.translate(fx > 0 ? x0 + ci : x0 + cw - ci, fy > 0 ? y0 + ci : y0 + ch - ci)
      ctx.scale(fx, fy)
      ctx.drawImage(corner, 0, 0, cs, cs)
      ctx.restore()
    }
  } catch { /* the frame is enough on its own */ }

  // Fit the title: one line if it will go at a comfortable size, else two
  const measureAt = (size) => {
    ctx.font = `700 ${size}px ${t.display}`
    spaced(ctx, size * 0.06)
    return (txt) => ctx.measureText(txt).width
  }
  const { size: titleSize, lines } = fitTitle(card.title, cw * 0.76, measureAt, { big: cw * 0.105, small: cw * 0.085, min: cw * 0.06 })
  const date = seal ? fullDate(seal.createdAt) : ''
  const L = layoutShare({ cw, ch, titleLines: lines.length, titleSize, hasDate: Boolean(date), hasFrom: Boolean(backName) })

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const cx = x0 + cw / 2

  // Suit label
  const label = SUIT_LABELS[suit]
  if (label) {
    ctx.font = `600 ${L.labelSize}px ${t.display}`
    spaced(ctx, L.labelSize * 0.16)
    ctx.fillStyle = suitColour
    ctx.fillText(label.toUpperCase(), cx, y0 + L.label)
  }

  // Her photo in a gilt mount, or the emblem if there isn't one
  const p = L.photo
  let photo = null
  if (seal?.imageId) {
    try {
      const url = await imageUrl(seal.imageId, 'image')
      if (url) photo = await loadImage(url)
    } catch { photo = null }
  }
  if (photo) {
    const px = x0 + p.x
    const py = y0 + p.y
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 3
    roundRect(ctx, px, py, p.w, p.h, 3 * s)
    ctx.fillStyle = gilt(ctx, t, px, py, p.w, p.h)
    ctx.fill()
    ctx.restore()
    const pad = Math.max(4, cw * 0.014)
    const iw = p.w - 2 * pad
    const ih = p.h - 2 * pad
    const c = coverRect(photo.naturalWidth || photo.width, photo.naturalHeight || photo.height, iw, ih)
    ctx.save()
    roundRect(ctx, px + pad, py + pad, iw, ih, 2 * s)
    ctx.clip()
    ctx.drawImage(photo, c.sx, c.sy, c.sw, c.sh, px + pad, py + pad, iw, ih)
    // a soft inner shadow so the photo looks mounted
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.lineWidth = 2
    ctx.strokeRect(px + pad + 1, py + pad + 1, iw - 2, ih - 2)
    const inner = ctx.createLinearGradient(0, py + pad, 0, py + pad + ih * 0.08)
    inner.addColorStop(0, 'rgba(0, 0, 0, 0.16)')
    inner.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = inner
    ctx.fillRect(px + pad, py + pad, iw, ih * 0.08)
    ctx.restore()
  } else {
    try {
      const size = Math.min(p.w, cw * 0.58)
      const emblem = await svgImage(EMBLEMS[suit] || EMBLEMS.twist, suitColour, 256)
      ctx.save()
      ctx.globalAlpha = 0.88
      ctx.drawImage(emblem, cx - size / 2, y0 + p.y + (p.h - size) / 2, size, size)
      ctx.restore()
    } catch { /* leave the space plain */ }
  }

  // Title
  ctx.font = `700 ${L.titleSize}px ${t.display}`
  spaced(ctx, L.titleSize * 0.06)
  ctx.fillStyle = t.ink
  lines.forEach((line, i) => ctx.fillText(line, cx, y0 + L.titles[i]))

  // The date, in handwriting, a little askew
  if (date) {
    ctx.save()
    ctx.translate(cx, y0 + L.date)
    ctx.rotate((-3 * Math.PI) / 180)
    ctx.font = `500 ${L.dateSize}px ${t.hand}`
    spaced(ctx, 0)
    ctx.fillStyle = t.inkSoft
    ctx.fillText(date, 0, 0)
    ctx.restore()
  }

  if (backName) {
    ctx.font = `italic 400 ${L.fromSize}px ${t.body}`
    spaced(ctx, 0)
    ctx.fillStyle = t.inkFaint
    ctx.fillText(`from the deck of ${backName}`, cx, y0 + L.from)
  }

  // A small wordmark on the felt
  ctx.font = `600 26px ${t.display}`
  spaced(ctx, 26 * 0.18)
  ctx.fillStyle = t.giltLight
  ctx.globalAlpha = 0.82
  ctx.fillText('The Unillustrated Deck', SHARE_W / 2, SHARE_H - 26)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), 'image/png'))
}

function addRoundRect(path, x, y, w, hgt, r) {
  if (path.roundRect) return path.roundRect(x, y, w, hgt, r)
  path.moveTo(x + r, y)
  path.arcTo(x + w, y, x + w, y + hgt, r)
  path.arcTo(x + w, y + hgt, x, y + hgt, r)
  path.arcTo(x, y + hgt, x, y, r)
  path.arcTo(x, y, x + w, y, r)
  path.closePath()
}

// ---------------------------------------------------------------------------
// The sheet

function canShareFile(file) {
  try {
    return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }))
  } catch {
    return false
  }
}

function saveFile(url, name) {
  const a = h('a', { href: url, download: name, style: { display: 'none' } })
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Open the share sheet for a card. The picture is made first and shown as a
 * preview, so the Share button can hand it straight to the system sheet
 * (iOS only allows that straight from a tap).
 */
export function openShareSheet({ card, cardId, seal } = {}) {
  const c = card || content.byId.get(cardId)
  if (!c || !content.byId.has(c.id)) {
    toast('That card seems to have slipped out of the deck, so there’s nothing to share just yet.')
    return null
  }
  const theSeal = seal || faceSealFor(c.id)
  let url = ''
  let disposed = false
  return openSheet((close) => {
    const preview = h('div.share-preview', { 'aria-busy': 'true' }, h('p.share-wait.hand', 'Laying your card out on the felt…'))
    const actions = h('div.share-actions')
    const sheet = h('div.share-sheet',
      h('h2', 'Share this card'),
      h('p.share-lede', theSeal?.imageId ? 'A picture of your card, ready to send or keep.' : 'A picture of the card, ready to send or keep.'),
      preview,
      actions,
    )
    renderShareCard({ card: c, seal: theSeal, backName: (state.settings.backName || '').trim() })
      .then((blob) => {
        if (disposed) return
        url = URL.createObjectURL(blob)
        const name = shareFileName(c.title, theSeal?.createdAt || new Date().toISOString())
        const file = new File([blob], name, { type: 'image/png' })
        preview.removeAttribute('aria-busy')
        preview.replaceChildren(h('img', { src: url, alt: `Your card, ${c.title}, as a picture`, width: SHARE_W, height: SHARE_H }))
        const save = () => {
          saveFile(url, name)
          toast('Saved. It’s with your downloads.')
        }
        const share = async () => {
          try {
            await navigator.share({ files: [file], title: c.title })
          } catch (e) {
            if (e?.name === 'AbortError') return
            save()
          }
        }
        const sharing = canShareFile(file)
        actions.replaceChildren(...[
          sharing ? h('button.btn.btn-gilt', { type: 'button', onclick: share }, raw(ICONS.share), 'Share') : null,
          h(sharing ? 'button.btn-text' : 'button.btn.btn-gilt', { type: 'button', onclick: save }, raw(ICONS.download), 'Save the picture'),
        ].filter(Boolean))
        if (sheet.contains(document.activeElement) || document.activeElement === sheet.parentElement) actions.querySelector('button')?.focus()
      })
      .catch((e) => {
        console.error(e)
        if (disposed) return
        preview.removeAttribute('aria-busy')
        preview.replaceChildren(h('p.share-wait', 'The picture wouldn’t come together this time. Try again in a moment?'))
        actions.replaceChildren(h('button.btn-text', { type: 'button', onclick: close }, 'Close'))
      })
    return sheet
  }, {
    label: `Share ${c.title}`,
    className: 'share',
    onClose: () => {
      disposed = true
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  })
}
