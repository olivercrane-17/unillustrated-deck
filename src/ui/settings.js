// Settings: how the deck deals, small comforts, keeping the deck safe, and a
// little about it. Route #/settings.
import { h, raw, mount, uid } from './h.js'
import { renderCard } from './card.js'
import { ICONS, FLOURISH } from './ornaments.js'
import { toast, openSheet } from './feedback.js'
import { riffle } from './sound.js'
import { state, setSetting, subscribe, requestPersistence } from '../store/state.js'
import { detectHemisphere, seasonFor } from '../engine/seasons.js'
import { exportBackup, readBackup, importBackup, BackupError } from '../store/backup.js'
import pkg from '../../package.json'

const NAME_MAX = 24
const NAME_DEBOUNCE = 450
const SOURCE_URL = 'https://github.com/olivercrane-17/unillustrated-deck'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const listJoin = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export function friendlyDate(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return longDate.format(d)
}

// ---------------------------------------------------------------------------
// Rows

function copyBlock(titleId, title, hint) {
  return h('span.row-copy',
    h('span.row-title', { id: titleId }, title),
    hint ? h('span.row-hint', { id: `${titleId}-hint` }, hint) : null,
  )
}

// A whole-row switch. `onToggle(input)` runs inside the tap itself, which
// matters for permission prompts.
function switchRow({ title, hint, checked, onToggle }) {
  const tid = uid('st')
  const input = h('input.switch', { type: 'checkbox', role: 'switch', 'aria-labelledby': tid, 'aria-describedby': hint ? `${tid}-hint ${tid}-note` : `${tid}-note` })
  const note = h('span.row-note', { id: `${tid}-note`, role: 'status', 'aria-live': 'polite' })
  input.addEventListener('click', () => onToggle(input))
  const row = h('label.toggle-row.setting-row', copyBlock(tid, title, hint), input)
  row.querySelector('.row-copy').appendChild(note)
  const say = (text = '') => { note.textContent = text }
  return { el: row, input, say, sync: () => { input.checked = Boolean(checked()) } }
}

// A small set of chips, one pressed.
function choiceRow({ title, hint, options, value, onPick }) {
  const tid = uid('ch')
  const chips = options.map((o) => h('button.chip', { type: 'button', onclick: () => { onPick(o.value); sync() } },
    h('span.chip-label', o.swatch ? h(`span.chip-swatch.${o.swatch}`, { 'aria-hidden': 'true' }) : null, o.label),
    o.small ? h('small', o.small) : null,
  ))
  const sync = () => chips.forEach((c, i) => c.setAttribute('aria-pressed', String(options[i].value === value())))
  const el = h('div.choice-row.setting-row',
    copyBlock(tid, title, hint),
    h('div.chips.seg', { role: 'group', 'aria-labelledby': tid }, chips),
  )
  return { el, sync }
}

function panel(title, intro, ...children) {
  const id = uid('pn')
  return h('section.paper.settings-panel', { 'aria-labelledby': id },
    h('h2', { id }, title),
    h('span.panel-flourish', raw(FLOURISH)),
    intro ? h('p.panel-intro', intro) : null,
    children,
  )
}

// ---------------------------------------------------------------------------
// The deck

function nameRow(cleanups) {
  const id = uid('nm')
  const input = h('input.input', { id, type: 'text', maxlength: NAME_MAX, autocomplete: 'off', autocapitalize: 'words', placeholder: 'Your name, or the cat’s', 'aria-describedby': `${id}-hint` })
  input.spellcheck = false
  input.value = state.settings.backName || ''
  const preview = h('div.back-preview', { 'aria-hidden': 'true' })
  const paint = (name) => mount(preview, renderCard({ card: { id: 'twist-back', title: '' }, size: 'sm', faceDown: true, backName: name, tilt: 3 }))
  let timer = null
  const save = () => {
    clearTimeout(timer)
    timer = null
    const name = input.value.trim().slice(0, NAME_MAX)
    if (name !== state.settings.backName) setSetting('backName', name)
  }
  input.addEventListener('input', () => {
    paint(input.value.trim())
    clearTimeout(timer)
    timer = setTimeout(save, NAME_DEBOUNCE)
  })
  input.addEventListener('change', save)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { save(); input.blur() } })
  cleanups.push(() => { if (timer) save() })
  paint(input.value)
  const el = h('div.name-row.setting-row',
    h('div.name-field',
      h('label.row-title', { for: id }, 'Name on the back of the cards'),
      input,
      h('span.row-hint', { id: `${id}-hint` }, 'Up to 24 letters, in the little gilt band. Leave it empty for a plain back.'),
    ),
    preview,
  )
  return {
    el,
    sync: () => {
      if (document.activeElement === input || timer) return
      input.value = state.settings.backName || ''
      paint(input.value)
    },
  }
}

function deckPanel(cleanups) {
  const today = new Date()
  const detected = detectHemisphere()
  const word = (hemi) => (hemi === 'south' ? 'southern' : 'northern')
  const month = today.toLocaleString('en-GB', { month: 'long' })

  const seasons = switchRow({
    title: 'Follow the real seasons',
    hint: 'Conkers in autumn, frost in winter, never snow in July. Turn it off and every season is fair game.',
    checked: () => state.settings.followSeasons,
    onToggle: (input) => setSetting('followSeasons', input.checked),
  })
  const hemisphere = choiceRow({
    title: 'Hemisphere',
    hint: `Auto goes by your time zone, which says ${word(detected)}, so ${month} counts as ${seasonFor(today, detected)}.`,
    options: [
      { value: 'auto', label: 'Auto', small: cap(word(detected)) },
      { value: 'north', label: 'Northern', small: `${seasonFor(today, 'north')} now` },
      { value: 'south', label: 'Southern', small: `${seasonFor(today, 'south')} now` },
    ],
    value: () => state.settings.hemisphere,
    onPick: (v) => setSetting('hemisphere', v),
  })
  const small = choiceRow({
    title: 'A page of small things',
    hint: 'How many little pictures that spread asks for.',
    options: [
      { value: 4, label: '4 pictures', small: 'a calm page' },
      { value: 6, label: '6 pictures', small: 'a busy one' },
    ],
    value: () => state.settings.smallCount,
    onPick: (v) => setSetting('smallCount', v),
  })
  const quick = switchRow({
    title: 'Always use the quick deal',
    hint: 'Skip the long riffle and deal straight away. The deck speeds up by itself after a few goes anyway.',
    checked: () => state.settings.quickDeal,
    onToggle: (input) => setSetting('quickDeal', input.checked),
  })
  const name = nameRow(cleanups)
  const rows = [seasons, hemisphere, small, quick, name]
  return { el: panel('The deck', null, rows.map((r) => r.el)), sync: () => rows.forEach((r) => r.sync()) }
}

// ---------------------------------------------------------------------------
// Comfort

// Wait briefly for a real motion reading; desktops have the API but no sensor.
function probeMotion(ms = 1500) {
  return new Promise((resolve) => {
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      clearTimeout(timer)
      window.removeEventListener('devicemotion', onMotion)
      resolve(ok)
    }
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration
      if (a && [a.x, a.y, a.z].some((v) => typeof v === 'number')) finish(true)
    }
    window.addEventListener('devicemotion', onMotion)
    const timer = setTimeout(() => finish(false), ms)
  })
}

function shakeRow() {
  const row = switchRow({
    title: 'Shake to shuffle',
    hint: 'Give the phone a little shake to ask the deck again. Tapping still works too.',
    checked: () => state.settings.shake,
    onToggle: (input) => {
      if (!input.checked) {
        setSetting('shake', false)
        row.say('')
        return
      }
      const Motion = window.DeviceMotionEvent
      if (!Motion) {
        input.checked = false
        row.say('This device has no motion sensor the browser can use, so shake stays off. Tapping works just as well.')
        return
      }
      // iOS only allows this question from the tap itself, so ask before any await.
      let asking
      try {
        asking = typeof Motion.requestPermission === 'function' ? Motion.requestPermission() : Promise.resolve('granted')
      } catch (e) {
        asking = Promise.reject(e)
      }
      input.disabled = true
      row.say('Checking for a motion sensor…')
      Promise.resolve(asking)
        .then((answer) => (answer === 'granted' ? probeMotion().then((ok) => (ok ? 'on' : 'no-sensor')) : 'denied'))
        .catch(() => 'error')
        .then((result) => {
          input.disabled = false
          const on = result === 'on'
          input.checked = on
          if (on !== state.settings.shake) setSetting('shake', on)
          row.say({
            on: 'Shake is on. A firm little shake will do; no need to throw the phone.',
            'no-sensor': 'This device doesn’t seem to have a motion sensor, so shake stays off. Tapping works just as well.',
            denied: 'Your phone said no to motion, so shake stays off. The Draw a card button does the same job.',
            error: 'The phone didn’t let the deck ask about motion just now, so shake stays off. You could try the switch again.',
          }[result])
        })
    },
  })
  return row
}

function comfortPanel() {
  const systemCalm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const sound = switchRow({
    title: 'Sound',
    hint: 'Soft paper and pencil sounds, made on the spot. Quiet, and only if you want them.',
    checked: () => state.settings.sound,
    onToggle: (input) => {
      setSetting('sound', input.checked)
      if (input.checked) riffle()
    },
  })
  const shake = shakeRow()
  const motion = switchRow({
    title: 'Reduce motion',
    hint: systemCalm
      ? 'Your device already asks for less motion, so the deck keeps still either way.'
      : 'Deal without the shuffle and the flips. Cards simply appear.',
    checked: () => state.settings.motion === 'reduced',
    onToggle: (input) => setSetting('motion', input.checked ? 'reduced' : 'auto'),
  })
  const table = choiceRow({
    title: 'Table',
    hint: 'Linen is lighter, for bright days by the window.',
    options: [
      { value: 'felt', label: 'Felt', small: 'deep green', swatch: 'felt' },
      { value: 'linen', label: 'Linen', small: 'pale and plain', swatch: 'linen' },
    ],
    value: () => state.settings.table,
    onPick: (v) => setSetting('table', v),
  })
  const rows = [sound, shake, motion, table]
  return { el: panel('Comfort', null, rows.map((r) => r.el)), sync: () => rows.forEach((r) => r.sync()) }
}

// ---------------------------------------------------------------------------
// Keeping your deck safe

function holdsText() {
  const drawings = state.seals.filter((s) => s.imageId).length
  const ticks = state.seals.length - drawings
  const parts = []
  if (drawings) parts.push(plural(drawings, 'drawing'))
  if (ticks) parts.push(plural(ticks, 'ticked card'))
  if (state.readings.size) parts.push(plural(state.readings.size, 'reading'))
  parts.push(`your tin of ${plural(state.tin.owned.length, 'pencil')}`)
  if (!state.seals.length && !state.readings.size) parts.push('your settings')
  return cap(listJoin(parts)) + '.'
}

function fact(label, ...value) {
  return h('div.fact', h('dt', label), h('dd', ...value))
}

function safePanel(disposedRef) {
  const status = h('p.safe-status', { role: 'status', 'aria-live': 'polite' })
  const say = (text, tone = '') => {
    status.textContent = text
    status.dataset.tone = tone
  }

  const lastSaved = h('dd')
  const holds = h('dd')
  const kept = h('dd')
  const paintFacts = () => {
    const last = state.meta.lastBackupAt
    mount(lastSaved, last ? h('span.hand.saved-date', friendlyDate(last)) : 'Not yet')
    holds.textContent = holdsText()
  }

  async function paintKept() {
    const storage = navigator.storage
    if (!storage?.persisted) {
      mount(kept, 'This browser doesn’t say whether it will keep the deck for good, so a saved copy is the safest bet.')
      return
    }
    let persisted = false
    try { persisted = await storage.persisted() } catch { /* treat as not yet */ }
    if (disposedRef.disposed) return
    if (persisted) {
      mount(kept, h('span.kept-yes', raw(ICONS.tick), 'Kept for good. The browser has agreed not to tidy it away.'))
      return
    }
    const ask = h('button.btn-text', { type: 'button', onclick: async () => {
      ask.disabled = true
      const ok = await requestPersistence()
      if (disposedRef.disposed) return
      if (ok) paintKept()
      else {
        ask.disabled = false
        say('The browser said not yet. It tends to agree once the deck is on your home screen, or used often.')
      }
    } }, 'Ask the browser to keep it')
    mount(kept, h('span', 'The browser may tidy the deck away if this device runs short of space.'), ask)
  }

  const saveBtn = h('button.btn.btn-gilt', { type: 'button', onclick: onSave }, raw(ICONS.download), 'Save a copy')
  const fileInput = h('input', { type: 'file', accept: '.zip,application/zip,application/x-zip-compressed', hidden: true, 'aria-hidden': 'true', tabindex: '-1' })
  const restoreBtn = h('button.btn.btn-line', { type: 'button', onclick: () => fileInput.click() }, raw(ICONS.upload), 'Restore from a copy')
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (file) onRestoreFile(file)
  })

  function reportSaved(how, filename) {
    if (how === 'shared') say('Saved. Keep it somewhere that isn’t this device, and the deck is safe.', 'good')
    else if (how === 'downloaded') say(`Saved as ${filename}. It should be with your downloads.`, 'good')
    else if (how === 'cancelled') say('No copy saved this time. The button’s here whenever you like.')
  }

  async function onSave() {
    saveBtn.disabled = true
    say('Packing up the deck…')
    try {
      const res = await exportBackup()
      if (res.how === 'stale') {
        say('Your copy is ready.')
        toast('Your copy is ready to save.', { action: 'Save it', duration: 15000, onAction: () => res.retry().then((how) => reportSaved(how, res.filename)) })
      } else reportSaved(res.how, res.filename)
    } catch (e) {
      console.error(e)
      say('The copy couldn’t be made just now. Try again in a moment.', 'bad')
    } finally {
      saveBtn.disabled = false
    }
  }

  async function onRestoreFile(file) {
    say('Reading the copy…')
    let parsed
    try {
      parsed = await readBackup(file)
    } catch (e) {
      if (!(e instanceof BackupError)) console.error(e)
      say(e instanceof BackupError ? e.message : 'That file couldn’t be read. Nothing here has changed.', 'bad')
      return
    }
    say('')
    chooseRestore(file, parsed)
  }

  function chooseRestore(file, parsed) {
    const { manifest, data } = parsed
    const drawings = data.seals.filter((s) => s.imageId).length
    const parts = []
    if (drawings) parts.push(plural(drawings, 'drawing'))
    if (data.seals.length - drawings) parts.push(plural(data.seals.length - drawings, 'ticked card'))
    parts.push(plural(data.readings.length, 'reading'))
    if (data.tin?.owned) parts.push(`a tin of ${data.tin.owned.length}`)
    const when = manifest.exportedAt ? friendlyDate(manifest.exportedAt) : ''
    const summary = `${when ? `Saved ${when === 'Today' || when === 'Yesterday' ? when.toLowerCase() : `on ${when}`}, with` : 'It holds'} ${listJoin(parts)}.`

    openSheet((close) => {
      let busy = false
      const note = h('p.restore-note', { role: 'status', 'aria-live': 'polite' })
      const option = (mode, title, text) => h(`button.restore-option.${mode}`, { type: 'button', onclick: () => go(mode) },
        h('strong', title), h('span', text))
      const merge = option('merge', 'Merge', 'Add its drawings and readings to the ones here. Your tin and settings stay as they are.')
      const replace = option('replace', 'Replace', 'Make this device match the copy exactly, tin and settings too. Anything here that isn’t in the copy will go.')
      async function go(mode) {
        if (busy) return
        busy = true
        merge.disabled = replace.disabled = true
        note.textContent = mode === 'merge' ? 'Merging…' : 'Restoring…'
        try {
          await importBackup(file, { mode, parsed })
          close()
          // The view was rebuilt from the restored deck, so put focus back somewhere sensible.
          document.querySelector('.safe-actions .btn-line')?.focus()
          toast(mode === 'merge' ? 'Merged. Everything from the copy is on the table now.' : 'Restored. The deck is just as you left it.')
        } catch (e) {
          if (!(e instanceof BackupError)) console.error(e)
          note.textContent = e instanceof BackupError ? e.message : 'Something went wrong, so nothing has changed.'
          busy = false
          merge.disabled = replace.disabled = false
        }
      }
      return h('div.restore-sheet',
        h('h2', 'Restore this copy?'),
        h('p', summary),
        h('div.restore-options', merge, replace),
        note,
        h('div.sheet-actions', h('button.btn-text', { type: 'button', autofocus: true, onclick: close }, 'Not now')),
      )
    }, { label: 'Restore from a copy', className: 'restore' })
  }

  const warn = state.storageOk ? null : h('p.safe-warn', 'Right now this browser isn’t letting the deck save anything (private browsing can do that), so readings will vanish when the tab closes.')

  const el = panel('Keeping your deck safe',
    'Your deck lives only on this device. There’s no account and no cloud, which keeps it private, but it also means nobody can rescue it if the phone goes astray. Save a copy now and then, somewhere like Files, a computer or a cloud drive you already use.',
    warn,
    h('dl.facts',
      h('div.fact', h('dt', 'Last copy saved'), lastSaved),
      h('div.fact', h('dt', 'A copy holds'), holds),
      h('div.fact', h('dt', 'On this device'), kept),
    ),
    h('div.safe-actions', saveBtn, restoreBtn, fileInput),
    status,
  )
  paintFacts()
  paintKept()
  return { el, sync: paintFacts }
}

// ---------------------------------------------------------------------------
// About

function aboutPanel() {
  return panel('About', null,
    h('p.about-lede', 'A deck of drawing cards with no pictures until you draw them.'),
    h('p', 'It suggests something to draw and which of your own pencils to use, then gets out of the way. Everything stays on this device, and it works without the internet.'),
    h('dl.facts.about-facts',
      fact('Version', pkg.version),
      fact('Type', 'Cormorant SC, Lora and Caveat, under the SIL Open Font License.'),
      fact('Pencils', 'Colours on screen are approximate. Prismacolor belongs to its owners; this is a fan’s companion, not an official one.'),
    ),
    h('p.about-link', h('a.btn-text', { href: SOURCE_URL, target: '_blank', rel: 'noopener noreferrer' }, 'The deck’s workings, on GitHub')),
  )
}

// ---------------------------------------------------------------------------

export function render(root) {
  const cleanups = []
  const disposedRef = { disposed: false }
  let parts = []

  function build() {
    cleanups.splice(0).forEach((fn) => fn())
    const deck = deckPanel(cleanups)
    const comfort = comfortPanel()
    const safe = safePanel(disposedRef)
    parts = [deck, comfort, safe]
    mount(root, h('div.settings',
      h('div.page-head', h('h1', 'Settings'), h('p', 'Small choices about how the deck deals, and how to keep it safe.')),
      h('div.settings-cols',
        h('div.settings-col', deck.el, comfort.el),
        h('div.settings-col', safe.el, aboutPanel()),
      ),
      h('p.settings-signoff.hand', 'That’s everything. Off you go and draw something.'),
      h('p.settings-back', h('a.btn.btn-ghost', { href: '#/' }, 'Back to the table')),
    ))
    parts.forEach((p) => p.sync())
  }

  build()
  const off = subscribe((what) => {
    if (what === 'reload') build()
    else if (what === 'settings') parts.forEach((p) => p.sync())
    else if (what === 'meta' || what === 'seal' || what === 'reading' || what === 'tin') parts[2]?.sync()
  })

  return () => {
    disposedRef.disposed = true
    off()
    cleanups.splice(0).forEach((fn) => fn())
  }
}
