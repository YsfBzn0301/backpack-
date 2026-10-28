/**
 * Parking lots near a point, merged from several sources:
 *  - OpenStreetMap (Overpass): rates, conditions, height, EV, payment tags.
 *  - ParkenDD (api.parkendd.de): live free-space counts for many German cities.
 *  - Google Places (with a Maps key): extra lots OSM doesn't have.
 *  - VITE_PARKING_ENDPOINT: your own provider (e.g. a Parkopedia proxy) that
 *    answers GET ?lat&lng&radius with ParkingLot[] JSON.
 */
import type { ParkingLot } from '@/agents/protocol'
import { distance } from '@/lib/geo'
import { keys } from '@/lib/settings'
import { hasMapsKey, loadGoogleMaps } from './maps-loader'
import { lotFromOsm } from './parking-parse'
import { getCountry } from '@/data/countries'

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

interface Query {
  lat: number
  lng: number
  radius: number
  /** Used to price untagged amounts. */
  country?: string
}

const cache = new Map<string, { at: number; lots: ParkingLot[] }>()

export async function parkingNearby(q: Query): Promise<ParkingLot[]> {
  const key = `${q.lat.toFixed(3)},${q.lng.toFixed(3)}|${q.radius}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 3 * 60_000) return hit.lots

  const currency = getCountry(q.country)?.currency ?? 'EUR'
  const [osm, live, google, custom] = await Promise.all([
    osmParking(q, currency).catch(() => [] as ParkingLot[]),
    parkenddNear(q).catch(() => [] as ParkingLot[]),
    hasMapsKey() ? googleParking(q).catch(() => [] as ParkingLot[]) : Promise.resolve([] as ParkingLot[]),
    keys.parking() ? customParking(q).catch(() => [] as ParkingLot[]) : Promise.resolve([] as ParkingLot[]),
  ])
  if (!osm.length && !live.length && !google.length && !custom.length && !navigator.onLine) throw new Error('offline')

  const lots = [...custom, ...osm]
  // Attach live availability to the closest matching lot, else add it.
  for (const l of live) {
    const match = lots.find((o) => distance(o, l) < 140 && (o.type === 'garage' || o.type === 'underground' || nameLike(o.name, l.name)))
    if (match) Object.assign(match, { free: l.free, capacity: match.capacity ?? l.capacity, liveAt: l.liveAt, state: l.state, name: match.name || l.name })
    else lots.push(l)
  }
  for (const g of google) if (!lots.some((o) => distance(o, g) < 60)) lots.push(g)

  const out = lots
    .map((l) => ({ l, d: distance(q, l) }))
    .filter(({ d }) => d <= q.radius * 1.2)
    .sort((a, b) => a.d - b.d)
    .slice(0, 60)
    .map(({ l }) => l)
  cache.set(key, { at: Date.now(), lots: out })
  return out
}

const nameLike = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/(parkhaus|tiefgarage|parkplatz|garage|parking|p\+r)/g, '').replace(/[^a-zäöüß0-9]/g, '')
  const x = n(a)
  const y = n(b)
  return Boolean(x && y && (x.includes(y) || y.includes(x)))
}

async function osmParking(q: Query, currency: string) {
  const r = Math.round(q.radius)
  const body = `[out:json][timeout:25];(nwr["amenity"="parking"](around:${r},${q.lat},${q.lng});nwr["building"="parking"](around:${r},${q.lat},${q.lng}););out center tags 150;`
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: body }) })
      if (!res.ok) continue
      const data: { elements: Parameters<typeof lotFromOsm>[0][] } = await res.json()
      return data.elements.map((e) => lotFromOsm(e, currency)).filter((l): l is ParkingLot => Boolean(l))
    } catch {
      /* next mirror */
    }
  }
  throw new Error('overpass unavailable')
}

interface PddCity {
  id: string
  name: string
  coords: { lat: number; lng: number }
}

let citiesPromise: Promise<PddCity[]> | null = null
function parkenddCities(): Promise<PddCity[]> {
  if (citiesPromise) return citiesPromise
  citiesPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem('bp:parkendd-cities') ?? 'null') as { at: number; cities: PddCity[] } | null
      if (cached && Date.now() - cached.at < 7 * 86400_000) return cached.cities
    } catch {
      /* refetch */
    }
    const res = await fetch('https://api.parkendd.de/')
    const data: { cities: Record<string, { name: string; coords?: { lat: number; lng: number } }> } = await res.json()
    const cities = Object.entries(data.cities)
      .filter(([, c]) => c.coords)
      .map(([id, c]) => ({ id, name: c.name, coords: c.coords! }))
    try {
      localStorage.setItem('bp:parkendd-cities', JSON.stringify({ at: Date.now(), cities }))
    } catch {
      /* ignore */
    }
    return cities
  })().catch((e) => {
    citiesPromise = null
    throw e
  })
  return citiesPromise
}

async function parkenddNear(q: Query): Promise<ParkingLot[]> {
  const cities = await parkenddCities()
  const city = cities.map((c) => ({ c, d: distance(q, c.coords) })).sort((a, b) => a.d - b.d)[0]
  if (!city || city.d > 30_000) return []
  const res = await fetch(`https://api.parkendd.de/${encodeURIComponent(city.c.id)}`)
  const data: {
    last_updated?: string
    lots: { id: string; name: string; coords?: { lat: number; lng: number }; free?: number; total?: number; state?: string; lot_type?: string; address?: string }[]
  } = await res.json()
  const at = data.last_updated ? Date.parse(data.last_updated) : Date.now()
  return data.lots
    .filter((l) => l.coords && l.state !== 'nodata')
    .map((l) => ({
      id: `pdd-${l.id}`,
      name: l.name,
      lat: l.coords!.lat,
      lng: l.coords!.lng,
      source: 'parkendd' as const,
      type: /tiefgarage|underground/i.test(`${l.lot_type} ${l.name}`) ? 'underground' : /parkhaus|garage/i.test(`${l.lot_type} ${l.name}`) ? 'garage' : 'surface',
      fee: null,
      rates: [],
      payment: [],
      capacity: l.total,
      free: l.free,
      liveAt: at,
      state: l.state === 'closed' ? 'closed' : l.state === 'open' ? 'open' : 'unknown',
      address: l.address,
    }))
}

async function googleParking(q: Query): Promise<ParkingLot[]> {
  const g = await loadGoogleMaps()
  const { Place } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary
  const { places } = await Place.searchNearby({
    fields: ['id', 'displayName', 'location', 'types', 'formattedAddress', 'regularOpeningHours'],
    locationRestriction: { center: { lat: q.lat, lng: q.lng }, radius: Math.min(q.radius, 50_000) },
    includedTypes: ['parking'],
    maxResultCount: 20,
  })
  return places
    .filter((p) => p.location)
    .map((p) => ({
      id: p.id,
      name: p.displayName ?? '',
      lat: p.location!.lat(),
      lng: p.location!.lng(),
      source: 'google' as const,
      type: /tiefgarage|underground/i.test(p.displayName ?? '') ? 'underground' : /parkhaus|garage|multi/i.test(p.displayName ?? '') ? 'garage' : 'unknown',
      fee: null,
      rates: [],
      payment: [],
      address: p.formattedAddress ?? undefined,
    }))
}

async function customParking(q: Query): Promise<ParkingLot[]> {
  const res = await fetch(`${keys.parking()}?lat=${q.lat}&lng=${q.lng}&radius=${q.radius}`)
  if (!res.ok) throw new Error('parking endpoint failed')
  const lots: ParkingLot[] = await res.json()
  return lots.map((l) => ({ ...l, source: 'custom' as const, payment: l.payment ?? [], rates: l.rates ?? [] }))
}

/** Deep links for the three navigation apps. */
export const navLinks = (p: { lat: number; lng: number }) => ({
  google: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving&dir_action=navigate`,
  apple: `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d`,
  waze: `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`,
})
