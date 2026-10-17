// Deals a reading: the cards, the sentence, the pencils and the first mark.
// A reading is a pure function of its seed, the tin, the date, the hemisphere
// and the history snapshot, so every reading can be reproduced exactly.
import { subRng, weightedPick, pick, shuffle, hashString } from './rng.js'
import { seasonFor, timeOfDayFor, monthName, SEASON_MOOD } from './seasons.js'
import { usableDoings, subjectFitsPlace, whenFitsPlace, companionFits } from './compat.js'
import { MAIN_TEMPLATES, QUICK_TEMPLATES, COMPANION_TEMPLATES, fill, tidy, capitalise } from './templates.js'
import { dealPalette, refitRoles, anchorFor } from './harmony.js'
import { applyLonely } from './lonely.js'

export const SPREADS = {
  quick: { key: 'quick', label: 'A quick doodle', hint: '10 min', positions: ['who'] },
  evening: { key: 'evening', label: 'A cosy evening', hint: 'an hour or so', positions: ['who', 'where', 'when'] },
  big: { key: 'big', label: 'Something big', hint: 'a proper piece', positions: ['who', 'where', 'when', 'also', 'twist'] },
  small: { key: 'small', label: 'A page of small things', hint: 'little vignettes', positions: ['theme'] },
}

export const POSITION_LABELS = {
  who: 'Who or what',
  where: 'Where',
  when: 'When',
  also: 'Also in the picture',
  twist: 'Twist',
  theme: 'Small things',
}

const NUMBER_WORDS = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' }
const RECENT_WINDOW = 30
const OLD_FRIEND_CHANCE = 1 / 6
const EVENING_TWIST_CHANCE = 0.15
const NOTE_CHANCE = 0.45

// Build quick lookups once per content load.
export function indexContent(raw) {
  const byId = new Map()
  for (const list of [raw.subjects, raw.wheres, raw.whens, raw.twists, raw.themes]) {
    for (const c of list || []) byId.set(c.id, c)
  }
  return { ...raw, byId }
}

export function seasonOf(ctx) {
  return ctx.followSeasons === false ? null : seasonFor(ctx.date, ctx.hemisphere)
}

function seasonWeight(card, season) {
  if (!season || !card.seasons || card.seasons.length >= 4) return 1
  return card.seasons.includes(season) ? 3 : 0
}

function recentIds(ctx, position, n) {
  const ids = new Set()
  for (const r of (ctx.history?.recent || []).slice(0, n)) {
    const id = r.cards?.[position]
    if (id) ids.add(id)
  }
  return ids
}

// Weighted pick that avoids cards seen recently in the same position.
function pickFresh(rng, items, weightOf, ctx, position, exclude = []) {
  const live = items.filter((c) => !exclude.includes(c.id) && weightOf(c) > 0)
  if (!live.length) return undefined
  const windowSize = Math.min(RECENT_WINDOW, Math.floor(live.length / 2))
  const recent = recentIds(ctx, position, windowSize)
  const fresh = live.filter((c) => !recent.has(c.id))
  return weightedPick(rng, fresh.length ? fresh : live, weightOf)
}

function sealedSubjectIds(ctx) {
  const ids = []
  for (const s of ctx.history?.seals || []) {
    const card = ctx.content.byId.get(s.cardId)
    if (card?.suit && !ids.includes(s.cardId)) ids.push(s.cardId)
  }
  return ids
}

function firstSealOf(ctx, cardId) {
  const seals = (ctx.history?.seals || []).filter((s) => s.cardId === cardId)
  seals.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  return seals[0]
}

function suitAffinity(ctx) {
  const counts = ctx.history?.suitCounts || {}
  let top = null
  let max = 0
  for (const [suit, n] of Object.entries(counts)) if (n > max) { max = n; top = suit }
  return (card) => (top && card.suit === top && max >= 2 ? 1.25 : 1)
}

const ignoreScaleFor = (twist) => twist?.effects?.scale === 'any'

function placesFor(ctx, who, twist, season) {
  return ctx.content.wheres.filter((w) => subjectFitsPlace(who, w, season, { ignoreScale: ignoreScaleFor(twist) }))
}

function pickWho(ctx, rng, { spread, twist, season, exclude = [], forceOldFriend = false, allowOldFriend = true }) {
  const { subjects } = ctx.content
  const needsPlace = spread !== 'quick'
  const affinity = suitAffinity(ctx)
  const usable = (s) => (needsPlace ? placesFor(ctx, s, twist, season).length > 0 : usableDoings(s, undefined, season).length > 0)
  const weightOf = (s) => (usable(s) ? seasonWeight(s, season) * affinity(s) : 0)

  const sealed = sealedSubjectIds(ctx).filter((id) => !exclude.includes(id))
  const wantOldFriend = forceOldFriend || (allowOldFriend && sealed.length >= 3 && rng() < OLD_FRIEND_CHANCE)
  if (wantOldFriend && sealed.length) {
    const friends = sealed.map((id) => ctx.content.byId.get(id)).filter((s) => s && usable(s))
    const friend = pick(rng, friends)
    if (friend) {
      const seal = firstSealOf(ctx, friend.id)
      return { card: friend, oldFriend: { cardId: friend.id, month: monthName(seal?.createdAt || ctx.date) } }
    }
  }
  return { card: pickFresh(rng, subjects, weightOf, ctx, 'who', exclude), oldFriend: null }
}

function pickWhere(ctx, rng, { who, twist, season, exclude = [] }) {
  const places = placesFor(ctx, who, twist, season).filter((w) => ctx.content.whens.some((h) => whenFitsPlace(h, w, season)))
  return pickFresh(rng, places, (w) => seasonWeight(w, season), ctx, 'where', exclude)
}

function pickWhen(ctx, rng, { who, where, season, twist, exclude = [] }) {
  const tod = timeOfDayFor(ctx.date)
  const rule = twist?.effects?.palette
  const weightOf = (h) => {
    if (!whenFitsPlace(h, where, season)) return 0
    let w = seasonWeight(h, season)
    if (h.timeOfDay.includes(tod)) w *= 1.5
    const evening = h.timeOfDay.some((t) => t === 'dusk' || t === 'night')
    // Keep day creatures out of the dark and night creatures out of broad
    // daylight (a tiny weight remains so a deal can never get stuck).
    const afterDark = h.timeOfDay.includes('night') && h.timeOfDay.every((t) => t === 'dusk' || t === 'night')
    const broadDay = h.timeOfDay.every((t) => t === 'morning' || t === 'afternoon')
    if (who?.active === 'night' && evening) w *= 2
    if (who?.active === 'day' && afterDark) w *= 0.02
    if (who?.active === 'night' && broadDay) w *= 0.04
    // Moonlight wants a night; warm-only and cool-only palettes want hours that agree.
    if (rule === 'moon') w *= evening ? 4 : 0.05
    if ((rule === 'hearthfire' || rule === 'warm') && h.mood === 'cool') w *= 0.1
    if (rule === 'cool' && h.mood === 'warm') w *= 0.1
    return w
  }
  return pickFresh(rng, ctx.content.whens, weightOf, ctx, 'when', exclude)
}

function pickAlso(ctx, rng, { who, where, twist, season, exclude = [] }) {
  const opts = { ignoreScale: ignoreScaleFor(twist) }
  const weightOf = (c) => (companionFits(c, who, where, season, opts) ? seasonWeight(c, season) : 0)
  return pickFresh(rng, ctx.content.subjects, weightOf, ctx, 'also', exclude)
}

function pickTwist(ctx, rng, { exclude = [] }) {
  const hasSeals = sealedSubjectIds(ctx).length > 0
  const weightOf = (t) => (t.effects?.requires === 'seal' && !hasSeals ? 0 : 1)
  return pickFresh(rng, ctx.content.twists, weightOf, ctx, 'twist', exclude)
}

function pickTheme(ctx, rng, { season, exclude = [] }) {
  return pickFresh(rng, ctx.content.themes, (t) => seasonWeight(t, season), ctx, 'theme', exclude)
}

function pickDoingIndex(rng, who, where, season, current) {
  const options = usableDoings(who, where?.scope, season)
  const fresh = options.filter((d) => who.doing.indexOf(d) !== current)
  const chosen = pick(rng, fresh.length ? fresh : options) || who.doing[0]
  return who.doing.indexOf(chosen)
}

function pickTemplate(ctx, rng, spread) {
  if (spread === 'quick') return QUICK_TEMPLATES[0].id
  const recent = (ctx.history?.recent || []).slice(0, 3).map((r) => r.picks?.template)
  const fresh = MAIN_TEMPLATES.filter((t) => !recent.includes(t.id))
  return pick(rng, fresh.length ? fresh : MAIN_TEMPLATES).id
}

// ---------------------------------------------------------------------------
// Palette slots for a reading.

function nameOf(card) {
  return card.the.replace(/^the /, '')
}

// The subject's detail colour: an explicit accent, or failing that the most
// saturated of its secondary colours that differs from the main one.
function accentHexOf(card) {
  if (card.accent) return card.accent
  const main = anchorFor(card.colours[0])
  let best = null
  for (const hex of card.colours.slice(1)) {
    const a = anchorFor(hex)
    const far = Math.hypot(a.lab.L - main.lab.L, a.lab.a - main.lab.a, a.lab.b - main.lab.b) > 0.1
    if (far && (!best || a.lch.C > best.lch.C)) best = a
  }
  return best && best.lch.C > 0.05 ? best.hex : null
}

export function paletteSlots(reading, ctx) {
  const { byId } = ctx.content
  const twist = reading.cards.twist && byId.get(reading.cards.twist)
  const rule = twist?.effects?.palette
  const when = reading.cards.when && byId.get(reading.cards.when)

  if (reading.spread === 'small') {
    const theme = byId.get(reading.cards.theme)
    const anchorRoles = ['use a little in every picture, to tie the page together', 'for the second main colour', 'for small details']
    const slots = theme.colours.map((hex, i) => ({ key: `a${i}`, kind: i === 0 ? 'main' : 'anchor', anchor: anchorFor(hex), role: anchorRoles[i] }))
    slots.push({ key: 'dark', kind: 'dark', role: 'for the shadows and the outlines' })
    slots.push({ key: 'light', kind: 'light', role: 'for the highlights' })
    return { slots, mood: theme.mood, rule }
  }

  const who = byId.get(reading.cards.who)
  const where = reading.cards.where && byId.get(reading.cards.where)
  const also = reading.cards.also && byId.get(reading.cards.also)
  const mood = rule === 'hearthfire' || rule === 'warm' ? 'warm' : rule === 'cool' ? 'cool' : when?.mood || SEASON_MOOD[reading.season] || 'warm'

  // A doing can carry its own role lines (wings closed hide the eyespots).
  const roles = { ...who.roles, ...(who.doing[reading.picks?.doing]?.roles || {}) }
  const main = { key: 'main', kind: 'main', anchor: anchorFor(who.colours[0]), role: roles.main }
  const dark = { key: 'dark', kind: 'dark', role: when ? when.shadow : roles.dark }
  const light = { key: 'light', kind: 'light', role: when ? when.highlight : roles.light }
  const setting = where && { key: 'setting', kind: 'anchor', anchor: anchorFor(where.colours[0]), role: where.role }
  const accentHex = accentHexOf(who)
  const accent = also
    ? { key: 'accent', kind: 'anchor', anchor: anchorFor(also.colours[0]), role: `for the ${nameOf(also)}` }
    : accentHex && { key: 'accent', kind: 'anchor', anchor: anchorFor(accentHex), role: roles.accent }
  const complement = { key: 'complement', kind: 'complement', role: rule === 'complement' ? 'the opposite colour: layer it over the first for the shadows' : 'for a spark of the opposite colour' }

  let slots
  if (rule === 'two') slots = [main, dark]
  else if (rule === 'complement') slots = [main, complement]
  else if (rule === 'mono') slots = [main, dark, light]
  else if (reading.spread === 'quick') slots = [main, dark, accent || light]
  else if (reading.spread === 'evening') slots = reading.picks.wide ? [main, setting, dark, light] : [main, dark, light]
  else slots = [main, setting, accent || complement, dark, light]
  slots = slots.filter(Boolean)
  if (rule === 'three') slots = slots.slice(0, 3)
  const max = twist?.effects?.maxPencils
  if (max) slots = slots.slice(0, max)
  return { slots, mood, rule, allowMetallic: who.texture === 'metal' }
}

function paletteRng(reading, ...labels) {
  return subRng(reading.seed, 'palette', reading.swaps.paint || 0, ...labels)
}

// Re-deal the pencils. `keepSlots` lists slot keys whose current pencil should
// stay (locked pencils always stay).
function rebuildPalette(reading, ctx, { keepSlots = [], avoid = [] } = {}) {
  const { slots, mood, rule, allowMetallic } = paletteSlots(reading, ctx)
  const keep = {}
  const slotKeys = new Set(slots.map((s) => s.key))
  const locked = new Set()
  for (const p of reading.palette?.pencils || []) {
    if ((p.locked || keepSlots.includes(p.slot)) && slotKeys.has(p.slot)) {
      keep[p.slot] = p.code
      if (p.locked) locked.add(p.code)
    }
  }
  const dealt = dealPalette({ pencils: ctx.pencils, slots, mood, rule, keep, avoid, allowMetallic, rng: paletteRng(reading) })
  const twist = reading.cards.twist && ctx.content.byId.get(reading.cards.twist)
  reading.palette = {
    name: '',
    mood,
    rule: rule || null,
    paper: twist?.effects?.paper || (rule === 'moon' ? 'dark' : rule === 'sepia' ? 'tan' : null),
    bareLights: dealt.bareLights,
    small: ctx.pencils.length <= 3,
    fixed: rule === 'moon' || rule === 'sepia',
    pencils: dealt.pencils.map((p) => ({ ...p, locked: locked.has(p.code) })),
  }
  reading.palette.name = paletteName(reading, ctx, mood)
  return reading
}

// Palette names may be plain strings or { name, seasons?, times? }, so a name
// like "Conker Season" never turns up in spring.
function paletteName(reading, ctx, mood) {
  const list = ctx.content.palettes?.[mood] || ctx.content.palettes?.warm || ['Pencil Tin']
  const when = reading.cards.when && ctx.content.byId.get(reading.cards.when)
  const fits = (n) => typeof n === 'string' || ((!n.seasons || !reading.season || n.seasons.includes(reading.season)) && (!n.times || !when || n.times.some((t) => when.timeOfDay.includes(t))))
  const names = list.filter(fits)
  const chosen = pick(paletteRng(reading, 'name'), names.length ? names : list)
  return typeof chosen === 'string' ? chosen : chosen.name
}

// ---------------------------------------------------------------------------
// Text.

export function renderText(reading, ctx) {
  const { byId, lines, tips } = ctx.content
  const pencilName = (code) => ctx.pencilsByCode?.get(code)?.name || code
  const pencils = reading.palette.pencils
  const darkest = pencils.slice().sort((a, b) => (ctx.pencilsByCode?.get(a.code)?.lch.L ?? 1) - (ctx.pencilsByCode?.get(b.code)?.lch.L ?? 1))[0]
  const mainP = pencils.find((p) => p.slot === 'main' || p.slot === 'a0') || pencils[0]
  const darkP = pencils.find((p) => p.slot === 'dark') || darkest || mainP
  const accentP = pencils.find((p) => p.slot === 'accent' || p.slot === 'a1') || mainP
  const twist = reading.cards.twist && byId.get(reading.cards.twist)
  // A lonely-pencil note only stands while that pencil is still dealt.
  const lonelyStill = reading.lonely && pencils.some((p) => p.code === reading.lonely.code)
  const text = { opener: '', brief: [], sentence: '', framing: '', twist: '', firstMark: '', lightLine: '', paperLine: '', lonelyLine: lonelyStill ? reading.text?.lonelyLine || '' : '', smallTin: '' }

  // The brief: short labelled lines she can scan from beside the paper.
  const brief = []
  if (reading.spread === 'small') {
    const theme = byId.get(reading.cards.theme)
    const count = NUMBER_WORDS[reading.slots?.length] || String(reading.slots?.length || '')
    brief.push({ key: 'draw', label: 'Draw', text: `${count} small things ${theme.of}.` })
    text.sentence = `Small things ${theme.of}.`
    text.firstMark = mainP ? `Start with whichever one you like, and put a little ${pencilName(mainP.code)} in every picture.` : ''
  } else {
    const who = byId.get(reading.cards.who)
    const where = reading.cards.where && byId.get(reading.cards.where)
    const when = reading.cards.when && byId.get(reading.cards.when)
    const also = reading.cards.also && byId.get(reading.cards.also)
    const doing = who.doing[reading.picks.doing] || who.doing[0]
    const subject = reading.oldFriend ? who.the : who.a
    if (reading.oldFriend) {
      const openers = lines?.oldFriend?.length ? lines.oldFriend : ['An old friend: your {name} from {month}.']
      text.opener = fill(openers[reading.picks.opener % openers.length], { name: nameOf(who), month: reading.oldFriend.month })
    }
    const draw = tidy(fill(QUICK_TEMPLATES[0].t, { subject, doing: doing.t }))
    brief.push({ key: 'draw', label: 'Draw', text: draw })
    if (reading.spread === 'quick') {
      const closes = doing.close?.length ? doing.close : who.close
      text.framing = closes[reading.picks.close % closes.length]
      brief.push({ key: 'frame', label: 'Frame', text: text.framing })
      text.sentence = draw
    } else {
      brief.push({ key: 'where', label: 'Where', text: `${capitalise(where.at)}.` })
      brief.push({ key: 'when', label: 'When', text: `${capitalise(when.when)}.` })
      // Under a palette twist the hour's colour advice would contradict the
      // twist ("cool blues" with Warm Colours Only), so the twist speaks alone.
      if (when.light && !reading.palette?.rule) brief.push({ key: 'light', label: 'Light', text: when.light })
      let s = fill(MAIN_TEMPLATES[0].t, { subject, doing: doing.t, at: where.at, when: when.when })
      if (also) {
        const ad = also.doing[reading.picks.alsoDoing] || also.doing[0]
        brief.push({ key: 'also', label: 'Also', text: tidy(fill('{AlsoA} {alsoDoing}.', { alsoA: also.a, alsoDoing: ad.t })) })
        s += ' ' + fill(COMPANION_TEMPLATES[0].t, { alsoA: also.a, alsoDoing: ad.t })
      }
      text.sentence = tidy(s)
    }
    const marks = doing.firstMark?.length ? doing.firstMark : who.firstMark
    text.firstMark = fill(marks[reading.picks.firstMark % marks.length], {
      dark: pencilName(darkP?.code),
      main: pencilName(mainP?.code),
      accent: pencilName(accentP?.code),
    })
  }
  if (twist) brief.push({ key: 'twist', label: 'Twist', text: twist.rule })
  text.brief = brief
  if (twist) text.twist = `Twist: ${twist.rule}`
  if (reading.palette.bareLights && reading.palette.rule !== 'two' && reading.palette.rule !== 'complement') {
    text.lightLine = 'Leave the paper bare for the lights.'
  }
  if (reading.palette.paper && tips?.paper?.[reading.palette.paper]) text.paperLine = tips.paper[reading.palette.paper]
  if (reading.palette.small && lines?.smallTins?.length) text.smallTin = lines.smallTins[reading.seed % lines.smallTins.length]
  reading.text = text
  return reading
}

// ---------------------------------------------------------------------------
// Dealing.

function dealCards(ctx, reading, { fixedWho, fixedTwist } = {}) {
  const season = reading.season
  const s = reading.swaps
  const rngFor = (pos) => subRng(reading.seed, pos, s[pos] || 0)
  const { spread } = reading
  const cards = {}

  if (spread === 'small') {
    const theme = pickTheme(ctx, rngFor('theme'), { season })
    cards.theme = theme.id
    reading.cards = cards
    reading.slots = dealSlots(reading, ctx, theme)
    return reading
  }

  let twist
  if (fixedTwist !== undefined) {
    twist = fixedTwist || undefined
    if (twist) cards.twist = twist.id
  } else if (spread === 'big' || (spread === 'evening' && rngFor('twist-chance')() < EVENING_TWIST_CHANCE)) {
    twist = pickTwist(ctx, rngFor('twist'), {})
    if (twist) cards.twist = twist.id
  }
  const forceOldFriend = twist?.effects?.requires === 'seal'
  const whoPick = fixedWho
    ? { card: fixedWho, oldFriend: null }
    : pickWho(ctx, rngFor('who'), { spread, twist, season, forceOldFriend })
  let who = whoPick.card
  if (!who) throw new Error('No subject could be dealt')
  cards.who = who.id
  reading.oldFriend = whoPick.oldFriend

  let where
  if (spread !== 'quick') {
    where = pickWhere(ctx, rngFor('where'), { who, twist, season })
    if (!where) throw new Error(`No place fits ${who.id}`)
    cards.where = where.id
    const when = pickWhen(ctx, rngFor('when'), { who, where, season, twist })
    if (!when) throw new Error(`No hour fits ${where.id}`)
    cards.when = when.id
  }
  if (spread === 'big') {
    const also = pickAlso(ctx, rngFor('also'), { who, where, twist, season })
    if (also) cards.also = also.id
  }
  reading.cards = cards
  pickPhrases(ctx, reading)
  return reading
}

// Choose the phrase-level variations (doing, template, note, first mark...).
function pickPhrases(ctx, reading, only) {
  const { byId } = ctx.content
  const rng = subRng(reading.seed, 'phrases', reading.swaps.who || 0, reading.swaps.where || 0, reading.swaps.when || 0, reading.swaps.also || 0)
  const who = byId.get(reading.cards.who)
  const where = reading.cards.where && byId.get(reading.cards.where)
  const also = reading.cards.also && byId.get(reading.cards.also)
  const p = reading.picks || {}
  const set = (k, fn) => { if (!only || only.includes(k)) p[k] = fn() }
  set('doing', () => pickDoingIndex(rng, who, where, reading.season, only ? p.doing : undefined))
  set('alsoDoing', () => (also ? also.doing.indexOf(pick(rng, usableDoings(also, where?.scope, reading.season)) || also.doing[0]) : 0))
  set('template', () => pickTemplate(ctx, rng, reading.spread))
  set('companionTemplate', () => Math.floor(rng() * COMPANION_TEMPLATES.length))
  set('note', () => rng() < NOTE_CHANCE)
  set('firstMark', () => Math.floor(rng() * 3))
  set('close', () => Math.floor(rng() * 2))
  set('opener', () => Math.floor(rng() * 12))
  set('wide', () => rng() < 0.5)
  reading.picks = p
}

function dealSlots(reading, ctx, theme) {
  const rng = subRng(reading.seed, 'slots', reading.swaps.theme || 0)
  const count = ctx.settings?.smallCount === 4 ? 4 : 6
  const chosen = shuffle(rng, theme.slots).slice(0, count)
  const wobbly = rng() < 0.35 ? Math.floor(rng() * count) : -1
  return chosen.map((text, i) => ({ text, done: false, ...(i === wobbly ? { wobbly: true } : {}) }))
}

export function buildContext({ content, pencils, date = new Date(), hemisphere = 'north', followSeasons = true, history = {}, pencilStats = {}, installedAt = null, settings = {} }) {
  return {
    content,
    pencils,
    pencilsByCode: new Map(pencils.map((p) => [p.code, p])),
    date,
    hemisphere,
    followSeasons,
    history,
    pencilStats,
    installedAt,
    settings,
  }
}

export function dealReading(ctx, { spread = 'evening', seed, fixedWho, fixedTwist, lonely = true } = {}) {
  if (!SPREADS[spread]) throw new Error(`Unknown spread ${spread}`)
  if (!ctx.pencils.length) throw new Error('The tin is empty')
  const reading = {
    v: 1,
    seed: seed >>> 0,
    spread,
    createdAt: ctx.date.toISOString(),
    season: seasonOf(ctx),
    hemisphere: ctx.hemisphere,
    timeOfDay: timeOfDayFor(ctx.date),
    cards: {},
    picks: {},
    oldFriend: null,
    slots: null,
    swaps: {},
    palette: null,
    text: null,
    status: 'dealt',
  }
  dealCards(ctx, reading, { fixedWho, fixedTwist })
  if (spread === 'small') pickPhrasesSmall(reading)
  rebuildPalette(reading, ctx)
  if (lonely) applyLonely(reading, ctx, subRng(reading.seed, 'lonely'))
  return renderText(reading, ctx)
}

function pickPhrasesSmall(reading) {
  reading.picks = { template: 'small' }
}

// Three face-up options, used when she has reshuffled a lot.
export function dealChoices(ctx, { spread, seed, count = 3 }) {
  const out = []
  const seenKey = new Set()
  for (let k = 0; k < count * 6 && out.length < count; k++) {
    const r = dealReading(ctx, { spread, seed: hashString(`${seed}:choice:${k}`), lonely: false })
    const key = r.cards.who || r.cards.theme
    if (seenKey.has(key)) continue
    seenKey.add(key)
    out.push(r)
  }
  return out
}

const clone = (r) => JSON.parse(JSON.stringify(r))

// Swap exactly one card, keeping the others where they still fit.
export function swapCard(reading, ctx, position) {
  const r = clone(reading)
  const { byId } = ctx.content
  r.swaps[position] = (r.swaps[position] || 0) + 1
  const rng = subRng(r.seed, position, r.swaps[position])
  const season = r.season
  const twist = r.cards.twist && byId.get(r.cards.twist)
  let who = r.cards.who && byId.get(r.cards.who)
  let where = r.cards.where && byId.get(r.cards.where)
  let when = r.cards.when && byId.get(r.cards.when)
  const keepSlots = ['main', 'setting', 'accent', 'complement', 'dark', 'light']
  const drop = (...keys) => keys.forEach((k) => keepSlots.splice(keepSlots.indexOf(k), 1))

  if (position === 'theme') {
    const theme = pickTheme(ctx, rng, { season, exclude: [r.cards.theme] })
    if (theme) { r.cards.theme = theme.id; r.slots = dealSlots(r, ctx, theme) }
    rebuildPalette(r, ctx)
    return renderText(r, ctx)
  }

  if (position === 'who') {
    const mustBeFriend = twist?.effects?.requires === 'seal'
    const fitsCurrent = (s) => (!where || subjectFitsPlace(s, where, season, { ignoreScale: ignoreScaleFor(twist) }))
    let next
    if (mustBeFriend) {
      next = pickWho(ctx, rng, { spread: r.spread, twist, season, exclude: [who.id], forceOldFriend: true })
    } else {
      const candidates = ctx.content.subjects.filter((s) => s.id !== who.id && fitsCurrent(s) && (where || usableDoings(s, undefined, season).length))
      const card = pickFresh(rng, candidates, (s) => seasonWeight(s, season), ctx, 'who')
      next = card ? { card, oldFriend: null } : pickWho(ctx, rng, { spread: r.spread, twist, season, exclude: [who.id], allowOldFriend: false })
    }
    if (next?.card) {
      who = next.card
      r.cards.who = who.id
      r.oldFriend = next.oldFriend
    }
    drop('main', 'accent')
  } else if (position === 'where') {
    const next = pickWhere(ctx, rng, { who, twist, season, exclude: [where.id] })
    if (next) { where = next; r.cards.where = next.id }
    drop('setting')
  } else if (position === 'when') {
    const next = pickWhen(ctx, rng, { who, where, season, twist, exclude: [when.id] })
    if (next) { when = next; r.cards.when = next.id }
    drop('dark', 'light')
  } else if (position === 'also') {
    const next = pickAlso(ctx, rng, { who, where, twist, season, exclude: [r.cards.also] })
    if (next) r.cards.also = next.id
    drop('accent')
  } else if (position === 'twist') {
    const next = pickTwist(ctx, rng, { exclude: [r.cards.twist] })
    if (next) r.cards.twist = next.id
    keepSlots.length = 0
  }

  // Repair anything the swap made incompatible.
  const twistNow = r.cards.twist && byId.get(r.cards.twist)
  if (where && !subjectFitsPlace(who, where, season, { ignoreScale: ignoreScaleFor(twistNow) })) {
    where = pickWhere(ctx, subRng(r.seed, 'repair-where', r.swaps[position]), { who, twist: twistNow, season }) || where
    r.cards.where = where.id
    drop('setting')
  }
  if (when && !whenFitsPlace(when, where, season)) {
    when = pickWhen(ctx, subRng(r.seed, 'repair-when', r.swaps[position]), { who, where, season, twist: twistNow }) || when
    r.cards.when = when.id
    drop('dark', 'light')
  }
  if (r.cards.also) {
    const also = byId.get(r.cards.also)
    if (!companionFits(also, who, where, season, { ignoreScale: ignoreScaleFor(twistNow) })) {
      const next = pickAlso(ctx, subRng(r.seed, 'repair-also', r.swaps[position]), { who, where, twist: twistNow, season })
      if (next) r.cards.also = next.id
      else delete r.cards.also
      drop('accent')
    }
  }
  if (twistNow?.effects?.requires === 'seal' && !r.oldFriend) {
    // A Mirror twist needs one of her own cards in the Who position.
    const friend = pickWho(ctx, subRng(r.seed, 'repair-who', r.swaps[position]), { spread: r.spread, twist: twistNow, season, forceOldFriend: true })
    if (friend.oldFriend) { r.cards.who = friend.card.id; r.oldFriend = friend.oldFriend; who = friend.card }
  }

  // Phrases that depend on the changed cards.
  const doingNow = who.doing[r.picks.doing]
  const scopeNow = where?.scope
  const phrasePicks = []
  if (position === 'who' || !doingNow || !usableDoings(who, scopeNow, season).includes(doingNow)) phrasePicks.push('doing')
  if (r.cards.also) phrasePicks.push('alsoDoing')
  if (phrasePicks.length) pickPhrases(ctx, r, phrasePicks)

  r.swaps.paint = (r.swaps.paint || 0) + 1
  rebuildPalette(r, ctx, { keepSlots })
  return renderText(r, ctx)
}

// New colours, same picture. Locked pencils stay.
export function repaint(reading, ctx) {
  const r = clone(reading)
  r.swaps.paint = (r.swaps.paint || 0) + 1
  const avoid = r.palette.pencils.filter((p) => !p.locked).map((p) => p.code)
  rebuildPalette(r, ctx, { avoid })
  r.text.lonelyLine = ''
  return renderText(r, ctx)
}

// Swap a single pencil for the next best one in its slot.
export function swapPencil(reading, ctx, index) {
  const r = clone(reading)
  const target = r.palette.pencils[index]
  if (!target) return r
  r.swaps.paint = (r.swaps.paint || 0) + 1
  const keepSlots = r.palette.pencils.filter((_, i) => i !== index).map((p) => p.slot)
  // Avoid every pencil already tried in this slot recently.
  r.swaps.tried = r.swaps.tried || {}
  const tried = new Set([...(r.swaps.tried[target.slot] || []), target.code])
  const owned = ctx.pencils.filter((p) => p.special !== 'blender').length
  if (tried.size >= owned - keepSlots.length) tried.clear()
  tried.add(target.code)
  r.swaps.tried[target.slot] = [...tried]
  rebuildPalette(r, ctx, { keepSlots, avoid: [...tried] })
  if (r.text?.lonelyLine && target.code === r.lonely?.code) r.text.lonelyLine = ''
  return renderText(r, ctx)
}

export function toggleLock(reading, index) {
  const r = clone(reading)
  if (r.palette.pencils[index]) r.palette.pencils[index].locked = !r.palette.pencils[index].locked
  return r
}

// New picture, same colours: re-deal the cards and re-fit the same pencils.
// A palette twist (Moonlight, Brown and White...) only makes sense with its own
// pencils, so a reading dealt under one keeps that twist; a fresh deal never
// introduces one.
export function newPicture(reading, ctx) {
  const n = (reading.swaps.picture || 0) + 1
  const { byId } = ctx.content
  const oldTwist = reading.cards.twist && byId.get(reading.cards.twist)
  let fresh
  for (let k = 0; k < 10; k++) {
    const opts = { spread: reading.spread, seed: hashString(`${reading.seed}:picture:${n}:${k}`), lonely: false }
    if (oldTwist?.effects?.palette) opts.fixedTwist = oldTwist
    fresh = dealReading(ctx, opts)
    const twist = fresh.cards.twist && byId.get(fresh.cards.twist)
    if (oldTwist?.effects?.palette || !twist?.effects?.palette) break
  }
  fresh.swaps.picture = n
  if (fresh.palette.rule) return renderText(fresh, ctx)
  const codes = reading.palette.pencils.map((p) => p.code)
  const { slots, mood } = paletteSlots(fresh, ctx)
  const locked = new Set(reading.palette.pencils.filter((p) => p.locked).map((p) => p.code))
  const refit = refitRoles({ pencils: ctx.pencils, codes, slots, mood })
  const who = fresh.cards.who && byId.get(fresh.cards.who)
  const slotByKey = new Map(slots.map((sl) => [sl.key, sl]))
  fresh.palette.pencils = refit.map((p) => ({ ...p, role: plainRoleIfOff(p, slotByKey.get(p.slot), ctx, who), locked: locked.has(p.code) }))
  fresh.palette.bareLights = !fresh.palette.pencils.some((p) => (ctx.pencilsByCode.get(p.code)?.lch.L ?? 0) > 0.84)
  fresh.palette.name = reading.palette.name
  return renderText(fresh, ctx)
}

// When a kept pencil is far from the colour a role describes, use a plain
// role that can't be wrong ("Indigo Blue for the rich brown fur" is wrong).
function plainRoleIfOff(p, slot, ctx, who) {
  const pencil = ctx.pencilsByCode.get(p.code)
  if (!slot || !pencil) return 'for anything else in the picture'
  const subject = who ? nameOf(who) : 'picture'
  if (slot.kind === 'dark') return pencil.lch.L < 0.5 ? slot.role : 'for the darker parts'
  if (slot.kind === 'light') return pencil.lch.L > 0.84 && pencil.lch.C < 0.07 ? slot.role : 'for the lightest parts'
  if (!slot.anchor) return slot.role
  const off = Math.hypot(pencil.lab.L - slot.anchor.lab.L, pencil.lab.a - slot.anchor.lab.a, pencil.lab.b - slot.anchor.lab.b) > 0.16
  if (!off) return slot.role
  return { main: `for the ${subject}`, setting: 'for the setting', accent: 'for the small details' }[slot.key] || 'for anything else in the picture'
}

