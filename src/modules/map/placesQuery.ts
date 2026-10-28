import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { agents } from '@/agents/host'
import type { PlaceKind } from '@/agents/protocol'
import type { RankedPlace } from '@/agents/scout.worker'
import { distance, type LatLng } from '@/lib/geo'
import { areaKey, nearby } from '@/services/places'

/** One cached search: where it was made, so nearby searches can reuse it. */
export interface PlacesResult {
  lat: number
  lng: number
  radius: number
  at: number
  places: RankedPlace[]
}

const kindsKey = (kinds: PlaceKind[]) => [...kinds].sort().join(',')

/**
 * Keyed by a ~500 m grid cell (not raw GPS), so jitter or a short walk hits the
 * same cache entry. Persisted to IndexedDB by the app's query persister.
 */
export const placesKey = (c: LatLng, radius: number, kinds: PlaceKind[], google: boolean) => ['places', areaKey(c.lat, c.lng), radius, kindsKey(kinds), google] as const

export const placesQuery = (c: LatLng, radius: number, kinds: PlaceKind[], google: boolean) =>
  queryOptions({
    queryKey: placesKey(c, radius, kinds, google),
    queryFn: async (): Promise<PlacesResult> => {
      const raw = await nearby({ lat: c.lat, lng: c.lng, radius, kinds, limit: 40 })
      // ScoutAgent ranks the results using time, weather and distance; never let it hold the list up.
      const places = await agents.run<RankedPlace[]>('scout', 'rank', { places: raw }, 4000).catch(() => raw.map((p) => ({ ...p, distance: distance(c, p), score: 0 })))
      return { lat: c.lat, lng: c.lng, radius, at: Date.now(), places }
    },
    staleTime: 10 * 60_000,
    gcTime: 3 * 24 * 3600_000,
    // The service already falls back across Overpass mirrors within ~15 s.
    retry: false,
  })

/**
 * Best cached result covering this spot from a neighbouring cell or a wider
 * radius, trimmed to the requested radius. Shown instantly while the exact
 * query loads.
 */
export function nearbyCached(qc: QueryClient, c: LatLng, radius: number, kinds: PlaceKind[], google: boolean): PlacesResult | undefined {
  const kk = kindsKey(kinds)
  let best: { r: PlacesResult; d: number } | undefined
  for (const q of qc.getQueryCache().findAll({ queryKey: ['places'] })) {
    const [, , r, k, g] = q.queryKey as unknown[]
    const data = q.state.data as PlacesResult | undefined
    if (k !== kk || g !== google || typeof r !== 'number' || !data || !Array.isArray(data.places) || data.lat == null) continue
    const d = distance(c, data)
    // The cached circle must roughly contain the requested one (it is only shown while refetching).
    if (d + radius > data.radius + Math.max(800, data.radius * 0.25)) continue
    if (!best || d < best.d) best = { r: data, d }
  }
  if (!best) return undefined
  const places = best.r.places.map((p) => ({ ...p, distance: distance(c, p) })).filter((p) => p.distance <= radius)
  return { ...best.r, places }
}

/** Categories warmed up in the background so switching chips is instant. */
export const PREFETCH: PlaceKind[][] = [['atm'], ['street_food', 'restaurant'], ['pharmacy']]
