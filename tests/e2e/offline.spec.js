import { test, expect } from '@playwright/test'

// setOffline doesn't stop the service worker's own fetches, and the browser's
// HTTP cache can hide a worker that cached nothing. So check the worker's
// cache directly, then answer every request with an error, as a phone with
// no signal would once the HTTP cache has gone.
test('the service worker keeps the whole app for offline use', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(async () => {
    const names = await caches.keys()
    const urls = []
    for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname)
    return urls.some((u) => u.endsWith('/index.html')) && urls.some((u) => /\/assets\/index-.*\.js$/.test(u))
  }), { timeout: 15_000 }).toBe(true)

  await context.route('**/*', (route) => route.abort('internetdisconnected'))
  const fresh = await context.newPage()
  await fresh.goto('./?source=pwa')
  await expect(fresh.getByRole('button', { name: 'Draw a card', exact: true })).toBeVisible()
  await fresh.close()
  await context.unroute('**/*')
})
