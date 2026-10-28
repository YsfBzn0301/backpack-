/**
 * BudgetAgent — currency & expense intelligence.
 * Keeps an offline FX table fresh, converts, splits bills, categorises
 * expenses, reads prices from OCR text and flags tourist pricing.
 */
import { get, set, createStore } from 'idb-keyval'
import { defineAgent, fetchJson, type AgentApi } from './runtime'
import { SEED_RATES } from '@/data/currencies'
import { getCountry } from '@/data/countries'
import { BENCH_KEYWORDS, BENCH_LABELS, benchmarkFor, type BenchItem } from '@/data/benchmarks'

export interface RatesSnapshot {
  base: 'USD'
  rates: Record<string, number>
  fetchedAt: number
  source: 'seed' | 'exchangerate-api' | 'openexchangerates'
}

export interface BudgetState {
  fx: RatesSnapshot
  localCurrency: string | null
  syncing: boolean
  lastError: string | null
  oxrAppId: string
}

export type ExpenseCategory = 'food' | 'transport' | 'stay' | 'activities' | 'shopping' | 'health' | 'connectivity' | 'other'

export interface PriceCheck {
  item: BenchItem | null
  itemLabel?: string
  verdict: 'low' | 'fair' | 'high' | 'steep' | 'unknown'
  ratio?: number
  typicalLocal?: number
  currency: string
  message: string
}

const db = createStore('backpack-budget', 'kv')
const STALE_MS = 12 * 3600_000

const seed: RatesSnapshot = { base: 'USD', rates: SEED_RATES, fetchedAt: 0, source: 'seed' }

export function convert(fx: RatesSnapshot, amount: number, from: string, to: string) {
  const a = fx.rates[from]
  const b = fx.rates[to]
  if (!a || !b) return NaN
  return (amount / a) * b
}

async function sync(api: AgentApi<BudgetState>, force = false) {
  const s = api.state()
  if (s.syncing) return s.fx
  if (!force && Date.now() - s.fx.fetchedAt < STALE_MS) return s.fx
  if (!api.context()?.online && api.context() !== null) return s.fx
  api.publish({ syncing: true })
  try {
    let snap: RatesSnapshot
    if (s.oxrAppId) {
      const r = await fetchJson<{ rates: Record<string, number>; timestamp: number }>(`https://openexchangerates.org/api/latest.json?app_id=${s.oxrAppId}`)
      snap = { base: 'USD', rates: r.rates, fetchedAt: Date.now(), source: 'openexchangerates' }
    } else {
      const r = await fetchJson<{ result: string; rates: Record<string, number> }>('https://open.er-api.com/v6/latest/USD')
      if (r.result !== 'success') throw new Error('rate provider error')
      snap = { base: 'USD', rates: r.rates, fetchedAt: Date.now(), source: 'exchangerate-api' }
    }
    // Keep seed values for any currency the provider dropped.
    snap.rates = { ...SEED_RATES, ...snap.rates }
    await set('fx', snap, db)
    api.publish({ fx: snap, syncing: false, lastError: null })
    return snap
  } catch (err) {
    api.publish({ syncing: false, lastError: err instanceof Error ? err.message : String(err) })
    return s.fx
  }
}

const CATEGORY_RULES: [ExpenseCategory, RegExp][] = [
  ['food', /food|eat|lunch|dinner|breakfast|brunch|coffee|cafe|beer|drink|bar|restaurant|snack|noodle|pho|pad thai|market|water|juice|tea|bakery|grocer|7-?eleven/i],
  ['transport', /taxi|grab|uber|bolt|bus|train|metro|subway|tuk|ferry|boat|flight|plane|scooter|bike|fuel|petrol|gas|toll|ticket|transfer|ride/i],
  ['stay', /hostel|hotel|dorm|guesthouse|airbnb|room|night|camp|homestay|bed/i],
  ['activities', /tour|museum|temple|entry|entrance|park|dive|trek|hike|class|massage|show|cinema|activity|guide|kayak/i],
  ['shopping', /souvenir|clothes|shirt|shop|market|gift|sandals|bag|pharmacy item/i],
  ['health', /pharmacy|doctor|clinic|hospital|medicine|pill|insurance|sunscreen|repellent/i],
  ['connectivity', /sim|esim|data|wifi|top-?up|phone|charger/i],
]

export function categorize(text: string): ExpenseCategory {
  for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat
  return 'other'
}

function benchItem(text: string): BenchItem | null {
  for (const [item, re] of Object.entries(BENCH_KEYWORDS) as [BenchItem, RegExp][]) if (re.test(text)) return item
  return null
}

function priceCheck(fx: RatesSnapshot, p: { text: string; amount: number; currency: string; country?: string | null }): PriceCheck {
  const item = benchItem(p.text)
  if (!item) return { item: null, verdict: 'unknown', currency: p.currency, message: 'No benchmark for this item yet.' }
  const usd = convert(fx, p.amount, p.currency, 'USD')
  const typicalUsd = benchmarkFor(p.country)[item]
  const typicalLocal = convert(fx, typicalUsd, 'USD', p.currency)
  const ratio = usd / typicalUsd
  const country = getCountry(p.country)?.name ?? 'this region'
  const verdict: PriceCheck['verdict'] = ratio < 0.7 ? 'low' : ratio <= 1.35 ? 'fair' : ratio <= 2 ? 'high' : 'steep'
  const pct = Math.round((ratio - 1) * 100)
  const message =
    verdict === 'fair'
      ? `About normal for ${country}.`
      : verdict === 'low'
        ? `Cheaper than usual for ${country}. Good find.`
        : `${pct}% above the usual ${BENCH_LABELS[item].toLowerCase()} price in ${country}.${verdict === 'steep' ? ' Worth bargaining or walking a block.' : ''}`
  return { item, itemLabel: BENCH_LABELS[item], verdict, ratio, typicalLocal, currency: p.currency, message }
}

const SYMBOLS: [RegExp, string][] = [
  [/฿|baht|thb/i, 'THB'], [/€|eur/i, 'EUR'], [/£|gbp/i, 'GBP'], [/¥|円|jpy|yen/i, 'JPY'], [/₫|vnd|\dđ|\d\sđ|\bdong\b/i, 'VND'],
  [/₩|krw|won/i, 'KRW'], [/₹|inr|rs\.?/i, 'INR'], [/rp\.?|idr/i, 'IDR'], [/rm|myr/i, 'MYR'], [/₱|php/i, 'PHP'],
  [/₺|try|tl\b/i, 'TRY'], [/r\$|brl/i, 'BRL'], [/aed|dhs?/i, 'AED'], [/chf/i, 'CHF'], [/us\$|usd|\$/i, 'USD'],
]

/** Pull candidate prices out of OCR text (menus, price tags, receipts). */
export function extractPrices(text: string, fallbackCurrency: string) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const out: { label: string; amount: number; currency: string }[] = []
  for (const line of lines) {
    const nums = [...line.matchAll(/(\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)/g)]
    if (!nums.length) continue
    const m = nums[nums.length - 1] // prices usually sit at the end of a line
    const whole = m[1].replace(/[.,\s]/g, '')
    const amount = parseFloat(m[2] ? `${whole}.${m[2]}` : whole)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) continue
    if (/^\d{4}$/.test(m[0]) && amount > 1900 && amount < 2100 && !/[฿€£¥$₫₩₹]/.test(line)) continue // years
    const currency = SYMBOLS.find(([re]) => re.test(line))?.[1] ?? fallbackCurrency
    const label = line.replace(m[0], '').replace(/[฿€£¥$₫₩₹đ:.\-–—]+/g, ' ').replace(/\s+/g, ' ').trim()
    out.push({ label: label || 'Item', amount, currency })
  }
  return out.slice(0, 30)
}

defineAgent<BudgetState>({
  name: 'budget',
  initialState: { fx: seed, localCurrency: null, syncing: false, lastError: null, oxrAppId: '' },
  init: async (api) => {
    const cached = await get<RatesSnapshot>('fx', db).catch(() => undefined)
    if (cached) api.publish({ fx: cached })
  },
  onContext: async (ctx, prev, api) => {
    if (ctx.online && (!prev || !prev.online || Date.now() - api.state().fx.fetchedAt > STALE_MS)) await sync(api)

    const country = getCountry(ctx.country ?? ctx.countryHint)
    if (country && country.currency !== api.state().localCurrency) {
      api.publish({ localCurrency: country.currency })
      if (country.currency !== ctx.homeCurrency) {
        const fx = api.state().fx
        const one = convert(fx, 1, ctx.homeCurrency, country.currency)
        api.emit({
          key: 'budget-local',
          kind: 'info',
          priority: 1,
          ttl: 12 * 3600_000,
          title: `Local currency: ${country.currency}`,
          body: `1 ${ctx.homeCurrency} ≈ ${one >= 100 ? Math.round(one).toLocaleString() : one.toFixed(2)} ${country.currency}. Converter switched over; rates are cached for offline use.`,
          action: { label: 'Convert', type: 'tab', payload: 'convert' },
        })
      }
    }
    if (!ctx.online && Date.now() - api.state().fx.fetchedAt > 3 * 24 * 3600_000) {
      api.emit({
        key: 'budget-stale',
        kind: 'alert',
        priority: 1,
        title: 'Exchange rates are getting old',
        body: 'You have been offline for a while. Conversions use the last saved rates.',
      })
    } else api.retract('budget-stale')
  },
  tasks: {
    rates: (_: never, api) => api.state().fx,
    sync: (_: never, api) => sync(api, true),
    configure: (p: { oxrAppId: string }, api) => api.publish({ oxrAppId: p.oxrAppId }),
    convert: (p: { amount: number; from: string; to: string }, api) => convert(api.state().fx, p.amount, p.from, p.to),
    split: (p: { total: number; currency: string; people: number; tipPct: number; taxPct: number; to: string }, api) => {
      const gross = p.total * (1 + p.taxPct / 100) * (1 + p.tipPct / 100)
      const each = gross / Math.max(1, p.people)
      return { gross, each, eachConverted: convert(api.state().fx, each, p.currency, p.to) }
    },
    categorize: (p: { text: string }) => categorize(p.text),
    check: (p: { text: string; amount: number; currency: string; country?: string | null }, api) => priceCheck(api.state().fx, p),
    extract: (p: { text: string; currency: string }, api) => {
      const ctx = api.context()
      return extractPrices(p.text, p.currency).map((price) => ({
        ...price,
        converted: convert(api.state().fx, price.amount, price.currency, ctx?.homeCurrency ?? 'USD'),
        check: priceCheck(api.state().fx, { text: price.label, amount: price.amount, currency: price.currency, country: ctx?.country ?? ctx?.countryHint }),
      }))
    },
  },
})
