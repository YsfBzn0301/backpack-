/**
 * Shared micromobility (e-scooters, bikes, mopeds, cars) via Transitous'
 * keyless MOTIS API, which aggregates public GBFS feeds from operators such as
 * Lime, Voi, Bolt, Dott, Tier or nextbike. `GET /api/v1/rentals` returns
 * providers, docked stations, free-floating vehicles and geofencing zones.
 *
 * Everything below `fetchRentals` is pure so it can be tested in node.
 * GBFS has no battery or range field in this API, so we never show one.
 */
import { distance, type LatLng } from '@/lib/geo'

const BASE = 'https://api.transitous.org'
const TIMEOUT_MS = 12_000

export type RentalFormFactor = 'BICYCLE' | 'CARGO_BICYCLE' | 'CAR' | 'MOPED' | 'SCOOTER_STANDING' | 'SCOOTER_SEATED' | 'OTHER'
export type RentalPropulsionType = 'HUMAN' | 'ELECTRIC_ASSIST' | 'ELECTRIC' | 'COMBUSTION' | 'COMBUSTION_DIESEL' | 'HYBRID' | 'PLUG_IN_HYBRID' | 'HYDROGEN_FUEL_CELL' | string

export interface EncodedPolyline {
  points: string
  precision: number
  length: number
}

export interface RawRentalProvider {
  id: string
  name: string
  groupId: string
  operator?: string
  url?: string
  purchaseUrl?: string
  color?: string
  bbox: [number, number, number, number]
  vehicleTypes: { id: string; name?: string; formFactor: RentalFormFactor; propulsionType: RentalPropulsionType; returnConstraint: string; returnConstraintGuessed: boolean }[]
  formFactors: RentalFormFactor[]
  defaultRestrictions: unknown
  globalGeofencingRules: unknown
}

export interface RawRentalStation {
  id: string
  providerId: string
  providerGroupId: string
  name: string
  lat: number
  lon: number
  address?: string
  rentalUriAndroid?: string
  rentalUriIOS?: string
  rentalUriWeb?: string
  isRenting: boolean
  isReturning: boolean
  numVehiclesAvailable: number
  formFactors: RentalFormFactor[]
  vehicleTypesAvailable: Record<string, number>
  vehicleDocksAvailable: Record<string, number>
  bbox: [number, number, number, number]
}

export interface RawRentalVehicle {
  id: string
  providerId: string
  providerGroupId: string
  typeId: string
  lat: number
  lon: number
  formFactor: RentalFormFactor
  propulsionType: RentalPropulsionType
  returnConstraint: string
  stationId?: string
  isReserved: boolean
  isDisabled: boolean
  rentalUriAndroid?: string
  rentalUriIOS?: string
  rentalUriWeb?: string
}

export interface RawRentalZone {
  providerId: string
  providerGroupId: string
  name?: string
  z: number
  bbox: [number, number, number, number]
  /** MultiPolygon: polygons → rings (first is outer) → encoded polyline. */
  area: EncodedPolyline[][]
  rules: { vehicleTypeIdxs: number[]; rideStartAllowed: boolean; rideEndAllowed: boolean; rideThroughAllowed: boolean; stationParking?: boolean }[]
}

export interface RawRentals {
  providerGroups: { id: string; name: string; color?: string; providers: string[]; formFactors: RentalFormFactor[] }[]
  providers: RawRentalProvider[]
  stations: RawRentalStation[]
  vehicles: RawRentalVehicle[]
  zones: RawRentalZone[]
}

/** What the UI cares about, independent of GBFS vocabulary. */
export type VehicleKind = 'scooter' | 'ebike' | 'bike' | 'moped' | 'car' | 'other'
export const VEHICLE_KINDS: VehicleKind[] = ['scooter', 'ebike', 'bike', 'moped', 'car', 'other']

export interface RentalUris {
  ios?: string
  android?: string
  web?: string
}

export interface SharingVehicle {
  id: string
  providerId: string
  lat: number
  lng: number
  kind: VehicleKind
  distance: number
  uris: RentalUris
}

export interface SharingStation {
  id: string
  providerId: string
  name: string
  lat: number
  lng: number
  distance: number
  available: number
  byKind: Partial<Record<VehicleKind, number>>
  uris: RentalUris
}

export type ZoneKind = 'noParking' | 'stationParking'

export interface SharingZone {
  id: string
  providerId: string
  kind: ZoneKind
  name?: string
  /** Polygons → rings → [lat, lng] points. */
  polygons: [number, number][][][]
}

export interface SharingProvider {
  id: string
  name: string
  color: string
  url?: string
  /** Nearest available vehicle or station with vehicles, metres. */
  nearest: number | null
  total: number
  counts: Partial<Record<VehicleKind, number>>
  stations: number
  /** Deep link of the nearest vehicle / station, if the feed has one. */
  uris: RentalUris
}

export interface SharingData {
  providers: SharingProvider[]
  vehicles: SharingVehicle[]
  stations: SharingStation[]
  zones: SharingZone[]
  /** Search radius actually used, metres (capped, see sharingNearby). */
  radius: number
  fetchedAt: number
}

/* ---------- Pure helpers ---------- */

/**
 * Google encoded polyline decoder. MOTIS encodes with a configurable
 * `precision` (5 for Google-style, 6 for OSRM/Valhalla-style).
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision
  const out: [number, number][] = []
  let i = 0
  let lat = 0
  let lng = 0
  const next = () => {
    let result = 0
    let shift = 0
    let b: number
    do {
      if (i >= encoded.length) return null
      b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (i < encoded.length) {
    const dLat = next()
    const dLng = next()
    if (dLat == null || dLng == null) break
    lat += dLat
    lng += dLng
    out.push([lat / factor, lng / factor])
  }
  return out
}

/** South-west / north-east corners of a square around a point. */
export function bboxAround(lat: number, lng: number, radius: number) {
  const dLat = radius / 111_320
  const dLng = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return { min: `${(lat - dLat).toFixed(6)},${(lng - dLng).toFixed(6)}`, max: `${(lat + dLat).toFixed(6)},${(lng + dLng).toFixed(6)}` }
}

export function vehicleKind(formFactor: RentalFormFactor | string | undefined, propulsion?: string): VehicleKind {
  const electric = propulsion != null && propulsion !== 'HUMAN'
  switch (formFactor) {
    case 'SCOOTER_STANDING':
      return 'scooter'
    case 'SCOOTER_SEATED':
    case 'MOPED':
      return 'moped'
    case 'BICYCLE':
    case 'CARGO_BICYCLE':
      return electric ? 'ebike' : 'bike'
    case 'CAR':
      return 'car'
    default:
      return 'other'
  }
}

const PALETTE = ['#5fd39a', '#ff876b', '#6cb6ff', '#f2c14e', '#b38cff', '#4fd1c5', '#e57bb8', '#ffb347']
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** Provider colour from the feed (with or without '#'), else a stable palette colour. */
export function providerColor(id: string, ...candidates: (string | undefined)[]) {
  for (const c of candidates) {
    const v = c?.trim().replace(/^#?/, '#')
    if (v && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) return v.slice(0, 7)
    if (v && /^#[0-9a-f]{3}$/i.test(v)) return v
  }
  return PALETTE[hash(id) % PALETTE.length]
}

export type Platform = 'ios' | 'android' | 'other'
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/** Best link to open the operator's app for this platform. */
export function rentalLink(uris: RentalUris, platform: Platform, fallback?: string): string | undefined {
  const order = platform === 'ios' ? [uris.ios, uris.web] : platform === 'android' ? [uris.android, uris.web] : [uris.web]
  return order.find(Boolean) ?? fallback
}

const uris = (o: { rentalUriIOS?: string; rentalUriAndroid?: string; rentalUriWeb?: string }): RentalUris => ({ ios: o.rentalUriIOS, android: o.rentalUriAndroid, web: o.rentalUriWeb })

const ZONE_CAP = 80

/** Map a raw /rentals response to what the Explore tab shows, relative to `origin`. */
export function mapRentals(raw: RawRentals, origin: LatLng, radius = Infinity, now = Date.now()): SharingData {
  const groups = new Map((raw.providerGroups ?? []).map((g) => [g.id, g]))
  const provById = new Map((raw.providers ?? []).map((p) => [p.id, p]))
  const typeKind = (providerId: string, typeId: string) => {
    const t = provById.get(providerId)?.vehicleTypes.find((v) => v.id === typeId)
    return t ? vehicleKind(t.formFactor, t.propulsionType) : 'other'
  }

  const vehicles: SharingVehicle[] = (raw.vehicles ?? [])
    .filter((v) => !v.isDisabled && !v.isReserved && Number.isFinite(v.lat) && Number.isFinite(v.lon))
    // Docked vehicles are counted on their station instead.
    .filter((v) => !v.stationId)
    .map((v) => ({
      id: `${v.providerId}:${v.id}`,
      providerId: v.providerId,
      lat: v.lat,
      lng: v.lon,
      kind: v.formFactor ? vehicleKind(v.formFactor, v.propulsionType) : typeKind(v.providerId, v.typeId),
      distance: Math.round(distance(origin, { lat: v.lat, lng: v.lon })),
      uris: uris(v),
    }))
    .filter((v) => v.distance <= radius)
    .sort((a, b) => a.distance - b.distance)

  const stations: SharingStation[] = (raw.stations ?? [])
    .filter((s) => s.isRenting !== false && Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => {
      const byKind: Partial<Record<VehicleKind, number>> = {}
      for (const [typeId, n] of Object.entries(s.vehicleTypesAvailable ?? {})) {
        if (!n) continue
        const k = typeKind(s.providerId, typeId)
        byKind[k] = (byKind[k] ?? 0) + n
      }
      // Some feeds only give the total; attribute it to the station's single form factor.
      if (!Object.keys(byKind).length && s.numVehiclesAvailable > 0) {
        const ff = s.formFactors?.length === 1 ? s.formFactors[0] : undefined
        byKind[ff ? vehicleKind(ff, provById.get(s.providerId)?.vehicleTypes.find((t) => t.formFactor === ff)?.propulsionType) : 'other'] = s.numVehiclesAvailable
      }
      return {
        id: `${s.providerId}:${s.id}`,
        providerId: s.providerId,
        name: s.name,
        lat: s.lat,
        lng: s.lon,
        distance: Math.round(distance(origin, { lat: s.lat, lng: s.lon })),
        available: Math.max(0, s.numVehiclesAvailable ?? 0),
        byKind,
        uris: uris(s),
      }
    })
    .filter((s) => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance)

  const zones: SharingZone[] = []
  for (const [zi, z] of (raw.zones ?? []).entries()) {
    const noParking = z.rules?.some((r) => r.rideEndAllowed === false || r.rideThroughAllowed === false)
    const stationParking = z.rules?.some((r) => r.stationParking)
    // Plain operating areas (everything allowed) are not drawn: keeps the map light.
    const kind: ZoneKind | null = noParking ? 'noParking' : stationParking ? 'stationParking' : null
    if (!kind) continue
    const polygons = (z.area ?? [])
      .map((poly) => poly.map((ring) => decodePolyline(ring.points, ring.precision ?? 5)).filter((r) => r.length >= 3))
      .filter((p) => p.length)
    if (!polygons.length) continue
    zones.push({ id: `${z.providerId}:${zi}`, providerId: z.providerId, kind, name: z.name, polygons })
    if (zones.length >= ZONE_CAP) break
  }

  const summary = new Map<string, SharingProvider>()
  const ensure = (id: string) => {
    let s = summary.get(id)
    if (!s) {
      const p = provById.get(id)
      const g = p ? groups.get(p.groupId) : undefined
      s = { id, name: g?.name || p?.name || id, color: providerColor(id, p?.color, g?.color), url: p?.url, nearest: null, total: 0, counts: {}, stations: 0, uris: {} }
      summary.set(id, s)
    }
    return s
  }
  for (const v of vehicles) {
    const s = ensure(v.providerId)
    s.total++
    s.counts[v.kind] = (s.counts[v.kind] ?? 0) + 1
    if (s.nearest == null || v.distance < s.nearest) {
      s.nearest = v.distance
      s.uris = v.uris
    }
  }
  for (const st of stations) {
    const s = ensure(st.providerId)
    s.stations++
    if (!st.available) continue
    s.total += st.available
    for (const [k, n] of Object.entries(st.byKind)) s.counts[k as VehicleKind] = (s.counts[k as VehicleKind] ?? 0) + (n ?? 0)
    if (s.nearest == null || st.distance < s.nearest) {
      s.nearest = st.distance
      s.uris = st.uris
    }
  }
  const providers = [...summary.values()].sort((a, b) => (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0) || (a.nearest ?? Infinity) - (b.nearest ?? Infinity))
  return { providers, vehicles, stations, zones, radius: Number.isFinite(radius) ? radius : 0, fetchedAt: now }
}

export interface Cluster<T> {
  key: string
  lat: number
  lng: number
  items: T[]
}

/**
 * Grid-cluster points when there are more than `max`, so the map stays light
 * in big cities. Below `max` every point is its own cluster.
 */
export function clusterPoints<T extends { id: string; lat: number; lng: number }>(points: T[], max: number, cellMeters: number): Cluster<T>[] {
  if (points.length <= max) return points.map((p) => ({ key: p.id, lat: p.lat, lng: p.lng, items: [p] }))
  const dLat = cellMeters / 111_320
  const cells = new Map<string, T[]>()
  for (const p of points) {
    const dLng = dLat / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180))
    const k = `${Math.floor(p.lat / dLat)}:${Math.floor(p.lng / dLng)}`
    const c = cells.get(k)
    if (c) c.push(p)
    else cells.set(k, [p])
  }
  return [...cells.entries()].map(([k, items]) => ({
    key: `c${k}`,
    lat: items.reduce((a, p) => a + p.lat, 0) / items.length,
    lng: items.reduce((a, p) => a + p.lng, 0) / items.length,
    items,
  }))
}

/* ---------- Network ---------- */

async function get(params: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  const t = AbortSignal.timeout?.(TIMEOUT_MS)
  const sig = t && signal && 'any' in AbortSignal ? AbortSignal.any([signal, t]) : (signal ?? t)
  try {
    return await fetch(`${BASE}/api/v1/rentals?${new URLSearchParams(params)}`, { signal: sig, headers: { Accept: 'application/json' } })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new Error('sharing-unreachable')
  }
}

export async function fetchRentals(lat: number, lng: number, radius: number, signal?: AbortSignal): Promise<RawRentals> {
  const { min, max } = bboxAround(lat, lng, radius)
  const flags = { withProviders: 'true', withStations: 'true', withVehicles: 'true', withZones: 'true' }
  let res = await get({ min, max, ...flags }, signal)
  // The spec's corner labels are ambiguous; if the server rejects SW/NE, try the other way round.
  if (res.status === 400) res = await get({ min: max, max: min, ...flags }, signal)
  if (!res.ok) throw new Error(res.status === 429 || res.status >= 500 ? 'sharing-busy' : `sharing-${res.status}`)
  return res.json()
}

/** Sharing vehicles, stations and no-parking zones around a point. */
export const SHARING_MAX_RADIUS = 2000
export async function sharingNearby(args: { lat: number; lng: number; radius: number }, signal?: AbortSignal): Promise<SharingData> {
  // Vehicles further than 2 km are not useful on foot; cap the box to keep the payload small.
  const radius = Math.min(args.radius, SHARING_MAX_RADIUS)
  const raw = await fetchRentals(args.lat, args.lng, radius, signal)
  return mapRentals(raw, { lat: args.lat, lng: args.lng }, radius)
}
