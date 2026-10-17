# Architecture

The Unillustrated Deck is a static, offline-first web app (Vite, vanilla JS ES modules, no UI framework) deployed to GitHub Pages under a sub-path. It must work with **no network at runtime**: no CDNs, no fonts from Google, no APIs.

Product background: `docs/council-verdict.md` (the full spec the council agreed) and `docs/content-spec.md` (card content contract).

## Who it is for

An adult hobbyist who colours on paper with a 48-pencil tin of Prismacolor Premier pencils and loves animals, nature and cosy everyday scenes. The phone sits propped next to her paper while she draws. Copy is British English, warm, plain and slightly wry. Never use em dashes in copy. Never guilt-trip (no streaks, scores, counters of what is missing, nagging).

## Layout of the code

```
index.html               app shell; loads src/main.js
src/main.js              imports styles, registers routes, boots the store, registers the service worker
src/sw-register.js       service worker registration + "A fresh deck is ready" toast
src/engine/              pure dealing logic (no DOM). Do not change without a reason.
  reading.js             dealReading, swapCard, repaint, swapPencil, toggleLock, newPicture, SPREADS, POSITION_LABELS
  harmony.js             palette dealing in OKLab; preparePencils
  color.js seasons.js compat.js rng.js templates.js lonely.js
src/data/
  pencils.json           Prismacolor Premier range: {code, name, hex, family, special?, discontinued?}
  sets.json              boxed sets: { "12": {label, codes}, "24": ..., "48": {label, codes, variants:[...]}, "150": ... }
  cards/*.json           content (see content-spec.md). Being written by other agents: do not edit.
  content.js             bundles content: exports content (with content.byId Map), pencils, pencilSets, pencilByCode
src/store/
  db.js                  IndexedDB wrapper: db.get/getAll/put/delete/clear/putMany/batch. Stores: kv, readings, seals, images, pencilStats
  state.js               app state + persistence (see API below)
src/ui/
  h.js                   DOM helper h('tag.class', attrs, ...children), raw(html), mount(el, ...), uid(), prefersReducedMotion(), wait()
  app.js                 shell, hash router (route(), go(path)), soundButton(), applyDocumentSettings()
  feedback.js            toast(message, {action, onAction}), openSheet(build(close), {label, className, onClose}), confirmSheet({...}) → Promise<boolean>
  card.js                renderCard({card, label, size: 'xs'|'sm'|'md'|'lg', faceDown, imageUrl, dateText, drawn, backName, tilt}) and flip(el, faceUp), suitOf(card)
  ornaments.js           EMBLEMS, ICONS (inline SVG strings), FLOURISH, CORNER, pencilSvg(hex, {big, label})
  gloss.js               glossify(text) → nodes with tap-for-meaning glossary terms
  sound.js               riffle(), flipSound(), clink() (only audible if settings.sound)
  table.js               home: deck, deal animation, reading, tin panel, actions (owned by the lead)
  draw.js                Drawing View            route #/draw/:id
  seal.js                Seal flow               export openSealFlow(reading, { onDone(result) })
  deck.js                Your Deck gallery       route #/deck
  card-detail.js         One card's history      route #/card/:id
  readings.js            Recent readings         route #/readings
  tin.js                 Your Tin editor         route #/tin
  settings.js            Settings + backup UI    route #/settings
src/styles/              tokens.css (all colours as tokens), base.css, components.css (buttons, chips, sheets, toasts, forms, switch, .paper), card.css, table.css, and one file per view: draw.css, seal.css, deck.css, tin.css, settings.css
public/                  copied as-is to the build root (manifest, icons, sw.js if hand-written)
scripts/                 validate-content.mjs, qa scripts
tests/unit/              Vitest (node environment; fake-indexeddb is installed for store tests)
tests/e2e/               Playwright
```

A view module exports `render(container, params)` and may return a cleanup function. Views render into `container` (a `<main class="view">`). Use `h()` for DOM. Never insert untrusted strings as HTML; card content and user text go in as text nodes.

## Store API (src/store/state.js)

- `state`: `{ ready, settings, tin: {owned, starred, overrides, preset}, meta: {installedAt, lastBackupAt, reshuffleLog, backupNudgeAt, ...}, currentId, readings: Map, seals: [], stats: {}, storageOk }`
- Settings (localStorage): `hemisphere ('auto'|'north'|'south'), followSeasons, sound, shake, motion ('auto'|'reduced'), backName, quickDeal, lastSpread, smallCount (4|6), table ('felt'|'linen'), deals`. `setSetting(key, value)`, `hemisphere()`.
- Tin: `ownedPencils()` (prepared with OKLab), `pencilHex(code)` (respects overrides), `saveTin(patch)`, `toggleOwned(code)`, `toggleStar(code)`, `setOverride(code, hex|null)`, `applyPreset(setKey|'none')`, `pencilCatalogue` (all pencils), `pencilSets`, `DEFAULT_SET`.
- Readings: `readingsByDate()`, `currentReading()`, `saveReading(r, {makeCurrent})`, `updateReading(r)`, `startDrawing(r)`, `deleteReading(id)`, `engineContext()`.
- Seals: `recordDrawn(reading, {image, thumb})` (Blobs; omit for "Drawn, no photo") → `{seal, reading}`; `sealsFor(cardId)`, `faceSealFor(cardId)`, `setFace(sealId)`, `deleteSeal(sealId)`, `imageUrl(imageId, 'thumb'|'image')` → object URL, `requestPersistence()`, `setMeta(patch)`, `reloadFromDb()` (after import), `subscribe(fn)` (events: 'ready','settings','tin','reading','seal','meta','reload').
- A seal record: `{ id, cardId, readingId, createdAt, kind: 'photo'|'tick', imageId|null, isFace, pencils: [codes], sentence, spread }`. The sealed card is the reading's `cards.who` (or `cards.theme` for "A page of small things").
- A reading: `{ id, seed, spread: 'quick'|'evening'|'big'|'small', createdAt, season, cards: {who, where, when, also, twist, theme}, oldFriend, slots, palette: {name, mood, rule, paper, fixed, bareLights, pencils: [{code, slot, role, locked}]}, text: {opener, sentence, framing, twist, firstMark, lightLine, paperLine, lonelyLine, smallTin}, status: 'dealt'|'drawing'|'drawn'|'sealed', startedAt, finishedAt }`.

If you need a store function that does not exist, add it in your own module (for example `src/store/backup.js`) using `db.js` and the exported state. Do not edit `state.js`, `db.js`, `table.js`, `app.js`, the engine or the content files; if a change there is unavoidable, explain it precisely in your final report and the lead will make it.

## Design rules

- Tokens only (see `tokens.css`): felt `--felt`, paper `--paper` + `--grain`, ink `--ink`, cream text on felt `--cream`, gilt `--gilt-gradient`, suit colours `--suit-*`. Fonts: `--font-display` (Cormorant SC, titles and buttons), `--font-body` (Lora), `--font-hand` (Caveat, sparingly for dates and little notes).
- Paper panels: `.paper` (cream with grain, ink text). Buttons: `.btn.btn-gilt` (primary), `.btn.btn-paper`, `.btn.btn-ghost`, `.btn-text`. Chips: `.chip[aria-pressed]`. Switch: `input.switch[type=checkbox]`. Forms: `.field`, `.input`, `.toggle-row`.
- Phone first (390 px wide, 16 px gutters, no horizontal scroll), then tablet and desktop. Minimum 44 px tap targets. Everything works by keyboard. Text meets WCAG AA. Respect `prefers-reduced-motion` and the `data-motion="reduced"` setting.
- Motion: transforms and opacity only, 200 to 600 ms, `var(--ease-soft)`. Every ritual animation can be skipped with a tap.
- No images in localStorage. Revoke object URLs you create (except those from `imageUrl()`, which the store caches).

## Checking your work

- `npm test` runs unit tests. `node scripts/validate-content.mjs` checks content.
- Run a dev server on your assigned port: `npx vite --port <port> --strictPort` (in the background), then drive it with Playwright from a scratch script using `import { chromium } from '/home/user/unillustrated-deck/node_modules/playwright/index.mjs'`, viewport 390x844 and 1280x900, `deviceScaleFactor: 2`, and look at the screenshots with the Read tool. Fix what looks wrong. Capture console errors.
- Put scratch scripts and screenshots in `/tmp/claude-0/-home-user/c568b4e7-266c-54a6-ac1e-fd27f40f7eae/scratchpad/<your-area>/`, not in the repo.
- Do not commit; the lead commits.
