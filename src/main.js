import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/card.css'
import './styles/table.css'
import './styles/draw.css'
import './styles/seal.css'
import './styles/deck.css'
import './styles/tin.css'
import './styles/settings.css'

import { init, subscribe } from './store/state.js'
import { route, startApp, applyDocumentSettings } from './ui/app.js'
import { registerServiceWorker } from './sw-register.js'

route('', () => import('./ui/table.js'))
route('draw/:id', () => import('./ui/draw.js'))
route('deck', () => import('./ui/deck.js'), { nav: 'deck' })
route('card/:id', () => import('./ui/card-detail.js'), { nav: 'deck' })
route('readings', () => import('./ui/readings.js'), { nav: 'deck' })
route('tin', () => import('./ui/tin.js'), { nav: 'tin' })
route('settings', () => import('./ui/settings.js'), { nav: 'settings' })

async function boot() {
  await init()
  applyDocumentSettings()
  subscribe((what) => { if (what === 'settings') applyDocumentSettings() })
  startApp(document.getElementById('app'))
  registerServiceWorker()
}

boot()
