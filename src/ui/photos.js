// "See real photos": a plain link out to an image search, so she can check
// what a dormouse or a pie funnel really looks like. Needs the internet; the
// rest of the app never does.
import { h, raw } from './h.js'
import { colourName } from '../engine/color.js'

const ARROW = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16 L 16 8 M9.5 8 H 16 V 14.5"/></svg>'

export function subjectName(card) {
  if (card.search) return card.search
  const base = card.the ? card.the.replace(/^the /, '') : card.title.replace(/^(The|A|An|Some) /, '').toLowerCase()
  return base
}

export function photoSearchUrl(card) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(subjectName(card))}`
}

export function photosLink(card, { className = '' } = {}) {
  return h(`a.photos-link${className ? '.' + className : ''}`, {
    href: photoSearchUrl(card),
    target: '_blank',
    rel: 'noopener noreferrer',
    title: 'Opens an image search in a new tab (needs the internet)',
  }, `See real photos of ${card.the ? subjectName(card) : `“${card.title}”`}`, raw(ARROW))
}

// The colours a card is really made of, for the strip on its face.
export function cardColours(card) {
  const list = [...(card.colours || []), ...(card.accent ? [card.accent] : [])]
  return [...new Set(list.map((c) => c.toUpperCase()))].slice(0, 4)
}

export function colourWords(card) {
  return [...new Set(cardColours(card).map(colourName))]
}
