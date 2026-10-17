// One card: large, with her chosen face, and every time she has drawn it.
import { h, raw, mount } from './h.js'
import { renderCard, suitOf } from './card.js'
import { EMBLEMS, ICONS, SUIT_LABELS, pencilSvg } from './ornaments.js'
import {
  state, content, sealsFor, faceSealFor, setFace, deleteSeal, imageUrl, subscribe, engineContext, deal, pencilHex, pencilCatalogue,
} from '../store/state.js'
import { dealReading, SPREADS } from '../engine/reading.js'
import { newSeed } from '../engine/rng.js'
import { go } from './app.js'
import { toast, openSheet, confirmSheet } from './feedback.js'
import { shortDate, longDate, backLink } from './deck.js'
import { openShareSheet } from './share.js'

const SUBJECT_SUITS = ['fur', 'leaf', 'hearth']
const SEALABLE = [...SUBJECT_SUITS, 'theme']
const pencilByCode = new Map(pencilCatalogue.map((p) => [p.code, p]))

export async function render(root, { id } = {}) {
  const card = content.byId.get(id)
  if (!card) return notFound(root)
  const suit = suitOf(card)
  let disposed = false
  let busy = false

  async function paint({ focus } = {}) {
    const seals = sealsFor(card.id).slice().reverse()
    const face = faceSealFor(card.id)
    const [faceUrl, thumbs] = await Promise.all([
      face ? imageUrl(face.imageId, 'image') : '',
      Promise.all(seals.map((s) => (s.imageId ? imageUrl(s.imageId, 'thumb') : ''))),
    ])
    if (disposed) return
    const latest = seals[0]
    const shown = faceUrl ? face : latest
    const big = renderCard({
      card,
      size: 'lg',
      imageUrl: faceUrl,
      dateText: shown ? shortDate(shown.createdAt) : '',
      drawn: Boolean(shown && !faceUrl),
      className: faceUrl ? 'sealed' : '',
    })
    const cardEl = faceUrl
      ? h('button.detail-card-btn', { type: 'button', 'aria-label': `See your drawing of ${card.the || card.title} bigger`, onclick: () => openPhoto(face) }, big)
      : h('div.detail-card-btn', big)

    mount(root, h('div.detail',
      backLink(),
      h('article.detail-body',
        h('div.detail-figure', cardEl),
        h('div.detail-words',
          SUIT_LABELS[suit] ? h('p.detail-suit', h('span.suit-mark', raw(EMBLEMS[suit])), SUIT_LABELS[suit]) : null,
          h('h1.detail-title', { tabindex: '-1' }, card.title),
          // The card face shows its phrases until a photo takes their place.
          faceUrl && card.phrases?.length ? h('p.detail-phrases', card.phrases.map((p) => h('span', p))) : null,
          card.rule ? h('p.detail-rule', card.rule) : null,
          card.note ? h('p.detail-rule', card.note) : null,
          actions(face),
        ),
        SEALABLE.includes(suit) ? history(seals, thumbs) : null,
      ),
    ))
    if (focus) root.querySelector(focus)?.focus()
  }

  function actions(face) {
    const out = []
    if (SUBJECT_SUITS.includes(suit)) {
      out.push(h('button.btn.btn-gilt.detail-draw', { type: 'button', onclick: (e) => drawThis(e.currentTarget) }, raw(ICONS.pencil), 'Draw this one'))
    }
    if (face) {
      out.push(h('button.btn.btn-ghost', { type: 'button', onclick: () => openShareSheet({ card, seal: face }) }, raw(ICONS.share), 'Share this card'))
    }
    return out.length ? h('div.detail-actions', out) : null
  }

  function history(seals, thumbs) {
    if (!seals.length) {
      return h('section.history.history-none',
        h('p.hand', SUBJECT_SUITS.includes(suit) ? 'Still in the box. No rush, the deck keeps.' : 'Still in the box. It comes up in “A page of small things”.'))
    }
    return h('section.history', { 'aria-labelledby': 'history-head' },
      h('h2.history-head', { id: 'history-head', tabindex: '-1' }, seals.length > 1 ? 'Every time you’ve drawn it' : 'When you drew it'),
      h('ol.history-list', seals.map((s, i) => entry(s, thumbs[i]))),
    )
  }

  function entry(seal, thumb) {
    const isFace = Boolean(thumb) && faceSealFor(card.id)?.id === seal.id
    const when = longDate(seal.createdAt)
    const pic = thumb
      ? h('button.history-photo', { type: 'button', 'aria-label': `See your drawing from ${when} bigger`, onclick: () => openPhoto(seal) },
          h('img', { src: thumb, alt: '', draggable: false }))
      : h('div.history-tick', { 'aria-hidden': 'true' }, raw(ICONS.tick))
    return h(`li.history-entry.paper.on-paper${isFace ? '.is-face' : ''}`, { id: `seal-${seal.id}`, tabindex: '-1' },
      pic,
      h('div.history-words',
        h('p.history-date',
          h('span.hand', when),
          isFace ? h('span.face-badge', 'The card’s face') : null,
          !thumb ? h('span.history-kind', 'Drawn, no photo') : null),
        seal.sentence ? h('p.history-sentence', seal.sentence) : null,
        swatches(seal.pencils, seal.spread),
        h('div.history-actions',
          thumb && !isFace ? h('button.btn-text', { type: 'button', onclick: () => useAsFace(seal) }, raw(ICONS.star), 'Use as the card’s face') : null,
          h('button.btn-text.history-remove', { type: 'button', onclick: () => remove(seal) }, 'Remove'),
        ),
      ),
    )
  }

  function swatches(codes = [], spread) {
    if (!codes.length) return null
    return h('div.history-tin',
      spread && SPREADS[spread] ? h('span.history-spread', SPREADS[spread].label) : null,
      h('ul.swatch-row', { 'aria-label': 'Pencils' }, codes.map((code) => {
        const name = pencilByCode.get(code)?.name || code
        return h('li', h('span.swatch-pic', { 'aria-hidden': 'true' }, raw(pencilSvg(pencilHex(code), { label: name }))), h('span', name))
      })),
    )
  }

  // ---- Actions ---------------------------------------------------------------

  function openPhoto(seal) {
    openSheet((close) => {
      const img = h('img.photo-big', { alt: `Your drawing of ${card.the || card.title}, ${longDate(seal.createdAt)}`, draggable: false })
      imageUrl(seal.imageId, 'image').then((url) => { if (url) img.src = url })
      const isFace = faceSealFor(card.id)?.id === seal.id
      return h('div.photo-sheet',
        h('div.photo-mount', img),
        h('p.photo-caption', h('span.hand', longDate(seal.createdAt)), isFace ? h('span.face-badge', 'The card’s face') : null),
        h('div.photo-actions',
          h('button.btn.btn-paper', { type: 'button', autofocus: true, onclick: () => { close(); openShareSheet({ card, seal }) } }, raw(ICONS.share), 'Share'),
          !isFace ? h('button.btn-text', { type: 'button', onclick: () => { close(); useAsFace(seal) } }, raw(ICONS.star), 'Use as the card’s face') : null,
          h('button.btn-text', { type: 'button', onclick: () => { close(); remove(seal) } }, 'Remove'),
        ),
      )
    }, { label: `Your drawing of ${card.the || card.title}`, className: 'photo' })
  }

  async function useAsFace(seal) {
    await setFace(seal.id)
    toast(`${card.title} has a new face.`)
    await paint({ focus: `#seal-${CSS.escape(seal.id)}` })
  }

  async function remove(seal) {
    const others = sealsFor(card.id).filter((s) => s.id !== seal.id)
    const what = seal.imageId ? 'drawing' : 'tick'
    const ok = await confirmSheet({
      title: seal.imageId ? 'Remove this drawing?' : 'Remove this tick?',
      body: others.length
        ? `The ${what} from ${longDate(seal.createdAt).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase())} goes for good. ${card.title} keeps the rest.`
        : `This is the only ${what} on ${card.title}, so the card goes back in the box. You can always draw it again.`,
      confirm: 'Remove it',
      cancel: 'Keep it',
      danger: true,
    })
    if (!ok) return
    await deleteSeal(seal.id)
    toast(seal.imageId ? 'Removed. The photo has gone from this device.' : 'Removed.')
    await paint({ focus: others.length ? '#history-head' : '.detail-title' })
  }

  async function drawThis(btn) {
    if (busy) return
    busy = true
    btn.disabled = true
    const attempt = async (spread) => {
      const r = dealReading(engineContext(), { spread, seed: newSeed(), fixedWho: card })
      await deal(r.spread, { fixedReading: r })
    }
    try {
      const ctx = engineContext()
      try {
        await attempt(ctx.content.wheres.length ? 'evening' : 'quick')
      } catch (e) {
        console.warn('Falling back to a quick doodle', e)
        await attempt('quick')
      }
      go('')
    } catch (e) {
      console.error(e)
      busy = false
      btn.disabled = false
      const emptyTin = !state.tin.owned.length || /tin is empty/i.test(e.message)
      if (emptyTin) toast('Your tin is empty. Tick a few pencils and the deck can deal.', { action: 'Open your tin', onAction: () => go('tin') })
      else toast('The deck got in a muddle with that one. Try again in a moment?')
    }
  }

  await paint()
  const off = subscribe((what) => { if ((what === 'seal' || what === 'reload') && !busy) paint() })
  return () => {
    disposed = true
    off()
  }
}

function notFound(root) {
  mount(root, h('div.detail.detail-missing',
    backLink(),
    h('div.missing-body',
      h('div.missing-frame', { 'aria-hidden': 'true' }, renderCard({ card: { id: 'twist-missing', title: '' }, size: 'md' })),
      h('h1', 'This card has slipped out of the deck'),
      h('p', 'It may have been renamed, or the link got a bit crumpled on the way. Everything you’ve drawn is still safe in your deck.'),
      h('a.btn.btn-gilt', { href: '#/deck' }, 'Back to your deck'),
    ),
  ))
}
