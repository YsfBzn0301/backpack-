/**
 * Routes the traveller saved in the planner. `from: null` means "my
 * location", so a saved commute follows you around. Stored on this device.
 */
import { createStore } from './store'
import type { Place } from '@/services/transit'

export interface SavedRoute {
  id: string
  from: Place | null
  to: Place
  savedAt: number
}

const MAX = 12

export const savedRoutes = createStore({ list: [] as SavedRoute[] }, 'bp:saved-routes')

const placeKey = (p: Place | null) => (!p || p.here ? 'here' : (p.id ?? `${p.lat?.toFixed(4)},${p.lng?.toFixed(4)}`))
export const routeId = (from: Place | null, to: Place) => `${placeKey(from)}>${placeKey(to)}`

export const isSaved = (list: SavedRoute[], from: Place | null, to: Place) => list.some((r) => r.id === routeId(from, to))

export function saveRoute(from: Place | null, to: Place) {
  const id = routeId(from, to)
  savedRoutes.set((s) => ({
    list: s.list.some((r) => r.id === id) ? s.list : [{ id, from: from?.here ? null : from, to, savedAt: Date.now() }, ...s.list].slice(0, MAX),
  }))
}

export function removeRoute(id: string) {
  savedRoutes.set((s) => ({ list: s.list.filter((r) => r.id !== id) }))
}
