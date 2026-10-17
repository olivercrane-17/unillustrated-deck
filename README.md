# The Unillustrated Deck

**Draw a card. Then draw it.**

A deck of drawing cards with no pictures until you draw them. It was made for a friend who loves colouring with Prismacolor pencils but often can't think what to draw.

You tap the deck and it deals a reading:

> *On the first frosty morning, a dormouse is curled up fast asleep on the warmest windowsill.*
>
> **PC1034 Goldenrod**, for the fur · **PC901 Indigo Blue**, for the cold shadows · **PC938 White**, for the frost and the light on the glass
>
> *Start with the eye: one dot of Indigo Blue, the size of a peppercorn.*

Every decision is made in about ten seconds:

- what to draw
- where and when it's happening
- which three to five of **your own** pencils to use, by code and name
- where the first mark goes

When the drawing is finished, you can photograph it and **seal it into its card**. Over months the empty deck fills with your own art, and your old drawings come back in new readings: *"An old friend: your hedgehog from March."*

## What's in it

- **Four lengths of reading:**
  - *A quick doodle*: one subject, about 10 minutes.
  - *A cosy evening*: who, where and when.
  - *Something big*: adds a companion and a twist.
  - *A page of small things*: 4 or 6 tiny pictures on one theme.
- **About 400 hand-written cards** in four groups:
  - Fur & Feather
  - Leaf & Stone
  - Hearth
  - Places and hours

  They're combined by compatibility rules, so you never get a heron on the teacup shelf. They also follow the real season in your hemisphere: conkers in October, never snow in July.
- **Your tin.**
  - Tick the pencils you really own. Presets for the 12, 24, 48 and 150 boxes are only a starting point.
  - The 48 tin asks which purple you have, since Lilac was retired in 2022.
  - Palettes are dealt in OKLab colour space from your pencils only.
  - Any pencil can be kept or swapped, and every swatch can be corrected by eye.
- **Twists:** The Teacup (everything miniature), The Moon (Indigo Blue and White on dark paper), Three Pencils Only, The Visitor and more.
- **A drawing view** for propping beside the paper. It has big type, keeps the screen awake, shows a composition diagram and layering tips, and offers a gentle timer.
- **Seal the card** with a photo (with a crop), or just mark it "Drawn, no photo".
- **Your deck:** a gallery of your sealed cards and their histories. You can share any card as an image.
- **Lonely pencils:** now and then a pencil that hasn't come up for a few weeks asks for a turn.
- **No streaks, scores or nagging. Ever.**
- **Works offline and installs to the home screen.** Everything lives on your device. You can save and restore a backup file.

## Running it

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (engine, palettes, backup, image maths)
npm run validate   # check the card content against docs/content-spec.md
npm run qa         # deal hundreds of readings, check them, write qa/samples.md
npm run build      # production build in dist/
npm run e2e        # end-to-end tests against the production build
```

Every push to `main` runs the content validator, the unit tests, the reading QA, the build and the end-to-end tests, then deploys to GitHub Pages.

## How it was made

A swarm of five agents brainstormed fifteen concepts, each from a different angle: a game designer, a coloured-pencil teacher, a creativity psychologist, a lateral inventor and a storyteller. A council of five advisors (contrarian, first principles, expansionist, outsider, executor) scored every concept, and all five chose this one. The chair's full verdict and build spec is in [`docs/council-verdict.md`](docs/council-verdict.md).

- **Card content:** written by a team of writers against [`docs/content-spec.md`](docs/content-spec.md), then validated and edited.
- **Prismacolor data:** names, codes and the 48-pencil set were researched and cross-checked from several independent sources. On-screen swatches are approximate. Your pencils are the truth.
- **Code layout:** described in [`docs/architecture.md`](docs/architecture.md).

## Credits

- Fonts: [Cormorant SC](https://github.com/CatharsisFonts/Cormorant), [Lora](https://github.com/cyrealtype/Lora-Cyrillic) and [Caveat](https://github.com/googlefonts/caveat), all under the SIL Open Font License, self-hosted via Fontsource.
- Prismacolor is a trademark of its owner. This is an independent fan project and isn't affiliated with or endorsed by Prismacolor or Newell Brands.
