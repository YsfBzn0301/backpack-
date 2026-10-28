import { keys } from '@/lib/settings'

export interface GeoResult {
  id: string
  name: string
  region?: string
  country?: string
  countryCode?: string
  lat: number
  lng: number
}

/** City / destination search. OpenWeather geocoding with a key, else Open-Meteo. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const key = keys.openWeather()
  if (key) {
    try {
      const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6&appid=${key}`, { signal })
      if (res.ok) {
        const rows: { name: string; state?: string; country: string; lat: number; lon: number }[] = await res.json()
        if (rows.length)
          return rows.map((r) => ({
            id: `${r.lat},${r.lon}`,
            name: r.name,
            region: r.state,
            countryCode: r.country,
            country: regionName(r.country),
            lat: r.lat,
            lng: r.lon,
          }))
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`, { signal })
  if (!res.ok) throw new Error('geocode failed')
  const data: { results?: { id: number; name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number }[] } = await res.json()
  return (data.results ?? []).map((r) => ({
    id: String(r.id),
    name: r.name,
    region: r.admin1,
    country: r.country,
    countryCode: r.country_code?.toUpperCase(),
    lat: r.latitude,
    lng: r.longitude,
  }))
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
export const regionName = (code?: string) => {
  if (!code) return undefined
  try {
    return regionNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
