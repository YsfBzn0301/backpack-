/**
 * Public transit via HAFAS (Deutsche Bahn, through the keyless
 * v6.db.transport.rest gateway): nearby stops, live departure boards with
 * platforms and delays, and journey planning. Covers German local transit
 * (S/U-Bahn, tram, bus, ferry) and long-distance rail across Europe.
 * Outside that coverage the UI falls back to Google Transit.
 */
import { loc } from '@/i18n/format'
import { settings } from '@/lib/settings'

const BASE = 'https://v6.db.transport.rest'

export type Mode = 'express' | 'regional' | 'suburban' | 'subway' | 'tram' | 'bus' | 'ferry' | 'taxi' | 'walk' | 'other'

export interface Stop {
  id: string
  name: string
  lat: number
  lng: number
  distance?: number
  modes: Mode[]
}

export interface Line {
  name: string
  mode: Mode
  product?: string
}

export interface Remark {
  type: 'warning' | 'status' | 'hint'
  text: string
}

export interface Departure {
  id: string
  when: number | null
  plannedWhen: number
  delayMin: number | null
  platform?: string
  plannedPlatform?: string
  direction: string
  line: Line
  cancelled: boolean
  remarks: Remark[]
}

export interface Leg {
  origin: string
  destination: string
  departure: number
  plannedDeparture: number
  departureDelayMin: number | null
  departurePlatform?: string
  arrival: number
  plannedArrival: number
  arrivalDelayMin: number | null
  arrivalPlatform?: string
  line?: Line
  direction?: string
  walking: boolean
  distance?: number
  cancelled: boolean
  remarks: Remark[]
}

export interface Journey {
  id: string
  legs: Leg[]
  departure: number
  arrival: number
  transfers: number
  price?: { amount: number; currency: string }
}

export interface Place {
  id?: string
  name: string
  lat?: number
  lng?: number
  kind: 'stop' | 'address' | 'poi'
}

const PRODUCT_MODE: Record<string, Mode> = {
  nationalExpress: 'express',
  national: 'express',
  regionalExpress: 'regional',
  regional: 'regional',
  suburban: 'suburban',
  subway: 'subway',
  tram: 'tram',
  bus: 'bus',
  ferry: 'ferry',
  taxi: 'taxi',
}

const lang = () => (settings.get().uiLang === 'de' ? 'de' : 'en')

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v))
  const res = await fetch(`${BASE}${path}?${q}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(res.status === 503 || res.status === 502 ? 'transit-busy' : `transit-${res.status}`)
  return res.json()
}

type RawProducts = Record<string, boolean>
type RawStop = { id: string; name: string; location?: { latitude: number; longitude: number }; products?: RawProducts; distance?: number; type?: string }
type RawLine = { name?: string; product?: string; productName?: string; mode?: string }
type RawRemark = { type?: string; text?: string; summary?: string }

const modesOf = (p?: RawProducts) => Object.entries(p ?? {}).filter(([, v]) => v).map(([k]) => PRODUCT_MODE[k] ?? 'other')
const lineOf = (l?: RawLine): Line | undefined =>
  l ? { name: l.name?.trim() || l.productName || '', mode: PRODUCT_MODE[l.product ?? ''] ?? (l.mode === 'walking' ? 'walk' : 'other'), product: l.productName } : undefined
const remarksOf = (r?: RawRemark[]): Remark[] =>
  (r ?? [])
    .filter((x) => x.text && x.type !== 'hint')
    .map((x): Remark => ({ type: x.type === 'warning' ? 'warning' : x.type === 'status' ? 'status' : 'hint', text: (x.summary ? `${x.summary}: ` : '') + x.text! }))
    .slice(0, 3)
const ms = (s?: string | null) => (s ? Date.parse(s) : null)
const delay = (sec?: number | null) => (sec == null ? null : Math.round(sec / 60))

export async function nearbyStops(lat: number, lng: number, signal?: AbortSignal): Promise<Stop[]> {
  const rows = await get<RawStop[]>('/locations/nearby', { latitude: lat, longitude: lng, results: 10, distance: 2000, poi: false, addresses: false, language: lang() }, signal)
  return rows
    .filter((r) => r.location)
    .map((r) => ({ id: r.id, name: r.name, lat: r.location!.latitude, lng: r.location!.longitude, distance: r.distance, modes: modesOf(r.products) }))
}

export async function departures(stopId: string, signal?: AbortSignal): Promise<{ list: Departure[]; updatedAt: number }> {
  type Raw = { departures?: RawDep[]; realtimeDataUpdatedAt?: number }
  type RawDep = { tripId: string; when: string | null; plannedWhen: string; delay: number | null; platform?: string | null; plannedPlatform?: string | null; direction?: string; line?: RawLine; cancelled?: boolean; remarks?: RawRemark[] }
  const r = await get<Raw | RawDep[]>(`/stops/${encodeURIComponent(stopId)}/departures`, { duration: 90, results: 40, remarks: true, language: lang() }, signal)
  const rows = Array.isArray(r) ? r : (r.departures ?? [])
  return {
    updatedAt: (!Array.isArray(r) && r.realtimeDataUpdatedAt ? r.realtimeDataUpdatedAt * 1000 : Date.now()),
    list: rows.map((d) => ({
      id: `${d.tripId}-${d.plannedWhen}`,
      when: ms(d.when),
      plannedWhen: ms(d.plannedWhen) ?? Date.now(),
      delayMin: delay(d.delay),
      platform: d.platform ?? undefined,
      plannedPlatform: d.plannedPlatform ?? undefined,
      direction: d.direction ?? '',
      line: lineOf(d.line) ?? { name: '?', mode: 'other' },
      cancelled: Boolean(d.cancelled),
      remarks: remarksOf(d.remarks),
    })),
  }
}

export async function searchLocations(query: string, near?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  type Raw = { type: string; id?: string; name?: string; address?: string; latitude?: number; longitude?: number; location?: { latitude: number; longitude: number } }
  const rows = await get<Raw[]>('/locations', { query, results: 8, stops: true, addresses: true, poi: true, fuzzy: true, language: lang(), ...(near ? {} : {}) }, signal)
  return rows.map((r) => ({
    id: r.type === 'stop' || r.type === 'station' ? r.id : undefined,
    name: r.name ?? r.address ?? '',
    lat: r.location?.latitude ?? r.latitude,
    lng: r.location?.longitude ?? r.longitude,
    kind: r.type === 'stop' || r.type === 'station' ? 'stop' : r.type === 'location' && r.address ? 'address' : 'poi',
  }))
}

function placeParams(prefix: 'from' | 'to', p: Place) {
  if (p.id) return { [prefix]: p.id }
  return { [`${prefix}.latitude`]: p.lat, [`${prefix}.longitude`]: p.lng, [`${prefix}.address`]: p.name || 'Location' }
}

export async function journeys(from: Place, to: Place, departure: Date, signal?: AbortSignal): Promise<Journey[]> {
  type RawLeg = {
    origin?: { name?: string; address?: string }
    destination?: { name?: string; address?: string }
    departure: string
    plannedDeparture: string
    departureDelay?: number | null
    departurePlatform?: string | null
    arrival: string
    plannedArrival: string
    arrivalDelay?: number | null
    arrivalPlatform?: string | null
    line?: RawLine
    direction?: string
    walking?: boolean
    distance?: number
    cancelled?: boolean
    remarks?: RawRemark[]
  }
  type Raw = { journeys?: { legs: RawLeg[]; refreshToken?: string; price?: { amount: number; currency: string } | null }[] }
  const r = await get<Raw>(
    '/journeys',
    { ...placeParams('from', from), ...placeParams('to', to), departure: departure.toISOString(), results: 6, stopovers: false, remarks: true, language: lang() },
    signal,
  )
  return (r.journeys ?? []).map((j, i) => {
    const legs: Leg[] = j.legs.map((l) => ({
      origin: l.origin?.name ?? l.origin?.address ?? '',
      destination: l.destination?.name ?? l.destination?.address ?? '',
      departure: ms(l.departure) ?? ms(l.plannedDeparture)!,
      plannedDeparture: ms(l.plannedDeparture)!,
      departureDelayMin: delay(l.departureDelay),
      departurePlatform: l.departurePlatform ?? undefined,
      arrival: ms(l.arrival) ?? ms(l.plannedArrival)!,
      plannedArrival: ms(l.plannedArrival)!,
      arrivalDelayMin: delay(l.arrivalDelay),
      arrivalPlatform: l.arrivalPlatform ?? undefined,
      line: lineOf(l.line),
      direction: l.direction,
      walking: Boolean(l.walking),
      distance: l.distance,
      cancelled: Boolean(l.cancelled),
      remarks: remarksOf(l.remarks),
    }))
    const rides = legs.filter((l) => !l.walking)
    return {
      id: j.refreshToken ?? String(i),
      legs,
      departure: legs[0].departure,
      arrival: legs[legs.length - 1].arrival,
      transfers: Math.max(0, rides.length - 1),
      price: j.price ?? undefined,
    }
  })
}

/** Google Maps transit directions — the universal fallback. */
export function googleTransitUrl(from: Place | null, to: Place) {
  const p = new URLSearchParams({ api: '1', travelmode: 'transit', destination: to.lat != null ? `${to.lat},${to.lng}` : to.name })
  if (from && from.lat != null) p.set('origin', `${from.lat},${from.lng}`)
  return `https://www.google.com/maps/dir/?${p}`
}

/**
 * Google Directions (transit) through the Maps JS SDK when a key is loaded,
 * for regions HAFAS doesn't cover.
 */
export async function googleJourneys(from: { lat: number; lng: number }, to: Place, departure: Date): Promise<Journey[]> {
  const svc = new google.maps.DirectionsService()
  const res = await svc.route({
    origin: from,
    destination: to.lat != null ? { lat: to.lat, lng: to.lng! } : to.name,
    travelMode: google.maps.TravelMode.TRANSIT,
    transitOptions: { departureTime: departure },
    provideRouteAlternatives: true,
    language: loc(),
  } as google.maps.DirectionsRequest)
  const vehicleMode = (t?: string): Mode =>
    t === 'SUBWAY' || t === 'METRO_RAIL' ? 'subway' : t === 'TRAM' || t === 'LIGHT_RAIL' ? 'tram' : t === 'BUS' || t === 'TROLLEYBUS' || t === 'INTERCITY_BUS' ? 'bus' : t === 'FERRY' ? 'ferry' : t === 'COMMUTER_TRAIN' ? 'suburban' : t === 'HIGH_SPEED_TRAIN' || t === 'LONG_DISTANCE_TRAIN' ? 'express' : t === 'HEAVY_RAIL' || t === 'RAIL' ? 'regional' : 'other'
  return res.routes.map((r, i) => {
    const leg = r.legs[0]
    const legs: Leg[] = leg.steps.map((s) => {
      const td = s.transit
      const dep = td?.departure_time?.value?.getTime() ?? 0
      const arr = td?.arrival_time?.value?.getTime() ?? 0
      return {
        origin: td?.departure_stop?.name ?? '',
        destination: td?.arrival_stop?.name ?? s.instructions.replace(/<[^>]+>/g, ''),
        departure: dep,
        plannedDeparture: dep,
        departureDelayMin: null,
        arrival: arr,
        plannedArrival: arr,
        arrivalDelayMin: null,
        line: td ? { name: td.line.short_name || td.line.name, mode: vehicleMode(td.line.vehicle?.type) } : undefined,
        direction: td?.headsign,
        walking: s.travel_mode === google.maps.TravelMode.WALKING,
        distance: s.distance?.value,
        cancelled: false,
        remarks: [],
      }
    })
    const rides = legs.filter((l) => !l.walking)
    return {
      id: `g${i}`,
      legs,
      departure: leg.departure_time?.value.getTime() ?? Date.now(),
      arrival: leg.arrival_time?.value.getTime() ?? Date.now(),
      transfers: Math.max(0, rides.length - 1),
      price: r.fare ? { amount: r.fare.value, currency: r.fare.currency } : undefined,
    }
  })
}

/** Countries where HAFAS (DB) has good local coverage. */
export const HAFAS_LOCAL = new Set(['DE'])
/** Long-distance rail coverage through DB HAFAS. */
export const HAFAS_EUROPE = new Set(['DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'DK', 'PL', 'CZ', 'IT', 'HU', 'SK', 'SI', 'HR'])
