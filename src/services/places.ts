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

const cache = new Map<string, { at: number; places: Place[] }>()
const cacheKey = (q: Query) => `${q.lat.toFixed(3)},${q.lng.toFixed(3)}|${q.radius}|${[...q.kinds].sort().join(',')}`

export async function nearby(q: Query): Promise<Place[]> {
  const k = cacheKey(q)
  const hit = cache.get(k)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.places
  let places: Place[] = []
  if (hasMapsKey()) {
    try {
      places = await googleNearby(q)
    } catch {
      places = await osmNearby(q)
    }
  } else places = await osmNearby(q)
  places.sort((a, b) => distance(q, a) - distance(q, b))
  if (q.limit) places = places.slice(0, q.limit)
  cache.set(k, { at: Date.now(), places })
  return places
}

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

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

async function osmNearby(q: Query): Promise<Place[]> {
  const filters = q.kinds.flatMap((k) =>
    KIND_META[k].osm.map((f) => {
      const [key, val] = f.split('=')
      return `nwr["${key}"="${val}"](around:${Math.round(q.radius)},${q.lat},${q.lng});`
    }),
  )
  const body = `[out:json][timeout:20];(${filters.join('')});out center tags 120;`
  let data: { elements: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] } | null = null
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: body }) })
      if (!res.ok) continue
      data = await res.json()
      break
    } catch {
      /* try next mirror */
    }
  }
  if (!data) throw new Error('places-unavailable')
  const out: Place[] = []
  for (const el of data.elements) {
    const t = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue
    const kind = q.kinds.find((k) => KIND_META[k].osm.some((f) => {
      const [key, val] = f.split('=')
      return t[key] === val
    }))
    if (!kind) continue
    if (kind === 'atm' && t.amenity === 'bank' && t.atm !== 'yes') continue
    const name = t['name:en'] || t.name || t.brand || ''
    out.push({
      id: `osm-${el.type}-${el.id}`,
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
