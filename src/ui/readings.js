// Recent readings: the last few things the deck suggested, to pick up again,
// reopen beside the paper, or let go.
import { h, raw, mount } from './h.js'
import { renderCard } from './card.js'
import { ICONS, pencilSvg } from './ornaments.js'
import { state, content, readingsByDate, saveReading, deleteReading, imageUrl, subscribe, pencilHex, pencilCatalogue } from '../store/state.js'
import { SPREADS } from '../engine/reading.js'
import { go } from './app.js'
import { toast } from './feedback.js'
import { longDate, backLink, pageSheets } from './deck.js'

export const RECENT_LIMIT = 20
// Readings she never started are only ideas: a few are handy, a long list of
// them would read like a to-do list.
export const UNSTARTED_LIMIT = 5
export const STATUS_LABELS = { dealt: 'Dealt', drawing: 'Drawing', drawn: 'Drawn', sealed: 'Sealed' }
const pencilByCode = new Map(pencilCatalogue.map((p) => [p.code, p]))

/** The newest readings first, at most `limit` of them. */
export function recentReadings(list, limit = RECENT_LIMIT) {
  return list.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit)
}

/**
 * What the page lists. Every drawing still in progress, however old, pinned
 * at the top (a started drawing must never become unreachable). Then, from
 * the newest readings, the ones she finished, and at most a few she never
 * started (the one on the table always stays), newest first.
 */
export function shownReadings(list, { currentId = null, limit = RECENT_LIMIT, unstarted = UNSTARTED_LIMIT } = {}) {
  const drawing = recentReadings(list.filter((r) => r.status === 'drawing'), Infinity)
  let ideas = 0
  const rest = recentReadings(list, limit).filter((r) => {
    if (r.status === 'drawing') return false
    // An unknown status (a very old reading, say) counts as never started.
    if ((r.status === 'drawn' || r.status === 'sealed') || r.id === currentId) return true
    ideas += 1
    return ideas <= unstarted
  })
  return [...drawing, ...rest]
}

export const canCarryOn = (r) => r.status === 'dealt' || r.status === 'drawing'
export const leadCardId = (r) => r.cards?.who || r.cards?.theme || null

/** A reading stays 'sealed' after its photo is removed; it is still drawn. */
export function statusOf(r, seals = []) {
  if (r.status === 'sealed' && !seals.some((s) => s.readingId === r.id && s.imageId)) return 'drawn'
  return STATUS_LABELS[r.status] ? r.status : 'dealt'
}

export async function render(root) {
  let disposed = false
  let busy = false
  const sheets = pageSheets()

  async function paint({ focus } = {}) {
    const list = shownReadings(readingsByDate(), { currentId: state.currentId })
    const photos = new Map()
    await Promise.all(list.map(async (r) => {
      const seal = state.seals.find((s) => s.readingId === r.id && s.imageId)
      if (seal) photos.set(r.id, await imageUrl(seal.imageId, 'thumb'))
    }))
    if (disposed) return
    mount(root, h('div.recent',
      backLink(),
      h('header.page-head',
        h('h1', { id: 'recent-head', tabindex: '-1' }, 'Recent readings'),
        list.length ? h('p', 'What the deck has suggested lately. Pick one up again, or let it go.') : null),
      list.length
        ? h('ol.recent-list', list.map((r) => entry(r, photos.get(r.id))))
        : h('div.recent-empty',
            h('p.hand', 'Nothing here yet. The deck is ready when you are.'),
            h('button.btn.btn-gilt', { type: 'button', onclick: () => go('') }, 'Draw a card')),
    ))
    if (focus) (root.querySelector(focus) || root.querySelector('#recent-head'))?.focus()
  }

  function entry(r, photo) {
    const cardId = leadCardId(r)
    const card = cardId && content.byId.get(cardId)
    const status = statusOf(r, state.seals)
    const onTable = r.id === state.currentId && canCarryOn(r)
    const titleId = `reading-${r.id}`
    const others = ['where', 'when', 'also', 'twist'].map((p) => r.cards?.[p] && content.byId.get(r.cards[p])?.title).filter(Boolean)
    return h(`li.recent-entry.paper.on-paper.status-${status}`, { id: `entry-${r.id}`, 'aria-labelledby': titleId },
      card
        ? h('a.recent-card', { href: `#/card/${encodeURIComponent(card.id)}`, 'aria-label': `Open ${card.title} in your deck` },
            renderCard({ card, size: 'xs', imageUrl: photo || '', className: photo ? 'sealed' : '' }))
        : h('div.recent-card'),
      h('div.recent-words',
        h('p.recent-meta',
          h('span.status-pill', STATUS_LABELS[status]),
          onTable ? h('span.on-table', 'On the table') : null,
          h('span.hand.recent-date', longDate(r.createdAt))),
        h('h2.recent-title', { id: titleId }, card?.title || 'A reading',
          SPREADS[r.spread] ? h('span.recent-spread', SPREADS[r.spread].label) : null),
        others.length ? h('p.recent-others', others.join(' · ')) : null,
        r.text?.sentence ? h('p.recent-sentence', r.text.sentence) : null,
        swatches(r),
        h('div.recent-actions', actionsFor(r)),
      ),
    )
  }

  // A reading she never started only goes back on the table to look at again
  // (it isn't started for her). One she started can carry on at the table or
  // go straight back to the drawing view.
  function actionsFor(r) {
    const remover = h('button.btn-text', { type: 'button', onclick: () => remove(r) }, 'Delete')
    if (r.status !== 'drawing' && r.status !== 'drawn' && r.status !== 'sealed') {
      return [h('button.btn-text.recent-look', { type: 'button', onclick: () => carryOn(r) }, raw(ICONS.eye), 'Look again'), remover]
    }
    return [
      canCarryOn(r) ? h('button.btn.btn-gilt.recent-carry', { type: 'button', onclick: () => carryOn(r) }, 'Carry on') : null,
      h('button.btn-text', { type: 'button', onclick: () => go(`draw/${r.id}`) }, raw(ICONS.pencil), 'Back to drawing'),
      remover,
    ]
  }

  function swatches(r) {
    const pencils = r.palette?.pencils || []
    if (!pencils.length) return null
    return h('ul.swatch-row', { 'aria-label': `Pencils: ${pencils.map((p) => pencilByCode.get(p.code)?.name || p.code).join(', ')}` },
      pencils.map((p) => {
        const name = pencilByCode.get(p.code)?.name || p.code
        return h('li', { 'aria-hidden': 'true' }, h('span.swatch-pic', raw(pencilSvg(pencilHex(p.code), { label: name }))), h('span', name))
      }))
  }

  async function carryOn(r) {
    if (busy) return
    busy = true
    try {
      // The freshest copy, in case it changed since the list was drawn.
      await saveReading(state.readings.get(r.id) || r, { makeCurrent: true })
      if (!disposed) go('')
    } finally {
      busy = false
    }
  }

  async function remove(r) {
    const card = content.byId.get(leadCardId(r))
    const seal = state.seals.find((s) => s.readingId === r.id && s.imageId) || state.seals.find((s) => s.readingId === r.id)
    const ok = await sheets.confirm({
      title: 'Delete this reading?',
      body: seal && card
        ? `It goes from this list. ${card.title} stays in your deck${seal.imageId ? ' with your drawing' : ''}.`
        : 'It goes from this list for good. The deck has plenty more ideas.',
      confirm: 'Delete it',
      cancel: 'Keep it',
      danger: true,
    })
    if (!ok || disposed) return
    const list = shownReadings(readingsByDate(), { currentId: state.currentId })
    const next = list[list.findIndex((x) => x.id === r.id) + 1]
    await deleteReading(r.id)
    toast('Deleted.')
    await paint({ focus: next ? `#entry-${CSS.escape(next.id)} .recent-actions button` : '#recent-head' })
  }

  await paint()
  const off = subscribe((what) => { if (what === 'reload') paint() })
  return () => {
    disposed = true
    off()
    sheets.closeAll()
  }
}
