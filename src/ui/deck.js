// Your deck: the cards she has drawn, by suit, with the rest of the deck as an
// unopened stack she can rummage through. It celebrates what exists and never
// counts what is missing.
import { h, raw, mount, prefersReducedMotion } from './h.js'
import { renderCard, suitOf } from './card.js'
import { EMBLEMS, ICONS, SUIT_LABELS } from './ornaments.js'
import { state, content, imageUrl, subscribe } from '../store/state.js'
import { hashString } from '../engine/rng.js'
import { go } from './app.js'
import { confirmSheet } from './feedback.js'

// The suits that live in her deck (Where, When and Twist cards are never sealed).
export const DECK_SUITS = ['fur', 'leaf', 'hearth', 'theme']

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)

const toDate = (iso) => (iso instanceof Date ? iso : new Date(iso))
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "17 Oct", or "17 Oct 2025" when it was another year. */
export function shortDate(iso, now = new Date()) {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return ''
  const base = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** "Today", "Yesterday", "Saturday 17 October", or "17 October 2025". */
export function longDate(iso, now = new Date()) {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (dayKey(d) === dayKey(now)) return 'Today'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday'
  if (d.getFullYear() === now.getFullYear()) return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** longDate for the middle of a sentence: "drawn today", "from Saturday 17 October". */
export function sentenceDate(iso, now = new Date()) {
  return longDate(iso, now).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase())
}

const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))

/** The seal whose photo is the card's face: the chosen one, else the latest photo. */
export function faceOf(seals) {
  const photos = seals.filter((s) => s.imageId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  return photos.find((s) => s.isFace) || photos[photos.length - 1] || null
}

/**
 * Her drawn cards, grouped by suit in deck order, newest drawing first.
 * Seals for cards that are no longer in the content are left out quietly.
 */
export function groupDrawn(seals, byId) {
  const perCard = new Map()
  for (const s of seals) {
    if (!byId.has(s.cardId)) continue
    if (!perCard.has(s.cardId)) perCard.set(s.cardId, [])
    perCard.get(s.cardId).push(s)
  }
  const entries = [...perCard.entries()].map(([cardId, list]) => {
    const sorted = list.slice().sort(byNewest)
    return { card: byId.get(cardId), seals: sorted, latest: sorted[0], face: faceOf(sorted) }
  })
  entries.sort((a, b) => byNewest(a.latest, b.latest))
  return DECK_SUITS.map((suit) => ({ suit, label: SUIT_LABELS[suit], entries: entries.filter((e) => suitOf(e.card) === suit) }))
    .filter((g) => g.entries.length)
}

const sortTitle = (card) => String(card.title || '').replace(/^(the|a|an)\s+/i, '').toLowerCase()
export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Does a card match every word she typed? Looks at the title, the noun and the phrases. */
export function matchesQuery(card, query) {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fold([card.title, card.a, card.of, ...(card.phrases || [])].join(' '))
  return words.every((w) => hay.includes(w))
}

/** Every card she hasn't drawn, by suit, alphabetical within a suit. */
export function restOfDeck(cards, drawnIds) {
  const drawn = drawnIds instanceof Set ? drawnIds : new Set(drawnIds)
  return DECK_SUITS.map((suit) => ({
    suit,
    label: SUIT_LABELS[suit],
    cards: cards.filter((c) => suitOf(c) === suit && !drawn.has(c.id)).sort((a, b) => sortTitle(a).localeCompare(sortTitle(b))),
  })).filter((g) => g.cards.length)
}

/** A gentle, stable tilt per card so the gallery looks laid by hand. */
export function tiltOf(id) {
  return ((hashString(`gallery:${id}`) % 240) / 100 - 1.2).toFixed(2)
}

// ---------------------------------------------------------------------------
// Small shared bits for the deck's pages

export function backLink(href = '#/deck', label = 'Your deck') {
  return h('a.deck-back', { href }, raw(ICONS.back), label)
}

function suitHeading(suit, label, tag = 'h2') {
  return h(`${tag}.suit-head.suit-${suit}`, h('span.suit-mark', raw(EMBLEMS[suit])), h('span', label))
}

/**
 * The sheets a page opens, so its cleanup can put them away: a sheet left
 * over the next page (Back on Android, say) would act on a page that's gone.
 */
export function pageSheets() {
  const open = new Set()
  return {
    track(close) {
      if (close) open.add(close)
      return close
    },
    confirm(opts) {
      const answer = confirmSheet(opts)
      // confirmSheet hands back no close; its sheet is the one it just added.
      const backdrop = document.body.lastElementChild
      if (backdrop?.classList.contains('sheet-backdrop')) {
        const close = () => backdrop.querySelector('.sheet-close')?.click()
        open.add(close)
        answer.finally(() => open.delete(close))
      }
      return answer
    },
    closeAll() {
      for (const close of [...open]) close()
      open.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// The view

export async function render(root) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '')
  let restOpen = params.has('rest')
  let restSuit = DECK_SUITS.includes(params.get('rest')) ? params.get('rest') : null
  let query = ''
  let disposed = false

  async function paint() {
    const groups = groupDrawn(state.seals, content.byId)
    const urls = new Map()
    await Promise.all(groups.flatMap((g) => g.entries).filter((e) => e.face).map(async (e) => {
      urls.set(e.card.id, await imageUrl(e.face.imageId, 'thumb'))
    }))
    if (disposed) return
    const drawnIds = new Set(groups.flatMap((g) => g.entries.map((e) => e.card.id)))
    mount(root, h('div.gallery',
      h('header.page-head',
        h('h1', 'Your deck'),
        groups.length ? h('p', 'Every card here is one you’ve drawn.') : null),
      groups.length ? h('div.gallery-suits', groups.map((g) => drawnSuit(g, urls))) : emptyDeck(),
      restSection(drawnIds),
      h('nav.gallery-links', { 'aria-label': 'More from your deck' },
        h('a.btn.btn-ghost', { href: '#/readings' }, raw(ICONS.book), 'Recent readings')),
    ))
  }

  function drawnSuit(group, urls) {
    return h('section.gallery-suit', { 'aria-label': group.label },
      suitHeading(group.suit, group.label),
      h('ul.gallery-grid', group.entries.map((e) => {
        const url = urls.get(e.card.id) || ''
        const shown = url ? e.face : e.latest
        const date = shortDate(shown.createdAt)
        const link = h('a.gallery-card', {
          href: `#/card/${encodeURIComponent(e.card.id)}`,
          'aria-label': `${e.card.title}, drawn ${sentenceDate(shown.createdAt)}`,
          onclick: () => saveRestState({ returnTo: e.card.id }),
        }, renderCard({ card: e.card, size: 'sm', imageUrl: url, dateText: date, drawn: !url, className: url ? 'sealed' : '' }))
        link.style.setProperty('--tilt', `${tiltOf(e.card.id)}deg`)
        return h('li', link)
      })),
    )
  }

  function emptyDeck() {
    return h('section.gallery-empty',
      h('div.gallery-empty-frame', { 'aria-hidden': 'true' }, renderCard({ card: { id: 'twist-waiting', title: '' }, size: 'sm' })),
      h('p.gallery-empty-note.hand', 'Your deck is waiting. When you finish a drawing, seal it into its card and it lives here.'),
      h('button.btn.btn-gilt.gallery-draw', { type: 'button', onclick: () => go('') }, 'Draw a card'),
    )
  }

  // ---- The rest of the deck -------------------------------------------------

  function restSection(drawnIds) {
    const groups = restOfDeck([...content.subjects, ...(content.themes || [])], drawnIds)
    if (!groups.length) {
      return h('section.rest', h('h2.rest-title', 'The rest of the deck'),
        h('p.rest-note.hand', 'Every card in the box is one you’ve drawn. Quite something.'))
    }
    const browserId = 'rest-browser'
    const stack = h('button.rest-stack', {
      type: 'button',
      'aria-expanded': String(restOpen),
      'aria-controls': browserId,
      'aria-label': restOpen ? 'Close the rest of the deck' : 'Open the rest of the deck',
      onclick: () => toggleRest(),
    }, [0, 1, 2].map((i) => renderCard({ size: 'sm', faceDown: true, card: { id: `twist-back-${i}`, title: '' }, backName: i === 2 ? state.settings.backName : '' })))
    const caption = h('p.rest-caption.hand', restOpen ? 'Spread out on the table.' : 'Still in the box. Have a rummage.')
    const browser = h('div.rest-browser', { id: browserId, hidden: !restOpen }, restOpen ? restBrowser(groups) : null)
    const section = h(`section.rest${restOpen ? '.is-open' : ''}`, h('h2.rest-title', 'The rest of the deck'), stack, caption, browser)

    function toggleRest() {
      restOpen = !restOpen
      section.classList.toggle('is-open', restOpen)
      stack.setAttribute('aria-expanded', String(restOpen))
      stack.setAttribute('aria-label', restOpen ? 'Close the rest of the deck' : 'Open the rest of the deck')
      caption.textContent = restOpen ? 'Spread out on the table.' : 'Still in the box. Have a rummage.'
      browser.hidden = !restOpen
      if (restOpen && !browser.firstChild) mount(browser, restBrowser(groups))
      saveRestState()
      if (restOpen) requestAnimationFrame(() => browser.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }))
    }
    return section
  }

  function restBrowser(groups) {
    if (!groups.some((g) => g.suit === restSuit)) restSuit = groups[0].suit
    const items = []
    const sections = groups.map((g) => {
      const list = h('ul.rest-grid', g.cards.map((card) => {
        const li = h('li', h('a.rest-card', {
          href: `#/card/${encodeURIComponent(card.id)}`,
          'aria-label': card.title,
          onclick: () => {
            // Come back to this card's suit, even if she found it by searching.
            restSuit = g.suit
            saveRestState({ returnTo: card.id })
          },
        }, renderCard({ card, size: 'xs' })))
        items.push({ li, card, suit: g.suit })
        return li
      }))
      const sec = h('section.rest-suit', { dataset: { suit: g.suit } }, suitHeading(g.suit, g.label, 'h3'), list)
      return { sec, suit: g.suit }
    })
    const none = h('p.rest-none', { hidden: true, role: 'status' }, 'Nothing by that name in the box. Try another word?')
    const chips = h('div.chips.rest-chips', { role: 'group', 'aria-label': 'Show a suit' },
      groups.map((g) => h('button.chip', {
        type: 'button',
        'aria-pressed': String(restSuit === g.suit),
        dataset: { suit: g.suit },
        onclick: () => {
          restSuit = g.suit
          query = ''
          search.value = ''
          apply()
          saveRestState()
        },
      }, g.label)),
    )
    const search = h('input.input.rest-search', {
      type: 'search',
      id: 'rest-search',
      placeholder: 'A hedgehog, a teapot, moss…',
      autocomplete: 'off',
      enterkeyhint: 'search',
      value: query,
      oninput: (e) => { query = e.target.value; apply() },
    })
    // Typing searches every suit; otherwise one suit at a time.
    function apply() {
      const searching = Boolean(query.trim())
      chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(!searching && c.dataset.suit === restSuit)))
      let shown = 0
      for (const it of items) {
        const visible = searching ? matchesQuery(it.card, query) : it.suit === restSuit
        it.li.hidden = !visible
        if (visible) shown += 1
      }
      for (const s of sections) s.sec.hidden = !s.sec.querySelector('li:not([hidden])')
      none.hidden = shown > 0
    }
    apply()
    return [
      h('div.rest-tools',
        h('label.rest-search-wrap', { for: 'rest-search' },
          h('span.sr-only', 'Find a card'), h('span.rest-search-icon', raw(ICONS.search)), search),
        chips),
      sections.map((s) => s.sec),
      none,
    ]
  }

  // Keep the stack open, the suit chosen and the card she tapped in this page's
  // history entry, so Back brings her to the same spot (and only Back does).
  function saveRestState(extra = {}) {
    const hash = restOpen ? `#/deck?rest${restSuit ? '=' + restSuit : ''}` : '#/deck'
    history.replaceState({ ...(history.state || {}), ...extra }, '', hash)
  }

  function returnToLastCard() {
    // She may have moved on while the deck was being laid out.
    if (!root.isConnected) return
    const id = history.state?.returnTo
    if (!id) return
    history.replaceState({ ...history.state, returnTo: null }, '', location.hash)
    const link = [...root.querySelectorAll('a.gallery-card, a.rest-card')].find((a) => a.getAttribute('href') === `#/card/${encodeURIComponent(id)}`)
    if (!link) return
    requestAnimationFrame(() => {
      link.scrollIntoView({ block: 'center' })
      link.focus({ preventScroll: true })
    })
  }

  await paint()
  returnToLastCard()
  const off = subscribe((what) => { if (what === 'seal' || what === 'reload') paint() })
  return () => {
    disposed = true
    off()
  }
}
