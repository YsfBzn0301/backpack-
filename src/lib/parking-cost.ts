/**
 * Parking cost & status model shared by ScoutAgent and BudgetAgent.
 * Prices come from tagged data, so every result says when it can't know.
 */
import type { ParkingLot, ParkingRate } from '@/agents/protocol'
import { inWindow, minutesUntilChange } from './hours'

const STEP = 5

export interface ParkingEstimate {
  /** null when the price can't be determined from the data. */
  total: number | null
  currency: string | null
  freeMin: number
  paidMin: number
  dailyCapped: boolean
  exceedsMaxStay: boolean
  closesDuringStay: boolean
  /** A pricier time-of-day rate overlaps the stay. */
  surcharge?: { perHour: number; basePerHour: number; when: string }
}

export interface RateSummary {
  perHour?: number
  perDay?: number
  flat?: number
  currency?: string
}

const perHour = (r: ParkingRate) => (r.unitMin > 0 ? (r.amount / r.unitMin) * 60 : undefined)
const isTimed = (r: ParkingRate) => r.unitMin > 0 && r.unitMin < 1440

export function summarizeRates(lot: ParkingLot): RateSummary {
  const base = lot.rates.filter((r) => !r.when)
  const pool = base.length ? base : lot.rates
  const timed = pool.find(isTimed)
  const day = lot.rates.find((r) => r.unitMin === 1440)
  const flat = lot.rates.find((r) => r.unitMin === 0)
  return { perHour: timed ? perHour(timed) : undefined, perDay: day?.amount, flat: flat?.amount, currency: (timed ?? day ?? flat)?.currency }
}

function isFreeAt(lot: ParkingLot, ts: number, off: number, elapsedMin: number) {
  if (lot.fee === false && !lot.paidWhen) return true
  if (lot.freeFirstMin && elapsedMin < lot.freeFirstMin) return true
  if (inWindow(lot.freeWhen, ts, off)) return true
  if (lot.paidWhen && inWindow(lot.paidWhen, ts, off) === false) return true
  return false
}

export function estimateParking(lot: ParkingLot, startTs: number, durationMin: number, off: number): ParkingEstimate {
  const base = lot.rates.filter((r) => !r.when)
  const conditional = lot.rates.filter((r) => r.when && isTimed(r))
  const timedBase = base.find(isTimed) ?? (base.length ? undefined : lot.rates.find((r) => isTimed(r) && !r.when))
  const flat = lot.rates.find((r) => r.unitMin === 0)
  const daily = lot.rates.find((r) => r.unitMin === 1440)
  const currency = lot.rates[0]?.currency ?? null
  const basePH = timedBase ? perHour(timedBase)! : undefined

  let freeMin = 0
  let paidMin = 0
  let closes = false
  let surcharge: ParkingEstimate['surcharge']
  const minutesByRate = new Map<ParkingRate, number>()
  let flatUsed = false
  let unpriced = false

  for (let m = 0; m < durationMin; m += STEP) {
    const ts = startTs + m * 60_000
    if (lot.hours && inWindow(lot.hours, ts, off) === false) closes = true
    if (isFreeAt(lot, ts, off, m)) {
      freeMin += STEP
      continue
    }
    paidMin += STEP
    const active = conditional.find((r) => inWindow(r.when, ts, off))
    const rate = active ?? timedBase
    if (rate) {
      minutesByRate.set(rate, (minutesByRate.get(rate) ?? 0) + STEP)
      if (active && basePH && perHour(active)! > basePH * 1.05 && !surcharge) surcharge = { perHour: perHour(active)!, basePerHour: basePH, when: active.when! }
    } else if (flat) flatUsed = true
    else if (daily) {
      /* priced below */
    } else unpriced = true
  }

  let total: number | null = 0
  minutesByRate.forEach((mins, r) => (total! += Math.ceil(mins / r.unitMin) * r.amount))
  if (flatUsed && flat) total += flat.amount
  let dailyCapped = false
  if (daily && paidMin > 0) {
    const cap = Math.ceil(durationMin / 1440) * daily.amount
    if (!minutesByRate.size && !flatUsed) total = cap
    else if (total > cap) {
      total = cap
      dailyCapped = true
    }
  }
  if (paidMin > 0 && (unpriced || (!minutesByRate.size && !flatUsed && !daily))) total = null
  if (lot.fee === null && !lot.rates.length) total = null

  const maxStayApplies = lot.maxStayMin != null && (lot.maxStayWhen ? inWindow(lot.maxStayWhen, startTs, off) !== false : true)
  return {
    total,
    currency: total === 0 && !currency ? null : currency,
    freeMin,
    paidMin,
    dailyCapped,
    exceedsMaxStay: Boolean(maxStayApplies && durationMin > lot.maxStayMin!),
    closesDuringStay: closes,
    surcharge,
  }
}

export interface ParkingNow {
  open?: boolean
  /** Minutes until the open/closed state flips. */
  openChangeIn?: number
  freeNow?: boolean
  freeChangeIn?: number
  maxStayNow?: number
}

export function parkingNow(lot: ParkingLot, ts: number, off: number): ParkingNow {
  const open = lot.state === 'closed' ? false : inWindow(lot.hours, ts, off)
  const freeNow = lot.fee === null && !lot.freeWhen ? undefined : isFreeAt(lot, ts, off, Infinity)
  const freeSpec = lot.freeWhen ?? lot.paidWhen
  const maxStayNow = lot.maxStayMin != null && (lot.maxStayWhen ? inWindow(lot.maxStayWhen, ts, off) !== false : true) ? lot.maxStayMin : undefined
  return {
    open,
    openChangeIn: lot.hours && lot.hours !== '24/7' ? minutesUntilChange(lot.hours, ts, off) : undefined,
    freeNow,
    freeChangeIn: freeSpec ? minutesUntilChange(freeSpec, ts, off) : undefined,
    maxStayNow,
  }
}
