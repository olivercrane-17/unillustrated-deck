// Draws the app icon as SVG and renders the PNG sizes with Chromium.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const ICONS = new URL('../public/icons', import.meta.url).pathname
const OUT = (await import('node:os')).tmpdir()

const defs = `
  <defs>
    <radialGradient id="felt" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="#335244"/>
      <stop offset=".55" stop-color="#24382e"/>
      <stop offset="1" stop-color="#18271f"/>
    </radialGradient>
    <linearGradient id="gilt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9c7330"/>
      <stop offset=".38" stop-color="#e8cb7e"/>
      <stop offset=".55" stop-color="#c9a253"/>
      <stop offset=".72" stop-color="#e8cb7e"/>
      <stop offset="1" stop-color="#a57b33"/>
    </linearGradient>
    <radialGradient id="stock" cx="50%" cy="36%" r="75%">
      <stop offset="0" stop-color="#fdf8ea"/>
      <stop offset=".6" stop-color="#f3ead7"/>
      <stop offset="1" stop-color="#e3d5b8"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".42"/>
    </filter>
  </defs>`

// A cream card with a gilt frame and a gilt sparkle, with a second card
// tucked behind so it reads as a deck.
const art = `
  <g transform="rotate(-11 256 268)" filter="url(#shadow)">
    <rect x="166" y="118" width="180" height="288" rx="20" fill="#1d3428"/>
    <rect x="176" y="128" width="160" height="268" rx="13" fill="none" stroke="url(#gilt)" stroke-width="6"/>
  </g>
  <g transform="rotate(5 256 256)" filter="url(#shadow)">
    <rect x="166" y="108" width="180" height="288" rx="20" fill="url(#stock)"/>
    <rect x="178" y="120" width="156" height="264" rx="12" fill="none" stroke="url(#gilt)" stroke-width="8"/>
    <rect x="190" y="132" width="132" height="240" rx="7" fill="none" stroke="#9c7330" stroke-width="2.2" opacity=".55"/>
    <path d="M256 170 C 260.5 219, 268 236.5, 312 252 C 268 267.5, 260.5 285, 256 334 C 251.5 285, 244 267.5, 200 252 C 244 236.5, 251.5 219, 256 170 Z"
      fill="url(#gilt)" stroke="#8a6427" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M300 152 C 301.6 164, 304 166.4, 316 168 C 304 169.6, 301.6 172, 300 184 C 298.4 172, 296 169.6, 284 168 C 296 166.4, 298.4 164, 300 152 Z"
      fill="url(#gilt)" stroke="#8a6427" stroke-width="2.2" stroke-linejoin="round"/>
  </g>`

const svg = ({ rounded, scale = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs}
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#felt)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}
  </g>
</svg>
`

const icon = svg({ rounded: true, scale: 1.1 })
const fullBleed = svg({ rounded: false, scale: 1.12 })
const maskable = svg({ rounded: false, scale: 0.92 })
writeFileSync(`${ICONS}/icon.svg`, icon)
writeFileSync(`${OUT}/icon-full.svg`, fullBleed)
writeFileSync(`${OUT}/icon-maskable.svg`, maskable)

const browser = await chromium.launch()
async function render(source, size, file, transparent) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  const sized = source.replace('width="512" height="512"', `width="${size}" height="${size}"`)
  await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`)
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } })
  await page.close()
}
await render(icon, 192, `${ICONS}/icon-192.png`, true)
await render(icon, 512, `${ICONS}/icon-512.png`, true)
await render(maskable, 512, `${ICONS}/maskable-512.png`, false)
await render(fullBleed, 180, `${ICONS}/apple-touch-icon.png`, false)

// A preview sheet: small sizes, and the maskable icon under a circle mask.
const page = await browser.newPage({ viewport: { width: 760, height: 300 }, deviceScaleFactor: 2 })
const b64 = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64')
await page.setContent(`<body style="margin:0;padding:20px;background:#ddd;display:flex;gap:24px;align-items:center;font:12px sans-serif">
  <img src="${b64(icon)}" width="16"><img src="${b64(icon)}" width="32"><img src="${b64(icon)}" width="48"><img src="${b64(icon)}" width="96">
  <img src="${b64(maskable)}" width="160" style="border-radius:50%">
  <img src="${b64(fullBleed)}" width="120" style="border-radius:27px">
  <div style="background:#fff;padding:10px"><img src="${b64(icon)}" width="48"></div>
</body>`)
await page.screenshot({ path: `${OUT}/icon-preview.png` })
await browser.close()
