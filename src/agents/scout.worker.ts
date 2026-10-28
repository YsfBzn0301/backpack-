/**
 * ScoutAgent — proximity, parking & recommendations.
 * Watches location, local time and weather; scans the radius for places that
 * fit the moment and, in road-trip mode, analyses parking: what's open, free,
 * time-limited or about to close, and what a stay will cost.
 */
import { defineAgent, localHour, type AgentApi } from './runtime'
import { msg, type AgentContext, type Msg, type ParkingLot, type Place, type PlaceKind } from './protocol'
import { distance, walkMinutes } from '@/lib/geo'
import { estimateParking, parkingNow, summarizeRates, type ParkingEstimate, type ParkingNow, type RateSummary } from '@/lib/parking-cost'

export type IntentId = 'breakfast' | 'lunch' | 'break' | 'dinner' | 'late' | 'cool' | 'shelter' | 'warm' | 'explore'

export interface Intent {
  id: IntentId
  kinds: PlaceKind[]
  weight: number
}

export interface RankedPlace extends Place {
  distance: number
  score: number
}

export interface ParkingAnalysis {
  id: string
  distance: number
  now: ParkingNow
  estimate: ParkingEstimate
  rates: RateSummary
  warnings: Msg[]
  /** Cannot be used for this stay (closed, too low, full, over max stay). */
  blocked: boolean
  score: number
}

export interface ScoutState {
  lastScanAt: number
  intents: Intent[]
  picks: RankedPlace[]
  parkingAt: number
}

/** Turn context into what the traveller probably needs right now. */
export function deriveIntents(ctx: AgentContext): Intent[] {
  const h = localHour(ctx)
  const t = ctx.weather?.tempC
  const kind = ctx.weather?.kind
  const out: Intent[] = []
  if (h >= 6 && h < 10.5) out.push({ id: 'breakfast', kinds: ['cafe', 'street_food'], weight: 1 })
  if (h >= 11 && h < 14.5) out.push({ id: 'lunch', kinds: ['street_food', 'restaurant'], weight: 1 })
  if (h >= 14.5 && h < 17.5) out.push({ id: 'break', kinds: ['cafe'], weight: 0.6 })
  if (h >= 17.5 && h < 21.5) out.push({ id: 'dinner', kinds: ['street_food', 'restaurant'], weight: 1 })
  if (h >= 21.5 || h < 2) out.push({ id: 'late', kinds: ['convenience', 'street_food', 'bar'], weight: 0.7 })
  if (t != null && t >= 30) out.push({ id: 'cool', kinds: ['cafe', 'convenience'], weight: 1.2 })
  if (kind === 'rain' || kind === 'thunder' || kind === 'drizzle') out.push({ id: 'shelter', kinds: ['cafe', 'restaurant'], weight: 1.1 })
  if (t != null && t <= 8) out.push({ id: 'warm', kinds: ['cafe', 'restaurant'], weight: 1 })
  if (!out.length) out.push({ id: 'explore', kinds: ['cafe', 'street_food'], weight: 0.5 })
  return out
}

/** "It's 1:00 PM and 33°C" as a message, so the UI can localise time and units. */
const stamp = (ctx: AgentContext): Msg =>
  ctx.weather
    ? msg('agents.scout.stamp', { time: { t: 'time', ts: ctx.now, off: ctx.utcOffsetSec }, temp: { t: 'temp', c: ctx.weather.tempC } })
    : msg('agents.scout.stampNoTemp', { time: { t: 'time', ts: ctx.now, off: ctx.utcOffsetSec } })

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
      return { ...p, distance: d, score: s }
    })
    .sort((a, b) => b.score - a.score)
}

/* ---------- Parking ---------- */

export function analyzeParking(lots: ParkingLot[], ctx: AgentContext, stayMin: number, startTs = ctx.now): ParkingAnalysis[] {
  const off = ctx.utcOffsetSec
  const origin = ctx.coords
  return lots
    .map((lot) => {
      const d = origin ? distance(origin, lot) : 0
      const now = parkingNow(lot, startTs, off)
      const estimate = estimateParking(lot, startTs, stayMin, off)
      const rates = summarizeRates(lot)
      const warnings: Msg[] = []
      let blocked = false
      const at = (min: number) => ({ t: 'time' as const, ts: startTs + min * 60_000, off })

      if (now.open === false || lot.state === 'closed') {
        blocked = true
        warnings.push(now.openChangeIn ? msg('parking.warn.closedUntil', { time: at(now.openChangeIn) }) : msg('parking.warn.closed'))
      } else if (estimate.closesDuringStay && now.openChangeIn != null) {
        warnings.push(msg('parking.warn.closesAt', { time: at(now.openChangeIn) }))
      }
      if (lot.maxHeightM && ctx.vehicleHeightM > lot.maxHeightM) {
        blocked = true
        warnings.push(msg('parking.warn.tooLow', { h: lot.maxHeightM.toFixed(2) }))
      }
      if (lot.free === 0) {
        blocked = true
        warnings.push(msg('parking.warn.full'))
      } else if (lot.free != null && lot.capacity && lot.free / lot.capacity < 0.08) warnings.push(msg('parking.warn.almostFull', { n: lot.free }))
      if (now.maxStayNow != null) {
        warnings.push(msg(lot.disc ? 'parking.warn.maxStayDisc' : 'parking.warn.maxStay', { dur: { t: 'dur', min: now.maxStayNow } }))
        if (estimate.exceedsMaxStay) {
          blocked = true
          warnings.push(msg('parking.warn.overstay', { dur: { t: 'dur', min: stayMin } }))
        }
      } else if (lot.disc) warnings.push(msg('parking.warn.disc'))
      if (now.freeNow === false && now.freeChangeIn != null && now.freeChangeIn <= 180) warnings.push(msg('parking.warn.freeFrom', { time: at(now.freeChangeIn) }))
      if (now.freeNow === true && now.freeChangeIn != null && now.freeChangeIn < stayMin) warnings.push(msg('parking.warn.paidFrom', { time: at(now.freeChangeIn) }))
      if (lot.customersOnly) warnings.push(msg('parking.warn.customers'))

      // Ranking: usable first, then cheap, close, with live free spaces.
      let s = blocked ? -100 : 0
      s -= d / 400
      if (estimate.total === 0) s += 3
      else if (estimate.total != null) s += Math.max(0, 2.5 - estimate.total / Math.max(1, stayMin / 60) / 2)
      if (lot.free != null && lot.free > 0) s += 1.5
      if (lot.type === 'garage' || lot.type === 'underground') s += 0.3
      if (lot.name) s += 0.2
      return { id: lot.id, distance: d, now, estimate, rates, warnings, blocked, score: s }
    })
    .sort((a, b) => b.score - a.score)
}

let lastParking: { lat: number; lng: number; at: number } | null = null

async function scanParking(api: AgentApi<ScoutState>) {
  const ctx = api.context()
  if (!ctx?.coords || !ctx.online || !ctx.driving) return
  const moved = lastParking ? distance(lastParking, ctx.coords) : Infinity
  if (moved < 300 && ctx.now - (lastParking?.at ?? 0) < 10 * 60_000) return
  lastParking = { ...ctx.coords, at: ctx.now }
  const lots = await api.tool('parking.nearby', { lat: ctx.coords.lat, lng: ctx.coords.lng, radius: Math.max(ctx.radius, 1000), country: ctx.country ?? ctx.countryHint })
  const stay = 120
  const analysis = analyzeParking(lots, ctx, stay).filter((a) => !a.blocked)
  api.publish({ parkingAt: ctx.now })
  const best = analysis[0]
  if (!best) {
    api.retract('scout-parking')
    return
  }
  const lot = lots.find((l) => l.id === best.id)!
  // Ask BudgetAgent to price it in home currency and check the budget.
  const quote = (await api
    .tool('agent.run', { agent: 'budget', task: 'parkingQuote', payload: { items: [{ id: best.id, name: lot.name, estimate: best.estimate, rates: best.rates }], stayMin: stay, notify: true } })
    .catch(() => null)) as { id: string; totalHome: number | null; home: string }[] | null
  const priced = quote?.[0]
  const price: Msg =
    best.estimate.total === 0
      ? msg('parking.price.free')
      : priced?.totalHome != null
        ? msg('agents.scout.parkingPrice', { amount: { t: 'money', amount: priced.totalHome, cur: priced.home }, dur: { t: 'dur', min: stay } })
        : msg('parking.price.unknown')
  api.emit({
    key: 'scout-parking',
    kind: 'suggestion',
    priority: 1,
    ttl: 20 * 60_000,
    title: msg('agents.scout.parkingTitle', { name: lot.name || msg(`parking.type.${lot.type}`) }),
    body: msg(lot.free != null ? 'agents.scout.parkingBodyLive' : 'agents.scout.parkingBody', {
      dist: { t: 'dist', m: best.distance },
      price,
      free: lot.free ?? 0,
    }),
    action: { label: msg('actions.parking'), type: 'parking' },
  })
}

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

  const used = new Set<string>()
  intents
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .forEach((intent, idx) => {
      const best = ranked.find((p) => intent.kinds.includes(p.kind) && !used.has(p.id))
      if (!best) return
      used.add(best.id)
      api.emit({
        key: `scout-${idx}`,
        kind: 'suggestion',
        priority: intent.weight >= 1.1 ? 2 : 1,
        ttl: 30 * 60_000,
        title: msg('agents.scout.pickTitle', { intent: msg(`intent.${intent.id}`), name: best.name }),
        body: msg(best.rating ? 'agents.scout.pickBodyRated' : 'agents.scout.pickBody', {
          why: msg(`agents.scout.why.${intent.id}`, { stamp: stamp(ctx) }),
          kind: msg(`kind.${best.kind}`),
          rating: best.rating?.toFixed(1) ?? '',
          dist: { t: 'dist', m: best.distance },
          mins: walkMinutes(best.distance),
          open: best.openNow ? msg('agents.scout.openNow') : '',
        }),
        action: { label: msg('actions.directions'), type: 'directions', payload: { lat: best.lat, lng: best.lng, id: best.source === 'google' ? best.id : undefined } },
      })
    })
  if (!used.size) {
    api.emit({
      key: 'scout-0',
      kind: 'info',
      priority: 0,
      ttl: 15 * 60_000,
      title: msg('agents.scout.quietTitle'),
      body: msg('agents.scout.quietBody', { radius: { t: 'dist', m: ctx.radius } }),
      action: { label: msg('actions.openMap'), type: 'tab', payload: 'map' },
    })
    api.retract('scout-1')
  }
  return ranked
}

defineAgent<ScoutState>({
  name: 'scout',
  initialState: { lastScanAt: 0, intents: [], picks: [], parkingAt: 0 },
  onContext: async (ctx, _prev, api) => {
    if (!ctx.coords) {
      api.emit({ key: 'scout-0', kind: 'info', priority: 0, title: msg('agents.scout.waitingTitle'), body: msg('agents.scout.waitingBody') })
      return
    }
    api.publish({ intents: deriveIntents(ctx) })
    await scan(api)
    if (ctx.driving) await scanParking(api).catch(() => {})
    else api.retract('scout-parking')
  },
  tasks: {
    scan: (_: never, api) => scan(api, true),
    rank: (payload: { places: Place[] }, api) => {
      const ctx = api.context()
      return ctx ? rank(payload.places, ctx) : payload.places
    },
    parkingAnalyze: (p: { lots: ParkingLot[]; stayMin: number; startTs?: number }, api) => {
      const ctx = api.context()
      return ctx ? analyzeParking(p.lots, ctx, p.stayMin, p.startTs) : []
    },
  },
})
