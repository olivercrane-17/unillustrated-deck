// Recent readings: the last few things the deck suggested, to pick up again,
// reopen beside the paper, or let go.
import { h, raw, mount } from './h.js'
import { renderCard } from './card.js'
import { ICONS, pencilSvg } from './ornaments.js'
import { state, content, readingsByDate, saveReading, deleteReading, imageUrl, subscribe, pencilHex, pencilCatalogue } from '../store/state.js'
import { SPREADS } from '../engine/reading.js'
import { go } from './app.js'
import { confirmSheet, toast } from './feedback.js'
import { longDate, backLink } from './deck.js'

export const RECENT_LIMIT = 20
export const STATUS_LABELS = { dealt: 'Dealt', drawing: 'Drawing', drawn: 'Drawn', sealed: 'Sealed' }
const pencilByCode = new Map(pencilCatalogue.map((p) => [p.code, p]))

/** The newest readings first, at most `limit` of them. */
export function recentReadings(list, limit = RECENT_LIMIT) {
  return list.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit)
}

export const canCarryOn = (r) => r.status === 'dealt' || r.status === 'drawing'
export const leadCardId = (r) => r.cards?.who || r.cards?.theme || null

export async function render(root) {
  let disposed = false

  async function paint({ focus } = {}) {
    const list = recentReadings(readingsByDate())
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
    const status = STATUS_LABELS[r.status] || 'Dealt'
    const onTable = r.id === state.currentId && canCarryOn(r)
    const titleId = `reading-${r.id}`
    const others = ['where', 'when', 'also', 'twist'].map((p) => r.cards?.[p] && content.byId.get(r.cards[p])?.title).filter(Boolean)
    return h(`li.recent-entry.paper.on-paper.status-${r.status || 'dealt'}`, { id: `entry-${r.id}`, 'aria-labelledby': titleId },
      card
        ? h('a.recent-card', { href: `#/card/${encodeURIComponent(card.id)}`, 'aria-label': `Open ${card.title} in your deck` },
            renderCard({ card, size: 'xs', imageUrl: photo || '', className: photo ? 'sealed' : '' }))
        : h('div.recent-card'),
      h('div.recent-words',
        h('p.recent-meta',
          h('span.status-pill', status),
          onTable ? h('span.on-table', 'On the table') : null,
          h('span.hand.recent-date', longDate(r.createdAt))),
        h('h2.recent-title', { id: titleId }, card?.title || 'A reading',
          SPREADS[r.spread] ? h('span.recent-spread', SPREADS[r.spread].label) : null),
        others.length ? h('p.recent-others', others.join(' · ')) : null,
        r.text?.sentence ? h('p.recent-sentence', r.text.sentence) : null,
        swatches(r),
        h('div.recent-actions',
          canCarryOn(r) ? h('button.btn.btn-gilt.recent-carry', { type: 'button', onclick: () => carryOn(r) }, 'Carry on') : null,
          h('button.btn-text', { type: 'button', onclick: () => go(`draw/${r.id}`) }, raw(ICONS.eye), 'Open drawing view'),
          h('button.btn-text', { type: 'button', onclick: () => remove(r) }, 'Delete'),
        ),
      ),
    )
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
    await saveReading(r, { makeCurrent: true })
    go('')
  }

  async function remove(r) {
    const card = content.byId.get(leadCardId(r))
    const sealed = r.status === 'sealed' || r.status === 'drawn'
    const ok = await confirmSheet({
      title: 'Delete this reading?',
      body: sealed && card
        ? `It goes from this list. ${card.title} stays in your deck with your drawing.`
        : 'It goes from this list for good. The deck has plenty more ideas.',
      confirm: 'Delete it',
      cancel: 'Keep it',
      danger: true,
    })
    if (!ok) return
    const list = recentReadings(readingsByDate())
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
  }
}
