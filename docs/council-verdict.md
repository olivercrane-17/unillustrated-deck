# Council verdict

The brainstorm swarm produced 15 concepts; a five-advisor council chose The Unillustrated Deck unanimously. This is the chair's verdict and build spec.

## Where the Council Agrees

All five advisors picked **I1, The Unillustrated Deck**, as the spine. I1 also has the highest score total (44.5, which is 8.5 points ahead of second place). The advisors agree on the following.

- **The real problem is a set of open decisions.** She has to settle what to draw, where and when it happens, which of her pencils to use, and how big or how long. Each open decision is another small blank page. The winning app settles all of them in one tap and then gets out of the way.
- **Cards are the right frame.** A dealt reading takes the responsibility of choosing off her. It stays open enough that she still co-authors the picture. The empty gilt frame that fills with her own drawing gives her a reason to come back, with no streaks.
- **No camera colour matching.** Phone white balance under a lamp, combined with approximate Prismacolor hex values, produces false precision. It also can't be tested in the build session. The camera is used only to photograph a finished drawing.
- **Photos are optional.** The app must be fully useful to someone who never photographs anything.
- **No guilt mechanics.** No streaks, scores, wilting, nagging, daily gates, multi-week arcs or long commitments.
- **Tap comes first.** Shaking is an optional extra. The iOS motion permission is only ever requested from a tap, and it never blocks the main flow.
- **Content quality is the product.** Cards are hand-written and tagged, a compatibility filter removes nonsense pairings, and hundreds of sample readings are generated and proofread during the build.
- **Pencils come only from her tin.** Each is shown by real code, name and swatch. Swatches are labelled approximate and can be corrected. Set ownership can always be edited.
- **The app is glanceable beside the paper.** Large type, screen kept awake.
- **It is durable.** Offline PWA, IndexedDB, `navigator.storage.persist()`, and export/import backup.
- **No agent-drawn animal art.** Beauty comes from typography, gilt ornament, paper texture, suit emblems and simple composition diagrams. Her drawings are the illustrations.
- **Parts borrowed from other ideas:**
  - I4: the OKLCH harmony engine, with lock and reroll.
  - I10: weighting by season and hemisphere.
  - I5 and I7: a "first mark" line.
  - I7: a forgiving multi-vignette spread.
  - I1 and I11: The Visitor as a twist card.
  - I9: lonely-pencil flavour lines.

## Where the Council Clashes

| Clash | Positions | Chair's ruling |
|---|---|---|
| **Rerolls** | The Contrarian and the Outsider want unlimited rerolls. The First Principles Thinker wants them capped, so the app doesn't become a slot machine. | **Unlimited, shaped by design rather than gated.** The main control swaps **one card** (or one pencil). A full reshuffle is always free and always comes with a kind line. After the third full reshuffle in ten minutes, the next one fans out **three face-up subject cards to choose from**. That turns aimless rerolling into a small choice without ever blocking her. |
| **Tarot ritual and vocabulary** | The Expansionist loves the tarot frame. The Outsider says "Major Arcana", "reversed" and "spread" are jargon, and fortune-telling may put some people off. | **Keep the object, drop the mysticism.** Gilt cards, shuffle and flip all stay. The labels are plain words: *Who or what / Where / When / Twist*; *A quick doodle / A cosy evening / Something big*. Wild cards are called **Twists**. The deck *suggests*; it never predicts. |
| **Setup** | The Executor and the First Principles Thinker want a set-size preset first. The Outsider wants zero setup. | **Zero setup.** The first reading uses a default 24-pencil tin. The Tin card carries a small line, "From a standard 24 tin · Change", and editing waits until she wants to do it. |
| **Collection framing** | The Expansionist wants the gallery to show a 78-card deck visibly filling. The Contrarian warns that empty frames read as a to-do list. | **Celebrate what exists and never count what's missing.** "Your Deck" shows her illustrated cards in front, with the rest of the deck as an unopened stack she can browse. There is no "12 of 168" and no progress bar. |
| **How much recipe** | The Contrarian and the Executor want I4's layering recipe card. The Outsider warns it will feel like a teacher's instructions. | **The sentence and pencils come first, and depth sits behind a tap.** Each pencil gets a one-line role ("for the fur"). A "How to layer" drawer holds three plain steps. Technique words have a tap-for-meaning gloss. |
| **Scope of extras** | The Expansionist wants unlockable suits, print-the-deck and shareables. The Executor wants those cut first. | Share-a-card is **P1**. Unlockable suits and print-the-deck are **P2**, built only after the core loop is excellent. |
| **I10's "real world" grounding** | The First Principles Thinker wants a live sky, real weather and a micro-season name. The Contrarian and the Executor warn about network dependency and a sky that visibly doesn't match the window. | **Use only the date, the time of day and the hemisphere, worked out on the device with no network.** First Frost turns up in October, not July. No weather API and no sky engine. A season name line is P2. |
| **Nine Small Things** | Some advisors would make it a whole app; others say mm-accurate placement is fake utility. | **It becomes a single spread, "A page of small things",** with 4 or 6 slots on a simple sampler diagram. No millimetre measurements. It can be resumed. |
| **Pencil voices and lonely pencils** | Charming (I9), but the wear mechanic depends on logging after every session. | **Usage is tracked implicitly** when she taps "Start drawing" or seals a card. No logging chores. The lonely line is honest about what the app knows: "Raspberry hasn't come up since August", not "hasn't left the tin". |
| **Emotional warmth (I12's appeal)** | The Outsider loved Bramble's warmth. The First Principles Thinker says templated reactions to art the app never saw are hollow. | **Use kind lines that only refer to facts the app knows** (the card, the pencils, the date, the season). It never pretends to have looked at or judged her drawing. |

## The Decision

**The Unillustrated Deck**: *a deck of drawing cards with no pictures until you draw them.* Tagline on the home screen: **"Draw a card. Then draw it."** The PWA short name is "Unillustrated".

The product is one coherent object: a deck of cream, gilt-edged cards on a felt table. One tap deals a reading. The reading is a single vivid sentence: a subject from Fur & Feather, Leaf & Stone or Hearth, a place, and an hour of light, weather and season. With it comes a **Tin card** naming 3–5 pencils she actually owns, by code, name and swatch, plus a "first mark" telling her where the pencil goes first. When she finishes, she can optionally photograph the drawing and **seal it into the card**. From then on, that card carries her art, and her own hedgehog comes back to her in future readings.

**Why it beats the alternatives**

- **It answers every decision in about 10 seconds**, and needs no camera, setup, permission or daily gate.
- **It is the only concept that gets better with every drawing.** The collection is made of her own work, so it deepens over time instead of wearing off. It never runs out the way story arcs do.
- **Its quality comes from things an agent can do excellently:** typography, ornament, careful writing and well-tested engine logic. It does not depend on agent-drawn illustrations or unverifiable colour accuracy.
- **It survives real life.** She can skip a week, reroll freely, never take a photo, and draw a dormouse from imagination without owning a cat or a garden. The app still works and still feels kind.
- **The best parts of the runners-up fit naturally as cards** rather than bolted-on systems: I4's palette engine is the Tin card, I10's seasons are deck weighting, I7 is a spread, I5's first mark is a line in every reading, and I11's Visitor is a Twist.

## Core Loop

These are the 30 seconds from opening the app to pencil on paper.

1. **0 s: Open.** The felt table shows the deck, one large **"Draw a card"** button, and a row of time chips: *A quick doodle · 10 min* / *A cosy evening* / *Something big* / *A page of small things*. The last choice is remembered. If a reading is in progress, a small "Carry on: The Dormouse" chip sits above the deck. On the very first run, a single handwritten note says: *"Tap the deck. It'll suggest something to draw, and which of your pencils to use."* There is no onboarding wall.
2. **1 s: Tap.** The deck riffles for about 1.2 s with an optional soft paper sound, and cards slide into position. A tap anywhere skips the animation. After the third use the shuffle shortens to a 400 ms deal by default.
3. **3 s: Reveal.** The cards flip in sequence, about 350 ms apart: WHO OR WHAT, then WHERE, then WHEN, then the TIN. Tapping any face-down card flips it straight away. Each card face shows its calligraphic title and 2–3 small evocative phrases.
4. **6 s: The reading.** One sentence appears below the cards in large serif type: *"On the first frosty morning, a dormouse is curled up asleep on the warmest windowsill."* Under it is the Tin, three large swatches with roles:
   - **PC1034 Goldenrod**, for the fur
   - **PC901 Indigo Blue**, for the cold shadows
   - **PC938 White**, for frost and the light on the glass

   Then the first mark: *"Start with the eye: one dot of Indigo Blue, the size of a peppercorn."*
5. **8 s: Adjust if she wants to.** Tap a card to swap only that card. Tap a pencil to swap it, or press its lock to keep it. Two text buttons offer *New colours, same picture* and *New picture, same colours*. *Ask the deck again* reshuffles everything.
6. **10 s: "Start drawing".** This opens the Drawing View: large type for a phone propped beside the paper, the screen kept awake, and the composition diagram if the spread has one. The pencils' last-used dates update silently.
7. **About 15–30 s: She takes those exact pencils out of her real tin and makes the first mark.**
8. **Later (optional).** She taps *"I've drawn it"*. She can then **seal a photo** (camera or library, crop, seal) or just choose **"Drawn, no photo"**, which marks the card with a small handwritten tick and the date. Both are complete endings.

## Feature Spec

### P0: must ship

1. **Instant deal home.**
   - One deck and one primary button. Time chips choose the spread.
   - The first reading is possible with zero setup, using the default 24 tin.
   - The current reading persists and is resumed on reopen.
   - Desktop: Space or Enter draws a card.
2. **Card library and dealing engine.**
   - Hand-written, tagged cards (see Content Plan).
   - Weighted, seeded selection that applies, in turn: the compatibility filter, season and hemisphere, a gentle time-of-day weight on the WHEN card, and a no-repeat window (no card reappears in the same position within her last 30 readings).
   - Every reading stores its seed and card IDs so it can be reproduced exactly.
3. **Spreads.**
   - **A quick doodle (about 10 min):** WHO OR WHAT plus Tin (3 pencils) plus first mark. Framing line: "Just the dormouse, close up."
   - **A cosy evening:** WHO OR WHAT, WHERE, WHEN, plus Tin (3–4 pencils), first mark and composition diagram.
   - **Something big:** WHO OR WHAT, WHERE, WHEN, ALSO IN THE PICTURE (a small companion from a different suit), and a TWIST card, plus Tin (4–5 pencils), first mark and composition diagram.
4. **The reading sentence.** Assembled from whole hand-written phrases and position-specific templates. Never word-level madlibs. 4–6 templates per spread, with the last 3 templates used never repeated. A twist adds its own sentence ("Twist: make everything tiny, small enough to fit in a teacup.").
5. **The Tin card (harmony engine).**
   - Deals only owned pencils, shown as code, name, swatch and a one-line role. The palette gets a cosy name ("Bramble Dusk", "Robin & Holly", "Foggy Allotment", "Sunday Pancakes", "Frost on the Glass").
   - Each pencil can be swapped individually or locked.
   - *New colours, same picture* and *New picture, same colours* are always available.
   - A "How to layer" drawer gives three plain steps, from light layer to burnish or leaving the paper.
   - Colorless Blender is never dealt as a colour. It only appears in tips, and only if she owns it.
6. **Swap and ask again.**
   - Swapping one card re-samples just that position under the constraints of the other cards, relaxing the rules if nothing fits.
   - A full reshuffle is unlimited and shows a rotating kind line ("The deck shuffles itself and tries once more.").
   - After 3 full reshuffles within 10 minutes, the next one offers three face-up subjects to pick from ("The deck spreads itself out. Pick the one that tugs at you."). She can still reshuffle.
7. **Your Tin.**
   - Set-size presets (12, 24, 48, 72, 132, 150) are starting points only, labelled "tick what's really in your tin".
   - A searchable tick-list grouped by colour family, with select all or none, a running count, a star for favourites, and a way to add loose pencils.
   - Tapping a pencil opens "Looks off?", which lets her override its swatch (colour input plus a side-by-side preview). The override is stored locally.
   - Permanent note: "Screen colours are approximate. Your pencils are the truth."
8. **Drawing View.**
   - Large type: the sentence at 22–26 px, pencils at 48 px swatches, the first mark and the composition diagram.
   - Screen Wake Lock is re-acquired when the page becomes visible again. If it isn't supported, the app degrades quietly.
   - The layering tips drawer.
   - "I've drawn it" sits at the bottom. Landscape-friendly on tablets.
9. **Seal the Card.**
   - Uses `<input type="file" accept="image/*" capture="environment">`, with a library option.
   - A simple 5:8 crop: drag and pinch, plus a "fit whole drawing" toggle that letterboxes the photo on cream.
   - Saves a 1200 px long-edge JPEG (quality 0.85) and a 360 px thumbnail as Blobs in IndexedDB.
   - The card flips to its back, then forward with her drawing in the gilt frame, the title and a handwritten date.
   - **"Drawn, no photo"** is an equal option that adds a tick and the date.
10. **Your Deck (gallery and history).**
    - A grid of her sealed and drawn cards by suit, with the unopened rest of the deck as a browsable stack. No totals or percentages.
    - Tapping a card shows its history: every drawing and reading for that card, with dates, pencils and sentence. If a card has several drawings, she chooses which one is its face.
11. **Her art comes back.** Once she has at least 3 sealed cards, about 1 in 6 readings deals a sealed card as WHO OR WHAT, face up with her drawing. The sentence then opens with "An old friend: your hedgehog from March, this time…".
12. **Durability.**
    - `navigator.storage.persist()` is requested after the first seal.
    - **Export backup**: a zip of JSON plus images. It downloads, and on mobile uses the Web Share API so the file can be saved to Files.
    - **Import**, with a choice to merge or replace, and validation of the schema version.
    - `schemaVersion` migrations.
13. **PWA and deploy.**
    - Installable and fully offline.
    - A versioned service worker that shows a "A fresh deck is ready · Reload" toast when an update arrives.
    - Relative paths that work under the GitHub Pages subpath, and hash routing.
    - Deployed with GitHub Actions.
14. **Accessibility and comfort.**
    - `prefers-reduced-motion` turns flips into crossfades and cuts the shuffle to a quick deal.
    - All actions work by tap and by keyboard. Text meets WCAG AA contrast on the felt.
    - A minimum 44 px tap target. Card faces are real text, not images.

### P1: should ship

1. **Twists (wild cards).** Always dealt in *Something big*; about 15% of *A cosy evening* readings get one. Each twist can override a rule (scale, light, palette or frame). See the Content Plan.
2. **A page of small things.**
   - A theme card ("Small Things from a Rainy Sunday") with 4 or 6 one-line slots on a 2×2 or 2×3 sampler diagram.
   - One page palette of 4–5 pencils, with one **"thread" pencil** that appears in every slot to tie the page together.
   - She ticks off slots as she draws them, and the page can be resumed.
   - One optional "wobbly slot" ("one unbroken line, no lifting"). The whole page seals into its theme card.
3. **Lonely pencils.** If an owned pencil hasn't been dealt or used in 21 or more days, it occasionally (about 25% of readings) replaces a palette pencil that fills a similar role. It comes with one voice line: *"Raspberry hasn't come up since August. She's been hoping."* About 30 bespoke lines for common pencils, plus family templates for the rest.
4. **Seal ceremony polish.** A foil shimmer sweeps across a sealed card, driven by pointer or touch movement, plus a one-off sweep on reveal.
5. **Sound and shake.**
   - Web Audio synthesised sounds, with no audio files: a paper riffle, a card flip and a pencil clink.
   - Sound is **off by default**, with a one-tap speaker icon on the table.
   - Shake-to-shuffle can be turned on in Settings. On iOS, the toggle's tap requests DeviceMotion permission.
6. **Share a card.** Renders a sealed card on canvas (her photo, gilt frame, title, date, and an optional "from the deck of ___") as a PNG for the share sheet or download.
7. **The Mirror twist.** Once she has sealed cards, a twist can ask her to redraw one of them in a new season or hour: "Your hedgehog from March, now on a frosty night." A different seal photo is stored, and the card's history shows the two side by side.
8. **Recent readings.** A short list of the last 20 readings, which can be resumed, re-opened in the Drawing View or deleted.
9. **Gentle backup reminder.** After the 5th seal, and then at most once every 30 days if she hasn't exported since: *"Your deck lives only on this device. Save a copy somewhere safe?"* Always dismissible.
10. **Settings.** Hemisphere (auto-detected, with an override), sound, shake, motion, the name on the card back, and "always use the quick deal".

### P2: nice to have

1. **Gift suits.** The Pantry, Rockpool and Midwinter arrive as presents after 5, 12 and 20 seals ("A new suit has been tucked into the box."). Never shown as locked or with a countdown.
2. **Print the deck.** A print stylesheet lays out her sealed cards as cut-out sheets, 9 per A4 or Letter page, with a card-back design and a title card ("The Deck of ___").
3. **Season line.** A small handwritten note naming the current half-month ("Conkers drop and scarves come out"), using 24 entries per hemisphere.
4. **Gentle timer.** Optional 10, 20 or 45 minute sand timer in the Drawing View. It never alarms; it only shows a soft "That's the time. Carry on if you like."
5. **Printable swatch chart.** Her owned pencils in a grid with empty boxes, for swatching on her own paper and then correcting the on-screen colours by eye.
6. **Tilt shimmer.** DeviceOrientation-driven foil, with permission requested from the same tap as shake.
7. **Linen table theme.** A lighter table for bright daylight.

## Content Plan

### Card libraries

All cards are hand-written JSON, split into one file per suit.

| Library | Size | Notes |
|---|---|---|
| **Fur & Feather** (animals) | 60 | Real animals first: dormouse, hedgehog, wren, robin, hare, badger, otter, fox cub, heron, goldfinch, field mouse, bumblebee, snail, frog, sleeping cat, spaniel, hen… Nothing anthropomorphic is required. |
| **Leaf & Stone** (nature) | 45 | Conkers, a fairy-ring of mushrooms, a pinecone, rosehips, a fern unfurling, a pebble with a stripe, a sycamore key, foxgloves, frost-edged bramble leaves… |
| **Hearth** (food, rooms, objects) | 60 | A teapot under a knitted cosy, a cinnamon bun, jam on toast, a darning basket, a stack of library books, a jar of marmalade with sun through it, a sleeping kettle, a bowl of clementines… |
| **Where** (places) | 50 | Indoor and outdoor: the warmest windowsill, the pantry shelf, a mossy log, the bottom step, a bramble hedge, a rain barrel, the bread bin, a teacup shelf, an allotment fence… |
| **When** (hours: light, weather, season) | 40 | The first frost, golden hour, a rainy Sunday, blue hour, by lamplight, the morning after snow, a thunderstorm brewing, midsummer midnight… |
| **Twists** | 20 | The Teacup, The Lantern, The Visitor, The Moon, The Hearthfire, The Sepia Hour, From Above, Close Enough to Touch, Half Hidden, The Postage Stamp, Three Pencils Only, The Mirror, Seen Through Glass… |
| **Small-things themes** | 24 themes × 10–12 slots | "a Rainy Sunday", "a Hedgehog's Autumn", "a Cafe Table", "the Rockpool", "the Bread Bin"… |
| **Gift suits** (P2) | 3 × 15 | The Pantry, Rockpool, Midwinter. |
| **Microcopy** | about 120 lines | Ask-again lines (20), seal lines (20), old-friend openers (12), lonely-pencil lines (30 bespoke plus 12 family templates), backup and empty-state copy. |
| **Layering tips** | about 50 | Keyed by role (light layer, main, shadow, highlight, accent) × texture (fur, feather, glossy, matte, foliage, glass, steam, wood, fabric, stone). Plain language with optional glosses. |
| **Composition diagrams** | 10 SVGs | Circle vignette, window frame, low horizon, close crop, from above, off-centre thirds, tall strip, postage stamp, three-study plate, sampler grid. |
| **Palette names** | about 30 | Keyed by harmony rule × mood. |

### Card schemas (whole phrases, written per card)

```json
{ "id": "ff-dormouse", "suit": "fur", "title": "The Dormouse",
  "a": "a dormouse", "the": "the dormouse",
  "phrases": ["round as a hazelnut", "tail like a bottlebrush", "asleep more than awake"],
  "doing": [
    { "t": "is curled up fast asleep", "scope": "any" },
    { "t": "is nibbling a hazelnut held in both paws", "scope": "any" },
    { "t": "is climbing a honeysuckle stem", "scope": "outdoor" },
    { "t": "is hibernating in a nest of dry grass", "scope": "any", "seasons": ["winter"] } ],
  "scale": "tiny", "habitats": ["hedgerow", "woodland", "garden", "visitor"],
  "seasons": ["spring", "summer", "autumn", "winter"], "active": "night",
  "colours": ["#C98A3E", "#E9D6AE"], "texture": "fur",
  "firstMark": ["Start with the eye: one dot of {dark}, the size of a peppercorn."] }
```

- **Where** cards carry: `at` ("on the warmest windowsill"), `phrases`, `scope` (indoor or outdoor), `admits` (a list of habitats), `maxScale`, and `frames` (suggested diagrams).
- **When** cards carry: `when` ("on the first frosty morning"), `note` (a full sentence, "Everything has a thin white edge."), `seasons`, `timeOfDay`, `scope` (any or outdoor), `mood` (warm, cool, muted, dark or bright) and `light` (a drawing hint).
- **Twist** cards carry: `rule` (one plain sentence) and `effects` (`scaleOverride`, `paletteRule`, `maxPencils`, `frame`, `paper`).

Subject agreement such as "is" versus "are" is baked into each card's own `doing` phrases, so the grammar never has to conjugate.

### Combining without nonsense

- **Compatibility:**
  - `subject.habitats ∩ place.admits ≠ ∅`.
  - `subject.scale ≤ place.maxScale`, unless the twist is The Teacup.
  - The `doing.scope` must fit the place's scope.
  - The When card's `scope` must fit the place (an outdoor-only hour can't go with an indoor place, except via "seen through the window" templates).
  - The season must agree with both subject and hour.
  - Nocturnal animals weight towards night and dusk hours.
  - Portable nature items such as conkers and pinecones may come indoors. Wild animals come indoors only into places tagged `visitor` (pantry, windowsill, garden shed).
- **Seasons:** in-season cards weigh ×3, cards for any season ×1, and strongly seasonal cards out of season ×0 (no snow in July). The hemisphere comes from the time zone (a list of southern zones such as Australia/\*, Pacific/Auckland, America/Argentina/\*, Africa/Johannesburg and America/Santiago), with a Settings override.
- **Templates:** each spread position has 4–6 hand-written templates, for example:
  - `"{When}, {subject.a} {doing} {place.at}."`
  - `"{Place.At}, {subject.a} {doing}. {when.note}"`
- **Content validator:** run in CI. It checks the schema, that every `{slot}` resolves, and that every Where card has at least 6 compatible subjects in every season in both hemispheres. It also checks that every subject has at least 2 `doing` phrases, at least 2 `phrases` and a first mark containing `{dark}`.
- **QA script:** `scripts/qa-readings.mjs` prints **at least 400 readings** across seasons, hemispheres, spreads and tins (12, 24 and 150) to `qa/samples.md`. The agent proofreads them and fixes the cards and templates. The script also asserts no unfilled slots, no "a a" or "a apple", no double spaces, correct capitalisation and no pencil outside the tin. A separate `qa/palettes.html` renders 100 dealt palettes as swatch rows so they can be checked by eye.

### Prismacolor colours

- **`pencils.json`.** About 150 Premier colours, each with `code`, `name`, an approximate as-laid `hex`, precomputed `oklab` and `oklch`, a `family` and a `special` flag (`blender`, `metallic`, `white`, `black`). It includes the common core (PC901 Indigo Blue, PC914 Cream, PC935 Black, PC938 White, PC946 Dark Brown, PC1005 Limepeel, PC1030 Raspberry, PC1034 Goldenrod, PC1023 Cloud Blue, PC937 Tuscan Red, PC943 Burnt Ochre, PC1077 Colorless Blender and the rest). The agent compiles it carefully, with no duplicate codes. It is **labelled approximate everywhere**, and her local overrides always win.
- **`sets.json`.** Best-effort membership for the 12, 24, 48, 72, 132 and 150 sets, marked `"confidence": "approximate"`. Presets only pre-tick the list, and the engine must work with any subset of 1 or more pencils.
- **Harmony algorithm.** All steps run in OKLab and OKLCH and use only owned, non-blender pencils.
  1. **Anchor.** For each of the subject's `colours`, find the nearest owned pencil by ΔE in OKLab, and keep 1–2 anchors.
  2. **Rule.** Pick a rule allowed by the When card's mood or the twist: analogous (±30°), complementary, split-complementary (±150°), muted (low chroma), warm or cool restricted, or a value trio. Generate target hue, lightness and chroma, and snap each target to the nearest owned pencil not yet chosen, keeping chosen pencils at least ΔE 8 apart.
  3. **Value coverage.** Make sure there is one dark (L below 0.42). Prefer chromatic darks (Indigo Blue, Dark Brown, Tuscan Red, Dark Purple) over Black, which is dealt rarely and only as an accent. Make sure there is a light: either White (as a highlight or burnish) or the line "leave the paper bare for the lights". White and Black are never both dealt unless a twist asks for it.
  4. **Twist palette rules.** The Moon: Indigo Blue plus White, on dark paper. The Hearthfire: warm hues only, burnished. The Sepia Hour: Dark Brown plus White on tan paper. If she doesn't own the needed pencils, fall back to the nearest owned ones.
  5. **Lonely swap.** P1, described above.
  6. **Name and roles.** Name the palette, then assign roles by lightness and subject texture ("for the fur", "for the cold shadows", "for frost and the light on the glass").
  7. **Small tins.** Relax the thresholds step by step. With 3 or fewer owned pencils, deal all of them, with an encouraging line about layering.
- **Never claimed:** colour matches against photos, exactness, or "you own all five" style precision about the physical world.

## Look and Feel

- **The object.** A deep moss-green felt table (`#24382E`, with a subtle baked noise texture) holds cream card stock (`#F3EAD7`, with a fine paper-grain tile). Gilt edges and corner flourishes use layered linear gradients (`#9C7330 → #E8CB7E → #A57B33`). Ink is `#2A211C`.
- **Suit colours**, used only as a thin inner rule and on the emblem: Fur & Feather umber `#6B4A2F`, Leaf & Stone moss `#4E6B3A`, Hearth oxblood `#7B2D26`, Hours dusk blue `#3B4A6B`. All colours are defined as tokens on `:root`.
- **Cards** are 5:8, built from HTML and CSS with an inline SVG ornament sprite. The front has the title in letterspaced small caps, a suit emblem drawn as a simple line ornament (feather, leaf, teacup or flame, sun and moon), and 2–3 phrases in italic. The back is a diamond-lattice pattern with tiny stars and an optional name cartouche.
  - **Empty cards** show the frame, the title and a faint gilt emblem where the picture will go. They do not say "to do" or "missing".
  - **Sealed cards** show her photo inset in the frame with a soft inner shadow, so it looks mounted, with the date in handwriting below.
- **Typography,** self-hosted woff2 subsets:
  - **Cormorant SC** (or IM Fell English SC) for card titles.
  - **Lora** for the reading and body text. It stays legible at 22–26 px on a phone lying on a desk.
  - **Caveat**, used sparingly, for dates, little notes and the first-run hint.
- **Motion.** A riffle shuffle, 3D card flips (transform and opacity only, 500–600 ms, soft ease) and a foil sweep on seal. Everything can be skipped with a tap. Reduced motion turns it all into crossfades.
- **Sound** (P1, off by default). Synthesised paper and wood, quiet and short.
- **Tone of voice.** British English (colour, cosy). Warm, plain and slightly wry. Short sentences, second person, never bossy.
  - "The deck has an idea."
  - "The deck shuffles itself and tries once more."
  - "Sealed. The Hedgehog is yours now."
  - "An old friend: your hedgehog from March."
  - "No rush. The deck keeps."
  - **Never:** "You haven't drawn in 5 days", streaks, praise for art it hasn't seen, or mystical "your fate" language.
- **Jargon.** Every technique word (burnish, layer, toned paper, chromatic dark) gets a tap-for-meaning gloss, for example: *"Burnish: press firmly to melt the wax layers into a smooth, shiny finish."*
- **What makes it feel handmade.** Real paper grain. Slight per-card rotation jitter (±1.5°) when dealt. Hand-lettered-feeling titles. Handwritten dates. Composition diagrams drawn with a slightly wobbly stroke (SVG paths with a gentle `feTurbulence` displacement). Above all, her own drawings becoming the illustrations.

## Traps to Avoid

- **A setup wall** of any kind: set size, permissions or a tutorial before the first reading.
- **Camera colour analysis** or any false-precision claim ("94% Limepeel"). Swatches must always say they are approximate.
- **Daily gates, capped rerolls, multi-week arcs, chapters or books.** Anything that blocks "I want to draw now" or builds guilt.
- **Streaks, scores, progress percentages, wilting or nag notifications.** No empty-collection counters such as "12 of 168".
- **Mandatory logging or photographing.** Usage tracking stays implicit, and "Drawn, no photo" is a complete ending.
- **Madlib noun soup** ("a whale on the teacup shelf") and word-level grammar. Use whole phrases, tags, the validator and QA samples.
- **Palettes so literal that Raspberry always means raspberries.** Subject-first readings plus mood-driven harmony avoid this.
- **Tarot jargon on screen** (Major Arcana, reversed, spread, suit) or fortune-telling framing.
- **Overloading the reading.** Show the sentence, the pencils and the first mark. Everything else sits behind a tap.
- **Shake as the only input,** or an iOS permission prompt in the main flow. Ritual animations that can't be skipped.
- **Agent-drawn pictorial animal art.** Use typography, ornament, emblems and diagrams instead.
- **Treating set presets as truth.** Ownership must always be editable.
- **Images in localStorage.** Images go in IndexedDB only.
- **Silent data loss on iOS.** Use `persist()`, export and import, and the gentle reminder.
- **Absolute paths that break the GitHub Pages subpath.** A stale service worker serving old builds forever.
- **Runtime CDN dependencies** that break offline use. Bundle or vendor everything, including fonts.
- **Scope sprawl.** If time runs short, cut in this order: gift suits, print-the-deck, tilt shimmer, sounds, the Small Things spread. **Never cut** the Tin card, sealing, backup or content QA.

## Build Notes

### Stack and repo

- **New GitHub repo:** `unillustrated-deck`.
- **Tooling:** Vite with vanilla JS ES modules and no UI framework. Build small view functions on top of a tiny state store, and use hash routing (`#/`, `#/reading/:id`, `#/draw/:id`, `#/deck`, `#/card/:id`, `#/tin`, `#/settings`).
- **Paths:** `base: './'`, `manifest.start_url: "./"`, `scope: "./"`.
- **Dependencies:** **fflate**, bundled, for the zip backup. Everything else is hand-written.
- **Tests:** Vitest for unit tests and Playwright for end-to-end tests.
- **Deploy:** a GitHub Actions workflow builds and deploys to Pages on every push to `main`, and runs the unit tests, the content validator and the end-to-end smoke tests before deploying.

```
src/
  engine/   rng.js (mulberry32), color.js (sRGB↔OKLab/OKLCH, ΔE), compat.js, select.js,
            grammar.js, harmony.js, seasons.js (hemisphere from tz), lonely.js
  data/     pencils.json, sets.json, cards/{fur,leaf,hearth,where,when,twists,themes}.json,
            tips.json, palettes.json, lines.json, diagrams.svg
  store/    db.js (tiny IndexedDB promise wrapper), backup.js, migrate.js
  ui/       table.js, card.js, reading.js, tin.js, draw.js, seal.js (crop), deck.js, settings.js, sound.js
  sw.js     (precache list injected at build by scripts/sw-manifest.mjs, versioned by build hash)
scripts/    validate-content.mjs, qa-readings.mjs, qa-palettes.mjs, sw-manifest.mjs
tests/unit, tests/e2e, qa/
```

### Data model

**localStorage** holds only small settings: hemisphere override, sound, shake, reduced motion, last spread, card-back name, and `quickDeal`.

**IndexedDB** stores:

| Store | Contents |
|---|---|
| `tin` | `{ owned: [codes], starred: [codes], overrides: { code: hex }, presetOrigin: 24 }` |
| `readings` | `{ id, seed, createdAt, spread, cards: {who, where, when, also?, twist?}, doingId, templateId, pencils: [{code, role, locked}], paletteName, firstMark, status: dealt\|drawing\|drawn\|sealed, slots?: [{text, done, doneAt}] }` |
| `seals` | `{ id, cardId, readingId, createdAt, image: Blob, thumb: Blob, pencils, isFace }` |
| `pencilStats` | `{ code, lastDealt, lastUsed, timesUsed }`, updated on "Start drawing" and on seal |
| `meta` | `{ schemaVersion, lastBackupAt, reshuffleLog: [timestamps], installedAt }` |

### Engine notes

- **Determinism.** A reading is a pure function of the seed, the tin, the date, the hemisphere and the history snapshot. Swaps derive a sub-seed from the reading seed plus the position plus a swap counter.
- **Selection.** Weighted sampling: season ×3/×1/×0, time-of-day ×1.5 on the When card, suit affinity ×1.25 for suits she seals most, a recency exclusion window of 30, and an old-friend injection at 1 in 6 once she has 3 or more seals. Draw the subject, then a compatible place, then a compatible hour, then a `doing` phrase and a template. If any step has no candidate, relax the constraints (season, then time, then scale) and log it in development builds.

### Image pipeline

1. File input.
2. `createImageBitmap(file, { imageOrientation: 'from-image' })`, falling back to `<img>.decode()`.
3. Pointer-events crop with pinch and drag at 5:8, or "fit whole".
4. Canvas, then `toBlob('image/jpeg', 0.85)` at 1200 px plus a 360 px thumbnail.
5. Revoke object URLs when views unmount.
6. Check `navigator.storage.estimate()` before writing, and warn kindly if space is low.

### Offline and updates

- The service worker serves the app shell cache-first and keeps one cache per build hash, deleting old caches on activate.
- A new worker waits until the "A fresh deck is ready · Reload" toast is accepted, then sends `skipWaiting`.
- No network calls at runtime, ever.

### Platform quirks to handle

- **iOS:** DeviceMotion and DeviceOrientation permission must come from a user tap. Wake Lock needs iOS 16.4 or later; degrade quietly. HEIC from the file input is normally converted to JPEG by Safari; also handle a decode failure with a kind error.
- **Storage:** `persist()` may be denied. Treat backup as the real safety net.

### Hardest parts and mitigations

1. **Content that reads as intentional.** Give writing a large, protected share of the session. Run the validator, generate 400 or more QA samples, proofread them, and do a read-aloud pass on 50 random readings per spread.
2. **A card that looks genuinely beautiful at 390 px.** Build the card component first. Iterate with Playwright screenshots at phone, tablet and desktop sizes before building flows on top of it.
3. **Palettes that look good from 12 to 150 pencils.** Unit-test with tin fixtures. Review `qa/palettes.html` by eye. Test relaxation for tiny tins.
4. **Crop and seal UX on touch devices.** Keep the cropper minimal and make "fit whole" a safe default.
5. **Data safety and migrations.** `schemaVersion`, migration tests, and a round-trip test for export and import.

### Tests

**Unit tests:**
- RNG determinism.
- Compatibility is never violated across 10,000 sampled readings for each season and hemisphere.
- Harmony returns only owned, distinct pencils (ΔE 8 or more apart), always includes a dark, and never deals the blender.
- Grammar leaves no unfilled slots and handles articles correctly.
- The hemisphere and season mapping is correct.
- The no-repeat window works.
- Lonely-pencil selection is honest: it only fires when the pencil's last-dealt date is at least 21 days ago.

**End-to-end tests** (Playwright, iPhone-sized viewport, reduced motion):
- First open, one tap, and a full reading with 3 swatches.
- Swap one card, and the other cards are unchanged.
- *New colours, same picture* keeps the cards.
- Switch the tin to the 12 set, and every dealt pencil is in that set.
- Seal with a fixture JPEG, and it appears in Your Deck and survives a reload.
- "Drawn, no photo" ticks the card.
- An offline reload still deals a reading.
- Export, clear, import restores everything.

### Build order, with a code review after each milestone

1. Data, the engine and unit tests, plus the validator and the QA script. **Review.**
2. The card component, the home table and the reading. **Review.**
3. Your Tin and the Drawing View. **Review.**
4. Seal, Your Deck, old-friend returns, and backup with persistence. **Review.**
5. PWA, the service worker and the Pages deploy, with end-to-end tests in CI. **Review.**
6. P1 features in the order listed. **Review.**
7. A full content proofreading pass, visual polish and an accessibility audit. **Final review**, then P2 features if time allows.