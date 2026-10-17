// Rules that stop the deck dealing nonsense, such as a heron on the teacup shelf.
// A falsy `season` means "ignore seasons" (when she turns off real seasons).

export const SCALE_RANK = { tiny: 0, small: 1, medium: 2, large: 3 }
export const ALL_SEASONS = ['spring', 'summer', 'autumn', 'winter']

export function inSeason(card, season) {
  return !season || !card.seasons || card.seasons.includes(season)
}

// Is a subject's "doing" phrase usable here?
// placeScope is undefined when there is no place (a quick doodle).
export function doingFits(doing, placeScope, season) {
  if (season && doing.seasons && !doing.seasons.includes(season)) return false
  if (doing.scope === 'any') return true
  if (!placeScope) return false
  if (placeScope === 'threshold') return true
  return doing.scope === placeScope
}

export function usableDoings(subject, placeScope, season) {
  return subject.doing.filter((d) => doingFits(d, placeScope, season))
}

export function subjectFitsPlace(subject, place, season, { ignoreScale = false } = {}) {
  if (!inSeason(subject, season) || !inSeason(place, season)) return false
  // Hand-picked vetoes for pairings the habitat tags can't rule out.
  if (place.excludes?.includes(subject.id)) return false
  if (!subject.habitats.some((h) => place.admits.includes(h))) return false
  if (!ignoreScale && SCALE_RANK[subject.scale] > SCALE_RANK[place.maxScale]) return false
  return usableDoings(subject, place.scope, season).length > 0
}

// Hours fit places by scope. Two refinements: an indoor-only hour ("while the
// kettle boils") wants a real room, not a porch; and an hour you can only see
// in the sky or the weather (`sky: true`) needs the place to be outdoors, at a
// threshold, or a room with a window onto it (`window: true`).
export function whenFitsPlace(when, place, season) {
  if (!inSeason(when, season)) return false
  if (!place) return true
  // Some hours belong to a few rooms only ("while the kettle boils").
  if (when.places && !when.places.includes(place.id)) return false
  if (when.scope === 'indoor') return place.scope === 'indoor'
  if (when.sky && place.scope === 'indoor' && !place.window) return false
  if (when.scope === 'any' || place.scope === 'threshold') return true
  return when.scope === place.scope
}

// A companion for "Something big": small, from another suit, and at home here.
export function companionFits(companion, subject, place, season, opts = {}) {
  if (companion.id === subject.id || companion.suit === subject.suit) return false
  if (SCALE_RANK[companion.scale] > SCALE_RANK.small) return false
  return subjectFitsPlace(companion, place, season, opts)
}
