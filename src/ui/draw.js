// The Drawing View: the screen she props beside her paper while she draws.
// Big words, big swatches, the first mark and a little diagram of the page.
import { h, raw, mount, prefersReducedMotion } from './h.js'
import { ICONS, EMBLEMS, pencilSvg } from './ornaments.js'
import { suitOf } from './card.js'
import { state, content, pencilCatalogue, pencilHex, startDrawing, updateReading } from '../store/state.js'
import { SPREADS } from '../engine/reading.js'
import { go } from './app.js'
import { glossify } from './gloss.js'
import { openSealFlow } from './seal.js'
import {
  DIAGRAMS, diagramSvg, chooseFrame, TIMER_MINUTES, newTimer, pauseTimer, resumeTimer, timerStatus, ringSvg, ringOffset,
} from './diagrams.js'

const pencilByCode = new Map(pencilCatalogue.map((p) => [p.code, p]))

// Kept for the session, so a running timer and the wake choice survive a
// quick trip back to the table.
const timers = new Map()
let wantAwake = true

const WOBBLY_NOTE = 'Try this one in one unbroken line, no lifting.'
const DONE_LINE = 'That’s the time. Carry on if you like.'
const TRUTH = 'Screen colours are approximate. Your pencils are the truth.'

// Swatch colours go into SVG markup, and a "Looks off?" override can arrive
// from an imported backup, so only a real hex gets through.
const HEX = /^#[0-9a-f]{3,8}$/i
function swatchHex(code) {
  const hex = pencilHex(code)
  return HEX.test(hex) ? hex : (pencilByCode.get(code)?.hex || '#999999')
}

export async function render(root, { id } = {}) {
  let reading = state.readings.get(id)
  if (!reading) return showMissing(root)
  if (reading.status === 'dealt') reading = await startDrawing(reading)

  const cleanups = []
  const latest = () => state.readings.get(reading.id) || reading
  const diagram = diagramPanel(reading)
  const keeper = wakeKeeper()
  if (keeper) cleanups.push(() => keeper.dispose())
  const timer = timerPanel(reading.id)
  cleanups.push(() => timer.dispose())

  const words = wordsPanel(reading, { latest, onSlots: (r) => diagram.repaint(r) })
  const tips = tipsPanel(reading)
  // The seal sheet is modal over this view. Leaving the view (the back
  // button, say) closes it rather than leaving it over the next page.
  cleanups.push(() => document.querySelector('.seal-sheet .sheet-close')?.click())

  mount(root, h('div.drawing',
    h('div.draw-top',
      h('a.btn-text.draw-back', { href: '#/' }, raw(ICONS.back), 'Back to the table'),
      timer.pill,
    ),
    h('div.draw-cols',
      h('div.draw-col.draw-col-words', words, pencilsPanel(reading), firstMarkPanel(reading)),
      h('div.draw-col.draw-col-page', diagram.el, tips,
        h('section.draw-tools', { 'aria-label': 'Timer and screen' }, timer.el, keeper ? wakeRow(keeper) : null),
      ),
    ),
    donePanel(reading, latest),
  ))

  return () => cleanups.forEach((fn) => fn())
}

function showMissing(root) {
  mount(root, h('div.drawing.draw-missing',
    h('p.empty-note', 'This reading seems to have wandered off. It may have been tidied away, or it was dealt on another device.'),
    h('p.draw-missing-link', h('a.btn.btn-ghost', { href: '#/' }, raw(ICONS.back), 'Back to the table')),
  ))
}

function leadCard(reading) {
  return content.byId.get(reading.cards?.who || reading.cards?.theme)
}

function mainPencil(reading) {
  const pencils = reading.palette?.pencils || []
  return pencils.find((p) => p.slot === 'main' || p.slot === 'a0') || pencils[0]
}

const headingId = (key) => `draw-${key}-h`

// ---------------------------------------------------------------------------
// The words

function wordsPanel(reading, { latest, onSlots }) {
  const t = reading.text || {}
  const lead = leadCard(reading)
  const suit = suitOf(lead)
  const spread = SPREADS[reading.spread]
  return h(`section.draw-words.paper.suit-${suit}`, { 'aria-labelledby': headingId('words') },
    h('span.draw-emblem', raw(EMBLEMS[suit] || EMBLEMS.twist)),
    h('h1.draw-title', { id: headingId('words') },
      lead?.title || 'Your drawing',
      spread ? h('span.draw-spread', spread.label) : null,
    ),
    t.opener ? h('p.draw-opener', t.opener) : null,
    h('p.draw-sentence', t.sentence || 'Draw whatever tugs at you.'),
    t.framing ? h('p.draw-framing', t.framing) : null,
    t.twist ? h('p.draw-twist', h('strong', 'Twist: '), glossify(t.twist.replace(/^Twist:\s*/, ''))) : null,
    reading.spread === 'small' && reading.slots?.length ? slotList(reading, { latest, onSlots }) : null,
  )
}

// "A page of small things": a checklist she ticks as she goes.
function slotList(reading, { latest, onSlots }) {
  return h('ol.draw-slots', { 'aria-label': 'Your small things' }, reading.slots.map((slot, i) => {
    const box = h('input', { type: 'checkbox', checked: Boolean(slot.done) })
    const li = h(`li${slot.done ? '.done' : ''}`,
      h('label',
        box,
        h('span.draw-slot-num.hand', { 'aria-hidden': 'true' }, String(i + 1)),
        h('span.draw-slot-body', h('span.draw-slot-text', slot.text), slot.wobbly ? h('em', WOBBLY_NOTE) : null),
      ),
    )
    box.addEventListener('change', async () => {
      li.classList.toggle('done', box.checked)
      const r = latest()
      const next = {
        ...r,
        slots: r.slots.map((s, j) => (j === i ? { ...s, done: box.checked, doneAt: box.checked ? new Date().toISOString() : null } : s)),
      }
      onSlots(next)
      await updateReading(next)
    })
    return li
  }))
}

// ---------------------------------------------------------------------------
// Her pencils

function pencilsPanel(reading) {
  const p = reading.palette || { pencils: [] }
  const t = reading.text || {}
  const rows = (p.pencils || []).map((pen) => {
    const info = pencilByCode.get(pen.code) || { name: pen.code, code: pen.code }
    return h('li.draw-pencil',
      raw(pencilSvg(swatchHex(pen.code), { big: true, label: `${info.name} swatch` })),
      h('span.draw-pencil-text',
        h('code', info.code),
        h('strong', info.name),
        pen.role ? h('em', pen.role) : null,
      ),
    )
  })
  const notes = [
    t.lightLine && h('p', t.lightLine),
    t.smallTin && h('p', t.smallTin),
    t.lonelyLine && h('p.draw-lonely.hand', t.lonelyLine),
    h('p.draw-truth', TRUTH),
  ].filter(Boolean)
  return h('section.draw-pencils.paper', { 'aria-labelledby': headingId('pencils') },
    h('div.draw-head',
      h('h2', { id: headingId('pencils') }, 'Your pencils'),
      p.name ? h('span.draw-palette', p.name) : null,
    ),
    h('ul.draw-pencil-list', rows),
    h('div.draw-notes', notes),
  )
}

function firstMarkPanel(reading) {
  const mark = reading.text?.firstMark
  if (!mark) return null
  return h('section.draw-mark.paper', { 'aria-labelledby': headingId('mark') },
    h('span.draw-mark-icon', raw(ICONS.pencil)),
    h('h2', { id: headingId('mark') }, 'First mark'),
    h('p', glossify(mark)),
  )
}

// ---------------------------------------------------------------------------
// The page: a composition diagram, then the layering tips

function diagramPanel(reading) {
  const frame = chooseFrame(reading, content.byId)
  const info = DIAGRAMS[frame]
  const main = mainPencil(reading)
  const tint = main ? swatchHex(main.code) : undefined
  const art = h('div.draw-diagram-art')
  const repaint = (r) => {
    const slots = r.slots || []
    art.innerHTML = diagramSvg(frame, {
      tint,
      count: slots.length || undefined,
      done: slots.map((s, i) => (s.done ? i : -1)).filter((i) => i >= 0),
    })
  }
  repaint(reading)
  const el = h('section.draw-diagram.paper', { 'aria-labelledby': headingId('page') },
    h('div.draw-head',
      h('h2', { id: headingId('page') }, 'On the page'),
      h('span.draw-frame-name', info.title),
    ),
    art,
    h('p.draw-caption', info.caption),
  )
  return { el, repaint }
}

function tipsPanel(reading) {
  const who = reading.cards?.who && content.byId.get(reading.cards.who)
  const steps = who && content.tips?.textures?.[who.texture]
  const paperLine = reading.text?.paperLine
  if (!steps?.length && !paperLine) return null
  return h('section.draw-tips.paper', { 'aria-label': 'Tips' },
    steps?.length
      ? h('details.draw-layer',
          h('summary', 'How to layer'),
          h('ol', steps.map((s) => h('li', glossify(s)))),
        )
      : null,
    paperLine ? h('p.draw-paper-tip', h('strong', 'Paper'), h('span', glossify(paperLine))) : null,
  )
}

// ---------------------------------------------------------------------------
// The end

function donePanel(reading, latest) {
  const finished = reading.finishedAt && (reading.status === 'drawn' || reading.status === 'sealed')
  const when = finished ? new Date(reading.finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : ''
  return h('div.draw-done',
    finished ? h('p.draw-drawn-note.hand', `You drew this on ${when}. Again is always allowed.`) : null,
    h('button.btn.btn-gilt.draw-done-btn', {
      type: 'button',
      onclick: () => {
        // One sheet at a time, however eagerly the button is pressed.
        if (document.querySelector('.seal-sheet')) return
        openSealFlow(latest(), {
          onDone: (result) => { if (result?.seal?.cardId) go('card/' + result.seal.cardId) },
        })
      },
    }, raw(ICONS.tick), 'I’ve drawn it'),
    h('p.draw-done-hint', 'Add a photo if you like, or simply mark it drawn.'),
  )
}

// ---------------------------------------------------------------------------
// Screen Wake Lock: keep the screen on while she draws. If the browser can't,
// the screen just dims as it normally would and nothing is said.

function wakeKeeper() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock?.request) return null
  let sentinel = null
  let pending = false
  let disposed = false
  let failed = false
  const listeners = new Set()
  const changed = () => listeners.forEach((fn) => fn())

  async function acquire() {
    if (!wantAwake || disposed || sentinel || pending || document.visibilityState !== 'visible') return
    pending = true
    try {
      const s = await navigator.wakeLock.request('screen')
      if (disposed || !wantAwake) {
        s.release().catch(() => {})
      } else {
        sentinel = s
        failed = false
        s.addEventListener('release', () => { if (sentinel === s) { sentinel = null; changed() } })
      }
    } catch {
      failed = true
    } finally {
      pending = false
    }
    changed()
  }

  function release() {
    const s = sentinel
    sentinel = null
    if (s) s.release().catch(() => {})
    changed()
  }

  const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
  document.addEventListener('visibilitychange', onVisible)
  acquire()

  return {
    get wanted() { return wantAwake },
    get failed() { return failed },
    set(on) {
      wantAwake = on
      if (on) acquire()
      else release()
    },
    onChange(fn) { listeners.add(fn) },
    dispose() {
      disposed = true
      listeners.clear()
      document.removeEventListener('visibilitychange', onVisible)
      release()
    },
  }
}

function wakeRow(keeper) {
  const input = h('input.switch', { type: 'checkbox', checked: keeper.wanted })
  const row = h('label.draw-wake', h('span', 'Screen stays awake while you draw'), input)
  input.addEventListener('change', () => keeper.set(input.checked))
  const paint = () => {
    input.checked = keeper.wanted
    row.hidden = keeper.failed
  }
  keeper.onChange(paint)
  paint()
  return row
}

// ---------------------------------------------------------------------------
// The gentle timer. No sounds and no alarms: a ring that fills slowly and,
// at the end, one soft line.

function timerPanel(readingId) {
  const el = h('div.draw-timer')
  const live = h('p.sr-only', { 'aria-live': 'polite' })
  const body = h('div.draw-timer-body')
  el.append(body, live)
  const pill = h('button.draw-timer-pill', { type: 'button', hidden: true, onclick: () => {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
    el.querySelector('button')?.focus({ preventScroll: true })
  } })
  let tick = null
  let wasDone = false

  const get = () => timers.get(readingId)
  const set = (t, focusRole) => {
    if (t) timers.set(readingId, t)
    else timers.delete(readingId)
    paint(focusRole)
  }

  function chips() {
    return h('div.draw-timer-idle',
      h('p.draw-timer-label', { id: 'draw-timer-h' }, 'Gentle timer'),
      h('div.chips', { role: 'group', 'aria-labelledby': 'draw-timer-h' },
        TIMER_MINUTES.map((m) => h('button.chip', {
          type: 'button',
          dataset: { role: 'start' },
          'aria-label': `Start a ${m} minute timer`,
          onclick: () => set(newTimer(m), 'pause'),
        }, `${m} min`)),
      ),
    )
  }

  function ring(t, s) {
    const btn = (role, label, onclick, icon) => h('button.btn-text', { type: 'button', dataset: { role }, onclick }, icon ? raw(icon) : null, label)
    return h(`div.draw-timer-run${s.done ? '.is-done' : ''}${s.paused ? '.is-paused' : ''}`,
      h('div.draw-ring', { role: 'img', 'aria-label': ringLabel(t, s) },
        raw(ringSvg(s.progress)),
        h('span.draw-ring-text', h('strong', String(s.done ? t.minutes : s.minutesLeft)), h('small', 'min')),
      ),
      h('div.draw-timer-side',
        s.done
          ? h('p.draw-timer-done.hand', DONE_LINE)
          : h('p.draw-timer-state', s.paused ? 'Paused. Pick it up when you’re ready.' : 'Just a guide. Stop whenever you like.'),
        h('div.draw-timer-btns',
          s.done ? null : s.paused
            ? btn('resume', 'Carry on', () => set(resumeTimer(get()), 'pause'))
            : btn('pause', 'Pause', () => set(pauseTimer(get()), 'resume')),
          btn('stop', s.done ? 'Put it away' : 'Stop the timer', () => set(null, 'start')),
        ),
      ),
    )
  }

  function ringLabel(t, s) {
    if (s.done) return `Timer finished: ${t.minutes} minutes`
    const left = s.minutesLeft === 1 ? 'About a minute left' : `About ${s.minutesLeft} minutes left`
    return s.paused ? `${left}, paused` : left
  }

  function paint(focusRole) {
    const t = get()
    clearInterval(tick)
    tick = null
    if (!t) {
      wasDone = false
      live.textContent = ''
      body.replaceChildren(chips())
      pill.hidden = true
    } else {
      const s = timerStatus(t)
      if (s.done && !wasDone) live.textContent = DONE_LINE
      wasDone = s.done
      body.replaceChildren(ring(t, s))
      paintPill(t, s)
      if (!s.done && !s.paused) tick = setInterval(update, 1000)
    }
    if (focusRole) body.querySelector(`[data-role="${focusRole}"]`)?.focus()
  }

  // Each second: move the ring and the minutes, and repaint once it's done.
  function update() {
    const t = get()
    if (!t) return paint()
    const s = timerStatus(t)
    if (s.done) return paint()
    const fill = body.querySelector('.ring-fill')
    if (fill) fill.style.strokeDashoffset = String(ringOffset(s.progress))
    const num = body.querySelector('.draw-ring-text strong')
    if (num) num.textContent = String(s.minutesLeft)
    body.querySelector('.draw-ring')?.setAttribute('aria-label', ringLabel(t, s))
    paintPill(t, s)
  }

  function paintPill(t, s) {
    pill.hidden = false
    pill.replaceChildren(
      h('span.draw-pill-ring', raw(ringSvg(s.progress))),
      s.done ? 'Time' : s.paused ? 'Paused' : `${s.minutesLeft} min`,
    )
    pill.setAttribute('aria-label', s.done ? 'The timer has finished. Show the timer.' : `${ringLabel(t, s)}. Show the timer.`)
  }

  paint()
  return { el, pill, dispose: () => clearInterval(tick) }
}
