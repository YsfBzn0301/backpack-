/**
 * Minimal OSM `opening_hours` evaluator, enough for parking rules:
 *   "24/7", "Mo-Fr 08:00-18:00; Sa 09:00-14:00", "Mo-Sa 18:00-08:00; Su",
 *   "(Mo-Fr 07:00-19:00)", "Mo,We 10:00-12:00,14:00-16:00", "Su off".
 * Later rules override earlier ones for the same day, as in OSM.
 * Unsupported syntax (holidays, months, sunrise…) is ignored, not guessed.
 */

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

interface Rule {
  days: boolean[] // index 0 = Monday
  ranges: [number, number][] // minutes since midnight; end may be < start (overnight)
  off: boolean
}

const cache = new Map<string, Rule[] | null>()

function parseDays(token: string): boolean[] | null {
  const out = Array(7).fill(false)
  for (const part of token.split(',')) {
    const m = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/)
    if (!m) return null
    const a = DAYS.indexOf(m[1] as (typeof DAYS)[number])
    const b = m[2] ? DAYS.indexOf(m[2] as (typeof DAYS)[number]) : a
    for (let i = a; ; i = (i + 1) % 7) {
      out[i] = true
      if (i === b) break
    }
  }
  return out
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function parseHours(spec: string): Rule[] | null {
  const key = spec.trim()
  if (cache.has(key)) return cache.get(key)!
  let src = key.replace(/^\(|\)$/g, '').trim()
  if (src === '24/7') src = 'Mo-Su 00:00-24:00'
  const rules: Rule[] = []
  for (const raw of src.split(/\s*;\s*/)) {
    const r = raw.trim()
    if (!r) continue
    if (/\b(PH|SH|sunrise|sunset|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week)\b/.test(r) && !/^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(r)) continue
    const m = r.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/)
    if (!m) continue
    const days = m[1] ? parseDays(m[1].replace(/,$/, '')) : Array(7).fill(true)
    if (!days) continue
    const rest = (m[2] ?? '').replace(/,?\s*PH\s*(off)?/g, '').trim()
    if (rest === 'off' || rest === 'closed') {
      rules.push({ days, ranges: [], off: true })
      continue
    }
    if (!rest) {
      rules.push({ days, ranges: [[0, 1440]], off: false })
      continue
    }
    const ranges: [number, number][] = []
    for (const span of rest.split(',')) {
      const t = span.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\+?$/)
      if (t) ranges.push([toMin(t[1]), toMin(t[2])])
    }
    if (ranges.length) rules.push({ days, ranges, off: false })
  }
  const result = rules.length ? rules : null
  cache.set(key, result)
  return result
}

/** Weekday (0 = Monday) and minute-of-day at a location. */
export function localParts(ts: number, offsetSec: number) {
  const d = new Date(ts + offsetSec * 1000)
  return { dow: (d.getUTCDay() + 6) % 7, min: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

function rangesFor(rules: Rule[], dow: number) {
  let ranges: [number, number][] = []
  for (const r of rules) if (r.days[dow]) ranges = r.off ? [] : r.ranges
  return ranges
}

/** Is the window active at this moment? undefined when the spec can't be read. */
export function inWindow(spec: string | undefined, ts: number, offsetSec: number): boolean | undefined {
  if (!spec) return undefined
  const rules = parseHours(spec)
  if (!rules) return undefined
  const { dow, min } = localParts(ts, offsetSec)
  for (const [a, b] of rangesFor(rules, dow)) {
    if (a <= b ? min >= a && min < b : min >= a) return true
  }
  // Overnight ranges that started yesterday.
  for (const [a, b] of rangesFor(rules, (dow + 6) % 7)) if (a > b && min < b) return true
  return false
}

/** Minutes until the window flips state (scans up to 7 days in 5-minute steps). */
export function minutesUntilChange(spec: string | undefined, ts: number, offsetSec: number): number | undefined {
  const now = inWindow(spec, ts, offsetSec)
  if (now === undefined) return undefined
  for (let m = 5; m <= 7 * 1440; m += 5) if (inWindow(spec, ts + m * 60_000, offsetSec) !== now) return m
  return undefined
}

/** Local wall-clock "HH:MM" a number of minutes from now. */
export function clockIn(minutes: number, ts: number, offsetSec: number) {
  const d = new Date(ts + minutes * 60_000 + offsetSec * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
