// The card: cream stock, a gilt frame, a suit emblem, a title, and room for
// her drawing. Card faces are real text so they stay readable and accessible.
import { h, raw, uid } from './h.js'
import { EMBLEMS, CORNER, cardBackSvg } from './ornaments.js'
import { cardColours, colourWords } from './photos.js'

export function suitOf(card) {
  if (!card) return 'twist'
  if (card.suit) return card.suit
  const prefix = card.id.split('-')[0]
  return { where: 'where', when: 'when', twist: 'twist', theme: 'theme' }[prefix] || 'twist'
}

const corners = () => ['tl', 'tr', 'bl', 'br'].map((c) => h(`span.card-corner.${c}`, raw(CORNER)))

/**
 * @param {object} o
 * @param {object} o.card       content card (or undefined for a pure back)
 * @param {string} [o.label]    position label, e.g. "Who or what"
 * @param {string} [o.size]     'xs' | 'sm' | 'md' | 'lg'
 * @param {boolean} [o.faceDown]
 * @param {string} [o.imageUrl] sealed drawing
 * @param {string} [o.dateText] handwritten date under a sealed or drawn card
 * @param {boolean} [o.drawn]   drawn without a photo: a small tick
 * @param {string} [o.backName] name in the cartouche on the back
 * @param {boolean} [o.phrases] show the italic phrases (defaults on for md/lg)
 */
export function renderCard({ card, label = '', size = 'sm', faceDown = false, imageUrl = '', dateText = '', drawn = false, backName = '', phrases, tilt = 0, className = '' } = {}) {
  const suit = suitOf(card)
  const showPhrases = phrases ?? (size === 'md' || size === 'lg')
  const front = card
    ? h('div.card-face.card-front',
        h('span.card-frame'),
        h('span.card-rule'),
        corners(),
        label ? h('span.card-label', label) : null,
        h(`div.card-art${imageUrl ? '.has-image' : ''}`,
          imageUrl ? h('img', { src: imageUrl, alt: `Your drawing for ${card.title}`, draggable: false }) : raw(EMBLEMS[suit] || EMBLEMS.twist),
        ),
        colourStrip(card, { imageUrl, size }),
        h('span.card-title', card.title),
        showPhrases && card.phrases?.length ? h('span.card-phrases', card.phrases.map((p) => h('span', p))) : null,
        dateText ? h('span.card-date.hand', drawn && !imageUrl ? `✓ ${dateText}` : dateText) : null,
      )
    : h('div.card-face.card-front')
  const back = h('div.card-face.card-back',
    h('span.card-frame'),
    raw(cardBackSvg(uid('lat'))),
    backName ? h('span.card-cartouche', h('span', 'the deck of'), h('strong', backName)) : null,
  )
  const el = h(`div.card.card-${size}.suit-${suit}${faceDown ? '.is-down' : ''}${className ? '.' + className.split(' ').join('.') : ''}`,
    { style: tilt ? { '--tilt': `${tilt}deg` } : undefined, dataset: card ? { card: card.id } : {} },
    h('div.card-inner', front, back),
  )
  return el
}

// A strip of the subject's real colours, so the card says roughly what the
// thing looks like. Big cards also name the colours.
function colourStrip(card, { imageUrl, size }) {
  const colours = cardColours(card)
  if (!colours.length || imageUrl || size === 'xs') return null
  const words = colourWords(card)
  return h('span.card-colours', { role: 'img', 'aria-label': `Colours: ${words.join(', ')}` },
    h('span.card-swatches', colours.map((hex) => h('i', { style: { background: hex } }))),
    size === 'lg' || size === 'md' ? h('span.card-colour-words', words.join(' · ')) : null,
  )
}

export function flip(el, faceUp = true) {
  el.classList.toggle('is-down', !faceUp)
}
