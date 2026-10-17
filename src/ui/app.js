// The shell: top bar, hash router and view mounting.
import { h, raw, mount } from './h.js'
import { ICONS } from './ornaments.js'
import { state, setSetting, subscribe } from '../store/state.js'

const routes = []
let current = null
let viewHost = null
let navEls = {}

export function route(pattern, loader, { nav } = {}) {
  const keys = []
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  routes.push({ re, keys, loader, nav })
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
  try {
    const view = await r.loader()
    if (current !== token) return
    const cleanup = await view.render(container, params)
    if (current === token) token.cleanup = cleanup
    else cleanup?.()
  } catch (e) {
    console.error(e)
    mount(container, h('p.empty-note', 'Something went wrong drawing this page. Try going back to the table.'), h('p', { style: { textAlign: 'center' } }, h('a.btn.btn-ghost', { href: '#/' }, 'Back to the table')))
  }
  window.scrollTo(0, 0)
}

export function soundButton() {
  const btn = h('button.icon-btn', { type: 'button' })
  const paint = () => {
    btn.innerHTML = state.settings.sound ? ICONS.soundOn : ICONS.soundOff
    btn.setAttribute('aria-label', state.settings.sound ? 'Sound on' : 'Sound off')
    btn.setAttribute('aria-pressed', String(state.settings.sound))
  }
  btn.addEventListener('click', () => setSetting('sound', !state.settings.sound))
  const off = subscribe((what) => { if (what === 'settings') paint() })
  paint()
  btn.unsubscribe = off
  return btn
}

export function startApp(root) {
  navEls = {
    deck: h('a.icon-btn', { href: '#/deck', 'aria-label': 'Your deck', title: 'Your deck' }, raw(ICONS.deck)),
    tin: h('a.icon-btn', { href: '#/tin', 'aria-label': 'Your tin', title: 'Your tin' }, raw(ICONS.tin)),
    settings: h('a.icon-btn', { href: '#/settings', 'aria-label': 'Settings', title: 'Settings' }, raw(ICONS.settings)),
  }
  const bar = h('header.topbar',
    h('a.wordmark', { href: '#/', 'aria-label': 'The Unillustrated Deck, back to the table' },
      h('span.wordmark-the', 'THE'),
      h('span.wordmark-name', 'Unillustrated Deck')),
    h('nav.topnav', { 'aria-label': 'Main' }, navEls.deck, navEls.tin, navEls.settings),
  )
  viewHost = h('div.view-host')
  mount(root, h('a.sr-only', { href: '#main' }, 'Skip to content'), bar, viewHost)
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
