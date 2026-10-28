/**
 * OpenStreetMap parking tags → ParkingLot. Pure functions (no network) so they
 * can be unit-tested and reused for any provider that speaks OSM tags.
 *
 * Tags read: parking, fee, fee:conditional, charge, charge:conditional,
 * maxstay, maxstay:conditional, capacity, capacity:disabled,
 * capacity:charging, maxheight, opening_hours, payment:*, access, operator.
 */
import type { ParkingLot, ParkingRate, ParkingType } from '@/agents/protocol'

const SYMBOL_CUR: Record<string, string> = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '₺': 'TRY', '₽': 'RUB', 'zł': 'PLN', 'kč': 'CZK', 'fr': 'CHF', 'chf': 'CHF', 'kr': 'SEK', 'ft': 'HUF' }

function unitMinutes(unit: string | undefined): number | null {
  if (!unit) return 0
  const u = unit.toLowerCase().trim()
  const n = parseFloat(u) || 1
  if (/^(\d+\s*)?(h|hr|hrs|hour|hours|std|stunde)$/.test(u)) return n * 60
  if (/^(\d+\s*)?(min|mins|minute|minutes|m)$/.test(u)) return n
  if (/^(\d+\s*)?(d|day|days|tag|24\s*h|24h)$/.test(u)) return u.includes('24') ? 1440 : n * 1440
  if (/^(\d+\s*)?(week|weeks|w)$/.test(u)) return n * 10080
  if (/^(\d+\s*)?(month|months)$/.test(u)) return n * 43200
  if (/^(\d+\s*)?(night|overnight)$/.test(u)) return 720
  if (/^(\d+\s*)?(visit|entry|stay)$/.test(u)) return 0
  return null
}

/** "2 EUR/hour", "EUR 1.50/30 minutes", "1,50 €/h", "3 €", "12 EUR/day". */
export function parseCharge(raw: string, fallbackCurrency: string): ParkingRate[] {
  const out: ParkingRate[] = []
  for (const part0 of raw.split(/\s*;\s*/)) {
    const [part, cond] = part0.split(/\s*@\s*/)
    const m =
      part.match(/^\s*([A-Z]{3}|[€$£¥₺₽])?\s*(\d+(?:[.,]\d+)?)\s*([A-Z]{3}|[€$£¥₺₽]|zł|kč|kr|ft|chf|fr)?\s*(?:\/|per\s+)?\s*([\w\s]*)$/i) ?? null
    if (!m) continue
    const amount = parseFloat(m[2].replace(',', '.'))
    if (!Number.isFinite(amount)) continue
    const curRaw = (m[1] || m[3] || '').toLowerCase()
    const currency = curRaw.length === 3 && /^[a-z]{3}$/.test(curRaw) ? curRaw.toUpperCase() : (SYMBOL_CUR[curRaw] ?? fallbackCurrency)
    const unit = unitMinutes(m[4]?.trim() || undefined)
    if (unit === null) continue
    out.push({ amount, currency, unitMin: unit, when: cond?.trim() || undefined })
  }
  return out
}

/** "2 hours", "90 min", "1:30", "2h" → minutes. */
export function parseDuration(raw: string): number | undefined {
  const s = raw.trim().toLowerCase()
  const hm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) return +hm[1] * 60 + +hm[2]
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|min|mins|minute|minutes|day|days|d)?$/)
  if (!m) return undefined
  const n = parseFloat(m[1].replace(',', '.'))
  const u = m[2] ?? 'min'
  if (u.startsWith('h')) return Math.round(n * 60)
  if (u.startsWith('d')) return Math.round(n * 1440)
  return Math.round(n)
}

/** Split "a @ (when); b @ (when2)" and return the "when" of the value we want. */
function conditionalWhen(raw: string | undefined, value: RegExp) {
  if (!raw) return undefined
  const hits = raw
    .split(/;\s*(?=[^()]*(?:\(|$))/)
    .map((p) => p.split(/\s*@\s*/))
    .filter(([v, w]) => w && value.test(v.trim()))
    .map(([, w]) => w.trim().replace(/^\(|\)$/g, ''))
  return hits.length ? hits.join('; ') : undefined
}

/** "2.1", "2.10 m", "6'8\"" → metres. */
export function parseHeight(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const ft = raw.match(/(\d+)'\s*(\d+)?/)
  if (ft) return Math.round((+ft[1] * 0.3048 + (+(ft[2] ?? 0)) * 0.0254) * 100) / 100
  const m = parseFloat(raw.replace(',', '.'))
  return Number.isFinite(m) && m > 0.5 && m < 10 ? m : undefined
}

const TYPE: Record<string, ParkingType> = {
  'multi-storey': 'garage',
  underground: 'underground',
  surface: 'surface',
  street_side: 'street',
  lane: 'street',
  on_kerb: 'street',
  half_on_kerb: 'street',
  layby: 'street',
  rooftop: 'rooftop',
  garage_boxes: 'garage',
  carports: 'surface',
}

const countish = (v: string | undefined): number | boolean | undefined => {
  if (!v) return undefined
  if (v === 'yes') return true
  if (v === 'no' || v === '0') return false
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

export function lotFromOsm(
  el: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> },
  localCurrency: string,
): ParkingLot | null {
  const t = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null
  if (t.access === 'private' || t.access === 'no' || t.access === 'permit') return null

  const rates = [...parseCharge(t.charge ?? '', localCurrency), ...parseCharge(t['charge:conditional'] ?? '', localCurrency)]
  const fee = t.fee === 'yes' ? true : t.fee === 'no' ? false : rates.length ? true : null

  const freeWhen = conditionalWhen(t['fee:conditional'], /^no$/i)
  const paidWhen = conditionalWhen(t['fee:conditional'], /^yes$/i)
  // "Free first 30 minutes" is often tagged as a 0-charge entry with a duration.
  const freeFirst = t['fee:conditional']?.match(/no\s*@\s*\(?\s*stay\s*<\s*(\d+\s*\w+)/i)?.[1]
  const maxStayWhen = t['maxstay:conditional']?.split('@')[1]?.trim().replace(/^\(|\)$/g, '')
  const maxStayRaw = t.maxstay ?? t['maxstay:conditional']?.split('@')[0]
  const discTags = Object.entries(t).some(([k, v]) => /disc/.test(k) && v !== 'no') || /disc/.test(t['parking:condition'] ?? '')

  const payment: ParkingLot['payment'] = []
  const pay = (k: string) => t[`payment:${k}`] === 'yes'
  if (pay('app') || pay('mobile_phone') || Object.keys(t).some((k) => /^payment:(easypark|parknow|paybyphone|flowbird|parkmobile|ringgo|telpark|elpark)/.test(k))) payment.push('app')
  if (pay('coins')) payment.push('coins')
  if (pay('notes') || pay('cash')) payment.push('cash')
  if (pay('credit_cards') || pay('debit_cards') || pay('visa') || pay('mastercard') || pay('cards')) payment.push('card')
  if (pay('contactless')) payment.push('contactless')
  if (t.vending === 'parking_tickets' || pay('ticket') || t['payment:machine'] === 'yes') payment.push('machine')

  const type = TYPE[t.parking ?? ''] ?? (t.building === 'parking' ? 'garage' : 'unknown')
  return {
    id: `osm-${el.type}-${el.id}`,
    name: t['name:en'] || t.name || t.operator || '',
    lat,
    lng,
    source: 'osm',
    type,
    fee,
    rates,
    freeWhen,
    paidWhen,
    freeFirstMin: freeFirst ? parseDuration(freeFirst) : undefined,
    maxStayMin: maxStayRaw ? parseDuration(maxStayRaw) : undefined,
    maxStayWhen,
    disc: discTags || undefined,
    capacity: parseInt(t.capacity ?? '', 10) || undefined,
    ev: countish(t['capacity:charging'] ?? t['capacity:ev']),
    disabled: countish(t['capacity:disabled']),
    maxHeightM: parseHeight(t.maxheight),
    payment,
    hours: t.opening_hours,
    customersOnly: t.access === 'customers' || undefined,
    operator: t.operator,
    website: t.website || t['contact:website'],
    address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || undefined,
  }
}
