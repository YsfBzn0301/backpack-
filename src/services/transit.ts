/**
 * Public transit via Transitous (https://transitous.org): a free, keyless,
 * community-run MOTIS 2 server built on open GTFS data with realtime feeds
 * for most of Europe and many regions worldwide. Nearby stops, live
 * departure boards with platforms and delays, and journey planning.
 * Google Directions (with a Maps key) and a Google Maps link are fallbacks.
 */
import { loc } from '@/i18n/format'
import { settings } from '@/lib/settings'

const BASE = 'https://api.transitous.org'
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
  /** Train/trip number, e.g. 59094 for an RB16 run. */
  number?: string
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
  /** Timetabled platform; differs from departurePlatform on a platform change. */
  plannedDeparturePlatform?: string
  arrival: number
  plannedArrival: number
  arrivalDelayMin: number | null
  arrivalPlatform?: string
  plannedArrivalPlatform?: string
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
  /** First vehicle departure (what timetables and DB show). */
  departure: number
  /** Last vehicle arrival. */
  arrival: number
  /** When to start walking, if the trip begins with a real walk. */
  leaveAt?: number
  transfers: number
  price?: { amount: number; currency: string }
}

export interface Place {
  id?: string
  name: string
  lat?: number
  lng?: number
  kind: 'stop' | 'address' | 'poi'
  /** The traveller's current location rather than a fixed place. */
  here?: boolean
}

const MODE: Record<string, Mode> = {
  HIGHSPEED_RAIL: 'express',
  LONG_DISTANCE: 'express',
  NIGHT_RAIL: 'express',
  REGIONAL_FAST_RAIL: 'regional',
  REGIONAL_RAIL: 'regional',
  RAIL: 'regional',
  SUBURBAN: 'suburban',
  METRO: 'suburban', // API v4 name for SUBURBAN
  SUBWAY: 'subway',
  TRAM: 'tram',
  CABLE_CAR: 'tram',
  FUNICULAR: 'tram',
  BUS: 'bus',
  COACH: 'bus',
  FERRY: 'ferry',
  WALK: 'walk',
}
const modeOf = (m?: string): Mode => MODE[m ?? ''] ?? 'other'

const lang = () => settings.get().uiLang || 'en'
const TIMEOUT_MS = 12_000

function withTimeout(signal?: AbortSignal) {
  const t = AbortSignal.timeout?.(TIMEOUT_MS)
  if (!t) return signal
  return signal && 'any' in AbortSignal ? AbortSignal.any([signal, t]) : (signal ?? t)
}

async function request<T>(path: string, params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  let res: Response
  try {
    res = await fetch(`${BASE}${path}?${q}`, { signal: withTimeout(signal), headers: { Accept: 'application/json' } })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new Error('transit-unreachable')
  }
  if (!res.ok) {
    const err = new Error(res.status === 429 || res.status >= 500 ? 'transit-busy' : `transit-${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

/**
 * MOTIS versions some endpoints (/api/v5/plan …). Try the versions we
 * understand, newest-compatible first, and remember the one the server has.
 */
const working = new Map<string, string>()
async function versioned<T>(endpoint: string, versions: string[], params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T> {
  const known = working.get(endpoint)
  const order = known ? [known, ...versions.filter((v) => v !== known)] : versions
  let last: unknown
  for (const v of order) {
    try {
      const r = await request<T>(`/api/${v}/${endpoint}`, params, signal)
      working.set(endpoint, v)
      return r
    } catch (e) {
      last = e
      if ((e as { status?: number }).status !== 404) throw e
    }
  }
  throw last
}

type RawAlert = { headerText?: string; descriptionText?: string }
type RawPlace = {
  name: string
  stopId?: string
  lat: number
  lon: number
  arrival?: string
  departure?: string
  scheduledArrival?: string
  scheduledDeparture?: string
  track?: string
  scheduledTrack?: string
  cancelled?: boolean
  alerts?: RawAlert[]
  modes?: string[]
}

const ms = (s?: string | null) => (s ? Date.parse(s) : null)
const minutesLate = (actual?: string, planned?: string) => {
  const a = ms(actual)
  const p = ms(planned)
  return a != null && p != null ? Math.round((a - p) / 60_000) : null
}
const remarksOf = (alerts?: RawAlert[]): Remark[] =>
  (alerts ?? [])
    .filter((a) => a.headerText || a.descriptionText)
    .map((a): Remark => ({ type: 'warning', text: [a.headerText, a.descriptionText].filter(Boolean).join(': ') }))
    .slice(0, 3)

const toRad = (d: number) => (d * Math.PI) / 180
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const x = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2))
  const y = toRad(b.lat - a.lat)
  return Math.round(Math.sqrt(x * x + y * y) * 6_371_000)
}

export async function nearbyStops(lat: number, lng: number, signal?: AbortSignal): Promise<Stop[]> {
  for (const radius of [800, 2000]) {
    const dLat = radius / 111_320
    const dLng = dLat / Math.max(0.2, Math.cos(toRad(lat)))
    const rows = await versioned<RawPlace[]>('map/stops', ['v1', 'v6'], { min: `${lat - dLat},${lng - dLng}`, max: `${lat + dLat},${lng + dLng}`, language: lang() }, signal)
    // One entry per station: platforms share a name, keep the closest.
    const byName = new Map<string, Stop>()
    for (const r of rows) {
      if (!r.stopId) continue
      const stop: Stop = { id: r.stopId, name: r.name, lat: r.lat, lng: r.lon, distance: meters({ lat, lng }, { lat: r.lat, lng: r.lon }), modes: [...new Set((r.modes ?? []).map(modeOf))] }
      const prev = byName.get(r.name)
      if (!prev) byName.set(r.name, stop)
      else {
        const modes = [...new Set([...prev.modes, ...stop.modes])]
        byName.set(r.name, (stop.distance ?? 0) < (prev.distance ?? 0) ? { ...stop, modes } : { ...prev, modes })
      }
    }
    const list = [...byName.values()].filter((s) => (s.distance ?? 0) <= radius * 1.2).sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    if (list.length) return list.slice(0, 10)
  }
  return []
}

export async function departures(stopId: string, signal?: AbortSignal): Promise<{ list: Departure[]; updatedAt: number }> {
  type RawStopTime = {
    place: RawPlace
    mode: string
    realTime: boolean
    headsign: string
    tripTo?: { name: string }
    tripId: string
    routeShortName?: string
    displayName?: string
    tripShortName?: string
    cancelled?: boolean
    tripCancelled?: boolean
    pickupDropoffType?: string
  }
  const r = await versioned<{ stopTimes: RawStopTime[] }>('stoptimes', ['v5', 'v6', 'v4', 'v1'], { stopId, n: 40, language: lang() }, signal)
  return {
    updatedAt: Date.now(),
    list: (r.stopTimes ?? [])
      .filter((d) => d.place.scheduledDeparture && d.pickupDropoffType !== 'NOT_ALLOWED')
      .map((d) => {
        const planned = d.place.scheduledDeparture!
        return {
          id: `${d.tripId}-${planned}`,
          when: d.realTime ? ms(d.place.departure) : null,
          plannedWhen: ms(planned) ?? Date.now(),
          delayMin: d.realTime ? minutesLate(d.place.departure, planned) : null,
          platform: d.place.track || d.place.scheduledTrack || undefined,
          plannedPlatform: d.place.scheduledTrack || undefined,
          direction: d.headsign || d.tripTo?.name || '',
          line: (() => {
            const l = lineName(d)
            return l.name ? l : { ...l, name: '?' }
          })(),
          cancelled: Boolean(d.cancelled || d.tripCancelled || d.place.cancelled),
          remarks: remarksOf(d.place.alerts),
        }
      }),
  }
}

export async function searchLocations(query: string, near?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  type Match = { type: 'STOP' | 'ADDRESS' | 'PLACE'; id: string; name: string; lat: number; lon: number; houseNumber?: string; areas?: { name: string; default?: boolean }[] }
  const rows = await request<Match[]>('/api/v1/geocode', { text: query, language: lang(), place: near ? `${near.lat},${near.lng}` : undefined, numResults: 8 }, signal)
  return rows.map((r) => {
    const area = r.areas?.find((a) => a.default)?.name
    const base = r.type === 'ADDRESS' && r.houseNumber && !r.name.includes(r.houseNumber) ? `${r.name} ${r.houseNumber}` : r.name
    return {
      id: r.type === 'STOP' ? r.id : undefined,
      name: area && !base.includes(area) ? `${base}, ${area}` : base,
      lat: r.lat,
      lng: r.lon,
      kind: r.type === 'STOP' ? 'stop' : r.type === 'ADDRESS' ? 'address' : 'poi',
    }
  })
}

const isStationWalk = (l: Leg) => (l.distance ?? 0) < 60 || l.origin === l.destination

/** "RB16" as the badge, the run number (59094) kept separately. */
function lineName(l: { mode: string; routeShortName?: string; displayName?: string; tripShortName?: string }): Line {
  const name = l.routeShortName?.trim() || l.displayName?.replace(/\s*\(\d+\)$/, '').trim() || ''
  const num = l.tripShortName?.trim() || l.displayName?.match(/\((\d+)\)$/)?.[1]
  return { name, mode: modeOf(l.mode), number: num && num !== name ? num : undefined }
}

const placeParam = (p: Place) => p.id ?? `${p.lat},${p.lng}`

export async function journeys(from: Place, to: Place, departure: Date, signal?: AbortSignal): Promise<Journey[]> {
  type RawLeg = {
    mode: string
    from: RawPlace
    to: RawPlace
    startTime: string
    endTime: string
    scheduledStartTime: string
    scheduledEndTime: string
    realTime: boolean
    distance?: number
    headsign?: string
    routeShortName?: string
    displayName?: string
    tripShortName?: string
    cancelled?: boolean
    alerts?: RawAlert[]
  }
  type Raw = { itineraries?: { id?: string; startTime: string; endTime: string; transfers: number; legs: RawLeg[] }[] }
  const r = await versioned<Raw>('plan', ['v5', 'v6', 'v4', 'v3'], { fromPlace: placeParam(from), toPlace: placeParam(to), time: departure.toISOString(), numItineraries: 5, language: lang() }, signal)
  return (r.itineraries ?? []).map((j, i) => {
    const all: Leg[] = j.legs.map((l) => {
      const walking = ['WALK', 'BIKE', 'CAR', 'RENTAL'].includes(l.mode)
      return {
        origin: l.from.name === 'START' ? from.name : l.from.name,
        destination: l.to.name === 'END' ? to.name : l.to.name,
        departure: ms(l.startTime)!,
        plannedDeparture: ms(l.scheduledStartTime) ?? ms(l.startTime)!,
        departureDelayMin: l.realTime ? minutesLate(l.startTime, l.scheduledStartTime) : null,
        departurePlatform: l.from.track || l.from.scheduledTrack || undefined,
        plannedDeparturePlatform: l.from.scheduledTrack || undefined,
        arrival: ms(l.endTime)!,
        plannedArrival: ms(l.scheduledEndTime) ?? ms(l.endTime)!,
        arrivalDelayMin: l.realTime ? minutesLate(l.endTime, l.scheduledEndTime) : null,
        arrivalPlatform: l.to.track || l.to.scheduledTrack || undefined,
        plannedArrivalPlatform: l.to.scheduledTrack || undefined,
        line: walking ? undefined : lineName(l),
        direction: l.headsign,
        walking,
        distance: l.distance,
        cancelled: Boolean(l.cancelled),
        remarks: remarksOf(l.alerts),
      }
    })
    // MOTIS adds short walks inside a station (stop → platform) to the
    // itinerary; they shift the start time and aren't real walks.
    const legs = all.filter((l) => !l.walking || !isStationWalk(l))
    const rides = legs.filter((l) => !l.walking)
    const lead = legs[0]?.walking ? legs[0] : undefined
    return {
      id: j.id ?? `${i}-${j.startTime}`,
      legs: legs.length ? legs : all,
      departure: rides[0]?.departure ?? ms(j.startTime)!,
      arrival: rides.at(-1)?.arrival ?? ms(j.endTime)!,
      leaveAt: lead && rides.length ? lead.departure : undefined,
      transfers: j.transfers,
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
 * when Transitous has no route.
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
