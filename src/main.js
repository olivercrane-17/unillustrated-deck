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
route('draw/:id', () => import('./ui/draw.js'), { title: 'Drawing' })
route('deck', () => import('./ui/deck.js'), { nav: 'deck', title: 'Your deck' })
route('card/:id', () => import('./ui/card-detail.js'), { nav: 'deck', title: 'A card' })
route('readings', () => import('./ui/readings.js'), { nav: 'deck', title: 'Recent readings' })
route('tin', () => import('./ui/tin.js'), { nav: 'tin', title: 'Your tin' })
route('settings', () => import('./ui/settings.js'), { nav: 'settings', title: 'Settings' })

async function boot() {
  await init()
  applyDocumentSettings()
  subscribe((what) => {
    if (what === 'settings') applyDocumentSettings()
    // Said once per session: changes can't be kept, so she can save a copy.
    if (what === 'storage-error') {
      import('./ui/feedback.js').then(({ toast }) => toast('This device is out of room, so changes aren’t being kept. Save a copy in Settings.', { action: 'Settings', duration: 15000, onAction: () => { location.hash = '#/settings' } }))
    }
  })
  startApp(document.getElementById('app'))
  registerServiceWorker()
}

boot()
