// Season, hemisphere and time of day, all worked out on the device.

// Time zones south of the equator (or close enough that the seasons flip).
const SOUTHERN_PREFIXES = [
  'Australia/', 'Antarctica/', 'America/Argentina/', 'America/Santiago', 'America/Punta_Arenas',
  'America/Montevideo', 'America/Asuncion', 'America/Sao_Paulo', 'America/La_Paz', 'America/Lima',
  'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Fiji', 'Pacific/Tongatapu', 'Pacific/Apia',
  'Pacific/Noumea', 'Pacific/Efate', 'Pacific/Port_Moresby', 'Pacific/Tahiti', 'Pacific/Rarotonga',
  'Africa/Johannesburg', 'Africa/Maputo', 'Africa/Harare', 'Africa/Lusaka', 'Africa/Windhoek',
  'Africa/Gaborone', 'Africa/Maseru', 'Africa/Mbabane', 'Africa/Blantyre', 'Africa/Lubumbashi',
  'Africa/Dar_es_Salaam', 'Africa/Luanda', 'Indian/Antananarivo', 'Indian/Mauritius', 'Indian/Reunion',
  'Atlantic/Stanley', 'Atlantic/St_Helena', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Dili',
  'NZ', 'Brazil/East',
]

export function hemisphereFromTimeZone(tz) {
  if (!tz) return 'north'
  return SOUTHERN_PREFIXES.some((p) => tz === p || tz.startsWith(p)) ? 'south' : 'north'
}

export function detectHemisphere() {
  try {
    return hemisphereFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return 'north'
  }
}

const NORTH_SEASON_BY_MONTH = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
]
const FLIP = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }

export function seasonFor(date, hemisphere = 'north') {
  const s = NORTH_SEASON_BY_MONTH[date.getMonth()]
  return hemisphere === 'south' ? FLIP[s] : s
}

export function timeOfDayFor(date) {
  const h = date.getHours()
  if (h >= 5 && h < 7) return 'dawn'
  if (h >= 7 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'dusk'
  return 'night'
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthName(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  return MONTHS[d.getMonth()]
}

// Palette mood when no When card is in play.
export const SEASON_MOOD = { spring: 'bright', summer: 'warm', autumn: 'warm', winter: 'cool' }
