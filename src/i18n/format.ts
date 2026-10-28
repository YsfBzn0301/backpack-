/** Locale-aware formatting for the current UI language (Intl under the hood). */
import i18n from 'i18next'
import { settings } from '@/lib/settings'

const REGION: Record<string, string> = { en: 'en', de: 'de-DE', tr: 'tr-TR', ru: 'ru-RU' }

/** UI language, with the device's region when it matches (en-GB keeps 24h clocks). */
export function loc() {
  const l = settings.get().uiLang
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return nav.toLowerCase().startsWith(l) ? nav : REGION[l]
}

const ZERO_DEC = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'HUF', 'COP', 'LAK', 'KHR', 'UGX', 'ISK']

export function fmtMoney(value: number, currency: string, opts: { compact?: boolean } = {}) {
  if (!Number.isFinite(value)) return '—'
  try {
    const zero = Math.abs(value) >= 1000 || ZERO_DEC.includes(currency)
    return new Intl.NumberFormat(loc(), {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: zero ? 0 : 2,
      minimumFractionDigits: zero ? 0 : value % 1 === 0 ? 0 : 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export const fmtNumber = (value: number, max = 2) => new Intl.NumberFormat(loc(), { maximumFractionDigits: max }).format(value)

export const fmtClock = (d: Date) => d.toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' })

/** Wall-clock time at a location (ts in ms, UTC offset in seconds). */
export const fmtTimeAt = (ts: number, offsetSec: number) =>
  new Date(ts + offsetSec * 1000).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  const t = i18n.t.bind(i18n)
  if (h >= 24 && m === 0 && h % 24 === 0) return t('units.days', { count: h / 24 })
  if (!h) return t('units.min', { n: m })
  if (!m) return t('units.h', { n: h })
  return `${t('units.h', { n: h })} ${t('units.min', { n: m })}`
}

export function fmtDistance(m: number, units = settings.get().units) {
  const f = (v: number, unit: string, digits: number) => new Intl.NumberFormat(loc(), { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: digits }).format(v)
  if (units === 'imperial') {
    const ft = m * 3.28084
    return ft < 1000 ? f(Math.round(ft / 10) * 10, 'foot', 0) : f(m / 1609.34, 'mile', 1)
  }
  return m < 1000 ? f(Math.round(m / 10) * 10, 'meter', 0) : f(m / 1000, 'kilometer', 1)
}

export function fmtTemp(c: number, units = settings.get().units, withUnit = true) {
  const v = Math.round(units === 'imperial' ? (c * 9) / 5 + 32 : c)
  return withUnit ? `${v}°${units === 'imperial' ? 'F' : 'C'}` : `${v}°`
}

export function relativeTime(ts: number) {
  const rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' })
  const s = Math.round((ts - Date.now()) / 1000)
  if (Math.abs(s) < 45) return rtf.format(0, 'second')
  const m = Math.round(s / 60)
  if (Math.abs(m) < 60) return rtf.format(m, 'minute')
  const h = Math.round(m / 60)
  if (Math.abs(h) < 24) return rtf.format(h, 'hour')
  return rtf.format(Math.round(h / 24), 'day')
}

const displayNames = new Map<string, Intl.DisplayNames>()
function dn(type: 'region' | 'language') {
  const key = `${loc()}|${type}`
  if (!displayNames.has(key)) displayNames.set(key, new Intl.DisplayNames([loc()], { type }))
  return displayNames.get(key)!
}

export function countryName(code: string, fallback?: string) {
  if (!code || code === 'XX') return fallback ?? i18n.t('common.unknownPlace')
  try {
    return dn('region').of(code.toUpperCase()) ?? fallback ?? code
  } catch {
    return fallback ?? code
  }
}

export function langName(code: string) {
  try {
    const n = dn('language').of(code === 'tl' ? 'fil' : code) ?? code
    return n.charAt(0).toLocaleUpperCase(loc()) + n.slice(1)
  } catch {
    return code.toUpperCase()
  }
}

/** Capitalise the first letter for labels ("café" → "Café"). */
export const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase(loc()) + s.slice(1) : s)

export const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(loc(), opts)

/** "Mo-Sa 18:00-08:00; Su" → localised weekday names ("Mo–Sa" / "Pzt–Cmt" / "Пн–Сб"). */
export function fmtHoursSpec(spec: string) {
  if (spec.trim() === '24/7') return i18n.t('parking.always')
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  const names = days.map((_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(loc(), { weekday: 'short', timeZone: 'UTC' }).replace('.', ''))
  return spec
    .replace(/^\(|\)$/g, '')
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => names[days.indexOf(d)])
    .replace(/\boff\b/g, i18n.t('parking.closedWord'))
    .replace(/-(?=\D)/g, '–')
    .replace(/\s*;\s*/g, ' · ')
}
