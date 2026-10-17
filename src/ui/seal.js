// "You drew it." Two equal endings: a photo sealed into the card's gilt frame,
// or a handwritten tick. Either way a small ceremony, then back to the table.
import { h, raw, mount, uid, prefersReducedMotion, wait } from './h.js'
import { renderCard, flip } from './card.js'
import { ICONS } from './ornaments.js'
import { openSheet, toast } from './feedback.js'
import { flipSound } from './sound.js'
import { go } from './app.js'
import { state, content, recordDrawn, requestPersistence, setMeta } from '../store/state.js'
import { hashString } from '../engine/rng.js'
import {
  FRAME, OUTPUT, CREAM, JPEG_QUALITY, fitView, coverView, isWhole, panBy, zoomAt, pinchView, wheelFactor,
  visibleRects, downscaleSteps, previewSize, spaceIsLow, shouldNudgeBackup,
} from './image.js'

const DECODE_ERROR = 'That photo wouldn’t open here. A screenshot of it or a JPEG will work.'
const SAVE_ERROR = 'That didn’t save just now. Try once more, or keep it as drawn with no photo.'
const NOTE_ERROR = 'That didn’t save just now. Try once more in a moment.'
const LOW_SPACE = 'This device is nearly out of room. It should still fit, but saving a copy of your deck in Settings would be wise.'
const BACKUP_NUDGE = 'Your deck lives only on this device. Save a copy somewhere safe?'

// Until lines.json arrives, the deck still has something kind to say.
const FALLBACK_LINES = {
  sealed: ['Sealed. {title} is yours now.'],
  drawnNoPhoto: ['Drawn. The deck has made a note.'],
}

const ZOOM_STEP = 1.2
const PAN_STEP = 40

// A tick that looks drawn with a pencil: one stroke, slightly bowed.
const HAND_TICK = `<svg class="hand-tick" viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path pathLength="1" d="M12 56 C 20 60, 29 69, 37 84 C 39 87, 41 87, 43 84 C 60 55, 81 30, 110 11" stroke-width="5"/>
</svg>`

// One flow at a time: a quick double tap on "I've drawn it" must not stack
// two sheets (and two seals).
let flowOpen = false

export function openSealFlow(reading, { onDone } = {}) {
  if (flowOpen) return
  flowOpen = true
  const cardId = reading.cards.who || reading.cards.theme
  const card = content.byId.get(cardId) || { id: cardId || 'twist-card', title: 'This card' }
  let photo = null
  let busy = false
  let finished = false
  let closed = false
  let stepCleanup = null
  let closeSheet = () => {}

  const camera = fileInput('seal-camera', true)
  const library = fileInput('seal-library', false)
  const stepHost = h('div.seal-step')
  // The page underneath changed (the back button, say): the sheet goes with it.
  const onRoute = () => closeSheet()

  openSheet((close) => {
    closeSheet = close
    showChoice()
    return h('div.seal-flow', camera, library, stepHost)
  }, {
    label: 'You drew it',
    className: 'seal-sheet',
    onClose: () => {
      closed = true
      window.removeEventListener('hashchange', onRoute)
      stepCleanup?.()
      stepCleanup = null
      if (!finished) {
        dropPhoto()
        flowOpen = false
      }
    },
  })
  window.addEventListener('hashchange', onRoute)

  // The seal is saved by now, so whatever happens to the ceremony the caller
  // still hears about it.
  function celebrate(result, imageBlob) {
    const done = (r) => {
      flowOpen = false
      onDone?.(r)
    }
    try {
      ceremony({ ...result, card, onDone: done, imageBlob })
    } catch (e) {
      console.error(e)
      done(result)
    }
  }

  function fileInput(name, capture) {
    const input = h('input.sr-only', { type: 'file', accept: 'image/*', name, tabindex: '-1', 'aria-hidden': 'true' })
    if (capture) input.setAttribute('capture', 'environment')
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.value = ''
      if (file) openPhoto(file)
    })
    return input
  }

  function setStep(...children) {
    stepCleanup?.()
    stepCleanup = null
    mount(stepHost, ...children)
    stepHost.closest('.sheet')?.classList.toggle('is-cropping', Boolean(stepHost.querySelector('.crop-step')))
    // The sheet focuses itself on open; after that, each new step's heading
    // takes focus so screen readers hear where she is.
    if (stepHost.isConnected) stepHost.querySelector('h2')?.focus({ preventScroll: true })
  }

  function dropPhoto() {
    photo?.release()
    photo = null
  }

  // -------------------------------------------------------------------------
  // Step one: two endings, side by side and the same size.

  function showChoice({ error = '' } = {}) {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const photoId = uid('end')
    const plainId = uid('end')
    setStep(
      h('header.seal-head',
        h('p.seal-kicker', card.title),
        h('h2', { tabindex: '-1' }, 'You drew it.'),
        h('p', 'Seal a photo of it into the card, or simply mark it drawn. Both finish it properly.'),
      ),
      // Up top, where she will see it without scrolling.
      error ? h('p.seal-error', { role: 'alert' }, error) : null,
      h('div.seal-endings',
        h('section.seal-ending', { 'aria-labelledby': photoId },
          h('span.ending-icon', raw(ICONS.camera)),
          h('h3', { id: photoId }, 'Seal a photo'),
          h('p', 'Your drawing goes into the gilt frame, and the card keeps it.'),
          h('div.ending-btns',
            coarse ? h('button.btn.btn-paper', { type: 'button', onclick: () => camera.click() }, raw(ICONS.camera), 'Take a photo') : null,
            h('button.btn.btn-paper', { type: 'button', onclick: () => library.click() }, raw(ICONS.image), 'Choose a photo'),
          ),
        ),
        h('p.seal-or', { 'aria-hidden': 'true' }, 'or'),
        h('section.seal-ending', { 'aria-labelledby': plainId },
          h('span.ending-icon', raw(ICONS.tick)),
          h('h3', { id: plainId }, 'No photo needed'),
          h('p', 'A handwritten tick and today’s date. Every bit as finished.'),
          h('div.ending-btns',
            h('button.btn.btn-paper', { type: 'button', onclick: drawnNoPhoto }, raw(ICONS.tick), 'Drawn, no photo'),
          ),
        ),
      ),
      h('p.seal-status', { role: 'status' }),
    )
  }

  function setBusy(message) {
    const status = stepHost.querySelector('.seal-status')
    if (status) status.textContent = message
    stepHost.querySelectorAll('button').forEach((b) => { b.disabled = Boolean(message) })
  }

  async function openPhoto(file) {
    if (busy) return
    busy = true
    setBusy('Opening your photo…')
    try {
      const next = await decodePhoto(file)
      if (closed) return next.release()
      dropPhoto()
      photo = next
      showCrop()
    } catch (e) {
      console.warn('Photo would not decode', e)
      if (photo) showCrop({ error: DECODE_ERROR })
      else showChoice({ error: DECODE_ERROR })
    } finally {
      busy = false
    }
  }

  async function drawnNoPhoto() {
    if (busy) return
    busy = true
    setBusy('Making a note…')
    let result
    try {
      result = await recordDrawn(reading)
    } catch (e) {
      console.error(e)
      busy = false
      showChoice({ error: NOTE_ERROR })
      return
    }
    finished = true
    dropPhoto()
    closeSheet()
    celebrate(result)
  }

  // -------------------------------------------------------------------------
  // Step two: line the photo up in a 5:8 frame.

  function showCrop({ error = '' } = {}) {
    const img = { width: photo.width, height: photo.height }
    const preview = makePreview(photo)
    let view = fitView(img)
    let raf = 0
    let easeTimer = 0
    const hintId = uid('hint')

    const frameEl = h('div.crop-frame', {
      tabindex: '0',
      role: 'application',
      'aria-roledescription': 'photo framer',
      'aria-label': 'Your photo in the card frame',
      'aria-describedby': hintId,
    }, preview)
    const fit = h('input.switch', { type: 'checkbox', checked: true })
    const notes = h('div.crop-notes', error ? h('p.seal-error', { role: 'alert' }, error) : null)
    const sealBtn = h('button.btn.btn-gilt.seal-it', { type: 'button', onclick: () => seal() }, 'Seal it')

    const paint = (ease = false) => {
      const k = frameEl.clientWidth / FRAME.width
      if (!k) return
      clearTimeout(easeTimer)
      preview.classList.toggle('is-easing', ease)
      if (ease) easeTimer = setTimeout(() => preview.classList.remove('is-easing'), 320)
      const s = (view.scale * photo.width * k) / preview.width
      preview.style.transform = `translate3d(${view.x * k}px, ${view.y * k}px, 0) scale(${s})`
      fit.checked = isWhole(view, img)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint() })
    }
    const centre = { x: FRAME.width / 2, y: FRAME.height / 2 }
    const zoomBy = (factor) => { view = zoomAt(view, factor, centre, img); paint(true) }

    // Pointers: one drags, two pinch. Positions are kept in frame pixels.
    const pointers = new Map()
    let rect = null
    const toFrame = (e) => {
      const k = FRAME.width / rect.width
      return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k }
    }
    frameEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      rect = frameEl.getBoundingClientRect()
      try { frameEl.setPointerCapture(e.pointerId) } catch { /* not all pointers can be captured */ }
      pointers.set(e.pointerId, toFrame(e))
      preview.classList.remove('is-easing')
      frameEl.classList.add('is-grabbing')
    })
    frameEl.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return
      const p = toFrame(e)
      if (pointers.size === 1) {
        const last = pointers.get(e.pointerId)
        view = panBy(view, p.x - last.x, p.y - last.y, img)
      } else {
        const ids = [...pointers.keys()].slice(0, 2)
        if (ids.includes(e.pointerId)) {
          const prev = ids.map((id) => pointers.get(id))
          const next = ids.map((id) => (id === e.pointerId ? p : pointers.get(id)))
          view = pinchView(view, prev, next, img)
        }
      }
      pointers.set(e.pointerId, p)
      schedule()
    })
    const lift = (e) => {
      pointers.delete(e.pointerId)
      if (!pointers.size) frameEl.classList.remove('is-grabbing')
    }
    frameEl.addEventListener('pointerup', lift)
    frameEl.addEventListener('pointercancel', lift)
    frameEl.addEventListener('wheel', (e) => {
      e.preventDefault()
      rect = frameEl.getBoundingClientRect()
      // Trackpad pinches arrive as small ctrl+wheel deltas.
      view = zoomAt(view, wheelFactor(e.ctrlKey ? e.deltaY * 4 : e.deltaY, e.deltaMode), toFrame(e), img)
      schedule()
    }, { passive: false })
    frameEl.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const step = e.shiftKey ? PAN_STEP * 3 : PAN_STEP
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (moves[e.key]) {
        view = panBy(view, ...moves[e.key], img)
        paint(true)
      } else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / ZOOM_STEP)
      else return
      e.preventDefault()
    })
    fit.addEventListener('change', () => {
      view = fit.checked ? fitView(img) : coverView(img)
      paint(true)
    })

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => paint()) : null
    ro?.observe(frameEl)
    const onResize = () => paint()
    if (!ro) window.addEventListener('resize', onResize)

    setStep(h('div.crop-step',
      h('header.crop-head',
        h('h2', { tabindex: '-1' }, 'Into the frame'),
        h('p.crop-hint', { id: hintId }, 'Drag to move it, pinch or scroll to zoom.', h('span.sr-only', ' Arrow keys move it, and plus or minus zoom.')),
      ),
      frameEl,
      h('div.crop-side',
        h('div.crop-controls',
          h('div.crop-zoom',
            h('button.icon-btn', { type: 'button', 'aria-label': 'Zoom out', title: 'Zoom out', onclick: () => zoomBy(1 / ZOOM_STEP) }, raw(ICONS.minus)),
            h('button.icon-btn', { type: 'button', 'aria-label': 'Zoom in', title: 'Zoom in', onclick: () => zoomBy(ZOOM_STEP) }, raw(ICONS.plus)),
          ),
          h('label.fit-toggle', h('span', 'Fit the whole drawing'), fit),
        ),
        notes,
        h('div.crop-actions',
          sealBtn,
          h('div.crop-alt',
            h('button.btn-text', { type: 'button', onclick: () => { dropPhoto(); showChoice() } }, raw(ICONS.back), 'Back'),
            h('button.btn-text', { type: 'button', onclick: () => library.click() }, raw(ICONS.image), 'A different photo'),
          ),
        ),
      ),
    ))
    stepCleanup = () => {
      cancelAnimationFrame(raf)
      clearTimeout(easeTimer)
      ro?.disconnect()
      window.removeEventListener('resize', onResize)
      releaseCanvas(preview)
    }
    requestAnimationFrame(() => paint())

    // Space is checked up front so the warning comes before she commits.
    navigator.storage?.estimate?.().then((est) => {
      if (spaceIsLow(est) && notes.isConnected) notes.appendChild(h('p.seal-note', LOW_SPACE))
    }).catch(() => {})

    async function seal() {
      if (busy) return
      busy = true
      // Back and "A different photo" wait too, so the photo can't change mid-seal.
      setBusy('Sealing…')
      sealBtn.textContent = 'Sealing…'
      let result
      let image
      try {
        const out = await renderSeal(photo, view)
        // She closed the sheet while it was drawing: nothing is saved.
        if (closed) return
        image = out.image
        result = await recordDrawn(reading, out)
      } catch (e) {
        console.error(e)
        busy = false
        setBusy('')
        sealBtn.textContent = 'Seal it'
        notes.replaceChildren(h('p.seal-error', { role: 'alert' }, SAVE_ERROR))
        return
      }
      finished = true
      dropPhoto()
      closeSheet()
      if (state.seals.filter((s) => s.kind === 'photo').length === 1) requestPersistence()
      celebrate(result, image)
    }
  }
}

// ---------------------------------------------------------------------------
// Decoding and drawing

async function decodePhoto(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      if (bmp.width && bmp.height) return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() }
      bmp.close?.()
    } catch { /* fall back to an <img> below */ }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  try {
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Empty image')
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function makeCanvas(width, height) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))
  return c
}

// Safari keeps canvas memory until the canvas is shrunk.
function releaseCanvas(c) {
  c.width = 0
  c.height = 0
}

function context(c) {
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

// drawImage with a source and destination rect, halving in steps for big
// downscales so fine pencil texture doesn't turn to grit.
function drawScaled(ctx, source, r) {
  let src = source
  let { sx, sy, sw, sh } = r
  let temp = null
  for (const w of downscaleSteps(sw, r.dw)) {
    const hgt = Math.max(1, Math.round(sh * (w / sw)))
    const c = makeCanvas(w, hgt)
    context(c).drawImage(src, sx, sy, sw, sh, 0, 0, w, hgt)
    if (temp) releaseCanvas(temp)
    temp = c
    src = c
    sx = 0
    sy = 0
    sw = w
    sh = hgt
  }
  ctx.drawImage(src, sx, sy, sw, sh, r.dx, r.dy, r.dw, r.dh)
  if (temp) releaseCanvas(temp)
}

function makePreview(photo) {
  const size = previewSize(photo)
  const c = makeCanvas(size.width, size.height)
  drawScaled(context(c), photo.source, { sx: 0, sy: 0, sw: photo.width, sh: photo.height, dx: 0, dy: 0, dw: c.width, dh: c.height })
  c.className = 'crop-photo'
  c.setAttribute('aria-hidden', 'true')
  c.style.width = `${c.width}px`
  c.style.height = `${c.height}px`
  return c
}

function toJpeg(c) {
  return new Promise((resolve, reject) => {
    c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))), 'image/jpeg', JPEG_QUALITY)
  })
}

async function renderSeal(photo, view) {
  const { width, height } = OUTPUT.image
  const out = makeCanvas(width, height)
  const ctx = context(out)
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, width, height)
  const r = visibleRects(view, photo)
  if (r) drawScaled(ctx, photo.source, r)
  const thumbCanvas = makeCanvas(OUTPUT.thumb.width, OUTPUT.thumb.height)
  drawScaled(context(thumbCanvas), out, { sx: 0, sy: 0, sw: width, sh: height, dx: 0, dy: 0, dw: thumbCanvas.width, dh: thumbCanvas.height })
  try {
    return { image: await toJpeg(out), thumb: await toJpeg(thumbCanvas) }
  } finally {
    releaseCanvas(out)
    releaseCanvas(thumbCanvas)
  }
}

// ---------------------------------------------------------------------------
// The ceremony

function pickLine(key, seed, title) {
  const list = content.lines?.[key]
  const pool = Array.isArray(list) && list.length ? list : FALLBACK_LINES[key]
  return pool[hashString(String(seed)) % pool.length].replace(/\{title\}/g, title)
}

export function handDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ceremony({ seal, reading, card, onDone, imageBlob }) {
  const isPhoto = seal.kind === 'photo'
  const reduce = prefersReducedMotion()
  const imageUrl = imageBlob ? URL.createObjectURL(imageBlob) : ''
  const previouslyFocused = document.activeElement
  const line = pickLine(isPhoto ? 'sealed' : 'drawnNoPhoto', seal.id, card.title)
  const cardEl = renderCard({
    card,
    size: 'lg',
    faceDown: isPhoto && !reduce,
    imageUrl,
    dateText: handDate(seal.createdAt),
    backName: state.settings.backName,
    className: isPhoto ? 'sealed' : 'drawn-plain',
  })
  let tick = null
  if (!isPhoto) {
    tick = h('span.hand-tick-wrap', raw(HAND_TICK))
    cardEl.querySelector('.card-front')?.appendChild(tick)
  }
  const lineId = uid('line')
  // The callers go to different places afterwards, so the button doesn't promise one.
  const btn = h('button.btn.btn-gilt.ceremony-btn', { type: 'button', onclick: () => dismiss() }, 'Lovely')
  const stage = h('div.ceremony-stage', cardEl)
  const overlay = h(`div.seal-ceremony${reduce ? '.is-calm' : ''}`, {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': isPhoto ? `${card.title}, sealed` : `${card.title}, drawn`,
    'aria-describedby': lineId,
    tabindex: '-1',
  },
    stage,
    h('div.ceremony-words', h('p.ceremony-line', { id: lineId }, line), btn),
  )

  let done = false
  let gone = false
  const finish = ({ skipped = false } = {}) => {
    if (done) return
    done = true
    if (skipped) cardEl.classList.add('is-instant')
    // A tap during the calm crossfade shows the face straight away.
    stage.querySelector('.ceremony-back')?.remove()
    flip(cardEl, true)
    if (isPhoto) cardEl.classList.add('shimmer')
    tick?.classList.add('is-drawn')
    overlay.classList.add('is-done')
    if (reduce) btn.parentElement.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' })
    btn.focus({ preventScroll: true })
  }
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (done) dismiss()
      else finish({ skipped: true })
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (done) btn.focus()
    } else if (!done && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      finish({ skipped: true })
    }
  }
  overlay.addEventListener('click', (e) => {
    if (!done) {
      e.preventDefault()
      e.stopPropagation()
      finish({ skipped: true })
    }
  }, true)

  function dismiss() {
    if (gone) return
    gone = true
    document.removeEventListener('keydown', onKey)
    const remove = () => {
      overlay.remove()
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
    if (reduce) remove()
    else {
      overlay.classList.add('is-leaving')
      setTimeout(remove, 240)
    }
    document.body.style.overflow = ''
    if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === 'function') previouslyFocused.focus({ preventScroll: true })
    onDone?.({ seal, reading })
    if (isPhoto) maybeNudgeBackup()
  }

  document.addEventListener('keydown', onKey)
  document.body.appendChild(overlay)
  document.body.style.overflow = 'hidden'
  overlay.focus({ preventScroll: true })

  ;(async () => {
    const img = cardEl.querySelector('.card-art img')
    if (img) await img.decode?.().catch(() => {})
    if (reduce) {
      // A quiet crossfade from the back of the card to its face.
      if (isPhoto) {
        const back = renderCard({ card, size: 'lg', faceDown: true, backName: state.settings.backName, className: 'ceremony-back' })
        stage.appendChild(back)
        await back.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 240, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {})
        back.remove()
      } else if (tick) {
        tick.classList.add('is-drawn')
        await tick.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' }).finished.catch(() => {})
      }
      finish()
      return
    }
    await wait(isPhoto ? 720 : 520)
    if (done) return
    if (isPhoto) {
      cardEl.classList.add('is-lifting')
      flip(cardEl, true)
      flipSound()
      await wait(620)
      if (done) return
      cardEl.classList.add('shimmer')
      await wait(260)
    } else {
      tick.classList.add('is-drawn')
      await wait(560)
    }
    finish()
  })()
}

function maybeNudgeBackup() {
  const photoSeals = state.seals.filter((s) => s.kind === 'photo').length
  if (!shouldNudgeBackup({ photoSeals, lastBackupAt: state.meta.lastBackupAt, backupNudgeAt: state.meta.backupNudgeAt })) return
  setMeta({ backupNudgeAt: new Date().toISOString() })
  toast(BACKUP_NUDGE, { action: 'Save a copy', onAction: () => go('settings'), duration: 9000 })
}
