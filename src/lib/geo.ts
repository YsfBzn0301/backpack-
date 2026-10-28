export interface LatLng {
  lat: number
  lng: number
}

const R = 6371e3
const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in metres. */
export function distance(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Initial bearing in degrees (0 = north). */
export function bearing(a: LatLng, b: LatLng) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function formatDistance(m: number, units: 'metric' | 'imperial' = 'metric') {
  if (units === 'imperial') {
    const ft = m * 3.28084
    return ft < 1000 ? `${Math.round(ft / 10) * 10} ft` : `${(m / 1609.34).toFixed(1)} mi`
  }
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export const compassPoint = (deg: number) => COMPASS[Math.round(deg / 45) % 8]

/** Walking minutes at ~4.8 km/h. */
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80))

export function directionsUrl(to: LatLng, mode: 'walking' | 'transit' | 'driving' = 'walking', placeId?: string) {
  const p = new URLSearchParams({ api: '1', destination: `${to.lat},${to.lng}`, travelmode: mode })
  if (placeId) p.set('destination_place_id', placeId)
  return `https://www.google.com/maps/dir/?${p}`
}
