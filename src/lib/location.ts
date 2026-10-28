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
}

export const location = createStore<LocationState>({ gps: null, gpsStatus: 'idle', searched: null }, 'backpack:location')

export function activeCoords(s: LocationState): { coords: Coords | null; source: 'gps' | 'search' | 'none' } {
  if (s.searched) return { coords: { lat: s.searched.lat, lng: s.searched.lng }, source: 'search' }
  if (s.gps) return { coords: s.gps, source: 'gps' }
  return { coords: null, source: 'none' }
}
