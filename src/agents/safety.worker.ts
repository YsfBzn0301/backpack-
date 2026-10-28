/**
 * Safety & SOS Agent — geofence & emergency context.
 * Resolves which country you're in (online reverse geocode, offline fallbacks),
 * swaps in local emergency numbers, and keeps nearest hospitals / pharmacies.
 */
import { get, set, createStore } from 'idb-keyval'
import { defineAgent, fetchJson, localHour, type AgentApi } from './runtime'
import { COUNTRIES, FALLBACK_COUNTRY, TZ_COUNTRY, getCountry, type Country } from '@/data/countries'
import { distance } from '@/lib/geo'
import { msg, type Coords, type Place } from './protocol'
import { getRoadRules } from '@/data/roadRules'

export interface Medical extends Place {
  distance: number
}

export interface SafetyState {
  country: Country
  countrySource: 'gps' | 'search' | 'cache' | 'timezone' | 'hint' | 'none'
  city: string | null
  region: string | null
  medical: Medical[]
  medicalAt: number
}

const db = createStore('backpack-safety', 'kv')
let lastGeocode: (Coords & { at: number }) | null = null
let lastMedical: (Coords & { at: number }) | null = null

async function reverseGeocode(c: Coords) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lng}&localityLanguage=en`
  const r = await fetchJson<{ countryCode?: string; city?: string; locality?: string; principalSubdivision?: string }>(url, undefined, 8000)
  return { code: r.countryCode?.toUpperCase() || null, city: r.city || r.locality || null, region: r.principalSubdivision || null }
}

function announce(api: AgentApi<SafetyState>, country: Country, first: boolean, preview: boolean) {
  const c = { t: 'country' as const, code: country.code }
  const nums = msg(country.tourist ? 'agents.safety.numbersTourist' : 'agents.safety.numbers', {
    police: country.police,
    ambulance: country.ambulance,
    fire: country.fire,
    tourist: country.tourist ?? '',
  })
  api.emit({
    key: 'safety-country',
    kind: first || preview ? 'info' : 'alert',
    priority: first || preview ? 1 : 3,
    ttl: 6 * 3600_000,
    title: msg(preview ? 'agents.safety.previewTitle' : first ? 'agents.safety.numbersTitle' : 'agents.safety.welcomeTitle', { country: c }),
    body: first || preview ? nums : msg('agents.safety.updatedBody', { numbers: nums }),
    action: { label: msg('actions.openSos'), type: 'sos' },
  })
  // Road-trip mode: headline toll and driving rules for the new country.
  const rules = getRoadRules(country.code)
  const ctx = api.context()
  if (rules && ctx?.driving) {
    api.emit({
      key: 'safety-road',
      kind: rules.toll === 'vignette' ? 'alert' : 'info',
      priority: rules.toll === 'vignette' && !preview ? 2 : 1,
      ttl: 12 * 3600_000,
      title: msg('agents.safety.roadTitle', { country: c }),
      body: msg('agents.safety.roadBody', {
        side: msg(`road.side.${rules.drive}`),
        toll: msg(`road.toll.${rules.toll}`),
        speed: rules.speed.map((v) => (v == null ? '—' : String(v))).join(' / ') + (rules.unit === 'mph' ? ' mph' : ' km/h'),
      }),
      action: { label: msg('actions.parking'), type: 'parking' },
    })
  } else api.retract('safety-road')
}

async function resolveCountry(api: AgentApi<SafetyState>) {
  const ctx = api.context()
  if (!ctx) return
  const prev = api.state().country
  let code: string | null = null
  let source: SafetyState['countrySource'] = 'none'
  let city: string | null = api.state().city
  let region: string | null = api.state().region

  if (ctx.coords && ctx.online) {
    const moved = lastGeocode ? distance(lastGeocode, ctx.coords) : Infinity
    if (moved < 2000 && prev.code !== 'XX') return
    try {
      const r = await reverseGeocode(ctx.coords)
      lastGeocode = { ...ctx.coords, at: Date.now() }
      code = r.code
      city = r.city
      region = r.region
      source = ctx.source === 'search' ? 'search' : 'gps'
    } catch {
      /* fall back below */
    }
  }
  if (!code && ctx.countryHint) {
    code = ctx.countryHint
    source = 'hint'
    if (ctx.placeName) city = ctx.placeName
  }
  if (!code) {
    const cached = await get<{ code: string; city: string | null }>('last', db).catch(() => undefined)
    if (cached) {
      code = cached.code
      city = cached.city
      source = 'cache'
    }
  }
  if (!code) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    code = TZ_COUNTRY[tz] ?? null
    source = code ? 'timezone' : 'none'
  }

  const country = getCountry(code) ?? (code ? { ...FALLBACK_COUNTRY, code, name: code } : FALLBACK_COUNTRY)
  const changed = country.code !== prev.code
  api.publish({ country, countrySource: source, city, region })
  if (country.code !== 'XX') set('last', { code: country.code, city }, db).catch(() => {})

  if (changed) {
    const hadCountry = prev.code !== 'XX'
    announce(api, country, !hadCountry, ctx.source === 'search')
    lastMedical = null // new country, refresh medical
  }
}

async function refreshMedical(api: AgentApi<SafetyState>, force = false) {
  const ctx = api.context()
  if (!ctx?.coords || !ctx.online) return api.state().medical
  const moved = lastMedical ? distance(lastMedical, ctx.coords) : Infinity
  if (!force && moved < 1000 && Date.now() - (lastMedical?.at ?? 0) < 15 * 60_000) return api.state().medical
  lastMedical = { ...ctx.coords, at: Date.now() }
  const places = await api.tool('places.nearby', { lat: ctx.coords.lat, lng: ctx.coords.lng, radius: 3000, kinds: ['hospital', 'pharmacy'], limit: 30 })
  const medical = places
    .map((p) => ({ ...p, distance: distance(ctx.coords!, p) }))
    .filter((p) => p.openNow !== false)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
  api.publish({ medical, medicalAt: Date.now() })
  return medical
}

function situational(api: AgentApi<SafetyState>) {
  const ctx = api.context()
  if (!ctx) return
  const w = ctx.weather
  const country = api.state().country
  if (w && w.tempC >= 35) {
    api.emit({
      key: 'safety-weather',
      kind: 'alert',
      priority: 2,
      ttl: 3 * 3600_000,
      title: msg('agents.safety.heatTitle', { temp: { t: 'temp', c: w.tempC } }),
      body: msg('agents.safety.heatBody'),
    })
  } else if (w?.kind === 'thunder') {
    api.emit({
      key: 'safety-weather',
      kind: 'alert',
      priority: 2,
      ttl: 2 * 3600_000,
      title: msg('agents.safety.stormTitle'),
      body: msg('agents.safety.stormBody'),
    })
  } else api.retract('safety-weather')

  const h = localHour(ctx)
  if (h >= 23 || h < 5) {
    api.emit({
      key: 'safety-night',
      kind: 'info',
      priority: 0,
      ttl: 2 * 3600_000,
      title: msg('agents.safety.nightTitle'),
      body: msg(country.tourist ? 'agents.safety.nightBodyTourist' : 'agents.safety.nightBody', { n: country.tourist ?? country.police }),
      action: { label: msg('actions.sos'), type: 'sos' },
    })
  } else api.retract('safety-night')
}

defineAgent<SafetyState>({
  name: 'safety',
  initialState: { country: FALLBACK_COUNTRY, countrySource: 'none', city: null, region: null, medical: [], medicalAt: 0 },
  init: async (api) => {
    const cached = await get<{ code: string; city: string | null }>('last', db).catch(() => undefined)
    const c = cached && COUNTRIES[cached.code]
    if (c) api.publish({ country: c, countrySource: 'cache', city: cached.city })
  },
  onContext: async (_ctx, _prev, api) => {
    await resolveCountry(api)
    situational(api)
    await refreshMedical(api).catch(() => {})
  },
  tasks: {
    medical: (_: never, api) => refreshMedical(api, true),
    embassies: async (p: { homeCountry: string }, api) => {
      const ctx = api.context()
      if (!ctx?.coords) return []
      const home = getCountry(p.homeCountry)
      const places = await api.tool('places.nearby', { lat: ctx.coords.lat, lng: ctx.coords.lng, radius: 25_000, kinds: ['embassy'], limit: 40 })
      const name = home?.name.toLowerCase() ?? ''
      const adjectives: Record<string, string[]> = {
        US: ['american', 'united states', 'u.s.'], GB: ['british', 'united kingdom', 'uk'], DE: ['german', 'deutsch'], FR: ['french', 'france'],
        AU: ['australian'], CA: ['canadian'], NL: ['dutch', 'netherlands'], ES: ['spanish', 'españa'], IT: ['italian', 'italia'],
        IE: ['irish'], NZ: ['new zealand'], JP: ['japanese', 'japan'], IN: ['indian'], CN: ['chinese'], KR: ['korean'], BR: ['brazil'],
        CH: ['swiss'], SE: ['swedish'], NO: ['norwegian'], DK: ['danish'], FI: ['finnish'], PL: ['polish'], PT: ['portuguese'],
      }
      const needles = [name, ...(adjectives[p.homeCountry] ?? [])].filter(Boolean)
      return places
        .map((pl) => ({ ...pl, distance: distance(ctx.coords!, pl), match: needles.some((n) => pl.name.toLowerCase().includes(n)) }))
        .sort((a, b) => Number(b.match) - Number(a.match) || a.distance - b.distance)
        .slice(0, 10)
    },
  },
})
