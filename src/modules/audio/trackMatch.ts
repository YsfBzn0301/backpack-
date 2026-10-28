/**
 * Pure helpers for the TrackMatchModal (no DOM access, unit-tested in node).
 */
import type { Track } from '@/services/audio'

type Linkable = Pick<Track, 'title' | 'artist' | 'spotifyId'>

/** Spotify app URI: the exact track when we know its id, a search otherwise. */
export function spotifyDeepLink(t: Linkable): string {
  if (t.spotifyId) return `spotify:track:${encodeURIComponent(t.spotifyId)}`
  return `spotify:search:${encodeURIComponent(`${t.artist} ${t.title}`.trim())}`
}

/** Seconds as m:ss. Anything non-finite or negative reads 0:00. */
export function formatTime(sec: number): string {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Up to two initials for the generated artwork placeholder. */
export function initials(t: Pick<Track, 'title' | 'artist'>): string {
  const words = (t.title || t.artist || '').replace(/[([].*?[)\]]/g, ' ').split(/[\s\-_/&]+/u).filter((w) => /[\p{L}\p{N}]/u.test(w))
  const first = (w?: string) => (w ? [...w.replace(/^[^\p{L}\p{N}]+/u, '')][0] ?? '' : '')
  const out = words.length > 1 ? first(words[0]) + first(words[1]) : [...(words[0] ?? '')].filter((c) => /[\p{L}\p{N}]/u.test(c)).slice(0, 2).join('')
  return out.toUpperCase() || '♪'
}

/** Stable hue (0-359) for a track, used for placeholder gradients and glows. */
export function trackHue(t: Pick<Track, 'title' | 'artist'>): number {
  let h = 7
  for (const ch of `${t.artist}|${t.title}`) h = (h * 31 + ch.charCodeAt(0)) % 3600
  return Math.floor(h / 10)
}

/** Phones and tablets, where a spotify: URI can hand off to the app. */
export function isMobileUA(ua: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
  // iPadOS 13+ reports a desktop Mac UA but has touch.
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

/** Normalised device tilt (-1..1) from DeviceOrientation angles relative to a baseline. */
export function tiltFromOrientation(beta: number, gamma: number, base: { beta: number; gamma: number }, range = 28): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  return { x: clamp((beta - base.beta) / range), y: clamp((gamma - base.gamma) / range) }
}
