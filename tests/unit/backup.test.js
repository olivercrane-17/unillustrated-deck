import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { zipSync, strToU8 } from 'fflate'

// state.js reads settings from localStorage when it loads, so stub it first.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.URL.createObjectURL ??= () => 'blob:test'
globalThis.URL.revokeObjectURL ??= () => {}

let S, B, db

beforeAll(async () => {
  S = await import('../../src/store/state.js')
  B = await import('../../src/store/backup.js')
  db = (await import('../../src/store/db.js')).db
  await S.init()
})

const jpeg = (n) => new Blob([new Uint8Array([0xff, 0xd8, n, n + 1, n + 2, 0xff, 0xd9])], { type: 'image/jpeg' })
const bytesOf = async (blob) => [...new Uint8Array(await blob.arrayBuffer())]

let seq = 0
function fakeReading(over = {}) {
  seq += 1
  return {
    seed: 1000 + seq,
    spread: 'quick',
    createdAt: new Date(Date.UTC(2026, 9, seq)).toISOString(),
    season: 'autumn',
    cards: { who: `fur-thing${seq}` },
    palette: { name: 'Test', pencils: [{ code: 'PC901', role: 'dark' }, { code: 'PC1034', role: 'main' }] },
    text: { sentence: `Reading ${seq}.` },
    status: 'dealt',
    ...over,
  }
}

async function wipe() {
  for (const name of ['kv', 'readings', 'seals', 'images', 'pencilStats']) await db.clear(name)
  store.clear()
  for (const [k, v] of Object.entries(S.DEFAULT_SETTINGS)) S.setSetting(k, v)
  await S.reloadFromDb()
}

async function makeZip(files) {
  const out = {}
  for (const [name, value] of Object.entries(files)) out[name] = typeof value === 'string' ? strToU8(value) : value
  return zipSync(out)
}

async function errorOf(promise) {
  try {
    await promise
  } catch (e) {
    return e
  }
  throw new Error('expected a rejection')
}

describe('backup round trip', () => {
  beforeEach(wipe)

  it('saves everything and brings it all back with replace', async () => {
    await S.saveTin({ owned: ['PC901', 'PC935', 'PC1034'], starred: ['PC901'], overrides: { PC901: '#223355' }, preset: 'custom' })
    const first = await S.saveReading(fakeReading())
    await S.startDrawing(first)
    const { seal: photo } = await S.recordDrawn(S.currentReading(), { image: jpeg(1), thumb: jpeg(50) })
    const second = await S.saveReading(fakeReading())
    const { seal: tick } = await S.recordDrawn(second)
    const third = await S.saveReading(fakeReading())
    S.setSetting('backName', 'Mabel')
    S.setSetting('hemisphere', 'south')
    S.setSetting('smallCount', 4)

    const { bytes, filename, counts } = await B.buildBackup({ now: new Date(2026, 9, 17, 9, 30) })
    expect(filename).toBe('unillustrated-deck-2026-10-17.zip')
    expect(counts).toEqual({ readings: 3, seals: 2, images: 1, pencils: 3 })

    const peek = await B.readBackup(bytes)
    expect(peek.manifest).toMatchObject({ app: 'unillustrated-deck', schemaVersion: S.SCHEMA_VERSION, counts })
    expect(peek.images.get(photo.id).thumb).toBeTruthy()

    await wipe()
    expect(S.state.readings.size).toBe(0)
    expect(S.state.settings.backName).toBe('')

    const result = await B.importBackup(new Blob([bytes]), { mode: 'replace' })
    expect(result.counts).toEqual({ readings: 3, seals: 2, drawings: 1 })
    expect([...S.state.readings.keys()].sort()).toEqual([first.id, second.id, third.id].sort())
    expect(S.state.currentId).toBe(third.id)
    expect(S.state.tin.owned).toEqual(['PC901', 'PC935', 'PC1034'])
    expect(S.state.tin.overrides).toEqual({ PC901: '#223355' })
    expect(S.state.seals.map((s) => s.id).sort()).toEqual([photo.id, tick.id].sort())
    expect(S.state.stats.PC901.timesUsed).toBe(1)
    expect(S.state.settings).toMatchObject({ backName: 'Mabel', hemisphere: 'south', smallCount: 4 })
    expect(S.state.meta.lastBackupAt).toBe(peek.manifest.exportedAt)

    const img = await db.get('images', photo.id)
    expect(await bytesOf(img.image)).toEqual(await bytesOf(jpeg(1)))
    expect(await bytesOf(img.thumb)).toEqual(await bytesOf(jpeg(50)))
    expect(img.image.type).toBe('image/jpeg')
  })

  it('replace clears what was here first', async () => {
    await S.saveReading(fakeReading())
    const { bytes } = await B.buildBackup()
    await wipe()
    const local = await S.saveReading(fakeReading())
    await B.importBackup(bytes, { mode: 'replace' })
    expect(S.state.readings.has(local.id)).toBe(false)
    expect(S.state.readings.size).toBe(1)
  })

  it('merge keeps what is here, adds what is new and never duplicates', async () => {
    await S.saveTin({ owned: ['PC901', 'PC935'], preset: 'custom' })
    const shared = await S.saveReading(fakeReading())
    const { seal } = await S.recordDrawn(shared, { image: jpeg(7), thumb: jpeg(8) })
    S.setSetting('backName', 'From the copy')
    const { bytes } = await B.buildBackup()

    await wipe()
    await S.saveTin({ owned: ['PC1034'], preset: 'custom' })
    S.setSetting('backName', 'Here')
    const mine = await S.saveReading(fakeReading())
    const { seal: myFace } = await S.recordDrawn(mine, { image: jpeg(20), thumb: jpeg(21) })

    await B.importBackup(new Blob([bytes]), { mode: 'merge' })
    expect(S.state.readings.has(mine.id)).toBe(true)
    expect(S.state.readings.has(shared.id)).toBe(true)
    expect(S.state.seals.map((s) => s.id).sort()).toEqual([seal.id, myFace.id].sort())
    expect(S.state.tin.owned).toEqual(['PC1034'])
    expect(S.state.settings.backName).toBe('Here')

    // Merging the same copy twice changes nothing.
    await B.importBackup(new Blob([bytes]), { mode: 'merge' })
    expect(S.state.readings.size).toBe(2)
    expect(S.state.seals.length).toBe(2)
    expect(await bytesOf((await db.get('images', seal.id)).image)).toEqual(await bytesOf(jpeg(7)))
  })

  it('merging an older copy never undoes what happened here since', async () => {
    const r = await S.saveReading(fakeReading())
    const drawing = await S.startDrawing(r)
    const { seal: a } = await S.recordDrawn(fakeReading({ id: 'other', cards: { who: drawing.cards.who } }), { image: jpeg(3), thumb: jpeg(4) })
    const { seal: b } = await S.recordDrawn(drawing, { image: jpeg(5), thumb: jpeg(6) })
    const { bytes } = await B.buildBackup()

    // Since that copy: the reading was sealed (above, b), and the face moved to b.
    await S.setFace(b.id)
    const sealedHere = S.state.readings.get(r.id)
    expect(sealedHere.status).toBe('sealed')
    const copy = await B.readBackup(bytes)
    // Make the copy look like it was taken before the seal.
    copy.data.readings = copy.data.readings.map((x) => (x.id === r.id ? { ...x, status: 'drawing', finishedAt: undefined } : x))
    copy.data.seals = copy.data.seals.map((s) => ({ ...s, isFace: s.id === a.id }))

    await B.importBackup(null, { mode: 'merge', parsed: copy })
    expect(S.state.readings.get(r.id).status).toBe('sealed')
    expect(S.state.seals.find((s) => s.id === b.id).isFace).toBe(true)
    expect(S.state.seals.find((s) => s.id === a.id).isFace).toBe(false)
  })

  it('a copy never turns shake on by itself', async () => {
    S.setSetting('shake', true)
    S.setSetting('sound', true)
    const { bytes } = await B.buildBackup()
    await wipe()
    await B.importBackup(bytes, { mode: 'replace' })
    expect(S.state.settings.sound).toBe(true)
    expect(S.state.settings.shake).toBe(false)
  })

  it('a photo seal whose picture is missing comes back as a tick', async () => {
    const data = {
      tin: { owned: ['PC901'] }, meta: {}, settings: {},
      readings: [{ id: 'r1', cards: { who: 'fur-x' } }],
      seals: [{ id: 's1', cardId: 'fur-x', readingId: 'r1', kind: 'photo', imageId: 's1', isFace: true }],
      pencilStats: [],
    }
    const zip = await makeZip({
      'manifest.json': JSON.stringify({ app: 'unillustrated-deck', schemaVersion: 1, exportedAt: '2026-10-01T10:00:00.000Z' }),
      'data.json': JSON.stringify(data),
    })
    await B.importBackup(zip, { mode: 'replace' })
    expect(S.state.seals[0]).toMatchObject({ id: 's1', kind: 'tick', imageId: null, isFace: false })
  })
})

describe('reading a copy', () => {
  const manifest = (over = {}) => JSON.stringify({ app: 'unillustrated-deck', schemaVersion: 1, exportedAt: '2026-10-01T10:00:00.000Z', ...over })
  const goodData = JSON.stringify({ tin: { owned: [] }, meta: {}, settings: {}, readings: [], seals: [], pencilStats: [] })

  it('turns away a file that is not a zip', async () => {
    const e = await errorOf(B.readBackup(new Blob(['hello, I am a shopping list'])))
    expect(e).toBeInstanceOf(B.BackupError)
    expect(e.message).toMatch(/isn’t a copy of this deck/)
  })

  it('turns away a zip from somewhere else', async () => {
    const e = await errorOf(B.readBackup(await makeZip({ 'holiday.txt': 'sun' })))
    expect(e.message).toMatch(/isn’t a copy of this deck/)
    const e2 = await errorOf(B.readBackup(await makeZip({ 'manifest.json': manifest({ app: 'something-else' }), 'data.json': goodData })))
    expect(e2.message).toMatch(/isn’t a copy of this deck/)
  })

  it('explains a copy from a newer version', async () => {
    const e = await errorOf(B.readBackup(await makeZip({ 'manifest.json': manifest({ schemaVersion: 99 }), 'data.json': goodData })))
    expect(e.message).toMatch(/newer version/)
  })

  it('names the part of a copy that looks wrong', async () => {
    const bad = JSON.stringify({ readings: [{ nope: true }], seals: [] })
    const e = await errorOf(B.readBackup(await makeZip({ 'manifest.json': manifest(), 'data.json': bad })))
    expect(e.message).toMatch(/the readings/)
    const e2 = await errorOf(B.readBackup(await makeZip({ 'manifest.json': manifest(), 'data.json': '{not json' })))
    expect(e2.message).toMatch(/damaged/)
    const badTin = JSON.stringify({ tin: { owned: [], overrides: null }, readings: [], seals: [] })
    const e3 = await errorOf(B.readBackup(await makeZip({ 'manifest.json': manifest(), 'data.json': badTin })))
    expect(e3.message).toMatch(/your tin/)
  })

  it('never writes anything when a copy is refused', async () => {
    await wipe()
    const kept = await S.saveReading(fakeReading())
    await errorOf(B.importBackup(await makeZip({ 'manifest.json': manifest({ schemaVersion: 99 }), 'data.json': goodData }), { mode: 'replace' }))
    expect(S.state.readings.has(kept.id)).toBe(true)
  })
})

describe('backup helpers', () => {
  it('runs migrations in order from the copy’s version', () => {
    const migrations = {
      1: (d) => ({ ...d, steps: [...d.steps, 'one'] }),
      2: (d) => ({ ...d, steps: [...d.steps, 'two'] }),
    }
    expect(B.migrate({ steps: [] }, 1, { to: 3, migrations }).steps).toEqual(['one', 'two'])
    expect(B.migrate({ steps: [] }, 2, { to: 3, migrations }).steps).toEqual(['two'])
    expect(B.migrate({ steps: [] }, 3, { to: 3, migrations }).steps).toEqual([])
  })

  it('merges pencil notes by keeping the latest dates and the bigger count', () => {
    const here = [{ code: 'PC901', lastDealt: '2026-10-01', lastUsed: '2026-09-01', timesUsed: 4 }]
    const copy = [{ code: 'PC901', lastDealt: '2026-08-01', lastUsed: '2026-10-05', timesUsed: 2 }, { code: 'PC935', lastDealt: null, lastUsed: null, timesUsed: 0 }]
    const { all } = B.mergePencilStats(here, copy)
    expect(all.find((s) => s.code === 'PC901')).toEqual({ code: 'PC901', lastDealt: '2026-10-01', lastUsed: '2026-10-05', timesUsed: 4 })
    expect(all).toHaveLength(2)
  })

  it('keeps the newer of two records with the same id', () => {
    const here = [{ id: 'a', updatedAt: '2026-10-10', v: 'here' }]
    expect(B.mergeById(here, [{ id: 'a', updatedAt: '2026-10-01', v: 'copy' }]).all[0].v).toBe('here')
    expect(B.mergeById(here, [{ id: 'a', updatedAt: '2026-10-11', v: 'copy' }]).all[0].v).toBe('copy')
  })

  it('leaves one face per card, preferring the one already here', () => {
    const seals = [
      { id: 'a', cardId: 'c1', isFace: true },
      { id: 'b', cardId: 'c1', isFace: true },
      { id: 'c', cardId: 'c2', isFace: true },
    ]
    B.settleFaces(seals, new Set(['a']))
    expect(seals.map((s) => s.isFace)).toEqual([true, false, true])
  })

  it('only restores settings it knows, of the right kind', () => {
    expect(B.cleanSettings({ backName: 'x'.repeat(40), sound: 'yes', hemisphere: 'east', smallCount: 4, mystery: 1 }))
      .toEqual({ backName: 'x'.repeat(24), smallCount: 4 })
  })
})

describe('settings copy', () => {
  it('says when the last copy was saved in plain words', async () => {
    const { friendlyDate } = await import('../../src/ui/settings.js')
    const now = new Date(2026, 9, 17, 20, 0)
    expect(friendlyDate(new Date(2026, 9, 17, 8, 0).toISOString(), now)).toBe('Today')
    expect(friendlyDate(new Date(2026, 9, 16, 23, 0).toISOString(), now)).toBe('Yesterday')
    expect(friendlyDate(new Date(2026, 8, 3, 12, 0).toISOString(), now)).toBe('3 September 2026')
    expect(friendlyDate('not a date', now)).toBe('')
  })
})
