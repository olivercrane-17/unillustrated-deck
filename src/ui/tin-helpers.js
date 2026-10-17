// Pure helpers for Your Tin: grouping, searching, counting and the
// "which purple?" question. No DOM here, so it can be unit tested.

export const FAMILY_GROUPS = [
  { key: 'reds', label: 'Reds', families: ['red'] },
  { key: 'oranges', label: 'Oranges', families: ['orange'] },
  { key: 'yellows', label: 'Yellows', families: ['yellow'] },
  { key: 'greens', label: 'Greens', families: ['green'] },
  { key: 'blues', label: 'Blues', families: ['blue'] },
  { key: 'purples', label: 'Purples', families: ['purple'] },
  { key: 'pinks', label: 'Pinks', families: ['pink'] },
  { key: 'browns', label: 'Browns', families: ['brown'] },
  { key: 'greys', label: 'Greys', families: ['grey'] },
  { key: 'bw', label: 'Black and white', families: ['black', 'white'] },
  { key: 'metallics', label: 'Metallics', families: ['metallic'] },
]

const groupOfFamily = new Map(FAMILY_GROUPS.flatMap((g) => g.families.map((f) => [f, g.key])))

// "Warm Grey 20%" belongs to the Warm Grey series, step 20.
const SERIES = /^(.+?)\s+(\d+)%$/

/**
 * Sort the catalogue into family groups, in tin order. Within a group,
 * pencils run light to dark when a `lightness(pencil)` function is given,
 * like a tin laid out by hand, and numbered series (Warm Grey 10% to 90%)
 * stay together in step order after the rest. Unknown families go last.
 */
export function groupPencils(pencils, { lightness } = {}) {
  const groups = FAMILY_GROUPS.map((g) => ({ key: g.key, label: g.label, pencils: [] }))
  const other = { key: 'other', label: 'Others', pencils: [] }
  const byKey = new Map(groups.map((g) => [g.key, g]))
  for (const p of pencils) (byKey.get(groupOfFamily.get(p.family)) || other).pencils.push(p)
  if (other.pencils.length) groups.push(other)
  if (lightness) {
    const seriesOrder = []
    const keys = new Map(pencils.map((p) => {
      const m = SERIES.exec(p.name)
      if (!m) return [p.code, [0, -lightness(p), 0]]
      if (!seriesOrder.includes(m[1])) seriesOrder.push(m[1])
      return [p.code, [1, seriesOrder.indexOf(m[1]), Number(m[2])]]
    }))
    const cmp = (a, b) => {
      const x = keys.get(a.code)
      const y = keys.get(b.code)
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    }
    for (const g of groups) g.pencils.sort(cmp)
  }
  return groups.filter((g) => g.pencils.length)
}

// Lowercase, no spaces or dots, and forgiving about grey/gray and colour/color.
const squash = (s) => String(s || '').toLowerCase().replace(/[\s.\-_]+/g, '').replace(/gray/g, 'grey').replace(/colour/g, 'color')

/** Does a pencil answer to this search? Matches name, code ("937" finds PC937) or family. */
export function matchesQuery(pencil, query) {
  const q = squash(query)
  if (!q) return true
  return squash(pencil.name).includes(q) || squash(pencil.code).includes(q) || squash(pencil.family).startsWith(q)
}

/** The filter chips: 'all', 'owned' or 'starred'. */
export function passesFilter(code, filter, { owned, starred }) {
  if (filter === 'owned') return owned.has(code)
  if (filter === 'starred') return starred.has(code)
  return true
}

export function countLine(n) {
  if (!n) return 'No pencils in your tin yet'
  return `${n} ${n === 1 ? 'pencil' : 'pencils'} in your tin`
}

/** The deck can deal as long as she owns one real colour (the blender doesn't count). */
export function canDeal(ownedCodes, catalogue) {
  const owned = new Set(ownedCodes)
  return catalogue.some((p) => owned.has(p.code) && p.special !== 'blender')
}

/** Tick or untick a set of codes, keeping the rest of the tin as it is. */
export function setTicked(ownedCodes, codes, on) {
  const owned = new Set(ownedCodes)
  for (const c of codes) {
    if (on) owned.add(c)
    else owned.delete(c)
  }
  return [...owned]
}

/** Only a hand-ticked tin has anything to lose when a box preset is applied. */
export function presetNeedsConfirm(tin, key) {
  return tin.preset === 'custom' && key !== tin.preset
}

/**
 * Does the variant question belong to this tin? Yes for the box that has the
 * variant, or for a hand-ticked tin holding exactly one of the options. A tin
 * holding two of them, such as the 150, plainly has both, so asking "which
 * one?" would only make her lose one.
 */
export function variantApplies(tin, variant, setKey) {
  if (tin.preset === setKey) return true
  const owned = new Set(tin.owned)
  return variant.options.filter((c) => owned.has(c)).length === 1
}

/** Ask while it applies and she hasn't answered yet. */
export function variantNeedsAnswer(tin, variant, setKey) {
  return !tin.variantAnswers?.[variant.id] && variantApplies(tin, variant, setKey)
}

/** Her tin with the chosen option in place of the others. */
export function chooseVariant(ownedCodes, variant, code) {
  const others = variant.options.filter((c) => c !== code)
  const owned = ownedCodes.filter((c) => !others.includes(c))
  if (!owned.includes(code)) owned.push(code)
  return owned
}

/** Codes from the catalogue, in group order, that she owns (for the print chart). */
export function ownedInOrder(groups, ownedCodes) {
  const owned = new Set(ownedCodes)
  return groups
    .map((g) => ({ key: g.key, label: g.label, pencils: g.pencils.filter((p) => owned.has(p.code)) }))
    .filter((g) => g.pencils.length)
}

/** A colour input wants lowercase #rrggbb. */
export function toInputHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  return m ? `#${m[1].toLowerCase()}` : '#999999'
}
