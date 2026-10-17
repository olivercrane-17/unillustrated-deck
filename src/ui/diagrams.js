// Drawing aids for the Drawing View, drawn as inline SVG: ten composition
// diagrams (a page with the subject marked on it, inked with a slightly
// wobbly line) and the gentle timer's progress ring. Everything here is pure
// and returns strings, so it can be tested without a browser.

export const DIAGRAMS = {
  vignette: { title: 'A soft vignette', caption: 'Keep the subject in the middle and let the edges fade out to bare paper.' },
  window: { title: 'Through a window', caption: 'Frame it inside something: a window, a doorway, a gap in the hedge.' },
  'low-horizon': { title: 'A low horizon', caption: 'Put the ground low down and give most of the page to the sky.' },
  'close-crop': { title: 'Close crop', caption: 'Get in close and let the edges cut it off. Closer than feels polite.' },
  'from-above': { title: 'From above', caption: 'Look straight down on it, as if it were on the table in front of you.' },
  thirds: { title: 'Off-centre thirds', caption: 'Off-centre: put it on a third line and let the rest breathe.' },
  'tall-strip': { title: 'A tall strip', caption: 'Rule a tall, narrow panel and let the subject sit high up in it.' },
  'postage-stamp': { title: 'Postage stamp', caption: 'Draw it tiny, in a little box, with a wide margin of bare paper all round.' },
  'three-studies': { title: 'Three studies', caption: 'Three small studies of the same thing, each from a different side.' },
  sampler: { title: 'A sampler page', caption: 'A grid of little boxes with one small thing in each. Tick them off as you go.' },
}

export const FRAME_IDS = Object.keys(DIAGRAMS)

/**
 * Which diagram suits a reading: the twist's frame, else one of the Where
 * card's frames (chosen by the seed so it stays put), else a spread default.
 */
export function chooseFrame(reading, byId) {
  const get = (id) => (id && byId?.get ? byId.get(id) : undefined)
  const twistFrame = get(reading?.cards?.twist)?.effects?.frame
  if (DIAGRAMS[twistFrame]) return twistFrame
  const frames = (get(reading?.cards?.where)?.frames || []).filter((f) => DIAGRAMS[f])
  if (frames.length) return frames[(reading.seed >>> 0) % frames.length]
  if (reading?.spread === 'small') return 'sampler'
  if (reading?.spread === 'quick') return 'close-crop'
  return 'thirds'
}

// ---------------------------------------------------------------------------
// Drawing helpers. Coordinates are in a 232 x 204 box: a portrait page on the
// left and a margin on the right for handwritten notes.

const PAGE = { x: 12, y: 10, w: 130, h: 184 }
const X1 = PAGE.x + PAGE.w
const Y1 = PAGE.y + PAGE.h
const CX = PAGE.x + PAGE.w / 2
const NOTE_X = 152
const PAPER = '#fbf7ee'
const DEFAULT_TINT = '#c9a253'

const r1 = (n) => Math.round(n * 10) / 10
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

let seq = 0

// A soft, irregular closed blob (Catmull-Rom through points round a circle).
export function blobPath(cx, cy, r, k = 0, points = 7) {
  const pts = []
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + k * 0.7
    const rr = r * (1 + 0.12 * Math.sin(i * 2.17 + k * 1.3) + 0.05 * Math.cos(i * 3.7 + k))
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92])
  }
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % points]
    const p3 = pts[(i + 2) % points]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return `${d} Z`
}

// The subject: a paper-coloured base (so lines behind it are hidden), a wash of
// the main pencil, an inked edge and a small curve that gives it some form.
function subject(cx, cy, r, k, { tint, ground = false } = {}) {
  const d = blobPath(cx, cy, r, k)
  const form = r > 9
    ? `<path d="M${r1(cx - r * 0.5)} ${r1(cy - r * 0.08)} Q${r1(cx - r * 0.42)} ${r1(cy - r * 0.52)} ${r1(cx + r * 0.05)} ${r1(cy - r * 0.6)}" stroke-width=".9" opacity=".55"/>`
    : ''
  const shadow = ground
    ? `<path d="M${r1(cx - r * 0.85)} ${r1(cy + r * 1.06)} Q${r1(cx)} ${r1(cy + r * 1.32)} ${r1(cx + r * 0.95)} ${r1(cy + r * 1.02)}" stroke-width=".9" opacity=".5"/>`
    : ''
  return `<g class="dg-subject">${shadow}<path d="${d}" fill="${PAPER}" stroke="none" class="dg-subject-base"/><path d="${d}" fill="${tint}" fill-opacity=".5" stroke-width="1.4" class="dg-subject-wash"/>${form}</g>`
}

// A handwritten note in the right margin with a curved arrow to a point.
function note(lines, ty, [px, py]) {
  const sx = NOTE_X - 4
  const sy = ty - 4
  const len = Math.hypot(px - sx, py - sy) || 1
  const bend = Math.min(14, len * 0.28)
  // Bow the line gently upwards, away from the straight path.
  let nx = -(py - sy) / len
  let ny = (px - sx) / len
  if (ny > 0) { nx = -nx; ny = -ny }
  const qx = (sx + px) / 2 + nx * bend
  const qy = (sy + py) / 2 + ny * bend
  const ang = Math.atan2(py - qy, px - qx)
  const head = (da) => `${r1(px - 6 * Math.cos(ang + da))} ${r1(py - 6 * Math.sin(ang + da))}`
  const text = lines.map((l, i) => `<tspan x="${NOTE_X}" dy="${i ? 13 : 0}">${esc(l)}</tspan>`).join('')
  return {
    arrow: `<path class="dg-arrow" d="M${sx} ${sy} Q${r1(qx)} ${r1(qy)} ${r1(px)} ${r1(py)} M${head(0.5)} L${r1(px)} ${r1(py)} L${head(-0.5)}" stroke-width="1"/>`,
    text: `<text class="dg-note" x="${NOTE_X}" y="${ty}" font-family="Caveat, 'Segoe Print', cursive" font-size="14" fill="currentColor" stroke="none">${text}</text>`,
  }
}

const handNum = (x, y, n) => `<text class="dg-num" x="${r1(x)}" y="${r1(y)}" font-family="Caveat, 'Segoe Print', cursive" font-size="12" fill="currentColor" stroke="none">${n}</text>`

// ---------------------------------------------------------------------------
// The ten frames. Each returns { body, notes, text } where body is inked (and
// wobbled) and text is set crisp on top.

const FRAMES = {
  vignette({ tint }) {
    const body = `
      <ellipse cx="${CX}" cy="100" rx="53" ry="70" stroke-width="1" stroke-dasharray="2 5" opacity=".55"/>
      <ellipse cx="${CX}" cy="100" rx="44" ry="58" stroke-width="1.3"/>
      ${subject(CX, 102, 19, 1, { tint, ground: true })}`
    return { body, notes: [note(['subject'], 92, [99, 98]), note(['soft edges'], 34, [107, 43])] }
  },

  window({ tint }) {
    const body = `
      <path d="M30 156 V 72 A 47 47 0 0 1 124 72 V 156" stroke-width="1.4"/>
      <path d="M36 156 V 72 A 41 41 0 0 1 118 72 V 156" stroke-width="1"/>
      <path d="M77 31 V 156 M36 98 H 118" stroke-width="1"/>
      <path d="M22 156 H 132 M25 162 H 129" stroke-width="1.3"/>
      ${subject(92, 139, 15, 2, { tint })}`
    return { body, notes: [note(['subject'], 128, [108, 136]), note(['the frame'], 52, [124, 64])] }
  },

  'low-horizon'({ tint }) {
    const body = `
      <path d="M30 66 q 5 -8 13 -4 q 6 -7 13 -1 q 8 -1 8 6 Z" stroke-width="1" opacity=".55"/>
      <circle cx="112" cy="44" r="7" stroke-width="1" opacity=".55"/>
      <path d="M${PAGE.x} 150 C 40 146, 62 153, 90 148 S 128 151, ${X1} 147" stroke-width="1.4"/>
      <path d="M22 163 h 10 M48 171 h 14 M88 164 h 10 M112 177 h 16 M30 184 h 8" stroke-width=".9" opacity=".5"/>
      ${subject(50, 140, 10, 3, { tint })}`
    return { body, notes: [note(['plenty of sky'], 92, [104, 84]), note(['subject'], 126, [62, 137]), note(['horizon,', 'kept low'], 172, [122, 152])] }
  },

  'close-crop'({ tint, uid }) {
    const body = `
      <defs><clipPath id="${uid}-crop"><rect x="${PAGE.x}" y="${PAGE.y}" width="${PAGE.w}" height="${PAGE.h}"/></clipPath></defs>
      <g clip-path="url(#${uid}-crop)">${subject(96, 134, 72, 4, { tint })}</g>
      <path d="M${PAGE.x - 9} ${PAGE.y} H ${PAGE.x - 3} M${PAGE.x} ${PAGE.y - 9} V ${PAGE.y - 3}
               M${X1 + 3} ${PAGE.y} H ${X1 + 9} M${X1} ${PAGE.y - 9} V ${PAGE.y - 3}
               M${PAGE.x - 9} ${Y1} H ${PAGE.x - 3} M${PAGE.x} ${Y1 + 3} V ${Y1 + 9}
               M${X1 + 3} ${Y1} H ${X1 + 9} M${X1} ${Y1 + 3} V ${Y1 + 9}" stroke-width="1"/>`
    return { body, notes: [note(['subject,', 'right up close'], 40, [112, 76]), note(['off the edge'], 178, [X1 - 4, 160])] }
  },

  'from-above'({ tint }) {
    const body = `
      <path d="M${PAGE.x} 40 C 50 36, 92 44, ${X1} 37 M${PAGE.x} 162 C 58 157, 100 167, ${X1} 159 M${PAGE.x} 182 C 52 179, 96 186, ${X1} 180" stroke-width=".9" opacity=".45"/>
      <path d="${blobPath(84, 110, 30, 5)}" fill="#000" fill-opacity=".08" stroke="none"/>
      ${subject(CX, 102, 30, 5, { tint })}
      <path d="${blobPath(CX, 102, 16, 6)}" stroke-width="1" fill="none"/>
      <circle cx="${CX}" cy="102" r="2" fill="currentColor" stroke="none" opacity=".6"/>`
    return { body, notes: [note(['seen from', 'the top'], 78, [104, 92]), note(['its shadow'], 150, [110, 131])] }
  },

  thirds({ tint }) {
    const xs = [PAGE.x + PAGE.w / 3, PAGE.x + (2 * PAGE.w) / 3]
    const ys = [PAGE.y + PAGE.h / 3, PAGE.y + (2 * PAGE.h) / 3]
    const lines = [
      ...xs.map((x) => `M${r1(x)} ${PAGE.y} V ${Y1}`),
      ...ys.map((y) => `M${PAGE.x} ${r1(y)} H ${X1}`),
    ].join(' ')
    const dots = xs.flatMap((x) => ys.map((y) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.8" fill="currentColor" stroke="none"/>`)).join('')
    const body = `
      <path d="${lines}" stroke-width="1" stroke-dasharray="3 4" opacity=".7"/>
      ${dots}
      ${subject(xs[1], ys[1] - 3, 16, 7, { tint, ground: true })}`
    return { body, notes: [note(['a third'], 30, [r1(xs[1]) + 2, 34]), note(['subject on', 'a crossing'], 148, [116, 130])] }
  },

  'tall-strip'({ tint }) {
    const body = `
      <rect x="56" y="18" width="42" height="168" rx="1.5" stroke-width="1.3"/>
      <path d="M77 180 C 70 162, 86 148, 76 130 S 70 104, 78 86" stroke-width="1" stroke-dasharray="2 4" opacity=".7"/>
      ${subject(78, 64, 13, 8, { tint })}`
    return { body, notes: [note(['subject,', 'up high'], 52, [94, 62]), note(['a tall,', 'narrow panel'], 146, [99, 156])] }
  },

  'postage-stamp'({ tint }) {
    const body = `
      <rect x="46" y="66" width="62" height="74" stroke-width="3.2" stroke-dasharray="0.1 5.2" stroke-linecap="round"/>
      <rect x="51" y="71" width="52" height="64" stroke-width="1.1"/>
      ${subject(CX, 104, 13, 9, { tint, ground: true })}`
    return { body, notes: [note(['a tiny box'], 58, [109, 70]), note(['lots of', 'bare paper'], 160, [122, 170])] }
  },

  'three-studies'({ tint }) {
    const studies = [[50, 52, 26, 12], [102, 102, 25, 13], [54, 154, 28, 17]]
    const body = studies.map(([x, y, r, s], i) => `
      <circle cx="${x}" cy="${y}" r="${r}" stroke-width="1.2"/>
      ${subject(x, y + 1, s, 10 + i * 2, { tint })}`).join('')
    const text = studies.map(([x, y, r], i) => handNum(x - r - 2, y - r + 6, i + 1)).join('')
    return { body, text, notes: [note(['the same', 'thing, three', 'ways'], 112, [128, 104])] }
  },

  sampler({ tint, count = 6, done = [] }) {
    const n = Math.max(1, Math.min(8, Math.round(count) || 6))
    const cols = n === 1 ? 1 : 2
    const rows = Math.ceil(n / cols)
    const pad = 10
    const gap = 8
    const w = (PAGE.w - pad * 2 - gap * (cols - 1)) / cols
    const hgt = (PAGE.h - pad * 2 - gap * (rows - 1)) / rows
    const doneSet = new Set(done)
    let body = ''
    let text = ''
    let point = null
    for (let i = 0; i < n; i++) {
      const x = PAGE.x + pad + (i % cols) * (w + gap)
      const y = PAGE.y + pad + Math.floor(i / cols) * (hgt + gap)
      const r = Math.min(w, hgt) * 0.22
      body += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(hgt)}" rx="3" stroke-width="1.1"/>`
      body += subject(x + w / 2, y + hgt / 2 + 2, r, 13 + i, { tint })
      if (doneSet.has(i)) body += `<path class="dg-tick" d="M${r1(x + w - 15)} ${r1(y + 9)} l 3.5 3.5 l 6.5 -7.5" stroke-width="1.8"/>`
      text += handNum(x + 4, y + 12, i + 1)
      if (i === Math.min(1, n - 1)) point = [r1(x + w / 2 + r + 3), r1(y + hgt / 2)]
    }
    return { body, text, notes: [note(['one small', 'thing in each'], point[1] - 2, [point[0] + 1, point[1]])] }
  },
}

/**
 * An ink diagram of the page for a frame id. Options: `tint` (a hex colour
 * for the subject wash, usually the main pencil), and for the sampler `count`
 * (cells) and `done` (indices of ticked cells).
 */
export function diagramSvg(id, { tint, count, done } = {}) {
  const frame = DIAGRAMS[id] ? id : 'thirds'
  const uid = `dg${++seq}`
  const safeTint = /^#[0-9a-f]{3,8}$/i.test(tint || '') ? tint : DEFAULT_TINT
  const { body, notes = [], text = '' } = FRAMES[frame]({ tint: safeTint, uid, count, done })
  const seed = [...frame].reduce((a, c) => a + c.charCodeAt(0), 0) % 97
  return `<svg class="diagram diagram-${frame}" viewBox="0 0 232 204" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <defs>
      <filter id="${uid}-wobble" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" seed="${seed}" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
    <rect x="${PAGE.x + 3}" y="${PAGE.y + 4}" width="${PAGE.w}" height="${PAGE.h}" rx="2" fill="#000" fill-opacity=".07" stroke="none" class="dg-shadow"/>
    <g filter="url(#${uid}-wobble)">
      <rect x="${PAGE.x}" y="${PAGE.y}" width="${PAGE.w}" height="${PAGE.h}" rx="2" fill="${PAPER}" stroke-width="1.3" class="dg-page"/>
      ${body}
      ${notes.map((n) => n.arrow).join('')}
    </g>
    ${notes.map((n) => n.text).join('')}
    ${text}
  </svg>`
}

// ---------------------------------------------------------------------------
// The gentle timer: a small pure model plus the ring it is drawn with.

export const TIMER_MINUTES = [10, 20, 45]

export function newTimer(minutes, now = Date.now()) {
  return { minutes, duration: minutes * 60000, elapsed: 0, since: now }
}

export function timerElapsed(t, now = Date.now()) {
  const running = t.since == null ? 0 : Math.max(0, now - t.since)
  return Math.min(t.duration, t.elapsed + running)
}

export function pauseTimer(t, now = Date.now()) {
  if (t.since == null) return t
  return { ...t, elapsed: timerElapsed(t, now), since: null }
}

export function resumeTimer(t, now = Date.now()) {
  if (t.since != null || timerElapsed(t, now) >= t.duration) return t
  return { ...t, since: now }
}

export function timerStatus(t, now = Date.now()) {
  const elapsed = timerElapsed(t, now)
  const left = Math.max(0, t.duration - elapsed)
  const done = left <= 0
  return { progress: t.duration ? elapsed / t.duration : 1, left, minutesLeft: Math.ceil(left / 60000), done, paused: !done && t.since == null }
}

export const RING_R = 26
export const RING_C = 2 * Math.PI * RING_R

// How much of the ring's stroke to hide for a progress between 0 and 1.
export function ringOffset(progress) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0))
  return r1(RING_C * (1 - p))
}

export function ringSvg(progress = 0) {
  return `<svg class="timer-ring" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle class="ring-track" cx="32" cy="32" r="${RING_R}" fill="none" stroke-width="3"/>
    <circle class="ring-fill" cx="32" cy="32" r="${RING_R}" fill="none" stroke-width="3.4" stroke-linecap="round"
      stroke-dasharray="${r1(RING_C)}" stroke-dashoffset="${ringOffset(progress)}" transform="rotate(-90 32 32)"/>
  </svg>`
}
