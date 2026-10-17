// The felt table: the deck, the deal, and the reading.
import { h, raw, mount, prefersReducedMotion, wait } from './h.js'
import { renderCard, flip } from './card.js'
import { ICONS, pencilSvg } from './ornaments.js'
import {
  state, content, pencilSets, currentReading, deal, choices, logReshuffle, clearReshuffles, saveReading,
  updateReading, engineContext, pencilHex, readingsByDate, faceSealFor, imageUrl, pencilCatalogue, startDrawing,
  ownedPencils,
} from '../store/state.js'
import { SPREADS, POSITION_LABELS, swapCard, repaint, swapPencil, toggleLock, newPicture } from '../engine/reading.js'
import { hashString } from '../engine/rng.js'
import { go, soundButton } from './app.js'
import { openSheet } from './feedback.js'
import { riffle, flipSound, clink } from './sound.js'
import { glossify } from './gloss.js'
import { openSealFlow } from './seal.js'

const SPREAD_ORDER = ['quick', 'evening', 'big', 'small']
const FLIP_GAP = 340

const pick = (list, seed) => (list?.length ? list[seed % list.length] : '')
const pencilByCode = new Map(pencilCatalogue.map((p) => [p.code, p]))

export function positionsOf(reading) {
  return SPREADS[reading.spread].positions.filter((p) => reading.cards[p])
}

function tiltFor(reading, position) {
  return ((hashString(`${reading.seed}:${position}`) % 300) / 100 - 1.5).toFixed(2)
}

function inProgress(r) {
  return r && (r.status === 'dealt' || r.status === 'drawing')
}

export async function render(root) {
  let disposed = false
  let busy = false
  const cleanups = []
  const view = h('div.table')
  const sound = soundButton()
  root.appendChild(h('div.table-tools', sound))
  root.appendChild(view)
  cleanups.push(() => sound.unsubscribe?.())

  const onKey = (e) => {
    if (busy || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.target !== document.body && e.target !== root && !e.target.matches?.('main')) return
    if ((e.key === ' ' || e.key === 'Enter') && view.querySelector('.table-idle')) {
      e.preventDefault()
      dealNew(state.settings.lastSpread)
    }
  }
  document.addEventListener('keydown', onKey)
  cleanups.push(() => document.removeEventListener('keydown', onKey))

  // Optional shake-to-shuffle (permission is asked for in Settings).
  if (state.settings.shake && 'DeviceMotionEvent' in window) {
    let last = 0
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration
      if (!a) return
      const force = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0)
      const now = Date.now()
      if (force > 34 && now - last > 2500 && !busy && !document.querySelector('.sheet-backdrop')) {
        last = now
        const r = currentReading()
        dealNew(r && inProgress(r) ? r.spread : state.settings.lastSpread, { askAgain: Boolean(r && inProgress(r)) })
      }
    }
    window.addEventListener('devicemotion', onMotion)
    cleanups.push(() => window.removeEventListener('devicemotion', onMotion))
  }

  // ---------------------------------------------------------------------------

  function showEmptyTin() {
    mount(view, h('section.table-idle',
      h('div.deck-stack', { 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => renderCard({ card: { id: 'twist-back', title: '' }, size: 'md', faceDown: true, backName: state.settings.backName }))),
      h('p.first-note.hand', 'The tin is empty. Tick a few pencils and the deck can deal.'),
      h('a.btn.btn-gilt.draw-btn', { href: '#/tin' }, 'Open your tin'),
    ))
  }

  function showIdle() {
    if (!ownedPencils().some((p) => p.special !== 'blender')) return showEmptyTin()
    const lastSpread = SPREADS[state.settings.lastSpread] ? state.settings.lastSpread : 'evening'
    const carry = readingsByDate().find((r) => r.status === 'drawing')
    const firstRun = !state.settings.deals
    const stack = h('button.deck-stack', { type: 'button', 'aria-label': 'Tap the deck to draw a card', onclick: () => dealNew(currentSpread()) },
      [0, 1, 2, 3].map(() => renderCard({ card: { id: 'twist-back', title: '' }, size: 'md', faceDown: true, backName: state.settings.backName })),
    )
    let spread = lastSpread
    const currentSpread = () => spread
    const chips = h('div.chips', { role: 'group', 'aria-label': 'How long have you got?' },
      SPREAD_ORDER.map((key) => {
        const s = SPREADS[key]
        const chip = h('button.chip', { type: 'button', 'aria-pressed': String(key === spread), onclick: () => {
          spread = key
          chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
        } }, s.label, h('small', s.hint))
        return chip
      }),
    )
    mount(view, h('section.table-idle',
      carry ? h('button.carry-on', { type: 'button', onclick: () => resume(carry) }, 'Carry on: ', h('strong', titleOf(carry))) : null,
      stack,
      firstRun ? h('p.first-note.hand', 'Tap the deck. It’ll suggest something to draw, and which of your pencils to use.') : null,
      h('button.btn.btn-gilt.draw-btn', { type: 'button', onclick: () => dealNew(currentSpread()) }, 'Draw a card'),
      h('p.spread-label', 'How long have you got?'),
      chips,
    ))
  }

  async function resume(r) {
    await saveReading(r)
    showReading(r, { animate: false })
  }

  // `askAgain` changes the kind line; `count` decides whether this counts as an
  // aimless reshuffle (switching lengths is a choice, so it doesn't).
  async function dealNew(spread, { askAgain = false, count = askAgain } = {}) {
    if (busy) return
    if (!ownedPencils().some((p) => p.special !== 'blender')) return showEmptyTin()
    busy = true
    try {
      if (count) {
        const reshuffles = await logReshuffle()
        if (reshuffles >= 3) {
          await clearReshuffles()
          showChoices(spread)
          return
        }
      }
      const stack = view.querySelector('.deck-stack')
      const reduce = prefersReducedMotion()
      const quick = state.settings.quickDeal || (state.settings.deals || 0) >= 3
      const reading = await deal(spread)
      if (stack && !reduce) {
        stack.classList.toggle('quick', quick)
        stack.classList.add('riffling')
        riffle()
        await wait(quick ? 420 : 1260)
      }
      if (disposed) return
      const ideaSeed = reading.seed
      const idea = askAgain ? pick(content.lines.askAgain, ideaSeed) : pick(content.lines.deckIdea, ideaSeed)
      showReading(reading, { animate: !reduce, idea })
    } finally {
      busy = false
    }
  }

  function showChoices(spread) {
    const options = choices(spread)
    const line = pick(content.lines.spreadOut, options[0]?.seed || 0)
    mount(view, h('section.reading',
      h('p.deck-idea.hand', line || 'The deck spreads itself out. Pick the one that tugs at you.'),
      h('div.choices', options.map((r) => {
        const pos = r.cards.who ? 'who' : 'theme'
        const card = content.byId.get(r.cards[pos])
        return h('button.card-slot', { type: 'button', 'aria-label': `Choose ${card.title}`, onclick: async () => {
          const saved = await deal(spread, { fixedReading: r })
          showReading(saved, { animate: !prefersReducedMotion(), idea: pick(content.lines.deckIdea, saved.seed), skip: [pos] })
        } }, renderCard({ card, label: POSITION_LABELS[pos], size: 'md' }))
      })),
      h('div.reading-actions',
        h('button.btn-text', { type: 'button', onclick: async () => { busy = false; dealNew(spread) } }, raw(ICONS.shuffle), 'Shuffle again anyway')),
    ))
  }

  // ---------------------------------------------------------------------------

  function showReading(reading, { animate = false, idea = '', skip = [], flipOnly = [] } = {}) {
    let sequencing = false
    const positions = positionsOf(reading)
    const slots = positions.map((pos, i) => {
      const card = content.byId.get(reading.cards[pos])
      const isFriend = pos === 'who' && reading.oldFriend
      const el = renderCard({
        card,
        label: isFriend ? 'An old friend' : POSITION_LABELS[pos],
        size: positions.length === 1 ? 'md' : 'sm',
        faceDown: (animate && !skip.includes(pos)) || flipOnly.includes(pos),
        tilt: tiltFor(reading, pos),
        backName: state.settings.backName,
      })
      if (isFriend) fillSealImage(el, card.id)
      const slot = h(`button.card-slot${i === 0 ? '.card-lead' : ''}${animate ? '.dealing' : ''}`, {
        type: 'button',
        'aria-label': `${POSITION_LABELS[pos]}: ${card.title}. Tap to look closer or swap.`,
        style: { '--delay': `${i * 90}ms` },
        onclick: (e) => { e.stopPropagation(); if (!sequencing) zoom(reading, pos) },
      }, el)
      return { pos, slot, el }
    })
    const fan = h('div.fan', { style: { '--n': String(slots.length) } }, slots.map((s) => s.slot))
    const hidden = animate ? '.is-hidden' : ''
    const sections = [
      h(`div.slip.paper.reveal${hidden}`, slipContent(reading)),
      h(`div.tin-panel.paper.reveal${hidden}`, tinContent(reading)),
      reading.text.firstMark ? h(`div.first-mark.paper.reveal${hidden}`,
        h('span.fm-icon', raw(ICONS.pencil)), h('h2', 'First mark'), h('p', reading.text.firstMark)) : null,
      h(`div.reading-actions.reveal${hidden}`, actions(reading)),
    ].filter(Boolean)
    mount(view, h('section.reading', { 'aria-live': 'polite' },
      idea ? h('p.deck-idea.hand', idea) : null,
      fan,
      sections,
    ))

    if (animate) {
      sequencing = true
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        sequencing = false
        slots.forEach((s) => flip(s.el, true))
        sections.forEach((s) => s.classList.remove('is-hidden'))
        view.removeEventListener('click', finish, true)
      }
      view.addEventListener('click', finish, true)
      ;(async () => {
        await wait(460)
        for (const s of slots) {
          if (finished || disposed) break
          if (skip.includes(s.pos)) continue
          flip(s.el, true)
          flipSound()
          await wait(FLIP_GAP)
        }
        await wait(200)
        finish()
      })()
    } else if (flipOnly.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        slots.filter((s) => flipOnly.includes(s.pos)).forEach((s) => flip(s.el, true))
        flipSound()
      }))
    }
  }

  async function fillSealImage(cardEl, cardId) {
    const seal = faceSealFor(cardId)
    if (!seal) return
    const url = await imageUrl(seal.imageId, 'thumb')
    if (!url || disposed) return
    const fresh = renderCard({ card: content.byId.get(cardId), label: 'An old friend', size: 'sm', imageUrl: url })
    cardEl.querySelector('.card-front').replaceWith(fresh.querySelector('.card-front'))
  }

  function slipContent(reading) {
    const t = reading.text
    const out = []
    if (t.opener) out.push(h('p.opener', t.opener))
    const brief = t.brief?.length ? t.brief : [{ key: 'draw', label: 'Draw', text: t.sentence }]
    out.push(h('dl.brief', brief.map((line) => h(`div.brief-row.brief-${line.key}`,
      h('dt', line.label),
      h(`dd${line.key === 'draw' ? '.sentence' : ''}`, line.key === 'twist' || line.key === 'light' ? glossify(line.text) : line.text),
    ))))
    if (reading.spread === 'small' && reading.slots) out.push(smallSlots(reading))
    return out
  }

  function smallSlots(reading) {
    return h('ul.small-slots', reading.slots.map((slot, i) => {
      const box = h('input', { type: 'checkbox', checked: slot.done, 'aria-label': slot.text })
      const li = h(`li${slot.done ? '.done' : ''}`, h('label', box, h('span', slot.text, slot.wobbly ? h('em', 'Try this one in one unbroken line, no lifting.') : null)))
      box.addEventListener('change', async () => {
        const r = currentReading() || reading
        const next = { ...r, slots: r.slots.map((s, j) => (j === i ? { ...s, done: box.checked, doneAt: box.checked ? new Date().toISOString() : null } : s)) }
        li.classList.toggle('done', box.checked)
        await updateReading(next)
      })
      return li
    }))
  }

  function tinContent(reading) {
    const p = reading.palette
    const presetKey = state.tin.preset
    const presetText = pencilSets[presetKey] ? `From your ${pencilSets[presetKey].label.replace(' pencils', '')}-pencil tin` : `From your tin of ${state.tin.owned.length}`
    const who = reading.cards.who && content.byId.get(reading.cards.who)
    const tips = who && content.tips?.textures?.[who.texture]
    const rows = p.pencils.map((pen, i) => {
      const info = pencilByCode.get(pen.code) || { name: pen.code, code: pen.code }
      const hex = pencilHex(pen.code)
      return h(`li.pencil-row${pen.locked ? '.is-locked' : ''}`,
        raw(pencilSvg(hex, { label: `${info.name} swatch` })),
        h('span.pencil-name', h('code', info.code), h('strong', info.name), h('em', pen.role)),
        p.fixed ? h('span') : h('button.mini-btn', {
          type: 'button',
          'aria-pressed': String(Boolean(pen.locked)),
          'aria-label': pen.locked ? `Unlock ${info.name}` : `Keep ${info.name}`,
          title: pen.locked ? 'Kept. Tap to let it go.' : 'Keep this pencil',
          onclick: () => change(toggleLock(currentReading() || reading, i), {}),
        }, raw(pen.locked ? ICONS.lock : ICONS.unlock)),
        p.fixed ? h('span') : h('button.mini-btn', {
          type: 'button',
          'aria-label': `Swap ${info.name} for another pencil`,
          title: 'Swap this pencil',
          disabled: pen.locked,
          onclick: () => { clink(); change(swapPencil(currentReading() || reading, engineContext(), i), { newPencil: i }) },
        }, raw(ICONS.swap)),
      )
    })
    const notes = [reading.text.lonelyLine && h('p.lonely', reading.text.lonelyLine),
      reading.text.lightLine && h('p', reading.text.lightLine),
      reading.text.paperLine && h('p', reading.text.paperLine),
      reading.text.smallTin && h('p', reading.text.smallTin)].filter(Boolean)
    return [
      h('div.tin-head', h('h2', 'Your tin'), h('span.palette-name', p.name)),
      h('ul.pencil-rows', rows),
      notes.length ? h('div.tin-notes', notes) : null,
      tips ? h('details.layer-tips', h('summary', 'How to layer'), h('ol', tips.map((t) => h('li', glossify(t))))) : null,
      h('p.tin-foot', h('span', presetText), h('a', { href: '#/tin' }, 'Change your tin'), h('span', 'Screen colours are approximate. Your pencils are the truth.')),
    ]
  }

  function actions(reading) {
    const drawing = reading.status === 'drawing'
    const otherSpreads = SPREAD_ORDER.filter((k) => k !== reading.spread)
    return [
      h('button.btn.btn-gilt', { type: 'button', onclick: async () => {
        const r = await startDrawing(currentReading() || reading)
        go(`draw/${r.id}`)
      } }, raw(ICONS.pencil), drawing ? 'Back to drawing' : 'Start drawing'),
      drawing ? h('button.btn-text', { type: 'button', onclick: () => openSealFlow(currentReading() || reading, { onDone: () => showIdle() }) }, raw(ICONS.tick), 'I’ve drawn it') : null,
      h('div.alt-actions',
        h('button.btn-text', { type: 'button', onclick: () => change(repaint(currentReading() || reading, engineContext()), { allPencils: true }) }, 'New colours, same picture'),
        reading.spread !== 'small' ? h('button.btn-text', { type: 'button', onclick: () => change(newPicture(currentReading() || reading, engineContext()), { allCards: true, fresh: true }) }, 'New picture, same colours') : null,
      ),
      h('button.btn-text', { type: 'button', onclick: () => dealNew(reading.spread, { askAgain: true }) }, raw(ICONS.shuffle), 'Ask the deck again'),
      h('div.ask-again-for',
        h('p', 'Or ask again for'),
        h('div.chips', otherSpreads.map((k) => h('button.chip', { type: 'button', onclick: () => dealNew(k, { askAgain: true, count: false }) }, SPREADS[k].label, h('small', SPREADS[k].hint)))),
      ),
    ]
  }

  async function change(next, { newPencil, allCards, fresh, flipPos } = {}) {
    const prev = currentReading()
    if (fresh) delete next.id
    else if (prev && !next.id) next.id = prev.id
    next.status = prev?.status && !fresh ? prev.status : next.status
    const saved = await saveReading(next)
    const flipOnly = flipPos ? [flipPos] : allCards ? positionsOf(saved) : []
    showReading(saved, { flipOnly })
    if (newPencil !== undefined) view.querySelectorAll('.pencil-row')[newPencil]?.classList.add('is-new')
  }

  function zoom(reading, pos) {
    const card = content.byId.get(reading.cards[pos])
    const isFriend = pos === 'who' && reading.oldFriend
    openSheet((close) => {
      const cardEl = renderCard({ card, label: isFriend ? 'An old friend' : POSITION_LABELS[pos], size: 'lg' })
      if (isFriend) {
        const seal = faceSealFor(card.id)
        if (seal) imageUrl(seal.imageId, 'image').then((url) => {
          if (!url) return
          const fresh = renderCard({ card, label: 'An old friend', size: 'lg', imageUrl: url })
          cardEl.querySelector('.card-front').replaceWith(fresh.querySelector('.card-front'))
        })
      }
      return h('div.zoom-sheet',
        cardEl,
        h('div.btns',
          h('button.btn.btn-paper', { type: 'button', autofocus: true, onclick: () => {
            close()
            const r = currentReading() || reading
            change(swapCard(r, engineContext(), pos), { flipPos: pos })
          } }, raw(ICONS.swap), 'Swap this card'),
          h('button.btn-text', { type: 'button', onclick: close }, 'Keep it'),
        ),
      )
    }, { label: card.title, className: 'zoom' })
  }

  // ---------------------------------------------------------------------------

  const r = currentReading()
  if (inProgress(r)) showReading(r, { animate: false })
  else showIdle()

  return () => {
    disposed = true
    cleanups.forEach((fn) => fn())
  }
}

export function titleOf(reading) {
  const id = reading.cards.who || reading.cards.theme
  return content.byId.get(id)?.title || 'your last reading'
}
