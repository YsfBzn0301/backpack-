import { afterEach, describe, expect, it, vi } from 'vitest'
import { clusterPoints, decodePolyline, detectPlatform, fetchRentals, mapRentals, providerColor, rentalLink, sharingNearby, vehicleKind, type RawRentals } from '@/services/sharing'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Reference encoder (Google polyline algorithm) for round-trip tests. */
function encode(points: [number, number][], precision: number) {
  const f = 10 ** precision
  let out = ''
  let pLat = 0
  let pLng = 0
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1
    let s = ''
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63)
      n >>= 5
    }
    return s + String.fromCharCode(n + 63)
  }
  for (const [la, ln] of points) {
    const lat = Math.round(la * f)
    const lng = Math.round(ln * f)
    out += enc(lat - pLat) + enc(lng - pLng)
    pLat = lat
    pLng = lng
  }
  return out
}

const BERLIN = { lat: 52.5208, lng: 13.4095 }
const square = (lat: number, lng: number, d: number): [number, number][] => [
  [lat - d, lng - d],
  [lat - d, lng + d],
  [lat + d, lng + d],
  [lat + d, lng - d],
]

function sample(): RawRentals {
  const ring = (pts: [number, number][], precision = 6) => ({ points: encode(pts, precision), precision, length: pts.length })
  return {
    providerGroups: [
      { id: 'voi', name: 'Voi', color: '#f26961', providers: ['voi-berlin'], formFactors: ['SCOOTER_STANDING'] },
      { id: 'nextbike', name: 'nextbike', providers: ['nextbike-berlin'], formFactors: ['BICYCLE'] },
    ],
    providers: [
      {
        id: 'voi-berlin', name: 'Voi Berlin', groupId: 'voi', url: 'https://voi.com', bbox: [13, 52, 14, 53], formFactors: ['SCOOTER_STANDING'], defaultRestrictions: {}, globalGeofencingRules: {},
        vehicleTypes: [{ id: 'sc', formFactor: 'SCOOTER_STANDING', propulsionType: 'ELECTRIC', returnConstraint: 'FREE_FLOATING', returnConstraintGuessed: false }],
      },
      {
        id: 'nextbike-berlin', name: 'nextbike Berlin', groupId: 'nextbike', color: '0055a5', bbox: [13, 52, 14, 53], formFactors: ['BICYCLE'], defaultRestrictions: {}, globalGeofencingRules: {},
        vehicleTypes: [
          { id: 'classic', formFactor: 'BICYCLE', propulsionType: 'HUMAN', returnConstraint: 'ROUNDTRIP_STATION', returnConstraintGuessed: false },
          { id: 'ebike', formFactor: 'BICYCLE', propulsionType: 'ELECTRIC_ASSIST', returnConstraint: 'ROUNDTRIP_STATION', returnConstraintGuessed: false },
        ],
      },
    ],
    stations: [
      {
        id: 'st1', providerId: 'nextbike-berlin', providerGroupId: 'nextbike', name: 'Alexanderplatz', lat: 52.5215, lon: 13.4115, isRenting: true, isReturning: true, numVehiclesAvailable: 5, formFactors: ['BICYCLE'],
        vehicleTypesAvailable: { classic: 3, ebike: 2 }, vehicleDocksAvailable: {}, bbox: [0, 0, 0, 0], rentalUriWeb: 'https://nextbike.de/st1',
      },
    ],
    vehicles: [
      { id: 'a', providerId: 'voi-berlin', providerGroupId: 'voi', typeId: 'sc', lat: 52.5212, lon: 13.4098, formFactor: 'SCOOTER_STANDING', propulsionType: 'ELECTRIC', returnConstraint: 'FREE_FLOATING', isReserved: false, isDisabled: false, rentalUriIOS: 'voi://scooter/a', rentalUriAndroid: 'https://voi.app/a' },
      { id: 'b', providerId: 'voi-berlin', providerGroupId: 'voi', typeId: 'sc', lat: 52.522, lon: 13.41, formFactor: 'SCOOTER_STANDING', propulsionType: 'ELECTRIC', returnConstraint: 'FREE_FLOATING', isReserved: false, isDisabled: false },
      { id: 'disabled', providerId: 'voi-berlin', providerGroupId: 'voi', typeId: 'sc', lat: 52.5209, lon: 13.4096, formFactor: 'SCOOTER_STANDING', propulsionType: 'ELECTRIC', returnConstraint: 'FREE_FLOATING', isReserved: false, isDisabled: true },
      { id: 'reserved', providerId: 'voi-berlin', providerGroupId: 'voi', typeId: 'sc', lat: 52.5209, lon: 13.4096, formFactor: 'SCOOTER_STANDING', propulsionType: 'ELECTRIC', returnConstraint: 'FREE_FLOATING', isReserved: true, isDisabled: false },
      { id: 'docked', providerId: 'nextbike-berlin', providerGroupId: 'nextbike', typeId: 'classic', lat: 52.5215, lon: 13.4115, formFactor: 'BICYCLE', propulsionType: 'HUMAN', returnConstraint: 'ROUNDTRIP_STATION', stationId: 'st1', isReserved: false, isDisabled: false },
    ],
    zones: [
      { providerId: 'voi-berlin', providerGroupId: 'voi', name: 'Museum Island', z: 2, bbox: [0, 0, 0, 0], area: [[ring(square(52.519, 13.401, 0.001))]], rules: [{ vehicleTypeIdxs: [0], rideStartAllowed: false, rideEndAllowed: false, rideThroughAllowed: true }] },
      { providerId: 'voi-berlin', providerGroupId: 'voi', name: 'Hub', z: 3, bbox: [0, 0, 0, 0], area: [[ring(square(52.521, 13.41, 0.0003), 5)]], rules: [{ vehicleTypeIdxs: [0], rideStartAllowed: true, rideEndAllowed: true, rideThroughAllowed: true, stationParking: true }] },
      { providerId: 'voi-berlin', providerGroupId: 'voi', name: 'Operating area', z: 1, bbox: [0, 0, 0, 0], area: [[ring(square(52.52, 13.4, 0.05))]], rules: [{ vehicleTypeIdxs: [0], rideStartAllowed: true, rideEndAllowed: true, rideThroughAllowed: true }] },
    ],
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('polyline decoding', () => {
  it('decodes the reference polyline at precision 5', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })
  it('respects precision 6 and tolerates truncated input', () => {
    const pts: [number, number][] = [
      [52.520812, 13.409512],
      [52.521, 13.4101],
    ]
    expect(decodePolyline(encode(pts, 6), 6)).toEqual(pts)
    // Decoding with the wrong precision is off by 10×: precision matters.
    expect(decodePolyline(encode(pts, 6), 5)[0][0]).toBeCloseTo(525.20812, 4)
    expect(decodePolyline(encode(pts, 6).slice(0, -1), 6)).toHaveLength(1)
  })
})

describe('mapRentals', () => {
  const data = mapRentals(sample(), BERLIN, 2000, 1)

  it('drops disabled, reserved and docked vehicles and sorts by distance', () => {
    expect(data.vehicles.map((v) => v.id)).toEqual(['voi-berlin:a', 'voi-berlin:b'])
    expect(data.vehicles[0]).toMatchObject({ kind: 'scooter', uris: { ios: 'voi://scooter/a', android: 'https://voi.app/a' } })
    expect(data.vehicles[0].distance).toBeLessThan(data.vehicles[1].distance)
  })

  it('counts station vehicles by type', () => {
    expect(data.stations).toHaveLength(1)
    expect(data.stations[0]).toMatchObject({ name: 'Alexanderplatz', available: 5, byKind: { bike: 3, ebike: 2 } })
  })

  it('summarises providers with group name, colour, nearest and counts', () => {
    const [voi, nb] = data.providers
    expect(voi).toMatchObject({ id: 'voi-berlin', name: 'Voi', color: '#f26961', total: 2, counts: { scooter: 2 }, url: 'https://voi.com' })
    expect(voi.nearest).toBe(data.vehicles[0].distance)
    expect(voi.uris.ios).toBe('voi://scooter/a')
    // Hex without '#' is normalised.
    expect(nb).toMatchObject({ name: 'nextbike', color: '#0055a5', total: 5, counts: { bike: 3, ebike: 2 }, stations: 1 })
  })

  it('keeps only no-parking and station-parking zones, decoded', () => {
    expect(data.zones.map((z) => [z.name, z.kind])).toEqual([
      ['Museum Island', 'noParking'],
      ['Hub', 'stationParking'],
    ])
    expect(data.zones[0].polygons[0][0][0][0]).toBeCloseTo(52.518, 6)
    expect(data.zones[1].polygons[0][0]).toHaveLength(4)
  })

  it('filters by radius and copes with an empty response', () => {
    expect(mapRentals(sample(), BERLIN, 50).vehicles.map((v) => v.id)).toEqual(['voi-berlin:a'])
    const empty = mapRentals({ providerGroups: [], providers: [], stations: [], vehicles: [], zones: [] }, BERLIN, 500)
    expect(empty).toMatchObject({ providers: [], vehicles: [], stations: [], zones: [], radius: 500 })
  })
})

describe('helpers', () => {
  it('maps form factors and propulsion to kinds', () => {
    expect(vehicleKind('SCOOTER_STANDING', 'ELECTRIC')).toBe('scooter')
    expect(vehicleKind('SCOOTER_SEATED', 'ELECTRIC')).toBe('moped')
    expect(vehicleKind('BICYCLE', 'HUMAN')).toBe('bike')
    expect(vehicleKind('BICYCLE', 'ELECTRIC_ASSIST')).toBe('ebike')
    expect(vehicleKind('CARGO_BICYCLE', 'ELECTRIC_ASSIST')).toBe('ebike')
    expect(vehicleKind('CAR', 'ELECTRIC')).toBe('car')
    expect(vehicleKind('OTHER')).toBe('other')
  })
  it('picks the platform deep link with fallbacks', () => {
    const u = { ios: 'ios://x', android: 'android://x', web: 'https://x' }
    expect(rentalLink(u, 'ios')).toBe('ios://x')
    expect(rentalLink(u, 'android')).toBe('android://x')
    expect(rentalLink(u, 'other')).toBe('https://x')
    expect(rentalLink({ web: 'https://w' }, 'ios')).toBe('https://w')
    expect(rentalLink({}, 'android', 'https://provider')).toBe('https://provider')
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('other')
  })
  it('falls back to a stable palette colour', () => {
    expect(providerColor('lime', undefined, 'nope')).toBe(providerColor('lime'))
    expect(providerColor('x', '#abc')).toBe('#abc')
  })
  it('clusters only above the cap', () => {
    const pts = Array.from({ length: 300 }, (_, i) => ({ id: String(i), lat: 52.52 + (i % 10) * 0.0001, lng: 13.4 + Math.floor(i / 10) * 0.0001 }))
    expect(clusterPoints(pts.slice(0, 5), 200, 100)).toHaveLength(5)
    const c = clusterPoints(pts, 200, 500)
    expect(c.length).toBeLessThan(10)
    expect(c.reduce((a, x) => a + x.items.length, 0)).toBe(300)
  })
})

describe('fetchRentals', () => {
  it('sends a SW/NE box with all layers and retries swapped corners on 400', async () => {
    const urls: URL[] = []
    vi.stubGlobal('fetch', async (input: string) => {
      const url = new URL(input)
      urls.push(url)
      return urls.length === 1 ? json({ error: 'bad box' }, 400) : json(sample())
    })
    const d = await sharingNearby({ ...BERLIN, radius: 5000 })
    expect(urls).toHaveLength(2)
    expect(urls[0].pathname).toBe('/api/v1/rentals')
    const [minLat, minLon] = urls[0].searchParams.get('min')!.split(',').map(Number)
    const [maxLat, maxLon] = urls[0].searchParams.get('max')!.split(',').map(Number)
    expect(minLat).toBeLessThan(BERLIN.lat)
    expect(minLon).toBeLessThan(BERLIN.lng)
    expect(maxLat).toBeGreaterThan(BERLIN.lat)
    expect(maxLon).toBeGreaterThan(BERLIN.lng)
    // Capped to 2 km.
    expect(maxLat - minLat).toBeCloseTo((2 * 2000) / 111_320, 4)
    for (const k of ['withProviders', 'withStations', 'withVehicles', 'withZones']) expect(urls[0].searchParams.get(k)).toBe('true')
    expect(urls[1].searchParams.get('min')).toBe(urls[0].searchParams.get('max'))
    expect(d.radius).toBe(2000)
    expect(d.providers).toHaveLength(2)
  })
  it('reports busy servers and network failures', async () => {
    vi.stubGlobal('fetch', async () => json({}, 503))
    await expect(fetchRentals(BERLIN.lat, BERLIN.lng, 500)).rejects.toThrow('sharing-busy')
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(fetchRentals(BERLIN.lat, BERLIN.lng, 500)).rejects.toThrow('sharing-unreachable')
  })
})
