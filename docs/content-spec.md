# Content spec

The deck's cards are hand-written JSON. The engine combines whole phrases from different cards into one sentence, so every phrase has to fit its slot exactly. This document is the contract between the writers and the engine. If something here is ambiguous, follow the examples.

## Who it is for

An adult hobbyist who colours on paper with Prismacolor Premier coloured pencils (a 48-pencil tin). She loves **animals and nature** and **everyday, cosy scenes** (food, rooms, objects, little moments). She draws for pleasure and relaxation. Every card has to be something she could draw from imagination tonight, at a kitchen table, without reference photos of anything exotic.

## Voice and style (all text)

- British English: colour, cosy, grey, mum, autumn, biscuit, jumper, allotment, wellies.
- Warm, plain, slightly wry. Concrete and sensory. Short.
- Never use em dashes (—) or en dashes as punctuation. Use commas, colons or full stops.
- Never use these words: delve, tapestry, crucial, bustling, seamless, testament, landscape, multifaceted, paramount, underscore, utilize, journey, vibrant, whimsical, enchanting, magical, nestled.
- No fortune-telling or mystical language ("fate", "destiny", "the cards foretell").
- Nothing sad, cruel or gory: no dead or injured animals, no hunting, no predators mid-kill, no bins of rubbish. Gentle mischief is fine.
- No human figures as subjects. Traces of people are lovely ("someone's reading glasses folded on an open book", "a mug left on the step").
- Avoid brand names and copyrighted characters.
- Avoid repeating the same distinctive word across many cards (for example "tiny", "little", "cosy", "golden", "soft"). Vary vocabulary.

## Controlled vocabularies

Use only these exact strings.

| Field | Allowed values |
|---|---|
| `seasons` | `spring`, `summer`, `autumn`, `winter` |
| `timeOfDay` | `dawn`, `morning`, `afternoon`, `dusk`, `night` |
| `scale` / `maxScale` | `tiny` (fits in a palm: mouse, wren, snail, acorn, egg cup), `small` (up to cat or teapot size: hedgehog, rabbit, robin, cat, loaf, jug), `medium` (fox, dog, heron, owl in flight, armchair, wheelbarrow), `large` (deer, horse, cow, swan with wings out, a whole tree, a shed) |
| `habitats` / `admits` | `home` (inside rooms: kitchen, sitting room, bedroom, hallway), `tabletop` (surfaces: tables, shelves, counters, sills, trays), `garden` (domestic garden, allotment, greenhouse surroundings, shed), `hedgerow` (lanes, hedges, field edges, stone walls), `woodland` (woods, forest floor, clearings), `meadow` (open fields, grassland, hills, moor), `water` (ponds, streams, rivers, lakes, canals), `coast` (beach, rockpool, harbour, cliff top), `farm` (farmyard, barn, orchard), `village` (street, doorstep, market, café table outside, bus stop, post box), `visitor` (see below) |
| `scope` on `doing` | `any`, `indoor`, `outdoor` |
| `scope` on Where cards | `indoor`, `outdoor`, `threshold` (in-between places that suit both indoor and outdoor action: a windowsill, a doorstep, a porch, a greenhouse, a shed with the door open) |
| `scope` on When cards | `any`, `indoor`, `outdoor` |
| `active` | `day`, `night`, `any` |
| `mood` | `warm`, `cool`, `muted`, `dark`, `bright` |
| `texture` | `fur`, `feather`, `skin` (frog, newt, slug), `shell` (snail, crab, egg), `wing` (insect wings), `petal`, `foliage`, `bark`, `stone`, `ceramic`, `glass`, `metal`, `fabric`, `wool`, `wood`, `paper`, `crust` (bread, pastry, biscuit), `fruit` (glossy fruit and veg skin), `liquid` |
| `frames` | `vignette`, `window`, `low-horizon`, `close-crop`, `from-above`, `thirds`, `tall-strip`, `postage-stamp`, `three-studies`, `sampler` |

**`visitor` habitat.** Tag a wild creature with `visitor` only if it could plausibly turn up at the edge of a home: a robin on the windowsill, a mouse in the pantry, a hedgehog on the doorstep, a wren in the shed, a moth at the window, a frog in the greenhouse. Where cards that are indoor-adjacent (`threshold`, and a few indoor ones like the pantry or the shed) list `visitor` in `admits`.

**Seasons.** A card's `seasons` lists when it is plausible and appealing in the UK-style temperate year. Most animals and objects work all year: list all four. Restrict only when the subject really is seasonal (conkers: autumn; frogspawn: spring; swallows: spring and summer; a hot-water bottle: autumn and winter). A `doing` phrase can be further restricted with its own `seasons`.

## Subject cards: `fur.json`, `leaf.json`, `hearth.json`

`fur` is Fur & Feather (animals, birds, insects, pets, farm animals). `leaf` is Leaf & Stone (plants, fungi, seeds, shells, stones, natural objects). `hearth` is Hearth (food, drink, rooms' objects, crafts, little domestic moments).

```json
{
  "id": "fur-dormouse",
  "suit": "fur",
  "title": "The Dormouse",
  "a": "a dormouse",
  "the": "the dormouse",
  "phrases": ["round as a hazelnut", "tail like a bottlebrush", "asleep more than awake"],
  "doing": [
    { "t": "is curled up fast asleep", "scope": "any" },
    { "t": "is nibbling a hazelnut held in both paws", "scope": "any" },
    { "t": "is climbing a honeysuckle stem", "scope": "outdoor", "seasons": ["spring", "summer"] },
    { "t": "is snoozing inside a ball of dry grass", "scope": "any", "seasons": ["autumn", "winter"] }
  ],
  "close": ["Just the dormouse, close enough to count whiskers.", "Only the dormouse, curled into a ball, filling the page."],
  "scale": "tiny",
  "habitats": ["hedgerow", "woodland", "garden", "visitor"],
  "seasons": ["spring", "summer", "autumn", "winter"],
  "active": "night",
  "colours": ["#C98A3E", "#E9D6AE"],
  "accent": "#E8A39B",
  "texture": "fur",
  "roles": {
    "main": "for the fur",
    "dark": "for the eye and the shadow underneath",
    "light": "for the pale belly and whiskers",
    "accent": "for the pink nose and toes"
  },
  "firstMark": ["Start with the eye: one dot of {dark}, the size of a peppercorn.", "Start with the curve of the back in a light pass of {main}."]
}
```

Rules:

- `id`: `<suit>-<kebab-name>`, unique.
- `title`: "The X" in title case. This is the card's name.
- `a` and `the`: lowercase noun phrases with the article. `a` uses "a"/"an"/"some"/"a pair of" correctly ("an otter", "some blackberries", "a pair of wellies"). `the` is the same noun with "the".
- `phrases`: 2 or 3 short evocative fragments (2 to 6 words, lowercase, no full stop) shown in italic on the card face. Sensory, specific, not a description of the drawing.
- `doing`: **at least 3** phrases. Each `t` continues the sentence straight after the `a` noun phrase and must agree with it ("is", "are", "has", "sits", "have"). **A `doing` must not contain a place, a time, a season word or weather**, because Where and When cards supply those. It can contain small props ("held in both paws", "with a crumb on its whiskers"). Present tense. No trailing punctuation. At least 2 of the phrases must have `scope: "any"` and no `seasons` restriction, so the card always works.
  - Sentence test: "{a} {doing} on the warmest windowsill." and "{a} {doing} in the long grass." must both read naturally for `any` phrases. "{a} {doing}." must read naturally on its own.
- `close`: 1 or 2 framing sentences for a 10-minute doodle of the subject alone. Each starts with "Just" or "Only" and ends with a full stop.
- `scale`: from the vocabulary. Be honest: a heron and a badger are `medium`, a robin and a teapot are `small`, a snail is `tiny`.
- `habitats`: 2 to 5 from the vocabulary. Domestic objects use `home` and/or `tabletop`; add `garden`, `village` etc. only when natural (a watering can: garden; a teacup: tabletop, home, garden for a garden table).
- `active`: `night` for nocturnal or dusk animals (owl, bat, moth, hedgehog, badger, fox can be `any`). Objects and plants: `any`.
- `colours`: 1 to 3 hex colours of the real subject as it would be coloured, dominant first. These anchor the palette engine to real pencils, so be accurate (a robin: `#B8562D` breast, `#7A6248` back). Avoid pure greys unless the subject is grey.
- `accent`: one hex colour for the small detail named in `roles.accent` (the dormouse's pink nose and toes: `#E8A39B`). It must be the colour that line describes, and visibly different from `colours[0]`.
- `texture`: from the vocabulary.
- `roles`: four short role lines, each starting with "for the". `main` is the subject's main colour area, `dark` is where the deepest value goes, `light` is highlights or the palest parts, `accent` is a small detail in ONE colour (it pairs with the `accent` hex, so never name two colours in it).
- `firstMark`: 1 to 3 sentences telling her exactly where the pencil goes first. Each must contain `{dark}` or `{main}` (replaced by a pencil name such as "Indigo Blue"). Concrete, small, starts with "Start with". Ends with a full stop.

## Where cards: `where.json`

```json
{
  "id": "where-warmest-windowsill",
  "title": "The Warmest Windowsill",
  "at": "on the warmest windowsill",
  "phrases": ["a patch of sun", "the radiator ticking below"],
  "scope": "threshold",
  "admits": ["tabletop", "home", "visitor", "garden"],
  "maxScale": "small",
  "seasons": ["spring", "summer", "autumn", "winter"],
  "frames": ["window", "close-crop"],
  "colours": ["#E8DCC4", "#8DA2B0"],
  "role": "for the painted sill and the glass"
}
```

Rules:

- `id`: `where-<kebab>`. `title`: "The X" title case (or "A X" if more natural, e.g. "A Mossy Log").
- `at`: a lowercase prepositional phrase that completes "a dormouse is curled up fast asleep ___" and also works at the start of a sentence when capitalised ("On the warmest windowsill, a dormouse..."). It must begin with a preposition (on, in, under, beside, by, among, behind, at, inside, across, along, between, against, beneath, near, outside, halfway up, at the top of...). No time or weather in it.
- `phrases`: 2 or 3 fragments, as for subjects.
- `scope`: indoor / outdoor / threshold.
- `admits`: 2 to 6 habitats. This decides which subjects can appear here. Be generous but honest: a stone wall admits `hedgerow`, `garden`, `meadow`, `farm`, `visitor`.
- `maxScale`: the largest subject that fits ("inside a teacup" is `tiny`, "the bottom step" is `medium`, "the edge of the meadow" is `large`).
- `seasons`: usually all four. Restrict only for places that only exist in a season (a frozen puddle: winter).
- `frames`: 1 to 3 composition diagrams that suit the place.
- `colours`: 1 or 2 hex colours of the setting (anchors the setting pencil).
- `role`: one "for the ..." line for the setting pencil.
- Balance: about half indoor or threshold, half outdoor. Every place must admit at least 6 subjects from the full deck in every season, so prefer common habitats.

## When cards: `when.json`

```json
{
  "id": "when-first-frost",
  "title": "The First Frost",
  "when": "on the first frosty morning",
  "phrases": ["breath you can see", "every leaf edged in white"],
  "note": "Everything has a thin white edge.",
  "seasons": ["autumn", "winter"],
  "timeOfDay": ["dawn", "morning"],
  "scope": "any",
  "mood": "cool",
  "light": "Keep the lights cool and leave the paper bare where the frost catches.",
  "shadow": "for the cold blue shadows",
  "highlight": "for the frost and the light on the glass"
}
```

Rules:

- `id`: `when-<kebab>`. `title`: "The X" title case (or a natural phrase: "Golden Hour", "A Rainy Sunday").
- `when`: a lowercase adverbial phrase that works both at the start of a sentence ("On the first frosty morning, a dormouse...") and at the end ("...on the warmest windowsill, on the first frosty morning."). Starts with a preposition (on, at, in, during, after, before, under, by, as) or "just as", "just after", "the morning after". No place in it.
- `note`: one full sentence about how the light, air or weather looks. Present tense. Ends with a full stop.
- `seasons`: when it can happen. `timeOfDay`: when in the day it happens (1 to 3 values). "By lamplight" is `dusk`, `night`.
- `scope`: `outdoor` if it only makes sense outdoors (a thunderstorm brewing could be seen through glass, so `any`; "under a sky full of stars" is `outdoor`). `indoor` for things like "while the kettle boils" or "by the fire". Prefer `any`.
- `mood`: drives the palette: `warm` (golden, fire, sun), `cool` (frost, blue hour, mist), `muted` (fog, overcast, rain, dust), `dark` (night, storm), `bright` (clear spring morning, midsummer noon).
- `light`: one plain drawing hint about value and colour temperature. Full sentence.
- `shadow` and `highlight`: "for the ..." role lines for the dark and light pencils.
- Spread: at least 6 per season (counting all-season cards), at least 5 per time of day, a mix of moods. About 40 cards.

## Twist cards: `twists.json`

```json
{
  "id": "twist-teacup",
  "title": "The Teacup",
  "rule": "Make everything tiny, small enough to fit in a teacup.",
  "phrases": ["the world in miniature", "a crumb is a boulder"],
  "effects": { "scale": "any" }
}
```

`effects` keys (all optional):

- `scale: "any"`: ignore the place's `maxScale` (miniature worlds).
- `palette`: one of `moon` (Indigo Blue and White only, ideally on dark paper), `hearthfire` (warm colours only, burnished), `sepia` (Dark Brown and White on tan or kraft paper), `two` (only two pencils), `three` (only three pencils), `mono` (one colour family in three values), `cool` (cool colours only), `warm` (warm colours only), `complement` (two opposite colours and nothing else).
- `maxPencils`: a number.
- `frame`: one composition diagram id.
- `paper`: `dark`, `tan`, `grey` or `white`.
- `requires: "seal"`: only dealt once she has sealed cards (the Mirror twist: redraw one of her own sealed cards in a new hour).

`rule` is one plain imperative sentence that reads well after "Twist: ". About 20 twists covering scale (The Teacup, From Above, Close Enough to Touch), light (The Lantern: one light source only), palette (The Moon, The Hearthfire, The Sepia Hour, Three Pencils Only, Opposites), framing (The Postage Stamp, Seen Through Glass, Half Hidden, The Keyhole), and play (The Visitor: hide a small animal somewhere in the scene; One Long Line; Left Hand Only for the first five minutes).

## Small-things themes: `themes.json`

For the "A page of small things" spread: a page of 4 or 6 little vignettes on one theme.

```json
{
  "id": "theme-rainy-sunday",
  "title": "A Rainy Sunday",
  "of": "from a rainy Sunday",
  "phrases": ["rain on the skylight", "nowhere to be"],
  "seasons": ["spring", "summer", "autumn", "winter"],
  "mood": "muted",
  "colours": ["#6F7F8C", "#C9A27A", "#A84B3A"],
  "slots": [
    "a pair of wellies dripping by the door",
    "a teapot under its knitted cosy",
    "raindrops racing down the window",
    "a cat asleep on a folded jumper",
    "a half-done jigsaw with one piece missing",
    "a mug of cocoa with the skin on top",
    "an umbrella opened out to dry",
    "a snail on the outside of the glass",
    "a stack of library books",
    "a slice of toast with honey",
    "a hot-water bottle in a stripy cover"
  ]
}
```

- `of` completes "Small things ___".
- `slots`: 10 to 12 small, separately drawable things, lowercase noun phrases with articles, each 3 to 10 words. Each should take 5 to 15 minutes to draw. Varied in kind (an animal, a food, an object, a plant, a detail).
- About 24 themes across the seasons, matching her loves: animals, nature, cosy everyday moments. Examples: A Hedgehog's Autumn, The Café Table, The Rockpool, The Bread Bin, The Allotment in June, A Snow Day, The Sewing Tin, The Bird Table, The Seaside in October, Midsummer Picnic.

## Microcopy: `lines.json`

```json
{
  "askAgain": ["The deck shuffles itself and tries once more."],
  "spreadOut": ["The deck spreads itself out. Pick the one that tugs at you."],
  "sealed": ["Sealed. {title} is yours now."],
  "drawnNoPhoto": ["Drawn. The deck has made a note."],
  "oldFriend": ["An old friend: your {name} from {month}."],
  "lonely": { "PC1030": ["Raspberry hasn't come up since {month}. She's been hoping."] },
  "lonelyFamily": { "red": ["{name} hasn't been out since {month}. Worth a go?"] },
  "deckIdea": ["The deck has an idea."],
  "noRush": ["No rush. The deck keeps."],
  "smallTins": ["A small tin is a good tin. Layer them and see how far they go."]
}
```

- `askAgain` 20, `spreadOut` 6, `sealed` 20 (with `{title}`, which is the full card title such as "The Hedgehog"), `drawnNoPhoto` 10, `oldFriend` 12 (with `{name}` like "hedgehog" and `{month}` like "March"; must read as an opener followed by a sentence), `lonely` bespoke lines for 30 common pencils in the 48 set (keys are PC codes; use `{month}`; pencils can be "she" or "it" with a light touch, never twee), `lonelyFamily` 2 templates for each family (`red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `brown`, `grey`, `black`, `white`, `metallic`) using `{name}` and `{month}`, `deckIdea` 10 small headers shown above a fresh reading, `noRush` 6, `smallTins` 4.

## Layering tips and glossary: `tips.json`

```json
{
  "textures": {
    "fur": ["Lay a light, even base in the direction the fur grows.", "Build the main colour in short flicks, leaving tiny gaps of paper.", "Add the darkest colour only where the fur tucks into shadow, then burnish the highlights with White."]
  },
  "glossary": {
    "burnish": "Press firmly with a light colour or a blender to melt the wax layers into a smooth, shiny finish."
  },
  "paper": { "dark": "Black or navy paper makes White and Indigo Blue glow.", "tan": "Kraft or tan paper gives you a free mid-tone. Add only the lights and the darks." }
}
```

- `textures`: exactly 3 plain steps for every texture in the vocabulary. Each step one sentence, specific to Prismacolor's soft, waxy core (light pressure first, layers, burnishing, leaving paper for highlights, avoid wax bloom with too many heavy layers, a sharp point for detail, side of the lead for big areas, etc.). You may mention White, Cream, Colorless Blender, or "your lightest colour".
- `glossary`: 12 to 16 terms used anywhere in the app (burnish, layer, value, wax bloom, toned paper, chromatic dark, colour temperature, impressing, hatching, cross-hatching, scumbling, lifting, blending, local colour, negative space).
- `paper`: one tip each for `dark`, `tan`, `grey`, `white`.

## Palette names: `palettes.json`

```json
{ "warm": ["Bramble Dusk"], "cool": ["Frost on the Glass"], "muted": ["Foggy Allotment"], "dark": ["Owl Light"], "bright": ["Sunday Pancakes"] }
```

12 names per mood. Two or three words, title case, cosy and specific, British, food/nature/home flavoured. No repeats.
