// Toasts and sheets (bottom sheet on phones, centred dialog on larger screens).
import { h, raw } from './h.js'
import { ICONS } from './ornaments.js'

let toastHost = null

function host() {
  if (!toastHost) {
    toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' })
    document.body.appendChild(toastHost)
  }
  return toastHost
}

export function toast(message, { action, onAction, duration = 4200 } = {}) {
  const el = h('div.toast', h('span', message),
    action ? h('button.btn-text', { type: 'button', onclick: () => { close(); onAction?.() } }, action) : null)
  host().appendChild(el)
  let timer = duration ? setTimeout(close, duration) : null
  function close() {
    clearTimeout(timer)
    timer = null
    el.remove()
  }
  return close
}

// Open a sheet. `build(close)` returns the sheet's content.
export function openSheet(build, { label = 'Dialog', className = '', onClose } = {}) {
  const previouslyFocused = document.activeElement
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKey)
    backdrop.remove()
    document.body.style.overflow = ''
    onClose?.()
    if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) previouslyFocused.focus()
  }
  const sheet = h(`div.sheet.paper.on-paper${className ? '.' + className : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' },
    h('button.icon-btn.sheet-close', { type: 'button', 'aria-label': 'Close', onclick: close }, raw(ICONS.close)),
    build(close),
  )
  const backdrop = h('div.sheet-backdrop', { onclick: (e) => { if (e.target === backdrop) close() } }, sheet)
  const onKey = (e) => {
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') trapFocus(e, sheet)
  }
  document.addEventListener('keydown', onKey)
  document.body.appendChild(backdrop)
  document.body.style.overflow = 'hidden'
  requestAnimationFrame(() => {
    const first = sheet.querySelector('[autofocus]') || sheet
    first.focus()
  })
  return close
}

function trapFocus(e, root) {
  const items = [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

export function confirmSheet({ title, body, confirm = 'Yes', cancel = 'Not now', danger = false }) {
  return new Promise((resolve) => {
    let answered = false
    openSheet((close) => h('div',
      h('h2', title),
      body ? h('p', body) : null,
      h('div.sheet-actions',
        h(`button.btn.${danger ? 'btn-ink' : 'btn-gilt'}`, { type: 'button', onclick: () => { answered = true; resolve(true); close() } }, confirm),
        h('button.btn-text', { type: 'button', onclick: () => { answered = true; resolve(false); close() } }, cancel),
      ),
    ), { label: title, onClose: () => { if (!answered) resolve(false) } })
  })
}
