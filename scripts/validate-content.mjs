#!/usr/bin/env node
// Validates the hand-written card content against docs/content-spec.md.
// Usage:
//   node scripts/validate-content.mjs                 validate everything in src/data/cards
//   node scripts/validate-content.mjs path/to/a.json  validate specific files (schema only)
import { readFileSync, readdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CARDS_DIR = join(ROOT, 'src/data/cards')

export const VOCAB = {
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  timeOfDay: ['dawn', 'morning', 'afternoon', 'dusk', 'night'],
  scale: ['tiny', 'small', 'medium', 'large'],
  habitats: ['home', 'tabletop', 'garden', 'hedgerow', 'woodland', 'meadow', 'water', 'coast', 'farm', 'village', 'visitor'],
  doingScope: ['any', 'indoor', 'outdoor'],
  whereScope: ['indoor', 'outdoor', 'threshold'],
  whenScope: ['any', 'indoor', 'outdoor'],
  active: ['day', 'night', 'any'],
  mood: ['warm', 'cool', 'muted', 'dark', 'bright'],
  texture: ['fur', 'feather', 'skin', 'shell', 'wing', 'petal', 'foliage', 'bark', 'stone', 'ceramic', 'glass', 'metal', 'fabric', 'wool', 'wood', 'paper', 'crust', 'fruit', 'liquid'],
  frames: ['vignette', 'window', 'low-horizon', 'close-crop', 'from-above', 'thirds', 'tall-strip', 'postage-stamp', 'three-studies', 'sampler'],
  palette: ['moon', 'hearthfire', 'sepia', 'two', 'three', 'mono', 'cool', 'warm', 'complement'],
  paper: ['dark', 'tan', 'grey', 'white'],
  families: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'grey', 'black', 'white', 'metallic'],
}

const BANNED = ['delve', 'tapestry', 'crucial', 'bustling', 'seamless', 'testament', 'landscape', 'multifaceted', 'paramount', 'underscore', 'utilize', 'utilise', 'journey', 'vibrant', 'whimsical', 'enchanting', 'magical', 'nestled', 'destiny', 'fate']
const AMERICAN = [/\bcolor/i, /\bcozy\b/i, /\bgray\b/i, /\bfavorite/i, /\bmom\b/i, /\bcookie/i, /\bsweater/i, /\bfall\b(?! asleep)/i, /\bcenter\b/i, /\bneighbor/i, /\bflavor/i, /\bjewelry\b/i]
const HEX = /^#[0-9A-Fa-f]{6}$/
const SUBJECT_SUITS = ['fur', 'leaf', 'hearth']
const SCALE_RANK = { tiny: 0, small: 1, medium: 2, large: 3 }
const REQUIRE_ACCENT = process.env.REQUIRE_ACCENT === '1' 

class Report {
  constructor() { this.errors = []; this.warnings = [] }
  err(where, msg) { this.errors.push(`${where}: ${msg}`) }
  warn(where, msg) { this.warnings.push(`${where}: ${msg}`) }
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isArr = (v, min = 0, max = Infinity) => Array.isArray(v) && v.length >= min && v.length <= max

function checkText(r, where, text) {
  if (typeof text !== 'string') return
  if (/[—–]/.test(text)) r.err(where, `contains an em or en dash: "${text}"`)
  if (/ {2,}/.test(text)) r.err(where, `double space: "${text}"`)
  if (text !== text.trim()) r.err(where, `leading or trailing whitespace: "${text}"`)
  for (const w of BANNED) if (new RegExp(`\\b${w}`, 'i').test(text)) r.err(where, `banned word "${w}": "${text}"`)
  for (const re of AMERICAN) if (re.test(text)) r.warn(where, `possible American spelling (${re}): "${text}"`)
  if (/\ba [aeiou]/i.test(text) && !/\ba (one|uni|use|usu|eu|ewe|u[bkrst][aeiou])/i.test(text)) r.warn(where, `check article "a" before vowel: "${text}"`)
  if (/\ban [^aeiouh\s]/i.test(text)) r.warn(where, `check article "an" before consonant: "${text}"`)
}

function walkText(r, where, value) {
  if (typeof value === 'string') checkText(r, where, value)
  else if (Array.isArray(value)) value.forEach((v, i) => walkText(r, `${where}[${i}]`, v))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    if (k === 'colours' || k === 'id') continue
    walkText(r, `${where}.${k}`, v)
  }
}

function inVocab(r, where, value, list, field) {
  if (!list.includes(value)) r.err(where, `${field} "${value}" is not one of: ${list.join(', ')}`)
}

function checkArrVocab(r, where, arr, list, field, min = 1, max = Infinity) {
  if (!isArr(arr, min, max)) { r.err(where, `${field} must be an array of ${min}..${max}`); return }
  arr.forEach((v) => inVocab(r, where, v, list, field))
  if (new Set(arr).size !== arr.length) r.err(where, `${field} has duplicates`)
}

function checkFragments(r, where, arr, field = 'phrases', min = 2, max = 3) {
  if (!isArr(arr, min, max)) return r.err(where, `${field} must have ${min}..${max} entries`)
  arr.forEach((p) => {
    if (!isStr(p)) return r.err(where, `${field} entry must be a string`)
    if (/[.!?]$/.test(p)) r.err(where, `${field} fragment should not end with punctuation: "${p}"`)
    const words = p.split(/\s+/).length
    if (words > 8) r.warn(where, `${field} fragment is long (${words} words): "${p}"`)
  })
}

function checkSentence(r, where, s) {
  if (!isStr(s)) return r.err(where, 'must be a non-empty string')
  if (!/^[A-Z“"']/.test(s)) r.err(where, `sentence should start with a capital: "${s}"`)
  if (!/[.!?]["”']?$/.test(s)) r.err(where, `sentence should end with a full stop: "${s}"`)
}

function checkRole(r, where, s) {
  if (!isStr(s) || !s.startsWith('for the ')) r.err(where, `role line must start with "for the ": "${s}"`)
  else if (/[.!?]$/.test(s)) r.err(where, `role line should not end with punctuation: "${s}"`)
}

function checkColours(r, where, arr, min, max) {
  if (!isArr(arr, min, max)) return r.err(where, `colours must have ${min}..${max} hex values`)
  arr.forEach((c) => { if (!HEX.test(c)) r.err(where, `bad hex "${c}"`) })
}

function checkFirstMark(r, where, f) {
  checkSentence(r, where + '.firstMark', f)
  if (!/\{(dark|main|accent)\}/.test(f)) r.err(where, `firstMark must contain {dark}, {main} or {accent}: "${f}"`)
  const other = f.replace(/\{(dark|main|accent)\}/g, '').match(/\{[^}]*\}/)
  if (other) r.err(where, `firstMark has an unknown slot ${other[0]}`)
}

export function validateSubject(r, card, where) {
  if (!isStr(card.id) || !/^(fur|leaf|hearth)-[a-z0-9-]+$/.test(card.id)) r.err(where, `bad id "${card.id}"`)
  if (!SUBJECT_SUITS.includes(card.suit)) r.err(where, `bad suit "${card.suit}"`)
  else if (!card.id?.startsWith(card.suit + '-')) r.err(where, 'id prefix must match suit')
  if (!isStr(card.title) || !/^(The|A|An|Some) [A-Z]/.test(card.title)) r.err(where, `title should be title case starting "The ": "${card.title}"`)
  if (!isStr(card.a) || !/^(a|an|some|two|three|four|five|six) [a-z]/.test(card.a)) r.err(where, `"a" must be a lowercase noun phrase starting with an article: "${card.a}"`)
  if (!isStr(card.the) || !/^the [a-z]/.test(card.the)) r.err(where, `"the" must start with "the ": "${card.the}"`)
  checkFragments(r, where, card.phrases)
  if (!isArr(card.doing, 3, 8)) r.err(where, 'doing must have 3..8 entries')
  else {
    let universal = 0
    card.doing.forEach((d, i) => {
      const w = `${where}.doing[${i}]`
      if (!isStr(d.t)) return r.err(w, 'missing t')
      if (/[.!?,;:]$/.test(d.t)) r.err(w, `doing should not end with punctuation: "${d.t}"`)
      if (/^[A-Z]/.test(d.t)) r.err(w, `doing should start lowercase: "${d.t}"`)
      inVocab(r, w, d.scope, VOCAB.doingScope, 'scope')
      if (d.seasons !== undefined) checkArrVocab(r, w, d.seasons, VOCAB.seasons, 'seasons')
      if (d.scope === 'any' && d.seasons === undefined) universal++
      // Optional per-doing overrides, for poses that change what can be seen.
      if (d.close !== undefined) {
        if (!isArr(d.close, 1, 2)) r.err(w, 'doing.close must have 1..2 sentences')
        else d.close.forEach((c) => { checkSentence(r, w + '.close', c); if (!/^(Just|Only)\b/.test(c)) r.err(w, `close should start with "Just" or "Only": "${c}"`) })
      }
      if (d.firstMark !== undefined) {
        if (!isArr(d.firstMark, 1, 3)) r.err(w, 'doing.firstMark must have 1..3 sentences')
        else d.firstMark.forEach((f) => checkFirstMark(r, w, f))
      }
      if (d.roles !== undefined) {
        if (!d.roles || typeof d.roles !== 'object') r.err(w, 'doing.roles must be an object')
        else for (const [k, v] of Object.entries(d.roles)) {
          if (!['main', 'dark', 'light', 'accent'].includes(k)) r.err(w, `doing.roles.${k} is not a role`)
          checkRole(r, `${w}.roles.${k}`, v)
        }
      }
      if (/\b(spring|summer|autumn|winter|tonight|morning|evening|midnight|rain|snow|frost|sunshine|windowsill|meadow|garden|kitchen)\b/i.test(d.t)) r.warn(w, `doing may contain a time, weather or place: "${d.t}"`)
    })
    if (universal < 2) r.err(where, 'needs at least 2 doing phrases with scope "any" and no season restriction')
  }
  if (!isArr(card.close, 1, 2)) r.err(where, 'close must have 1..2 sentences')
  else card.close.forEach((c) => { checkSentence(r, where + '.close', c); if (!/^(Just|Only)\b/.test(c)) r.err(where, `close should start with "Just" or "Only": "${c}"`) })
  inVocab(r, where, card.scale, VOCAB.scale, 'scale')
  checkArrVocab(r, where, card.habitats, VOCAB.habitats, 'habitats', 1, 6)
  checkArrVocab(r, where, card.seasons, VOCAB.seasons, 'seasons')
  inVocab(r, where, card.active, VOCAB.active, 'active')
  checkColours(r, where, card.colours, 1, 3)
  if (REQUIRE_ACCENT && card.accent === undefined) r.err(where, 'accent hex missing')
  if (card.accent !== undefined && !HEX.test(card.accent)) r.err(where, `bad accent hex "${card.accent}"`)
  inVocab(r, where, card.texture, VOCAB.texture, 'texture')
  if (!card.roles || typeof card.roles !== 'object') r.err(where, 'roles missing')
  else for (const k of ['main', 'dark', 'light', 'accent']) checkRole(r, `${where}.roles.${k}`, card.roles[k])
  if (!isArr(card.firstMark, 1, 3)) r.err(where, 'firstMark must have 1..3 sentences')
  else card.firstMark.forEach((f) => checkFirstMark(r, where, f))
  if (card.colourWords !== undefined && !(isArr(card.colourWords, 1, 4) && card.colourWords.every((w) => isStr(w) && w === w.toLowerCase()))) r.err(where, 'colourWords must be 1..4 lowercase words')
  walkText(r, where, card)
}

export function validateWhere(r, card, where) {
  if (!isStr(card.id) || !/^where-[a-z0-9-]+$/.test(card.id)) r.err(where, `bad id "${card.id}"`)
  if (!isStr(card.title) || !/^[A-Z]/.test(card.title)) r.err(where, 'title must be title case')
  if (!isStr(card.at) || !/^[a-z]/.test(card.at)) r.err(where, `"at" must be a lowercase phrase: "${card.at}"`)
  else if (!/^(on|in|under|beside|by|among|amongst|behind|at|inside|across|along|between|against|beneath|near|outside|halfway|up|down|over|below|above|around|through|within|on top of|underneath|next to|just|deep|high|low|out|round|alongside|upon)\b/.test(card.at)) r.err(where, `"at" should begin with a preposition: "${card.at}"`)
  if (/[.!?,]$/.test(card.at || '')) r.err(where, '"at" should not end with punctuation')
  checkFragments(r, where, card.phrases)
  inVocab(r, where, card.scope, VOCAB.whereScope, 'scope')
  checkArrVocab(r, where, card.admits, VOCAB.habitats, 'admits', 1, 7)
  inVocab(r, where, card.maxScale, VOCAB.scale, 'maxScale')
  checkArrVocab(r, where, card.seasons, VOCAB.seasons, 'seasons')
  checkArrVocab(r, where, card.frames, VOCAB.frames, 'frames', 1, 3)
  checkColours(r, where, card.colours, 1, 2)
  checkRole(r, where + '.role', card.role)
  if (card.window !== undefined && typeof card.window !== 'boolean') r.err(where, 'window must be true or false')
  if (card.window && card.scope !== 'indoor') r.warn(where, 'window only matters for indoor places')
  if (card.excludes !== undefined && !(Array.isArray(card.excludes) && card.excludes.every((x) => /^(fur|leaf|hearth)-[a-z0-9-]+$/.test(x)))) r.err(where, 'excludes must be an array of subject ids')
  walkText(r, where, card)
}

export function validateWhen(r, card, where) {
  if (!isStr(card.id) || !/^when-[a-z0-9-]+$/.test(card.id)) r.err(where, `bad id "${card.id}"`)
  if (!isStr(card.title) || !/^[A-Z]/.test(card.title)) r.err(where, 'title must be title case')
  if (!isStr(card.when) || !/^[a-z]/.test(card.when)) r.err(where, `"when" must be a lowercase phrase: "${card.when}"`)
  if (/[.!?,]$/.test(card.when || '')) r.err(where, '"when" should not end with punctuation')
  checkFragments(r, where, card.phrases)
  checkSentence(r, where + '.note', card.note)
  checkArrVocab(r, where, card.seasons, VOCAB.seasons, 'seasons')
  checkArrVocab(r, where, card.timeOfDay, VOCAB.timeOfDay, 'timeOfDay', 1, 5)
  inVocab(r, where, card.scope, VOCAB.whenScope, 'scope')
  inVocab(r, where, card.mood, VOCAB.mood, 'mood')
  checkSentence(r, where + '.light', card.light)
  checkRole(r, where + '.shadow', card.shadow)
  checkRole(r, where + '.highlight', card.highlight)
  if (card.sky !== undefined && typeof card.sky !== 'boolean') r.err(where, 'sky must be true or false')
  walkText(r, where, card)
}

export function validateTwist(r, card, where) {
  if (!isStr(card.id) || !/^twist-[a-z0-9-]+$/.test(card.id)) r.err(where, `bad id "${card.id}"`)
  if (!isStr(card.title) || !/^[A-Z]/.test(card.title)) r.err(where, 'title must be title case')
  checkSentence(r, where + '.rule', card.rule)
  checkFragments(r, where, card.phrases)
  const e = card.effects
  if (!e || typeof e !== 'object') return r.err(where, 'effects must be an object (can be empty)')
  const allowed = ['scale', 'palette', 'maxPencils', 'frame', 'paper', 'requires']
  for (const k of Object.keys(e)) if (!allowed.includes(k)) r.err(where, `unknown effect "${k}"`)
  if (e.scale !== undefined && e.scale !== 'any') r.err(where, 'effects.scale must be "any"')
  if (e.palette !== undefined) inVocab(r, where, e.palette, VOCAB.palette, 'effects.palette')
  if (e.maxPencils !== undefined && !(Number.isInteger(e.maxPencils) && e.maxPencils >= 1 && e.maxPencils <= 5)) r.err(where, 'effects.maxPencils must be 1..5')
  if (e.frame !== undefined) inVocab(r, where, e.frame, VOCAB.frames, 'effects.frame')
  if (e.paper !== undefined) inVocab(r, where, e.paper, VOCAB.paper, 'effects.paper')
  if (e.requires !== undefined && e.requires !== 'seal') r.err(where, 'effects.requires must be "seal"')
  walkText(r, where, card)
}

export function validateTheme(r, card, where) {
  if (!isStr(card.id) || !/^theme-[a-z0-9-]+$/.test(card.id)) r.err(where, `bad id "${card.id}"`)
  if (!isStr(card.title) || !/^[A-Z]/.test(card.title)) r.err(where, 'title must be title case')
  if (!isStr(card.of) || !/^[a-z]/.test(card.of)) r.err(where, `"of" must be a lowercase phrase: "${card.of}"`)
  checkFragments(r, where, card.phrases)
  checkArrVocab(r, where, card.seasons, VOCAB.seasons, 'seasons')
  inVocab(r, where, card.mood, VOCAB.mood, 'mood')
  checkColours(r, where, card.colours, 2, 3)
  if (!isArr(card.slots, 10, 12)) r.err(where, 'slots must have 10..12 entries')
  else card.slots.forEach((s) => {
    if (!isStr(s) || /^[A-Z]/.test(s) || /[.!?]$/.test(s)) r.err(where, `slot must be a lowercase noun phrase with no full stop: "${s}"`)
    const words = s.split(/\s+/).length
    if (words < 2 || words > 12) r.warn(where, `slot length ${words} words: "${s}"`)
  })
  if (isArr(card.slots) && new Set(card.slots).size !== card.slots.length) r.err(where, 'duplicate slots')
  walkText(r, where, card)
}

function validateLines(r, data, where) {
  const want = { askAgain: 15, spreadOut: 4, sealed: 15, drawnNoPhoto: 8, oldFriend: 10, deckIdea: 8, noRush: 4, smallTins: 3 }
  for (const [k, n] of Object.entries(want)) {
    if (!isArr(data[k], n)) r.err(where, `${k} needs at least ${n} lines`)
    else data[k].forEach((s) => checkSentence(r, `${where}.${k}`, s.replace(/\{[a-z]+\}/g, 'X')))
  }
  data.sealed?.forEach((s) => { if (!s.includes('{title}')) r.err(where, `sealed line needs {title}: "${s}"`) })
  data.oldFriend?.forEach((s) => { if (!s.includes('{name}') || !s.includes('{month}')) r.err(where, `oldFriend needs {name} and {month}: "${s}"`) })
  if (!data.lonely || Object.keys(data.lonely).length < 20) r.err(where, 'lonely needs at least 20 pencils')
  else for (const [code, lines] of Object.entries(data.lonely)) {
    if (!/^PC\d{3,4}$/.test(code)) r.err(where, `lonely key "${code}" is not a PC code`)
    if (!isArr(lines, 1)) r.err(where, `lonely.${code} needs lines`)
  }
  if (!data.lonelyFamily) r.err(where, 'lonelyFamily missing')
  else for (const f of VOCAB.families) {
    if (!isArr(data.lonelyFamily[f], 1)) r.err(where, `lonelyFamily.${f} missing`)
    else data.lonelyFamily[f].forEach((s) => { if (!s.includes('{name}')) r.err(where, `lonelyFamily.${f} needs {name}: "${s}"`) })
  }
  walkText(r, where, data)
}

function validateTips(r, data, where) {
  if (!data.textures) return r.err(where, 'textures missing')
  for (const t of VOCAB.texture) {
    if (!isArr(data.textures[t], 3, 3)) r.err(where, `textures.${t} needs exactly 3 steps`)
    else data.textures[t].forEach((s) => checkSentence(r, `${where}.textures.${t}`, s))
  }
  if (!data.glossary || Object.keys(data.glossary).length < 10) r.err(where, 'glossary needs at least 10 terms')
  for (const p of VOCAB.paper) if (!isStr(data.paper?.[p])) r.err(where, `paper.${p} missing`)
  walkText(r, where, data)
}

function validatePalettes(r, data, where) {
  const all = []
  for (const m of VOCAB.mood) {
    if (!isArr(data[m], 8)) r.err(where, `${m} needs at least 8 names`)
    else data[m].forEach((entry) => {
      const n = typeof entry === 'string' ? entry : entry?.name
      if (!isStr(n)) return r.err(where, `${m}: each entry is a name or { name, seasons?, times? }`)
      all.push(n)
      if (!/^[A-Z]/.test(n)) r.err(where, `palette name should be title case: "${n}"`)
      if (typeof entry === 'object') {
        if (entry.seasons !== undefined) checkArrVocab(r, `${where}.${m}.${n}`, entry.seasons, VOCAB.seasons, 'seasons')
        if (entry.times !== undefined) checkArrVocab(r, `${where}.${m}.${n}`, entry.times, VOCAB.timeOfDay, 'times')
      }
    })
  }
  if (new Set(all).size !== all.length) r.err(where, 'duplicate palette names')
  walkText(r, where, data)
}

export function kindOf(file) {
  const b = basename(file)
  if (/^(fur|leaf|hearth)\b/.test(b)) return 'subject'
  if (/^where\b/.test(b)) return 'where'
  if (/^when\b/.test(b)) return 'when'
  if (/^twists?\b/.test(b)) return 'twist'
  if (/^themes?\b/.test(b)) return 'theme'
  if (/^lines\b/.test(b)) return 'lines'
  if (/^tips\b/.test(b)) return 'tips'
  if (/^palettes\b/.test(b)) return 'palettes'
  return null
}

const CARD_VALIDATORS = { subject: validateSubject, where: validateWhere, when: validateWhen, twist: validateTwist, theme: validateTheme }

export function validateFile(r, file) {
  let data
  try { data = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { r.err(file, `invalid JSON: ${e.message}`); return null }
  const kind = kindOf(file)
  const name = basename(file)
  if (!kind) { r.warn(name, 'unknown file kind, skipped'); return null }
  if (CARD_VALIDATORS[kind]) {
    if (!Array.isArray(data)) { r.err(name, 'must be a JSON array of cards'); return null }
    data.forEach((c, i) => CARD_VALIDATORS[kind](r, c, `${name}[${i}] ${c?.id ?? ''}`))
  } else if (kind === 'lines') validateLines(r, data, name)
  else if (kind === 'tips') validateTips(r, data, name)
  else if (kind === 'palettes') validatePalettes(r, data, name)
  return { kind, data }
}

// Cross-file checks: unique ids and that every combination has enough partners.
function crossCheck(r, byKind) {
  const subjects = byKind.subject || []
  const wheres = byKind.where || []
  const whens = byKind.when || []
  const all = [...subjects, ...wheres, ...whens, ...(byKind.twist || []), ...(byKind.theme || [])]
  const seen = new Map()
  for (const c of all) {
    if (seen.has(c.id)) r.err('ids', `duplicate id ${c.id}`)
    seen.set(c.id, true)
  }
  const titles = new Map()
  for (const c of [...subjects, ...wheres, ...whens]) {
    const t = c.title?.toLowerCase()
    if (titles.has(t)) r.warn('titles', `duplicate title "${c.title}" (${titles.get(t)} and ${c.id})`)
    titles.set(t, c.id)
  }
  const subjectIds = new Set(subjects.map((s) => s.id))
  for (const p of wheres) for (const x of p.excludes || []) if (!subjectIds.has(x)) r.err(p.id, `excludes unknown subject ${x}`)
  const fits = (s, p, season) => {
    if (!s.seasons.includes(season) || !p.seasons.includes(season)) return false
    if (p.excludes?.includes(s.id)) return false
    if (!s.habitats.some((h) => p.admits.includes(h))) return false
    if (SCALE_RANK[s.scale] > SCALE_RANK[p.maxScale]) return false
    return s.doing.some((d) => (!d.seasons || d.seasons.includes(season)) && (d.scope === 'any' || p.scope === 'threshold' || d.scope === p.scope))
  }
  for (const season of VOCAB.seasons) {
    for (const p of wheres) {
      const n = subjects.filter((s) => fits(s, p, season)).length
      if (p.seasons.includes(season) && n < 6) r.err(`coverage ${season}`, `${p.id} has only ${n} compatible subjects`)
    }
    for (const s of subjects) {
      if (!s.seasons.includes(season)) continue
      const n = wheres.filter((p) => fits(s, p, season)).length
      if (n < 3) r.err(`coverage ${season}`, `${s.id} fits only ${n} places`)
    }
    const w = whens.filter((h) => h.seasons.includes(season)).length
    if (whens.length && w < 6) r.err(`coverage ${season}`, `only ${w} When cards`)
    const sub = subjects.filter((s) => s.seasons.includes(season))
    for (const suit of SUBJECT_SUITS) {
      const n = sub.filter((s) => s.suit === suit).length
      if (subjects.length && n < 10) r.warn(`coverage ${season}`, `only ${n} ${suit} subjects`)
    }
  }
  // Every place needs enough hours that fit it (same rule as the engine).
  const hourFits = (h, p, season) => {
    if (!h.seasons.includes(season)) return false
    if (h.scope === 'indoor') return p.scope === 'indoor'
    if (h.sky && p.scope === 'indoor' && !p.window) return false
    return h.scope === 'any' || p.scope === 'threshold' || h.scope === p.scope
  }
  for (const season of VOCAB.seasons) for (const p of wheres) {
    if (!p.seasons.includes(season)) continue
    const n = whens.filter((h) => hourFits(h, p, season)).length
    if (whens.length && n < 5) r.err(`coverage ${season}`, `${p.id} has only ${n} hours that fit`)
  }
  for (const t of VOCAB.timeOfDay) {
    const n = whens.filter((h) => h.timeOfDay.includes(t)).length
    if (whens.length && n < 5) r.err('coverage time', `only ${n} When cards at ${t}`)
  }
  // Every scope combination must exist so indoor and outdoor places both get hours.
  for (const scope of ['indoor', 'outdoor']) {
    const n = whens.filter((h) => h.scope === 'any' || h.scope === scope).length
    if (whens.length && n < 10) r.err('coverage scope', `only ${n} When cards usable ${scope}`)
  }
}

function main() {
  const r = new Report()
  const args = process.argv.slice(2)
  const files = args.length ? args : readdirSync(CARDS_DIR).filter((f) => f.endsWith('.json')).map((f) => join(CARDS_DIR, f))
  const byKind = {}
  for (const f of files) {
    const res = validateFile(r, f)
    if (res && Array.isArray(res.data)) (byKind[res.kind] ||= []).push(...res.data)
  }
  if (!args.length) crossCheck(r, byKind)
  const counts = Object.entries(byKind).map(([k, v]) => `${k}=${v.length}`).join(' ')
  for (const w of r.warnings) console.log(`warn  ${w}`)
  for (const e of r.errors) console.log(`ERROR ${e}`)
  console.log(`\n${files.length} files, ${counts || 'no cards'}; ${r.errors.length} errors, ${r.warnings.length} warnings`)
  process.exit(r.errors.length ? 1 : 0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
