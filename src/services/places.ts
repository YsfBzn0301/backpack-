/**
 * Nearby places. Google Places (New) via the Maps JS SDK when a key is set,
 * otherwise OpenStreetMap via Overpass, which needs no key.
 */
import type { Place, PlaceKind } from '@/agents/protocol'
import { hasMapsKey, loadGoogleMaps } from './maps-loader'
import { distance } from '@/lib/geo'

export const KIND_META: Record<PlaceKind, { google: string[]; osm: string[] }> = {
  atm: { google: ['atm'], osm: ['amenity=atm', 'amenity=bank'] },
  hostel: { google: ['hostel'], osm: ['tourism=hostel', 'tourism=guest_house'] },
  street_food: { google: ['fast_food_restaurant', 'food_court', 'meal_takeaway'], osm: ['amenity=fast_food', 'amenity=food_court'] },
  restaurant: { google: ['restaurant'], osm: ['amenity=restaurant'] },
  cafe: { google: ['cafe', 'coffee_shop'], osm: ['amenity=cafe'] },
  convenience: { google: ['convenience_store', 'supermarket'], osm: ['shop=convenience', 'shop=supermarket'] },
  bar: { google: ['bar', 'pub'], osm: ['amenity=bar', 'amenity=pub'] },
  pharmacy: { google: ['pharmacy', 'drugstore'], osm: ['amenity=pharmacy'] },
  hospital: { google: ['hospital'], osm: ['amenity=hospital', 'amenity=clinic'] },
  bus: { google: ['bus_station', 'transit_station'], osm: ['amenity=bus_station', 'public_transport=station'] },
  embassy: { google: ['embassy'], osm: ['office=diplomatic', 'amenity=embassy'] },
  police: { google: ['police'], osm: ['amenity=police'] },
  fuel: { google: ['gas_station'], osm: ['amenity=fuel'] },
  parking: { google: ['parking'], osm: ['amenity=parking'] },
}

interface Query {
  lat: number
  lng: number
  radius: number
  kinds: PlaceKind[]
  limit?: number
}

/**
 * Places are cached per ~500 m grid cell, so walking a block or GPS jitter
 * reuses the last result instead of refetching. The UI's TanStack query uses
 * the same key (and persists it to IndexedDB); this map only dedupes calls
 * made by the agents within one session.
 */
const GRID_DEG = 0.0045 // ≈ 500 m of latitude
export function areaKey(lat: number, lng: number) {
  const gy = Math.round(lat / GRID_DEG)
  // Longitude cells shrink towards the poles; widen them so cells stay ~500 m.
  const lngDeg = GRID_DEG / Math.max(0.2, Math.cos((gy * GRID_DEG * Math.PI) / 180))
  return `${gy}:${Math.round(lng / lngDeg)}`
}

const cache = new Map<string, { at: number; places: Place[] }>()
const inflight = new Map<string, Promise<Place[]>>()
const cacheKey = (q: Query) => `${areaKey(q.lat, q.lng)}|${q.radius}|${[...q.kinds].sort().join(',')}|${q.limit ?? ''}`

export async function nearby(q: Query): Promise<Place[]> {
  const k = cacheKey(q)
  const hit = cache.get(k)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.places
  const running = inflight.get(k)
  if (running) return running
  const p = (async () => {
    let places: Place[] = []
    if (hasMapsKey()) {
      try {
        places = await deadline(googleNearby(q), 12_000)
      } catch {
        places = await osmNearby(q)
      }
    } else places = await osmNearby(q)
    places.sort((a, b) => distance(q, a) - distance(q, b))
    if (q.limit) places = places.slice(0, q.limit)
    cache.set(k, { at: Date.now(), places })
    return places
  })()
  inflight.set(k, p)
  try {
    return await p
  } finally {
    inflight.delete(k)
  }
}

const deadline = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('places-timeout')), ms)
    p.then(resolve, reject).finally(() => clearTimeout(t))
  })

const kindFromGoogle = (types: string[] | undefined | null, wanted: PlaceKind[]): PlaceKind =>
  wanted.find((k) => KIND_META[k].google.some((t) => types?.includes(t))) ?? wanted[0]

async function googleNearby(q: Query): Promise<Place[]> {
  const g = await loadGoogleMaps()
  const { Place: GPlace } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary
  const includedTypes = [...new Set(q.kinds.flatMap((k) => KIND_META[k].google))]
  const { places } = await GPlace.searchNearby({
    fields: ['id', 'displayName', 'location', 'types', 'rating', 'userRatingCount', 'formattedAddress', 'regularOpeningHours', 'nationalPhoneNumber', 'businessStatus'],
    locationRestriction: { center: { lat: q.lat, lng: q.lng }, radius: Math.min(q.radius, 50_000) },
    includedTypes,
    maxResultCount: 20,
    rankPreference: g.maps.places.SearchNearbyRankPreference.POPULARITY,
  })
  const out: Place[] = []
  for (const p of places) {
    if (!p.location || p.businessStatus === 'CLOSED_PERMANENTLY') continue
    let openNow: boolean | undefined
    try {
      openNow = (await p.isOpen()) ?? undefined
    } catch {
      openNow = undefined
    }
    out.push({
      id: p.id,
      name: p.displayName ?? 'Unnamed',
      lat: p.location.lat(),
      lng: p.location.lng(),
      kind: kindFromGoogle(p.types, q.kinds),
      rating: p.rating ?? undefined,
      ratingCount: p.userRatingCount ?? undefined,
      openNow,
      address: p.formattedAddress ?? undefined,
      phone: p.nationalPhoneNumber ?? undefined,
      source: 'google',
    })
  }
  return out
}

/** Free-text Google search (used by the map search bar). */
export async function googleTextSearch(text: string, near: { lat: number; lng: number }): Promise<Place[]> {
  const g = await loadGoogleMaps()
  const { Place: GPlace } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary
  const { places } = await GPlace.searchByText({
    textQuery: text,
    fields: ['id', 'displayName', 'location', 'types', 'rating', 'userRatingCount', 'formattedAddress'],
    locationBias: { center: near, radius: 5000 },
    maxResultCount: 15,
  })
  return places
    .filter((p) => p.location)
    .map((p) => ({
      id: p.id,
      name: p.displayName ?? 'Unnamed',
      lat: p.location!.lat(),
      lng: p.location!.lng(),
      kind: kindFromGoogle(p.types, Object.keys(KIND_META) as PlaceKind[]),
      rating: p.rating ?? undefined,
      ratingCount: p.userRatingCount ?? undefined,
      address: p.formattedAddress ?? undefined,
      source: 'google' as const,
    }))
}

/**
 * Public Overpass instances. They are free but often busy: try the next one on
 * 429 / 5xx / timeout and remember which one answered last.
 */
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
let preferred = 0

export interface OverpassElement {
  id: number
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/** For tests: forget which mirror answered last. */
export function resetOverpassMirror() {
  preferred = 0
}

/**
 * POST an Overpass QL query, falling back across mirrors. The whole call is
 * bounded by `totalMs` (default 15 s) so the UI never waits forever.
 */
export async function overpass(query: string, opts: { totalMs?: number; perTryMs?: number; signal?: AbortSignal; mirrors?: string[] } = {}): Promise<OverpassElement[]> {
  const mirrors = opts.mirrors ?? OVERPASS_MIRRORS
  const total = opts.totalMs ?? 15_000
  const perTry = opts.perTryMs ?? 8_000
  const deadline = Date.now() + total
  const order = mirrors.map((_, i) => (i + preferred) % mirrors.length)
  let lastError = 'places-unavailable'
  for (const idx of order) {
    const remaining = deadline - Date.now()
    if (remaining < 250) {
      lastError = 'places-timeout'
      break
    }
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    opts.signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => ctrl.abort(), Math.min(perTry, remaining))
    try {
      const res = await fetch(mirrors[idx], { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal })
      if (res.status === 400) throw Object.assign(new Error('places-bad-query'), { fatal: true })
      if (!res.ok) {
        lastError = 'places-busy'
        continue
      }
      const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string }
      // A server-side timeout still answers 200, with a remark and no elements.
      if (!data.elements || (!data.elements.length && /timed out|runtime error|out of memory/i.test(data.remark ?? ''))) {
        lastError = 'places-busy'
        continue
      }
      preferred = idx
      return data.elements
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e
      if (opts.signal?.aborted) throw e
      lastError = ctrl.signal.aborted ? 'places-timeout' : 'places-unavailable'
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
    }
  }
  throw new Error(lastError)
}

/** Overpass QL for the given kinds: only tagged features, centre points, capped output. */
export function overpassQuery(q: Query, max = 150) {
  const filters = q.kinds.flatMap((k) =>
    KIND_META[k].osm.map((f) => {
      const [key, val] = f.split('=')
      // ATMs inside banks are tagged on the bank; others are nodes or areas.
      return `nwr["${key}"="${val}"](around:${Math.round(q.radius)},${q.lat.toFixed(5)},${q.lng.toFixed(5)});`
    }),
  )
  return `[out:json][timeout:12];(${filters.join('')});out center tags ${max};`
}

export function parseOverpass(elements: OverpassElement[], kinds: PlaceKind[]): Place[] {
  const out: Place[] = []
  const seen = new Set<string>()
  for (const el of elements) {
    const t = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue
    const kind = kinds.find((k) =>
      KIND_META[k].osm.some((f) => {
        const [key, val] = f.split('=')
        return t[key] === val
      }),
    )
    if (!kind) continue
    if (kind === 'atm' && t.amenity === 'bank' && t.atm !== 'yes') continue
    const id = `osm-${el.type}-${el.id}`
    if (seen.has(id)) continue
    seen.add(id)
    const name = t['name:en'] || t.name || t.brand || t.operator || ''
    out.push({
      id,
      name,
      lat,
      lng,
      kind,
      openNow: t.opening_hours === '24/7' ? true : undefined,
      address: [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' ') || undefined,
      phone: t.phone || t['contact:phone'] || undefined,
      source: 'osm',
    })
  }
  return out
}

async function osmNearby(q: Query): Promise<Place[]> {
  return parseOverpass(await overpass(overpassQuery(q)), q.kinds)
}
