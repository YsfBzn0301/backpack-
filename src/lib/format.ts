/** Locale-aware formatters live in @/i18n/format; re-exported here for convenience. */
export { fmtMoney as formatMoney, fmtNumber as formatNumber, fmtClock as formatClock, relativeTime } from '@/i18n/format'

/** Local wall-clock time for a UTC offset in seconds. */
export function timeAtOffset(offsetSec: number, date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000
  return new Date(utc + offsetSec * 1000)
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
