// Sentence templates. Slots are whole hand-written phrases from the cards, so
// the grammar never has to conjugate anything. A capitalised slot name means
// "capitalise the first letter of this phrase".

export const MAIN_TEMPLATES = [
  { id: 'm1', t: '{When}, {subject} {doing} {at}.' },
  { id: 'm2', t: '{Subject} {doing} {at}, {when}.' },
  { id: 'm3', t: '{At}, {subject} {doing}, {when}.' },
  { id: 'm4', t: '{When}, {at}, {subject} {doing}.' },
  { id: 'm5', t: '{When}: {subject} {doing} {at}.' },
]

export const QUICK_TEMPLATES = [
  { id: 'q1', t: '{Subject} {doing}.' },
]

export const COMPANION_TEMPLATES = [
  { id: 'c1', t: 'Somewhere in the picture, {alsoA} {alsoDoing}.' },
  { id: 'c2', t: 'Not far off, {alsoA} {alsoDoing}.' },
  { id: 'c3', t: 'If you look closely, {alsoA} {alsoDoing}.' },
  { id: 'c4', t: 'Tucked into a corner, {alsoA} {alsoDoing}.' },
]

export function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Fill "{slot}" and "{Slot}" placeholders. Unknown slots throw, so content
// bugs surface in tests rather than on her screen.
export function fill(template, values) {
  return template.replace(/\{([A-Za-z]+)\}/g, (_, key) => {
    const lower = key.charAt(0).toLowerCase() + key.slice(1)
    const v = values[lower]
    if (v === undefined || v === null || v === '') throw new Error(`Unfilled slot {${key}} in "${template}"`)
    return key === lower ? v : capitalise(v)
  })
}

// Final tidy: collapse spaces, fix doubled punctuation.
export function tidy(s) {
  return s.replace(/\s+/g, ' ').replace(/\s+([,.:;!?])/g, '$1').replace(/([.!?])\./g, '$1').replace(/,,/g, ',').trim()
}
