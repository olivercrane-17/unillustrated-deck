// The shell: top bar, hash router and view mounting.
import { h, raw, mount } from './h.js'
import { ICONS } from './ornaments.js'
import { state, setSetting, subscribe } from '../store/state.js'
import { ensureToastHost } from './feedback.js'

const routes = []
let current = null
let navigated = false // the first render is page load, not a navigation
let viewHost = null
let navEls = {}

export function route(pattern, loader, { nav, title = '' } = {}) {
  const keys = []
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  routes.push({ re, keys, loader, nav, title })
}

const APP_TITLE = 'The Unillustrated Deck'

// Views may refine the title (a card's own page, say) after they render.
export function setTitle(title) {
  document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE
}

export function go(path, { replace = false } = {}) {
  const hash = `#/${path.replace(/^\/+/, '')}`
  if (replace) history.replaceState(null, '', hash)
  else if (location.hash !== hash) location.hash = hash
  else render()
  if (replace) render()
}

function parse() {
  const path = decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0]
  for (const r of routes) {
    const m = r.re.exec(path)
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
  }
  return { route: routes[0], params: {} }
}

async function render() {
  const { route: r, params } = parse()
  if (current?.cleanup) {
    try { current.cleanup() } catch (e) { console.error(e) }
  }
  current = null
  for (const [key, el] of Object.entries(navEls)) {
    if (r.nav === key) el.setAttribute('aria-current', 'page')
    else el.removeAttribute('aria-current')
  }
  const container = h('main.view', { id: 'main', tabindex: '-1' })
  mount(viewHost, container)
  const token = {}
  current = token
  setTitle(r.title)
  try {
    const view = await r.loader()
    if (current !== token) return
    const cleanup = await view.render(container, params)
    if (current === token) token.cleanup = cleanup
    else cleanup?.()
    // A new page: move focus to it (unless the view placed focus itself), so
    // keyboard and screen-reader users land at the start of the new content.
    if (current === token && navigated && !container.contains(document.activeElement)) container.focus({ preventScroll: true })
    navigated = true
  } catch (e) {
    console.error(e)
    mount(container, h('p.empty-note', 'Something went wrong drawing this page. Try going back to the table.'), h('p', { style: { textAlign: 'center' } }, h('a.btn.btn-ghost', { href: '#/' }, 'Back to the table')))
  }
  window.scrollTo(0, 0)
}

// A small text button that says what the sound is doing now: "Sound: off".
export function soundButton() {
  const btn = h('button.btn-text.sound-btn', { type: 'button' })
  const paint = () => {
    const on = Boolean(state.settings.sound)
    mount(btn, raw(on ? ICONS.soundOn : ICONS.soundOff), h('span', on ? 'Sound: on' : 'Sound: off'))
  }
  btn.addEventListener('click', () => setSetting('sound', !state.settings.sound))
  const off = subscribe((what) => { if (what === 'settings') paint() })
  paint()
  btn.unsubscribe = off
  return btn
}

export function startApp(root) {
  // Each place has its name under its icon: icons alone were guesswork.
  const navItem = (href, icon, label) => h('a.nav-item', { href }, raw(icon), h('span.nav-label', label))
  navEls = {
    deck: navItem('#/deck', ICONS.deck, 'Deck'),
    tin: navItem('#/tin', ICONS.tin, 'Tin'),
    settings: navItem('#/settings', ICONS.settings, 'Settings'),
  }
  const bar = h('header.topbar',
    h('a.wordmark', { href: '#/', 'aria-label': 'The Unillustrated Deck, back to the table' },
      h('span.wordmark-the', 'THE'),
      h('span.wordmark-name', 'Unillustrated Deck')),
    h('nav.topnav', { 'aria-label': 'Main' }, navEls.deck, navEls.tin, navEls.settings),
  )
  viewHost = h('div.view-host')
  // The skip link must not change the hash: the router would treat it as a route.
  const skip = h('a.skip-link', { href: '#main', onclick: (e) => {
    e.preventDefault()
    document.getElementById('main')?.focus()
  } }, 'Skip to content')
  mount(root, skip, bar, viewHost)
  ensureToastHost()
  window.addEventListener('hashchange', render)
  render()
}

export function applyDocumentSettings() {
  const root = document.documentElement
  if (state.settings.motion === 'reduced') root.dataset.motion = 'reduced'
  else delete root.dataset.motion
  if (state.settings.table === 'linen') root.dataset.table = 'linen'
  else delete root.dataset.table
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', state.settings.table === 'linen' ? '#d9cfbd' : '#24382e')
}
