// Save a copy of the whole deck as a zip, and bring one back.
//
// The zip holds:
//   manifest.json            { app, schemaVersion, exportedAt, appVersion, counts }
//   data.json                { tin, meta, settings, readings, seals, pencilStats, currentId }
//   images/<id>.jpg          her drawing, full size
//   images/<id>-thumb.jpg    the little one for the gallery
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { db } from './db.js'
import { state, SCHEMA_VERSION, DEFAULT_SETTINGS, setSetting, setMeta, reloadFromDb, memoryImageRecords } from './state.js'
import { SPREADS } from '../engine/reading.js'
import pkg from '../../package.json'

export const APP_ID = 'unillustrated-deck'
const STORES = ['kv', 'readings', 'seals', 'images', 'pencilStats']

export class BackupError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackupError'
  }
}

const NOT_A_COPY = 'That file isn’t a copy of this deck. Look for a zip called something like unillustrated-deck-2026-10-17.zip.'
const DAMAGED = 'That copy seems to be damaged, so the deck can’t read it. Nothing here has changed.'

// ---------------------------------------------------------------------------
// Migrations: MIGRATIONS[n] turns a version n copy into version n + 1. There
// are none yet; add one here whenever SCHEMA_VERSION goes up.

export const MIGRATIONS = {}

export function migrate(data, fromVersion, { to = SCHEMA_VERSION, migrations = MIGRATIONS } = {}) {
  let out = data
  for (let v = fromVersion; v < to; v++) {
    const step = migrations[v]
    if (step) out = step(out)
  }
  return out
}

// ---------------------------------------------------------------------------
// Small pure helpers (exported for tests)

const pad = (n) => String(n).padStart(2, '0')

export function backupFilename(date = new Date()) {
  return `unillustrated-deck-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length < 200

// Check the shape of data.json. Throws a kind BackupError naming the part
// that looks wrong.
export function validateData(data) {
  const fail = (part) => { throw new BackupError(`Part of this copy (${part}) doesn’t look right, so nothing has been changed.`) }
  if (!isObj(data)) throw new BackupError(DAMAGED)
  if (!Array.isArray(data.readings) || !data.readings.every((r) => isObj(r) && isId(r.id) && isObj(r.cards))) fail('the readings')
  if (!Array.isArray(data.seals) || !data.seals.every((s) => isObj(s) && isId(s.id) && isId(s.cardId))) fail('the sealed cards')
  if (data.pencilStats != null && (!Array.isArray(data.pencilStats) || !data.pencilStats.every((p) => isObj(p) && isId(p.code)))) fail('the pencil notes')
  if (data.tin != null && (!isObj(data.tin) || !Array.isArray(data.tin.owned) || !data.tin.owned.every(isId)
    || (data.tin.starred !== undefined && !Array.isArray(data.tin.starred))
    || (data.tin.overrides !== undefined && !isObj(data.tin.overrides)))) fail('your tin')
  if (data.meta != null && !isObj(data.meta)) fail('the deck’s notes')
  if (data.settings != null && !isObj(data.settings)) fail('the settings')
  return data
}

const ALLOWED = {
  hemisphere: ['auto', 'north', 'south'],
  motion: ['auto', 'reduced'],
  table: ['felt', 'linen'],
  smallCount: [4, 6],
  // The table deals straight from this, so an unknown spread would break it.
  lastSpread: Object.keys(SPREADS),
}

// Only settings we know, with the same type as the default.
export function cleanSettings(settings) {
  const out = {}
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = settings?.[k]
    if (v === undefined || typeof v !== typeof def) continue
    if (ALLOWED[k] && !ALLOWED[k].includes(v)) continue
    if (k === 'deals' && !(Number.isInteger(v) && v >= 0)) continue
    out[k] = k === 'backName' ? v.slice(0, 24) : v
  }
  return out
}

const HEX = /^#[0-9a-f]{6}$/i

// The tin as it goes back on the shelf: colour corrections only when they are
// real #RRGGBB colours, starred and owned codes only when they are codes, and
// the answers to "which of these is in your box?" kept as they were.
export function cleanTin(tin) {
  const overrides = {}
  for (const [code, hex] of Object.entries(isObj(tin.overrides) ? tin.overrides : {})) {
    if (isId(code) && typeof hex === 'string' && HEX.test(hex)) overrides[code] = hex.toUpperCase()
  }
  const variantAnswers = {}
  for (const [id, code] of Object.entries(isObj(tin.variantAnswers) ? tin.variantAnswers : {})) {
    if (isId(id) && isId(code)) variantAnswers[id] = code
  }
  return {
    ...tin,
    key: 'tin',
    owned: tin.owned.filter(isId),
    starred: Array.isArray(tin.starred) ? tin.starred.filter(isId) : [],
    overrides,
    // Without one the deck would assume its default set, which may not be hers.
    preset: isId(tin.preset) ? tin.preset : 'custom',
    variantAnswers,
  }
}

const later = (a, b) => (!a ? b || null : !b ? a : String(a) > String(b) ? a : b)
const earlier = (a, b) => (!a ? b || null : !b ? a : String(a) < String(b) ? a : b)
// The last time a record changed. Finishing a drawing sets finishedAt without
// touching updatedAt, so look at both.
const stamp = (r) => String([r?.updatedAt, r?.finishedAt, r?.createdAt].reduce(later, null) || '')

// Merge records by key. Incoming wins only when it is newer than the one
// already here; a tie keeps this device's (a seal's chosen face, say).
export function mergeById(existing, incoming, key = 'id') {
  const map = new Map(existing.map((r) => [r[key], r]))
  const changed = []
  for (const r of incoming) {
    const have = map.get(r[key])
    if (!have || stamp(r) > stamp(have)) {
      map.set(r[key], r)
      changed.push(r)
    }
  }
  return { all: [...map.values()], changed }
}

// Pencil notes: keep the most recent dates and the larger count.
export function mergePencilStats(existing, incoming) {
  const map = new Map(existing.map((s) => [s.code, s]))
  const changed = []
  for (const s of incoming) {
    const have = map.get(s.code)
    const next = have
      ? { ...have, lastDealt: later(have.lastDealt, s.lastDealt), lastUsed: later(have.lastUsed, s.lastUsed), timesUsed: Math.max(have.timesUsed || 0, s.timesUsed || 0) }
      : s
    map.set(s.code, next)
    changed.push(next)
  }
  return { all: [...map.values()], changed }
}

// One face per card. Faces already on this device win over incoming ones.
export function settleFaces(seals, preferIds = new Set()) {
  const byCard = new Map()
  for (const s of seals) {
    if (!s.isFace) continue
    const list = byCard.get(s.cardId) || []
    list.push(s)
    byCard.set(s.cardId, list)
  }
  const changed = []
  for (const list of byCard.values()) {
    if (list.length < 2) continue
    const keep = list.find((s) => preferIds.has(s.id)) || list[list.length - 1]
    for (const s of list) {
      if (s !== keep) {
        s.isFace = false
        changed.push(s)
      }
    }
  }
  return changed
}

// A photo seal whose picture didn't come along becomes a tick, so the deck
// never shows an empty frame. Always copies, so settling faces later never
// changes the copy that was read (she may try the other mode next).
export function dropMissingImages(seals, haveImage) {
  return seals.map((s) => (s.imageId && !haveImage(s.imageId) ? { ...s, imageId: null, kind: 'tick', isFace: false } : { ...s }))
}

// ---------------------------------------------------------------------------
// Export

async function readEverything() {
  if (!state.storageOk) {
    return {
      tin: state.tin, meta: state.meta, readings: [...state.readings.values()], seals: state.seals,
      pencilStats: Object.values(state.stats), images: memoryImageRecords(), currentId: state.currentId,
    }
  }
  const [tin, meta, current, readings, seals, pencilStats, images] = await Promise.all([
    db.get('kv', 'tin'), db.get('kv', 'meta'), db.get('kv', 'current'),
    db.getAll('readings'), db.getAll('seals'), db.getAll('pencilStats'), db.getAll('images'),
  ])
  return { tin: tin || state.tin, meta: meta || state.meta, readings, seals, pencilStats, images, currentId: current?.value || null }
}

async function bytesOf(blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Build the zip. Returns { bytes, filename, counts }. */
export async function buildBackup({ now = new Date() } = {}) {
  const all = await readEverything()
  const files = {}
  let imageCount = 0
  for (const rec of all.images) {
    if (!isId(rec?.id) || !rec.image) continue
    // JPEGs are already compressed: store them as they are.
    files[`images/${rec.id}.jpg`] = [await bytesOf(rec.image), { level: 0 }]
    if (rec.thumb) files[`images/${rec.id}-thumb.jpg`] = [await bytesOf(rec.thumb), { level: 0 }]
    imageCount += 1
  }
  const counts = {
    readings: all.readings.length,
    seals: all.seals.length,
    images: imageCount,
    pencils: all.tin?.owned?.length || 0,
  }
  const manifest = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), appVersion: pkg.version, counts }
  const data = {
    tin: all.tin,
    meta: all.meta,
    settings: { ...state.settings },
    readings: all.readings,
    seals: all.seals,
    pencilStats: all.pencilStats,
    currentId: all.currentId,
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  files['data.json'] = strToU8(JSON.stringify(data))
  const bytes = zipSync(files, { level: 6 })
  return { bytes, filename: backupFilename(now), counts }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Hand the file over: the share sheet on phones (so it can go to Files), a
 * plain download elsewhere. Returns 'shared', 'downloaded', 'cancelled', or
 * 'stale' when the share sheet refused because the tap was too long ago (call
 * again from a fresh tap; with `fallback` it downloads instead).
 */
export async function saveFile(blob, filename, { fallback = false } = {}) {
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'application/zip' }) : null
  // The share sheet is how a phone or tablet saves to Files. On a computer it
  // usually has no way to save at all, so a plain download is kinder there.
  const touchFirst = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (file && touchFirst && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'The Unillustrated Deck' })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
      if (e?.name === 'NotAllowedError' && !fallback) return 'stale'
    }
  }
  download(blob, filename)
  return 'downloaded'
}

/**
 * Build a copy and save it. Returns { how, counts, filename, retry } where
 * `retry()` (for how === 'stale') saves the same copy from a fresh tap.
 */
export async function exportBackup() {
  const { bytes, filename, counts } = await buildBackup()
  const blob = new Blob([bytes], { type: 'application/zip' })
  const finish = async (how) => {
    if (how === 'shared' || how === 'downloaded') await setMeta({ lastBackupAt: new Date().toISOString() })
    return how
  }
  const how = await finish(await saveFile(blob, filename))
  return { how, counts, filename, retry: () => saveFile(blob, filename, { fallback: true }).then(finish) }
}

// ---------------------------------------------------------------------------
// Import

async function toBytes(input) {
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer())
  throw new BackupError(NOT_A_COPY)
}

function parseJson(u8) {
  try {
    return JSON.parse(strFromU8(u8))
  } catch {
    throw new BackupError(DAMAGED)
  }
}

/**
 * Open and check a copy without changing anything.
 * Returns { manifest, data, images: Map(id → { id, image, thumb }) }.
 */
export async function readBackup(input) {
  const bytes = await toBytes(input)
  // Every zip starts with "PK".
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new BackupError(NOT_A_COPY)
  let files
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError(DAMAGED)
  }
  if (!files['manifest.json']) throw new BackupError(NOT_A_COPY)
  const manifest = parseJson(files['manifest.json'])
  if (!isObj(manifest) || manifest.app !== APP_ID) throw new BackupError(NOT_A_COPY)
  const version = manifest.schemaVersion
  if (!Number.isInteger(version) || version < 1) throw new BackupError(DAMAGED)
  if (version > SCHEMA_VERSION) throw new BackupError('This copy was made by a newer version of the deck. Reload the app so it can fetch the update, then try again.')
  if (!files['data.json']) throw new BackupError(DAMAGED)
  const data = validateData(migrate(parseJson(files['data.json']), version))

  const images = new Map()
  for (const [name, u8] of Object.entries(files)) {
    const m = /^images\/([\w.-]+?)(-thumb)?\.jpg$/.exec(name)
    if (!m) continue
    const rec = images.get(m[1]) || { id: m[1] }
    rec[m[2] ? 'thumb' : 'image'] = new Blob([u8], { type: 'image/jpeg' })
    images.set(m[1], rec)
  }
  for (const rec of images.values()) {
    if (!rec.image) rec.image = rec.thumb
    if (!rec.thumb) rec.thumb = rec.image
  }
  return { manifest, data, images }
}

function metaFrom(copyMeta, manifest) {
  const meta = { ...(copyMeta || {}), key: 'meta', schemaVersion: SCHEMA_VERSION }
  // Restoring from a copy means a copy exists of exactly this.
  const exported = typeof manifest.exportedAt === 'string' && !Number.isNaN(Date.parse(manifest.exportedAt)) ? manifest.exportedAt : null
  meta.lastBackupAt = later(meta.lastBackupAt, exported)
  return meta
}

async function replaceAll({ manifest, data, images }) {
  const seals = dropMissingImages(data.seals, (id) => images.has(id))
  settleFaces(seals)
  const tin = data.tin ? cleanTin(data.tin) : null
  const meta = metaFrom(data.meta, manifest)
  const currentId = data.readings.some((r) => r.id === data.currentId) ? data.currentId : null
  await db.batch(STORES, (store) => {
    // Requests on one store run in order, so the clears land before the puts.
    const ops = STORES.map((name) => store(name).clear())
    if (tin) ops.push(store('kv').put(tin))
    ops.push(store('kv').put(meta))
    if (currentId) ops.push(store('kv').put({ key: 'current', value: currentId }))
    for (const r of data.readings) ops.push(store('readings').put(r))
    for (const s of seals) ops.push(store('seals').put(s))
    for (const p of data.pencilStats || []) ops.push(store('pencilStats').put(p))
    for (const rec of images.values()) ops.push(store('images').put(rec))
    return Promise.all(ops)
  })
}

async function mergeIn({ data, images }) {
  const [readingsHere, sealsHere, statsHere, metaHere] = await Promise.all([
    db.getAll('readings'), db.getAll('seals'), db.getAll('pencilStats'), db.get('kv', 'meta'),
  ])
  const imagesHere = new Set(sealsHere.map((s) => s.imageId).filter(Boolean))
  const readings = mergeById(readingsHere, data.readings)
  const incomingSeals = dropMissingImages(data.seals, (id) => images.has(id) || imagesHere.has(id))
  const seals = mergeById(sealsHere, incomingSeals)
  const facesMoved = settleFaces(seals.all, new Set(sealsHere.filter((s) => s.isFace).map((s) => s.id)))
  const sealWrites = [...new Set([...seals.changed, ...facesMoved])]
  const stats = mergePencilStats(statsHere, data.pencilStats || [])
  const meta = metaHere && data.meta?.installedAt
    ? { ...metaHere, installedAt: earlier(metaHere.installedAt, data.meta.installedAt) }
    : null
  await db.batch(['kv', 'readings', 'seals', 'images', 'pencilStats'], (store) => {
    const ops = []
    for (const r of readings.changed) ops.push(store('readings').put(r))
    for (const s of sealWrites) ops.push(store('seals').put(s))
    for (const p of stats.changed) ops.push(store('pencilStats').put(p))
    for (const rec of images.values()) ops.push(store('images').put(rec))
    if (meta) ops.push(store('kv').put(meta))
    return Promise.all(ops)
  })
}

/**
 * Restore a copy. `mode` is 'merge' (add and update by id, keep this device's
 * tin and settings) or 'replace' (make this device match the copy exactly).
 * Pass the result of readBackup() as `parsed` to skip reading the file twice.
 * Returns { mode, counts } with what the deck now holds.
 */
export async function importBackup(file, { mode = 'merge', parsed } = {}) {
  if (mode !== 'merge' && mode !== 'replace') throw new Error(`Unknown import mode: ${mode}`)
  const copy = parsed || (await readBackup(file))
  if (!state.storageOk) throw new BackupError('This browser isn’t letting the deck save anything just now (private browsing can do that), so a copy can’t be restored here.')
  try {
    if (mode === 'replace') await replaceAll(copy)
    else await mergeIn(copy)
  } catch (e) {
    console.error(e)
    throw new BackupError('The deck couldn’t write the copy to this device, so nothing has changed. There may not be enough space.')
  }
  await reloadFromDb()
  if (mode === 'replace' && copy.data.settings) {
    for (const [k, v] of Object.entries(cleanSettings(copy.data.settings))) {
      // Shake may need this device's permission, which only a tap on the
      // switch can ask for, so a copy never turns it on.
      if (k === 'shake' && v) continue
      if (state.settings[k] !== v) setSetting(k, v)
    }
  }
  return {
    mode,
    counts: { readings: state.readings.size, seals: state.seals.length, drawings: state.seals.filter((s) => s.imageId).length },
  }
}
