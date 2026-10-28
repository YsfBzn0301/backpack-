export function formatMoney(value: number, currency: string, opts: { compact?: boolean } = {}) {
  if (!Number.isFinite(value)) return '—'
  try {
    const zeroDecimal = Math.abs(value) >= 1000 || ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'HUF', 'COP', 'LAK', 'KHR', 'UGX'].includes(currency)
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: zeroDecimal ? 0 : 2,
      minimumFractionDigits: zeroDecimal ? 0 : value % 1 === 0 ? 0 : 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: number, max = 2) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(value)
}

/** Local wall-clock time for a UTC offset in seconds. */
export function timeAtOffset(offsetSec: number, date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000
  return new Date(utc + offsetSec * 1000)
}

export function formatClock(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
