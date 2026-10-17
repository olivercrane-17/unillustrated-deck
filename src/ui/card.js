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

// Titles wrap only between words. The type is sized in container units, so a
// word's width is a fixed share of the card's at every size: work it out once
// from the font's advance widths (Cormorant SC Bold with the title's 0.06em
// letter-spacing, in thousandths of an em, measured in the browser), and cap
// the size so the longest word always fits.
const CAPS = [776, 655, 729, 765, 612, 582, 779, 824, 402, 399, 715, 605, 917, 795, 826, 613, 826, 758, 575, 703, 763, 720, 971, 707, 679, 665]
const SMALL = [616, 585, 579, 627, 524, 481, 611, 692, 363, 333, 614, 528, 745, 624, 627, 531, 627, 607, 482, 562, 628, 591, 824, 602, 558, 511]
const MARKS = { '-': 342, '’': 298, "'": 262, '&': 612, ',': 334, '.': 319, ':': 319, 'é': 524 }
function advance(ch) {
  const c = ch.charCodeAt(0)
  if (c >= 65 && c <= 90) return CAPS[c - 65]
  if (c >= 97 && c <= 122) return SMALL[c - 97]
  return MARKS[ch] ?? 640
}
// The widest piece of a title that cannot wrap (a word, or one part of a
// hyphenated word), in em.
export function longestRun(title = '') {
  let best = 0
  for (const word of title.split(/\s+/)) {
    const pieces = word.split('-')
    pieces.forEach((piece, i) => {
      let w = i < pieces.length - 1 ? advance('-') : 0 // the hyphen stays on the line before the break
      for (const ch of piece) w += advance(ch)
      best = Math.max(best, w / 1000)
    })
  }
  return best
}
// The title's box is 74% of the card wide (72 leaves a little to spare). A
// title with a long word may borrow 3% either side, still clear of the thin
// rule, and its type is capped so that word fits whole.
const LONG_RUN = 5.6
function titleFit(title) {
  const run = longestRun(title)
  if (!run) return { long: false, style: undefined }
  const long = run > LONG_RUN
  return { long, style: { '--title-max': `${((long ? 78 : 72) / run).toFixed(2)}cqw` } }
}

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
 * @param {boolean} [o.phrases] show the italic phrases on the face (off unless asked
 *                              for: they clip on small faces, and the zoom sheet and
 *                              the card's own page list them beside the card)
 */
export function renderCard({ card, label = '', size = 'sm', faceDown = false, imageUrl = '', dateText = '', drawn = false, backName = '', phrases, tilt = 0, className = '' } = {}) {
  const suit = suitOf(card)
  const showPhrases = phrases === true && size !== 'xs'
  const fit = titleFit(card?.title)
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
        h(`span.card-title${fit.long ? '.is-long' : ''}`, { style: fit.style }, card.title),
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
    // Lines break only after a dot: each colour's name stays whole ("dark
    // purple"), and no line starts with a dot.
    size === 'lg' || size === 'md' ? h('span.card-colour-words', words.map((w) => w.replace(/ /g, '\u00a0')).join('\u00a0· ')) : null,
  )
}

export function flip(el, faceUp = true) {
  el.classList.toggle('is-down', !faceUp)
}
