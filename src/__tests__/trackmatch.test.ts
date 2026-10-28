import { describe, expect, it } from 'vitest'
import { formatTime, initials, isMobileUA, spotifyDeepLink, tiltFromOrientation, trackHue } from '@/modules/audio/trackMatch'

describe('spotifyDeepLink', () => {
  it('opens the exact track when the id is known', () => {
    expect(spotifyDeepLink({ title: 'Bad Guy', artist: 'Billie Eilish', spotifyId: '2Fxmhks0bxGSBdJ92vM42m' })).toBe('spotify:track:2Fxmhks0bxGSBdJ92vM42m')
  })
  it('falls back to an encoded search', () => {
    expect(spotifyDeepLink({ title: 'Été & Hiver', artist: 'Zaz' })).toBe(`spotify:search:${encodeURIComponent('Zaz Été & Hiver')}`)
  })
})

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [7.9, '0:07'],
    [30, '0:30'],
    [61, '1:01'],
    [600, '10:00'],
    [NaN, '0:00'],
    [Infinity, '0:00'],
    [-3, '0:00'],
  ])('%s → %s', (s, out) => expect(formatTime(s)).toBe(out))
})

describe('initials', () => {
  it('takes the first letters of the first two words', () => expect(initials({ title: 'bad guy', artist: 'x' })).toBe('BG'))
  it('uses two letters of a single word', () => expect(initials({ title: 'Halo', artist: 'x' })).toBe('HA'))
  it('ignores bracketed suffixes and punctuation', () => expect(initials({ title: '(Remastered) "Yesterday"', artist: 'x' })).toBe('YE'))
  it('handles non-Latin scripts', () => expect(initials({ title: 'Кино группа', artist: 'x' })).toBe('КГ'))
  it('falls back to a note', () => expect(initials({ title: '', artist: '' })).toBe('♪'))
})

describe('trackHue', () => {
  it('is stable and in range', () => {
    const h = trackHue({ title: 'A', artist: 'B' })
    expect(h).toBe(trackHue({ title: 'A', artist: 'B' }))
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(360)
  })
})

describe('isMobileUA', () => {
  it('detects phones', () => expect(isMobileUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true))
  it('detects iPadOS posing as a Mac', () => expect(isMobileUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true))
  it('leaves desktops alone', () => expect(isMobileUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false))
})

describe('tiltFromOrientation', () => {
  it('is relative to the baseline and clamped', () => {
    expect(tiltFromOrientation(45, 0, { beta: 45, gamma: 0 })).toEqual({ x: 0, y: 0 })
    expect(tiltFromOrientation(45 + 14, -14, { beta: 45, gamma: 0 })).toEqual({ x: 0.5, y: -0.5 })
    expect(tiltFromOrientation(170, 90, { beta: 45, gamma: 0 })).toEqual({ x: 1, y: 1 })
  })
})
