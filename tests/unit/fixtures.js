// A tiny hand-made deck for fast, exact engine tests.
import { indexContent, buildContext } from '../../src/engine/reading.js'
import { preparePencils } from '../../src/engine/harmony.js'
import pencilList from '../../src/data/pencils.json'
import sets from '../../src/data/sets.json'

const subject = (id, over = {}) => ({
  id,
  suit: id.split('-')[0],
  title: `The ${id.split('-')[1]}`,
  a: `a ${id.split('-')[1]}`,
  the: `the ${id.split('-')[1]}`,
  phrases: ['one', 'two'],
  doing: [
    { t: 'is sitting very still', scope: 'any' },
    { t: 'is looking up', scope: 'any' },
    { t: 'is running about', scope: 'outdoor' },
  ],
  close: [`Just the ${id.split('-')[1]}, close up.`],
  scale: 'small',
  habitats: ['garden', 'hedgerow'],
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  active: 'any',
  colours: ['#B8562D', '#7A6248'],
  texture: 'feather',
  roles: { main: 'for the breast', dark: 'for the eye', light: 'for the highlights', accent: 'for the back' },
  firstMark: ['Start with the eye in {dark}.', 'Start with a light pass of {main}.'],
  ...over,
})

export const fixtureContent = indexContent({
  subjects: [
    subject('fur-robin'),
    subject('fur-wren', { scale: 'tiny', colours: ['#8B5E3C'] }),
    subject('fur-heron', { scale: 'medium', habitats: ['water'], colours: ['#9AA0A6', '#2B2B2B'] }),
    subject('fur-swallow', { seasons: ['spring', 'summer'], habitats: ['farm', 'meadow'], colours: ['#1F2A44', '#C2462E'] }),
    subject('hearth-teapot', { habitats: ['tabletop', 'home'], colours: ['#2F5D8C'], doing: [{ t: 'is steaming', scope: 'any' }, { t: 'is waiting', scope: 'any' }, { t: 'has a chip on the spout', scope: 'any' }] }),
    subject('hearth-bun', { scale: 'tiny', habitats: ['tabletop'], colours: ['#C8894A', '#F2E6CF'] }),
    subject('leaf-conker', { scale: 'tiny', habitats: ['woodland', 'tabletop', 'garden'], seasons: ['autumn'], colours: ['#6E2F1A'] }),
    subject('leaf-snowdrop', { scale: 'tiny', habitats: ['garden', 'woodland'], seasons: ['winter'], colours: ['#F4F4EE', '#5E8C4A'] }),
  ],
  wheres: [
    { id: 'where-sill', title: 'The Sill', at: 'on the windowsill', phrases: ['a', 'b'], scope: 'threshold', admits: ['tabletop', 'home', 'garden'], maxScale: 'small', seasons: ['spring', 'summer', 'autumn', 'winter'], frames: ['window'], colours: ['#E8DCC4'], role: 'for the sill' },
    { id: 'where-table', title: 'The Table', at: 'on the kitchen table', phrases: ['a', 'b'], scope: 'indoor', admits: ['tabletop', 'home'], maxScale: 'small', seasons: ['spring', 'summer', 'autumn', 'winter'], frames: ['from-above'], colours: ['#B08A5A'], role: 'for the table' },
    { id: 'where-cup', title: 'The Teacup', at: 'inside a teacup', phrases: ['a', 'b'], scope: 'indoor', admits: ['tabletop'], maxScale: 'tiny', seasons: ['spring', 'summer', 'autumn', 'winter'], frames: ['close-crop'], colours: ['#F0EDE6'], role: 'for the china' },
    { id: 'where-hedge', title: 'The Hedge', at: 'in the bramble hedge', phrases: ['a', 'b'], scope: 'outdoor', admits: ['hedgerow', 'garden', 'woodland'], maxScale: 'medium', seasons: ['spring', 'summer', 'autumn', 'winter'], frames: ['thirds'], colours: ['#4E6B3A'], role: 'for the leaves' },
    { id: 'where-pond', title: 'The Pond', at: 'at the edge of the mill pond', phrases: ['a', 'b'], scope: 'outdoor', admits: ['water', 'meadow', 'farm'], maxScale: 'large', seasons: ['spring', 'summer', 'autumn', 'winter'], frames: ['low-horizon'], colours: ['#5F7F8A'], role: 'for the water' },
  ],
  whens: [
    { id: 'when-frost', title: 'The First Frost', when: 'on the first frosty morning', phrases: ['a', 'b'], note: 'Everything has a white edge.', seasons: ['autumn', 'winter'], timeOfDay: ['dawn', 'morning'], scope: 'any', mood: 'cool', light: 'Keep it cool.', shadow: 'for the cold shadows', highlight: 'for the frost' },
    { id: 'when-golden', title: 'Golden Hour', when: 'at golden hour', phrases: ['a', 'b'], note: 'The light is low and warm.', seasons: ['spring', 'summer', 'autumn', 'winter'], timeOfDay: ['dusk'], scope: 'any', mood: 'warm', light: 'Warm lights.', shadow: 'for the long shadows', highlight: 'for the glow' },
    { id: 'when-stars', title: 'Starlight', when: 'under a sky full of stars', phrases: ['a', 'b'], note: 'The sky is deep and clear.', seasons: ['spring', 'summer', 'autumn', 'winter'], timeOfDay: ['night'], scope: 'outdoor', mood: 'dark', light: 'Dark.', shadow: 'for the night', highlight: 'for the stars' },
    { id: 'when-kettle', title: 'The Kettle', when: 'while the kettle boils', phrases: ['a', 'b'], note: 'The window steams up.', seasons: ['spring', 'summer', 'autumn', 'winter'], timeOfDay: ['morning', 'afternoon'], scope: 'indoor', mood: 'muted', light: 'Soft.', shadow: 'for the shadows', highlight: 'for the steam' },
  ],
  twists: [
    { id: 'twist-teacup', title: 'The Teacup', rule: 'Make everything tiny.', phrases: ['a', 'b'], effects: { scale: 'any' } },
    { id: 'twist-moon', title: 'The Moon', rule: 'Use only Indigo Blue and White.', phrases: ['a', 'b'], effects: { palette: 'moon', paper: 'dark' } },
    { id: 'twist-mirror', title: 'The Mirror', rule: 'Redraw an old friend.', phrases: ['a', 'b'], effects: { requires: 'seal' } },
  ],
  themes: [
    { id: 'theme-rain', title: 'A Rainy Sunday', of: 'from a rainy Sunday', phrases: ['a', 'b'], seasons: ['spring', 'summer', 'autumn', 'winter'], mood: 'muted', colours: ['#6F7F8C', '#C9A27A', '#A84B3A'], slots: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] },
  ],
  lines: { oldFriend: ['An old friend: your {name} from {month}.'], smallTins: ['Small tins are good tins.'], lonely: {}, lonelyFamily: {} },
  tips: { paper: { dark: 'Dark paper glows.', tan: 'Tan paper is a free mid-tone.' } },
  palettes: { warm: ['Bramble Dusk'], cool: ['Frost on the Glass'], muted: ['Foggy Allotment'], dark: ['Owl Light'], bright: ['Sunday Pancakes'] },
})

export const allPencils = pencilList
export const tinOf = (setKey) => {
  const codes = new Set(sets[setKey].codes)
  return preparePencils(pencilList.filter((p) => codes.has(p.code)))
}

export function ctxFor({ content = fixtureContent, set = '24', pencils, date = new Date('2026-10-17T09:30:00'), hemisphere = 'north', history = {}, ...rest } = {}) {
  return buildContext({ content, pencils: pencils || tinOf(set), date, hemisphere, history, ...rest })
}
