import { describe, expect, it } from 'vitest'
import { inWindow, minutesUntilChange } from '@/lib/hours'

const WED13 = Date.UTC(2026, 9, 28, 13, 0)
const SAT21 = Date.UTC(2026, 9, 31, 21, 0)
const SUN10 = Date.UTC(2026, 10, 1, 10, 0)

describe('opening_hours subset', () => {
  it('handles 24/7, weekdays and day-only rules', () => {
    expect(inWindow('24/7', WED13, 0)).toBe(true)
    expect(inWindow('Mo-Fr 08:00-18:00', WED13, 0)).toBe(true)
    expect(inWindow('Mo-Fr 08:00-18:00', SUN10, 0)).toBe(false)
    expect(inWindow('Mo-Sa 20:00-09:00; Su', SUN10, 0)).toBe(true)
  })
  it('handles overnight ranges, off and parentheses', () => {
    expect(inWindow('Mo-Sa 20:00-09:00; Su', SAT21, 0)).toBe(true)
    expect(inWindow('Mo-Sa 20:00-09:00', Date.UTC(2026, 9, 29, 7, 0), 0)).toBe(true)
    expect(inWindow('Mo-Su 08:00-20:00; Su off', SUN10, 0)).toBe(false)
    expect(inWindow('(Mo-Fr 07:00-19:00)', WED13, 0)).toBe(true)
  })
  it('respects the location UTC offset', () => {
    expect(inWindow('Mo-Fr 14:00-16:00', WED13, 7200)).toBe(true)
  })
  it('computes time to the next change and refuses unknown syntax', () => {
    expect(minutesUntilChange('Mo-Fr 08:00-18:00', WED13, 0)).toBe(300)
    expect(inWindow('sunrise-sunset', WED13, 0)).toBeUndefined()
  })
})
