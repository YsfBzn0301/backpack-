import { describe, expect, it } from 'vitest'
import { isTab, resolveTabParam, swipeTarget, TABS } from '@/lib/nav'

describe('navigation', () => {
  it('has four anchor tabs, without kit', () => {
    expect(TABS).toEqual(['home', 'map', 'transit', 'convert'])
    expect(isTab('kit')).toBe(false)
  })
  it('maps legacy ?tab=kit to the Kit sheet', () => {
    expect(resolveTabParam('kit')).toEqual({ tab: 'home', kit: true })
    expect(resolveTabParam('transit')).toEqual({ tab: 'transit', kit: false })
    expect(resolveTabParam('nope')).toEqual({ tab: 'home', kit: false })
    expect(resolveTabParam(null)).toEqual({ tab: 'home', kit: false })
  })
  it('swipes between the four tabs and stops at the ends', () => {
    expect(swipeTarget('home', -100)).toBe('map')
    expect(swipeTarget('convert', -100)).toBeNull()
    expect(swipeTarget('home', 100)).toBeNull()
    expect(swipeTarget('convert', 100)).toBe('transit')
  })
})
