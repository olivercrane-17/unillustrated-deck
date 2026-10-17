// A tiny promise wrapper around IndexedDB. Images live here as Blobs, never in
// localStorage.

export const DB_NAME = 'unillustrated-deck'
export const DB_VERSION = 1
export const STORES = {
  kv: { keyPath: 'key' }, // tin, meta and other single records
  readings: { keyPath: 'id', indexes: [['createdAt', 'createdAt']] },
  seals: { keyPath: 'id', indexes: [['cardId', 'cardId'], ['createdAt', 'createdAt']] },
  images: { keyPath: 'id' }, // { id, image: Blob, thumb: Blob }
  pencilStats: { keyPath: 'code' },
}

let dbPromise = null

export function openDb(factory = globalThis.indexedDB) {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!factory) return reject(new Error('IndexedDB is not available'))
    const req = factory.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const [name, def] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue
        const store = db.createObjectStore(name, { keyPath: def.keyPath })
        for (const [idx, path] of def.indexes || []) store.createIndex(idx, path)
      }
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('The deck is open in another tab that needs closing first.'))
  })
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

export function resetDbHandle() {
  dbPromise = null
}

function tx(storeNames, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode)
    let result
    Promise.resolve(fn(t)).then((r) => { result = r }, reject)
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error || new Error('Transaction aborted'))
  }))
}

const req2p = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

export const db = {
  get: (store, key) => tx([store], 'readonly', (t) => req2p(t.objectStore(store).get(key))),
  getAll: (store) => tx([store], 'readonly', (t) => req2p(t.objectStore(store).getAll())),
  put: (store, value) => tx([store], 'readwrite', (t) => req2p(t.objectStore(store).put(value))),
  delete: (store, key) => tx([store], 'readwrite', (t) => req2p(t.objectStore(store).delete(key))),
  clear: (store) => tx([store], 'readwrite', (t) => req2p(t.objectStore(store).clear())),
  putMany: (store, values) => tx([store], 'readwrite', (t) => Promise.all(values.map((v) => req2p(t.objectStore(store).put(v))))),
  // Run several writes across stores atomically.
  batch: (stores, fn) => tx(stores, 'readwrite', (t) => fn((name) => {
    const s = t.objectStore(name)
    return { put: (v) => req2p(s.put(v)), delete: (k) => req2p(s.delete(k)), clear: () => req2p(s.clear()) }
  })),
}
