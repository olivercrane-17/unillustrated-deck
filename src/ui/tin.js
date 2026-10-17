// Your Tin: tick the pencils she really owns, star favourites, and fix any
// swatch that looks off on her screen. The 153 rows are built once; a tick,
// a star or a colour fix updates only its own row.
import { h, raw, mount } from './h.js'
import { ICONS, pencilSvg } from './ornaments.js'
import { openSheet, confirmSheet, toast } from './feedback.js'
import {
  state, subscribe, saveTin, toggleOwned, toggleStar, setOverride, applyPreset, pencilHex, pencilCatalogue, pencilSets,
} from '../store/state.js'
import { hexToOklab } from '../engine/color.js'
import {
  groupPencils, matchesQuery, passesFilter, countLine, canDeal, setTicked, presetNeedsConfirm,
  variantNeedsAnswer, variantApplies, chooseVariant, ownedInOrder, toInputHex,
} from './tin-helpers.js'

const TRUTH = 'Screen colours are approximate. Your pencils are the truth.'
const FILTERS = [['all', 'All'], ['owned', 'In my tin'], ['starred', 'Starred']]
const PRINT_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 9 V 4 H 17 V 9" stroke-width="1.6"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.8" stroke-width="1.6"/><path d="M7 14 H 17 V 20 H 7 Z" stroke-width="1.6"/><path d="M9.5 17 H 14.5" stroke-width="1.2"/></svg>'

const byCode = new Map(pencilCatalogue.map((p) => [p.code, p]))
const GROUPS = groupPencils(pencilCatalogue, { lightness: (p) => hexToOklab(p.hex).L })
const PRESETS = Object.keys(pencilSets).sort((a, b) => Number(a) - Number(b))
const VARIANTS = Object.entries(pencilSets).flatMap(([setKey, set]) => (set.variants || []).map((variant) => ({ setKey, variant })))

const boxName = (key) => `the box of ${key}`

// A strip of the family's colours under each group heading, like the tops
// of the pencils in an open tin.
function ribbon(pencils) {
  const step = 100 / pencils.length
  return `linear-gradient(90deg, ${pencils.map((p, i) => `${p.hex} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ')})`
}

export function render(root) {
  root.classList.add('tin')
  let query = ''
  let filter = 'all'
  let changing = null // id of a variant question she has reopened
  let closeSheet = null
  const rows = new Map() // code -> { li, check, star, swatch, adjusted, owned, starred, hex }
  const groups = [] // { key, label, pencils, section, tickBtn, untickBtn }
  const groupOf = new Map() // code -> group
  let synced = null // the tin object the page last showed, so the store's echo is skipped

  // ---------------------------------------------------------------------------
  // Rows

  function buildRow(p) {
    const check = h('input.tin-check', { type: 'checkbox', dataset: { code: p.code } })
    const swatch = h('span.tin-swatch', { 'aria-hidden': 'true' })
    const adjusted = h('span.tin-adjusted', { hidden: true }, 'your shade')
    const li = h('li.tin-row',
      h('label.tin-label',
        check,
        swatch,
        h('span.tin-name',
          h('code', p.code),
          h('strong', p.name, p.discontinued ? h('span.tin-retired', ' (retired)') : null),
          p.special === 'blender' ? h('em.tin-blender', 'Never dealt as a colour. It only turns up in tips.') : null,
          adjusted,
        ),
      ),
      h('button.mini-btn.tin-star', { type: 'button', 'aria-label': `Star ${p.name}`, dataset: { act: 'star', code: p.code } }),
      h('button.btn-text.tin-off', { type: 'button', dataset: { act: 'off', code: p.code } }, 'Looks off?', h('span.sr-only', ` ${p.name}`)),
    )
    rows.set(p.code, { li, check, star: li.querySelector('.tin-star'), swatch, adjusted, owned: null, starred: null, hex: null })
    return li
  }

  function paintRow(code, owned, starred) {
    const r = rows.get(code)
    const isOwned = owned.has(code)
    if (r.owned !== isOwned) {
      r.owned = isOwned
      r.check.checked = isOwned
      r.li.classList.toggle('is-owned', isOwned)
    }
    const isStar = starred.has(code)
    if (r.starred !== isStar) {
      r.starred = isStar
      r.star.setAttribute('aria-pressed', String(isStar))
      r.star.innerHTML = isStar ? ICONS.starFilled : ICONS.star
    }
    const hex = hexOf(code)
    if (r.hex !== hex) {
      r.hex = hex
      r.swatch.innerHTML = pencilSvg(hex)
      r.adjusted.hidden = !state.tin.overrides?.[code]
    }
  }

  // pencilHex() without its catalogue search, since this runs for every row.
  const hexOf = (code) => state.tin.overrides?.[code] || byCode.get(code)?.hex || pencilHex(code)
  const ownedSet = () => new Set(state.tin.owned)
  const starredSet = () => new Set(state.tin.starred)
  const paintOne = (code) => paintRow(code, ownedSet(), starredSet())

  // ---------------------------------------------------------------------------
  // Groups

  function buildGroup(g) {
    const id = `tin-g-${g.key}`
    const tickBtn = h('button.btn-text', { type: 'button', dataset: { act: 'tick', group: g.key } }, 'Tick all', h('span.sr-only', ` ${g.label}`))
    const untickBtn = h('button.btn-text', { type: 'button', dataset: { act: 'untick', group: g.key } }, 'Untick all', h('span.sr-only', ` ${g.label}`))
    const rowsTall = { '--rows': String(g.pencils.length), '--rows-2': String(Math.ceil(g.pencils.length / 2)) }
    const section = h('section.tin-group.paper.on-paper', { 'aria-labelledby': id, style: rowsTall },
      h('div.tin-group-head', h('h2', { id }, g.label), h('div.tin-group-actions', tickBtn, untickBtn)),
      h('div.tin-ribbon', { 'aria-hidden': 'true', style: { backgroundImage: ribbon(g.pencils) } }),
      h('ul.tin-rows', g.pencils.map(buildRow)),
    )
    const group = { ...g, section, tickBtn, untickBtn }
    groups.push(group)
    for (const p of g.pencils) groupOf.set(p.code, group)
    return section
  }

  const visibleCodes = (g) => g.pencils.filter((p) => !rows.get(p.code).li.hidden).map((p) => p.code)

  function paintGroupActions(owned, only = groups) {
    for (const g of only) {
      const codes = visibleCodes(g)
      g.tickBtn.setAttribute('aria-disabled', String(codes.every((c) => owned.has(c))))
      g.untickBtn.setAttribute('aria-disabled', String(!codes.some((c) => owned.has(c))))
    }
  }

  function tickGroup(key, on) {
    const g = groups.find((x) => x.key === key)
    const codes = visibleCodes(g)
    const owned = ownedSet()
    if (codes.every((c) => owned.has(c) === on)) return
    saveTin({ owned: setTicked(state.tin.owned, codes, on), preset: 'custom' })
    syncAll()
  }

  // ---------------------------------------------------------------------------
  // Search and filter. Applied on demand rather than on every tick, so a row
  // she has just unticked under "In my tin" doesn't vanish from under her.

  function applyFilter() {
    const owned = ownedSet()
    const starred = starredSet()
    let shownTotal = 0
    for (const g of groups) {
      let shown = 0
      for (const p of g.pencils) {
        const visible = matchesQuery(p, query) && passesFilter(p.code, filter, { owned, starred })
        const li = rows.get(p.code).li
        if (li.hidden === visible) li.hidden = !visible
        if (visible) shown += 1
      }
      g.section.hidden = !shown
      shownTotal += shown
    }
    noMatch.hidden = shownTotal > 0
    if (!shownTotal) noMatch.textContent = noMatchText()
    paintGroupActions(owned)
  }

  function noMatchText() {
    if (query.trim()) return `No pencil answers to “${query.trim()}”. Try a code, like 937, or part of a name.`
    if (filter === 'starred') return 'No stars yet. Tap the star by a pencil you love and it will wait for you here.'
    return 'Your tin is empty for now. Pick a box above, or tick pencils under All.'
  }

  // ---------------------------------------------------------------------------
  // Presets

  const presetButtons = new Map()

  function buildPresets() {
    const keys = [...PRESETS, 'none']
    return h('div.chips.tin-presets', { role: 'group', 'aria-labelledby': 'tin-box-label' },
      keys.map((key) => {
        const btn = h('button.chip', { type: 'button', onclick: () => choosePreset(key) }, key === 'none' ? 'Start empty' : pencilSets[key].label)
        presetButtons.set(key, btn)
        return btn
      }),
    )
  }

  function paintPresets() {
    for (const [key, btn] of presetButtons) btn.setAttribute('aria-pressed', String(key === state.tin.preset))
    const p = state.tin.preset
    presetNote.textContent = pencilSets[p]
      ? `Started from ${boxName(p)}. Untick anything that has wandered off.`
      : p === 'none' ? 'Started from an empty tin. Tick as you go.' : 'Your own mix, ticked by hand.'
  }

  async function choosePreset(key) {
    if (key === state.tin.preset) return
    if (presetNeedsConfirm(state.tin, key)) {
      const ok = await confirmSheet(key === 'none'
        ? { title: 'Empty the tin?', body: 'This unticks every pencil, so you can start from nothing. Your stars and colour fixes stay put.', confirm: 'Empty it', cancel: 'Keep my tin' }
        : { title: `Start again from ${boxName(key)}?`, body: `Your hand-ticked tin will be swapped for ${boxName(key)}. Your stars and colour fixes stay put.`, confirm: `Use ${boxName(key)}`, cancel: 'Keep my tin' })
      if (!ok) return
    }
    const saving = [applyPreset(key)]
    // She has already told us which purple is in this box: keep her answer.
    for (const { setKey, variant } of VARIANTS) {
      const answer = state.tin.variantAnswers?.[variant.id]
      if (setKey === key && answer) saving.push(saveTin({ owned: chooseVariant(state.tin.owned, variant, answer) }))
    }
    syncAll()
    applyFilter()
    await Promise.all(saving)
  }

  // ---------------------------------------------------------------------------
  // The "which purple?" question

  let variantSig = ''

  function paintVariants() {
    const parts = VARIANTS.map(({ setKey, variant }) => {
      const answer = state.tin.variantAnswers?.[variant.id] || ''
      const mode = changing === variant.id || variantNeedsAnswer(state.tin, variant, setKey) ? 'ask'
        : answer && variantApplies(state.tin, variant, setKey) ? 'answered' : 'none'
      return { variant, answer, mode }
    })
    const sig = parts.map((p) => `${p.variant.id}:${p.mode}:${p.answer}`).join('|')
    if (sig === variantSig) return
    variantSig = sig
    mount(variantHost, parts.map((p) => (p.mode === 'ask' ? questionCard(p.variant, p.answer) : p.mode === 'answered' ? answerLine(p.variant, p.answer) : null)))
  }

  function questionCard(variant, answer) {
    const id = `tin-q-${variant.id}`
    return h('section.tin-question.paper.on-paper', { 'aria-labelledby': id },
      h('p.tin-q-kicker', 'One quick question'),
      h('h2', { id }, variant.question),
      h('p.tin-q-note', variant.note),
      h('div.tin-q-options', { role: 'group', 'aria-labelledby': id },
        variant.options.map((code) => {
          const p = byCode.get(code) || { code, name: code }
          return h('button.tin-q-option', { type: 'button', 'aria-pressed': answer ? String(answer === code) : undefined, onclick: () => answerVariant(variant, code) },
            h('span.tin-q-swatch', { 'aria-hidden': 'true' }, raw(pencilSvg(pencilHex(code), { big: true }))),
            h('span.tin-q-name', h('code', code), h('strong', p.name), p.discontinued ? [' ', h('em', '(retired)')] : null),
            answer === code ? h('span.tin-q-tick', { 'aria-hidden': 'true' }, raw(ICONS.tick)) : null,
          )
        }),
      ),
      answer ? h('button.btn-text.tin-q-keep', { type: 'button', onclick: () => { changing = null; paintVariants(); focusAnswer(variant) } }, 'Keep it as it is') : null,
    )
  }

  function answerLine(variant, code) {
    const p = byCode.get(code) || { name: code }
    return h('p.tin-answer', { tabindex: '-1', dataset: { variant: variant.id } },
      h('span', `Your ${variant.id}: `, h('strong', p.name), ` (${code}).`),
      h('button.btn-text', { type: 'button', onclick: () => reopen(variant) }, 'Change', h('span.sr-only', ` your ${variant.id}`)),
    )
  }

  function reopen(variant) {
    changing = variant.id
    paintVariants()
    variantHost.querySelector('.tin-q-option[aria-pressed="true"], .tin-q-option')?.focus()
  }

  function focusAnswer(variant) {
    variantHost.querySelector(`.tin-answer[data-variant="${variant.id}"]`)?.focus()
  }

  function answerVariant(variant, code) {
    changing = null
    const saving = saveTin({ owned: chooseVariant(state.tin.owned, variant, code), variantAnswers: { ...state.tin.variantAnswers, [variant.id]: code } })
    syncAll()
    applyFilter()
    focusAnswer(variant)
    return saving
  }

  // ---------------------------------------------------------------------------
  // "Looks off?": correct a swatch by eye

  function openLooksOff(code) {
    const p = byCode.get(code)
    if (!p) return
    let picked = toInputHex(pencilHex(code))
    const chip = (hex) => h('span.lo-chip', { style: { backgroundColor: hex } })
    closeSheet = openSheet((close) => {
      const yoursChip = chip(picked)
      const yoursPencil = h('span.lo-pencil', raw(pencilSvg(picked, { big: true })))
      const yoursHex = h('span.lo-hex', picked.toUpperCase())
      const input = h('input.lo-input', { type: 'color', value: picked, id: 'lo-colour' })
      input.addEventListener('input', () => {
        picked = input.value
        yoursChip.style.backgroundColor = picked
        yoursPencil.innerHTML = pencilSvg(picked, { big: true })
        yoursHex.textContent = picked.toUpperCase()
      })
      const save = () => {
        const same = picked.toLowerCase() === p.hex.toLowerCase()
        setOverride(code, same ? null : picked)
        paintOne(code)
        close()
        toast(same ? `${p.name} is back to the original.` : `Saved. ${p.name} will look like that from now on.`)
      }
      const reset = () => {
        const had = Boolean(state.tin.overrides?.[code])
        setOverride(code, null)
        paintOne(code)
        close()
        if (had) toast(`${p.name} is back to the original.`)
      }
      return h('div.looks-off',
        h('h2', 'Looks off?'),
        h('p.lo-which', h('code', p.code), ' ', h('strong', p.name), p.discontinued ? h('span.tin-retired', ' (retired)') : null),
        h('p.lo-how', 'Swatch it on your paper, then nudge this colour until the screen looks more like the real thing.'),
        h('div.lo-compare',
          h('figure.lo-side', chip(p.hex), h('span.lo-pencil', raw(pencilSvg(p.hex, { big: true }))),
            h('figcaption', h('span.lo-cap', 'The original'), h('span.lo-hex', p.hex.toUpperCase()))),
          h('figure.lo-side', yoursChip, yoursPencil, h('figcaption', h('span.lo-cap', 'Yours'), yoursHex)),
        ),
        h('label.lo-field', { for: 'lo-colour' }, h('span.lo-label', 'Pick your colour'), input),
        h('div.lo-actions',
          h('button.btn.btn-gilt', { type: 'button', onclick: save }, 'Save'),
          h('button.btn-text', { type: 'button', onclick: reset }, 'Back to the original'),
        ),
        h('p.lo-truth', TRUTH),
      )
    }, { label: `Looks off? ${p.name}`, className: 'looks-off-sheet', onClose: () => { closeSheet = null } })
  }

  // ---------------------------------------------------------------------------
  // The printable swatch chart (shown only by @media print)

  const printEl = h('div.tin-print', { 'aria-hidden': 'true' })

  function buildPrintSheet() {
    const owned = ownedInOrder(GROUPS, state.tin.owned)
    const n = owned.reduce((sum, g) => sum + g.pencils.length, 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const from = state.settings.backName ? `From the tin of ${state.settings.backName}` : 'From your tin'
    mount(printEl,
      h('header.tp-head',
        h('h1', 'A swatch chart'),
        h('p.tp-meta', `${from} · ${countLine(n).replace(/ in your tin$/, '')} · ${date}`),
        h('p.tp-how', 'Swatch each pencil in its box on your own paper. Then hold the page up to the screen and fix any colour that looks off. Your pencils are the truth.'),
      ),
      n
        ? h('div.tp-grid', owned.map((g) => [
            h('h2.tp-family', g.label),
            g.pencils.map((p) => h('div.tp-cell', h('div.tp-box'), h('p.tp-label', h('strong', p.code), ' ', p.name))),
          ]))
        : h('p.tp-empty', 'Your tin is empty, so there is nothing to swatch yet.'),
    )
  }

  function printChart() {
    buildPrintSheet()
    window.print()
  }

  // ---------------------------------------------------------------------------
  // Summary: the count, the gentle notes, presets and the question

  function updateSummary() {
    const n = state.tin.owned.filter((c) => byCode.has(c)).length
    const text = countLine(n)
    if (countEl.textContent !== text) countEl.textContent = text
    const ok = canDeal(state.tin.owned, pencilCatalogue)
    emptyNote.hidden = ok
    if (!ok) emptyNote.textContent = n
      ? 'The blender is lovely, but it isn’t a colour. Tick one more pencil and the deck can deal again.'
      : 'The deck needs at least one pencil to deal. Tick one or two whenever you’re ready.'
    paintPresets()
    paintVariants()
  }

  function syncAll() {
    synced = state.tin
    const owned = ownedSet()
    const starred = starredSet()
    for (const code of rows.keys()) paintRow(code, owned, starred)
    paintGroupActions(owned)
    updateSummary()
  }

  // ---------------------------------------------------------------------------
  // Build the page

  const variantHost = h('div.tin-variants')
  const presetNote = h('p.tin-preset-note.hand')
  const countEl = h('p.tin-count')
  const emptyNote = h('p.tin-empty', { hidden: true })
  const noMatch = h('p.empty-note.tin-nomatch', { hidden: true })

  const search = h('input.input.tin-search-input', {
    type: 'search', placeholder: 'Search by name or code', 'aria-label': 'Search pencils by name or code',
    autocomplete: 'off', enterkeyhint: 'search',
  })
  search.spellcheck = false
  search.addEventListener('input', () => { query = search.value; applyFilter() })

  const filterChips = h('div.chips.tin-filters', { role: 'group', 'aria-label': 'Show' },
    FILTERS.map(([key, label]) => h('button.chip', { type: 'button', 'aria-pressed': String(key === filter), dataset: { filter: key } }, label)),
  )
  filterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]')
    if (!chip) return
    filter = chip.dataset.filter
    filterChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
    applyFilter()
  })

  const list = h('div.tin-groups', GROUPS.map(buildGroup))
  list.addEventListener('change', (e) => {
    const box = e.target.closest('.tin-check')
    if (!box) return
    const code = box.dataset.code
    if (state.tin.owned.includes(code) !== box.checked) toggleOwned(code)
    // Only this row and its family's buttons change; the rest stay as they are.
    synced = state.tin
    const owned = ownedSet()
    paintRow(code, owned, starredSet())
    paintGroupActions(owned, [groupOf.get(code)])
    updateSummary()
  })
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]')
    if (!btn) return
    const { act, code, group } = btn.dataset
    if (act === 'star') { toggleStar(code); synced = state.tin; paintOne(code) }
    else if (act === 'off') openLooksOff(code)
    else if (act === 'tick' || act === 'untick') tickGroup(group, act === 'tick')
  })

  mount(root,
    h('header.page-head.tin-page-head',
      h('h1', 'Your tin'),
      h('p', 'Tick what’s really in your tin.'),
    ),
    variantHost,
    h('section.tin-start', { 'aria-labelledby': 'tin-box-label' },
      h('h2.tin-label-small', { id: 'tin-box-label' }, 'Start from a box'),
      buildPresets(),
      presetNote,
    ),
    h('div.tin-summary', { 'aria-live': 'polite' }, countEl, h('p.tin-truth', TRUTH), emptyNote),
    h('div.tin-toolbar',
      h('label.tin-search', h('span.tin-search-icon', raw(ICONS.search)), search),
      filterChips,
    ),
    list,
    noMatch,
    h('section.tin-print-cta',
      h('h2.tin-label-small', 'Check them by eye'),
      h('p', 'A page of empty boxes, one for each pencil in your tin. Swatch them on your own paper, then fix any that look off here.'),
      h('button.btn.btn-paper', { type: 'button', onclick: printChart }, raw(PRINT_ICON), 'Print a swatch chart'),
    ),
  )

  document.body.appendChild(printEl)
  document.body.classList.add('has-tin-print')
  window.addEventListener('beforeprint', buildPrintSheet)

  syncAll()
  applyFilter()

  const off = subscribe((what) => {
    if (what === 'tin' && state.tin !== synced) syncAll()
    if (what === 'reload') { syncAll(); applyFilter() }
  })

  return () => {
    off()
    closeSheet?.()
    window.removeEventListener('beforeprint', buildPrintSheet)
    printEl.remove()
    document.body.classList.remove('has-tin-print')
  }
}
