import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const CACHE_PREFIX = 'unillustrated-deck-'

function listFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else out.push(full)
  }
  return out
}

// The service worker itself. Everything is relative to sw.js, so it works
// under a GitHub Pages sub-path.
function serviceWorkerSource(cacheName, precache) {
  return `// Generated at build time by vite.config.js. Do not edit.
const CACHE = ${JSON.stringify(cacheName)}
const PREFIX = ${JSON.stringify(CACHE_PREFIX)}
const PRECACHE = ${JSON.stringify(precache, null, 2)}
const INDEX = new URL('./index.html', self.location).href

// Fill this build's cache. The new worker then waits until the page says
// the person is happy to reload.
self.addEventListener('install', (event) => {
  // Hashed build files never change under the same name, so the HTTP cache
  // copy is fine; only unhashed files are fetched fresh.
  const fresh = (url) => !url.includes('/assets/')
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: fresh(url) ? 'reload' : 'default' })))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.mode === 'navigate' ? navigate(request) : cacheFirst(request))
})

async function navigate(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request, { ignoreSearch: true })
  if (hit) return hit
  try {
    return await fetch(request)
  } catch (err) {
    const index = await cache.match(INDEX)
    if (index) return index
    throw err
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok && response.type === 'basic' && !request.headers.has('range')) {
    cache.put(request, response.clone()).catch(() => {})
  }
  return response
}
`
}

// After the build, write dist/sw.js with a precache list of every emitted
// file and a cache name that changes whenever any of them does.
function serviceWorker() {
  let outDir = 'dist'
  return {
    name: 'unillustrated-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      if (!existsSync(join(outDir, 'index.html'))) return
      const files = listFiles(outDir)
        .map((full) => relative(outDir, full).split(sep).join('/'))
        .filter((path) => path !== 'sw.js' && !path.endsWith('.map'))
        // The big install icons are only fetched by the browser when installing
        // (online by definition), so they needn't weigh down the offline cache.
        .filter((path) => !/^icons\/(icon|maskable)-512\.png$/.test(path))
        .sort()
      const hash = createHash('sha256')
      for (const path of files) {
        hash.update(path)
        hash.update(readFileSync(join(outDir, path)))
      }
      const precache = ['./', ...files.map((path) => `./${encodeURI(path)}`)]
      const cacheName = `${CACHE_PREFIX}${hash.digest('hex').slice(0, 12)}`
      writeFileSync(join(outDir, 'sw.js'), serviceWorkerSource(cacheName, precache))
      this.info?.(`sw.js: ${precache.length} files in ${cacheName}`)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
})
