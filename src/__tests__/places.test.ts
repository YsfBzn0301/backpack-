import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { areaKey, OVERPASS_MIRRORS, overpass, overpassQuery, parseOverpass, resetOverpassMirror } from '@/services/places'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const OK = { elements: [{ type: 'node', id: 1, lat: 48.955, lon: 10.91, tags: { amenity: 'atm', operator: 'Sparkasse' } }] }

function mockMirrors(byHost: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const host = new URL(input).host
    calls.push(host)
    const h = byHost[host]
    if (!h) return Promise.reject(new TypeError('Failed to fetch'))
    // Honour aborts so timeouts work with never-resolving handlers.
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      Promise.resolve(h()).then(resolve, reject)
    })
  })
  return calls
}

const [A, B, C] = OVERPASS_MIRRORS.map((u) => new URL(u).host)

beforeEach(() => resetOverpassMirror())
afterEach(() => vi.unstubAllGlobals())

describe('Overpass mirrors', () => {
  it('falls through 429 and 5xx to the next mirror and remembers the one that worked', async () => {
    const calls = mockMirrors({ [A]: () => json({}, 429), [B]: () => json({}, 504), [C]: () => json(OK) })
    expect(await overpass('q')).toHaveLength(1)
    expect(calls).toEqual([A, B, C])
    await overpass('q')
    expect(calls.at(-1)).toBe(C)
    expect(calls).toHaveLength(4)
  })

  it('treats a server-side timeout remark as a failure', async () => {
    const calls = mockMirrors({ [A]: () => json({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 13 seconds.' }), [B]: () => json(OK) })
    expect(await overpass('q')).toHaveLength(1)
    expect(calls).toEqual([A, B])
  })

  it('accepts a genuinely empty result without trying other mirrors', async () => {
    const calls = mockMirrors({ [A]: () => json({ elements: [] }) })
    expect(await overpass('q')).toEqual([])
    expect(calls).toEqual([A])
  })

  it('times out a hanging mirror and moves on', async () => {
    const calls = mockMirrors({ [A]: () => new Promise<Response>(() => {}), [B]: () => json(OK) })
    expect(await overpass('q', { perTryMs: 30, totalMs: 1000 })).toHaveLength(1)
    expect(calls).toEqual([A, B])
  })

  it('gives up within the total budget with a timeout error', async () => {
    mockMirrors({ [A]: () => new Promise<Response>(() => {}), [B]: () => new Promise<Response>(() => {}), [C]: () => new Promise<Response>(() => {}) })
    const t0 = Date.now()
    await expect(overpass('q', { perTryMs: 200, totalMs: 300 })).rejects.toThrow('places-timeout')
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('reports unavailable when every mirror is down, and does not retry a bad query', async () => {
    mockMirrors({})
    await expect(overpass('q')).rejects.toThrow('places-unavailable')
    const calls = mockMirrors({ [A]: () => json({}, 400), [B]: () => json(OK) })
    await expect(overpass('q')).rejects.toThrow('places-bad-query')
    expect(calls).toEqual([A])
  })
})

describe('Overpass query and parsing', () => {
  it('builds a small query: centre points, tags only, capped output, short server timeout', () => {
    const q = overpassQuery({ lat: 48.954, lng: 10.909, radius: 5000, kinds: ['atm'] })
    expect(q).toContain('[timeout:12]')
    expect(q).toContain('nwr["amenity"="atm"](around:5000,48.95400,10.90900);')
    expect(q).toContain('nwr["amenity"="bank"]')
    expect(q).toMatch(/out center tags \d+;$/)
  })

  it('keeps banks only when they have an ATM and uses centres of ways', () => {
    const places = parseOverpass(
      [
        { type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'atm', operator: 'Sparkasse' } },
        { type: 'way', id: 2, center: { lat: 3, lon: 4 }, tags: { amenity: 'bank', atm: 'yes', name: 'Raiffeisenbank' } },
        { type: 'node', id: 3, lat: 5, lon: 6, tags: { amenity: 'bank', name: 'No ATM bank' } },
        { type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'atm' } },
        { type: 'relation', id: 4, tags: { amenity: 'atm' } },
      ],
      ['atm'],
    )
    expect(places.map((p) => [p.name, p.lat])).toEqual([
      ['Sparkasse', 1],
      ['Raiffeisenbank', 3],
    ])
  })

  it('shares a cache cell within ~500 m but not across it', () => {
    expect(areaKey(48.954, 10.909)).toBe(areaKey(48.9541, 10.9092))
    expect(areaKey(48.954, 10.909)).not.toBe(areaKey(48.962, 10.909))
    expect(areaKey(48.954, 10.909)).not.toBe(areaKey(48.954, 10.921))
  })
})
