// App state: her tin, her readings, her sealed cards, and small settings.
// IndexedDB holds everything that matters; localStorage only holds settings.
import { db } from './db.js'
import { content, pencils as allPencils, pencilSets } from '../data/content.js'
import { preparePencils } from '../engine/harmony.js'
import { buildContext, dealReading, dealChoices } from '../engine/reading.js'
import { detectHemisphere } from '../engine/seasons.js'
import { newSeed } from '../engine/rng.js'

export const SCHEMA_VERSION = 1
export const DEFAULT_SET = pencilSets['48'] ? '48' : '24'
const SETTINGS_KEY = 'ud.settings'
const MAX_IDLE_READINGS = 200

export const DEFAULT_SETTINGS = {
  hemisphere: 'auto',
  followSeasons: true,
  sound: false,
  shake: false,
  motion: 'auto',
  backName: '',
  quickDeal: false,
  lastSpread: 'evening',
  smallCount: 6,
  table: 'felt',
  deals: 0,
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* private mode: settings just won't stick */ }
}

export function defaultTin(setKey = DEFAULT_SET) {
  return { key: 'tin', owned: [...(pencilSets[setKey]?.codes || [])], starred: [], overrides: {}, preset: setKey }
}

const listeners = new Set()

export const state = {
  ready: false,
  settings: readSettings(),
  tin: defaultTin(),
  meta: { key: 'meta', schemaVersion: SCHEMA_VERSION, installedAt: null, lastBackupAt: null, reshuffleLog: [], firstRun: true, backupNudgeAt: null },
  currentId: null,
  readings: new Map(),
  seals: [],
  stats: {},
  storageOk: true,
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(what) {
  for (const fn of listeners) {
    try { fn(what) } catch (e) { console.error(e) }
  }
}

export async function init() {
  try {
    const [tin, meta, current, readings, seals, stats] = await Promise.all([
      db.get('kv', 'tin'),
      db.get('kv', 'meta'),
      db.get('kv', 'current'),
      db.getAll('readings'),
      db.getAll('seals'),
      db.getAll('pencilStats'),
    ])
    if (tin) state.tin = { ...defaultTin(), ...tin, overrides: cleanOverrides(tin.overrides) }
    if (meta) state.meta = { ...state.meta, ...meta }
    if (!state.meta.installedAt) {
      state.meta.installedAt = new Date().toISOString()
      await db.put('kv', state.meta)
    }
    state.currentId = current?.value || null
    for (const r of readings) state.readings.set(r.id, r)
    state.seals = seals
    state.stats = Object.fromEntries(stats.map((s) => [s.code, s]))
  } catch (e) {
    console.warn('Storage unavailable, running from memory only', e)
    state.storageOk = false
    state.meta.installedAt = new Date().toISOString()
  }
  state.ready = true
  emit('ready')
}

let warnedStorage = false
function storageFailed(e) {
  console.error('Save failed', e)
  if (!warnedStorage) {
    warnedStorage = true
    emit('storage-error')
  }
}

async function persist(store, value) {
  if (!state.storageOk) return
  try { await db.put(store, value) } catch (e) { storageFailed(e) }
}

// ---------------------------------------------------------------------------
// Settings

export function setSetting(key, value) {
  state.settings = { ...state.settings, [key]: value }
  writeSettings(state.settings)
  emit('settings')
}

export function hemisphere() {
  return state.settings.hemisphere === 'auto' ? detectHemisphere() : state.settings.hemisphere
}

// ---------------------------------------------------------------------------
// The tin

export const pencilCatalogue = allPencils

export function ownedPencils() {
  const owned = new Set(state.tin.owned)
  return preparePencils(allPencils.filter((p) => owned.has(p.code)), cleanOverrides(state.tin.overrides))
}

const HEX = /^#[0-9A-F]{6}$/i

function cleanOverrides(overrides) {
  const out = {}
  for (const [code, hex] of Object.entries(overrides || {})) if (HEX.test(String(hex))) out[code] = String(hex).toUpperCase()
  return out
}

export function pencilHex(code) {
  const override = state.tin.overrides[code]
  return (HEX.test(String(override)) && override) || allPencils.find((p) => p.code === code)?.hex || '#999999'
}

export async function saveTin(patch) {
  state.tin = { ...state.tin, ...patch }
  await persist('kv', state.tin)
  emit('tin')
}

export function toggleOwned(code) {
  const owned = new Set(state.tin.owned)
  if (owned.has(code)) owned.delete(code)
  else owned.add(code)
  return saveTin({ owned: [...owned], preset: 'custom' })
}

export function toggleStar(code) {
  const starred = new Set(state.tin.starred)
  if (starred.has(code)) starred.delete(code)
  else starred.add(code)
  return saveTin({ starred: [...starred] })
}

export function setOverride(code, hex) {
  const overrides = { ...state.tin.overrides }
  if (hex && HEX.test(hex)) overrides[code] = hex.toUpperCase()
  else delete overrides[code]
  return saveTin({ overrides })
}

export function applyPreset(setKey) {
  const codes = setKey === 'none' ? [] : pencilSets[setKey]?.codes || []
  return saveTin({ owned: [...codes], preset: setKey })
}

// ---------------------------------------------------------------------------
// Readings

export function readingsByDate() {
  return [...state.readings.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function currentReading() {
  return state.currentId ? state.readings.get(state.currentId) || null : null
}

function suitCounts() {
  const counts = {}
  for (const s of state.seals) {
    const card = content.byId.get(s.cardId)
    if (card?.suit) counts[card.suit] = (counts[card.suit] || 0) + 1
  }
  return counts
}

export function engineContext(date = new Date()) {
  const recent = readingsByDate().slice(0, 30).map((r) => ({ cards: r.cards, picks: { template: r.picks?.template } }))
  return buildContext({
    content,
    pencils: ownedPencils(),
    date,
    hemisphere: hemisphere(),
    followSeasons: state.settings.followSeasons,
    history: { recent, seals: state.seals.map((s) => ({ cardId: s.cardId, createdAt: s.createdAt })), suitCounts: suitCounts() },
    pencilStats: state.stats,
    installedAt: state.meta.installedAt,
    settings: { smallCount: state.settings.smallCount },
  })
}

const readingId = (r) => `r${Date.parse(r.createdAt).toString(36)}${r.seed.toString(36)}`

export async function saveReading(reading, { makeCurrent = true } = {}) {
  const before = reading.id && state.readings.get(reading.id)
  if (!reading.id) reading.id = readingId(reading)
  // Pencils that arrive through New colours, a swap or New picture count as
  // dealt, so a lonely-pencil note never contradicts what she has just seen.
  if (before?.palette) {
    const had = new Set(before.palette.pencils.map((p) => p.code))
    const arrived = (reading.palette?.pencils || []).map((p) => p.code).filter((c) => !had.has(c))
    if (arrived.length) touchStats(arrived, 'lastDealt')
  }
  reading.updatedAt = new Date().toISOString()
  state.readings.set(reading.id, reading)
  await persist('readings', reading)
  if (makeCurrent) {
    state.currentId = reading.id
    await persist('kv', { key: 'current', value: reading.id })
  }
  emit('reading')
  return reading
}

async function touchStats(codes, field) {
  const now = new Date().toISOString()
  const changed = []
  for (const code of codes) {
    const s = { code, lastDealt: null, lastUsed: null, timesUsed: 0, ...(state.stats[code] || {}) }
    s[field] = now
    if (field === 'lastUsed') s.timesUsed = (s.timesUsed || 0) + 1
    state.stats[code] = s
    changed.push(s)
  }
  if (state.storageOk && changed.length) {
    try { await db.putMany('pencilStats', changed) } catch (e) { storageFailed(e) }
  }
}

// Deal a fresh reading. Previous untouched readings stay in the history (so
// the deck avoids repeats) but are pruned eventually.
export async function deal(spread, { fixedReading } = {}) {
  const ctx = engineContext()
  const reading = fixedReading || dealReading(ctx, { spread, seed: newSeed() })
  await saveReading(reading)
  await touchStats(reading.palette.pencils.map((p) => p.code), 'lastDealt')
  setSetting('lastSpread', spread)
  setSetting('deals', (state.settings.deals || 0) + 1)
  pruneIdle()
  return reading
}

export function choices(spread) {
  return dealChoices(engineContext(), { spread, seed: newSeed() })
}

// Keep a light record of full reshuffles, for the "spread out" offer.
export async function logReshuffle() {
  const now = Date.now()
  const log = (state.meta.reshuffleLog || []).filter((t) => now - t < 10 * 60 * 1000)
  log.push(now)
  state.meta = { ...state.meta, reshuffleLog: log }
  await persist('kv', state.meta)
  return log.length
}

export async function clearReshuffles() {
  state.meta = { ...state.meta, reshuffleLog: [] }
  await persist('kv', state.meta)
}

async function pruneIdle() {
  const idle = readingsByDate().filter((r) => r.status === 'dealt' && r.id !== state.currentId)
  const extra = idle.slice(MAX_IDLE_READINGS)
  for (const r of extra) {
    state.readings.delete(r.id)
    if (state.storageOk) await db.delete('readings', r.id).catch(() => {})
  }
}

export async function updateReading(reading) {
  return saveReading(reading, { makeCurrent: reading.id === state.currentId })
}

export async function startDrawing(reading) {
  const r = { ...reading, status: reading.status === 'dealt' ? 'drawing' : reading.status, startedAt: reading.startedAt || new Date().toISOString() }
  await touchStats(r.palette.pencils.map((p) => p.code), 'lastUsed')
  await saveReading(r, { makeCurrent: r.id === state.currentId || !state.currentId })
  return r
}

export async function deleteReading(id) {
  state.readings.delete(id)
  if (state.currentId === id) {
    state.currentId = null
    await persist('kv', { key: 'current', value: null })
  }
  if (state.storageOk) await db.delete('readings', id).catch(() => {})
  emit('reading')
}

export async function setMeta(patch) {
  state.meta = { ...state.meta, ...patch }
  await persist('kv', state.meta)
  emit('meta')
}

// ---------------------------------------------------------------------------
// Seals

const sealedCardOf = (reading) => reading.cards.who || reading.cards.theme

export function sealsFor(cardId) {
  return state.seals.filter((s) => s.cardId === cardId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

export function faceSealFor(cardId) {
  const list = sealsFor(cardId).filter((s) => s.imageId)
  return list.find((s) => s.isFace) || list[list.length - 1] || null
}

/**
 * Record a finished drawing. With images it is a sealed photo; without, a
 * handwritten tick. Both are complete endings.
 */
export async function recordDrawn(reading, { image, thumb } = {}) {
  const now = new Date().toISOString()
  const cardId = sealedCardOf(reading)
  const id = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  const hasPhoto = Boolean(image)
  const seal = {
    id,
    cardId,
    readingId: reading.id,
    createdAt: now,
    kind: hasPhoto ? 'photo' : 'tick',
    imageId: hasPhoto ? id : null,
    isFace: false,
    pencils: reading.palette.pencils.map((p) => p.code),
    sentence: reading.text?.sentence || '',
    spread: reading.spread,
  }
  if (hasPhoto && !faceSealFor(cardId)) seal.isFace = true
  const updated = { ...reading, status: hasPhoto ? 'sealed' : 'drawn', finishedAt: now }
  if (!state.storageOk && hasPhoto) memoryImages.set(id, { image, thumb })
  if (state.storageOk) {
    await db.batch(['seals', 'images', 'readings'], (store) => {
      const ops = [store('seals').put(seal), store('readings').put(updated)]
      if (hasPhoto) ops.push(store('images').put({ id, image, thumb }))
      return Promise.all(ops)
    })
  }
  state.seals.push(seal)
  state.readings.set(updated.id, updated)
  emit('seal')
  return { seal, reading: updated }
}

export async function setFace(sealId) {
  const target = state.seals.find((s) => s.id === sealId)
  if (!target) return
  const changed = []
  for (const s of state.seals) {
    if (s.cardId !== target.cardId) continue
    const isFace = s.id === sealId
    if (s.isFace !== isFace) { s.isFace = isFace; changed.push(s) }
  }
  if (state.storageOk && changed.length) await db.putMany('seals', changed)
  emit('seal')
}

export async function deleteSeal(sealId) {
  const seal = state.seals.find((s) => s.id === sealId)
  if (!seal) return
  state.seals = state.seals.filter((s) => s.id !== sealId)
  if (state.storageOk) {
    await db.delete('seals', sealId)
    if (seal.imageId) await db.delete('images', seal.imageId)
  }
  forgetImage(seal.imageId)
  if (seal.isFace) {
    const next = faceSealFor(seal.cardId)
    if (next) await setFace(next.id)
  }
  // The reading that made this seal is no longer "sealed" once its photo goes.
  const reading = state.readings.get(seal.readingId)
  if (reading && reading.status === 'sealed') {
    const left = state.seals.filter((s) => s.readingId === reading.id)
    const status = left.some((s) => s.imageId) ? 'sealed' : left.length ? 'drawn' : 'drawing'
    if (status !== reading.status) await saveReading({ ...reading, status }, { makeCurrent: false })
  }
  emit('seal')
}

// Object URLs for stored images, cached so the gallery doesn't flicker.
const urlCache = new Map()
// Photos sealed while the browser refuses storage last for this session.
const memoryImages = new Map()

export function storageAvailable() {
  return state.storageOk
}

/** Photos held only in memory (storage refused), for "Save a copy". */
export function memoryImageRecords() {
  return [...memoryImages.entries()].map(([id, rec]) => ({ id, ...rec }))
}

export async function imageUrl(imageId, which = 'thumb') {
  if (!imageId) return ''
  const key = `${imageId}:${which}`
  if (urlCache.has(key)) return urlCache.get(key)
  try {
    const rec = memoryImages.get(imageId) || (state.storageOk ? await db.get('images', imageId) : null)
    const blob = rec?.[which] || rec?.image
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    urlCache.set(key, url)
    return url
  } catch {
    return ''
  }
}

function forgetImage(imageId) {
  for (const which of ['thumb', 'image']) {
    const key = `${imageId}:${which}`
    const url = urlCache.get(key)
    if (url) URL.revokeObjectURL(url)
    urlCache.delete(key)
  }
}

export function forgetAllImages() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url)
  urlCache.clear()
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist()
    return true
  } catch {
    return false
  }
}

// After a full import or wipe, reload everything from the database.
export async function reloadFromDb() {
  state.readings = new Map()
  state.seals = []
  state.stats = {}
  state.tin = defaultTin()
  forgetAllImages()
  await init()
  emit('reload')
}

export { content, pencilSets }
