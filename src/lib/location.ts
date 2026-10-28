import { createStore } from './store'
import type { Coords } from '@/agents/protocol'

export interface SearchedPlace {
  name: string
  region?: string
  country?: string
  countryCode?: string
  lat: number
  lng: number
}

export interface LocationState {
  gps: (Coords & { at: number }) | null
  gpsStatus: 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'
  /** A destination the user searched; overrides GPS for weather & agents until cleared. */
  searched: SearchedPlace | null
  /** Bumped to restart the GPS watch (the "Retry" button). */
  retry: number
}

export const location = createStore<LocationState>({ gps: null, gpsStatus: 'idle', searched: null, retry: 0 }, 'backpack:location')

export const requestLocation = () => location.set((s) => ({ retry: s.retry + 1, gpsStatus: 'locating' }))

export function activeCoords(s: LocationState): { coords: Coords | null; source: 'gps' | 'search' | 'none' } {
  if (s.searched) return { coords: { lat: s.searched.lat, lng: s.searched.lng }, source: 'search' }
  if (s.gps) return { coords: s.gps, source: 'gps' }
  return { coords: null, source: 'none' }
}
