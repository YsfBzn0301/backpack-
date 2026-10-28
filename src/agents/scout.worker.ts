/**
 * ScoutAgent — proximity & recommendations.
 * Watches location, local time and weather; scans the configured radius and
 * pushes the one or two suggestions that fit the moment.
 */
import { defineAgent, formatLocalTime, localHour, type AgentApi } from './runtime'
import type { AgentContext, Place, PlaceKind } from './protocol'
import { distance, formatDistance, walkMinutes } from '@/lib/geo'

export interface Intent {
  id: string
  label: string
  kinds: PlaceKind[]
  weight: number
  why: string
}

export interface RankedPlace extends Place {
  distance: number
  score: number
  reason: string
}

export interface ScoutState {
  lastScanAt: number
  intents: Intent[]
  picks: RankedPlace[]
}

const KIND_LABEL: Record<PlaceKind, string> = {
  atm: 'ATM', hostel: 'hostel', street_food: 'street food', restaurant: 'restaurant', cafe: 'café', convenience: 'convenience store',
  bar: 'bar', pharmacy: 'pharmacy', hospital: 'hospital', bus: 'bus terminal', embassy: 'embassy', police: 'police',
}

/** Turn context into what the traveller probably needs right now. */
export function deriveIntents(ctx: AgentContext): Intent[] {
  const h = localHour(ctx)
  const t = ctx.weather?.tempC
  const kind = ctx.weather?.kind
  const time = formatLocalTime(ctx)
  const temp = t != null ? `${Math.round(t)}°C` : null
  const stamp = temp ? `It's ${time} and ${temp}` : `It's ${time}`
  const out: Intent[] = []

  if (h >= 6 && h < 10.5) out.push({ id: 'breakfast', label: 'Coffee & breakfast', kinds: ['cafe', 'street_food'], weight: 1, why: `${stamp}: breakfast time` })
  if (h >= 11 && h < 14.5) out.push({ id: 'lunch', label: 'Lunch', kinds: ['street_food', 'restaurant'], weight: 1, why: `${stamp}: lunch time` })
  if (h >= 14.5 && h < 17.5) out.push({ id: 'break', label: 'Afternoon break', kinds: ['cafe'], weight: 0.6, why: `${stamp}: time for a break` })
  if (h >= 17.5 && h < 21.5) out.push({ id: 'dinner', label: 'Dinner', kinds: ['street_food', 'restaurant'], weight: 1, why: `${stamp}: dinner time` })
  if (h >= 21.5 || h < 2) out.push({ id: 'late', label: 'Late-night', kinds: ['convenience', 'street_food', 'bar'], weight: 0.7, why: `${stamp}: late-night options` })

  if (t != null && t >= 30) out.push({ id: 'cool', label: 'Cold drinks & AC', kinds: ['cafe', 'convenience'], weight: 1.2, why: `${stamp}: get out of the heat` })
  if (kind === 'rain' || kind === 'thunder' || kind === 'drizzle') out.push({ id: 'shelter', label: 'Somewhere dry', kinds: ['cafe', 'restaurant'], weight: 1.1, why: `${stamp} with ${ctx.weather?.description ?? 'rain'}: duck inside` })
  if (t != null && t <= 8) out.push({ id: 'warm', label: 'Warm up', kinds: ['cafe', 'restaurant'], weight: 1, why: `${stamp}: warm up indoors` })

  if (!out.length) out.push({ id: 'explore', label: 'Around you', kinds: ['cafe', 'street_food'], weight: 0.5, why: stamp })
  return out
}

function score(p: Place, origin: { lat: number; lng: number }, radius: number, kindWeight: number) {
  const d = distance(origin, p)
  const rating = p.rating ?? 3.9
  const volume = Math.log10((p.ratingCount ?? 8) + 1)
  let s = (rating - 3) * 1.6 + volume * 0.5 - (d / radius) * 1.8 + kindWeight
  if (p.openNow === true) s += 0.6
  if (p.openNow === false) s -= 3
  return { d, s }
}

export function rank(places: Place[], ctx: AgentContext, intents = deriveIntents(ctx)): RankedPlace[] {
  if (!ctx.coords) return []
  const weightFor = (k: PlaceKind) => Math.max(0, ...intents.filter((i) => i.kinds.includes(k)).map((i) => i.weight))
  return places
    .filter((p) => distance(ctx.coords!, p) <= ctx.radius * 1.5)
    .map((p) => {
      const { d, s } = score(p, ctx.coords!, ctx.radius, weightFor(p.kind))
      const bits = [
        p.rating ? `${p.rating.toFixed(1)}★${p.ratingCount ? ` · ${compact(p.ratingCount)} reviews` : ''}` : null,
        `${formatDistance(d)} · ${walkMinutes(d)} min walk`,
        p.openNow ? 'open now' : null,
      ].filter(Boolean)
      return { ...p, distance: d, score: s, reason: bits.join(' · ') }
    })
    .sort((a, b) => b.score - a.score)
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))

let lastScan: { lat: number; lng: number; at: number; kind?: string; intents: string } | null = null

async function scan(api: AgentApi<ScoutState>, force = false) {
  const ctx = api.context()
  if (!ctx?.coords || !ctx.online) return api.state().picks
  const intents = deriveIntents(ctx)
  const intentKey = intents.map((i) => i.id).join(',')
  const moved = lastScan ? distance(lastScan, ctx.coords) : Infinity
  const age = lastScan ? ctx.now - lastScan.at : Infinity
  const changed = !lastScan || lastScan.kind !== ctx.weather?.kind || lastScan.intents !== intentKey
  if (!force && moved < 150 && age < 10 * 60_000 && !changed) return api.state().picks

  lastScan = { ...ctx.coords, at: ctx.now, kind: ctx.weather?.kind, intents: intentKey }
  const kinds = [...new Set(intents.flatMap((i) => i.kinds))]
  const places = await api.tool('places.nearby', { lat: ctx.coords.lat, lng: ctx.coords.lng, radius: ctx.radius, kinds, limit: 40 })
  const ranked = rank(places, ctx, intents)
  api.publish({ lastScanAt: ctx.now, intents, picks: ranked.slice(0, 8) })

  // One headline suggestion per top intent, max two in the feed.
  const used = new Set<string>()
  intents
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .forEach((intent, idx) => {
      const best = ranked.find((p) => intent.kinds.includes(p.kind) && !used.has(p.id))
      if (!best) return
      used.add(best.id)
      const near = formatDistance(best.distance)
      const quality = best.rating ? `Top-rated ${KIND_LABEL[best.kind]} (${best.rating.toFixed(1)}★)` : `Closest ${KIND_LABEL[best.kind]}`
      const extras = [`${walkMinutes(best.distance)} min walk`, best.openNow ? 'open now' : null].filter(Boolean).join(', ')
      api.emit({
        key: `scout-${idx}`,
        kind: 'suggestion',
        priority: intent.weight >= 1.1 ? 2 : 1,
        ttl: 30 * 60_000,
        title: `${intent.label}: ${best.name}`,
        body: `${intent.why}. ${quality} ${near} away, ${extras}.`,
        action: { label: 'Directions', type: 'directions', payload: { lat: best.lat, lng: best.lng, id: best.source === 'google' ? best.id : undefined, name: best.name } },
      })
    })
  if (!used.size) {
    api.emit({
      key: 'scout-0',
      kind: 'info',
      priority: 0,
      ttl: 15 * 60_000,
      title: 'Quiet around here',
      body: `Nothing that fits right now within ${formatDistance(ctx.radius)}. Try widening the radius on the Map tab.`,
      action: { label: 'Open map', type: 'tab', payload: 'map' },
    })
    api.retract('scout-1')
  }
  return ranked
}

defineAgent<ScoutState>({
  name: 'scout',
  initialState: { lastScanAt: 0, intents: [], picks: [] },
  onContext: async (ctx, _prev, api) => {
    if (!ctx.coords) {
      api.emit({
        key: 'scout-0',
        kind: 'info',
        priority: 0,
        title: 'Scout is waiting for your location',
        body: 'Allow location access or search a destination and Scout will look around for you.',
      })
      return
    }
    api.publish({ intents: deriveIntents(ctx) })
    await scan(api)
  },
  tasks: {
    scan: (_: never, api) => scan(api, true),
    rank: (payload: { places: Place[] }, api) => {
      const ctx = api.context()
      return ctx ? rank(payload.places, ctx) : payload.places
    },
    intents: (_: never, api) => {
      const ctx = api.context()
      return ctx ? deriveIntents(ctx) : []
    },
  },
})
