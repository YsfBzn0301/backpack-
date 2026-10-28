import { describe, expect, it } from 'vitest'
import { lotFromOsm, parseCharge, parseDuration, parseHeight } from '@/services/parking-parse'
import { estimateParking, parkingNow } from '@/lib/parking-cost'

// Wed 2026-10-28 13:00 UTC (offset 0 unless stated)
const WED13 = Date.UTC(2026, 9, 28, 13, 0)
const SUN10 = Date.UTC(2026, 10, 1, 10, 0)
const at = (d: number, h: number) => Date.UTC(2026, 9, d, h, 0)
const lot = (tags: Record<string, string>) => lotFromOsm({ id: 1, type: 'way', center: { lat: 0, lon: 0 }, tags: { amenity: 'parking', ...tags } }, 'EUR')!

describe('OSM tag parsing', () => {
  it('reads charges in common formats', () => {
    expect(parseCharge('3 EUR/hour; 25 EUR/day', 'EUR').map((r) => [r.amount, r.unitMin])).toEqual([[3, 60], [25, 1440]])
    expect(parseCharge('1,50 €/h', 'USD').map((r) => [r.amount, r.currency, r.unitMin])).toEqual([[1.5, 'EUR', 60]])
    expect(parseCharge('EUR 0.50/30 minutes', 'USD').map((r) => [r.amount, r.unitMin])).toEqual([[0.5, 30]])
    expect(parseCharge('3 €', 'EUR')[0].unitMin).toBe(0)
    expect(parseCharge('4 EUR/hour @ (Mo-Fr 08:00-18:00)', 'EUR')[0].when).toBe('(Mo-Fr 08:00-18:00)')
  })
  it('reads durations and heights', () => {
    expect([parseDuration('2 hours'), parseDuration('90 min'), parseDuration('1:30'), parseDuration('2h')]).toEqual([120, 90, 90, 120])
    expect([parseHeight('2.1'), parseHeight('2,10 m'), parseHeight('6\'8"')]).toEqual([2.1, 2.1, 2.03])
  })
  it('skips private lots and reads payment methods', () => {
    expect(lotFromOsm({ id: 9, type: 'way', center: { lat: 0, lon: 0 }, tags: { amenity: 'parking', access: 'private' } }, 'EUR')).toBeNull()
    expect(lot({ 'payment:app': 'yes', 'payment:coins': 'yes', 'payment:credit_cards': 'yes' }).payment).toEqual(['app', 'coins', 'card'])
  })
})

describe('parking cost model', () => {
  const street = lot({ parking: 'street_side', fee: 'yes', charge: '2 EUR/hour', 'fee:conditional': 'no @ (Mo-Sa 20:00-09:00; Su)', maxstay: '2 hours' })
  const garage = lot({ parking: 'multi-storey', charge: '3 EUR/hour; 25 EUR/day', opening_hours: '24/7' })
  const surcharge = lot({ parking: 'underground', charge: '2 EUR/hour', 'charge:conditional': '4 EUR/hour @ (Mo-Fr 08:00-18:00)', opening_hours: 'Mo-Sa 07:00-22:00' })

  it('applies free windows', () => {
    expect(estimateParking(street, WED13, 120, 0).total).toBe(4)
    expect(estimateParking(street, at(28, 19), 120, 0).total).toBe(2)
    expect(estimateParking(street, SUN10, 120, 0).total).toBe(0)
  })
  it('flags overstays and knows when it turns free', () => {
    expect(estimateParking(street, WED13, 180, 0).exceedsMaxStay).toBe(true)
    const now = parkingNow(street, WED13, 0)
    expect([now.freeNow, now.freeChangeIn]).toEqual([false, 420])
  })
  it('bills started hours and caps at the daily rate', () => {
    expect(estimateParking(garage, WED13, 20, 0).total).toBe(3)
    expect(estimateParking(garage, WED13, 120, 0).total).toBe(6)
    const long = estimateParking(garage, WED13, 600, 0)
    expect([long.total, long.dailyCapped]).toEqual([25, true])
  })
  it('detects surcharge hours and closing times', () => {
    const e = estimateParking(surcharge, WED13, 120, 0)
    expect(e.total).toBe(8)
    expect(e.surcharge?.perHour).toBe(4)
    expect(estimateParking(surcharge, at(28, 17), 120, 0).total).toBe(6)
    expect(estimateParking(surcharge, at(28, 21), 120, 0).closesDuringStay).toBe(true)
    expect(parkingNow(surcharge, SUN10, 0).open).toBe(false)
  })
  it('says "unknown" instead of guessing', () => {
    expect(estimateParking(lot({ parking: 'surface' }), WED13, 60, 0).total).toBeNull()
    expect(estimateParking(lot({ fee: 'yes' }), WED13, 60, 0).total).toBeNull()
    const free = lot({ fee: 'no', maxstay: '2 hours', parking_disc: 'yes' })
    expect([estimateParking(free, WED13, 60, 0).total, free.disc]).toEqual([0, true])
  })
})
