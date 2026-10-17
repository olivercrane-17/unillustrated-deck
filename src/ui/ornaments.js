// Hand-drawn line ornaments as inline SVG strings. All strokes use
// currentColor so CSS decides whether they print in gilt, ink or suit colour.

const svg = (viewBox, body, cls = '') =>
  `<svg class="${cls}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

export const EMBLEMS = {
  // Fur & Feather: a paw print with a small feather tucked beside it
  fur: svg('0 0 64 64', `
    <path d="M30 37 C 22.5 37, 16 43.5, 16 49 C 16 53.5, 19.5 55.5, 23.5 54.6 C 26.2 54, 28 53.2, 30 53.2 C 32 53.2, 33.8 54, 36.5 54.6 C 40.5 55.5, 44 53.5, 44 49 C 44 43.5, 37.5 37, 30 37 Z" stroke-width="1.5"/>
    <ellipse cx="15.5" cy="30" rx="4.4" ry="5.8" transform="rotate(-22 15.5 30)" stroke-width="1.4"/>
    <ellipse cx="24.5" cy="21.5" rx="4.6" ry="6.2" transform="rotate(-7 24.5 21.5)" stroke-width="1.4"/>
    <ellipse cx="35.5" cy="21.5" rx="4.6" ry="6.2" transform="rotate(7 35.5 21.5)" stroke-width="1.4"/>
    <ellipse cx="44.5" cy="30" rx="4.4" ry="5.8" transform="rotate(22 44.5 30)" stroke-width="1.4"/>
    <path d="M47 57 C 50 49, 53.5 43, 58 37" stroke-width="1.1"/>
    <path d="M58 37 C 59.5 42, 57 47.5, 51.5 50 M58 37 C 54 38, 50.5 41.5, 49 46" stroke-width="1"/>`),
  // Leaf & Stone: a leaf with veins and a pebble
  leaf: svg('0 0 64 64', `
    <path d="M14 50 C 13 29, 28 13, 53 10 C 52 35, 37 50, 14 50 Z" stroke-width="1.5"/>
    <path d="M14 50 C 25 39, 36 27, 47 17" stroke-width="1.3"/>
    <path d="M22 42 C 21 37, 21 33, 22 29 M29 35 C 28 30, 29 26, 31 22 M36 28 C 36 24, 38 21, 40 18" stroke-width="1"/>
    <path d="M22 42 C 27 43, 31 43, 35 41 M29 35 C 34 36, 39 35, 43 32 M36 28 C 40 28, 44 27, 47 24" stroke-width="1"/>
    <path d="M40 55 C 42 51.5, 49 51, 53 53 C 56 54.5, 55 58, 50 58.5 C 45 59, 39 58, 40 55 Z" stroke-width="1.2"/>`),
  // Hearth: a teacup with steam
  hearth: svg('0 0 64 64', `
    <path d="M13 28 H 45 V 31 C 45 42, 37 50, 29 50 C 21 50, 13 42, 13 31 Z" stroke-width="1.5"/>
    <path d="M45 31 C 53 30, 55 40, 45 42.5" stroke-width="1.4"/>
    <path d="M7 52.5 C 15 57, 43 57, 51 52.5" stroke-width="1.4"/>
    <path d="M23 22 C 19 18, 27 15.5, 23 10 M31 22 C 27 18, 35 15.5, 31 9 M39 22 C 35 18.5, 42 16, 39 11.5" stroke-width="1.1"/>
    <path d="M19 36 C 22 40, 26 42, 30 42.5" stroke-width="1" opacity=".7"/>`),
  // Where: an arched window with a sill
  where: svg('0 0 64 64', `
    <path d="M17 53 V 29 A 15 15 0 0 1 47 29 V 53" stroke-width="1.5"/>
    <path d="M32 14 V 53 M17 35 H 47" stroke-width="1.1"/>
    <path d="M11 53.5 H 53 M13 57 H 51" stroke-width="1.4"/>
    <path d="M38 23 C 40 25, 41 27, 41.5 30" stroke-width="1" opacity=".7"/>`),
  // When: a crescent moon and a sun
  when: svg('0 0 64 64', `
    <path d="M38 10 A 21 21 0 1 0 54 43 A 16.5 16.5 0 1 1 38 10 Z" stroke-width="1.5"/>
    <circle cx="20" cy="18" r="4.5" stroke-width="1.2"/>
    <path d="M20 9.5 V 11.5 M20 24.5 V 26.5 M11.5 18 H 13.5 M26.5 18 H 28.5 M14 12 L 15.4 13.4 M24.6 22.6 L 26 24 M14 24 L 15.4 22.6 M24.6 13.4 L 26 12" stroke-width="1"/>
    <path d="M47 52 L 48 54.5 L 50.5 55.5 L 48 56.5 L 47 59 L 46 56.5 L 43.5 55.5 L 46 54.5 Z" stroke-width=".9"/>`),
  // Twist: a four-point sparkle with two small companions
  twist: svg('0 0 64 64', `
    <path d="M30 9 C 31.6 24, 34.5 28.6, 49 31.5 C 34.5 34.4, 31.6 39, 30 54 C 28.4 39, 25.5 34.4, 11 31.5 C 25.5 28.6, 28.4 24, 30 9 Z" stroke-width="1.5"/>
    <path d="M49 9 C 49.6 13.4, 50.6 14.4, 55 15 C 50.6 15.6, 49.6 16.6, 49 21 C 48.4 16.6, 47.4 15.6, 43 15 C 47.4 14.4, 48.4 13.4, 49 9 Z" stroke-width="1.1"/>
    <path d="M50 44 C 50.4 47, 51 47.6, 54 48 C 51 48.4, 50.4 49, 50 52 C 49.6 49, 49 48.4, 46 48 C 49 47.6, 49.6 47, 50 44 Z" stroke-width="1"/>
    <circle cx="30" cy="31.5" r="1.6" stroke-width="1"/>`),
  // Small things: a sampler of little frames
  theme: svg('0 0 64 64', `
    <rect x="9" y="11" width="20" height="13" rx="2.5" stroke-width="1.3"/>
    <rect x="35" y="11" width="20" height="13" rx="2.5" stroke-width="1.3"/>
    <rect x="9" y="30" width="20" height="13" rx="2.5" stroke-width="1.3"/>
    <rect x="35" y="30" width="20" height="13" rx="2.5" stroke-width="1.3"/>
    <rect x="9" y="49" width="20" height="9" rx="2.5" stroke-width="1.3"/>
    <rect x="35" y="49" width="20" height="9" rx="2.5" stroke-width="1.3"/>
    <path d="M14 20 C 17 15, 21 15, 24 20 M41 21 L 45 15 L 49 21 M14 39 C 15 34, 23 34, 24 39 M40 37 H 50" stroke-width="1"/>`),
}

export const SUIT_LABELS = {
  fur: 'Fur & Feather',
  leaf: 'Leaf & Stone',
  hearth: 'Hearth',
  where: 'Where',
  when: 'When',
  twist: 'Twist',
  theme: 'Small Things',
}

// A small curl for the card corners (drawn for the top-left corner).
export const CORNER = svg('0 0 40 40', `
  <path d="M3 22 C 3 11, 11 3, 22 3" stroke-width="1.3"/>
  <path d="M8 22 C 8 14, 14 8, 22 8" stroke-width=".9"/>
  <path d="M22 3 C 26 3, 28 6, 26 8.5 C 24.5 10, 22.5 9, 22.5 7.5" stroke-width="1"/>
  <path d="M3 22 C 3 26, 6 28, 8.5 26 C 10 24.5, 9 22.5, 7.5 22.5" stroke-width="1"/>
  <circle cx="13.5" cy="13.5" r="1.6" stroke-width="1"/>`)

// A divider flourish for paper panels.
export const FLOURISH = svg('0 0 200 16', `
  <path d="M8 8 H 82" stroke-width="1"/>
  <path d="M118 8 H 192" stroke-width="1"/>
  <path d="M100 2 L 106 8 L 100 14 L 94 8 Z" stroke-width="1.1"/>
  <path d="M82 8 C 86 4, 90 4, 92 8 C 90 12, 86 12, 82 8 Z M118 8 C 114 4, 110 4, 108 8 C 110 12, 114 12, 118 8 Z" stroke-width="1"/>`, 'flourish')

// The card back: a diamond lattice with little stars, as an SVG pattern.
export function cardBackSvg(id = 'lattice') {
  return `<svg class="card-back-art" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="16" height="16" fill="none"/>
        <path d="M0 0 H16 M0 0 V16" stroke="currentColor" stroke-width=".55" opacity=".55"/>
        <circle cx="8" cy="8" r=".9" fill="currentColor" opacity=".8"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="100" height="160" fill="url(#${id})"/>
    <g fill="none" stroke="currentColor" stroke-width=".9">
      <ellipse cx="50" cy="80" rx="22" ry="30" fill="var(--back-fill, #1f3328)"/>
      <ellipse cx="50" cy="80" rx="18.5" ry="26.5"/>
      <path d="M50 64 L 53 76 L 64 80 L 53 84 L 50 96 L 47 84 L 36 80 L 47 76 Z"/>
      <circle cx="50" cy="80" r="2.4"/>
    </g>
  </svg>`
}

// Simple outline icons for the interface.
const icon = (body) => svg('0 0 24 24', body, 'icon')
export const ICONS = {
  deck: icon('<rect x="5" y="3.5" width="11" height="16" rx="1.8" stroke-width="1.6"/><path d="M8.5 20.5 H 17.2 A 1.8 1.8 0 0 0 19 18.7 V 7" stroke-width="1.6"/>'),
  tin: icon('<rect x="3.5" y="7" width="17" height="11" rx="2" stroke-width="1.6"/><path d="M3.5 10.5 H 20.5" stroke-width="1.6"/><path d="M7 14 H 17" stroke-width="1.4" stroke-dasharray="2 1.6"/>'),
  settings: icon('<circle cx="12" cy="12" r="3" stroke-width="1.6"/><path d="M12 2.8 V 5.2 M12 18.8 V 21.2 M2.8 12 H 5.2 M18.8 12 H 21.2 M5.5 5.5 L 7.2 7.2 M16.8 16.8 L 18.5 18.5 M5.5 18.5 L 7.2 16.8 M16.8 7.2 L 18.5 5.5" stroke-width="1.6"/>'),
  soundOn: icon('<path d="M4 9.5 H 7.5 L 12 5.5 V 18.5 L 7.5 14.5 H 4 Z" stroke-width="1.6"/><path d="M15.5 9 C 17 10.5, 17 13.5, 15.5 15 M18 6.5 C 21 9.5, 21 14.5, 18 17.5" stroke-width="1.6"/>'),
  soundOff: icon('<path d="M4 9.5 H 7.5 L 12 5.5 V 18.5 L 7.5 14.5 H 4 Z" stroke-width="1.6"/><path d="M16 9.5 L 21 14.5 M21 9.5 L 16 14.5" stroke-width="1.6"/>'),
  lock: icon('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2" stroke-width="1.6"/><path d="M8.5 10.5 V 7.5 A 3.5 3.5 0 0 1 15.5 7.5 V 10.5" stroke-width="1.6"/>'),
  unlock: icon('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2" stroke-width="1.6"/><path d="M8.5 10.5 V 7.5 A 3.5 3.5 0 0 1 15 6" stroke-width="1.6"/>'),
  swap: icon('<path d="M5 9 H 17 L 14 6 M19 15 H 7 L 10 18" stroke-width="1.6"/>'),
  shuffle: icon('<path d="M4 7 H 7.5 C 10 7, 11 9, 12 12 C 13 15, 14 17, 16.5 17 H 20 M17.5 14.5 L 20 17 L 17.5 19.5 M4 17 H 7.5 C 9 17, 10 16.2, 10.8 15 M13.2 9 C 14 7.8, 15 7, 16.5 7 H 20 M17.5 4.5 L 20 7 L 17.5 9.5" stroke-width="1.6"/>'),
  pencil: icon('<path d="M4 20 L 5 15.5 L 15.5 5 A 2.1 2.1 0 0 1 18.5 5 L 19 5.5 A 2.1 2.1 0 0 1 19 8.5 L 8.5 19 Z M13.5 7 L 17 10.5 M4 20 L 8.5 19" stroke-width="1.6"/>'),
  camera: icon('<path d="M4 8.5 A 1.5 1.5 0 0 1 5.5 7 H 8 L 9.5 5 H 14.5 L 16 7 H 18.5 A 1.5 1.5 0 0 1 20 8.5 V 17.5 A 1.5 1.5 0 0 1 18.5 19 H 5.5 A 1.5 1.5 0 0 1 4 17.5 Z" stroke-width="1.6"/><circle cx="12" cy="13" r="3.5" stroke-width="1.6"/>'),
  image: icon('<rect x="4" y="5" width="16" height="14" rx="2" stroke-width="1.6"/><circle cx="9" cy="10" r="1.6" stroke-width="1.4"/><path d="M4.5 17 L 9.5 12.5 L 13 15.5 L 15.5 13.5 L 19.5 17" stroke-width="1.6"/>'),
  tick: icon('<path d="M5 12.5 L 10 17 L 19 7.5" stroke-width="1.9"/>'),
  close: icon('<path d="M6 6 L 18 18 M18 6 L 6 18" stroke-width="1.8"/>'),
  back: icon('<path d="M14.5 5.5 L 8 12 L 14.5 18.5" stroke-width="1.8"/>'),
  share: icon('<path d="M12 15 V 4 M8 7.5 L 12 3.5 L 16 7.5" stroke-width="1.6"/><path d="M6 11 V 19 A 1 1 0 0 0 7 20 H 17 A 1 1 0 0 0 18 19 V 11" stroke-width="1.6"/>'),
  download: icon('<path d="M12 4 V 15 M8 11 L 12 15 L 16 11" stroke-width="1.6"/><path d="M5 19.5 H 19" stroke-width="1.6"/>'),
  upload: icon('<path d="M12 15 V 4 M8 8 L 12 4 L 16 8" stroke-width="1.6"/><path d="M5 19.5 H 19" stroke-width="1.6"/>'),
  star: icon('<path d="M12 4 L 14.3 9.2 L 20 9.7 L 15.7 13.4 L 17 19 L 12 16 L 7 19 L 8.3 13.4 L 4 9.7 L 9.7 9.2 Z" stroke-width="1.5"/>'),
  starFilled: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4 L 14.3 9.2 L 20 9.7 L 15.7 13.4 L 17 19 L 12 16 L 7 19 L 8.3 13.4 L 4 9.7 L 9.7 9.2 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  search: icon('<circle cx="10.5" cy="10.5" r="5.5" stroke-width="1.7"/><path d="M15 15 L 20 20" stroke-width="1.7"/>'),
  sun: icon('<circle cx="12" cy="12" r="3.6" stroke-width="1.6"/><path d="M12 3 V 5 M12 19 V 21 M3 12 H 5 M19 12 H 21 M5.6 5.6 L 7 7 M17 17 L 18.4 18.4 M5.6 18.4 L 7 17 M17 7 L 18.4 5.6" stroke-width="1.6"/>'),
  book: icon('<path d="M4 5.5 C 7 4.5, 10 4.8, 12 6.5 C 14 4.8, 17 4.5, 20 5.5 V 18.5 C 17 17.5, 14 17.8, 12 19.5 C 10 17.8, 7 17.5, 4 18.5 Z M12 6.5 V 19.5" stroke-width="1.5"/>'),
  plus: icon('<path d="M12 5 V 19 M5 12 H 19" stroke-width="1.8"/>'),
  minus: icon('<path d="M5 12 H 19" stroke-width="1.8"/>'),
  more: icon('<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>'),
  eye: icon('<path d="M2.5 12 C 5 7, 8.5 5, 12 5 C 15.5 5, 19 7, 21.5 12 C 19 17, 15.5 19, 12 19 C 8.5 19, 5 17, 2.5 12 Z" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke-width="1.5"/>'),
  clock: icon('<circle cx="12" cy="12" r="8" stroke-width="1.6"/><path d="M12 7.5 V 12 L 15 14" stroke-width="1.6"/>'),
}

// A sharpened coloured pencil, drawn in the pencil's own colour.
// Each drawing gets its own gradient id: shared ids break when the first
// SVG that defined them leaves the page.
let pencilSeq = 0
export function pencilSvg(hex, { big = false, label = '' } = {}) {
  // Colours can come from her own overrides or a backup file: never trust them into markup.
  if (!/^#[0-9a-f]{6}$/i.test(String(hex))) hex = '#999999'
  const cls = `pencil-swatch${big ? ' big' : ''}`
  const g = `pg${++pencilSeq}`
  return `<svg class="${cls}" viewBox="0 0 120 36" role="img" aria-label="${escapeAttr(label)}">
    <defs>
      <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".38"/>
        <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".22"/>
      </linearGradient>
    </defs>
    <path d="M6 5 H 86 L 86 31 H 6 Q 2 31 2 27 V 9 Q 2 5 6 5 Z" fill="${hex}"/>
    <path d="M6 5 H 86 L 86 31 H 6 Q 2 31 2 27 V 9 Q 2 5 6 5 Z" fill="url(#${g})"/>
    <path d="M10 13.6 H 84 M10 22.4 H 84" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
    <path d="M86 5 L 108 15.6 Q 111 18 108 20.4 L 86 31 Z" fill="#E9CFA6"/>
    <path d="M86 5 L 108 15.6 Q 111 18 108 20.4 L 86 31 Z" fill="url(#${g})"/>
    <path d="M100 12.2 L 108 15.6 Q 111 18 108 20.4 L 100 23.8 Q 97 18 100 12.2 Z" fill="${hex}"/>
    <rect x="14" y="5" width="2.2" height="26" fill="#000" fill-opacity=".14"/>
  </svg>`
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
