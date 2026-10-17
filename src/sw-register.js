// Register the service worker (production builds only) and offer a reload
// when a fresh deck has arrived. The new worker waits until she says yes.
import { toast } from './ui/feedback.js'

const CHECK_EVERY = 60 * 60 * 1000

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

async function register() {
  const sw = navigator.serviceWorker
  let reg
  try {
    reg = await sw.register('./sw.js', { updateViaCache: 'none' })
  } catch (e) {
    console.warn('The deck could not set itself up for offline use', e)
    return
  }

  // The very first install claims the page quietly; after that, a change of
  // worker means an update was accepted (here or in another tab), so reload.
  let hadController = Boolean(sw.controller)
  let accepted = false
  let reloading = false
  sw.addEventListener('controllerchange', () => {
    if (!hadController && !accepted) {
      hadController = true
      return
    }
    if (reloading) return
    reloading = true
    location.reload()
  })

  let offered = null
  const offer = (waiting) => {
    if (!waiting || offered === waiting) return
    offered = waiting
    toast('A fresh deck is ready.', {
      action: 'Reload',
      duration: 0,
      onAction: () => {
        accepted = true
        waiting.postMessage({ type: 'SKIP_WAITING' })
      },
    })
  }

  if (reg.waiting && sw.controller) offer(reg.waiting)
  reg.addEventListener('updatefound', () => {
    const incoming = reg.installing
    incoming?.addEventListener('statechange', () => {
      if (incoming.state === 'installed' && sw.controller) offer(reg.waiting || incoming)
    })
  })

  // The deck is often left open on the table for hours: look for updates
  // when it comes back into view, at most hourly.
  let lastCheck = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY) return
    lastCheck = Date.now()
    reg.update().catch(() => {})
  })
}
