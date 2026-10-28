import { afterEach, describe, expect, it, vi } from 'vitest'
import { departures, journeys, nearbyStops, searchLocations } from '@/services/transit'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockFetch(handler: (url: URL) => Response) {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input)
    calls.push(url.pathname)
    return handler(url)
  })
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('transit (Transitous)', () => {
  it('groups platforms into stations, sorted by distance', async () => {
    mockFetch(() =>
      json([
        { name: 'Alexanderplatz', stopId: 'de:A:1', lat: 52.5219, lon: 13.4132, modes: ['SUBWAY'] },
        { name: 'Alexanderplatz', stopId: 'de:A:2', lat: 52.5215, lon: 13.4115, modes: ['TRAM'] },
        { name: 'Rotes Rathaus', stopId: 'de:R:1', lat: 52.5185, lon: 13.4085, modes: ['BUS'] },
      ]),
    )
    const stops = await nearbyStops(52.5208, 13.4095)
    expect(stops.map((s) => s.name)).toEqual(['Alexanderplatz', 'Rotes Rathaus'])
    expect(stops[0].id).toBe('de:A:2')
    expect(stops[0].modes.sort()).toEqual(['subway', 'tram'])
  })

  it('maps stop times to departures and falls back to an older API version on 404', async () => {
    const calls = mockFetch((url) =>
      url.pathname === '/api/v5/stoptimes'
        ? json({ error: 'not found' }, 404)
        : json({
            stopTimes: [
              {
                place: { name: 'Alexanderplatz', lat: 0, lon: 0, scheduledDeparture: '2026-10-28T10:00:00Z', departure: '2026-10-28T10:03:00Z', track: '2', scheduledTrack: '1', alerts: [{ headerText: 'Bauarbeiten', descriptionText: 'Ersatzverkehr' }] },
                mode: 'SUBURBAN',
                realTime: true,
                headsign: 'Spandau',
                tripId: 't1',
                displayName: 'S5',
              },
              { place: { name: 'Alexanderplatz', lat: 0, lon: 0, scheduledDeparture: '2026-10-28T10:05:00Z' }, mode: 'BUS', realTime: false, headsign: '', tripTo: { name: 'Zoo' }, tripId: 't2', routeShortName: '100', tripCancelled: true },
              { place: { name: 'Alexanderplatz', lat: 0, lon: 0, scheduledArrival: '2026-10-28T10:06:00Z' }, mode: 'TRAM', realTime: false, headsign: 'Here', tripId: 't3' },
            ],
          }),
    )
    const { list } = await departures('de:A:1')
    expect(calls).toEqual(['/api/v5/stoptimes', '/api/v6/stoptimes'])
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ delayMin: 3, platform: '2', plannedPlatform: '1', direction: 'Spandau', line: { name: 'S5', mode: 'suburban' }, cancelled: false })
    expect(list[0].remarks[0].text).toBe('Bauarbeiten: Ersatzverkehr')
    expect(list[1]).toMatchObject({ when: null, delayMin: null, direction: 'Zoo', line: { name: '100', mode: 'bus' }, cancelled: true })
    // The working version is remembered.
    await departures('de:A:1')
    expect(calls.at(-1)).toBe('/api/v6/stoptimes')
  })

  it('maps geocoder matches and itineraries', async () => {
    mockFetch((url) => {
      if (url.pathname === '/api/v1/geocode')
        return json([
          { type: 'STOP', id: 'de:H:1', name: 'Berlin Hbf', lat: 52.525, lon: 13.369, areas: [{ name: 'Berlin', default: true }] },
          { type: 'ADDRESS', id: 'x', name: 'Unter den Linden', houseNumber: '5', lat: 52.517, lon: 13.389, areas: [] },
        ])
      expect(url.searchParams.get('fromPlace')).toBe('52.52,13.4')
      expect(url.searchParams.get('toPlace')).toBe('de:H:1')
      return json({
        itineraries: [
          {
            startTime: '2026-10-28T10:00:00Z',
            endTime: '2026-10-28T10:20:00Z',
            transfers: 0,
            legs: [
              { mode: 'WALK', from: { name: 'START', lat: 0, lon: 0 }, to: { name: 'Alexanderplatz', lat: 0, lon: 0 }, startTime: '2026-10-28T10:00:00Z', endTime: '2026-10-28T10:05:00Z', scheduledStartTime: '2026-10-28T10:00:00Z', scheduledEndTime: '2026-10-28T10:05:00Z', realTime: false, distance: 300 },
              { mode: 'SUBURBAN', from: { name: 'Alexanderplatz', lat: 0, lon: 0, track: '3' }, to: { name: 'Berlin Hbf', lat: 0, lon: 0 }, startTime: '2026-10-28T10:07:00Z', endTime: '2026-10-28T10:20:00Z', scheduledStartTime: '2026-10-28T10:06:00Z', scheduledEndTime: '2026-10-28T10:19:00Z', realTime: true, displayName: 'S7', headsign: 'Potsdam' },
            ],
          },
        ],
      })
    })
    const places = await searchLocations('hbf')
    expect(places).toEqual([
      { id: 'de:H:1', name: 'Berlin Hbf', lat: 52.525, lng: 13.369, kind: 'stop' },
      { id: undefined, name: 'Unter den Linden 5', lat: 52.517, lng: 13.389, kind: 'address' },
    ])
    const [j] = await journeys({ name: 'My location', lat: 52.52, lng: 13.4, kind: 'address' }, places[0], new Date())
    expect(j.transfers).toBe(0)
    expect(j.legs[0]).toMatchObject({ walking: true, origin: 'My location', distance: 300 })
    expect(j.legs[1]).toMatchObject({ walking: false, departureDelayMin: 1, departurePlatform: '3', line: { name: 'S7', mode: 'suburban' }, direction: 'Potsdam' })
  })
})
