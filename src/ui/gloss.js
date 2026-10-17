// Technique words get a tap-for-meaning gloss.
import { h } from './h.js'
import { content } from '../store/state.js'

let openPop = null

function closePop() {
  openPop?.owner?.setAttribute('aria-expanded', 'false')
  openPop?.remove()
  openPop = null
}

function showGloss(btn, term, meaning) {
  const wasOpen = openPop?.dataset.term === term
  closePop()
  if (wasOpen) return
  const pop = h('span.gloss-pop', { role: 'note', dataset: { term } }, h('strong', term), ' ', meaning)
  // Show the meaning under the whole sentence, not in the middle of it.
  const block = btn.closest('li, p') || btn.parentElement
  block.appendChild(pop)
  btn.setAttribute('aria-expanded', 'true')
  openPop = pop
  openPop.owner = btn
}

document.addEventListener('click', (e) => {
  if (openPop && !e.target.closest('.gloss, .gloss-pop')) closePop()
})

// Turn a plain sentence into nodes with glossary terms as buttons.
export function glossify(text) {
  const glossary = content.tips?.glossary || {}
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length)
  if (!terms.length) return [text]
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`\\b(${escaped.join('|')})(s|ed|ing|es)?\\b`, 'gi')
  const out = []
  let last = 0
  const used = new Set()
  for (const m of text.matchAll(re)) {
    const term = terms.find((t) => t.toLowerCase() === m[1].toLowerCase())
    if (!term || used.has(term)) continue
    used.add(term)
    out.push(text.slice(last, m.index))
    const btn = h('button.gloss', { type: 'button', 'aria-expanded': 'false', title: 'What does this mean?' }, m[0])
    btn.addEventListener('click', (e) => { e.stopPropagation(); showGloss(btn, term, glossary[term]) })
    out.push(btn)
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out
}
