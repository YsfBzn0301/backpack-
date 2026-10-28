/**
 * BudgetAgent — currency & expense intelligence.
 * Keeps an offline FX table fresh, converts, splits bills, categorises
 * expenses, reads prices from OCR text and flags tourist pricing.
 */
import { get, set, createStore } from 'idb-keyval'
import { defineAgent, fetchJson, type AgentApi } from './runtime'
import { SEED_RATES } from '@/data/currencies'
import { getCountry } from '@/data/countries'
import { BENCH_KEYWORDS, benchmarkFor, type BenchItem } from '@/data/benchmarks'
import { msg, type Msg } from './protocol'
import type { ParkingEstimate, RateSummary } from '@/lib/parking-cost'

export interface RatesSnapshot {
  base: 'USD'
  rates: Record<string, number>
  fetchedAt: number
  /** When the provider last updated its rates (falls back to fetchedAt). */
  rateAt?: number
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
  verdict: 'low' | 'fair' | 'high' | 'steep' | 'unknown'
  ratio?: number
  typicalLocal?: number
  currency: string
  message: Msg
}

export interface ParkingQuote {
  id: string
  home: string
  totalHome: number | null
  perHourHome?: number
  perDayHome?: number
  flatHome?: number
  verdict: 'free' | 'within' | 'over' | 'unknown'
  alerts: Msg[]
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
      snap = { base: 'USD', rates: r.rates, fetchedAt: Date.now(), rateAt: r.timestamp * 1000, source: 'openexchangerates' }
    } else {
      const r = await fetchJson<{ result: string; rates: Record<string, number>; time_last_update_unix?: number }>('https://open.er-api.com/v6/latest/USD')
      if (r.result !== 'success') throw new Error('rate provider error')
      snap = { base: 'USD', rates: r.rates, fetchedAt: Date.now(), rateAt: r.time_last_update_unix ? r.time_last_update_unix * 1000 : undefined, source: 'exchangerate-api' }
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
  if (!item) return { item: null, verdict: 'unknown', currency: p.currency, message: msg('money.verdictMsg.unknown') }
  const usd = convert(fx, p.amount, p.currency, 'USD')
  const typicalUsd = benchmarkFor(p.country)[item]
  const typicalLocal = convert(fx, typicalUsd, 'USD', p.currency)
  const ratio = usd / typicalUsd
  const country = getCountry(p.country) ? { t: 'country' as const, code: p.country! } : msg('money.thisRegion')
  const verdict: PriceCheck['verdict'] = ratio < 0.7 ? 'low' : ratio <= 1.35 ? 'fair' : ratio <= 2 ? 'high' : 'steep'
  const pct = Math.round((ratio - 1) * 100)
  const message = msg(`money.verdictMsg.${verdict}`, { country, pct, item: msg(`bench.${item}`) })
  return { item, verdict, ratio, typicalLocal, currency: p.currency, message }
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
          title: msg('agents.budget.localTitle', { cur: country.currency }),
          body: msg('agents.budget.localBody', { home: { t: 'money', amount: 1, cur: ctx.homeCurrency }, local: { t: 'money', amount: one, cur: country.currency } }),
          action: { label: msg('actions.convert'), type: 'tab', payload: 'convert' },
        })
      }
    }
    if (!ctx.online && Date.now() - api.state().fx.fetchedAt > 3 * 24 * 3600_000) {
      api.emit({
        key: 'budget-stale',
        kind: 'alert',
        priority: 1,
        title: msg('agents.budget.staleTitle'),
        body: msg('agents.budget.staleBody'),
      })
    } else api.retract('budget-stale')
  },
  tasks: {
    /**
     * Price parking estimates in home currency and check them against the
     * daily parking budget. With notify, also raises a surcharge alert.
     */
    parkingQuote: (
      p: { items: { id: string; name?: string; estimate: ParkingEstimate; rates: RateSummary }[]; stayMin: number; notify?: boolean },
      api,
    ): ParkingQuote[] => {
      const ctx = api.context()
      const home = ctx?.homeCurrency ?? 'USD'
      const budget = ctx?.parkingBudgetDaily ?? 0
      const fx = api.state().fx
      const conv = (v: number | undefined, cur: string | null | undefined) => (v == null || !cur ? undefined : convert(fx, v, cur, home))
      const out = p.items.map(({ id, name, estimate, rates }) => {
        const totalHome = estimate.total == null ? null : estimate.total === 0 ? 0 : (conv(estimate.total, estimate.currency) ?? null)
        // Scale the stay cost to a day so short stays compare fairly with a daily budget.
        const dayEquivalent = totalHome == null ? null : estimate.dailyCapped || p.stayMin >= 1440 ? totalHome / Math.ceil(p.stayMin / 1440) : totalHome
        const verdict: ParkingQuote['verdict'] = totalHome === 0 ? 'free' : dayEquivalent == null || !budget ? 'unknown' : dayEquivalent > budget ? 'over' : 'within'
        const alerts: Msg[] = []
        if (estimate.surcharge && rates.currency)
          alerts.push(
            msg('parking.alert.surcharge', {
              when: { t: 'hours', spec: estimate.surcharge.when },
              rate: { t: 'money', amount: conv(estimate.surcharge.perHour, rates.currency) ?? estimate.surcharge.perHour, cur: home },
              base: { t: 'money', amount: conv(estimate.surcharge.basePerHour, rates.currency) ?? estimate.surcharge.basePerHour, cur: home },
            }),
          )
        if (verdict === 'over' && totalHome != null) alerts.push(msg('parking.alert.overBudget', { amount: { t: 'money', amount: totalHome, cur: home }, budget: { t: 'money', amount: budget, cur: home } }))
        if (p.notify && estimate.surcharge && name)
          api.emit({ key: 'budget-parking-surcharge', kind: 'alert', priority: 2, ttl: 3 * 3600_000, title: msg('agents.budget.surchargeTitle', { name }), body: alerts[0] })
        return {
          id,
          home,
          totalHome,
          perHourHome: conv(rates.perHour, rates.currency),
          perDayHome: conv(rates.perDay, rates.currency),
          flatHome: conv(rates.flat, rates.currency),
          verdict,
          alerts,
        }
      })
      if (p.notify && !p.items.some((i) => i.estimate.surcharge)) api.retract('budget-parking-surcharge')
      return out
    },
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
