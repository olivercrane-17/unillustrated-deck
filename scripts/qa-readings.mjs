#!/usr/bin/env node
// Deal hundreds of readings across seasons, hemispheres, spreads and tins,
// assert they are well formed, and write them out for proofreading.
//   node scripts/qa-readings.mjs [count-per-combo]
// Writes qa/samples.md and qa/palettes.html. Exits non-zero on any failure.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAll } from './lib/load-content.mjs'
import { buildContext, dealReading, swapCard, repaint, newPicture } from '../src/engine/reading.js'
import { preparePencils } from '../src/engine/harmony.js'
import { subjectFitsPlace, whenFitsPlace, companionFits } from '../src/engine/compat.js'
import { hashString } from '../src/engine/rng.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PER = Number(process.argv[2] || 6)
const { content, pencils, sets } = loadAll()

const DATES = {
  spring: '2026-04-18T10:30:00',
  summer: '2026-07-11T15:00:00',
  autumn: '2026-10-17T19:30:00',
  winter: '2026-01-09T07:15:00',
}
const SOUTH_DATES = { spring: '2026-10-17T10:30:00', summer: '2026-01-09T15:00:00', autumn: '2026-04-18T19:30:00', winter: '2026-07-11T07:15:00' }
const SPREADS = ['quick', 'evening', 'big', 'small']
const TINS = ['12', '24', '48', '150']

const failures = []
const fail = (msg, r) => failures.push(`${msg}\n    ${r ? JSON.stringify({ seed: r.seed, spread: r.spread, cards: r.cards, sentence: r.text?.sentence }) : ''}`)

function checkText(r, label, s) {
  if (!s) return
  if (/[{}]/.test(s)) fail(`${label}: unfilled slot`, r)
  if (/\bundefined\b|\bnull\b|NaN/.test(s)) fail(`${label}: undefined/null`, r)
  if (/ {2,}/.test(s)) fail(`${label}: double space`, r)
  if (/\b(a|an|the) (a|an|the)\b/i.test(s)) fail(`${label}: doubled article`, r)
  if (/\ba [aeiou]/i.test(s) && !/\ba (one|uni|use|usu|eu|ewe|u[bkrst][aeiou])/i.test(s)) fail(`${label}: "a" before a vowel: ${s}`, r)
  if (/[—–]/.test(s)) fail(`${label}: dash`, r)
  if (!/^[A-Z"“'‘]/.test(s)) fail(`${label}: should start with a capital: ${s}`, r)
  if (!/[.!?]["”'’]?$/.test(s)) fail(`${label}: should end with a full stop: ${s}`, r)
  if (/,\s*,|\.\s*,|,\./.test(s)) fail(`${label}: punctuation clash: ${s}`, r)
}

function checkReading(r, ctx) {
  const by = (id) => content.byId.get(id)
  const owned = new Set(ctx.pencils.map((p) => p.code))
  for (const p of r.palette.pencils) if (!owned.has(p.code)) fail(`pencil ${p.code} not in tin`, r)
  if (new Set(r.palette.pencils.map((p) => p.code)).size !== r.palette.pencils.length) fail('duplicate pencils', r)
  if (r.palette.pencils.some((p) => p.code === 'PC1077')) fail('blender dealt', r)
  if (!r.palette.pencils.length) fail('no pencils', r)
  for (const k of ['opener', 'sentence', 'framing', 'twist', 'firstMark', 'lightLine', 'paperLine', 'lonelyLine', 'smallTin']) checkText(r, k, r.text[k])
  if (!r.text.brief?.length || r.text.brief[0].key !== 'draw') fail('brief must start with a Draw line', r)
  for (const line of r.text.brief || []) checkText(r, `brief.${line.key}`, line.text)
  const keys = (r.text.brief || []).map((l) => l.key)
  const want = { quick: ['draw', 'frame'], evening: ['draw', 'where', 'when'], big: ['draw', 'where', 'when'], small: ['draw'] }[r.spread]
  for (const k of want) if (!keys.includes(k)) fail(`brief missing ${k}`, r)
  if (r.spread !== 'small' && r.spread !== 'quick') {
    const twist = r.cards.twist && by(r.cards.twist)
    const opts = { ignoreScale: twist?.effects?.scale === 'any' }
    if (!subjectFitsPlace(by(r.cards.who), by(r.cards.where), r.season, opts)) fail('subject does not fit place', r)
    if (!whenFitsPlace(by(r.cards.when), by(r.cards.where), r.season)) fail('hour does not fit place', r)
    if (r.cards.also && !companionFits(by(r.cards.also), by(r.cards.who), by(r.cards.where), r.season, opts)) fail('companion does not fit', r)
  }
  if (r.spread === 'big' && !r.cards.twist) fail('big spread without twist', r)
  if (r.spread === 'small' && !r.slots?.length) fail('small spread without slots', r)
  for (const pos of Object.keys(r.cards)) {
    const c = by(r.cards[pos])
    if (!c) fail(`unknown card ${r.cards[pos]}`, r)
    else if (r.season && c.seasons && !c.seasons.includes(r.season)) fail(`${pos} ${c.id} out of season (${r.season})`, r)
  }
}

const tinPencils = Object.fromEntries(TINS.map((k) => [k, preparePencils(pencils.filter((p) => sets[k].codes.includes(p.code)))]))
const samples = []
const palettes = []
let total = 0
for (const [hemi, dates] of [['north', DATES], ['south', SOUTH_DATES]]) {
  for (const [season, iso] of Object.entries(dates)) {
    for (const spread of SPREADS) {
      for (const tin of TINS) {
        const ctx = buildContext({ content, pencils: tinPencils[tin], date: new Date(iso), hemisphere: hemi })
        for (let i = 0; i < PER; i++) {
          const seed = hashString(`${hemi}:${season}:${spread}:${tin}:${i}`)
          let r
          try {
            r = dealReading(ctx, { spread, seed })
          } catch (e) {
            fail(`deal threw (${hemi} ${season} ${spread} tin ${tin}): ${e.message}`)
            continue
          }
          total++
          if (r.season !== season) fail(`season mismatch ${r.season} vs ${season}`, r)
          checkReading(r, ctx)
          // Exercise the edits too.
          try {
            for (const pos of Object.keys(r.cards)) checkReading(swapCard(r, ctx, pos), ctx)
            checkReading(repaint(r, ctx), ctx)
            if (spread !== 'small') checkReading(newPicture(r, ctx), ctx)
          } catch (e) {
            fail(`edit threw: ${e.message}`, r)
          }
          if (tin === '48' && i < 3) samples.push({ hemi, season, spread, r })
          if (tin === '48' && palettes.length < 120) palettes.push(r)
        }
      }
    }
  }
}

// Writing the samples for a human (or agent) read-through.
const nameOf = new Map(pencils.map((p) => [p.code, p.name]))
const lines = ['# Sample readings', '', `${total} readings dealt and checked; ${samples.length} shown (48-pencil tin).`, '']
for (const { hemi, season, spread, r } of samples) {
  lines.push(`## ${season}, ${hemi}, ${spread}`)
  if (r.text.opener) lines.push(`_${r.text.opener}_`)
  for (const line of r.text.brief) lines.push(`- **${line.label}:** ${line.text}`)
  if (r.slots) lines.push(r.slots.map((s) => `  - ${s.text}${s.wobbly ? ' (one line)' : ''}`).join('\n'))
  lines.push(`Tin, ${r.palette.name}: ${r.palette.pencils.map((p) => `${p.code} ${nameOf.get(p.code)} (${p.role})`).join('; ')}`)
  for (const k of ['lightLine', 'paperLine', 'lonelyLine']) if (r.text[k]) lines.push(r.text[k])
  lines.push(`First mark: ${r.text.firstMark}`)
  lines.push('')
}
mkdirSync(join(ROOT, 'qa'), { recursive: true })
writeFileSync(join(ROOT, 'qa/samples.md'), lines.join('\n'))

const hexOf = new Map(pencils.map((p) => [p.code, p.hex]))
const rows = palettes.map((r) => `<div class="row"><div class="sw">${r.palette.pencils.map((p) => `<span style="background:${hexOf.get(p.code)}" title="${p.code} ${nameOf.get(p.code)}: ${p.role}"></span>`).join('')}</div><div><b>${r.palette.name}</b> (${r.palette.mood}${r.palette.rule ? ', ' + r.palette.rule : ''}) ${r.text.sentence.replace(/</g, '&lt;')}<br><small>${r.palette.pencils.map((p) => `${nameOf.get(p.code)}: ${p.role}`).join(' · ')}</small></div></div>`)
writeFileSync(join(ROOT, 'qa/palettes.html'), `<!doctype html><meta charset="utf-8"><title>Palette QA</title><style>body{font:14px/1.4 Georgia,serif;background:#f3ead7;color:#2a211c;margin:24px}.row{display:grid;grid-template-columns:220px 1fr;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #d6c5a3}.sw{display:flex;gap:4px}.sw span{width:40px;height:40px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}</style><h1>Palette QA</h1>${rows.join('')}`)

console.log(`${total} readings dealt; ${failures.length} problems.`)
for (const f of failures.slice(0, 60)) console.log(`FAIL ${f}`)
if (failures.length > 60) console.log(`...and ${failures.length - 60} more`)
console.log('Wrote qa/samples.md and qa/palettes.html')
process.exit(failures.length ? 1 : 0)
